import { Body, Controller, Get, HttpCode, Inject, Injectable, Patch, Post, Query, Req } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { Request } from 'express';
import { z } from 'zod';
import { AllowPendingPassword, Auth, AuthCtx, Public, tenantSlugFrom } from '../common/auth';
import { randomToken, sha256, signJwt } from '../common/crypto';
import { ApiError, parse } from '../common/errors';
import { RateLimiter } from '../common/rate-limit';
import { CLOCK, CONFIG, Clock, Config, DB, EMAIL, GOOGLE } from '../config';
import { Db, Q } from '../db/db';
import { brandedEmail, EmailSender } from './email';
import { GoogleVerifier } from './google';
import { Tenant, TenantsService } from './tenants';

/** Vigencia de los enlaces que llegan por correo. */
const TTL = { invite: 7 * 86_400_000, reset: 30 * 60_000, login: 15 * 60_000 } as const;
type Purpose = keyof typeof TTL;
/** Parámetro "accion" del enlace que abre la app. */
const ACTION: Record<Purpose, string> = { invite: 'invitacion', reset: 'restablecer', login: 'entrar' };

export function passwordRules(pw: string, previous?: string) {
  return { min_length: pw.length >= 8, has_number: /\d/.test(pw), differs: previous === undefined || pw !== previous };
}

export const hashPassword = (pw: string) => hash(pw);
export const normEmail = (e: string) => e.trim().toLowerCase();

interface UserRow { id: string; first_name: string; last_name: string; email: string; email_verified_at: Date | null }

@Injectable()
export class AuthService {
  private loginLimiter = new RateLimiter(5, 15 * 60_000);
  private mailLimiter = new RateLimiter(3, 15 * 60_000);

  constructor(
    @Inject(DB) private db: Db,
    @Inject(CONFIG) private cfg: Config,
    @Inject(CLOCK) private clock: Clock,
    @Inject(EMAIL) private email: EmailSender,
    @Inject(GOOGLE) private googleVerifier: GoogleVerifier,
    private tenants: TenantsService
  ) {}

  private nowS() { return Math.floor(this.clock.now().getTime() / 1000); }

  private accessToken(userId: string, tenantId: string, sessionId: string, pwd: boolean) {
    return signJwt({ typ: 'access', sub: userId, tid: tenantId, sid: sessionId, pwd }, this.cfg.secret, this.cfg.accessTtlS, this.nowS());
  }

  /** Crea una sesión por dispositivo. El token de renovación lleva empresa y sesión para ubicarla. */
  private async openSession(q: Q, tenantId: string, user: { id: string; first_name: string }, pwd: boolean, deviceLabel?: string) {
    const secret = randomToken();
    const expires = new Date(this.clock.now().getTime() + this.cfg.refreshTtlDays * 86_400_000);
    const s = await q.query<{ id: string }>(
      `insert into device_session (tenant_id, user_id, refresh_hash, device_label, expires_at, created_at, last_seen_at)
       values ($1, $2, $3, $4, $5, $6, $6) returning id`,
      [tenantId, user.id, sha256(secret), deviceLabel ?? null, expires, this.clock.now()]);
    const sid = s.rows[0].id;
    return {
      access_token: this.accessToken(user.id, tenantId, sid, pwd),
      refresh_token: `${tenantId}.${sid}.${secret}`,
      expires_in: this.cfg.accessTtlS,
      password_change_required: pwd,
      user: { id: user.id, first_name: user.first_name }
    };
  }

  private findByEmail(q: Q, email: string) {
    return q.query<UserRow>('select id, first_name, last_name, email, email_verified_at from app_user where lower(email) = $1', [normEmail(email)])
      .then((r) => r.rows[0]);
  }

  /* ---------- Correo y contraseña ---------- */

  async login(slug: string, email: string, password: string, deviceLabel?: string) {
    const tenant = await this.tenants.bySlug(slug);
    const key = `${tenant.id}:${normEmail(email)}`;
    const nowMs = this.clock.now().getTime();
    this.loginLimiter.check(key, nowMs, 'Demasiados intentos. Espera unos minutos y vuelve a intentar.');
    return this.db.tenant(tenant.id, async (q) => {
      const r = await q.query<UserRow & { password_hash: string | null; is_temporary: boolean }>(
        `select u.id, u.first_name, u.last_name, u.email, u.email_verified_at, c.password_hash, c.is_temporary
           from app_user u join credential c on c.user_id = u.id where lower(u.email) = $1`, [normEmail(email)]);
      const u = r.rows[0];
      if (!u || !u.password_hash || !(await verify(u.password_hash, password))) {
        this.loginLimiter.hit(key, nowMs);
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no coinciden. Revisa e intenta de nuevo.');
      }
      this.loginLimiter.reset(key);
      await audit(q, tenant.id, u.id, 'auth.login', { method: 'password' });
      return this.openSession(q, tenant.id, u, u.is_temporary, deviceLabel);
    });
  }

