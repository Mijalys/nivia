#!/usr/bin/env node
/*
 * Carga un programa desde contenido/<programa>/: programa.json + lecciones.csv + preguntas.csv.
 * Crea la empresa, copia los archivos de apoyo al almacenamiento, crea y publica la ruta,
 * y (opcional) crea una persona de prueba con la ruta asignada. Se puede correr varias veces.
 *
 * Uso: node scripts/cargar-contenido.mjs --api http://localhost:3000 --dir ../contenido/programa-claude \
 *        [--storage ./storage] [--admin-password <clave>] [--sin-prueba]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const API = (args.api || 'http://localhost:3000').replace(/\/$/, '');
const DIR = args.dir || '../contenido/programa-claude';
const ADMIN_PASSWORD = args['admin-password'] || process.env.ADMIN_PASSWORD || 'Demo2026';

/** CSV con comillas dobles, comas dentro de comillas y "" como comilla escapada. */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== '')) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
const mmss = (v) => { const m = /^(\d+):(\d{2})$/.exec(v || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };

async function call(method, path, body, token) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  return { status: r.status, data };
}
const fail = (what, r) => { console.error(`✗ ${what}: ${r.status} ${JSON.stringify(r.data)}`); process.exit(1); };

const prog = JSON.parse(readFileSync(join(DIR, 'programa.json'), 'utf8'));
const lessons = parseCsv(readFileSync(join(DIR, 'lecciones.csv'), 'utf8'));
const questions = parseCsv(readFileSync(join(DIR, 'preguntas.csv'), 'utf8'));
const slug = prog.empresa.slug;

// 1. Archivos de apoyo al almacenamiento (solo si la API corre en esta máquina).
if (args.storage) {
  for (const list of Object.values(prog.recursos || {})) for (const r of list) {
    if (r.kind !== 'file') continue;
    const dst = join(args.storage, r.key); mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(join(DIR, r.archivo), dst);
  }
  console.log('✓ archivos de apoyo copiados al almacenamiento');
}

// 2. Ingreso como administrador de plataforma.
const login = await call('POST', '/admin/auth/login', { username: 'admin', password: ADMIN_PASSWORD });
if (login.status !== 200) fail('ingreso de administrador', login);
const T = login.data.access_token;

// 3. Empresa.
const emp = await call('POST', '/admin/tenants', prog.empresa, T);
if (emp.status === 201) console.log(`✓ empresa ${slug} creada`);
else if (emp.data?.error?.code === 'SLUG_TAKEN') console.log(`· empresa ${slug} ya existía`);
else fail('empresa', emp);

// 4. Ruta desde los CSV, con cada pregunta en el reto o en la evaluación.
const levels = new Map();
for (const l of lessons) {
  const qs = questions.filter((q) => q.leccion === l.id);
  for (const q of qs) if (!['reto', 'evaluacion'].includes(q.uso)) fail(`uso de pregunta en ${l.id}`, { status: 0, data: q.uso });
  const lesson = {
    title: l.titulo_leccion, format: l.formato.startsWith('present') ? 'presenter' : 'animated',
    duration_s: mmss(l.duracion) || 180, summary: l.resumen.split('|').map((x) => x.trim()).filter(Boolean),
    ai_generated: l.hecho_con_ia === 'sí',
    questions: qs.map((q) => ({
      prompt: q.enunciado, options: ['opcion_a', 'opcion_b', 'opcion_c', 'opcion_d'].map((k) => q[k]).filter(Boolean),
      correct_index: 'abcd'.indexOf(q.correcta), why: q.por_que, video_t: mmss(q.minuto_video),
      in_quiz: q.uso === 'reto', in_exam: q.uso === 'evaluacion', source_refs: q.fuente ? [{ fuente: q.fuente }] : []
    })),
    resources: (prog.recursos?.[l.id] || []).map((r) => r.kind === 'file' ? { title: r.title, kind: 'file', key: r.key } : { title: r.title, kind: 'link', url: r.url })
  };
  if (l.archivo_video && existsSync(join(DIR, 'videos', l.archivo_video))) lesson.video_key = `${slug}/videos/${l.archivo_video}`;
  const n = Number(l.nivel);
  if (!levels.has(n)) levels.set(n, { title: l.titulo_nivel, lessons: [] });
  levels.get(n).lessons.push(lesson);
}
const routes = await call('GET', `/admin/tenants/${slug}/routes`, undefined, T);
let route = routes.data?.routes?.find((r) => r.slug === prog.ruta.slug);
if (!route) {
  const r = await call('POST', `/admin/tenants/${slug}/routes`, {
    slug: prog.ruta.slug, title: prog.ruta.title, overline: prog.ruta.overline,
    levels: [...levels.keys()].sort((a, b) => a - b).map((k) => levels.get(k))
  }, T);
  if (r.status !== 201) fail('ruta', r);
  route = { route_id: r.data.route_id };
  const pub = await call('POST', `/admin/tenants/${slug}/routes/${route.route_id}/publish`, undefined, T);
  if (pub.status !== 200) fail('publicar', pub);
  console.log(`✓ ruta publicada: ${r.data.lessons.length} lecciones, ${questions.length} preguntas`);
} else console.log('· la ruta ya existía; no se cambia (publicada = congelada)');

// 5. Persona de prueba con la ruta asignada.
if (prog.persona_de_prueba && !args['sin-prueba']) {
  const p = prog.persona_de_prueba;
  const users = await call('GET', `/admin/tenants/${slug}/users`, undefined, T);
  let u = users.data?.users?.find((x) => x.email === p.email);
  if (!u) {
    const c = await call('POST', `/admin/tenants/${slug}/users`, [p], T);
    if (c.status !== 201) fail('persona de prueba', c);
    u = c.data.users[0];
    console.log(`✓ persona de prueba: ${p.email} / ${p.temporary_password} (pide cambiarla al entrar)`);
  } else console.log(`· persona de prueba ${p.email} ya existía`);
  const a = await call('POST', `/admin/tenants/${slug}/assignments`, { route_id: route.route_id, user_ids: [u.id], due_at: prog.ruta.fecha_limite }, T);
  if (a.status !== 201) fail('asignación', a);
}
console.log('✓ listo');
