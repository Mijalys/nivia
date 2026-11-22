/*
 * Nivia · capa de datos de la app del aprendiz.
 *
 * Es el CONTRATO con el backend: cada función de `endpoints` corresponde a una ruta real de la API
 * (backend/src/modules/*.ts). La UI (app.js) no llama a fetch ni arma rutas: solo usa estas funciones.
 * Si una pantalla necesita un dato que no está aquí, primero tiene que existir en la API.
 *
 * Modo demo: abre la app con ?demo (o ?demo=desaprobado) y las respuestas salen de fixtures/,
 * que son respuestas reales capturadas con `npm run fixtures` en backend/. No hace falta el servidor.
 */
(function () {
'use strict';

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento bloqueado */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* almacenamiento bloqueado */ } }
};
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}
function deviceLabel() {
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Navegador';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return (os + (br ? ' · ' + br : '')).slice(0, 80);
}

/* ---------- Eventos hacia la UI ---------- */
const listeners = {};
function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
function emit(name, arg) { (listeners[name] || []).forEach((fn) => fn(arg)); }

/* ---------- Modo demo ---------- */
(function () {
  const q = new URLSearchParams(location.search);
  if (q.has('demo')) {
    if (q.get('demo') === '0') { store.del('nivia.demo'); store.del('nivia.session'); }
    else store.set('nivia.demo', q.get('demo') || 'si');
  }
})();
const DEMO = store.get('nivia.demo');

/* ---------- Sesión ---------- */
const tenant = () => store.get('nivia.tenant');
const session = () => store.get('nivia.session');
function saveSession(r) {
  store.set('nivia.session', { access: r.access_token, refresh: r.refresh_token, exp: Date.now() + (r.expires_in || 900) * 1000 });
}
function updateAccess(r) {
  const s = session(); if (s && r && r.access_token) saveSession({ access_token: r.access_token, refresh_token: s.refresh, expires_in: r.expires_in });
}
function clearSession() { store.del('nivia.session'); emit('sessionCleared'); }

let refreshing = null;
async function refresh() {
  const s = session(); if (!s) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await api('/auth/refresh', { method: 'POST', body: { refresh_token: s.refresh }, auth: false });
        saveSession(r); return true;
      } catch (e) {
        if (e.code !== 'NETWORK') clearSession();
        return false;
      } finally { setTimeout(() => { refreshing = null; }, 0); }
    })();
  }
  return refreshing;
}

class ApiErr extends Error {
  constructor(message, code, status, details) { super(message); this.code = code; this.status = status; this.details = details || {}; }
}

/* ---------- Transporte ---------- */
async function api(path, o) {
  o = o || {};
  if (DEMO) return demo(path, o);
  const h = { Accept: 'application/json' };
  if (o.body !== undefined) h['Content-Type'] = 'application/json';
  if (tenant()) h['X-Tenant'] = tenant();
  if (o.auth !== false) {
    let s = session();
    if (s && s.exp - Date.now() < 60_000) { await refresh(); s = session(); }
    if (!s) throw new ApiErr('Inicia sesión para continuar.', 'UNAUTHENTICATED', 401);
    h.Authorization = 'Bearer ' + s.access;
  }
  let res;
  try {
    res = await fetch(path, { method: o.method || 'GET', headers: h, body: o.body !== undefined ? JSON.stringify(o.body) : undefined, cache: 'no-store' });
  } catch (e) {
    emit('network', true);
    throw new ApiErr('No hay conexión. Revisa tu señal e inténtalo de nuevo.', 'NETWORK', 0);
  }
  emit('network', false);
  if (res.status === 401 && o.auth !== false && !o.retried) {
    if (await refresh()) return api(path, Object.assign({}, o, { retried: true }));
    clearSession(); emit('sessionExpired', 'Tu sesión venció. Vuelve a ingresar.');
    throw new ApiErr('Tu sesión venció. Vuelve a ingresar.', 'SESSION_EXPIRED', 401);
  }
  if (o.raw) {
    if (!res.ok) { const d = await res.json().catch(() => null); throw new ApiErr((d && d.error && d.error.message) || 'Algo salió mal.', d && d.error && d.error.code, res.status, d && d.error); }
    return res;
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data && data.error) || {};
    if (err.code === 'PASSWORD_CHANGE_REQUIRED') emit('passwordChangeRequired');
    throw new ApiErr(err.message || 'Algo salió mal. Inténtalo de nuevo.', err.code || 'HTTP_' + res.status, res.status, err);
  }
  return data;
}

