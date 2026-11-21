import { Body, CanActivate, Controller, ExecutionContext, Get, HttpCode, Inject, Injectable, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { hash, verify } from '@node-rs/argon2';
import { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth';
import { brandingContrastIssues } from '../common/color';
import { signJwt, verifyJwt } from '../common/crypto';
import { ApiError, notFound, parse, uuid } from '../common/errors';
import { RateLimiter } from '../common/rate-limit';
import { CLOCK, CONFIG, Clock, Config, DB } from '../config';
import { Db, Q } from '../db/db';
import { DEMO_POSTER_KEY, DEMO_VIDEO_KEY } from '../db/seed-data';
import { audit, AuthService, normEmail } from './identity';
import { AssignmentRow, routeState } from './learning';
import { Tenant, TenantsService } from './tenants';

/** Celular peruano de 9 dígitos a formato E.164 (+51…). Es un dato de contacto opcional, no sirve para ingresar. */
const toE164 = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.length === 9 ? `+51${d}` : `+${d}`;
};

/**
 * Consola de administración (paso 1 para una clase real).
 * Dos tipos de administrador:
 *  - de plataforma (Nivia): token typ=admin, opera cualquier empresa;
 *  - de empresa: aprendiz con membership.role = 'admin', solo su empresa.
 */
export interface AdminCtx { kind: 'platform' | 'tenant'; id: string; tenantId?: string }

const ADMIN_TTL_S = 8 * 3600;

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(CONFIG) private cfg: Config, @Inject(CLOCK) private clock: Clock, @Inject(DB) private db: Db) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: AdminCtx; params: Record<string, string> }>();
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión como administrador.');
    const nowS = Math.floor(this.clock.now().getTime() / 1000);
    const claims = verifyJwt<{ typ: string; sub: string; tid?: string }>(header.slice(7), this.cfg.secret, nowS);
    if (!claims) throw new ApiError(401, 'TOKEN_INVALID', 'Tu sesión venció. Vuelve a ingresar.');
    if (claims.typ === 'admin') { req.admin = { kind: 'platform', id: claims.sub }; return true; }
    if (claims.typ === 'access' && claims.tid) {
      const role = await this.db.tenant(claims.tid, async (q) =>
        (await q.query<{ role: string }>('select role from membership where user_id = $1', [claims.sub])).rows[0]?.role);
      if (role === 'admin') { req.admin = { kind: 'tenant', id: claims.sub, tenantId: claims.tid }; return true; }
    }
    throw new ApiError(403, 'FORBIDDEN', 'No tienes permisos de administración.');
  }
}

/* ---------- Esquemas de entrada ---------- */
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const BrandingIn = z.object({
  mono: z.string().min(1).max(2),
  accent: Hex, on_accent: Hex.default('#0E0F11'), principal: Hex, principal_text: Hex,
  logo_url: z.string().url().nullable().default(null),
  areas: z.array(z.string().min(1)).min(1)
});
const PolicyIn = z.object({
  min_score: z.number().int().min(1).max(100), attempts: z.number().int().min(1).max(10),
  wait_minutes: z.number().int().min(0).default(0), question_count: z.number().int().min(1).max(50),
  minutes: z.number().int().min(1).max(180), max_pause_minutes: z.number().int().min(0).default(10),
  exhausted_message: z.string().min(1)
});
const TenantIn = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().min(2), cert_prefix: z.string().regex(/^[A-Z]{2,6}$/),
  cert_validity_months: z.number().int().min(1).max(60).default(12),
  branding: BrandingIn, exam_policy: PolicyIn
});
const UserIn = z.object({
  first_name: z.string().min(1), last_name: z.string().min(1), email: z.string().email().max(200),
  phone: z.string().min(9).max(16).optional(),
  area: z.string().optional(), role: z.enum(['admin', 'supervisor']).optional(),
  /** Por defecto se envía una invitación por correo. Con contraseña temporal no se envía nada. */
  temporary_password: z.string().min(8).optional()
});
const QuestionIn = z.object({
  prompt: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(6), correct_index: z.number().int().min(0),
  why: z.string().min(1), video_t: z.number().int().min(0).default(0),
  in_quiz: z.boolean().default(true), in_exam: z.boolean().default(true),
  source_refs: z.array(z.record(z.string(), z.unknown())).default([])
}).refine((q) => q.correct_index < q.options.length, { message: 'correct_index fuera de rango' });
const LessonIn = z.object({
  title: z.string().min(1), format: z.enum(['presenter', 'animated']).default('presenter'),
  duration_s: z.number().int().min(1), summary: z.array(z.string().min(1)).min(1),
  ai_generated: z.boolean().default(false),
  video_key: z.string().optional(), poster_key: z.string().optional(), size_bytes: z.number().int().min(1).optional(),
  questions: z.array(QuestionIn).min(1)
});
const RouteIn = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/), title: z.string().min(1), overline: z.string().min(1),
  levels: z.array(z.object({ title: z.string().min(1), lessons: z.array(LessonIn).min(1) })).min(1)
});
const AssignIn = z.object({
  route_id: uuid, user_ids: z.array(uuid).min(1), due_at: z.string().datetime({ offset: true }),
  kind: z.enum(['initial', 'renewal']).default('initial')
});

