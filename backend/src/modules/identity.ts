import { Body, Controller, Get, HttpCode, Inject, Injectable, Patch, Post, Req } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { Request } from 'express';
import { z } from 'zod';
import { AllowPendingPassword, Auth, AuthCtx, Public, tenantSlugFrom } from '../common/auth';
import { otpCode, randomToken, sha256, signJwt, verifyJwt } from '../common/crypto';
import { ApiError, parse } from '../common/errors';
import { RateLimiter } from '../common/rate-limit';
import { CLOCK, CONFIG, Clock, Config, DB, SMS } from '../config';
import { Db, Q } from '../db/db';
import { SmsSender, toE164 } from './notifications';
import { Tenant, TenantsService } from './tenants';

const OTP_TTL_MIN = 10;
const RESET_TTL_S = 600;

export function passwordRules(pw: string, previous?: string) {
  return { min_length: pw.length >= 8, has_number: /\d/.test(pw), differs: previous === undefined || pw !== previous };
}

export const hashPassword = (pw: string) => hash(pw);

@Injectable()
export class AuthService {
  private loginLimiter = new RateLimiter(5, 15 * 60_000);
  private otpLimiter = new RateLimiter(3, 15 * 60_000);

  constructor(
    @Inject(DB) private db: Db,
    @Inject(CONFIG) private cfg: Config,
    @Inject(CLOCK) private clock: Clock,
    @Inject(SMS) private sms: SmsSender,
    private tenants: TenantsService
  ) {}

  private nowS() { return Math.floor(this.clock.now().getTime() / 1000); }

  private accessToken(userId: string, tenantId: string, sessionId: string, pwd: boolean) {
    return signJwt({ typ: 'access', sub: userId, tid: tenantId, sid: sessionId, pwd }, this.cfg.secret, this.cfg.accessTtlS, this.nowS());
  }

  /** Crea una sesión por dispositivo. El token de renovación lleva empresa y sesión para ubicarla. */
  private async openSession(q: Q, tenantId: string, userId: string, pwd: boolean, deviceLabel?: string) {
    const secret = randomToken();
    const expires = new Date(this.clock.now().getTime() + this.cfg.refreshTtlDays * 86_400_000);
    const s = await q.query<{ id: string }>(
      `insert into device_session (tenant_id, user_id, refresh_hash, device_label, expires_at, created_at, last_seen_at)
       values ($1, $2, $3, $4, $5, $6, $6) returning id`,
      [tenantId, userId, sha256(secret), deviceLabel ?? null, expires, this.clock.now()]
    );
    const sid = s.rows[0].id;
    return {
      access_token: this.accessToken(userId, tenantId, sid, pwd),
      refresh_token: `${tenantId}.${sid}.${secret}`,
      expires_in: this.cfg.accessTtlS,
      password_change_required: pwd
    };
  }