/* El modo demo responde con las capturas reales de fixtures/. Cada ruta usa siempre la misma captura. */
const DEMO_ROUTES = [
  ['GET', /^\/tenant\/config$/, 'tenant-config'],
  ['POST', /^\/auth\/login$/, 'auth-login'],
  ['POST', /^\/auth\/google$/, 'errores/not-invited'],
  ['POST', /^\/auth\/(password\/forgot|email-link)$/, 'auth-forgot'],
  ['GET', /^\/auth\/link-info/, 'auth-link-info-invite'],
  ['POST', /^\/auth\/(password\/set|email-link\/verify)$/, 'auth-login'],
  ['POST', /^\/auth\/password$/, 'auth-password'],
  ['POST', /^\/auth\/refresh$/, 'auth-login'],
  ['GET', /^\/me$/, 'me'], ['PATCH', /^\/me$/, 'me'],
  ['GET', /^\/home$/, 'home'],
  ['GET', /^\/assignments\/[^/]+$/, 'assignment'],
  ['GET', /^\/assignments\/[^/]+\/exam$/, 'exam-info'],
  ['POST', /^\/assignments\/[^/]+\/attempts$/, 'attempt-start'],
  ['GET', /^\/lessons\/[^/]+$/, 'lesson'],
  ['POST', /^\/lessons\/[^/]+\/quiz\/check$/, 'quiz-check-correct'],
  ['POST', /^\/sync\/events$/, 'sync-quiz-completed'],
  ['POST', /^\/content-reports$/, 'content-report'],
  ['GET', /^\/attempts\/[^/]+$/, 'attempt-start'],
  ['PUT', /^\/attempts\/[^/]+\/answers\//, 'attempt-answer'],
  ['POST', /^\/attempts\/[^/]+\/heartbeat$/, 'attempt-heartbeat'],
  ['POST', /^\/attempts\/[^/]+\/submit$/, DEMO === 'desaprobado' ? 'result-failed' : 'result-passed'],
  ['GET', /^\/certificates$/, 'certificates'],
  ['GET', /^\/certificates\/[^/]+$/, 'certificate']
];
async function demo(path, o) {
  const method = o.method || 'GET';
  if (path === '/auth/logout') return null;
  if (o.raw) throw new ApiErr('La descarga del PDF no está disponible en el modo demo.', 'DEMO', 0);
  const hit = DEMO_ROUTES.find(([m, re]) => m === method && re.test(path.split('?')[0]));
  if (!hit) throw new ApiErr('Esta acción no tiene captura en el modo demo.', 'DEMO', 0);
  const res = await fetch('fixtures/' + hit[2] + '.json', { cache: 'no-store' });
  const fx = await res.json();
  await new Promise((r) => setTimeout(r, 250));
  if (fx._captura.status >= 400) {
    const err = fx.body.error || {};
    throw new ApiErr(err.message, err.code, fx._captura.status, err);
  }
  return fx.body;
}

/* ---------- Contrato: una función por ruta de la API ---------- */
const json = (method, body) => ({ method, body });
const pub = (method, body) => ({ method, body, auth: false });
const endpoints = {
  // Marca e ingreso (backend/src/modules/tenants.ts, identity.ts)
  tenantConfig: () => api('/tenant/config', { auth: false }),
  login: (email, password) => api('/auth/login', pub('POST', { email, password, device_label: deviceLabel() })),
  loginWithGoogle: (idToken) => api('/auth/google', pub('POST', { id_token: idToken, device_label: deviceLabel() })),
  forgotPassword: (email) => api('/auth/password/forgot', pub('POST', { email })),
  requestEmailLink: (email) => api('/auth/email-link', pub('POST', { email })),
  linkInfo: (token) => api('/auth/link-info?token=' + encodeURIComponent(token), { auth: false }),
  setPasswordWithToken: (token, newPassword) => api('/auth/password/set', pub('POST', { token, new_password: newPassword, device_label: deviceLabel() })),
  verifyEmailLink: (token) => api('/auth/email-link/verify', pub('POST', { token, device_label: deviceLabel() })),
  changePassword: (newPassword, currentPassword) => api('/auth/password', json('POST', currentPassword ? { new_password: newPassword, current_password: currentPassword } : { new_password: newPassword })),
  logout: () => api('/auth/logout', { method: 'POST' }),
  // Perfil (identity.ts)
  me: () => api('/me'),
  updateArea: (area) => api('/me', json('PATCH', { area })),
  // Aprendizaje (learning.ts)
  home: () => api('/home'),
  assignment: (id) => api('/assignments/' + id),
  lesson: (id) => api('/lessons/' + id),
  checkQuizAnswer: (lessonId, questionId, choice) => api('/lessons/' + lessonId + '/quiz/check', json('POST', { question_id: questionId, choice })),
  sendProgress: (events) => api('/sync/events', json('POST', { events })),
  reportContent: (report) => api('/content-reports', json('POST', report)),
  // Evaluación (assessment.ts)
  examInfo: (assignmentId) => api('/assignments/' + assignmentId + '/exam'),
  startAttempt: (assignmentId) => api('/assignments/' + assignmentId + '/attempts', { method: 'POST' }),
  attempt: (id) => api('/attempts/' + id),
  saveAnswer: (attemptId, questionId, choice) => api('/attempts/' + attemptId + '/answers/' + questionId, json('PUT', { choice })),
  heartbeat: (attemptId) => api('/attempts/' + attemptId + '/heartbeat', { method: 'POST' }),
  submitAttempt: (attemptId) => api('/attempts/' + attemptId + '/submit', { method: 'POST' }),
  // Certificados (certification.ts)
  certificates: () => api('/certificates'),
  certificate: (id) => api('/certificates/' + id),
  certificatePdf: (id) => api('/certificates/' + id + '/pdf', { raw: true })
};

/* ---------- Avance: video y reto se envían en lotes; si falla la red, se reintenta ---------- */
let outbox = store.get('nivia.outbox') || [];
let flushing = false;
function queue(type, lessonId, payload) {
  outbox.push({ event_id: uuid(), type, lesson_id: lessonId, occurred_at: new Date().toISOString(), payload: payload || {} });
  store.set('nivia.outbox', outbox);
  flush();
}
async function flush() {
  if (flushing || !outbox.length || !session()) return null;
  flushing = true;
  const batch = outbox.slice(0, 50);
  try {
    const r = await endpoints.sendProgress(batch);
    const sent = new Set(batch.map((e) => e.event_id));
    outbox = outbox.filter((e) => !sent.has(e.event_id)); store.set('nivia.outbox', outbox);
    return r;
  } catch (e) { return null; } finally { flushing = false; }
}

window.NiviaAPI = Object.assign({
  store, uuid, deviceLabel, on, DEMO, ApiErr,
  tenant, session, saveSession, updateAccess, clearSession, refresh, queue, flush
}, endpoints);
})();
