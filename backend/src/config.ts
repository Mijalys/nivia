import { randomBytes } from 'node:crypto';

export interface Config {
  port: number;
  databaseUrl?: string;
  pgliteDir?: string;
  /** Secreto para firmar tokens de acceso y URLs de archivos. */
  secret: string;
  /** Base pública de la API, usada para armar URLs firmadas de archivos. */
  publicUrl: string;
  /** Carpeta local que hace de almacenamiento de objetos en desarrollo. */
  storageDir: string;
  /** Solo desarrollo: código fijo de recuperación para la demostración. */
  devOtpCode?: string;
  accessTtlS: number;
  refreshTtlDays: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT || 3000),
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR || './.data/pglite',
    secret: env.APP_SECRET || randomBytes(32).toString('hex'),
    publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
    storageDir: env.STORAGE_DIR || './storage',
    devOtpCode: env.DEV_OTP_CODE || undefined,
    accessTtlS: Number(env.ACCESS_TTL_S || 900),
    refreshTtlDays: Number(env.REFRESH_TTL_DAYS || 30)
  };
}

export const CONFIG = Symbol('CONFIG');
export const DB = Symbol('DB');
export const CLOCK = Symbol('CLOCK');
export const SMS = Symbol('SMS');

/** Reloj inyectable: las pruebas lo adelantan para simular esperas y tiempo de evaluación. */
export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