@Injectable()
export class AdminService {
  private limiter = new RateLimiter(5, 15 * 60_000);
  constructor(
    @Inject(DB) private db: Db, @Inject(CONFIG) private cfg: Config, @Inject(CLOCK) private clock: Clock,
    private tenants: TenantsService, private auth: AuthService
  ) {}

  async login(username: string, password: string) {
    const nowMs = this.clock.now().getTime();
    this.limiter.check(`admin:${username}`, nowMs, 'Demasiados intentos. Espera unos minutos.');
    const a = (await this.db.system((q) => q.query<{ id: string; password_hash: string }>(
      'select id, password_hash from platform_admin where username = $1', [username]))).rows[0];
    if (!a || !(await verify(a.password_hash, password))) {
      this.limiter.hit(`admin:${username}`, nowMs);
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }
    this.limiter.reset(`admin:${username}`);
    return { access_token: signJwt({ typ: 'admin', sub: a.id }, this.cfg.secret, ADMIN_TTL_S, Math.floor(nowMs / 1000)), expires_in: ADMIN_TTL_S };
  }

  /** Resuelve la empresa y comprueba que el administrador puede operarla. */
  private async scope(admin: AdminCtx, slug: string): Promise<Tenant> {
    const t = await this.tenants.bySlug(slug);
    if (admin.kind === 'tenant' && admin.tenantId !== t.id) throw new ApiError(403, 'FORBIDDEN', 'Solo puedes administrar tu empresa.');
    return t;
  }

  async listTenants(admin: AdminCtx) {
    if (admin.kind === 'tenant') return { tenants: [await this.db.anon((q) => this.tenants.byId(q, admin.tenantId!))].map(pub) };
    return { tenants: (await this.db.system((q) => q.query<Tenant>('select * from tenant order by name'))).rows.map(pub) };
  }

  async createTenant(admin: AdminCtx, raw: unknown) {
    if (admin.kind !== 'platform') throw new ApiError(403, 'FORBIDDEN', 'Solo Nivia crea empresas.');
    const b = parse(TenantIn, raw);
    const issues = brandingContrastIssues(b.branding);
    if (issues.length) throw new ApiError(400, 'BRANDING_CONTRAST', 'La marca no pasa contraste AA (4,5:1).', { issues });
    const exists = (await this.db.system((q) => q.query('select 1 from tenant where slug = $1', [b.slug]))).rows.length;
    if (exists) throw new ApiError(409, 'SLUG_TAKEN', 'Ya existe una empresa con ese identificador.');
    const t = (await this.db.system((q) => q.query<Tenant>(
      `insert into tenant (slug, name, mono, branding, exam_policy, cert_prefix, cert_validity_months)
       values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7) returning *`,
      [b.slug, b.name, b.branding.mono, JSON.stringify(b.branding), JSON.stringify(b.exam_policy), b.cert_prefix, b.cert_validity_months]))).rows[0];
    return pub(t);
  }

