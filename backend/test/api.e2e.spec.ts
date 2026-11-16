import { advanceClock } from '../src/modules/assessment';
import { bearer, boot, correctAnswers, Ctx, eventId, login } from './helpers';

let ctx: Ctx;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.app.close(); await ctx.db.close(); });

const MIN = 60_000;

async function homeOf(token: string) {
  const r = await ctx.http.get('/home').set(bearer(token));
  expect(r.status).toBe(200);
  return r.body;
}

async function lessonIds(token: string, assignmentId: string): Promise<string[]> {
  const r = await ctx.http.get(`/assignments/${assignmentId}`).set(bearer(token));
  expect(r.status).toBe(200);
  return r.body.levels.flatMap((lv: any) => lv.lessons.map((l: any) => l.id));
}

/** Completa lecciones enviando el reto como lo haría la PWA (con o sin señal). */
async function completeLessons(token: string, ids: string[]) {
  for (const id of ids) {
    const lesson = (await ctx.http.get(`/lessons/${id}`).set(bearer(token))).body;
    const r = await ctx.http.post('/sync/events').set(bearer(token)).send({ events: [{
      event_id: eventId(), type: 'quiz.completed', lesson_id: id, occurred_at: ctx.clock.now().toISOString(),
      payload: { answers: lesson.quiz.map((q: any) => q.correct_index) }
    }] });
    expect(r.body.results[0].status).toBe('accepted');
  }
}

describe('Marca blanca', () => {
  it('entrega la configuración del cliente por cabecera', async () => {
    const r = await ctx.http.get('/tenant/config').set('X-Tenant', 'riomar');
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Corporación Ríomar');
    expect(r.body.branding.accent).toBe('#F26B1D');
    expect(r.body.exam_policy).toMatchObject({ min_score: 80, attempts: 3, wait_minutes: 60 });
  });

  it('pide indicar la empresa', async () => {
    const r = await ctx.http.get('/tenant/config');
    expect(r.body.error.code).toBe('TENANT_REQUIRED');
  });
});

