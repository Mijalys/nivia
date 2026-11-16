import { Body, Controller, Get, HttpCode, Inject, Injectable, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Auth, AuthCtx } from '../common/auth';
import { signPath } from '../common/crypto';
import { ApiError, notFound, parse, uuid } from '../common/errors';
import { CLOCK, CONFIG, Clock, Config, DB } from '../config';
import { Db, Q } from '../db/db';
import { ExamPolicy, TenantsService } from './tenants';

/** Minutos estimados por lección (video + reto) para "Te quedan N min aprox.". */
export const MINUTES_PER_LESSON = 6;
/** Un certificado "vence pronto" si le quedan 30 días o menos (supuesto del Corte 1). */
export const EXPIRING_SOON_DAYS = 30;

export interface LessonRow {
  id: string;
  route_version_id: string;
  level_id: string;
  level_position: number;
  level_title: string;
  position: number;
  title: string;
  format: 'presenter' | 'animated';
  duration_s: number;
  summary: string[];
  ai_generated: boolean;
}

export interface AssignmentRow {
  id: string;
  user_id: string;
  route_version_id: string;
  kind: 'initial' | 'renewal';
  status: 'active' | 'completed' | 'cancelled';
  due_at: Date;
  assigned_at: Date;
  title: string;
  overline: string;
}

interface Progress { completed_at: Date | null; watched: boolean; video_position_s: number }

export type LevelState = 'done' | 'in_progress' | 'available' | 'locked';

export async function routeLessons(q: Q, routeVersionId: string): Promise<LessonRow[]> {
  return (await q.query<LessonRow>(
    `select l.id, l.route_version_id, l.level_id, lv.position as level_position, lv.title as level_title,
            l.position, l.title, l.format, l.duration_s, l.summary, l.ai_generated
       from lesson l join level lv on lv.id = l.level_id
      where l.route_version_id = $1 order by lv.position, l.position`, [routeVersionId])).rows;
}

export async function assignmentFor(q: Q, userId: string, assignmentId: string): Promise<AssignmentRow> {
  const r = await q.query<AssignmentRow>(
    `select a.*, rv.title, rv.overline from assignment a join route_version rv on rv.id = a.route_version_id
      where a.id = $1 and a.user_id = $2`, [assignmentId, userId]);
  if (!r.rows[0]) throw notFound('Asignación');
  return r.rows[0];
}

export async function hasPassed(q: Q, assignmentId: string): Promise<boolean> {
  return (await q.query('select 1 from exam_attempt where assignment_id = $1 and passed', [assignmentId])).rows.length > 0;
}

/**
 * Estado de una ruta para una asignación: niveles, bloqueo secuencial, avance y siguiente lección.
 * Es la misma regla para la PWA, la sincronización y la evaluación.
 */
export async function routeState(q: Q, a: AssignmentRow, policy: ExamPolicy) {
  const lessons = await routeLessons(q, a.route_version_id);
  const prog = new Map<string, Progress>(
    (await q.query<Progress & { lesson_id: string }>('select * from lesson_progress where assignment_id = $1', [a.id])).rows
      .map((p) => [p.lesson_id, p]));
  const passed = await hasPassed(q, a.id);

  const byLevel = new Map<number, LessonRow[]>();
  for (const l of lessons) byLevel.set(l.level_position, [...(byLevel.get(l.level_position) || []), l]);

  let prevDone = true;
  const levels = [...byLevel.entries()].sort((x, y) => x[0] - y[0]).map(([pos, ls]) => {
    const items = ls.map((l) => {
      const p = prog.get(l.id);
      return { id: l.id, title: l.title, format: l.format, duration_s: l.duration_s,
        completed: !!p?.completed_at, watched: !!p?.watched, video_position_s: p?.video_position_s ?? 0 };
    });
    const done = items.every((i) => i.completed);
    const started = items.some((i) => i.completed || i.watched || i.video_position_s > 0);
    const state: LevelState = done ? 'done' : !prevDone ? 'locked' : started ? 'in_progress' : 'available';
    prevDone = prevDone && done;
    return { position: pos, title: ls[0].level_title, state, lessons: items };
  });

  const completed = lessons.filter((l) => prog.get(l.id)?.completed_at).length;
  const next = lessons.find((l) => !prog.get(l.id)?.completed_at) || null;
  const allDone = !next;
  return {
    lessons,
    levels,
    passed,
    all_lessons_done: allDone,
    pct: Math.round(((completed + (passed ? 1 : 0)) / (lessons.length + 1)) * 100),
    remaining_minutes: (lessons.length - completed) * MINUTES_PER_LESSON + (passed ? 0 : policy.minutes),
    next_lesson: next ? { id: next.id, title: next.title, level_position: next.level_position, level_count: levels.length,
      format: next.format, duration_s: next.duration_s } : null,
    isLocked: (lessonId: string) => {
      const l = lessons.find((x) => x.id === lessonId);
      return !l || levels.find((lv) => lv.position === l.level_position)!.state === 'locked';
    }
  };
}

