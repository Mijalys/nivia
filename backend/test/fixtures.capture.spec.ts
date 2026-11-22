/*
 * Captura respuestas REALES de la API y las guarda en ../app/fixtures/ para diseñar la UI sin inventar datos.
 * No corre con `npm test`: se ejecuta con `npm run fixtures`. Usa el reloj fijo de las pruebas (10 nov 2026, 15:40 en Lima),
 * así que las fechas no cambian entre capturas; los ids sí.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { bearer, boot, correctAnswers, Ctx, eventId, googleToken, login, tokenFrom } from './helpers';

const RUN = process.env.CAPTURAR === '1';
const OUT = join(__dirname, '../../app/fixtures');
const CONTENT = join(__dirname, '../../contenido/programa-claude');

let ctx: Ctx;
beforeAll(async () => { if (RUN) ctx = await boot(); });
afterAll(async () => { if (RUN) { await ctx.app.close(); await ctx.db.close(); } });

/** Quita tokens y deja las URLs de archivos apuntando a copias del repositorio, para el modo demo. */
function clean(value: unknown): unknown {
  const s = JSON.stringify(value)
    .replace(/"(access_token|refresh_token)":"[^"]+"/g, '"$1":"<$1>"')
    .replace(/token=[^"&]+/g, 'token=<token>')
    .replace(/http:\/\/test\/media\/([^"?]+)(\?[^"]*)?/g, (_, key: string) => {
      const file = key.split('/').pop();
      if (key.startsWith('demo/')) return `../prototipo/media/${file}`;
      return `../contenido/programa-claude/${key.split('/').slice(1).join('/')}`;
    });
  return JSON.parse(s);
}
const saved: string[] = [];
function save(name: string, status: number, body: unknown, note: string) {
  const file = join(OUT, `${name}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ _captura: { status, nota: note }, body: clean(body) }, null, 2) + '\n');
  saved.push(name);
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); cell = ''; if (row.some((x) => x)) rows.push(row); row = []; } else if (c !== '\r') cell += c;
  }
  row.push(cell); if (row.some((x) => x)) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

(RUN ? it : it.skip)('captura las respuestas de la API para la UI', async () => {
  const H = (t: string) => ({ ...bearer(t), 'X-Tenant': 'programa-claude' });
  const prog = JSON.parse(readFileSync(join(CONTENT, 'programa.json'), 'utf8'));
  const lessons = parseCsv(readFileSync(join(CONTENT, 'lecciones.csv'), 'utf8'));
  const qs = parseCsv(readFileSync(join(CONTENT, 'preguntas.csv'), 'utf8'));

  // --- Programa Claude, como lo carga scripts/cargar-contenido.mjs
  const admin = (await ctx.http.post('/admin/auth/login').send({ username: 'admin', password: 'Demo2026' })).body.access_token;
  expect((await ctx.http.post('/admin/tenants').set(bearer(admin)).send(prog.empresa)).status).toBe(201);
  for (const r of prog.recursos['n1-l1']) {
    const dst = join(ctx.storageDir, r.key);
    mkdirSync(dirname(dst), { recursive: true }); copyFileSync(join(CONTENT, r.archivo), dst);
  }
  const route = await ctx.http.post('/admin/tenants/programa-claude/routes').set(bearer(admin)).send({
    slug: prog.ruta.slug, title: prog.ruta.title, overline: prog.ruta.overline,
    levels: [{ title: lessons[0].titulo_nivel, lessons: lessons.map((l) => ({
      title: l.titulo_leccion, format: 'presenter', duration_s: 180, summary: l.resumen.split('|').map((x) => x.trim()),
      questions: qs.filter((q) => q.leccion === l.id).map((q) => ({
        prompt: q.enunciado, options: [q.opcion_a, q.opcion_b, q.opcion_c].filter(Boolean), correct_index: 'abc'.indexOf(q.correcta),
        why: q.por_que, video_t: 0, in_quiz: q.uso === 'reto', in_exam: q.uso === 'evaluacion' })),
      resources: prog.recursos[l.id].map((r: { title: string; key: string }) => ({ title: r.title, kind: 'file', key: r.key }))
    })) }]
  });
  expect(route.status).toBe(201);
  await ctx.http.post(`/admin/tenants/programa-claude/routes/${route.body.route_id}/publish`).set(bearer(admin));
  const people = (await ctx.http.post('/admin/tenants/programa-claude/users').set(bearer(admin)).send([
    { first_name: 'Ana', last_name: 'Torres Vega', email: 'ana@programa-claude.example', area: 'Servicios', temporary_password: 'Clase2026x' },
    { first_name: 'Jorge', last_name: 'Ríos', email: 'jorge@programa-claude.example', area: 'Comercio', temporary_password: 'Clase2026x' },
    { first_name: 'Lucía', last_name: 'Paz', email: 'lucia@programa-claude.example' }
  ])).body.users;
  await ctx.http.post('/admin/tenants/programa-claude/assignments').set(bearer(admin))
    .send({ route_id: route.body.route_id, user_ids: [people[0].id, people[1].id], due_at: '2026-12-16T23:59:00-05:00' });

  // --- Marca, ingreso y primer ingreso
  let r = await ctx.http.get('/tenant/config').set('X-Tenant', 'programa-claude');
  save('tenant-config', r.status, r.body, 'GET /tenant/config · marca, reglas y formas de ingreso');
  r = await ctx.http.post('/auth/login').set('X-Tenant', 'programa-claude').send({ email: 'ana@programa-claude.example', password: 'Clase2026x' });
  save('auth-login-primer-ingreso', r.status, r.body, 'POST /auth/login · contraseña temporal: password_change_required = true');
  const temp = r.body.access_token;
  r = await ctx.http.get('/home').set(H(temp));
  save('errores/password-change-required', r.status, r.body, 'Cualquier pantalla con la contraseña temporal pendiente');
  r = await ctx.http.post('/auth/password').set(H(temp)).send({ new_password: 'corta' });
  save('errores/weak-password', r.status, r.body, 'POST /auth/password · no cumple las reglas');
  r = await ctx.http.post('/auth/password').set(H(temp)).send({ new_password: 'Ana2026nueva' });
  save('auth-password', r.status, r.body, 'POST /auth/password · devuelve un token de acceso nuevo');
  const t = (await login(ctx, 'programa-claude', 'ana@programa-claude.example', 'Ana2026nueva')).access_token;
  r = await ctx.http.post('/auth/login').set('X-Tenant', 'programa-claude').send({ email: 'ana@programa-claude.example', password: 'Ana2026nueva' });
  save('auth-login', r.status, r.body, 'POST /auth/login · ingreso normal');
  r = await ctx.http.post('/auth/login').set('X-Tenant', 'programa-claude').send({ email: 'ana@programa-claude.example', password: 'mal' });
  save('errores/invalid-credentials', r.status, r.body, 'POST /auth/login · correo o contraseña incorrectos');
  r = await ctx.http.post('/auth/google').set('X-Tenant', 'programa-claude').send({ id_token: googleToken('g-1', 'alguien@gmail.com') });
  save('errores/not-invited', r.status, r.body, 'POST /auth/google · cuenta de Google que la empresa no invitó');
  r = await ctx.http.post('/auth/password/forgot').set('X-Tenant', 'programa-claude').send({ email: 'ana@programa-claude.example' });
  save('auth-forgot', r.status, r.body, 'POST /auth/password/forgot y /auth/email-link · siempre la misma respuesta');
  r = await ctx.http.get('/auth/link-info').query({ token: tokenFrom(ctx.mail.lastLink('ana@programa-claude.example')!) });
  save('auth-link-info-reset', r.status, r.body, 'GET /auth/link-info · enlace para restablecer');
  const invite = people[2].invite_url as string;
  r = await ctx.http.get('/auth/link-info').query({ token: tokenFrom(invite) });
  save('auth-link-info-invite', r.status, r.body, 'GET /auth/link-info · enlace de invitación');
  r = await ctx.http.get('/auth/link-info').query({ token: 'x'.repeat(20) });
  save('errores/link-invalid', r.status, r.body, 'GET /auth/link-info · enlace vencido, usado o inválido');

  // --- Perfil, inicio y ruta
  r = await ctx.http.get('/me').set(H(t)); save('me', r.status, r.body, 'GET /me · perfil');
  r = await ctx.http.get('/home').set(H(t)); save('home', r.status, r.body, 'GET /home · con una lección siguiente');
  const aid = r.body.assignments[0].id;
  r = await ctx.http.get(`/assignments/${aid}`).set(H(t)); save('assignment', r.status, r.body, 'GET /assignments/:id · ruta con niveles');
  const lid = r.body.levels[0].lessons[0].id;
  r = await ctx.http.get(`/lessons/${lid}`).set(H(t)); save('lesson', r.status, r.body, 'GET /lessons/:id · video, resumen, reto sin respuestas y material de apoyo');
  const lesson = r.body;
  const key = await correctAnswers(ctx.db, lesson.quiz.map((q: { id: string }) => q.id));
  const q0 = lesson.quiz[0];
  r = await ctx.http.post(`/lessons/${lid}/quiz/check`).set(H(t)).send({ question_id: q0.id, choice: key.get(q0.id) });
  save('quiz-check-correct', r.status, r.body, 'POST /lessons/:id/quiz/check · respuesta correcta');
  r = await ctx.http.post(`/lessons/${lid}/quiz/check`).set(H(t)).send({ question_id: q0.id, choice: (key.get(q0.id)! + 1) % q0.options.length });
  save('quiz-check-incorrect', r.status, r.body, 'POST /lessons/:id/quiz/check · respuesta incorrecta: trae la correcta y el porqué');
  r = await ctx.http.post('/content-reports').set(H(t)).send({ lesson_id: lid, reason: 'video_unclear' });
  save('content-report', r.status, r.body, 'POST /content-reports');
  r = await ctx.http.post('/sync/events').set(H(t)).send({ events: [{ event_id: eventId(), type: 'quiz.completed', lesson_id: lid,
    occurred_at: ctx.clock.now().toISOString(), payload: { answers: lesson.quiz.map((q: { id: string }, i: number) => i === 0 ? (key.get(q.id)! + 1) % 3 : key.get(q.id)) } }] });
  save('sync-quiz-completed', r.status, r.body, 'POST /sync/events · reto terminado (2 de 3 correctas)');
  r = await ctx.http.get('/home').set(H(t)); save('home-exam-ready', r.status, r.body, 'GET /home · todas las lecciones hechas: toca la evaluación');

  // --- Evaluación aprobada
  r = await ctx.http.get(`/assignments/${aid}/exam`).set(H(t)); save('exam-info', r.status, r.body, 'GET /assignments/:id/exam · reglas e intentos');
  r = await ctx.http.post(`/assignments/${aid}/attempts`).set(H(t)); save('attempt-start', r.status, r.body, 'POST /assignments/:id/attempts · preguntas sin respuestas');
  const at = r.body;
  const ek = await correctAnswers(ctx.db, at.questions.map((q: { id: string }) => q.id));
  r = await ctx.http.put(`/attempts/${at.id}/answers/${at.questions[0].id}`).set(H(t)).send({ choice: ek.get(at.questions[0].id) });
  save('attempt-answer', r.status, r.body, 'PUT /attempts/:id/answers/:qid');
  for (const q of at.questions.slice(1)) await ctx.http.put(`/attempts/${at.id}/answers/${q.id}`).set(H(t)).send({ choice: ek.get(q.id) });
  ctx.clock.advance(4 * 60_000);
  r = await ctx.http.post(`/attempts/${at.id}/heartbeat`).set(H(t)); save('attempt-heartbeat', r.status, r.body, 'POST /attempts/:id/heartbeat · tiempo restante del servidor');
  r = await ctx.http.get(`/attempts/${at.id}`).set(H(t)); save('attempt', r.status, r.body, 'GET /attempts/:id · reanudar con las respuestas guardadas');
  r = await ctx.http.post(`/attempts/${at.id}/submit`).set(H(t)); save('result-passed', r.status, r.body, 'POST /attempts/:id/submit · aprobado, con certificado');
  r = await ctx.http.get('/certificates').set(H(t)); save('certificates', r.status, r.body, 'GET /certificates');
  r = await ctx.http.get(`/certificates/${r.body.certificates[0].id}`).set(H(t)); save('certificate', r.status, r.body, 'GET /certificates/:id · el PDF es GET /certificates/:id/pdf');
  r = await ctx.http.get('/home').set(H(t)); save('home-empty', r.status, r.body, 'GET /home · sin capacitaciones pendientes');

  // --- Evaluación desaprobada y espera para reintentar
  const t2 = (await login(ctx, 'programa-claude', 'jorge@programa-claude.example', 'Clase2026x')).access_token;
  const t2b = (await ctx.http.post('/auth/password').set(H(t2)).send({ new_password: 'Jorge2026x' })).body.access_token;
  const a2 = (await ctx.http.get('/home').set(H(t2b))).body.assignments[0].id;
  await ctx.http.post('/sync/events').set(H(t2b)).send({ events: [{ event_id: eventId(), type: 'quiz.completed', lesson_id: lid,
    occurred_at: ctx.clock.now().toISOString(), payload: { answers: lesson.quiz.map((q: { id: string }) => key.get(q.id)) } }] });
  const at2 = (await ctx.http.post(`/assignments/${a2}/attempts`).set(H(t2b))).body;
  for (const q of at2.questions) await ctx.http.put(`/attempts/${at2.id}/answers/${q.id}`).set(H(t2b)).send({ choice: (ek.get(q.id)! + 1) % q.options.length });
  r = await ctx.http.post(`/attempts/${at2.id}/submit`).set(H(t2b)); save('result-failed', r.status, r.body, 'POST /attempts/:id/submit · desaprobado, con temas a reforzar y hora para reintentar');
  r = await ctx.http.get(`/assignments/${a2}/exam`).set(H(t2b)); save('exam-info-retry-after', r.status, r.body, 'GET /assignments/:id/exam · bloqueado hasta poder reintentar');
  r = await ctx.http.post(`/assignments/${a2}/attempts`).set(H(t2b)); save('errores/retry-after', r.status, r.body, 'POST /assignments/:id/attempts · antes de la hora de reintento');

  // --- Casos de los datos de demostración (Ríomar)
  const rosa = (await login(ctx, 'riomar', 'rosa')).access_token;
  const ra = (await ctx.http.get('/home').set(bearer(rosa))).body.assignments[0].id;
  const rl = (await ctx.http.get(`/assignments/${ra}`).set(bearer(rosa))).body.levels;
  r = await ctx.http.get(`/lessons/${rl[rl.length - 1].lessons[0].id}`).set(bearer(rosa));
  save('errores/lesson-locked', r.status, r.body, 'GET /lessons/:id · nivel bloqueado');
  r = await ctx.http.get(`/assignments/${ra}`).set(bearer(rosa)); save('assignment-in-progress', r.status, r.body, 'GET /assignments/:id · ruta a medio camino, con niveles bloqueados');
  const luis = (await login(ctx, 'riomar', 'luis')).access_token;
  r = await ctx.http.get('/home').set(bearer(luis)); save('home-late', r.status, r.body, 'GET /home · capacitación vencida');
  const marisol = (await login(ctx, 'riomar', 'marisol')).access_token;
  r = await ctx.http.get('/home').set(bearer(marisol)); save('home-renewal', r.status, r.body, 'GET /home · renovación con certificado por vencer');
  for (let i = 0; i < 6; i++) r = await ctx.http.post('/auth/login').set('X-Tenant', 'riomar').send({ email: 'carlos@riomar.example', password: 'mal' });
  save('errores/too-many-attempts', r.status, r.body, 'POST /auth/login · 5 intentos fallidos en 15 minutos');

  writeFileSync(join(OUT, 'index.json'), JSON.stringify(saved.sort(), null, 2) + '\n');
  expect(saved.length).toBeGreaterThan(30);
});