  /* ---------- Google ---------- */

  /**
   * "Continuar con Google": solo entra quien la empresa invitó con ese correo.
   * La primera vez se vincula la cuenta de Google; después se reconoce por su identificador.
   */
  async google(slug: string, idToken: string, deviceLabel?: string) {
    const tenant = await this.tenants.bySlug(slug);
    const g = await this.googleVerifier.verify(idToken, this.nowS());
    return this.db.tenant(tenant.id, async (q) => {
      let u = (await q.query<UserRow>(
        `select u.id, u.first_name, u.last_name, u.email, u.email_verified_at from user_identity i join app_user u on u.id = i.user_id
          where i.provider = 'google' and i.subject = $1`, [g.sub])).rows[0];
      if (!u) {
        u = await this.findByEmail(q, g.email);
        if (!u) throw new ApiError(403, 'NOT_INVITED', 'Tu empresa aún no te invitó. Pide acceso a tu supervisor.', { email: g.email });
        await q.query('insert into user_identity (tenant_id, user_id, provider, subject, email) values ($1, $2, $3, $4, $5)',
          [tenant.id, u.id, 'google', g.sub, normEmail(g.email)]);
      }
      await this.markVerified(q, u.id);
      // Una contraseña temporal deja de servir: con Google ya no hace falta.
      await q.query('update credential set password_hash = null, is_temporary = false where user_id = $1 and is_temporary', [u.id]);
      await audit(q, tenant.id, u.id, 'auth.login', { method: 'google' });
      return this.openSession(q, tenant.id, u, false, deviceLabel);
    });
  }

  /* ---------- Enlaces por correo ---------- */

  /** Crea un enlace de un solo uso. El token lleva la empresa para ubicarlo; se guarda solo su hash. */
  private async issueToken(q: Q, tenantId: string, userId: string, purpose: Purpose) {
    await q.query('update email_token set consumed_at = $3 where user_id = $1 and purpose = $2 and consumed_at is null',
      [userId, purpose, this.clock.now()]);
    const secret = randomToken();
    await q.query('insert into email_token (tenant_id, user_id, purpose, token_hash, expires_at, created_at) values ($1, $2, $3, $4, $5, $6)',
      [tenantId, userId, purpose, sha256(secret), new Date(this.clock.now().getTime() + TTL[purpose]), this.clock.now()]);
    return `${tenantId}.${secret}`;
  }

  private link(t: Tenant, purpose: Purpose, token: string) {
    return `${this.cfg.appUrl}?empresa=${encodeURIComponent(t.slug)}&accion=${ACTION[purpose]}&token=${encodeURIComponent(token)}`;
  }

  private async lookupToken(token: string, purposes: Purpose[], consume: boolean) {
    const [tenantId, secret] = token.split('.');
    const invalid = new ApiError(400, 'LINK_INVALID', 'Este enlace ya no sirve. Pide uno nuevo.');
    if (!tenantId || !secret || !z.string().uuid().safeParse(tenantId).success) throw invalid;
    return this.db.tenant(tenantId, async (q) => {
      const t = (await q.query<{ id: string; user_id: string; purpose: Purpose; expires_at: Date; consumed_at: Date | null }>(
        'select id, user_id, purpose, expires_at, consumed_at from email_token where token_hash = $1', [sha256(secret)])).rows[0];
      if (!t || t.consumed_at || !purposes.includes(t.purpose)) throw invalid;
      if (t.expires_at < this.clock.now()) throw new ApiError(400, 'LINK_EXPIRED', 'El enlace venció. Pide uno nuevo.');
      if (consume) await q.query('update email_token set consumed_at = $2 where id = $1', [t.id, this.clock.now()]);
      const u = (await q.query<UserRow>('select id, first_name, last_name, email, email_verified_at from app_user where id = $1', [t.user_id])).rows[0];
      return { tenantId, purpose: t.purpose, user: u };
    });
  }

  private async markVerified(q: Q, userId: string) {
    await q.query('update app_user set email_verified_at = coalesce(email_verified_at, $2) where id = $1', [userId, this.clock.now()]);
  }

