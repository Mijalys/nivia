import { randomBytes } from 'node:crypto';

export interface Config {
  port: number;
  databaseUrl?: string;
  pgliteDir?: string;
  /** Secreto para firmar tokens de acceso y URLs de archivos. */
  secret: string;
  /** Base pública de la API, usada para armar URLs firmadas de archivos. */
  publicUrl: string;
  /** Base pública de la app del aprendiz: los correos enlazan aquí (invitación, restablecer, ingreso). */
  appUrl: string;
  /** Carpeta local que hace de almacenamiento de objetos en desarrollo. */
  storageDir: string;
  /** ID de cliente OAuth de Google ("Web application"). Sin definir, el botón de Google no aparece. */
  googleClientId?: string;
  /** Clave de API de Brevo para correos. Sin definir, los correos se escriben en el log. */
  brevoApiKey?: string;
  /** Remitente verificado en Brevo. */
  emailFrom: string;
  accessTtlS: number;
  refreshTtlDays: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT || 3000);
  return {
    port,
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR || './.data/pglite',
    secret: env.APP_SECRET || randomBytes(32).toString('hex'),
    publicUrl: (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ''),
    appUrl: (env.APP_URL || 'http://localhost:4178/prototipo/').replace(/\/?$/, '/'),
    storageDir: env.STORAGE_DIR || './storage',
    googleClientId: env.GOOGLE_CLIENT_ID || undefined,
    brevoApiKey: env.BREVO_API_KEY || undefined,
    emailFrom: env.EMAIL_FROM || 'no-responder@nivia.pe',
    accessTtlS: Number(env.ACCESS_TTL_S || 900),
    refreshTtlDays: Number(env.REFRESH_TTL_DAYS || 30)
  };
}

export const CONFIG = Symbol('CONFIG');
export const DB = Symbol('DB');
export const CLOCK = Symbol('CLOCK');
export const EMAIL = Symbol('EMAIL');
export const GOOGLE = Symbol('GOOGLE');

/** Reloj inyectable: las pruebas lo adelantan para simular esperas y tiempo de evaluación. */
export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