  async login(slug: string, phone: string, password: string, deviceLabel?: string) {
    const tenant = await this.tenants.bySlug(slug);
    const e164 = toE164(phone);
    const key = `${tenant.id}:${e164}`;
    const nowMs = this.clock.now().getTime();
    this.loginLimiter.check(key, nowMs, 'Demasiados intentos. Espera unos minutos y vuelve a intentar.');
    return this.db.tenant(tenant.id, async (q) => {
      const r = await q.query<{ id: string; first_name: string; password_hash: string; is_temporary: boolean }>(
        `select u.id, u.first_name, c.password_hash, c.is_temporary
           from app_user u join credential c on c.user_id = u.id where u.phone = $1`, [e164]);
      const u = r.rows[0];
      if (!u || !(await verify(u.password_hash, password))) {
        this.loginLimiter.hit(key, nowMs);
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'El celular o la contraseña no coinciden. Revisa e intenta de nuevo.');
      }
      this.loginLimiter.reset(key);
      await audit(q, tenant.id, u.id, 'auth.login', {});
      return { ...(await this.openSession(q, tenant.id, u.id, u.is_temporary, deviceLabel)), user: { id: u.id, first_name: u.first_name } };
    });
  }

  async refresh(token: string) {
    const [tenantId, sid, secret] = token.split('.');
    if (!tenantId || !sid || !secret || !z.string().uuid().safeParse(tenantId).success || !z.string().uuid().safeParse(sid).success) {
      throw new ApiError(401, 'SESSION_INVALID', 'Vuelve a ingresar.');
    }
    const out = await this.db.tenant(tenantId, async (q) => {
      const r = await q.query<{ user_id: string; refresh_hash: string; expires_at: Date; revoked_at: Date | null; is_temporary: boolean }>(
        `select s.user_id, s.refresh_hash, s.expires_at, s.revoked_at, c.is_temporary
           from device_session s join credential c on c.user_id = s.user_id where s.id = $1`, [sid]);
      const s = r.rows[0];
      if (!s || s.revoked_at || s.expires_at < this.clock.now()) throw new ApiError(401, 'SESSION_INVALID', 'Vuelve a ingresar.');
      // Un token de renovación ya usado volvió a aparecer: posible robo. La sesión se cierra fuera de esta
      // transacción, porque lanzar el error aquí desharía la revocación.
      if (s.refresh_hash !== sha256(secret)) return { reused: true as const };
      const next = randomToken();
      await q.query('update device_session set refresh_hash = $2, last_seen_at = $3 where id = $1', [sid, sha256(next), this.clock.now()]);
      return {
        reused: false as const,
        tokens: {
          access_token: this.accessToken(s.user_id, tenantId, sid, s.is_temporary),
          refresh_token: `${tenantId}.${sid}.${next}`,
          expires_in: this.cfg.accessTtlS,
          password_change_required: s.is_temporary
        }
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

  /** Siempre responde igual, exista o no el celular, para no revelar quién está registrado. */
  async requestOtp(slug: string, phone: string) {
    const tenant = await this.tenants.bySlug(slug);
    const e164 = toE164(phone);
    const key = `${tenant.id}:${e164}`;
    const nowMs = this.clock.now().getTime();
    this.otpLimiter.check(key, nowMs, 'Ya pediste varios códigos. Espera unos minutos.');
    this.otpLimiter.hit(key, nowMs);
    const code = this.cfg.devOtpCode || otpCode();
    const user = await this.db.tenant(tenant.id, async (q) => {
      const u = (await q.query<{ id: string }>('select id from app_user where phone = $1', [e164])).rows[0];
      if (!u) return null;
      await q.query('update otp_challenge set consumed_at = $2 where user_id = $1 and consumed_at is null', [u.id, this.clock.now()]);
      await q.query(
        `insert into otp_challenge (tenant_id, user_id, code_hash, expires_at, created_at) values ($1, $2, $3, $4, $5)`,
        [tenant.id, u.id, sha256(`${u.id}:${code}`), new Date(nowMs + OTP_TTL_MIN * 60_000), this.clock.now()]);
      return u;
    });
    if (user) await this.sms.send(e164, `${tenant.name}: tu código para recuperar tu contraseña es ${code}. Vence en ${OTP_TTL_MIN} minutos.`);
    return { sent: true, masked_phone: `${e164.slice(3, 6)} *** ${e164.slice(-3)}`, resend_after_s: 30 };
  }

  async verifyOtp(slug: string, phone: string, code: string) {
    const tenant = await this.tenants.bySlug(slug);
    const e164 = toE164(phone);
    return this.db.tenant(tenant.id, async (q) => {
      const r = await q.query<{ id: string; user_id: string; code_hash: string; expires_at: Date; attempts_left: number }>(
        `select c.* from otp_challenge c join app_user u on u.id = c.user_id
          where u.phone = $1 and c.consumed_at is null order by c.created_at desc limit 1`, [e164]);
      const c = r.rows[0];
      if (!c || c.attempts_left <= 0) throw new ApiError(400, 'OTP_INVALID', 'Pide un código nuevo.', { attempts_left: 0 });
      if (c.expires_at < this.clock.now()) throw new ApiError(400, 'OTP_EXPIRED', 'El código venció. Pide uno nuevo.');
      if (c.code_hash !== sha256(`${c.user_id}:${code}`)) {
        const left = c.attempts_left - 1;
        await q.query('update otp_challenge set attempts_left = $2 where id = $1', [c.id, left]);
        throw new ApiError(400, 'OTP_INVALID', left > 0 ? 'El código no coincide.' : 'Agotaste los intentos. Pide un código nuevo.', { attempts_left: left });
      }
      await q.query('update otp_challenge set consumed_at = $2 where id = $1', [c.id, this.clock.now()]);
      const reset = signJwt({ typ: 'reset', sub: c.user_id, tid: tenant.id }, this.cfg.secret, RESET_TTL_S, this.nowS());
      return { reset_token: reset, expires_in: RESET_TTL_S };
    });
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const claims = verifyJwt<{ typ: string; sub: string; tid: string }>(resetToken, this.cfg.secret, this.nowS());
    if (!claims || claims.typ !== 'reset') throw new ApiError(400, 'RESET_TOKEN_INVALID', 'El permiso venció. Pide un código nuevo.');
    checkRules(newPassword);
    await this.db.tenant(claims.tid, async (q) => {
      await q.query('update credential set password_hash = $2, is_temporary = false, updated_at = $3 where user_id = $1',
        [claims.sub, await hashPassword(newPassword), this.clock.now()]);
      await q.query('update device_session set revoked_at = $2 where user_id = $1 and revoked_at is null', [claims.sub, this.clock.now()]);
      await audit(q, claims.tid, claims.sub, 'auth.password_reset', {});
    });
    return { ok: true };
  }

  async changePassword(auth: AuthCtx, newPassword: string, currentPassword?: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const c = (await q.query<{ password_hash: string; is_temporary: boolean }>(
        'select password_hash, is_temporary from credential where user_id = $1', [auth.userId])).rows[0];
      if (!c.is_temporary) {
        if (!currentPassword || !(await verify(c.password_hash, currentPassword))) {
          throw new ApiError(400, 'CURRENT_PASSWORD_INVALID', 'Tu contraseña actual no coincide.');
        }
      }
      if (await verify(c.password_hash, newPassword)) {
        throw new ApiError(400, 'WEAK_PASSWORD', 'Tu contraseña aún no cumple todas las reglas.', { rules: { ...passwordRules(newPassword), differs: false } });
      }
      checkRules(newPassword);
      await q.query('update credential set password_hash = $2, is_temporary = false, updated_at = $3 where user_id = $1',
        [auth.userId, await hashPassword(newPassword), this.clock.now()]);
      await audit(q, auth.tenantId, auth.userId, 'auth.password_changed', {});
      return { access_token: this.accessToken(auth.userId, auth.tenantId, auth.sessionId, false), expires_in: this.cfg.accessTtlS, password_change_required: false };
    });
  }

  async me(auth: AuthCtx) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const tenant = await this.tenants.byId(q, auth.tenantId);
      const u = (await q.query('select id, first_name, last_name, phone, area from app_user where id = $1', [auth.userId])).rows[0];
      return {
        ...u,
        company: tenant.name,
        missing_fields: u.area ? [] : ['area'],
        area_options: tenant.branding.areas,
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

const phone = z.string().min(9).max(16);
const LoginBody = z.object({ phone, password: z.string().min(1), device_label: z.string().max(80).optional() });
const OtpBody = z.object({ phone });
const VerifyBody = z.object({ phone, code: z.string().regex(/^\d{6}$/) });
const ResetBody = z.object({ reset_token: z.string(), new_password: z.string().max(128) });
const ChangeBody = z.object({ new_password: z.string().max(128), current_password: z.string().optional() });
const RefreshBody = z.object({ refresh_token: z.string() });
const MeBody = z.object({ area: z.string().min(1) });

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('login') @HttpCode(200)
  login(@Req() req: Request, @Body() body: unknown) {
    const b = parse(LoginBody, body);
    return this.auth.login(tenantSlugFrom(req), b.phone, b.password, b.device_label);
  }

  @Public() @Post('refresh') @HttpCode(200)
  refresh(@Body() body: unknown) { return this.auth.refresh(parse(RefreshBody, body).refresh_token); }

  @Post('logout') @HttpCode(204) @AllowPendingPassword()
  async logout(@Auth() a: AuthCtx) { await this.auth.logout(a); }

  @Public() @Post('otp') @HttpCode(202)
  otp(@Req() req: Request, @Body() body: unknown) { return this.auth.requestOtp(tenantSlugFrom(req), parse(OtpBody, body).phone); }

  @Public() @Post('otp/verify') @HttpCode(200)
  verify(@Req() req: Request, @Body() body: unknown) {
    const b = parse(VerifyBody, body);
    return this.auth.verifyOtp(tenantSlugFrom(req), b.phone, b.code);
  }

  @Public() @Post('password/reset') @HttpCode(200)
  reset(@Body() body: unknown) {
    const b = parse(ResetBody, body);
    return this.auth.resetPassword(b.reset_token, b.new_password);
  }

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
