import { bearer, boot, Ctx, login, tokenFrom } from './helpers';

let ctx: Ctx;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.app.close(); await ctx.db.close(); });

const DAY = 86_400_000;
let adminToken = '';
let routeId = '';
let learnerId = '';

const lesson = (title: string, i: number) => ({
  title, duration_s: 180, summary: [`Resumen de ${title}.`],
  questions: [
    { prompt: `Pregunta ${i}.1`, options: ['Mala', 'Buena', 'Peor'], correct_index: 1, why: 'Porque sí.', in_exam: false },
    { prompt: `Pregunta ${i}.2 (evaluación)`, options: ['Buena', 'Mala'], correct_index: 0, why: 'Porque también.', in_quiz: false, in_exam: true }
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
    const s = await login(ctx, 'riomar', 'rosa');
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

  it('crea personas por correo y les envía una invitación con la marca de la empresa', async () => {
    const r = await ctx.http.post('/admin/tenants/minera-sur/users').set(bearer(adminToken)).send([
      { first_name: 'Elena', last_name: 'Cárdenas', email: 'elena@minerasur.example', area: 'Planta', role: 'admin' },
      { first_name: 'Jorge', last_name: 'Ticona', email: 'Jorge.Ticona@minerasur.example', phone: '988000222', area: 'Mina' }
    ]);
    expect(r.status).toBe(201);
    expect(r.body.users).toHaveLength(2);
    expect(r.body.users[1]).toMatchObject({ email: 'jorge.ticona@minerasur.example', invite_sent: true });
    learnerId = r.body.users[1].id;
    const mail = ctx.mail.sent.find((m) => m.to === 'jorge.ticona@minerasur.example')!;
    expect(mail.subject).toBe('Minera Sur te invita a tu capacitación');
    expect(mail.text).toContain('accion=invitacion');
    const dup = await ctx.http.post('/admin/tenants/minera-sur/users').set(bearer(adminToken)).send({ first_name: 'X', last_name: 'Y', email: 'JORGE.TICONA@minerasur.example' });
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
    const list = await ctx.http.get('/admin/tenants/minera-sur/users').set(bearer(adminToken));
    expect(list.body.users.find((u: any) => u.first_name === 'Elena').role).toBe('admin');
    expect(list.body.users.every((u: any) => u.status === 'invited' && !u.has_password)).toBe(true);
    const again = await ctx.http.post(`/admin/tenants/minera-sur/users/${learnerId}/invite`).set(bearer(adminToken));
    expect(again.body.invite_sent).toBe(true);
  });

  it('rechaza una ruta con videos que no se subieron o preguntas en reto y evaluación a la vez', async () => {
    const noVideo = await ctx.http.post('/admin/tenants/minera-sur/routes').set(bearer(adminToken)).send({
      slug: 'sin-video', title: 'Sin video', overline: 'Prueba',
      levels: [{ title: 'Uno', lessons: [{ ...lesson('Falta el video', 9), video_key: 'minera-sur/no-existe.mp4' }] }]
    });
    expect(noVideo.status).toBe(400);
    expect(noVideo.body.error.code).toBe('MEDIA_NOT_FOUND');
    const escape = await ctx.http.post('/admin/tenants/minera-sur/routes').set(bearer(adminToken)).send({
      slug: 'fuera', title: 'Fuera', overline: 'Prueba',
      levels: [{ title: 'Uno', lessons: [{ ...lesson('Fuera de la carpeta', 9), video_key: '../package.json' }] }]
    });
    expect(escape.body.error.code).toBe('MEDIA_NOT_FOUND');
    const badFile = await ctx.http.post('/admin/tenants/minera-sur/routes').set(bearer(adminToken)).send({
      slug: 'sin-guia', title: 'Sin guía', overline: 'Prueba',
      levels: [{ title: 'Uno', lessons: [{ ...lesson('Guía que falta', 9), resources: [{ title: 'Guía', kind: 'file', key: 'minera-sur/no-existe.pdf' }] }] }]
    });
    expect(badFile.body.error.code).toBe('MEDIA_NOT_FOUND');
    const httpLink = await ctx.http.post('/admin/tenants/minera-sur/routes').set(bearer(adminToken)).send({
      slug: 'enlace-http', title: 'Enlace http', overline: 'Prueba',
      levels: [{ title: 'Uno', lessons: [{ ...lesson('Enlace inseguro', 9), resources: [{ title: 'Grabación', kind: 'link', url: 'http://example.com/x' }] }] }]
    });
    expect(httpLink.status).toBe(400);
    const both = await ctx.http.post('/admin/tenants/minera-sur/routes').set(bearer(adminToken)).send({
      slug: 'ambos', title: 'Ambos', overline: 'Prueba',
      levels: [{ title: 'Uno', lessons: [{ ...lesson('Mezcla', 9), questions: [{ prompt: 'P', options: ['a', 'b'], correct_index: 0, why: 'x', in_quiz: true, in_exam: true }] }] }]
    });
    expect(both.status).toBe(400);
    const withVideo = await ctx.http.post('/admin/tenants/minera-sur/routes').set(bearer(adminToken)).send({
      slug: 'con-video', title: 'Con video', overline: 'Prueba',
      levels: [{ title: 'Uno', lessons: [{ ...lesson('Video subido', 9), video_key: 'demo/leccion-demo.mp4', poster_key: 'demo/portada.jpg' }] }]
    });
    expect(withVideo.status).toBe(201);
  });

  it('crea una ruta, no la asigna hasta publicarla, y luego sí', async () => {
    const r = await ctx.http.post('/admin/tenants/minera-sur/routes').set(bearer(adminToken)).send({
      slug: 'induccion-mina', title: 'Inducción en mina', overline: 'Inducción',
      levels: [{ title: 'Antes de bajar', lessons: [{ ...lesson('Equipo de protección', 1), resources: [
        { title: 'Guía de la clase', kind: 'file', key: 'demo/portada.jpg' },
        { title: 'Grabación de la clase', kind: 'link', url: 'https://example.com/grabacion' }
      ] }, lesson('Señalización', 2)] }]
    });
    expect(r.status).toBe(201);
    expect(r.body.lessons[0].resources).toBe(2);
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

  it('la persona acepta la invitación, crea su contraseña y ve la ruta; el reto no trae preguntas de evaluación', async () => {
    const url = ctx.mail.lastLink('jorge.ticona@minerasur.example')!;
    const info = await ctx.http.get('/auth/link-info').query({ token: tokenFrom(url) });
    expect(info.body).toMatchObject({ purpose: 'invite', first_name: 'Jorge', company: 'Minera Sur' });
    const s = await ctx.http.post('/auth/password/set').send({ token: tokenFrom(url), new_password: 'Jorge2026x' });
    expect(s.status).toBe(200);
    expect(s.body.password_change_required).toBe(false);
    const token = s.body.access_token;
    const home = (await ctx.http.get('/home').set(bearer(token))).body;
    expect(home.assignments[0].route_title).toBe('Inducción en mina');
    const l = (await ctx.http.get(`/lessons/${home.next.lesson.id}`).set(bearer(token))).body;
    expect(l.quiz).toHaveLength(1);
    expect(l.quiz[0].prompt).toBe('Pregunta 1.1');
    // Material de apoyo: el archivo se descarga con URL firmada; el enlace llega tal cual.
    expect(l.resources.map((x: any) => [x.title, x.kind])).toEqual([['Guía de la clase', 'file'], ['Grabación de la clase', 'link']]);
    expect(l.resources[0]).toMatchObject({ filename: 'portada.jpg' });
    expect(l.resources[0].size_bytes).toBeGreaterThan(0);
    expect(l.resources[1].url).toBe('https://example.com/grabacion');
    const fileUrl = new URL(l.resources[0].url);
    const dl = await ctx.http.get(fileUrl.pathname + fileUrl.search);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toBe('attachment; filename="portada.jpg"');
    expect((await login(ctx, 'minera-sur', 'jorge.ticona@minerasur.example', 'Jorge2026x')).access_token).toBeTruthy();
    const list = await ctx.http.get('/admin/tenants/minera-sur/users').set(bearer(adminToken));
    expect(list.body.users.find((u: any) => u.first_name === 'Jorge')).toMatchObject({ status: 'active', has_password: true });
  });

  it('seguimiento: avance por persona', async () => {
    const p = (await ctx.http.get('/admin/tenants/minera-sur/progress').set(bearer(adminToken))).body;
    expect(p.summary).toMatchObject({ people: 1, completed: 0, not_started: 1, late: 0 });
    expect(p.people[0]).toMatchObject({ user: { name: 'Jorge Ticona', email: 'jorge.ticona@minerasur.example' }, pct: 0, exam: { attempts: 0, passed: false }, certificate: null });
  });

  it('un administrador de empresa no puede operar otra empresa', async () => {
    const elena = (await ctx.http.post('/admin/tenants/minera-sur/users').set(bearer(adminToken))
      .send({ first_name: 'Ana', last_name: 'Admin', email: 'ana@minerasur.example', role: 'admin', temporary_password: 'Temporal1' })).body.users[0];
    expect(elena.invite_sent).toBe(false);
    const s = await login(ctx, 'minera-sur', elena.email, 'Temporal1');
    const ch = await ctx.http.post('/auth/password').set(bearer(s.access_token)).send({ new_password: 'Ana2026xx' });
    const own = await ctx.http.get('/admin/tenants/minera-sur/progress').set(bearer(ch.body.access_token));
    expect(own.status).toBe(200);
    const other = await ctx.http.get('/admin/tenants/riomar/progress').set(bearer(ch.body.access_token));
    expect(other.body.error.code).toBe('FORBIDDEN');
    const create = await ctx.http.post('/admin/tenants').set(bearer(ch.body.access_token)).send({});
    expect(create.body.error.code).toBe('FORBIDDEN');
  });
});