const daysBetween = (from: Date, to: Date) => Math.round((Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) / 86_400_000);

const SyncEvent = z.object({
  event_id: uuid,
  type: z.enum(['video.position', 'lesson.watched', 'quiz.completed']),
  lesson_id: uuid,
  occurred_at: z.string().datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()).default({})
});
const SyncBody = z.object({ events: z.array(SyncEvent).min(1).max(200) });
type SyncEventT = z.infer<typeof SyncEvent>;

@Injectable()
export class LearningService {
  constructor(
    @Inject(DB) private db: Db,
    @Inject(CONFIG) private cfg: Config,
    @Inject(CLOCK) private clock: Clock,
    private tenants: TenantsService
  ) {}

  async home(auth: AuthCtx) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const tenant = await this.tenants.byId(q, auth.tenantId);
      const now = this.clock.now();
      const user = (await q.query('select first_name from app_user where id = $1', [auth.userId])).rows[0];
      const rows = (await q.query<AssignmentRow>(
        `select a.*, rv.title, rv.overline from assignment a join route_version rv on rv.id = a.route_version_id
          where a.user_id = $1 and a.status = 'active'`, [auth.userId])).rows;
      const items = [];
      for (const a of rows) {
        const st = await routeState(q, a, tenant.exam_policy);
        items.push({ a, st, late: a.due_at < now && !st.passed });
      }
      // La más urgente primero: vencidas arriba, luego la fecha límite más próxima.
      items.sort((x, y) => Number(y.late) - Number(x.late) || x.a.due_at.getTime() - y.a.due_at.getTime());
      const first = items.find((i) => !i.st.passed);
      const certs = (await q.query<{ id: string; route_title: string; expires_at: Date }>(
        `select id, route_title, expires_at from certificate where user_id = $1 and status = 'valid' and expires_at >= $2
          order by expires_at`, [auth.userId, now])).rows
        .filter((c) => daysBetween(now, c.expires_at) <= EXPIRING_SOON_DAYS);
      return {
        user: { first_name: user.first_name },
        today: now.toISOString(),
        next: first ? (first.st.next_lesson
          ? { type: 'lesson', assignment_id: first.a.id, route_title: first.a.title, lesson: first.st.next_lesson }
          : { type: 'exam', assignment_id: first.a.id, route_title: first.a.title, question_count: tenant.exam_policy.question_count })
          : null,
        assignments: items.map(({ a, st, late }) => ({
          id: a.id, kind: a.kind, route_title: a.title, pct: st.pct, due_at: a.due_at.toISOString(), late,
          days_left: daysBetween(now, a.due_at), remaining_minutes: st.remaining_minutes
        })),
        certificates_expiring: certs.map((c) => ({ id: c.id, route_title: c.route_title, expires_at: c.expires_at.toISOString(),
          days_left: daysBetween(now, c.expires_at) }))
      };
    });
  }

  async assignment(auth: AuthCtx, id: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const tenant = await this.tenants.byId(q, auth.tenantId);
      const a = await assignmentFor(q, auth.userId, id);
      const st = await routeState(q, a, tenant.exam_policy);
      const now = this.clock.now();
      return {
        id: a.id, kind: a.kind, status: a.status,
        route: { title: a.title, overline: a.overline },
        pct: st.pct, due_at: a.due_at.toISOString(), late: a.due_at < now && !st.passed, days_left: daysBetween(now, a.due_at),
        remaining_minutes: st.remaining_minutes,
        levels: st.levels,
        exam: { state: st.passed ? 'passed' : st.all_lessons_done ? 'available' : 'locked',
          question_count: tenant.exam_policy.question_count, minutes: tenant.exam_policy.minutes },
        next_lesson: st.next_lesson
      };
    });
  }

  /** Busca la asignación del usuario que contiene la lección (la activa primero). */
  private async lessonContext(q: Q, auth: AuthCtx, lessonId: string) {
    const l = (await q.query<{ route_version_id: string }>('select route_version_id from lesson where id = $1', [lessonId])).rows[0];
    if (!l) throw notFound('Lección');
    const a = (await q.query<AssignmentRow>(
      `select a.*, rv.title, rv.overline from assignment a join route_version rv on rv.id = a.route_version_id
        where a.user_id = $1 and a.route_version_id = $2 and a.status <> 'cancelled'
        order by (a.status = 'active') desc, a.assigned_at desc limit 1`, [auth.userId, l.route_version_id])).rows[0];
    if (!a) throw notFound('Lección');
    return a;
  }

  private mediaUrl(key: string, ttlS = 3600) {
    const exp = Math.floor(this.clock.now().getTime() / 1000) + ttlS;
    return this.cfg.publicUrl + signPath(`/media/${key}`, this.cfg.secret, exp);
  }

  private async lessonPayload(q: Q, auth: AuthCtx, lessonId: string, ttlS: number) {
    const tenant = await this.tenants.byId(q, auth.tenantId);
    const a = await this.lessonContext(q, auth, lessonId);
    const st = await routeState(q, a, tenant.exam_policy);
    const l = st.lessons.find((x) => x.id === lessonId)!;
    if (st.isLocked(lessonId)) {
      const prev = st.levels.find((lv) => lv.position === l.level_position - 1);
      throw new ApiError(409, 'LESSON_LOCKED', `Primero completa el Nivel ${prev?.position}: ${prev?.title}`,
        { requires_level: prev ? { position: prev.position, title: prev.title } : null });
    }
    const assets = (await q.query<{ kind: string; storage_key: string; size_bytes: number }>(
      'select kind, storage_key, size_bytes from lesson_asset where lesson_id = $1', [lessonId])).rows;
    const quiz = (await q.query(
      `select id, prompt, options, correct_index, why, video_t from question where lesson_id = $1 and in_quiz order by position`,
      [lessonId])).rows;
    const p = st.levels.flatMap((lv) => lv.lessons).find((x) => x.id === lessonId)!;
    return {
      assets,
      body: {
        id: l.id, assignment_id: a.id, title: l.title, format: l.format, duration_s: l.duration_s,
        level: { position: l.level_position, title: l.level_title, count: st.levels.length },
        ai_generated: l.ai_generated,
        summary: l.summary,
        media: Object.fromEntries(assets.map((x) => [x.kind, { url: this.mediaUrl(x.storage_key, ttlS), size_bytes: x.size_bytes }])),
        // El reto es de bajo riesgo y debe funcionar sin señal: viaja con respuestas y "por qué".
        quiz,
        progress: { completed: p.completed, watched: p.watched, video_position_s: p.video_position_s }
      }
    };
  }

  async lesson(auth: AuthCtx, lessonId: string) {
    return this.db.tenant(auth.tenantId, async (q) => (await this.lessonPayload(q, auth, lessonId, 3600)).body);
  }

  /** Paquete para ver sin señal: tamaño real antes de descargar, URLs firmadas por 24 h y el JSON de la lección. */
  async offlinePackage(auth: AuthCtx, lessonId: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const { assets, body } = await this.lessonPayload(q, auth, lessonId, 86_400);
      const files = assets.filter((x) => x.kind !== 'hls').map((x) => ({ kind: x.kind, url: this.mediaUrl(x.storage_key, 86_400), size_bytes: x.size_bytes }));
      return {
        lesson_id: lessonId,
        size_bytes: files.reduce((s, f) => s + f.size_bytes, 0),
        expires_at: new Date(this.clock.now().getTime() + 86_400_000).toISOString(),
        files,
        bundle: body
      };
    });
  }

  /**
   * Recibe avance hecho con o sin señal. Idempotente por event_id: reenviar un lote no duplica nada.
   * Completar es irreversible, la posición del video se queda con la mayor y nada se descarta en silencio.
   */
  async sync(auth: AuthCtx, raw: unknown) {
    const { events } = parse(SyncBody, raw);
    const ordered = [...events].sort((x, y) => Date.parse(x.occurred_at) - Date.parse(y.occurred_at));
    return this.db.tenant(auth.tenantId, async (q) => {
      const tenant = await this.tenants.byId(q, auth.tenantId);
      const results: Record<string, unknown>[] = [];
      const touched = new Map<string, AssignmentRow>();
      for (const ev of ordered) {
        const prev = (await q.query<{ status: string; reason: string | null; user_id: string }>(
          'select status, reason, user_id from progress_event where event_id = $1', [ev.event_id])).rows[0];
        if (prev) {
          results.push({ event_id: ev.event_id, status: prev.status, reason: prev.reason ?? undefined, duplicate: true });
          continue;
        }
        const out = await this.applyEvent(q, auth, tenant.exam_policy, ev);
        if (out.assignment) touched.set(out.assignment.id, out.assignment);
        await q.query(
          `insert into progress_event (event_id, tenant_id, user_id, device_session_id, type, lesson_id, payload, occurred_at, received_at, status, reason)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)`,
          [ev.event_id, auth.tenantId, auth.userId, auth.sessionId, ev.type, ev.lesson_id, JSON.stringify(ev.payload),
            ev.occurred_at, this.clock.now(), out.status, out.reason ?? null]);
        results.push({ event_id: ev.event_id, status: out.status, reason: out.reason, ...out.extra });
      }
      const assignments = [];
      for (const a of touched.values()) {
        const st = await routeState(q, a, tenant.exam_policy);
        assignments.push({ id: a.id, pct: st.pct, next_lesson: st.next_lesson, exam_available: st.all_lessons_done && !st.passed });
      }
      return { results, assignments };
    });
  }

  private async applyEvent(q: Q, auth: AuthCtx, policy: ExamPolicy, ev: SyncEventT):
    Promise<{ status: 'accepted' | 'rejected'; reason?: string; assignment?: AssignmentRow; extra?: Record<string, unknown> }> {
    let a: AssignmentRow;
    try {
      a = await this.lessonContext(q, auth, ev.lesson_id);
    } catch {
      return { status: 'rejected', reason: 'LESSON_NOT_ASSIGNED' };
    }
    if (a.status !== 'active') return { status: 'rejected', reason: 'ASSIGNMENT_CLOSED' };
    const st = await routeState(q, a, policy);
    if (st.isLocked(ev.lesson_id)) return { status: 'rejected', reason: 'LESSON_LOCKED' };

    await q.query(
      `insert into lesson_progress (tenant_id, assignment_id, lesson_id) values ($1, $2, $3)
       on conflict (assignment_id, lesson_id) do nothing`, [auth.tenantId, a.id, ev.lesson_id]);

    if (ev.type === 'video.position') {
      const pos = Number(ev.payload.position_s);
      if (!Number.isFinite(pos) || pos < 0) return { status: 'rejected', reason: 'INVALID_PAYLOAD' };
      await q.query(
        `update lesson_progress set video_position_s = greatest(video_position_s, $3), updated_at = $4
          where assignment_id = $1 and lesson_id = $2`, [a.id, ev.lesson_id, Math.floor(pos), this.clock.now()]);
      return { status: 'accepted', assignment: a };
    }
    if (ev.type === 'lesson.watched') {
      await q.query('update lesson_progress set watched = true, updated_at = $3 where assignment_id = $1 and lesson_id = $2',
        [a.id, ev.lesson_id, this.clock.now()]);
      return { status: 'accepted', assignment: a };
    }
    // quiz.completed: el reto completa la lección (supuesto 5 del Corte 1: no se aprueba ni desaprueba).
    const qs = (await q.query<{ id: string; correct_index: number }>(
      'select id, correct_index from question where lesson_id = $1 and in_quiz order by position', [ev.lesson_id])).rows;
    const answers = ev.payload.answers;
    if (!Array.isArray(answers) || answers.length !== qs.length || !answers.every((x) => Number.isInteger(x))) {
      return { status: 'rejected', reason: 'INVALID_PAYLOAD' };
    }
    const review = qs.map((qq, i) => ({ question_id: qq.id, correct: answers[i] === qq.correct_index }));
    const correct = review.filter((r) => r.correct).length;
    await q.query(
      `insert into quiz_result (tenant_id, assignment_id, lesson_id, event_id, answers, correct, total, occurred_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [auth.tenantId, a.id, ev.lesson_id, ev.event_id, JSON.stringify(answers), correct, qs.length, ev.occurred_at]);
    await q.query(
      `update lesson_progress set watched = true, completed_at = coalesce(completed_at, $3), updated_at = $4
        where assignment_id = $1 and lesson_id = $2`, [a.id, ev.lesson_id, ev.occurred_at, this.clock.now()]);
    return { status: 'accepted', assignment: a, extra: { correct, total: qs.length, review } };
  }

  async report(auth: AuthCtx, raw: unknown) {
    const b = parse(z.object({
      lesson_id: uuid, question_id: uuid.optional(),
      reason: z.enum(['confusing_question', 'content_error', 'video_unclear']),
      comment: z.string().max(1000).optional()
    }), raw);
    return this.db.tenant(auth.tenantId, async (q) => {
      await this.lessonContext(q, auth, b.lesson_id);
      const r = await q.query<{ id: string }>(
        `insert into content_report (tenant_id, user_id, lesson_id, question_id, reason, comment, created_at)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [auth.tenantId, auth.userId, b.lesson_id, b.question_id ?? null, b.reason, b.comment ?? null, this.clock.now()]);
      return { id: r.rows[0].id, message: 'Gracias. Lo revisaremos.' };
    });
  }
}

@Controller()
export class LearningController {
  constructor(private learning: LearningService) {}

  @Get('home') home(@Auth() a: AuthCtx) { return this.learning.home(a); }
  @Get('assignments/:id') assignment(@Auth() a: AuthCtx, @Param('id') id: string) { return this.learning.assignment(a, parse(uuid, id)); }
  @Get('lessons/:id') lesson(@Auth() a: AuthCtx, @Param('id') id: string) { return this.learning.lesson(a, parse(uuid, id)); }
  @Get('lessons/:id/offline-package') pkg(@Auth() a: AuthCtx, @Param('id') id: string) { return this.learning.offlinePackage(a, parse(uuid, id)); }
  @Post('sync/events') @HttpCode(200) sync(@Auth() a: AuthCtx, @Body() body: unknown) { return this.learning.sync(a, body); }
  @Post('content-reports') report(@Auth() a: AuthCtx, @Body() body: unknown) { return this.learning.report(a, body); }
}