  async createUsers(admin: AdminCtx, slug: string, raw: unknown) {
    const t = await this.scope(admin, slug);
    const list = parse(z.array(UserIn).min(1).max(500), Array.isArray(raw) ? raw : [raw]);
    return this.db.tenant(t.id, async (q) => {
      const created = [];
      for (const u of list) {
        if (u.area && !t.branding.areas.includes(u.area)) throw new ApiError(400, 'VALIDATION_ERROR', `Área desconocida: ${u.area}`);
        const email = normEmail(u.email);
        const dup = (await q.query('select 1 from app_user where lower(email) = $1', [email])).rows.length;
        if (dup) throw new ApiError(409, 'EMAIL_TAKEN', `El correo ${u.email} ya está registrado.`);
        const row = (await q.query<{ id: string; first_name: string; last_name: string; email: string; email_verified_at: Date | null }>(
          `insert into app_user (tenant_id, first_name, last_name, email, phone, area) values ($1, $2, $3, $4, $5, $6)
           returning id, first_name, last_name, email, email_verified_at`,
          [t.id, u.first_name, u.last_name, email, u.phone ? toE164(u.phone) : null, u.area ?? null])).rows[0];
        await q.query('insert into credential (user_id, tenant_id, password_hash, is_temporary) values ($1, $2, $3, $4)',
          [row.id, t.id, u.temporary_password ? await hash(u.temporary_password) : null, !!u.temporary_password]);
        if (u.role) await q.query('insert into membership (tenant_id, user_id, role) values ($1, $2, $3)', [t.id, row.id, u.role]);
        await audit(q, t.id, admin.kind === 'tenant' ? admin.id : null, 'admin.user_created', { user_id: row.id, by: admin.kind, role: u.role ?? 'learner' });
        // Sin contraseña temporal: se envía la invitación. El enlace también vuelve aquí por si hay que compartirlo a mano.
        const inviteUrl = u.temporary_password ? null : await this.auth.sendInvite(q, t, row);
        created.push({ id: row.id, first_name: row.first_name, last_name: row.last_name, email, role: u.role ?? 'learner',
          invite_sent: !!inviteUrl, invite_url: inviteUrl });
      }
      return { users: created };
    });
  }

  async listUsers(admin: AdminCtx, slug: string) {
    const t = await this.scope(admin, slug);
    return this.db.tenant(t.id, async (q) => ({
      users: (await q.query(
        `select u.id, u.first_name, u.last_name, u.email, u.phone, u.area, coalesce(m.role, 'learner') as role,
                case when u.email_verified_at is null then 'invited' else 'active' end as status,
                (c.password_hash is not null and not c.is_temporary) as has_password,
                exists (select 1 from user_identity i where i.user_id = u.id) as has_google
           from app_user u left join membership m on m.user_id = u.id left join credential c on c.user_id = u.id
          order by u.last_name, u.first_name`)).rows
    }));
  }

  /** Reenvía la invitación (por ejemplo, si venció o no llegó). */
  async resendInvite(admin: AdminCtx, slug: string, userId: string) {
    const t = await this.scope(admin, slug);
    return this.db.tenant(t.id, async (q) => {
      const u = (await q.query<{ id: string; first_name: string; last_name: string; email: string; email_verified_at: Date | null }>(
        'select id, first_name, last_name, email, email_verified_at from app_user where id = $1', [userId])).rows[0];
      if (!u) throw notFound('Persona');
      const url = await this.auth.sendInvite(q, t, u);
      await audit(q, t.id, admin.kind === 'tenant' ? admin.id : null, 'admin.invite_sent', { user_id: userId });
      return { invite_sent: true, invite_url: url };
    });
  }