describe('Ingreso', () => {
  it('rechaza credenciales incorrectas con el texto del Corte 1', async () => {
    const r = await ctx.http.post('/auth/login').set('X-Tenant', 'riomar').send({ phone: '987 111 222', password: 'mala1234' });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('obliga a Carlos a cambiar la contraseña temporal y completar su área', async () => {
    const s = await login(ctx, 'riomar', '987654321');
    expect(s.password_change_required).toBe(true);
    expect((await ctx.http.get('/home').set(bearer(s.access_token))).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const weak = await ctx.http.post('/auth/password').set(bearer(s.access_token)).send({ new_password: 'corta' });
    expect(weak.body.error.code).toBe('WEAK_PASSWORD');
    const same = await ctx.http.post('/auth/password').set(bearer(s.access_token)).send({ new_password: 'Demo2026' });
    expect(same.body.error.code).toBe('WEAK_PASSWORD');

    const ok = await ctx.http.post('/auth/password').set(bearer(s.access_token)).send({ new_password: 'Carlos2026' });
    expect(ok.status).toBe(200);
    const token = ok.body.access_token;
    const me = await ctx.http.get('/me').set(bearer(token));
    expect(me.body.missing_fields).toEqual(['area']);
    expect((await ctx.http.patch('/me').set(bearer(token)).send({ area: 'Inventado' })).status).toBe(400);
    expect((await ctx.http.patch('/me').set(bearer(token)).send({ area: 'Mantenimiento' })).status).toBe(200);

    const home = await homeOf(token);
    expect(home.next.type).toBe('lesson');
    expect(home.next.lesson.title).toBe('Por qué bloqueamos');
  });

  it('rota el token de renovación y cierra la sesión si uno usado reaparece', async () => {
    const s = await login(ctx, 'riomar', '987111222');
    const r1 = await ctx.http.post('/auth/refresh').send({ refresh_token: s.refresh_token });
    expect(r1.status).toBe(200);
    const reuse = await ctx.http.post('/auth/refresh').send({ refresh_token: s.refresh_token });
    expect(reuse.body.error.code).toBe('SESSION_REVOKED');
    const after = await ctx.http.post('/auth/refresh').send({ refresh_token: r1.body.refresh_token });
    expect(after.body.error.code).toBe('SESSION_INVALID');
  });

  it('recupera la contraseña con código por SMS', async () => {
    const req = await ctx.http.post('/auth/otp').set('X-Tenant', 'altavista').send({ phone: '987333444' });
    expect(req.status).toBe(202);
    expect(req.body.masked_phone).toBe('987 *** 444');
    const unknown = await ctx.http.post('/auth/otp').set('X-Tenant', 'altavista').send({ phone: '999999999' });
    expect(unknown.status).toBe(202);

    const bad = await ctx.http.post('/auth/otp/verify').set('X-Tenant', 'altavista').send({ phone: '987333444', code: '000000' });
    expect(bad.body.error).toMatchObject({ code: 'OTP_INVALID', attempts_left: 2 });
    const code = ctx.sms.lastCode('+51987333444')!;
    const ok = await ctx.http.post('/auth/otp/verify').set('X-Tenant', 'altavista').send({ phone: '987333444', code });
    expect(ok.status).toBe(200);
    const reset = await ctx.http.post('/auth/password/reset').send({ reset_token: ok.body.reset_token, new_password: 'Luis2026x' });
    expect(reset.status).toBe(200);
    await expect(login(ctx, 'altavista', '987333444')).rejects.toThrow();
    expect((await login(ctx, 'altavista', '987333444', 'Luis2026x')).access_token).toBeTruthy();
  });
});

describe('Inicio y rutas', () => {
  it('marca la ruta vencida de Luis y no la oculta', async () => {
    const s = await login(ctx, 'riomar', '987333444');
    const home = await homeOf(s.access_token);
    expect(home.assignments[0]).toMatchObject({ late: true, pct: 60 });
    expect(home.assignments[0].days_left).toBeLessThan(0);
  });

  it('muestra a Marisol su renovación y el certificado que vence pronto', async () => {
    const s = await login(ctx, 'riomar', '987555666');
    const home = await homeOf(s.access_token);
    expect(home.assignments[0]).toMatchObject({ kind: 'renewal', pct: 40 });
    expect(home.certificates_expiring[0].days_left).toBe(20);
    const list = await ctx.http.get('/certificates').set(bearer(s.access_token));
    expect(list.body.certificates[0].state).toBe('expiring_soon');
  });

  it('bloquea niveles en orden y explica qué falta', async () => {
    const s = await login(ctx, 'riomar', '987555666');
    const home = await homeOf(s.access_token);
    const ids = await lessonIds(s.access_token, home.assignments[0].id);
    const locked = await ctx.http.get(`/lessons/${ids[3]}`).set(bearer(s.access_token));
    expect(locked.status).toBe(409);
    expect(locked.body.error).toMatchObject({ code: 'LESSON_LOCKED', requires_level: { position: 3, title: 'Candado y tarjeta' } });
  });

  it('no deja ver contenido de otra empresa', async () => {
    const rio = await login(ctx, 'riomar', '987555666');
    const ids = await lessonIds(rio.access_token, (await homeOf(rio.access_token)).assignments[0].id);
    const alta = await login(ctx, 'altavista', '987555666');
    const r = await ctx.http.get(`/lessons/${ids[0]}`).set(bearer(alta.access_token));
    expect(r.status).toBe(404);
  });
});

describe('Lecciones, video y descargas', () => {
  it('sirve el video con URL firmada y por rangos', async () => {
    const s = await login(ctx, 'riomar', '987111222');
    const ids = await lessonIds(s.access_token, (await homeOf(s.access_token)).assignments[0].id);
    const lesson = (await ctx.http.get(`/lessons/${ids[0]}`).set(bearer(s.access_token))).body;
    expect(lesson.quiz).toHaveLength(3);
    expect(lesson.ai_generated).toBe(true);
    const url = new URL(lesson.media.hls.url);
    const ok = await ctx.http.get(url.pathname + url.search).set('Range', 'bytes=0-99');
    expect(ok.status).toBe(206);
    expect(ok.headers['content-type']).toContain('video/mp4');
    const tampered = await ctx.http.get(url.pathname + url.search.replace(/sig=./, 'sig=x'));
    expect(tampered.status).toBe(403);
  });

  it('informa el tamaño del paquete antes de descargar', async () => {
    const s = await login(ctx, 'riomar', '987111222');
    const ids = await lessonIds(s.access_token, (await homeOf(s.access_token)).assignments[0].id);
    const pkg = await ctx.http.get(`/lessons/${ids[2]}/offline-package`).set(bearer(s.access_token));
    expect(pkg.status).toBe(200);
    expect(pkg.body.files.map((f: any) => f.kind).sort()).toEqual(['mp4_offline', 'poster']);
    expect(pkg.body.size_bytes).toBe(78_000_000 + 24_000);
    expect(pkg.body.bundle.quiz[0]).toHaveProperty('why');
  });

  it('registra el reporte de un problema', async () => {
    const s = await login(ctx, 'riomar', '987111222');
    const ids = await lessonIds(s.access_token, (await homeOf(s.access_token)).assignments[0].id);
    const r = await ctx.http.post('/content-reports').set(bearer(s.access_token)).send({ lesson_id: ids[0], reason: 'video_unclear' });
    expect(r.status).toBe(201);
    expect(r.body.message).toBe('Gracias. Lo revisaremos.');
  });
});

describe('Avance sin señal', () => {
  it('acepta un lote fuera de orden, es idempotente y rechaza lo bloqueado sin perderlo', async () => {
    const s = await login(ctx, 'altavista', '987111222');
    const a = (await homeOf(s.access_token)).assignments[0];
    const ids = await lessonIds(s.access_token, a.id);
    const t0 = ctx.clock.now().getTime();
    const lesson3 = (await ctx.http.get(`/lessons/${ids[2]}`).set(bearer(s.access_token))).body;
    const quiz = { event_id: eventId(), type: 'quiz.completed', lesson_id: ids[2],
      occurred_at: new Date(t0 - 50 * MIN).toISOString(), payload: { answers: [0, 0, lesson3.quiz[2].correct_index] } };
    const pos = { event_id: eventId(), type: 'video.position', lesson_id: ids[2],
      occurred_at: new Date(t0 - 60 * MIN).toISOString(), payload: { position_s: 120 } };
    // Llega en el mismo lote pero ocurrió antes de completar el Nivel 2: en ese momento estaba bloqueada.
    const locked = { event_id: eventId(), type: 'quiz.completed', lesson_id: ids[3],
      occurred_at: new Date(t0 - 55 * MIN).toISOString(), payload: { answers: [0, 0, 0] } };

    const r = await ctx.http.post('/sync/events').set(bearer(s.access_token)).send({ events: [quiz, locked, pos] });
    expect(r.status).toBe(200);
    const byId = Object.fromEntries(r.body.results.map((x: any) => [x.event_id, x]));
    expect(byId[pos.event_id].status).toBe('accepted');
    expect(byId[quiz.event_id]).toMatchObject({ status: 'accepted', total: 3 });
    expect(byId[locked.event_id]).toMatchObject({ status: 'rejected', reason: 'LESSON_LOCKED' });
    expect(r.body.assignments[0].pct).toBe(60);

    const again = await ctx.http.post('/sync/events').set(bearer(s.access_token)).send({ events: [quiz] });
    expect(again.body.results[0]).toMatchObject({ status: 'accepted', duplicate: true });
    expect((await homeOf(s.access_token)).assignments[0].pct).toBe(60);
  });
});

describe('Evaluación y certificado', () => {
  it('Rosa no puede empezar sin completar la ruta; al terminarla aprueba y recibe su certificado', async () => {
    const s = await login(ctx, 'riomar', '987111222');
    const a = (await homeOf(s.access_token)).assignments[0];
    const blocked = await ctx.http.get(`/assignments/${a.id}/exam`).set(bearer(s.access_token));
    expect(blocked.body).toMatchObject({ can_start: false, blocked_reason: 'LESSONS_INCOMPLETE' });
    expect(blocked.body.rules).toMatchObject({ min_score: 80, attempts: 3, wait_minutes: 60, requires_connection: true });

    const ids = await lessonIds(s.access_token, a.id);
    await completeLessons(s.access_token, ids.slice(2));
    const started = await ctx.http.post(`/assignments/${a.id}/attempts`).set(bearer(s.access_token));
    expect(started.status).toBe(201);
    expect(started.body.questions).toHaveLength(10);
    expect(started.body.questions[0]).not.toHaveProperty('correct_index');
    expect(started.body.remaining_s).toBe(900);

    const correct = await correctAnswers(ctx.db, started.body.questions.map((q: any) => q.id));
    for (const q of started.body.questions) {
      const r = await ctx.http.put(`/attempts/${started.body.id}/answers/${q.id}`).set(bearer(s.access_token)).send({ choice: correct.get(q.id) });
      expect(r.status).toBe(200);
    }
    const result = await ctx.http.post(`/attempts/${started.body.id}/submit`).set(bearer(s.access_token));
    expect(result.body).toMatchObject({ passed: true, score: 100, min_score: 80 });
    expect(result.body.certificate.code).toMatch(/^RIO-2026-[A-Z0-9]{4}-\d{2}$/);

    const cert = await ctx.http.get(`/certificates/${result.body.certificate.id}`).set(bearer(s.access_token));
    expect(cert.body.statement).toContain('aprobó la capacitación interna «Bloqueo y etiquetado de equipos», definida por la empresa');
    expect(cert.body.disclaimer).toContain('No constituye una certificación externa');
    const pdf = await ctx.http.get(`/certificates/${result.body.certificate.id}/pdf`).set(bearer(s.access_token)).buffer(true)
      .parse((res, cb) => { const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    const verify = await ctx.http.get(`/certificates/verify/${result.body.certificate.code}`).set('X-Tenant', 'riomar');
    expect(verify.body).toMatchObject({ valid: true, holder: 'Rosa Quispe Huamán' });
    expect((await homeOf(s.access_token)).assignments).toHaveLength(0);
  });

  it('Luis desaprueba, ve qué repasar y espera 1 hora para reintentar', async () => {
    const s = await login(ctx, 'riomar', '987333444');
    const a = (await homeOf(s.access_token)).assignments[0];
    const ids = await lessonIds(s.access_token, a.id);
    await completeLessons(s.access_token, ids.slice(3));
    const att = (await ctx.http.post(`/assignments/${a.id}/attempts`).set(bearer(s.access_token))).body;
    const correct = await correctAnswers(ctx.db, att.questions.map((q: any) => q.id));
    for (const q of att.questions) {
      await ctx.http.put(`/attempts/${att.id}/answers/${q.id}`).set(bearer(s.access_token)).send({ choice: (correct.get(q.id)! + 1) % 3 });
    }
    const res = (await ctx.http.post(`/attempts/${att.id}/submit`).set(bearer(s.access_token))).body;
    expect(res).toMatchObject({ passed: false, score: 0, attempts_left: 2, certificate: null });
    expect(res.topics_to_review.length).toBeGreaterThan(0);
    expect(Date.parse(res.retry_at) - ctx.clock.now().getTime()).toBe(60 * MIN);

    const early = await ctx.http.post(`/assignments/${a.id}/attempts`).set(bearer(s.access_token));
    expect(early.body.error.code).toBe('RETRY_AFTER');
    ctx.clock.advance(61 * MIN);
    const fresh = await login(ctx, 'riomar', '987333444'); // el token de acceso dura 15 minutos
    const later = await ctx.http.post(`/assignments/${a.id}/attempts`).set(bearer(fresh.access_token));
    expect(later.status).toBe(201);
    expect(later.body.number).toBe(2);
  });

  it('pausa el tiempo si se corta la señal, hasta el máximo permitido, y cierra por tiempo', async () => {
    const s = await login(ctx, 'altavista', '987555666');
    const a = (await homeOf(s.access_token)).assignments[0];
    const ids = await lessonIds(s.access_token, a.id);
    await completeLessons(s.access_token, ids.slice(2));
    const att = (await ctx.http.post(`/assignments/${a.id}/attempts`).set(bearer(s.access_token))).body;
    expect(att.questions).toHaveLength(8);
    await ctx.http.put(`/attempts/${att.id}/answers/${att.questions[0].id}`).set(bearer(s.access_token)).send({ choice: 0 });

    ctx.clock.advance(5 * MIN); // sin señal: no llegan latidos
    const beat = (await ctx.http.post(`/attempts/${att.id}/heartbeat`).set(bearer(s.access_token))).body;
    expect(beat.remaining_s).toBe(720 - 20);
    expect(beat.pause_left_s).toBe(600 - 280);

    ctx.clock.advance(30 * MIN);
    const fresh = await login(ctx, 'altavista', '987555666');
    const closed = (await ctx.http.get(`/attempts/${att.id}`).set(bearer(fresh.access_token))).body;
    expect(closed.status).toBe('expired');
    expect(closed.result).toMatchObject({ closed_by_time: true, passed: false });
  });
});

describe('Reloj de la evaluación', () => {
  it('cuenta solo la gracia y toma el resto como pausa hasta el máximo', () => {
    const start = new Date(0);
    expect(advanceClock({ time_used_s: 0, paused_s: 0, last_seen_at: start }, new Date(10_000), 600)).toEqual({ time_used_s: 10, paused_s: 0 });
    expect(advanceClock({ time_used_s: 0, paused_s: 0, last_seen_at: start }, new Date(300_000), 600)).toEqual({ time_used_s: 20, paused_s: 280 });
    expect(advanceClock({ time_used_s: 0, paused_s: 500, last_seen_at: start }, new Date(300_000), 600)).toEqual({ time_used_s: 200, paused_s: 600 });
  });
});