  /** Invitación con la marca del cliente. La usa la consola al crear personas o reenviar. */
  async sendInvite(q: Q, t: Tenant, u: UserRow) {
    const token = await this.issueToken(q, t.id, u.id, 'invite');
    const url = this.link(t, 'invite', token);
    await this.email.send(brandedEmail(t, u.email, `${u.first_name} ${u.last_name}`, `${t.name} te invita a tu capacitación`,
      [`Hola, ${u.first_name}.`, `${t.name} te invitó a su capacitación en Nivia. Crea tu contraseña o entra con tu cuenta de Google usando este mismo correo.`],
      { label: 'Aceptar invitación', url }, 'El enlace vence en 7 días. Si no esperabas este correo, ignóralo.'));
    return url;
  }

  /** "¿Olvidaste tu contraseña?" y "Entrar con un enlace": siempre la misma respuesta, exista o no el correo. */
  async requestEmail(slug: string, email: string, purpose: 'reset' | 'login') {
    const t = await this.tenants.bySlug(slug);
    const key = `${t.id}:${purpose}:${normEmail(email)}`;
    const nowMs = this.clock.now().getTime();
    this.mailLimiter.check(key, nowMs, 'Ya pediste varios correos. Espera unos minutos.');
    this.mailLimiter.hit(key, nowMs);
    await this.db.tenant(t.id, async (q) => {
      const u = await this.findByEmail(q, email);
      if (!u) return;
      const url = this.link(t, purpose, await this.issueToken(q, t.id, u.id, purpose));
      const msg = purpose === 'reset'
        ? brandedEmail(t, u.email, u.first_name, 'Restablece tu contraseña',
          [`Hola, ${u.first_name}.`, 'Pediste crear una contraseña nueva para tu capacitación.'],
          { label: 'Crear contraseña nueva', url }, 'El enlace vence en 30 minutos y sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña no cambia.')
        : brandedEmail(t, u.email, u.first_name, 'Tu enlace para entrar',
          [`Hola, ${u.first_name}.`, 'Toca el botón para entrar a tu capacitación sin escribir contraseña.'],
          { label: 'Entrar a mi capacitación', url }, 'El enlace vence en 15 minutos y sirve una sola vez.');
      await this.email.send(msg);
    });
    return { sent: true, resend_after_s: 60 };
  }

  /** Para la pantalla que abre el enlace: a quién saluda y qué pedir, sin gastar el enlace. */
  async tokenInfo(token: string) {
    const r = await this.lookupToken(token, ['invite', 'reset', 'login'], false);
    const t = await this.db.anon((q) => this.tenants.byId(q, r.tenantId));
    return { purpose: r.purpose, first_name: r.user.first_name, email: r.user.email, company: t.name, tenant: t.slug };
  }

  /** Crea la contraseña desde una invitación o un restablecimiento, y deja la sesión abierta. */
  async setPassword(token: string, newPassword: string, deviceLabel?: string) {
    checkRules(newPassword);
    const r = await this.lookupToken(token, ['invite', 'reset'], true);
    return this.db.tenant(r.tenantId, async (q) => {
      await q.query(
        `insert into credential (user_id, tenant_id, password_hash, is_temporary, updated_at) values ($1, $2, $3, false, $4)
         on conflict (user_id) do update set password_hash = excluded.password_hash, is_temporary = false, updated_at = excluded.updated_at`,
        [r.user.id, r.tenantId, await hashPassword(newPassword), this.clock.now()]);
      await this.markVerified(q, r.user.id);
      if (r.purpose === 'reset') {
        await q.query('update device_session set revoked_at = $2 where user_id = $1 and revoked_at is null', [r.user.id, this.clock.now()]);
      }
      await audit(q, r.tenantId, r.user.id, r.purpose === 'invite' ? 'auth.invite_accepted' : 'auth.password_reset', {});
      return this.openSession(q, r.tenantId, r.user, false, deviceLabel);
    });
  }

  async loginWithLink(token: string, deviceLabel?: string) {
    const r = await this.lookupToken(token, ['login'], true);
    return this.db.tenant(r.tenantId, async (q) => {
      await this.markVerified(q, r.user.id);
      await audit(q, r.tenantId, r.user.id, 'auth.login', { method: 'email_link' });
      const temp = (await q.query<{ is_temporary: boolean }>('select is_temporary from credential where user_id = $1', [r.user.id])).rows[0]?.is_temporary;
      return this.openSession(q, r.tenantId, r.user, !!temp, deviceLabel);
    });
  }