  async setRole(admin: AdminCtx, slug: string, userId: string, raw: unknown) {
    const t = await this.scope(admin, slug);
    const { role } = parse(z.object({ role: z.enum(['admin', 'supervisor', 'learner']) }), raw);
    return this.db.tenant(t.id, async (q) => {
      if (!(await q.query('select 1 from app_user where id = $1', [userId])).rows.length) throw notFound('Persona');
      await q.query('delete from membership where user_id = $1', [userId]);
      if (role !== 'learner') await q.query('insert into membership (tenant_id, user_id, role) values ($1, $2, $3)', [t.id, userId, role]);
      await audit(q, t.id, admin.kind === 'tenant' ? admin.id : null, 'admin.role_set', { user_id: userId, role });
      return { user_id: userId, role };
    });
  }

  /** Crea una ruta completa en borrador: niveles, lecciones, preguntas y los archivos de video. */
  async createRoute(admin: AdminCtx, slug: string, raw: unknown) {
    const t = await this.scope(admin, slug);
    const r = parse(RouteIn, raw);
    return this.db.tenant(t.id, async (q) => {
      const dup = (await q.query('select 1 from route where slug = $1', [r.slug])).rows.length;
      if (dup) throw new ApiError(409, 'SLUG_TAKEN', 'Ya existe una ruta con ese identificador.');
      const routeId = (await q.query<{ id: string }>('insert into route (tenant_id, slug) values ($1, $2) returning id', [t.id, r.slug])).rows[0].id;
      const rv = (await q.query<{ id: string }>(
        `insert into route_version (tenant_id, route_id, version, status, title, overline) values ($1, $2, 1, 'draft', $3, $4) returning id`,
        [t.id, routeId, r.title, r.overline])).rows[0].id;
      let pos = 0; const lessons = [];
      for (const [li, lv] of r.levels.entries()) {
        const levelId = (await q.query<{ id: string }>('insert into level (tenant_id, route_version_id, position, title) values ($1, $2, $3, $4) returning id',
          [t.id, rv, li + 1, lv.title])).rows[0].id;
        for (const l of lv.lessons) {
          pos++;
          const lessonId = (await q.query<{ id: string }>(
            `insert into lesson (tenant_id, route_version_id, level_id, position, title, format, duration_s, summary, ai_generated)
             values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) returning id`,
            [t.id, rv, levelId, pos, l.title, l.format, l.duration_s, JSON.stringify(l.summary), l.ai_generated])).rows[0].id;
          // Sin video propio, la lección usa el de demostración hasta que se suba uno (paso 3).
          const video = l.video_key ?? DEMO_VIDEO_KEY; const size = l.size_bytes ?? 2_634_000;
          for (const [kind, key, sz] of [['hls', video, size], ['mp4_offline', video, size], ['poster', l.poster_key ?? DEMO_POSTER_KEY, 24_000]] as const) {
            await q.query('insert into lesson_asset (tenant_id, lesson_id, kind, storage_key, size_bytes) values ($1, $2, $3, $4, $5)', [t.id, lessonId, kind, key, sz]);
          }
          for (const [qi, qq] of l.questions.entries()) {
            await q.query(
              `insert into question (tenant_id, lesson_id, position, prompt, options, correct_index, why, video_t, source_refs, in_quiz, in_exam)
               values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10, $11)`,
              [t.id, lessonId, qi + 1, qq.prompt, JSON.stringify(qq.options), qq.correct_index, qq.why, qq.video_t, JSON.stringify(qq.source_refs), qq.in_quiz, qq.in_exam]);
          }
          lessons.push({ id: lessonId, level: li + 1, title: l.title, questions: l.questions.length });
        }
      }
      await audit(q, t.id, admin.kind === 'tenant' ? admin.id : null, 'admin.route_created', { route_id: routeId, version_id: rv });
      return { route_id: routeId, version_id: rv, status: 'draft', lessons };
    });
  }

