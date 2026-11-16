import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { brandingContrastIssues } from '../common/color';
import { certificateCode } from '../common/crypto';
import { Clock } from '../config';
import { hashPassword } from '../modules/identity';
import { Db } from './db';
import { DEMO_PASSWORD, DEMO_POSTER_KEY, DEMO_VIDEO_KEY, PERSONAS, TENANTS } from './seed-data';

const DAY = 86_400_000;

/** Carga los datos de demostración si la base está vacía. Devuelve false si ya había datos. */
export async function seed(db: Db, clock: Clock): Promise<boolean> {
  const exists = await db.system((q) => q.query('select 1 from tenant limit 1'));
  if (exists.rows.length) return false;
  const now = clock.now();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const t of TENANTS) {
    const issues = brandingContrastIssues(t.branding);
    if (issues.length) throw new Error(`La marca de ${t.name} no pasa contraste AA: ${JSON.stringify(issues)}`);

    const tenantId = (await db.system((q) => q.query<{ id: string }>(
      `insert into tenant (slug, name, mono, branding, exam_policy, cert_prefix) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6) returning id`,
      [t.slug, t.name, t.branding.mono, JSON.stringify(t.branding), JSON.stringify(t.exam_policy), t.cert_prefix]))).rows[0].id;

    await db.tenant(tenantId, async (q) => {
      const routeId = (await q.query<{ id: string }>('insert into route (tenant_id, slug) values ($1, $2) returning id',
        [tenantId, t.route.slug])).rows[0].id;
      const rv = (await q.query<{ id: string }>(
        `insert into route_version (tenant_id, route_id, version, status, title, overline, published_at)
         values ($1, $2, 1, 'published', $3, $4, $5) returning id`,
        [tenantId, routeId, t.route.title, t.route.overline, new Date(now.getTime() - 400 * DAY)])).rows[0].id;

      const lessonIds: string[] = [];
      let lessonPos = 0;
      for (const [li, lv] of t.route.levels.entries()) {
        const levelId = (await q.query<{ id: string }>('insert into level (tenant_id, route_version_id, position, title) values ($1, $2, $3, $4) returning id',
          [tenantId, rv, li + 1, lv.title])).rows[0].id;
        for (const l of lv.lessons) {
          lessonPos++;
          const lessonId = (await q.query<{ id: string }>(
            `insert into lesson (tenant_id, route_version_id, level_id, position, title, format, duration_s, summary)
             values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) returning id`,
            [tenantId, rv, levelId, lessonPos, l.title, l.format, l.dur, JSON.stringify(l.sum)])).rows[0].id;
          lessonIds.push(lessonId);
          // En desarrollo todas las lecciones usan el video vertical de demostración.
          // "hls" es la fuente para ver con señal; en producción será una lista HLS.
          for (const [kind, key, size] of [['hls', DEMO_VIDEO_KEY, l.mb * 1_000_000], ['mp4_offline', DEMO_VIDEO_KEY, l.mb * 1_000_000], ['poster', DEMO_POSTER_KEY, 24_000]] as const) {
            await q.query('insert into lesson_asset (tenant_id, lesson_id, kind, storage_key, size_bytes) values ($1, $2, $3, $4, $5)',
              [tenantId, lessonId, kind, key, size]);
          }
          for (const [qi, qq] of l.qs.entries()) {
            await q.query(
              `insert into question (tenant_id, lesson_id, position, prompt, options, correct_index, why, video_t, source_refs)
               values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb)`,
              [tenantId, lessonId, qi + 1, qq.q, JSON.stringify(qq.opts), qq.right, qq.why, qq.t,
                JSON.stringify([{ manual: 'Manual de demostración', section: lv.title }])]);
          }
        }
      }

      for (const p of PERSONAS) {
        const area = t.areas[p.key];
        const userId = (await q.query<{ id: string }>(
          'insert into app_user (tenant_id, first_name, last_name, phone, area) values ($1, $2, $3, $4, $5) returning id',
          [tenantId, p.first, p.last, `+51${p.phone}`, p.temporary ? null : area])).rows[0].id;
        await q.query('insert into credential (user_id, tenant_id, password_hash, is_temporary) values ($1, $2, $3, $4)',
          [userId, tenantId, passwordHash, p.temporary]);

        if ('certificate' in p) {
          const issued = new Date(now.getTime() - p.certificate.issuedDaysAgo * DAY);
          const expires = new Date(issued); expires.setUTCMonth(expires.getUTCMonth() + 12);
          const first = (await q.query<{ id: string }>(
            `insert into assignment (tenant_id, user_id, route_version_id, kind, status, assigned_at, due_at, completed_at)
             values ($1, $2, $3, 'initial', 'completed', $4, $5, $5) returning id`,
            [tenantId, userId, rv, new Date(issued.getTime() - 30 * DAY), issued])).rows[0].id;
          await q.query(
            `insert into certificate (tenant_id, user_id, assignment_id, route_title, score, code, issued_at, expires_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tenantId, userId, first, t.route.title, p.certificate.score[t.slug], certificateCode(t.cert_prefix, issued.getUTCFullYear()), issued, expires]);
        }

        const assignmentId = (await q.query<{ id: string }>(
          `insert into assignment (tenant_id, user_id, route_version_id, kind, assigned_at, due_at) values ($1, $2, $3, $4, $5, $6) returning id`,
          [tenantId, userId, rv, 'certificate' in p ? 'renewal' : 'initial', new Date(now.getTime() - 20 * DAY),
            new Date(now.getTime() + p.dueInDays * DAY)])).rows[0].id;
        for (const [i, lessonId] of lessonIds.slice(0, p.completed).entries()) {
          await q.query(
            `insert into lesson_progress (tenant_id, assignment_id, lesson_id, watched, completed_at, video_position_s)
             values ($1, $2, $3, true, $4, 0)`,
            [tenantId, assignmentId, lessonId, new Date(now.getTime() - (10 - i) * DAY)]);
        }
      }
    });
  }
  return true;
}

/** Copia el video y la portada de demostración del prototipo al almacenamiento local. */
export function copyDemoMedia(storageDir: string, demoMediaDir: string) {
  const dst = join(storageDir, 'demo');
  mkdirSync(dst, { recursive: true });
  for (const f of ['leccion-demo.mp4', 'portada.jpg']) {
    const src = join(demoMediaDir, f);
    if (existsSync(src) && !existsSync(join(dst, f))) copyFileSync(src, join(dst, f));
  }
}
