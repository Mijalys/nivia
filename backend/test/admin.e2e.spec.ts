import { bearer, boot, Ctx, login } from './helpers';

let ctx: Ctx;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.app.close(); await ctx.db.close(); });

const DAY = 86_400_000;
let adminToken = '';
let routeId = '';
let learnerId = '';
let learnerPw = '';

const lesson = (title: string, i: number) => ({
  title, duration_s: 180, summary: [`Resumen de ${title}.`],
  questions: [
    { prompt: `Pregunta ${i}.1`, options: ['Mala', 'Buena', 'Peor'], correct_index: 1, why: 'Porque sí.', in_exam: false },
    { prompt: `Pregunta ${i}.2 (evaluación)`, options: ['Buena', 'Mala'], correct_index: 0, why: 'Porque también.', in_quiz: false }
  ]
});

describe('Consola de administración', () => {
  it('ingresa como administrador de plataforma', async () => {
    const bad = await ctx.http.post('/admin/auth/login').send({ username: 'admin', password: 'nope' });
    expect(bad.status).toBe(401);
    const ok = await ctx.http.post('/admin/auth/login').send({ username: 'admin', password: 'Demo2026' });
    expect(ok.status).toBe(200);
    adminToken = ok.body.access_token;
    const list = await ctx.http.get('/admin/tenants').set(bearer(adminToken));
    expect(list.body.tenants.map((t: any) => t.slug).sort()).toEqual(['altavista', 'riomar']);
  });

  it('un aprendiz sin rol no entra a la consola', async () => {
    const s = await login(ctx, 'riomar', '987111222');
    const r = await ctx.http.get('/admin/tenants').set(bearer(s.access_token));
    expect(r.body.error.code).toBe('FORBIDDEN');
  });

  it('crea una empresa y rechaza una marca sin contraste', async () => {
    const base = {
      slug: 'minera-sur', name: 'Minera Sur', cert_prefix: 'MSU',
      branding: { mono: 'M', accent: '#F26B1D', principal: '#0E4D5C', principal_text: '#7CC3D0', areas: ['Mina', 'Planta'] },
      exam_policy: { min_score: 75, attempts: 2, wait_minutes: 30, question_count: 4, minutes: 10, exhausted_message: 'Habla con tu jefe de guardia.' }
    };
    const bad = await ctx.http.post('/admin/tenants').set(bearer(adminToken)).send({ ...base, branding: { ...base.branding, principal_text: '#333333' } });
    expect(bad.body.error.code).toBe('BRANDING_CONTRAST');
    const ok = await ctx.http.post('/admin/tenants').set(bearer(adminToken)).send(base);
    expect(ok.status).toBe(201);
    const cfg = await ctx.http.get('/tenant/config').set('X-Tenant', 'minera-sur');
    expect(cfg.body.name).toBe('Minera Sur');
    expect((await ctx.http.post('/admin/tenants').set(bearer(adminToken)).send(base)).body.error.code).toBe('SLUG_TAKEN');
  });

  it('crea personas con contraseña temporal y un administrador de empresa', async () => {
    const r = await ctx.http.post('/admin/tenants/minera-sur/users').set(bearer(adminToken)).send([
      { first_name: 'Elena', last_name: 'Cárdenas', phone: '988000111', area: 'Planta', role: 'admin' },
      { first_name: 'Jorge', last_name: 'Ticona', phone: '988000222', area: 'Mina' }
    ]);
    expect(r.status).toBe(201);
    expect(r.body.users).toHaveLength(2);
    expect(r.body.users[1].temporary_password).toMatch(/^[a-z0-9]{6}\d{2}$/);
    learnerId = r.body.users[1].id; learnerPw = r.body.users[1].temporary_password;
    const dup = await ctx.http.post('/admin/tenants/minera-sur/users').set(bearer(adminToken)).send({ first_name: 'X', last_name: 'Y', phone: '988000222' });
    expect(dup.body.error.code).toBe('PHONE_TAKEN');
    const list = await ctx.http.get('/admin/tenants/minera-sur/users').set(bearer(adminToken));
    expect(list.body.users.find((u: any) => u.first_name === 'Elena').role).toBe('admin');
    expect(list.body.users.every((u: any) => u.password_pending)).toBe(true);
  });

  it('crea una ruta, no la asigna hasta publicarla, y luego sí', async () => {
    const r = await ctx.http.post('/admin/tenants/minera-sur/routes').set(bearer(adminToken)).send({
      slug: 'induccion-mina', title: 'Inducción en mina', overline: 'Inducción',
      levels: [{ title: 'Antes de bajar', lessons: [lesson('Equipo de protección', 1), lesson('Señalización', 2)] }]
    });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('draft');
    routeId = r.body.route_id;
    const due = new Date(ctx.clock.now().getTime() + 15 * DAY).toISOString();
    const early = await ctx.http.post('/admin/tenants/minera-sur/assignments').set(bearer(adminToken)).send({ route_id: routeId, user_ids: [learnerId], due_at: due });
    expect(early.body.error.code).toBe('ROUTE_NOT_PUBLISHED');
    const pub = await ctx.http.post(`/admin/tenants/minera-sur/routes/${routeId}/publish`).set(bearer(adminToken));
    expect(pub.body.status).toBe('published');
    const ok = await ctx.http.post('/admin/tenants/minera-sur/assignments').set(bearer(adminToken)).send({ route_id: routeId, user_ids: [learnerId], due_at: due });
    expect(ok.body.assignments[0].created).toBe(true);
    const again = await ctx.http.post('/admin/tenants/minera-sur/assignments').set(bearer(adminToken)).send({ route_id: routeId, user_ids: [learnerId], due_at: due });
    expect(again.body.assignments[0].created).toBe(false);
  });

  it('la persona creada entra con su contraseña temporal y ve la ruta; el reto no trae preguntas de evaluación', async () => {
    const s = await login(ctx, 'minera-sur', '988000222', learnerPw);
    expect(s.password_change_required).toBe(true);
    const ch = await ctx.http.post('/auth/password').set(bearer(s.access_token)).send({ new_password: 'Jorge2026x' });
    const token = ch.body.access_token;
    const home = (await ctx.http.get('/home').set(bearer(token))).body;
    expect(home.assignments[0].route_title).toBe('Inducción en mina');
    const l = (await ctx.http.get(`/lessons/${home.next.lesson.id}`).set(bearer(token))).body;
    expect(l.quiz).toHaveLength(1);
    expect(l.quiz[0].prompt).toBe('Pregunta 1.1');
  });

  it('seguimiento: avance por persona', async () => {
    const p = (await ctx.http.get('/admin/tenants/minera-sur/progress').set(bearer(adminToken))).body;
    expect(p.summary).toMatchObject({ people: 1, completed: 0, not_started: 1, late: 0 });
    expect(p.people[0]).toMatchObject({ user: { name: 'Jorge Ticona' }, pct: 0, exam: { attempts: 0, passed: false }, certificate: null });
  });

  it('un administrador de empresa no puede operar otra empresa', async () => {
    const elena = (await ctx.http.post('/admin/tenants/minera-sur/users').set(bearer(adminToken))
      .send({ first_name: 'Ana', last_name: 'Admin', phone: '988000333', role: 'admin', temporary_password: 'Temporal1' })).body.users[0];
    const s = await login(ctx, 'minera-sur', elena.phone, 'Temporal1');
    const ch = await ctx.http.post('/auth/password').set(bearer(s.access_token)).send({ new_password: 'Ana2026xx' });
    const own = await ctx.http.get('/admin/tenants/minera-sur/progress').set(bearer(ch.body.access_token));
    expect(own.status).toBe(200);
    const other = await ctx.http.get('/admin/tenants/riomar/progress').set(bearer(ch.body.access_token));
    expect(other.body.error.code).toBe('FORBIDDEN');
    const create = await ctx.http.post('/admin/tenants').set(bearer(ch.body.access_token)).send({});
    expect(create.body.error.code).toBe('FORBIDDEN');
  });
});
