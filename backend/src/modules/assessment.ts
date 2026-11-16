import { Body, Controller, Get, HttpCode, Inject, Injectable, Logger, Param, Post, Put } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { Auth, AuthCtx } from '../common/auth';
import { ApiError, notFound, parse, uuid } from '../common/errors';
import { CLOCK, Clock, DB } from '../config';
import { Db, Q } from '../db/db';
import { CertificationService } from './certification';
import { audit } from './identity';
import { assignmentFor, AssignmentRow, routeState } from './learning';
import { ExamPolicy, Tenant, TenantsService } from './tenants';

/**
 * Tiempo de la evaluación en el servidor.
 * La app manda un latido cada 15 s. Si los latidos se cortan (sin señal), solo se cuentan
 * GRACE_S segundos y el resto se toma como pausa, hasta max_pause_minutes en total (decisión D6).
 * Pasada esa pausa, el tiempo vuelve a correr.
 */
export const GRACE_S = 20;

export interface AttemptRow {
  id: string;
  tenant_id: string;
  assignment_id: string;
  user_id: string;
  number: number;
  question_ids: string[];
  time_limit_s: number;
  time_used_s: number;
  paused_s: number;
  started_at: Date;
  last_seen_at: Date;
  status: 'in_progress' | 'submitted' | 'expired';
  score: number | null;
  passed: boolean | null;
  weak_lesson_ids: string[] | null;
  finished_at: Date | null;
}

/** Cálculo puro del avance del reloj: se prueba aparte. */
export function advanceClock(a: Pick<AttemptRow, 'time_used_s' | 'paused_s' | 'last_seen_at'>, now: Date, maxPauseS: number) {
  const gap = Math.max(0, (now.getTime() - a.last_seen_at.getTime()) / 1000);
  const counted = Math.min(gap, GRACE_S);
  const excess = gap - counted;
  const pause = Math.min(excess, Math.max(0, maxPauseS - a.paused_s));
  return { time_used_s: a.time_used_s + counted + (excess - pause), paused_s: a.paused_s + pause };
}

@Injectable()
export class AssessmentService {
  private log = new Logger('Assessment');

  constructor(
    @Inject(DB) private db: Db,
    @Inject(CLOCK) private clock: Clock,
    private tenants: TenantsService,
    private certs: CertificationService
  ) {}

  private async attemptsInfo(q: Q, a: AssignmentRow, policy: ExamPolicy) {
    const rows = (await q.query<AttemptRow>('select * from exam_attempt where assignment_id = $1 order by number', [a.id])).rows;
    const finished = rows.filter((r) => r.status !== 'in_progress');
    const lastFail = [...finished].reverse().find((r) => !r.passed);
    const retryAt = lastFail && policy.wait_minutes
      ? new Date(lastFail.finished_at!.getTime() + policy.wait_minutes * 60_000) : null;
    return {
      rows,
      used: finished.length,
      left: Math.max(0, policy.attempts - finished.length),
      retryAt: retryAt && retryAt > this.clock.now() ? retryAt : null,
      inProgress: rows.find((r) => r.status === 'in_progress') || null,
      passed: rows.some((r) => r.passed)
    };
  }