  async listRoutes(admin: AdminCtx, slug: string) {
    const t = await this.scope(admin, slug);
    return this.db.tenant(t.id, async (q) => ({
      routes: (await q.query(
        `select r.id as route_id, r.slug, rv.id as version_id, rv.version, rv.status, rv.title, rv.published_at,
                (select count(*)::int from lesson l where l.route_version_id = rv.id) as lessons,
                (select count(*)::int from assignment a where a.route_version_id = rv.id and a.status = 'active') as active_assignments
           from route r join route_version rv on rv.route_id = r.id order by r.slug, rv.version`)).rows
    }));
  }

  /** Publicar congela la versión: desde aquí solo se asigna, no se edita. */
  async publishRoute(admin: AdminCtx, slug: string, routeId: string) {
    const t = await this.scope(admin, slug);
    return this.db.tenant(t.id, async (q) => {
      const rv = (await q.query<{ id: string; status: string }>(
        'select id, status from route_version where route_id = $1 order by version desc limit 1', [routeId])).rows[0];
      if (!rv) throw notFound('Ruta');
      if (rv.status === 'published') return { version_id: rv.id, status: 'published' };
      const bad = (await q.query<{ title: string; n: number }>(
        `select l.title, (select count(*)::int from question qq where qq.lesson_id = l.id and qq.in_exam) as n
           from lesson l where l.route_version_id = $1`, [rv.id])).rows.filter((x) => x.n === 0);
      if (bad.length) throw new ApiError(400, 'ROUTE_INCOMPLETE', 'Cada lección necesita al menos una pregunta de evaluación.', { lessons: bad.map((x) => x.title) });
      await q.query("update route_version set status = 'published', published_at = $2 where id = $1", [rv.id, this.clock.now()]);
      await audit(q, t.id, admin.kind === 'tenant' ? admin.id : null, 'admin.route_published', { version_id: rv.id });
      return { version_id: rv.id, status: 'published' };
    });
  }

  async assign(admin: AdminCtx, slug: string, raw: unknown) {
    const t = await this.scope(admin, slug);
    const b = parse(AssignIn, raw);
    return this.db.tenant(t.id, async (q) => {
      const rv = (await q.query<{ id: string }>(
        "select id from route_version where route_id = $1 and status = 'published' order by version desc limit 1", [b.route_id])).rows[0];
      if (!rv) throw new ApiError(409, 'ROUTE_NOT_PUBLISHED', 'Publica la ruta antes de asignarla.');
      const out = [];
      for (const uid of b.user_ids) {
        if (!(await q.query('select 1 from app_user where id = $1', [uid])).rows.length) throw notFound(`Persona ${uid}`);
        const existing = (await q.query<{ id: string }>(
          "select id from assignment where user_id = $1 and route_version_id = $2 and status = 'active'", [uid, rv.id])).rows[0];
        if (existing) { out.push({ user_id: uid, assignment_id: existing.id, created: false }); continue; }
        const id = (await q.query<{ id: string }>(
          `insert into assignment (tenant_id, user_id, route_version_id, kind, assigned_at, due_at) values ($1, $2, $3, $4, $5, $6) returning id`,
          [t.id, uid, rv.id, b.kind, this.clock.now(), b.due_at])).rows[0].id;
        out.push({ user_id: uid, assignment_id: id, created: true });
      }
      await audit(q, t.id, admin.kind === 'tenant' ? admin.id : null, 'admin.assigned', { version_id: rv.id, users: b.user_ids.length });
      return { assignments: out };
    });
  }

