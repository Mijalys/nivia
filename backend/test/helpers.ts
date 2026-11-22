import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { ApiError } from '../src/common/errors';
import { Config } from '../src/config';
import { Db } from '../src/db/db';
import { copyDemoMedia, seed } from '../src/db/seed';
import { createApp } from '../src/main';
import { MemoryEmailSender } from '../src/modules/email';
import { GoogleClaims, GoogleVerifier } from '../src/modules/google';

export class TestClock {
  t: number;
  constructor(start = Date.UTC(2026, 10, 10, 20, 40)) { this.t = start; }
  now() { return new Date(this.t); }
  advance(ms: number) { this.t += ms; }
}

/** Google simulado: el token "google:<sub>:<correo>" vale como una cuenta verificada. */
export class FakeGoogle implements GoogleVerifier {
  async verify(idToken: string): Promise<GoogleClaims> {
    const m = /^google:([^:]+):(.+)$/.exec(idToken);
    if (!m) throw new ApiError(401, 'GOOGLE_TOKEN_INVALID', 'No pudimos confirmar tu cuenta de Google.');
    return { sub: m[1], email: m[2], email_verified: true, given_name: 'Test' };
  }
}
export const googleToken = (sub: string, email: string) => `google:${sub}:${email}`;

export interface Ctx { app: INestApplication; db: Db; clock: TestClock; mail: MemoryEmailSender; http: ReturnType<typeof request>; storageDir: string }

export async function boot(): Promise<Ctx> {
  const clock = new TestClock();
  const mail = new MemoryEmailSender();
  const storageDir = mkdtempSync(join(tmpdir(), 'nivia-storage-'));
  copyDemoMedia(storageDir, join(__dirname, '../../prototipo/media'));
  const config: Config = {
    port: 0, secret: 'test-secret', publicUrl: 'http://test', appUrl: 'http://app.test/', storageDir,
    googleClientId: 'test-client', emailFrom: 'no-responder@nivia.test', accessTtlS: 900, refreshTtlDays: 30,
    appDir: join(__dirname, '../../app')
  };
  const db = await Db.connect();
  await db.migrate();
  await seed(db, clock);
  const app = await createApp({ config, db, clock, email: mail, google: new FakeGoogle() }, { quiet: true });
  await app.init();
  return { app, db, clock, mail, http: request(app.getHttpServer()), storageDir };
}

/** Correo de demostración de cada aprendiz: carlos, rosa, luis, marisol @<empresa>.example */
export const mailOf = (tenant: string, who: string) => `${who}@${tenant}.example`;

export async function login(ctx: Ctx, tenant: string, who: string, password = 'Demo2026') {
  const email = who.includes('@') ? who : mailOf(tenant, who);
  const res = await ctx.http.post('/auth/login').set('X-Tenant', tenant).send({ email, password });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { access_token: string; refresh_token: string; password_change_required: boolean };
}

/** Saca el token de un enlace enviado por correo. */
export const tokenFrom = (url: string) => new URL(url).searchParams.get('token')!;

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Respuestas correctas de una lista de preguntas, leídas directo de la base (solo en pruebas). */
export async function correctAnswers(db: Db, questionIds: string[]): Promise<Map<string, number>> {
  const r = await db.system((q) => q.query<{ id: string; correct_index: number }>(
    'select id, correct_index from question where id = any($1::uuid[])', [questionIds]));
  return new Map(r.rows.map((x) => [x.id, x.correct_index]));
}

let n = 0;
export const eventId = () => {
  n++;
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
};