  /* ---------- Sesión ---------- */

  async refresh(token: string) {
    const [tenantId, sid, secret] = token.split('.');
    if (!tenantId || !sid || !secret || !z.string().uuid().safeParse(tenantId).success || !z.string().uuid().safeParse(sid).success) {
      throw new ApiError(401, 'SESSION_INVALID', 'Vuelve a ingresar.');
    }
    const out = await this.db.tenant(tenantId, async (q) => {
      const r = await q.query<{ user_id: string; refresh_hash: string; expires_at: Date; revoked_at: Date | null; is_temporary: boolean | null }>(
        `select s.user_id, s.refresh_hash, s.expires_at, s.revoked_at, c.is_temporary
           from device_session s left join credential c on c.user_id = s.user_id where s.id = $1`, [sid]);
      const s = r.rows[0];
      if (!s || s.revoked_at || s.expires_at < this.clock.now()) throw new ApiError(401, 'SESSION_INVALID', 'Vuelve a ingresar.');
      // Un token de renovación ya usado volvió a aparecer: posible robo. La sesión se cierra fuera de esta
      // transacción, porque lanzar el error aquí desharía la revocación.
      if (s.refresh_hash !== sha256(secret)) return { reused: true as const };
      const next = randomToken();
      await q.query('update device_session set refresh_hash = $2, last_seen_at = $3 where id = $1', [sid, sha256(next), this.clock.now()]);
      const pwd = !!s.is_temporary;
      return {
        reused: false as const,
        tokens: { access_token: this.accessToken(s.user_id, tenantId, sid, pwd), refresh_token: `${tenantId}.${sid}.${next}`,
          expires_in: this.cfg.accessTtlS, password_change_required: pwd }
      };
    });
    if (out.reused) {
      await this.db.tenant(tenantId, (q) => q.query('update device_session set revoked_at = $2 where id = $1', [sid, this.clock.now()]));
      throw new ApiError(401, 'SESSION_REVOKED', 'Por seguridad cerramos tu sesión. Vuelve a ingresar.');
    }
    return out.tokens;
  }

  async logout(auth: AuthCtx) {
    await this.db.tenant(auth.tenantId, (q) =>
      q.query('update device_session set revoked_at = $2 where id = $1 and revoked_at is null', [auth.sessionId, this.clock.now()]));
  }

  /** Cambiar o crear contraseña con la sesión abierta. Quien entró con Google puede crear una sin conocer otra. */
  async changePassword(auth: AuthCtx, newPassword: string, currentPassword?: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const c = (await q.query<{ password_hash: string | null; is_temporary: boolean }>(
        'select password_hash, is_temporary from credential where user_id = $1', [auth.userId])).rows[0];
      if (c?.password_hash && !c.is_temporary) {
        if (!currentPassword || !(await verify(c.password_hash, currentPassword))) {
          throw new ApiError(400, 'CURRENT_PASSWORD_INVALID', 'Tu contraseña actual no coincide.');
        }
      }
      if (c?.password_hash && (await verify(c.password_hash, newPassword))) {
        throw new ApiError(400, 'WEAK_PASSWORD', 'Tu contraseña aún no cumple todas las reglas.', { rules: { ...passwordRules(newPassword), differs: false } });
      }
      checkRules(newPassword);
      await q.query(
        `insert into credential (user_id, tenant_id, password_hash, is_temporary, updated_at) values ($1, $2, $3, false, $4)
         on conflict (user_id) do update set password_hash = excluded.password_hash, is_temporary = false, updated_at = excluded.updated_at`,
        [auth.userId, auth.tenantId, await hashPassword(newPassword), this.clock.now()]);
      await audit(q, auth.tenantId, auth.userId, 'auth.password_changed', {});
      return { access_token: this.accessToken(auth.userId, auth.tenantId, auth.sessionId, false), expires_in: this.cfg.accessTtlS, password_change_required: false };
    });
  }

  async me(auth: AuthCtx) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const tenant = await this.tenants.byId(q, auth.tenantId);
      const u = (await q.query('select id, first_name, last_name, email, phone, area from app_user where id = $1', [auth.userId])).rows[0];
      const google = (await q.query('select email from user_identity where user_id = $1', [auth.userId])).rows[0];
      const pw = (await q.query<{ password_hash: string | null }>('select password_hash from credential where user_id = $1', [auth.userId])).rows[0];
      return {
        ...u,
        company: tenant.name,
        missing_fields: u.area ? [] : ['area'],
        area_options: tenant.branding.areas,
        sign_in: { password: !!pw?.password_hash, google: google ? google.email : null },
        password_change_required: auth.passwordChangeRequired
      };
    });
  }

  async updateMe(auth: AuthCtx, area: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const tenant: Tenant = await this.tenants.byId(q, auth.tenantId);
      if (!tenant.branding.areas.includes(area)) throw new ApiError(400, 'VALIDATION_ERROR', 'Elige un área de la lista.');
      await q.query('update app_user set area = $2 where id = $1', [auth.userId, area]);
      return { area };
    });
  }
}