  /** Seguimiento: avance por persona, quién aprobó, quién va tarde, certificados. */
  async progress(admin: AdminCtx, slug: string) {
    const t = await this.scope(admin, slug);
    return this.db.tenant(t.id, async (q) => {
      const now = this.clock.now();
      const rows = (await q.query<AssignmentRow & { first_name: string; last_name: string; email: string }>(
        `select a.*, rv.title, rv.overline, u.first_name, u.last_name, u.email
           from assignment a join route_version rv on rv.id = a.route_version_id join app_user u on u.id = a.user_id
          where a.status <> 'cancelled' order by u.last_name, u.first_name, a.assigned_at`)).rows;
      const people = [];
      for (const a of rows) {
        const st = await routeState(q, a, t.exam_policy);
        const attempts = (await q.query<{ n: number; last: number | null }>(
          `select count(*)::int as n, max(score) as last from exam_attempt where assignment_id = $1 and status <> 'in_progress'`, [a.id])).rows[0];
        const cert = (await q.query<{ code: string; expires_at: Date }>('select code, expires_at from certificate where assignment_id = $1', [a.id])).rows[0];
        people.push({
          user: { id: a.user_id, name: `${a.first_name} ${a.last_name}`, email: a.email },
          assignment_id: a.id, route_title: a.title, kind: a.kind, status: a.status,
          pct: st.pct, due_at: a.due_at.toISOString(), late: a.due_at < now && !st.passed,
          exam: { attempts: attempts.n, best_score: attempts.last, passed: st.passed },
          certificate: cert ? { code: cert.code, expires_at: cert.expires_at.toISOString() } : null
        });
      }
      const summary = {
        people: people.length,
        completed: people.filter((p) => p.exam.passed).length,
        in_progress: people.filter((p) => !p.exam.passed && p.pct > 0).length,
        not_started: people.filter((p) => p.pct === 0).length,
        late: people.filter((p) => p.late).length
      };
      return { summary, people };
    });
  }
}

function pub(t: Tenant) {
  return { id: t.id, slug: t.slug, name: t.name, branding: t.branding, exam_policy: t.exam_policy, cert_prefix: t.cert_prefix, cert_validity_months: t.cert_validity_months };
}

@Controller('admin')
export class AdminAuthController {
  constructor(private svc: AdminService) {}
  @Public() @Post('auth/login') @HttpCode(200)
  login(@Body() body: unknown) {
    const b = parse(z.object({ username: z.string().min(1), password: z.string().min(1) }), body);
    return this.svc.login(b.username, b.password);
  }
}

const Admin = () => UseGuards(AdminGuard);
const ctx = (req: Request): AdminCtx => (req as Request & { admin: AdminCtx }).admin;

@Public()
@Admin()
@Controller('admin/tenants')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get() list(@Req() req: Request) { return this.svc.listTenants(ctx(req)); }
  @Post() create(@Req() req: Request, @Body() body: unknown) { return this.svc.createTenant(ctx(req), body); }
  @Get(':slug/users') users(@Req() req: Request, @Param('slug') slug: string) { return this.svc.listUsers(ctx(req), slug); }
  @Post(':slug/users') createUsers(@Req() req: Request, @Param('slug') slug: string, @Body() body: unknown) { return this.svc.createUsers(ctx(req), slug, body); }
  @Post(':slug/users/:id/invite') @HttpCode(200) invite(@Req() req: Request, @Param('slug') slug: string, @Param('id') id: string) { return this.svc.resendInvite(ctx(req), slug, parse(uuid, id)); }
  @Put(':slug/users/:id/role') role(@Req() req: Request, @Param('slug') slug: string, @Param('id') id: string, @Body() body: unknown) { return this.svc.setRole(ctx(req), slug, parse(uuid, id), body); }
  @Get(':slug/routes') routes(@Req() req: Request, @Param('slug') slug: string) { return this.svc.listRoutes(ctx(req), slug); }
  @Post(':slug/routes') createRoute(@Req() req: Request, @Param('slug') slug: string, @Body() body: unknown) { return this.svc.createRoute(ctx(req), slug, body); }
  @Post(':slug/routes/:id/publish') @HttpCode(200) publish(@Req() req: Request, @Param('slug') slug: string, @Param('id') id: string) { return this.svc.publishRoute(ctx(req), slug, parse(uuid, id)); }
  @Post(':slug/assignments') assign(@Req() req: Request, @Param('slug') slug: string, @Body() body: unknown) { return this.svc.assign(ctx(req), slug, body); }
  @Get(':slug/progress') progress(@Req() req: Request, @Param('slug') slug: string) { return this.svc.progress(ctx(req), slug); }
}