  async examInfo(auth: AuthCtx, assignmentId: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const tenant = await this.tenants.byId(q, auth.tenantId);
      const a = await assignmentFor(q, auth.userId, assignmentId);
      const st = await routeState(q, a, tenant.exam_policy);
      const info = await this.attemptsInfo(q, a, tenant.exam_policy);
      const blocked = info.passed ? 'ALREADY_PASSED' : !st.all_lessons_done ? 'LESSONS_INCOMPLETE'
        : info.inProgress ? null : info.left === 0 ? 'ATTEMPTS_EXHAUSTED' : info.retryAt ? 'RETRY_AFTER' : null;
      const p = tenant.exam_policy;
      return {
        assignment_id: a.id,
        rules: { min_score: p.min_score, attempts: p.attempts, wait_minutes: p.wait_minutes, question_count: p.question_count,
          minutes: p.minutes, requires_connection: true, exhausted_message: p.exhausted_message },
        attempts_used: info.used,
        attempts_left: info.left,
        retry_at: info.retryAt?.toISOString() ?? null,
        in_progress_attempt_id: info.inProgress?.id ?? null,
        can_start: !blocked,
        blocked_reason: blocked
      };
    });
  }

  /** Empieza un intento, o devuelve el que está en curso (reanudar). */
  async start(auth: AuthCtx, assignmentId: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const tenant = await this.tenants.byId(q, auth.tenantId);
      const p = tenant.exam_policy;
      const a = await assignmentFor(q, auth.userId, assignmentId);
      const st = await routeState(q, a, p);
      const info = await this.attemptsInfo(q, a, p);
      if (info.passed) throw new ApiError(409, 'ALREADY_PASSED', 'Ya aprobaste esta evaluación.');
      if (info.inProgress) return this.view(q, tenant, await this.touch(q, tenant, info.inProgress));
      if (!st.all_lessons_done) throw new ApiError(409, 'LESSONS_INCOMPLETE', 'Primero completa todos los niveles de la ruta.');
      if (info.left === 0) throw new ApiError(409, 'ATTEMPTS_EXHAUSTED', `Usaste tus ${p.attempts} intentos. ${p.exhausted_message}`);
      if (info.retryAt) throw new ApiError(409, 'RETRY_AFTER', 'Aún no puedes reintentar.', { retry_at: info.retryAt.toISOString() });

      const ids = await this.pickQuestions(q, a.route_version_id, p.question_count);
      const now = this.clock.now();
      const row = (await q.query<AttemptRow>(
        `insert into exam_attempt (tenant_id, assignment_id, user_id, number, question_ids, time_limit_s, started_at, last_seen_at)
         values ($1, $2, $3, $4, $5::jsonb, $6, $7, $7) returning *`,
        [auth.tenantId, a.id, auth.userId, info.rows.length + 1, JSON.stringify(ids), p.minutes * 60, now])).rows[0];
      await audit(q, auth.tenantId, auth.userId, 'exam.started', { attempt_id: row.id });
      return this.view(q, tenant, row);
    });
  }

  /** Preguntas al azar del banco, repartidas entre las lecciones de la ruta. */
  private async pickQuestions(q: Q, routeVersionId: string, n: number): Promise<string[]> {
    const rows = (await q.query<{ id: string; lesson_id: string }>(
      `select q.id, q.lesson_id from question q join lesson l on l.id = q.lesson_id
        where l.route_version_id = $1 and q.in_exam order by l.position, q.position`, [routeVersionId])).rows;
    const byLesson = new Map<string, string[]>();
    for (const r of rows) byLesson.set(r.lesson_id, [...(byLesson.get(r.lesson_id) || []), r.id]);
    const pools = [...byLesson.values()].map((ids) => {
      for (let i = ids.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      return ids;
    });
    const out: string[] = [];
    while (out.length < n && pools.some((p) => p.length)) for (const p of pools) if (p.length && out.length < n) out.push(p.shift()!);
    return out;
  }

  private async load(q: Q, auth: AuthCtx, attemptId: string): Promise<{ tenant: Tenant; row: AttemptRow }> {
    const row = (await q.query<AttemptRow>('select * from exam_attempt where id = $1 and user_id = $2 for update',
      [attemptId, auth.userId])).rows[0];
    if (!row) throw notFound('Intento');
    return { tenant: await this.tenants.byId(q, auth.tenantId), row };
  }

  /** Avanza el reloj; si se acabó el tiempo, califica lo respondido. */
  private async touch(q: Q, tenant: Tenant, row: AttemptRow): Promise<AttemptRow> {
    if (row.status !== 'in_progress') return row;
    const now = this.clock.now();
    const next = advanceClock(row, now, tenant.exam_policy.max_pause_minutes * 60);
    const updated = (await q.query<AttemptRow>(
      'update exam_attempt set time_used_s = $2, paused_s = $3, last_seen_at = $4 where id = $1 returning *',
      [row.id, next.time_used_s, next.paused_s, now])).rows[0];
    if (updated.time_used_s >= updated.time_limit_s) return this.grade(q, tenant, updated, 'expired');
    return updated;
  }

  private async view(q: Q, tenant: Tenant, row: AttemptRow) {
    const qs = (await q.query<{ id: string; prompt: string; options: string[] }>(
      'select id, prompt, options from question where id = any($1::uuid[])', [row.question_ids])).rows;
    const byId = new Map(qs.map((x) => [x.id, x]));
    const answers = Object.fromEntries((await q.query<{ question_id: string; choice: number }>(
      'select question_id, choice from attempt_answer where attempt_id = $1', [row.id])).rows.map((r) => [r.question_id, r.choice]));
    const base = {
      id: row.id, number: row.number, status: row.status,
      time_limit_s: row.time_limit_s,
      remaining_s: Math.max(0, Math.round(row.time_limit_s - row.time_used_s)),
      pause_left_s: Math.max(0, Math.round(tenant.exam_policy.max_pause_minutes * 60 - row.paused_s)),
      // Las preguntas de la evaluación nunca viajan con la respuesta correcta.
      questions: row.question_ids.map((id) => ({ id, prompt: byId.get(id)!.prompt, options: byId.get(id)!.options })),
      answers,
      unanswered: row.question_ids.filter((id) => answers[id] === undefined).length
    };
    return row.status === 'in_progress' ? base : { ...base, result: await this.result(q, tenant, row) };
  }

  async get(auth: AuthCtx, attemptId: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const { tenant, row } = await this.load(q, auth, attemptId);
      return this.view(q, tenant, await this.touch(q, tenant, row));
    });
  }

  async answer(auth: AuthCtx, attemptId: string, questionId: string, raw: unknown) {
    const { choice } = parse(z.object({ choice: z.number().int().min(0) }), raw);
    return this.db.tenant(auth.tenantId, async (q) => {
      const { tenant, row: r0 } = await this.load(q, auth, attemptId);
      const row = await this.touch(q, tenant, r0);
      if (row.status !== 'in_progress') {
        throw new ApiError(409, 'ATTEMPT_CLOSED', 'La evaluación ya terminó.', { result: await this.result(q, tenant, row) });
      }
      if (!row.question_ids.includes(questionId)) throw notFound('Pregunta');
      const opts = (await q.query<{ options: string[] }>('select options from question where id = $1', [questionId])).rows[0].options;
      if (choice >= opts.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Opción fuera de rango.');
      await q.query(
        `insert into attempt_answer (tenant_id, attempt_id, question_id, choice, answered_at) values ($1, $2, $3, $4, $5)
         on conflict (attempt_id, question_id) do update set choice = excluded.choice, answered_at = excluded.answered_at`,
        [auth.tenantId, row.id, questionId, choice, this.clock.now()]);
      return { remaining_s: Math.max(0, Math.round(row.time_limit_s - row.time_used_s)) };
    });
  }

  async heartbeat(auth: AuthCtx, attemptId: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const { tenant, row: r0 } = await this.load(q, auth, attemptId);
      const row = await this.touch(q, tenant, r0);
      return {
        status: row.status,
        remaining_s: Math.max(0, Math.round(row.time_limit_s - row.time_used_s)),
        pause_left_s: Math.max(0, Math.round(tenant.exam_policy.max_pause_minutes * 60 - row.paused_s))
      };
    });
  }

  async submit(auth: AuthCtx, attemptId: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const { tenant, row: r0 } = await this.load(q, auth, attemptId);
      let row = await this.touch(q, tenant, r0);
      if (row.status === 'in_progress') row = await this.grade(q, tenant, row, 'submitted');
      return this.result(q, tenant, row);
    });
  }

  /** Califica en el servidor; si aprueba, emite el certificado en la misma transacción. */
  private async grade(q: Q, tenant: Tenant, row: AttemptRow, status: 'submitted' | 'expired'): Promise<AttemptRow> {
    const qs = (await q.query<{ id: string; lesson_id: string; correct_index: number }>(
      'select id, lesson_id, correct_index from question where id = any($1::uuid[])', [row.question_ids])).rows;
    const answers = new Map((await q.query<{ question_id: string; choice: number }>(
      'select question_id, choice from attempt_answer where attempt_id = $1', [row.id])).rows.map((r) => [r.question_id, r.choice]));
    const wrong = qs.filter((x) => answers.get(x.id) !== x.correct_index);
    const score = Math.round(((qs.length - wrong.length) / qs.length) * 100);
    const passed = score >= tenant.exam_policy.min_score;
    const weak = [...new Set(wrong.map((x) => x.lesson_id))];
    const now = this.clock.now();
    const out = (await q.query<AttemptRow>(
      `update exam_attempt set status = $2, score = $3, passed = $4, weak_lesson_ids = $5::jsonb, finished_at = $6
        where id = $1 returning *`, [row.id, status, score, passed, JSON.stringify(weak), now])).rows[0];
    await audit(q, tenant.id, row.user_id, 'exam.graded', { attempt_id: row.id, score, passed, status });
    if (passed) {
      const a = (await q.query<AssignmentRow>(
        `select a.*, rv.title, rv.overline from assignment a join route_version rv on rv.id = a.route_version_id where a.id = $1`,
        [row.assignment_id])).rows[0];
      await q.query("update assignment set status = 'completed', completed_at = $2 where id = $1", [a.id, now]);
      await this.certs.issue(q, tenant, row.user_id, a, score);
    }
    return out;
  }

  private async result(q: Q, tenant: Tenant, row: AttemptRow) {
    const p = tenant.exam_policy;
    const a = (await q.query<AssignmentRow>(
      `select a.*, rv.title, rv.overline from assignment a join route_version rv on rv.id = a.route_version_id where a.id = $1`,
      [row.assignment_id])).rows[0];
    const info = await this.attemptsInfo(q, a, p);
    const weak = row.weak_lesson_ids?.length
      ? (await q.query('select l.id, l.title, lv.position as level_position from lesson l join level lv on lv.id = l.level_id where l.id = any($1::uuid[]) order by lv.position, l.position', [row.weak_lesson_ids])).rows
      : [];
    const cert = row.passed
      ? (await q.query<{ id: string; code: string }>('select id, code from certificate where assignment_id = $1', [a.id])).rows[0] : null;
    return {
      attempt_id: row.id,
      status: row.status,
      score: row.score,
      min_score: p.min_score,
      passed: row.passed,
      closed_by_time: row.status === 'expired',
      topics_to_review: row.passed ? [] : weak,
      attempts_left: info.left,
      retry_at: row.passed ? null : info.retryAt?.toISOString() ?? null,
      exhausted_message: !row.passed && info.left === 0 ? p.exhausted_message : null,
      certificate: cert
    };
  }

  /** Cierra intentos abandonados cuyo tiempo ya se acabó. Corre periódicamente en main.ts. */
  async sweepExpired(): Promise<number> {
    const open = await this.db.system((q) => q.query<{ id: string; tenant_id: string; user_id: string }>(
      "select id, tenant_id, user_id from exam_attempt where status = 'in_progress'"));
    let closed = 0;
    for (const o of open.rows) {
      try {
        const res = await this.get({ tenantId: o.tenant_id, userId: o.user_id, sessionId: '', passwordChangeRequired: false }, o.id);
        if (res.status !== 'in_progress') closed++;
      } catch (e) {
        this.log.warn(`No se pudo revisar el intento ${o.id}: ${(e as Error).message}`);
      }
    }
    return closed;
  }
}

@Controller()
export class AssessmentController {
  constructor(private svc: AssessmentService) {}

  @Get('assignments/:id/exam') info(@Auth() a: AuthCtx, @Param('id') id: string) { return this.svc.examInfo(a, parse(uuid, id)); }
  @Post('assignments/:id/attempts') start(@Auth() a: AuthCtx, @Param('id') id: string) { return this.svc.start(a, parse(uuid, id)); }
  @Get('attempts/:id') get(@Auth() a: AuthCtx, @Param('id') id: string) { return this.svc.get(a, parse(uuid, id)); }
  @Put('attempts/:id/answers/:qid') answer(@Auth() a: AuthCtx, @Param('id') id: string, @Param('qid') qid: string, @Body() body: unknown) {
    return this.svc.answer(a, parse(uuid, id), parse(uuid, qid), body);
  }
  @Post('attempts/:id/heartbeat') @HttpCode(200) beat(@Auth() a: AuthCtx, @Param('id') id: string) { return this.svc.heartbeat(a, parse(uuid, id)); }
  @Post('attempts/:id/submit') @HttpCode(200) submit(@Auth() a: AuthCtx, @Param('id') id: string) { return this.svc.submit(a, parse(uuid, id)); }
}
