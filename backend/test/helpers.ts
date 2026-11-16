import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { Config } from '../src/config';
import { Db } from '../src/db/db';
import { copyDemoMedia, seed } from '../src/db/seed';
import { createApp } from '../src/main';
import { MemorySmsSender } from '../src/modules/notifications';

export class TestClock {
  t: number;
  constructor(start = Date.UTC(2026, 10, 10, 20, 40)) { this.t = start; }
  now() { return new Date(this.t); }
  advance(ms: number) { this.t += ms; }
}

export interface Ctx { app: INestApplication; db: Db; clock: TestClock; sms: MemorySmsSender; http: ReturnType<typeof request> }

export async function boot(): Promise<Ctx> {
  const clock = new TestClock();
  const sms = new MemorySmsSender();
  const storageDir = mkdtempSync(join(tmpdir(), 'nivia-storage-'));
  copyDemoMedia(storageDir, join(__dirname, '../../prototipo/media'));
  const config: Config = {
    port: 0, secret: 'test-secret', publicUrl: 'http://test', storageDir,
    accessTtlS: 900, refreshTtlDays: 30
  };
  const db = await Db.connect();
  await db.migrate();
  await seed(db, clock);
  const app = await createApp({ config, db, clock, sms }, { quiet: true });
  await app.init();
  return { app, db, clock, sms, http: request(app.getHttpServer()) };
}

export async function login(ctx: Ctx, tenant: string, phone: string, password = 'Demo2026') {
  const res = await ctx.http.post('/auth/login').set('X-Tenant', tenant).send({ phone, password });
  if (res.status !== 200) throw new Error(`login ${phone}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { access_token: string; refresh_token: string; password_change_required: boolean };
}

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
