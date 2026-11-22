import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CLOCK, CONFIG, Clock, Config } from '../config';
import { verifyJwt } from './crypto';
import { ApiError } from './errors';

export interface AuthCtx {
  userId: string;
  tenantId: string;
  sessionId: string;
  /** La contraseña es temporal: solo puede cambiarla y completar su ficha. */
  passwordChangeRequired: boolean;
}

export interface AccessClaims {
  typ: 'access';
  sub: string;
  tid: string;
  sid: string;
  pwd: boolean;
}

const PUBLIC = 'nivia:public';
const ALLOW_PENDING = 'nivia:allowPendingPassword';

/** Ruta sin sesión (ingreso, recuperación, configuración del cliente, archivos firmados). */
export const Public = () => SetMetadata(PUBLIC, true);
/** Ruta permitida aunque la contraseña siga siendo temporal. */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING, true);

export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthCtx => ctx.switchToHttp().getRequest().auth);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(CONFIG) private cfg: Config,
    @Inject(CLOCK) private clock: Clock
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthCtx }>();
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    const claims = verifyJwt<AccessClaims>(header.slice(7), this.cfg.secret, Math.floor(this.clock.now().getTime() / 1000));
    if (!claims || claims.typ !== 'access') throw new ApiError(401, 'TOKEN_INVALID', 'Tu sesión venció. Vuelve a ingresar.');
    req.auth = { userId: claims.sub, tenantId: claims.tid, sessionId: claims.sid, passwordChangeRequired: claims.pwd };
    if (claims.pwd && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, targets)) {
      throw new ApiError(403, 'PASSWORD_CHANGE_REQUIRED', 'Primero crea tu contraseña.');
    }
    return true;
  }
}

/**
 * Identifica la empresa en rutas sin sesión: cabecera X-Tenant o subdominio (riomar.nivia.pe).
 * Un mismo celular puede existir en dos empresas, por eso el ingreso siempre necesita saber cuál.
 */
export function tenantSlugFrom(req: Request): string {
  const header = req.headers['x-tenant'];
  if (typeof header === 'string' && header) return header.toLowerCase();
  // Piloto con una sola empresa: el dominio no lleva subdominio de cliente.
  if (process.env.DEFAULT_TENANT) return process.env.DEFAULT_TENANT.toLowerCase();
  const host = (req.headers.host || '').split(':')[0];
  const parts = host.split('.');
  const isIp = /^\d+(\.\d+){3}$/.test(host);
  if (!isIp && parts.length >= 3) return parts[0].toLowerCase();
  throw new ApiError(400, 'TENANT_REQUIRED', 'Falta indicar la empresa (cabecera X-Tenant o subdominio).');
}