function checkRules(pw: string) {
  const rules = passwordRules(pw);
  if (!rules.min_length || !rules.has_number) {
    throw new ApiError(400, 'WEAK_PASSWORD', 'Tu contraseña aún no cumple todas las reglas.', { rules });
  }
}

export async function audit(q: Q, tenantId: string, actor: string | null, action: string, data: Record<string, unknown>) {
  await q.query('insert into audit_log (tenant_id, actor_user_id, action, data) values ($1, $2, $3, $4::jsonb)',
    [tenantId, actor, action, JSON.stringify(data)]);
}

const email = z.string().email().max(200);
const device = z.string().max(80).optional();
const LoginBody = z.object({ email, password: z.string().min(1), device_label: device });
const GoogleBody = z.object({ id_token: z.string().min(20), device_label: device });
const EmailBody = z.object({ email });
const SetBody = z.object({ token: z.string().min(10), new_password: z.string().max(128), device_label: device });
const LinkBody = z.object({ token: z.string().min(10), device_label: device });
const ChangeBody = z.object({ new_password: z.string().max(128), current_password: z.string().optional() });
const RefreshBody = z.object({ refresh_token: z.string() });
const MeBody = z.object({ area: z.string().min(1) });

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('login') @HttpCode(200)
  login(@Req() req: Request, @Body() body: unknown) {
    const b = parse(LoginBody, body);
    return this.auth.login(tenantSlugFrom(req), b.email, b.password, b.device_label);
  }

  @Public() @Post('google') @HttpCode(200)
  google(@Req() req: Request, @Body() body: unknown) {
    const b = parse(GoogleBody, body);
    return this.auth.google(tenantSlugFrom(req), b.id_token, b.device_label);
  }

  @Public() @Post('password/forgot') @HttpCode(202)
  forgot(@Req() req: Request, @Body() body: unknown) { return this.auth.requestEmail(tenantSlugFrom(req), parse(EmailBody, body).email, 'reset'); }

  @Public() @Post('email-link') @HttpCode(202)
  emailLink(@Req() req: Request, @Body() body: unknown) { return this.auth.requestEmail(tenantSlugFrom(req), parse(EmailBody, body).email, 'login'); }

  @Public() @Get('link-info')
  linkInfo(@Query('token') token: string) { return this.auth.tokenInfo(String(token || '')); }

  @Public() @Post('password/set') @HttpCode(200)
  setPassword(@Body() body: unknown) {
    const b = parse(SetBody, body);
    return this.auth.setPassword(b.token, b.new_password, b.device_label);
  }

  @Public() @Post('email-link/verify') @HttpCode(200)
  verifyLink(@Body() body: unknown) {
    const b = parse(LinkBody, body);
    return this.auth.loginWithLink(b.token, b.device_label);
  }

  @Public() @Post('refresh') @HttpCode(200)
  refresh(@Body() body: unknown) { return this.auth.refresh(parse(RefreshBody, body).refresh_token); }

  @Post('logout') @HttpCode(204) @AllowPendingPassword()
  async logout(@Auth() a: AuthCtx) { await this.auth.logout(a); }

  @Post('password') @HttpCode(200) @AllowPendingPassword()
  change(@Auth() a: AuthCtx, @Body() body: unknown) {
    const b = parse(ChangeBody, body);
    return this.auth.changePassword(a, b.new_password, b.current_password);
  }
}

@Controller('me')
export class MeController {
  constructor(private auth: AuthService) {}

  @Get() @AllowPendingPassword()
  me(@Auth() a: AuthCtx) { return this.auth.me(a); }

  @Patch() @AllowPendingPassword()
  update(@Auth() a: AuthCtx, @Body() body: unknown) { return this.auth.updateMe(a, parse(MeBody, body).area); }
}
