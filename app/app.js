/*
 * Nivia · app del aprendiz para el piloto.
 * Misma capa visual que el prototipo (tema D), pero todo viene de la API: sin datos simulados ni modo sin señal.
 * La API sirve esta app en /app/ desde el mismo origen, así que no hace falta CORS.
 */
(function () {
'use strict';

/* ---------- Utilidades ---------- */
const PATHS = {
  check: 'M5 12l5 5 9-10', back: 'M15 18l-6-6 6-6', x: 'M6 6l12 12M18 6L6 18', chev: 'M9 6l6 6-6 6',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  home: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  late: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.01"/>',
  redo: '<path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  wifioff: 'M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.5a10 10 0 015-2.7M19 12.5a10 10 0 00-3.2-2.1M12 20h.01',
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4M9 2h6"/>',
  inbox: '<path d="M4 13l3-8h10l3 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 000-6H9a3 3 0 010-6h7"/>',
  clip: 'M21 12.5l-8.5 8.5a5 5 0 01-7-7L14 5.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4L15.5 8.5',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5'
};
function icon(n, s) {
  s = s || 24; const d = PATHS[n];
  const inner = d.charAt(0) === '<' ? d : '<path d="' + d + '"/>';
  return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function inl(n) { return icon(n, 18).replace('class="ic"', 'class="ic" style="vertical-align:-3px;margin-right:6px"'); }

// Fechas en hora de Lima (UTC-5, sin horario de verano).
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
const lima = (iso) => new Date(new Date(iso).getTime() - 5 * 3600e3);
function fShort(iso) { const d = lima(iso); return DAYS_S[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS_S[d.getUTCMonth()]; }
function fDM(iso) { const d = lima(iso); return d.getUTCDate() + ' ' + MONTHS_S[d.getUTCMonth()]; }
function fLong(iso) { const d = lima(iso); return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MONTHS[d.getUTCMonth()]; }
function fNum(iso) { const d = lima(iso); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear(); }
function fHM(iso) { const d = lima(iso); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
function fClock(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtLabel(f) { return f === 'presenter' ? 'Con presentador' : 'Animado'; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
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
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento bloqueado */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* almacenamiento bloqueado */ } }
};
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(navigator.userAgent || '');

/* ---------- Estado ---------- */
const S = {
  cfg: null, me: null,
  screen: 'boot', params: {}, data: null, error: null, loading: false,
  form: {}, sheet: null, toast: null, toastUntil: 0, netDown: false,
  link: null,            // token de invitación o restablecimiento en curso
  video: null, quiz: null, done: null, ex: null, result: null, routeTitle: store.get('nivia.routeTitle'),
  homeTab: 'curso', routeView: 'mapa'
};

/* ---------- Sesión y API ---------- */
const tenant = () => store.get('nivia.tenant');
const session = () => store.get('nivia.session');
function saveSession(r) {
  store.set('nivia.session', { access: r.access_token, refresh: r.refresh_token, exp: Date.now() + (r.expires_in || 900) * 1000 });
}
function clearSession() { store.del('nivia.session'); S.me = null; }

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
async function api(path, o) {
  o = o || {};
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
    setNet(true);
    throw new ApiErr('No hay conexión. Revisa tu señal e inténtalo de nuevo.', 'NETWORK', 0);
  }
  setNet(false);
  if (res.status === 401 && o.auth !== false && !o.retried) {
    if (await refresh()) return api(path, Object.assign({}, o, { retried: true }));
    clearSession(); toLogin('Tu sesión venció. Vuelve a ingresar.');
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
    if (err.code === 'PASSWORD_CHANGE_REQUIRED') { nav('contrasena', { mode: 'first' }); }
    throw new ApiErr(err.message || 'Algo salió mal. Inténtalo de nuevo.', err.code || 'HTTP_' + res.status, res.status, err);
  }
  return data;
}
function setNet(down) {
  if (S.netDown === down) return;
  S.netDown = down;
  const el = document.getElementById('netbar');
  if (el) el.hidden = !down;
}

/* Avance (video y reto): se envía en lotes; si falla la red, se reintenta en el siguiente envío. */
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
    const r = await api('/sync/events', { method: 'POST', body: { events: batch } });
    const sent = new Set(batch.map((e) => e.event_id));
    outbox = outbox.filter((e) => !sent.has(e.event_id)); store.set('nivia.outbox', outbox);
    return r;
  } catch (e) { return null; } finally { flushing = false; }
}

/* ---------- Marca del cliente ---------- */
function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0.83, 1, 0.23]; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
function applyTheme() {
  const b = S.cfg && S.cfg.branding; if (!b) return;
  const r = document.documentElement.style;
  r.setProperty('--accent', b.accent); r.setProperty('--on-accent', b.on_accent || '#11140C');
  r.setProperty('--principal', b.principal); r.setProperty('--ptext', b.principal_text || b.accent);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = '#0B0D09';
}
function brandBar() {
  const c = S.cfg; if (!c) return '';
  if (c.branding.logo_url) return '<div class="brand logo"><img src="' + esc(c.branding.logo_url) + '" alt="' + esc(c.name) + '" style="display:block;height:30px;width:auto"></div>';
  return '<div class="brand"><span class="mono">' + esc(c.branding.mono) + '</span><span>' + esc(c.name) + '</span></div>';
}

/* Orbe fluido (WebGL, un solo contexto compartido), igual que en el prototipo. */
const Orb = (function () {
  let gl = null, glc = null, uRes, uT, uC, failed = false, raf = 0;
  const SZ = 320;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function init() {
    if (gl || failed) return !!gl;
    try {
      glc = document.createElement('canvas'); glc.width = SZ; glc.height = SZ;
      gl = glc.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
      if (!gl) throw new Error('sin webgl');
      const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
      const fs = 'precision mediump float;uniform vec2 r;uniform float t;uniform vec3 c;' +
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
        'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}' +
        'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}' +
        'void main(){vec2 uv=(gl_FragCoord.xy/r)*2.-1.;float d=length(uv);float a=1.-smoothstep(.975,1.,d);' +
        'vec2 p=uv*1.6;vec2 q=vec2(fbm(p+vec2(sin(t*.21),cos(t*.17))),fbm(p+vec2(5.2,1.3)+vec2(cos(t*.19),sin(t*.23))));' +
        'float f=fbm(p+2.2*q);vec3 w=vec3(.98,.98,.96);vec3 m=mix(w,c,.5);vec3 col=mix(w,m,smoothstep(.25,.55,f));' +
        'col=mix(col,c,smoothstep(.5,.85,f));float b=smoothstep(-.2,1.,-uv.y);col=mix(col,c*.55,b*.45);col*=.92+.08*(1.-d);' +
        'gl_FragColor=vec4(col*a,a);}';
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uRes = gl.getUniformLocation(prog, 'r'); uT = gl.getUniformLocation(prog, 't'); uC = gl.getUniformLocation(prog, 'c');
      return true;
    } catch (e) { failed = true; gl = null; return false; }
  }
  function drawFallback(cv) {
    const x = cv.getContext('2d'); const w = cv.width; const b = (S.cfg && S.cfg.branding) || { accent: '#D4FF3A', principal: '#2B3514' };
    const g = x.createRadialGradient(w * .38, w * .32, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, '#FBFAF6'); g.addColorStop(.55, b.accent); g.addColorStop(1, b.principal);
    x.clearRect(0, 0, w, w); x.fillStyle = g; x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); x.fill();
  }
  function frame(ts) {
    const list = document.querySelectorAll('canvas[data-orb]');
    if (!list.length) { raf = 0; return; }
    if (init()) {
      const c = hexRgb(S.cfg && S.cfg.branding.accent);
      gl.viewport(0, 0, SZ, SZ); gl.uniform2f(uRes, SZ, SZ); gl.uniform1f(uT, reduce ? 4.0 : ts / 1000); gl.uniform3f(uC, c[0], c[1], c[2]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      list.forEach((cv) => { const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(glc, 0, 0, cv.width, cv.height); });
    } else { list.forEach(drawFallback); }
    raf = (reduce || document.hidden) ? 0 : requestAnimationFrame(frame);
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  return { start };
})();
function orb(size) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  return '<div class="orbwrap"><canvas data-orb width="' + Math.round(size * dpr) + '" height="' + Math.round(size * dpr) + '" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true"></canvas></div>';
}

/* ---------- Piezas comunes ---------- */
function topBar(ctx, pct, exitAction) {
  return '<div class="top"><div class="row"><button class="exit" data-a="' + (exitAction || 'back') + '">' + icon('x', 22) + 'Salir</button><span class="ctx">' + esc(ctx) + '</span></div>' +
    (pct != null ? '<div class="bar" role="progressbar" aria-label="Avance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '"><i style="width:' + pct + '%"></i></div>' : '') + '</div>';
}
function tabs(active) {
  const t = (id, label, ic) => '<button data-a="go" data-to="' + id + '"' + (active === id ? ' aria-current="page"' : '') + '>' + icon(ic, 24) + label + '</button>';
  return '<nav class="tabs" aria-label="Secciones">' + t('inicio', 'Inicio', 'home') + t('certificados', 'Certificados', 'award') + t('perfil', 'Perfil', 'user') + '</nav>';
}
function pill(kind, text, ic) { return '<span class="pill ' + kind + '">' + (ic ? icon(ic, 14) : '') + esc(text) + '</span>'; }
function ring(p) { return '<div class="ring2" style="--p:' + p + '" aria-hidden="true"><span>' + p + '%</span></div>'; }
function errLine(msg) { return msg ? '<p class="err" role="alert">' + icon('info', 20) + '<span>' + esc(msg) + '</span></p>' : ''; }
function loadingHtml() {
  return '<main class="scr" aria-busy="true"><span class="vh">Cargando</span><div class="sk" style="height:22px;width:45%"></div><div class="sk" style="height:34px;width:85%"></div><div class="sk" style="height:200px"></div><div class="sk" style="height:96px"></div></main>';
}
function errorHtml(e) {
  const net = e && e.code === 'NETWORK';
  return '<main class="scr"><div class="empty">' + icon(net ? 'wifioff' : 'info', 40) + '<p class="h2">' + (net ? 'No pudimos conectarnos' : 'Algo salió mal') + '</p><p class="muted small">' + esc(e ? e.message : '') + '</p>' +
    '<button class="btn btn-primary" data-a="retry">' + icon('redo', 20) + 'Volver a intentar</button><button class="btn btn-sec" data-a="go" data-to="inicio">Ir a Inicio</button></div></main>';
}
function dueText(a) {
  if (a.late) return '<span style="color:var(--rep)">Venció el ' + fDM(a.due_at) + '</span>';
  const d = a.days_left;
  return 'Vence el ' + fShort(a.due_at) + ' · ' + (d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'faltan ' + d + ' días');
}
function passRulesHtml(v, showMiss) {
  v = v || '';
  const li = (ok, txt) => {
    const st = ok ? 'true' : (showMiss ? 'miss' : 'false');
    return '<li data-ok="' + st + '">' + icon(ok ? 'check' : (showMiss ? 'info' : 'target'), 20) + '<span>' + txt + '</span><span class="st">' + (ok ? 'Cumple' : (showMiss ? 'Falta' : 'Pendiente')) + '</span></li>';
  };
  return li(v.length >= 8, 'Mínimo 8 caracteres') + li(/\d/.test(v), 'Al menos un número');
}
function fSize(b) { if (!b) return ''; return b >= 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; }
/* Material de apoyo: los archivos se descargan con URL firmada; los enlaces se abren aparte. */
function resourcesList(list) {
  return '<div class="stack" style="gap:8px">' + list.map((r) => r.kind === 'file'
    ? '<a class="lessonbtn" href="' + esc(r.url) + '" download="' + esc(r.filename || '') + '" style="color:inherit;text-decoration:none">' + icon('download', 20) + '<span class="t">' + esc(r.title) + '<span class="xs muted" style="display:block;font-weight:400">' + esc((r.filename || '').split('.').pop().toUpperCase()) + (r.size_bytes ? ' · ' + fSize(r.size_bytes) : '') + '</span></span></a>'
    : '<a class="lessonbtn" href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">' + icon('ext', 20) + '<span class="t">' + esc(r.title) + '<span class="xs muted" style="display:block;font-weight:400">Enlace · se abre en otra pestaña</span></span></a>').join('') + '</div>';
}
function titleSplit(t) { const w = String(t).split(' '); const last = w.pop(); return esc(w.join(' ')) + ' <b>' + esc(last) + '</b>'; }

/* ---------- Pantallas ----------
 * Cada pantalla tiene load (trae datos de la API) y view (pinta con S.data). */
const SCREENS = {};
const PUBLIC = ['ingresar', 'recuperar', 'enlace', 'crear-contrasena'];

/* Ingreso */
SCREENS.ingresar = {
  view() {
    const c = S.cfg; const f = S.form;
    const google = c.sign_in && c.sign_in.google_client_id;
    const logo = c.branding.logo_url
      ? orb(120) + '<span class="logoplate"><img src="' + esc(c.branding.logo_url) + '" alt="' + esc(c.name) + '" style="display:block;height:44px;width:auto"></span>'
      : '<div style="position:relative;display:flex;align-items:center;justify-content:center">' + orb(160) +
        '<span class="mono" style="position:absolute;width:56px;height:56px;border-radius:16px;font-size:28px;background:var(--principal);color:#F2F2F0">' + esc(c.branding.mono) + '</span></div>' +
        '<span style="font-weight:600;font-size:18px">' + esc(c.name) + '</span>';
    return '<main class="scr" style="justify-content:center;gap:28px"><div class="logo-hit" style="cursor:default">' + logo + '</div>' +
      '<div class="stack-s" style="text-align:center"><h1 class="title">Entra a tu <b>capacitación</b></h1><p class="muted small">Usa el correo con el que te invitó tu empresa.</p></div>' +
      (f.notice ? '<div class="banner info" role="status">' + icon('info', 20) + '<span>' + esc(f.notice) + '</span></div>' : '') +
      (google ? (IN_APP_BROWSER ? '<div class="banner info" role="status">' + icon('info', 20) + '<span>Para entrar con Google, abre esta página en Chrome o Safari: toca los tres puntos y elige "Abrir en el navegador".</span></div>' : '') +
        errLine(f.gErr) + '<div class="gbtn"><div id="gbtn"></div></div><div class="divider"><span>o con tu correo</span></div>' : '') +
      '<form class="stack" id="loginForm" novalidate>' +
        '<div class="field"><label for="email">Correo</label><input class="input" id="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="nombre@empresa.com" value="' + esc(f.email || '') + '"' + (f.err === 'email' ? ' aria-invalid="true"' : '') + '></div>' +
        '<div class="field"><label for="pass">Contraseña</label><div class="inwrap"><input class="input" id="pass" type="' + (f.show ? 'text' : 'password') + '" autocomplete="current-password" value="' + esc(f.pass || '') + '"' + (f.err === 'pass' ? ' aria-invalid="true"' : '') + '><button type="button" class="show" data-a="togglePass">' + (f.show ? 'Ocultar' : 'Mostrar') + '</button></div></div>' +
        errLine(f.msg) +
        '<button class="btn btn-primary" type="submit"' + (f.busy ? ' disabled' : '') + '>' + (f.busy ? 'Ingresando…' : 'Ingresar') + '</button>' +
      '</form>' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><button class="link" data-a="go" data-to="recuperar">¿Olvidaste tu contraseña?</button>' +
      '<button class="link" data-a="go" data-to="enlace">Entrar con un enlace</button></div></main>';
  }
};

/* Recuperar contraseña o entrar con enlace: siempre se responde igual, exista o no la cuenta. */
function forgotView(reset) {
  const f = S.form;
  let body;
  if (!f.sent) {
    body = '<div class="stack-s"><h1 class="title">' + (reset ? 'Recupera tu <b>contraseña</b>' : 'Entra con un <b>enlace</b>') + '</h1><p class="muted small">' +
      (reset ? 'Te enviaremos un enlace a tu correo para crear una contraseña nueva.' : 'Te enviaremos un enlace a tu correo. Lo tocas y entras, sin contraseña.') + '</p></div>' +
      '<form class="stack" id="fg1" novalidate><div class="field"><label for="femail">Correo</label><input class="input" id="femail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="nombre@empresa.com" value="' + esc(f.email || '') + '"></div>' +
      errLine(f.msg) + '<button class="btn btn-primary" type="submit"' + (f.busy ? ' disabled' : '') + '>' + (f.busy ? 'Enviando…' : 'Enviar enlace') + '</button></form>';
  } else {
    const parts = String(f.email).split('@');
    const wait = Math.max(0, Math.ceil((f.resendAt - Date.now()) / 1000));
    body = '<span class="muted">' + icon('inbox', 40) + '</span><div class="stack-s"><h1 class="title">Revisa tu <b>correo</b></h1>' +
      '<p class="muted small">Si ' + esc(parts[0].charAt(0) + '•••@' + (parts[1] || '')) + ' tiene una cuenta, te llegó un enlace. ' + (reset ? 'Vence en 30 minutos.' : 'Vence en 15 minutos.') + ' Sirve una sola vez.</p></div>' +
      '<div class="banner info">' + icon('info', 20) + '<span>¿No llegó? Revisa la carpeta de spam o promociones.</span></div>' +
      '<button class="btn btn-sec" data-a="resend"' + (wait ? ' disabled' : '') + ' id="resendBtn">' + (wait ? 'Pedir otro en ' + wait + ' s' : 'Pedir otro enlace') + '</button>' +
      '<button class="link" style="align-self:center" data-a="go" data-to="ingresar">Volver a ingresar</button>';
  }
  return topBar(reset ? 'Recuperar contraseña' : 'Entrar con un enlace', null, 'toLogin') + '<main class="scr">' + body + '</main>';
}
SCREENS.recuperar = { view: () => forgotView(true) };
SCREENS.enlace = { view: () => forgotView(false) };

/* Crear contraseña: desde invitación o restablecimiento (token), primer ingreso con temporal, o cambio desde Perfil. */
SCREENS['crear-contrasena'] = {
  view() {
    const L = S.link; const f = S.form;
    if (!L) return '<main class="scr"><div class="empty">' + icon('info', 40) + '<p class="h2">Este enlace no es válido</p><button class="btn btn-primary" data-a="go" data-to="ingresar">Ir a ingresar</button></div></main>';
    if (L.error) {
      return brandBar() + '<main class="scr"><div class="empty">' + icon('clock', 40) + '<p class="h2">Este enlace ya no sirve</p><p class="muted small">' + esc(L.error) + '</p>' +
        '<button class="btn btn-primary" data-a="go" data-to="recuperar">Pedir un enlace nuevo</button><button class="btn btn-sec" data-a="go" data-to="ingresar">Ir a ingresar</button></div></main>';
    }
    const invite = L.info.purpose === 'invite';
    return brandBar() + '<main class="scr">' +
      '<div class="stack-s"><p class="over">' + (invite ? 'Bienvenida' : 'Contraseña nueva') + '</p><h1 class="title">' + (invite ? 'Hola, <b>' + esc(L.info.first_name) + '</b>' : 'Crea tu <b>contraseña</b>') + '</h1>' +
      '<p class="muted small">' + (invite ? esc(L.info.company) + ' te invitó a su capacitación. Crea una contraseña para ' + esc(L.info.email) + '.' : 'Escribe una contraseña nueva para ' + esc(L.info.email) + '.') + '</p></div>' +
      passwordForm(f, false) + '</main>';
  }
};
function passwordForm(f, needCurrent) {
  return '<div class="stack-s"><p class="small" style="font-weight:600">Tu contraseña debe tener:</p><ul class="prules" id="prules">' + passRulesHtml(f.np1, f.tried) + '</ul></div>' +
    '<form class="stack" id="npForm" novalidate>' +
    (needCurrent ? '<div class="field"><label for="cur">Contraseña actual</label><input class="input" id="cur" type="' + (f.show ? 'text' : 'password') + '" autocomplete="current-password" value="' + esc(f.cur || '') + '"></div>' : '') +
    '<div class="field"><label for="np1">Nueva contraseña</label><div class="inwrap"><input class="input" id="np1" type="' + (f.show ? 'text' : 'password') + '" autocomplete="new-password" value="' + esc(f.np1 || '') + '"><button type="button" class="show" data-a="togglePass">' + (f.show ? 'Ocultar' : 'Mostrar') + '</button></div></div>' +
    '<div class="field"><label for="np2">Repite la contraseña</label><input class="input" id="np2" type="' + (f.show ? 'text' : 'password') + '" autocomplete="new-password" value="' + esc(f.np2 || '') + '"></div>' +
    errLine(f.msg) + '<button class="btn btn-primary" type="submit"' + (f.busy ? ' disabled' : '') + '>' + (f.busy ? 'Guardando…' : 'Guardar contraseña') + '</button></form>';
}
SCREENS.contrasena = {
  async load() { return { me: await api('/me') }; },
  view() {
    const first = S.params.mode === 'first' || (S.data.me && S.data.me.password_change_required);
    const needCurrent = !first && S.data.me.sign_in.password;
    return (first ? brandBar() : topBar('Perfil', null, 'toProfile')) + '<main class="scr">' + (first ? '<p class="over">Paso 1 de 2</p>' : '') +
      '<div class="stack-s"><h1 class="title">' + (first || !S.data.me.sign_in.password ? 'Crea tu' : 'Cambia tu') + ' <b>contraseña</b></h1><p class="muted small">' +
      (first ? 'Es tu primer ingreso. Cambia la contraseña temporal por una tuya.' : S.data.me.sign_in.password ? 'Escribe tu contraseña actual y la nueva.' : 'Así también podrás entrar con tu correo, además de Google.') + '</p></div>' +
      passwordForm(S.form, needCurrent) + (first ? '<button class="link" style="align-self:center" data-a="logout">Salir</button>' : '') + '</main>';
  }
};

/* Ficha: el único dato que falta es el área */
SCREENS.datos = {
  async load() { return { me: await api('/me') }; },
  view() {
    const me = S.data.me; const f = S.form;
    return brandBar() + '<main class="scr"><p class="over">Paso 2 de 2</p>' +
      '<div class="stack-s"><h1 class="title">Completa tus <b>datos</b></h1><p class="muted small">Solo falta un dato.</p></div>' +
      '<dl class="dl"><div><dt>Nombre</dt><dd>' + esc(me.first_name + ' ' + me.last_name) + '</dd></div><div><dt>Empresa</dt><dd>' + esc(me.company) + '</dd></div><div><dt>Correo</dt><dd>' + esc(me.email) + '</dd></div></dl>' +
      '<form class="stack" id="fichaForm" novalidate><div class="field"><label for="area">¿En qué área trabajas?</label>' +
      '<select class="input" id="area"' + (f.err ? ' aria-invalid="true"' : '') + '><option value="">Elige tu área</option>' + me.area_options.map((a) => '<option' + (f.area === a ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select></div>' +
      (f.err ? errLine('Elige tu área para continuar.') : errLine(f.msg)) +
      '<button class="btn btn-primary" type="submit"' + (f.busy ? ' disabled' : '') + '>Empezar</button></form></main>';
  }
};

/* Inicio */
SCREENS.inicio = {
  async load() {
    const home = await api('/home');
    let lesson = null;
    if (home.next && home.next.type === 'lesson') { try { lesson = await api('/lessons/' + home.next.lesson.id); } catch (e) { lesson = null; } }
    return { home, lesson };
  },
  view() {
    const h = S.data.home; const tab = S.homeTab;
    const head = '<div class="stack-s"><p class="muted small">Hola, <b style="color:var(--fg)">' + esc(h.user.first_name) + '</b> · ' + esc(fLong(new Date().toISOString())) + '</p>' +
      '<h1 class="hero-t"><span>Sigue tu</span><b>ruta de hoy</b></h1></div>';
    const soon = (h.certificates_expiring || [])[0];
    const soonBanner = soon ? '<div class="banner info">' + icon('clock', 20) + '<span>Tu certificado <b>' + esc(soon.route_title) + '</b> vence en ' + plural(soon.days_left, 'día', 'días') + ', el ' + fDM(soon.expires_at) + '.</span></div>' : '';
    const late = h.assignments.find((a) => a.late);
    const lateBanner = late ? '<div class="banner rep" role="status">' + icon('late', 20) + '<span>La capacitación <b>' + esc(late.route_title) + '</b> venció el ' + fDM(late.due_at) + '. Aún puedes terminarla.</span></div>' : '';
    const seg = '<div class="seg2" role="group" aria-label="Filtrar capacitaciones"><button data-a="homeTab" data-v="curso" aria-pressed="' + (tab === 'curso') + '">En curso</button><button data-a="homeTab" data-v="hechas" aria-pressed="' + (tab === 'hechas') + '">Completadas</button></div>';

    if (tab === 'hechas') {
      const certs = S.data.certs;
      const list = !certs ? '<div class="center" style="padding:24px"><div class="spin"></div></div>'
        : certs.length ? certs.map((ct) => '<button class="certitem" data-a="viewCert" data-id="' + ct.id + '"><span class="circ" style="width:44px;height:44px">' + icon('award', 22) + '</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-weight:600">' + esc(ct.route_title) + '</span><span class="xs muted">Vigente hasta ' + fNum(ct.expires_at) + '</span></span>' + icon('chev', 20) + '</button>').join('')
        : '<p class="muted small" style="text-align:center;padding:16px 0">Aún no completas ninguna capacitación.</p>';
      return brandBar() + '<main class="scr">' + head + soonBanner + seg + '<section class="stack">' + list + '</section></main>' + tabs('inicio');
    }
    if (!h.assignments.length) {
      return brandBar() + '<main class="scr">' + head + soonBanner + seg +
        '<div class="empty">' + icon('inbox', 44) + '<p class="h2">No tienes capacitaciones pendientes</p><p class="muted small">Cuando tu empresa te asigne una, aparecerá aquí.</p></div>' +
        '<button class="btn btn-primary" data-a="go" data-to="certificados">' + icon('award', 20) + 'Ver mis certificados</button></main>' + tabs('inicio');
    }
    const nx = h.next; const main = nx ? h.assignments.find((a) => a.id === nx.assignment_id) : null;
    let hero = '';
    if (nx && main) {
      let media;
      if (nx.type === 'lesson') {
        const L = nx.lesson; const ls = S.data.lesson;
        const poster = ls && ls.media.poster ? ls.media.poster.url : '';
        media = '<div class="heroc-m"' + (poster ? ' style="background-image:url(\'' + esc(poster) + '\')"' : ' style="background:var(--principal)"') + '><span class="chip" style="position:absolute;left:12px;top:12px">Nivel ' + L.level_position + ' de ' + L.level_count + ' · ' + fmtLabel(L.format) + '</span>' +
          '<div class="heroc-in"><div class="stats"><div class="stat"><b>' + fClock(L.duration_s) + '</b><small>Video</small></div><div class="stat"><b>' + (ls ? ls.quiz.length : '—') + '</b><small>Preguntas</small></div><div class="stat"><b>' + main.remaining_minutes + ' min</b><small>Para terminar</small></div></div>' +
          '<button class="cta" data-a="openLesson" data-id="' + L.id + '"><span class="knob">' + icon('play', 18) + '</span><span id="nextT">Continuar: ' + esc(L.title) + '</span></button></div></div>';
      } else {
        media = '<div class="panel"><p class="h2" id="nextT">Evaluación final · ' + nx.question_count + ' preguntas</p><button class="cta" data-a="go" data-to="evaluacion/' + main.id + '"><span class="knob">' + icon('chev', 20) + '</span>Ir a la evaluación</button></div>';
      }
      hero = '<section class="heroc glass" aria-labelledby="nextT"><button class="heroc-h" data-a="go" data-to="ruta/' + main.id + '" style="background:none;border:0;width:100%;text-align:left;color:inherit">' +
        '<span class="circ" style="width:44px;height:44px">' + icon('route', 20) + '</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">' +
        '<span style="font-weight:600;font-size:16px;line-height:1.25">' + esc(main.route_title) + '</span><span class="xs muted">' + dueText(main) + '</span>' +
        (main.kind === 'renewal' ? '<span>' + pill('av', 'Renovación de tu certificado') + '</span>' : '') + '</span>' + ring(main.pct) + '</button>' + media + '</section>';
    }
    const rows = h.assignments.filter((a) => a !== main).map((a) => '<button class="routeitem" data-a="go" data-to="ruta/' + a.id + '" style="flex-direction:row;align-items:center;gap:12px;padding:12px 14px">' + ring(a.pct) +
      '<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-weight:600;font-size:16px;line-height:1.25">' + esc(a.route_title) + '</span><span class="xs muted">' + dueText(a) + '</span></span>' + icon('chev', 20) + '</button>').join('');
    return brandBar() + '<main class="scr">' + head + lateBanner + soonBanner + seg + hero + (rows ? '<section class="stack" aria-label="Tus capacitaciones">' + rows + '</section>' : '') + '</main>' + tabs('inicio');
  }
};

/* Ruta: mapa o lista de niveles */
const LV_STATE = { done: 'done', in_progress: 'cur', available: 'av', locked: 'lock' };
SCREENS.ruta = {
  async load(p) { const a = await api('/assignments/' + p.id); setRouteTitle(a.route.title); return { a }; },
  view() {
    const a = S.data.a; const view = S.routeView;
    const head = '<div class="row" style="justify-content:space-between"><button class="circ" data-a="go" data-to="inicio" aria-label="Volver a Inicio">' + icon('back', 22) + '</button>' +
      '<p style="font-weight:600;text-align:center;flex:1;min-width:0">' + esc(a.route.title) + '</p><span style="width:48px"></span></div>';
    const seg = '<div class="seg2" role="group" aria-label="Vista de la ruta"><button data-a="routeView" data-v="mapa" aria-pressed="' + (view === 'mapa') + '">Mapa</button><button data-a="routeView" data-v="lista" aria-pressed="' + (view === 'lista') + '">Lista</button></div>';
    return brandBar() + '<main class="scr">' + head + seg + (view === 'mapa' ? routeMap(a) : routeList(a)) + '</main>' + tabs('inicio');
  }
};
function routeCta(a) {
  if (a.exam.state === 'passed') return '<button class="btn btn-sec" data-a="go" data-to="certificados">' + icon('award', 20) + 'Ver mi certificado</button>';
  if (a.next_lesson) return '<button class="btn btn-primary" data-a="openLesson" data-id="' + a.next_lesson.id + '">Continuar nivel ' + a.next_lesson.level_position + '</button>';
  return '<button class="btn btn-primary" data-a="go" data-to="evaluacion/' + a.id + '">Ir a la evaluación final</button>';
}
function levelLesson(lv) { return lv.lessons.find((l) => !l.completed) || lv.lessons[0]; }
function routeMap(a) {
  const lv = a.levels; const n = lv.length + 1;
  const all = lv.map((x) => LV_STATE[x.state] || 'lock').concat([a.exam.state === 'passed' ? 'done' : a.exam.state === 'available' ? 'av' : 'lock']);
  const W = 360, H = 56 + n * 74, xs = [74, 236, 110, 272, 150, 290];
  const pts = all.map((_, i) => ({ x: xs[i % xs.length], y: H - 30 - i * ((H - 64) / (n - 1)) }));
  let cur = all.findIndex((x) => x !== 'done'); if (cur < 0) cur = n - 1;
  const seg = (p, q) => 'M' + p.x + ' ' + p.y + ' C' + p.x + ' ' + (p.y - 40) + ' ' + q.x + ' ' + (q.y + 40) + ' ' + q.x + ' ' + q.y;
  let solid = '', dashed = '';
  for (let i = 0; i < n - 1; i++) { if (i < cur) solid += seg(pts[i], pts[i + 1]) + ' '; else dashed += seg(pts[i], pts[i + 1]) + ' '; }
  const contours = [[0.62, 0.5, 250, 200, -16], [0.6, 0.5, 190, 150, -12], [0.58, 0.48, 130, 102, -8], [0.56, 0.47, 74, 56, -4], [0.8, 0.18, 120, 64, 18], [0.8, 0.18, 66, 34, 18]]
    .map(([cx, cy, rx, ry, rot]) => '<ellipse cx="' + (cx * W) + '" cy="' + (cy * H) + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + rot + ' ' + (cx * W) + ' ' + (cy * H) + ')"/>').join('');
  const nodes = all.map((st, i) => {
    const P0 = pts[i]; const isExam = i === lv.length;
    const title = isExam ? 'Evaluación final' : (i + 1) + ' · ' + lv[i].title;
    const right = P0.x < 200; const tx = right ? P0.x + 22 : P0.x - 22; const anchor = right ? 'start' : 'end';
    const current = i === cur && st !== 'done';
    const act = st === 'lock' ? 'data-a="locked" data-lv="' + (isExam ? 'exam' : i) + '"'
      : isExam ? 'data-a="go" data-to="evaluacion/' + a.id + '"' : 'data-a="openLesson" data-id="' + levelLesson(lv[i]).id + '"';
    const dot = st === 'done' ? '<circle cx="' + P0.x + '" cy="' + P0.y + '" r="9" fill="var(--accent)"/>'
      : current ? '<circle cx="' + P0.x + '" cy="' + P0.y + '" r="21" fill="var(--accent)" opacity=".2"/><circle cx="' + P0.x + '" cy="' + P0.y + '" r="11" fill="var(--accent)"/>'
      : '<circle cx="' + P0.x + '" cy="' + P0.y + '" r="8" fill="#0B0D09" stroke="' + (st === 'lock' ? 'rgba(244,246,238,.5)' : 'var(--accent)') + '" stroke-width="2"/>';
    const sub = current ? (st === 'av' ? 'Disponible' : 'En curso') : st === 'lock' ? 'Bloqueado' : '';
    return dot + '<text class="lbl' + (current ? ' a' : st === 'lock' ? ' m' : '') + '" x="' + tx + '" y="' + (P0.y + (sub ? -2 : 4)) + '" text-anchor="' + anchor + '">' + esc(title) + '</text>' +
      (sub ? '<text class="lbl m" x="' + tx + '" y="' + (P0.y + 14) + '" text-anchor="' + anchor + '">' + sub + '</text>' : '') +
      '<circle class="hit" cx="' + P0.x + '" cy="' + P0.y + '" r="24" fill="transparent" ' + act + ' role="button" tabindex="0" aria-label="' + esc(title + (sub ? ', ' + sub : '')) + '"/>';
  }).join('');
  const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-label="Mapa de la ruta">' +
    '<g fill="none" stroke="color-mix(in srgb, var(--accent) 12%, transparent)" stroke-width="1.2">' + contours + '</g>' +
    (solid ? '<path d="' + solid + '" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" style="filter:drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 70%, transparent))"/>' : '') +
    (dashed ? '<path d="' + dashed + '" fill="none" stroke="rgba(244,246,238,.35)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>' : '') + nodes + '</svg>';
  const passed = a.exam.state === 'passed';
  const curLv = cur < lv.length ? lv[cur] : null;
  const total = lv.reduce((s, x) => s + x.lessons.length, 0) + 1;
  const units = lv.reduce((s, x) => s + x.lessons.filter((l) => l.completed).length, 0) + (passed ? 1 : 0);
  const label = passed ? 'Ruta completada' : curLv ? 'Nivel ' + (cur + 1) + ' de ' + lv.length + ' · ' + (all[cur] === 'av' ? 'Disponible' : 'En curso') : 'Último paso';
  const panel = '<div class="panel glass"><div class="row" style="justify-content:space-between;align-items:flex-end"><div style="min-width:0"><p class="xs muted">' + label + '</p>' +
    '<p style="font-size:21px;font-weight:600;line-height:1.2">' + esc(passed ? 'Aprobaste la ruta' : curLv ? curLv.title : 'Evaluación final') + '</p></div>' +
    '<p class="num" style="font-size:58px">' + a.pct + '<span style="font-size:20px;color:var(--muted);letter-spacing:0">%</span></p></div>' +
    '<div class="stats"><div class="stat"><b>' + units + '/' + total + '</b><small>Completado</small></div><div class="stat"><b>' + a.remaining_minutes + ' min</b><small>Restante</small></div>' +
    '<div class="stat"><b' + (a.late ? ' style="color:var(--rep)"' : '') + '>' + fDM(a.due_at) + '</b><small>' + (a.late ? 'Venció' : 'Vence') + '</small></div></div>' + routeCta(a) + '</div>';
  return '<div class="map">' + svg + '</div>' + panel;
}
function nodeRow(st, tag, title, trail, extra, idx) {
  const dot = st === 'done' ? '<div class="dot done">' + icon('check', 22) + '</div>' :
    st === 'cur' ? '<div class="dot cur"><span>' + icon('play', 16) + '</span></div>' :
    st === 'av' ? '<div class="dot av">' + (idx || '') + '</div>' : '<div class="dot lock">' + icon('lock', 18) + '</div>';
  return '<div class="node"><div class="rail">' + dot + (trail ? '<div class="trail' + (st === 'done' ? ' done' : '') + '"></div>' : '') + '</div>' +
    '<div class="ncontent"><span class="xs muted">' + esc(tag) + '</span><span style="font-size:17px;font-weight:600;line-height:1.25">' + esc(title) + '</span>' + extra + '</div></div>';
}
function levelPill(st) {
  return st === 'done' ? pill('ok', 'Completado', 'check') : st === 'cur' ? pill('cur', 'En curso', 'play') : st === 'av' ? pill('av', 'Disponible') : pill('lock', 'Bloqueado', 'lock');
}
function routeList(a) {
  const levels = a.levels.map((lv, i) => {
    const s = LV_STATE[lv.state] || 'lock';
    let extra = '<div>' + levelPill(s) + '</div>';
    if (s === 'lock') {
      extra = '<button class="lockbtn" data-a="locked" data-lv="' + i + '">' + pill('lock', 'Bloqueado · Completa el Nivel ' + i, 'lock') + '<span class="xs muted">' + plural(lv.lessons.length, 'lección', 'lecciones') + '</span></button>';
    } else {
      extra += lv.lessons.map((l) => '<button class="lessonbtn" data-a="openLesson" data-id="' + l.id + '">' + (l.completed ? '<span style="color:var(--ok)">' + icon('check', 20) + '</span>' : icon('play', 20)) +
        '<span class="t">' + esc(l.title) + '<span class="xs muted" style="display:block;font-weight:400">' + fmtLabel(l.format) + ' · ' + fClock(l.duration_s) + (l.completed ? ' · Completada' : '') + '</span></span>' + icon('chev', 20) + '</button>').join('');
    }
    return nodeRow(s, 'Nivel ' + (i + 1) + ' de ' + a.levels.length, lv.title, true, extra, i + 1);
  }).join('');
  const ex = a.exam;
  const examSt = ex.state === 'passed' ? 'done' : ex.state === 'available' ? 'av' : 'lock';
  const examExtra = ex.state === 'passed' ? '<div>' + pill('ok', 'Aprobada', 'check') + '</div>' :
    ex.state === 'available' ? '<div>' + pill('av', 'Disponible') + '</div><button class="lessonbtn" data-a="go" data-to="evaluacion/' + a.id + '">' + icon('doc', 20) + '<span class="t">Ver reglas y empezar<span class="xs muted" style="display:block;font-weight:400">' + ex.question_count + ' preguntas · ' + ex.minutes + ' min</span></span>' + icon('chev', 20) + '</button>' :
    '<button class="lockbtn" data-a="locked" data-lv="exam">' + pill('lock', 'Bloqueado · Completa los niveles', 'lock') + '<span class="xs muted">' + ex.question_count + ' preguntas · ' + ex.minutes + ' min</span></button>';
  return '<div class="stack-s"><div class="bar" role="progressbar" aria-label="Avance de la ruta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + a.pct + '"><i style="width:' + a.pct + '%"></i></div>' +
    '<p class="small muted"><b style="color:var(--fg)">' + a.pct + ' %</b> · ' + dueText(a) + ' · ' + a.remaining_minutes + ' min aprox.</p></div>' +
    '<div class="path">' + levels + nodeRow(examSt, 'Final', 'Evaluación final', false, examExtra, '') + '</div>' + routeCta(a);
}

/* Lección inmersiva */
SCREENS.leccion = {
  full: true,
  async load(p) { return { l: await api('/lessons/' + p.id) }; },
  init() {
    const l = S.data.l;
    S.video = { phase: 'idle', speed: 1, seekTo: S.params.t != null ? +S.params.t : (l.progress.video_position_s || 0), watched: l.progress.watched || l.progress.completed, lastSent: l.progress.video_position_s || 0 };
  },
  view() {
    const L = S.data.l; const v = S.video;
    const dur = lessonDur(L); const pos = v.pos != null ? v.pos : v.seekTo || 0;
    const pct = Math.min(100, (pos / dur) * 100);
    let overlay = '';
    if (v.phase === 'idle' || v.phase === 'paused' || v.phase === 'ended') {
      overlay = '<button class="vplay" data-a="play" aria-label="' + (v.phase === 'ended' ? 'Ver de nuevo' : pos > 0 ? 'Retomar video' : 'Reproducir video') + '">' + icon(v.phase === 'ended' ? 'redo' : 'play', 32) + '</button>';
    } else if (v.phase === 'loading') {
      overlay = '<div class="vmsg" role="status">' + orb(72) + '<span>Preparando el video…</span></div>';
    } else if (v.phase === 'error') {
      overlay = '<div class="vmsg" role="alert">' + icon('info', 28) + '<span style="font-weight:600">El video no se pudo reproducir.</span><div class="row" style="flex-wrap:wrap;justify-content:center"><button class="chip" data-a="play">' + icon('redo', 18) + 'Volver a intentar</button><button class="chip" data-a="readSummary">' + icon('doc', 18) + 'Leer el resumen</button></div></div>';
    } else if (v.phase === 'playing') {
      overlay = '<button class="vtouch" data-a="pause" aria-label="Pausar video"></button>';
    }
    const segs = Array.from({ length: L.level.count }, (_, i) => {
      const p = i + 1;
      if (p < L.level.position) return '<i class="on"></i>';
      if (p === L.level.position) return L.progress.completed ? '<i class="on"></i>' : '<i style="background:linear-gradient(90deg,var(--fg) ' + pct + '%,rgba(255,255,255,.25) ' + pct + '%)"></i>';
      return '<i></i>';
    }).join('');
    const speed = String(v.speed).replace('.', ',');
    const can = v.watched;
    return '<div class="lx" id="vbox"><div class="vslot" id="vslot"></div><div class="lx-shade"></div>' + overlay +
      '<div class="lx-top"><button class="circ" data-a="exitLesson" aria-label="Salir de la lección">' + icon('x', 22) + '</button>' +
      '<span class="chip" style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:40px">Nivel ' + L.level.position + ' de ' + L.level.count + '</span>' +
      '<button class="circ" data-a="speed" aria-label="Velocidad ' + speed + ' por" style="font-size:13px;font-weight:600">' + speed + '×</button></div>' +
      '<div class="lx-segs" aria-hidden="true">' + segs + '</div>' +
      '<div class="lx-side"><button class="circ" data-a="fullscreen" aria-label="Pantalla completa">' + icon('expand', 20) + '</button>' +
      '<button class="circ" data-a="readSummary" aria-label="Resumen de la lección">' + icon('doc', 20) + '</button>' +
      (L.resources && L.resources.length ? '<button class="circ" data-a="resources" aria-label="Material de apoyo">' + icon('clip', 20) + '</button>' : '') +
      '<button class="circ" data-a="report" aria-label="Reportar un problema con este contenido">' + icon('flag', 20) + '</button></div>' +
      '<div class="lx-panel"><div style="min-width:0"><div class="row" style="gap:14px;flex-wrap:wrap">' + (L.ai_generated ? '<button class="ailabel" data-a="aiInfo" style="min-height:30px;white-space:nowrap">' + icon('info', 14) + 'Hecho con IA</button>' : '') +
      (L.resources && L.resources.length ? '<button class="ailabel" data-a="resources" style="min-height:30px;white-space:nowrap;color:var(--accent)">' + icon('clip', 14) + 'Material de apoyo · ' + L.resources.length + '</button>' : '') + '</div>' +
      '<h1 style="font-size:22px;font-weight:600;line-height:1.2">' + esc(L.title) + '</h1></div>' +
      '<div class="row" style="gap:12px"><div class="bar" style="flex:1"><i id="vbar" style="width:' + pct + '%"></i></div><p class="num" style="white-space:nowrap;font-size:22px"><span id="vtime" style="font-size:inherit">' + fClock(pos) + ' / ' + fClock(dur) + '</span></p></div>' +
      (can ? '<button class="cta" data-a="startQuiz"><span class="knob">' + icon('chev', 20) + '</span>Hacer el reto · ' + plural(L.quiz.length, 'pregunta', 'preguntas') + '</button>'
        : '<button class="cta" disabled><span class="knob">' + icon('lock', 18) + '</span>Mira el video para hacer el reto</button><button class="link" data-a="seen" style="align-self:center;min-height:40px">Ya lo vi</button>') +
      '</div></div>';
  }
};

/* Reto: cada respuesta se verifica en el servidor */
SCREENS.reto = {
  async load(p) {
    if (S.quiz && S.quiz.lesson.id === p.id) return { l: S.quiz.lesson };
    const l = await api('/lessons/' + p.id);
    S.quiz = { lesson: l, idx: 0, sel: null, checked: null, answers: [], checks: [] };
    return { l };
  },
  view() {
    const qz = S.quiz; const L = qz.lesson; const q = L.quiz[qz.idx]; const c = qz.checked;
    const opts = q.options.map((o, i) => {
      let cls = 'opt', tag = '';
      if (c) {
        if (i === c.correct_index) { cls += ' right'; tag = '<span class="tag">' + icon('check', 16) + 'Respuesta correcta</span>'; }
        else if (i === qz.sel) { cls += ' wrong'; tag = '<span class="tag">' + icon('redo', 16) + 'Tu respuesta</span>'; }
      }
      return '<button class="' + cls + '" role="radio" aria-checked="' + (qz.sel === i) + '" data-a="pick" data-i="' + i + '"' + (c || qz.busy ? ' disabled' : '') + '><span class="rad"></span><span style="flex:1">' + esc(o) + tag + '</span></button>';
    }).join('');
    let fb = '';
    if (c) {
      fb = '<div class="fb ' + (c.correct ? 'ok' : 'rep') + '" role="status"><span class="h">' + icon(c.correct ? 'check' : 'redo', 22) + (c.correct ? 'Correcto' : 'Repasemos') + '</span><p>' + esc(c.why) + '</p>' +
        (c.correct ? '' : '<button class="link" data-a="seekVideo" data-t="' + c.video_t + '">' + icon('play', 18) + 'Ver ese momento del video (' + fClock(c.video_t) + ')</button>') + '</div>';
    }
    const last = qz.idx === L.quiz.length - 1;
    return topBar('Reto · ' + L.title, ((qz.idx + (c ? 1 : 0)) / L.quiz.length) * 100, 'toLesson') +
      '<main class="scr"><p class="over">Pregunta ' + (qz.idx + 1) + ' de ' + L.quiz.length + '</p><h1 class="q">' + esc(q.prompt) + '</h1>' +
      '<div class="opts" role="radiogroup" aria-label="Opciones">' + opts + '</div>' + errLine(qz.msg) +
      '<button class="link" data-a="report">' + icon('flag', 18) + 'Reportar un problema con este contenido</button></main>' +
      '<div class="dock' + (c ? ' fbdock' : '') + '">' + fb + (c
        ? '<button class="btn btn-primary" data-a="nextQ"' + (qz.busy ? ' disabled' : '') + '>' + (qz.busy ? 'Guardando…' : last ? 'Terminar el reto' : 'Siguiente') + '</button>'
        : '<button class="btn btn-primary" data-a="checkQ"' + (qz.sel == null || qz.busy ? ' disabled' : '') + '>' + (qz.busy ? 'Comprobando…' : 'Comprobar') + '</button>') + '</div>';
  }
};

/* Lección completada */
SCREENS.hecho = {
  view() {
    const d = S.done;
    if (!d) return errorHtml({ message: 'No encontramos el resultado del reto.' });
    const L = d.lesson; const as = d.assignment || {};
    const wrong = L.quiz.map((q, i) => ({ q, c: d.checks[i] })).filter((x) => x.c && !x.c.correct);
    return topBar('Lección completada', as.pct, 'toRoute') + '<main class="scr">' +
      '<div class="row" style="gap:14px"><div class="seal">' + icon('check', 32) + '</div><div class="stack-s" style="gap:2px"><p class="over">Nivel ' + L.level.position + ' · Lección completada</p><h1 class="title" style="font-size:24px">' + titleSplit(L.title) + '</h1></div></div>' +
      '<div class="block"><span class="score"><span class="big">' + d.correct + '</span><span class="muted">de ' + d.total + ' correctas</span></span>' +
      (as.pct != null ? '<div class="stack-s"><div class="bar"><i style="width:' + as.pct + '%"></i></div><span class="small muted">Tu ruta va en <b style="color:var(--fg)">' + as.pct + ' %</b></span></div>' : '') + '</div>' +
      (wrong.length ? '<section class="stack"><h2 class="h2">Para repasar</h2>' + wrong.map((w) => '<div class="fb rep"><span class="h" style="font-size:16px">' + icon('redo', 20) + esc(w.q.prompt) + '</span><p>' + esc(w.c.why) + '</p><button class="link" data-a="seekVideo" data-t="' + w.c.video_t + '">' + icon('play', 18) + 'Ver en el video (' + fClock(w.c.video_t) + ')</button></div>').join('') + '</section>'
        : '<div class="fb ok"><span class="h">' + icon('check', 22) + 'Respondiste todo bien</span><p>Ya puedes seguir con la siguiente lección.</p></div>') +
      (L.resources && L.resources.length ? '<section class="stack"><h2 class="h2">Material de apoyo</h2>' + resourcesList(L.resources) + '</section>' : '') +
      '</main><div class="dock">' + (as.next_lesson ? '<button class="btn btn-primary" data-a="openLesson" data-id="' + as.next_lesson.id + '">Siguiente lección: ' + esc(as.next_lesson.title) + '</button>'
        : as.exam_available ? '<button class="btn btn-primary" data-a="go" data-to="evaluacion/' + L.assignment_id + '">Ir a la evaluación final</button>'
        : '<button class="btn btn-primary" data-a="go" data-to="ruta/' + L.assignment_id + '">Volver a la ruta</button>') +
      '<button class="btn btn-sec" data-a="startQuiz" data-id="' + L.id + '">' + icon('redo', 20) + 'Repetir el reto</button></div>';
  }
};

/* Evaluación: reglas */
SCREENS.evaluacion = {
  async load(p) {
    const [info, a] = await Promise.all([api('/assignments/' + p.id + '/exam'), api('/assignments/' + p.id)]);
    setRouteTitle(a.route.title);
    return { info, a };
  },
  view() {
    const info = S.data.info; const r = info.rules; const a = S.data.a;
    const waitTxt = r.wait_minutes ? (r.wait_minutes === 60 ? '1 hora' : r.wait_minutes % 60 === 0 ? (r.wait_minutes / 60) + ' horas' : r.wait_minutes + ' min') : 'Sin espera';
    const reasons = {
      LESSONS_INCOMPLETE: 'Primero completa todos los niveles de la ruta.',
      ATTEMPTS_EXHAUSTED: 'Usaste tus ' + r.attempts + ' intentos. ' + r.exhausted_message,
      RETRY_AFTER: info.retry_at ? 'Podrás reintentar a las ' + fHM(info.retry_at) + (fNum(info.retry_at) !== fNum(new Date().toISOString()) ? ' del ' + fShort(info.retry_at) : '') + '.' : 'Aún no puedes reintentar.',
      ALREADY_PASSED: 'Ya aprobaste esta evaluación.'
    };
    const reason = info.blocked_reason ? reasons[info.blocked_reason] || '' : '';
    return topBar('Evaluación final · ' + a.route.title, 0, 'toRoute') + '<main class="scr">' +
      '<div class="stack-s"><p class="over">Antes de empezar</p><h1 class="title">Reglas de la <b>evaluación</b></h1></div>' +
      '<div class="rules">' +
        '<div class="rule">' + icon('target', 24) + '<span class="big">' + r.min_score + ' %</span><span class="small">Apruebas con ' + r.min_score + ' % o más</span></div>' +
        '<div class="rule">' + icon('redo', 24) + '<span class="big">' + info.attempts_left + ' de ' + r.attempts + '</span><span class="small">Intentos que te quedan</span></div>' +
        '<div class="rule">' + icon('clock', 24) + '<span class="big">' + waitTxt + '</span><span class="small">' + (r.wait_minutes ? 'Si no apruebas, esperas ' + waitTxt + ' para reintentar' : 'Si no apruebas, puedes reintentar enseguida') + '</span></div>' +
        '<div class="rule">' + icon('timer', 24) + '<span class="big">' + r.minutes + ' min</span><span class="small">' + r.question_count + ' preguntas</span></div>' +
      '</div>' +
      '<div class="banner info">' + icon('wifioff', 20) + '<span><b>Necesitas señal durante toda la evaluación.</b> Si se va, tus respuestas se guardan y el tiempo se pausa unos minutos.</span></div>' +
      '<div class="stack-s small"><p>' + inl('info') + 'Si se acaba el tiempo, se envía lo que respondiste.</p><p>' + inl('back') + 'Puedes volver a una pregunta antes de enviar.</p></div>' +
      (info.blocked_reason === 'ATTEMPTS_EXHAUSTED' ? '<div class="banner rep" role="status">' + icon('info', 20) + '<span>' + esc(reason) + '</span></div>' : '') +
      errLine(S.form.msg) +
      '</main><div class="dock"><button class="btn btn-primary" data-a="startExam"' + (!info.can_start || S.form.busy ? ' disabled' : '') + '>' + (S.form.busy ? 'Preparando…' : info.in_progress_attempt_id ? 'Continuar evaluación' : 'Empezar evaluación') + '</button>' +
      (reason && info.blocked_reason !== 'ATTEMPTS_EXHAUSTED' ? '<p class="reason" role="status">' + esc(reason) + '</p>' : '') + '</div>';
  }
};

/* Evaluación: preguntas. El reloj lo manda el servidor; aquí solo se muestra. */
function loadAttempt(at) {
  S.ex = { attempt: at, idx: S.ex && S.ex.attempt.id === at.id ? S.ex.idx : 0, answers: Object.assign({}, at.answers), pending: {},
    remaining: at.remaining_s, syncedAt: Date.now(), lastBeat: Date.now(), submitting: false, lost: false };
}
async function ensureAttempt(id) {
  if (!S.ex || S.ex.attempt.id !== id) {
    const at = await api('/attempts/' + id);
    if (at.status !== 'in_progress') throw new ApiErr('Esta evaluación ya terminó.', 'ATTEMPT_CLOSED', 409);
    loadAttempt(at);
  }
  return {};
}
function setRouteTitle(t) { S.routeTitle = t; store.set('nivia.routeTitle', t); }
function remainingNow() { const ex = S.ex; return Math.max(0, ex.remaining - (ex.lost ? 0 : (Date.now() - ex.syncedAt) / 1000)); }
function lostBanner() {
  return S.ex && S.ex.lost ? '<div class="scr" style="flex:0;padding-bottom:0"><div class="banner rep" role="alert">' + icon('wifioff', 20) + '<div class="stack-s" style="flex:1"><span>Se perdió la señal. Tus respuestas están guardadas y el tiempo está en pausa.</span><button class="chip" data-a="reconnect" style="align-self:flex-start">' + icon('redo', 18) + 'Reintentar</button></div></div></div>' : '';
}
SCREENS.intento = {
  full: true,
  async load(p) { return ensureAttempt(p.id); },
  view() {
    const ex = S.ex; const qs = ex.attempt.questions; const q = qs[ex.idx];
    const un = qs.filter((x) => ex.answers[x.id] == null).length;
    const last = ex.idx === qs.length - 1;
    return topBar('Evaluación final', ((qs.length - un) / qs.length) * 100, 'exitExam') + lostBanner() +
      '<main class="scr"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><p class="over">Pregunta ' + (ex.idx + 1) + ' de ' + qs.length + '</p><span class="time" style="font-size:15px">' + inl('timer') + '<span id="etimer">' + fClock(remainingNow()) + '</span> restantes</span></div>' +
      '<p class="small muted">Te faltan ' + un + ' por responder</p>' +
      '<h1 class="q">' + esc(q.prompt) + '</h1><div class="opts" role="radiogroup" aria-label="Opciones">' +
      q.options.map((o, i) => '<button class="opt" role="radio" aria-checked="' + (ex.answers[q.id] === i) + '" data-a="answer" data-i="' + i + '"><span class="rad"></span><span style="flex:1">' + esc(o) + '</span></button>').join('') + '</div></main>' +
      '<div class="dock"><div class="row"><button class="btn btn-sec" style="flex:1" data-a="prevQ"' + (ex.idx === 0 ? ' disabled' : '') + '>' + icon('back', 20) + 'Anterior</button>' +
      '<button class="btn btn-primary" style="flex:1.4" data-a="' + (last ? 'review' : 'nextE') + '">' + (last ? 'Revisar respuestas' : 'Siguiente') + '</button></div></div>';
  }
};
SCREENS.revisar = {
  full: true,
  async load(p) { return ensureAttempt(p.id); },
  view() {
    const ex = S.ex; const qs = ex.attempt.questions;
    const un = qs.filter((x) => ex.answers[x.id] == null).length;
    const pend = Object.keys(ex.pending).length;
    return topBar('Revisar respuestas', ((qs.length - un) / qs.length) * 100, 'backExam') + lostBanner() + '<main class="scr">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:wrap"><p class="over">Antes de enviar</p><span class="time" style="font-size:15px">' + inl('timer') + '<span id="etimer">' + fClock(remainingNow()) + '</span></span></div>' +
      '<h1 class="title">Revisa tus <b>respuestas</b></h1>' +
      (un ? '<div class="banner rep" role="status">' + icon('info', 20) + '<span>Tienes ' + plural(un, 'pregunta', 'preguntas') + ' sin responder. Tócala para responderla.</span></div>' : '<div class="banner info">' + icon('check', 20) + '<span>Respondiste todas las preguntas.</span></div>') +
      '<div class="qlist">' + qs.map((x, i) => '<button class="qitem" data-a="gotoQ" data-i="' + i + '"><span class="n">' + (i + 1) + '</span><span class="t">' + esc(x.prompt) + '</span>' + (ex.answers[x.id] != null ? pill('ok', 'Respondida', 'check') : pill('rep', 'Sin responder', 'info')) + '</button>').join('') + '</div>' +
      errLine(S.form.msg) +
      '</main><div class="dock"><button class="btn btn-primary" data-a="submitExam"' + (ex.submitting || ex.lost || pend ? ' disabled' : '') + '>' + (ex.submitting ? 'Enviando…' : un ? 'Enviar de todas formas' : 'Enviar evaluación') + '</button>' +
      (ex.lost || pend ? '<p class="reason">' + (ex.lost ? 'Sin señal no se puede enviar. Tus respuestas están guardadas.' : 'Guardando tus últimas respuestas…') + '</p>' : '') + '</div>';
  }
};

/* Resultado */
SCREENS.resultado = {
  full: true,
  view() {
    const res = S.result;
    if (!res) return errorHtml({ message: 'No encontramos el resultado. Revisa tu ruta.' });
    const title = S.routeTitle || 'Evaluación final';
    if (res.passed) {
      return topBar('Resultado', 100, 'toHome') + '<main class="scr" style="text-align:center;align-items:center">' + orb(200) +
        '<div class="stack-s"><p class="over">' + esc(title) + '</p><h1 class="title" style="font-size:34px">¡<b>Aprobaste</b>!</h1></div>' +
        '<span class="score" style="justify-content:center"><span class="big">' + res.score + ' %</span><span class="muted">mínimo ' + res.min_score + ' %</span></span>' +
        '<p class="muted">Tu certificado está listo. Puedes verlo y descargarlo cuando quieras.</p></main>' +
        '<div class="dock">' + (res.certificate ? '<button class="btn btn-primary" data-a="viewCert" data-id="' + res.certificate.id + '">' + icon('award', 20) + 'Ver mi certificado</button>' : '') + '<button class="btn btn-sec" data-a="go" data-to="inicio">Ir a Inicio</button></div>';
    }
    const topics = res.topics_to_review || [];
    let when;
    if (res.attempts_left <= 0) when = '<div class="banner rep">' + icon('info', 20) + '<span><b>Usaste todos tus intentos.</b> ' + esc(res.exhausted_message || '') + '</span></div>';
    else when = '<div class="block" style="gap:6px"><span class="row small">' + icon('redo', 20) + '<span>Te ' + (res.attempts_left === 1 ? 'queda 1 intento' : 'quedan ' + res.attempts_left + ' intentos') + '</span></span><span class="row small">' + icon('clock', 20) + '<span>' + (res.retry_at ? 'Podrás reintentar a las ' + fHM(res.retry_at) : 'Puedes reintentar cuando quieras') + '</span></span></div>';
    return topBar('Resultado', null, 'toHome') + '<main class="scr">' +
      '<div class="stack-s"><p class="over">' + esc(title) + '</p><h1 class="title">Esta vez <b>no alcanzó</b></h1></div>' +
      (res.closed_by_time ? '<div class="banner info">' + icon('timer', 20) + '<span>Se acabó el tiempo y enviamos lo que respondiste.</span></div>' : '') +
      '<span class="score"><span class="big">' + res.score + ' %</span><span class="muted">necesitas ' + res.min_score + ' %</span></span>' +
      '<section class="stack"><h2 class="h2">Temas a reforzar</h2>' + (topics.length ? topics.map((L) => '<button class="lessonbtn" data-a="openLesson" data-id="' + L.id + '"><span style="color:var(--rep)">' + icon('redo', 20) + '</span><span class="t">' + esc(L.title) + '<span class="xs muted" style="display:block;font-weight:400">Nivel ' + L.level_position + '</span></span>' + icon('chev', 20) + '</button>').join('') : '<p class="muted small">Repasa el resumen de cada lección.</p>') + '</section>' +
      when + '</main><div class="dock">' +
      (topics.length ? '<button class="btn btn-primary" data-a="openLesson" data-id="' + topics[0].id + '">Repasar: ' + esc(topics[0].title) + '</button>' : '') +
      '<button class="btn btn-sec" data-a="go" data-to="inicio">Ir a Inicio</button></div>';
  }
};

/* Certificados */
function certState(ct) {
  return ct.state === 'expired' ? pill('lock', 'Vencido', 'late') : ct.days_left <= 30 ? pill('rep', 'Vence en ' + plural(ct.days_left, 'día', 'días'), 'clock') : pill('ok', 'Vigente', 'check');
}
SCREENS.certificados = {
  async load() { return { list: (await api('/certificates')).certificates }; },
  view() {
    const list = S.data.list;
    const empty = '<div class="empty">' + icon('award', 44) + '<p class="h2">Aún no tienes certificados</p><p class="muted small">Aparecerán aquí cuando apruebes una evaluación.</p><button class="btn btn-primary" data-a="go" data-to="inicio">Ir a Inicio</button></div>';
    return brandBar() + '<main class="scr"><div class="stack-s"><p class="over">Tus logros</p><h1 class="title">Mis <b>certificados</b></h1></div>' +
      (list.length ? '<div class="stack">' + list.map((ct) => '<button class="certitem" data-a="viewCert" data-id="' + ct.id + '"><span class="ic-wrap">' + icon('award', 24) + '</span><span class="stack-s" style="flex:1;min-width:0;gap:4px"><span style="font-weight:600;line-height:1.25">' + esc(ct.route_title) + '</span><span class="xs muted">Emitido el ' + fNum(ct.issued_at) + ' · Vigente hasta ' + fNum(ct.expires_at) + '</span><span>' + certState(ct) + '</span></span>' + icon('chev', 20) + '</button>').join('') + '</div>' : empty) +
      '</main>' + tabs('certificados');
  }
};
SCREENS.certificado = {
  async load(p) { return { ct: await api('/certificates/' + p.id) }; },
  view() {
    const ct = S.data.ct; const b = S.cfg.branding;
    const logo = b.logo_url ? '<img src="' + esc(b.logo_url) + '" alt="' + esc(ct.company) + '" style="display:block;height:32px;width:auto">' : '<div class="row"><span class="mono">' + esc(b.mono) + '</span><span class="co">' + esc(ct.company) + '</span></div>';
    return brandBar() + '<main class="scr"><button class="link" data-a="go" data-to="certificados">' + icon('back', 20) + 'Mis certificados</button>' +
      '<div class="stack-s"><p class="over">Certificado</p><h1 class="title">' + titleSplit(ct.route_title) + '</h1></div>' +
      (ct.days_left >= 0 && ct.days_left <= 30 ? '<div class="banner info">' + icon('clock', 20) + '<span>Vence en ' + plural(ct.days_left, 'día', 'días') + ', el ' + fLong(ct.expires_at) + '.</span></div>' : '') +
      '<article class="cert" aria-label="Certificado"><div class="hd">' + logo + '<span class="kind">Certificado de capacitación interna</span></div>' +
      '<p style="font-size:14px;color:var(--ink2)">' + esc(ct.company) + ' certifica que</p><p class="name">' + esc(ct.holder) + '</p>' +
      '<p style="font-size:14px;line-height:1.5;color:#333333">aprobó la capacitación interna <b>«' + esc(ct.route_title) + '»</b>, definida por la empresa.</p>' +
      '<div class="grid"><div>Fecha<b>' + fNum(ct.issued_at) + '</b></div><div>Resultado<b>' + ct.score + ' %</b></div><div>Vigente hasta<b>' + fNum(ct.expires_at) + '</b></div><div>Código de verificación<b>' + esc(ct.code) + '</b></div></div>' +
      '<p class="foot">' + esc(ct.disclaimer) + '</p></article>' +
      '<div class="stack"><button class="btn btn-primary" data-a="downloadPdf"' + (S.form.busy ? ' disabled' : '') + '>' + icon('download', 20) + (S.form.busy ? 'Descargando…' : 'Descargar PDF') + '</button>' + errLine(S.form.msg) + '</div></main>' + tabs('certificados');
  }
};

/* Perfil */
SCREENS.perfil = {
  async load() { const me = await api('/me'); S.me = me; return { me }; },
  view() {
    const me = S.data.me;
    return brandBar() + '<main class="scr">' +
      '<div class="stack-s"><span class="over">Perfil</span><span class="title" style="font-weight:600">' + esc(me.first_name + ' ' + me.last_name) + '</span></div>' +
      '<dl class="dl"><div><dt>Correo</dt><dd>' + esc(me.email) + '</dd></div><div><dt>Google</dt><dd>' + (me.sign_in.google ? 'Vinculada' : 'No vinculada') + '</dd></div><div><dt>Empresa</dt><dd>' + esc(me.company) + '</dd></div><div><dt>Área</dt><dd>' + esc(me.area || 'Sin registrar') + '</dd></div></dl>' +
      '<button class="lessonbtn" data-a="go" data-to="contrasena">' + icon('key', 20) + '<span class="t">' + (me.sign_in.password ? 'Cambiar contraseña' : 'Crear contraseña') + '</span>' + icon('chev', 20) + '</button>' +
      '<button class="btn btn-sec" data-a="logout">Cerrar sesión</button>' +
      '<p class="xs muted" style="text-align:center;margin-top:auto">Con Nivia</p></main>' + tabs('perfil');
  }
};

/* ---------- Hojas ---------- */
function sheetHtml() {
  const sh = S.sheet; if (!sh) return '';
  let body = '';
  if (sh.type === 'locked') {
    if (sh.lv === 'exam') body = '<h2 class="h2">La evaluación aún está bloqueada</h2><p class="muted">Primero completa todos los niveles de la ruta.</p><button class="btn btn-primary" data-a="closeSheet">Entendido</button>';
    else {
      const lv = +sh.lv; const prev = S.data && S.data.a && S.data.a.levels[lv - 1];
      body = '<h2 class="h2">Primero completa el Nivel ' + lv + (prev ? ': ' + esc(prev.title) : '') + '</h2><p class="muted">Los niveles se abren en orden. Al terminar el Nivel ' + lv + ', se abre este.</p>' +
        (prev ? '<button class="btn btn-primary" data-a="openLesson" data-id="' + levelLesson(prev).id + '">Ir al Nivel ' + lv + '</button>' : '') + '<button class="btn btn-sec" data-a="closeSheet">Cerrar</button>';
    }
  } else if (sh.type === 'lessonLocked') {
    body = '<h2 class="h2">' + esc(sh.message) + '</h2><p class="muted">Los niveles se abren en orden.</p><button class="btn btn-primary" data-a="closeSheet">Entendido</button>';
  } else if (sh.type === 'report') {
    if (sh.sent) body = '<div class="empty" style="padding:16px 0"><div class="seal">' + icon('check', 30) + '</div><p class="h2">Gracias. Lo revisaremos.</p></div>';
    else {
      const opts = [['confusing_question', 'La pregunta es confusa'], ['content_error', 'Hay un error en el contenido'], ['video_unclear', 'El video no se entiende']];
      body = '<h2 class="h2">Reportar un problema</h2><p class="muted small">¿Qué pasó con este contenido?</p><div class="stack" role="radiogroup" aria-label="Motivo">' +
        opts.map((o) => '<button class="radio" role="radio" aria-checked="' + (sh.reason === o[0]) + '" data-a="reason" data-v="' + o[0] + '">' + (sh.reason === o[0] ? icon('check', 20) : icon('target', 20)) + esc(o[1]) + '</button>').join('') + '</div>' +
        '<div class="field"><label for="rcomment">Comentario (opcional)</label><textarea class="input" id="rcomment" maxlength="1000">' + esc(sh.comment || '') + '</textarea></div>' + errLine(sh.msg) +
        '<button class="btn btn-primary" data-a="sendReport"' + (!sh.reason || sh.busy ? ' disabled' : '') + '>Enviar reporte</button><button class="btn btn-sec" data-a="closeSheet">Cancelar</button>';
    }
  } else if (sh.type === 'exitExam') {
    body = '<h2 class="h2">¿Salir de la evaluación?</h2><p class="muted">Tus respuestas se guardan. El tiempo sigue corriendo.</p><button class="btn btn-primary" data-a="closeSheet">Seguir en la evaluación</button><button class="btn btn-sec" data-a="confirmExitExam">Salir</button>';
  } else if (sh.type === 'aiInfo') {
    body = '<h2 class="h2">Hecho con IA</h2><p class="muted">Este video se hizo con IA a partir del material de ' + esc(S.cfg.name) + ' y lo revisó la empresa.</p><button class="btn btn-primary" data-a="closeSheet">Entendido</button>';
  } else if (sh.type === 'resources') {
    const L = S.data.l;
    body = '<h2 class="h2">Material de apoyo</h2><p class="xs muted">' + esc(L.title) + '</p>' + resourcesList(L.resources) + '<button class="btn btn-sec" data-a="closeSheet">Cerrar</button>';
  } else if (sh.type === 'summary') {
    const L = S.data.l;
    body = '<h2 class="h2">Resumen de la lección</h2><p class="xs muted">' + esc(L.title) + '</p><ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;font-size:16px">' +
      L.summary.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul><button class="btn btn-primary" data-a="closeSheet">Entendido</button>';
  }
  return '<div class="scrim" data-a="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Detalle"><div class="grab"></div>' + body + '</div>';
}

/* ---------- Navegación ----------
 * Rutas en el hash (#/ruta/<id>) para que el botón Atrás del celular funcione. */
function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = {};
  if (qs) new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
  if (parts[1]) params.id = decodeURIComponent(parts[1]);
  return { name: parts[0] || (session() ? 'inicio' : 'ingresar'), params };
}
function nav(to, params) {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  const h = '#/' + to + q;
  if (location.hash === h) route(); else location.hash = h;
}
function toLogin(notice) { S.loginNotice = notice || null; nav('ingresar'); }

let loadSeq = 0;
async function route() {
  const { name, params } = parseHash();
  const screen = SCREENS[name] ? name : 'inicio';
  if (!PUBLIC.includes(screen) && !session()) { toLogin(); return; }
  if (screen === 'ingresar' && session()) { nav('inicio'); return; }
  leaveScreen();
  S.screen = screen; S.params = params; S.form = {}; S.sheet = null; S.error = null; S.data = null;
  if (screen === 'ingresar' && S.loginNotice) { S.form.notice = S.loginNotice; S.loginNotice = null; }
  const def = SCREENS[screen];
  const seq = ++loadSeq;
  if (def.load) {
    S.loading = true; render();
    try {
      const data = await def.load(params);
      if (seq !== loadSeq) return;
      S.data = data;
    } catch (e) {
      if (seq !== loadSeq) return;
      if (e.code === 'SESSION_EXPIRED' || e.code === 'PASSWORD_CHANGE_REQUIRED') return;
      if (e.code === 'LESSON_LOCKED') { S.loading = false; history.back(); setTimeout(() => { S.sheet = { type: 'lessonLocked', message: e.message }; render(); }, 60); return; }
      if (e.code === 'ATTEMPT_CLOSED') { S.loading = false; nav('inicio'); toast('Esa evaluación ya terminó.'); return; }
      S.error = e;
    }
    S.loading = false;
  }
  if (def.init && !S.error) def.init();
  render();
  window.scrollTo(0, 0);
}
function leaveScreen() {
  if (S.screen === 'leccion' && S.video) sendPosition(true);
  if (!VID.paused) VID.pause();
}

/* ---------- Pintado ---------- */
const VID = document.createElement('video');
VID.preload = 'metadata'; VID.playsInline = true;
VID.setAttribute('playsinline', ''); VID.setAttribute('aria-label', 'Video de la lección');
VID.addEventListener('playing', () => { if (S.screen === 'leccion' && S.video && S.video.phase === 'loading') { S.video.phase = 'playing'; render(); } });
VID.addEventListener('pause', () => { if (S.screen === 'leccion' && S.video && S.video.phase === 'playing') { S.video.phase = 'paused'; sendPosition(true); render(); } });
VID.addEventListener('ended', () => {
  if (S.screen !== 'leccion' || !S.video) return;
  S.video.phase = 'ended'; S.video.pos = lessonDur(S.data.l); markWatched(); sendPosition(true); render();
});
VID.addEventListener('error', () => { if (S.screen === 'leccion' && S.video && S.video.phase === 'loading') { S.video.phase = 'error'; render(); } });
VID.addEventListener('timeupdate', () => {
  if (S.screen !== 'leccion' || !S.video) return;
  const L = S.data.l; const d = lessonDur(L); const pos = Math.min(d, VID.currentTime || 0); S.video.pos = pos;
  const b = document.getElementById('vbar'); if (b) b.style.width = (pos / d * 100) + '%';
  const tm = document.getElementById('vtime'); if (tm) tm.textContent = fClock(pos) + ' / ' + fClock(d);
  if (pos - S.video.lastSent >= 15) sendPosition(false);
  // El video real puede durar distinto que lo declarado: al pasar el 95 %, se cuenta como visto.
  if (!S.video.watched && VID.duration && VID.currentTime / VID.duration > 0.95) { markWatched(); render(); }
});
/* La duración real del archivo manda; la declarada en la ruta solo sirve hasta que carga el video. */
function lessonDur(L) { return VID.dataset.lesson === L.id && isFinite(VID.duration) && VID.duration > 0 ? VID.duration : L.duration_s; }
VID.addEventListener('loadedmetadata', () => { if (S.screen === 'leccion' && S.data && S.data.l) { const tm = document.getElementById('vtime'); if (tm) tm.textContent = fClock(S.video.pos || 0) + ' / ' + fClock(lessonDur(S.data.l)); } });
function videoUrl(L) { const m = L.media || {}; return (m.mp4_offline || m.hls || {}).url || ''; }
function sendPosition(force) {
  const v = S.video; if (!v || !S.data || !S.data.l) return;
  const pos = Math.floor(v.pos || 0);
  if (pos <= v.lastSent && !force) return;
  if (pos <= 0 || pos === v.lastSent) return;
  v.lastSent = pos; queue('video.position', S.data.l.id, { position_s: pos });
}
function markWatched() {
  if (!S.video || S.video.watched) return;
  S.video.watched = true; queue('lesson.watched', S.data.l.id, {});
}
function attachVideo() {
  const slot = document.getElementById('vslot');
  if (!slot || !S.video || S.screen !== 'leccion' || !S.data) { if (!VID.paused) VID.pause(); return; }
  const L = S.data.l; const src = videoUrl(L);
  if (VID.dataset.lesson !== L.id) {
    VID.dataset.lesson = L.id; VID.src = src; VID.poster = L.media.poster ? L.media.poster.url : '';
  }
  if (VID.parentNode !== slot) slot.appendChild(VID);
  VID.playbackRate = S.video.speed;
  if (S.video.seekTo != null) {
    const t = Math.min(S.video.seekTo, Math.max(0, lessonDur(L) - 1)); S.video.seekTo = null; S.video.pos = t;
    if (VID.readyState >= 1) { try { VID.currentTime = t; } catch (e) { /* sin datos aún */ } }
    else VID.addEventListener('loadedmetadata', () => { try { VID.currentTime = Math.min(t, (VID.duration || t + 1) - 0.5); } catch (e) { /* sin datos aún */ } }, { once: true });
  }
  const want = S.video.phase === 'loading' || S.video.phase === 'playing';
  if (want) { const p = VID.play(); if (p && p.catch) p.catch(() => { if (S.video && S.video.phase === 'loading') { S.video.phase = 'paused'; render(); } }); }
  else if (!VID.paused) VID.pause();
}

function render() {
  applyTheme();
  const def = SCREENS[S.screen];
  let html;
  if (!S.cfg) html = '<div class="center"><div class="spin" role="status" aria-label="Cargando"></div></div>';
  else if (S.loading) html = (def && def.full ? '' : brandBar()) + loadingHtml();
  else if (S.error) html = brandBar() + errorHtml(S.error);
  else html = def.view();
  const net = '<div class="netbar" id="netbar" role="status"' + (S.netDown ? '' : ' hidden') + '>' + icon('wifioff', 18) + '<span>Sin conexión. Revisa tu señal.</span></div>';
  const toastHtml = S.toast && Date.now() < S.toastUntil ? '<div class="toast" role="status">' + icon('check', 18) + esc(S.toast) + '</div>' : '';
  const active = document.activeElement && document.activeElement.id;
  const sel = active && document.activeElement.selectionStart;
  document.getElementById('app').innerHTML = (S.screen === 'leccion' ? '' : net) + html + sheetHtml() + toastHtml;
  if (active) { const el = document.getElementById(active); if (el) { el.focus(); try { if (sel != null) el.setSelectionRange(sel, sel); } catch (e) { /* sin cursor */ } } }
  attachVideo();
  renderGoogle();
  if (S.cfg) document.title = S.cfg.name + ' · Capacitación';
  Orb.start();
}
function toast(msg, ms) { S.toast = msg; S.toastUntil = Date.now() + (ms || 2800); render(); }

/* ---------- Google ---------- */
let gisState = 'none';
function loadGoogle() {
  const id = S.cfg && S.cfg.sign_in && S.cfg.sign_in.google_client_id;
  if (!id || gisState !== 'none') return;
  gisState = 'loading';
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => {
    try {
      google.accounts.id.initialize({ client_id: id, callback: onGoogle, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true });
      gisState = 'ready'; renderGoogle();
    } catch (e) { gisState = 'failed'; }
  };
  s.onerror = () => { gisState = 'failed'; const el = document.getElementById('gbtn'); if (el) el.innerHTML = '<p class="reason">No se pudo cargar el ingreso con Google. Usa tu correo.</p>'; };
  document.head.appendChild(s);
}
function renderGoogle() {
  const el = document.getElementById('gbtn'); if (!el) return;
  loadGoogle();
  if (gisState !== 'ready' || el.childElementCount) return;
  const w = Math.min(400, Math.max(240, el.parentElement.clientWidth || 320));
  google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center', width: w, locale: 'es' });
}
async function onGoogle(resp) {
  S.form = { gErr: null }; render();
  try {
    const r = await api('/auth/google', { method: 'POST', body: { id_token: resp.credential, device_label: deviceLabel() }, auth: false });
    await enter(r);
  } catch (e) { S.form = { gErr: e.message }; render(); }
}

/* ---------- Ingreso ---------- */
async function enter(r) {
  saveSession(r);
  if (r.password_change_required) { nav('contrasena', { mode: 'first' }); return; }
  try {
    const me = await api('/me'); S.me = me;
    if (me.missing_fields && me.missing_fields.includes('area')) { nav('datos'); return; }
  } catch (e) { /* sin perfil: igual entra a Inicio */ }
  nav('inicio');
}
async function login(email, pass) {
  const e = email.trim().toLowerCase();
  if (!e) { S.form = { email, pass, err: 'email', msg: 'Escribe tu correo.' }; render(); return; }
  if (!pass) { S.form = { email, pass, err: 'pass', msg: 'Escribe tu contraseña.' }; render(); return; }
  S.form = { email, pass, busy: true }; render();
  try {
    const r = await api('/auth/login', { method: 'POST', body: { email: e, password: pass, device_label: deviceLabel() }, auth: false });
    await enter(r);
  } catch (err) { S.form = { email, pass: '', err: 'pass', msg: err.message }; render(); }
}
async function logout() {
  try { await flush(); await api('/auth/logout', { method: 'POST' }); } catch (e) { /* igual se cierra en este celular */ }
  clearSession(); S.ex = null; S.quiz = null; S.done = null; S.result = null;
  if (window.google && google.accounts && google.accounts.id) { try { google.accounts.id.disableAutoSelect(); } catch (e) { /* nada */ } }
  toLogin();
}

/* ---------- Evaluación: acciones ---------- */
async function startExam() {
  const id = S.params.id;
  S.form = { busy: true }; render();
  try {
    const at = await api('/assignments/' + id + '/attempts', { method: 'POST' });
    S.ex = null; loadAttempt(at); nav('intento/' + at.id);
  } catch (e) { S.form = { msg: e.message }; render(); }
}
async function saveAnswer(qid, choice) {
  const ex = S.ex; ex.pending[qid] = choice;
  try {
    const r = await api('/attempts/' + ex.attempt.id + '/answers/' + qid, { method: 'PUT', body: { choice } });
    if (ex.pending[qid] === choice) delete ex.pending[qid];
    ex.remaining = r.remaining_s; ex.syncedAt = Date.now(); if (ex.lost) { ex.lost = false; render(); }
    if (S.screen === 'revisar') render();
  } catch (e) {
    if (e.code === 'ATTEMPT_CLOSED') { showResult(e.details.result); return; }
    if (e.code === 'NETWORK') { if (!ex.lost) { ex.remaining = remainingNow(); ex.lost = true; render(); } }
    else { delete ex.pending[qid]; toast(e.message); }
  }
}
async function heartbeat() {
  const ex = S.ex; if (!ex) return;
  ex.lastBeat = Date.now();
  try {
    for (const [qid, choice] of Object.entries(ex.pending)) await saveAnswer(qid, choice);
    const r = await api('/attempts/' + ex.attempt.id + '/heartbeat', { method: 'POST' });
    if (r.status !== 'in_progress') { await submitExam(true); return; }
    const wasLost = ex.lost;
    ex.remaining = r.remaining_s; ex.syncedAt = Date.now(); ex.lost = false;
    if (wasLost) { render(); toast('Conexión recuperada'); }
  } catch (e) {
    if (e.code === 'ATTEMPT_CLOSED') { showResult(e.details.result); return; }
    if (e.code === 'NETWORK' && !ex.lost) { ex.remaining = remainingNow(); ex.lost = true; render(); }
  }
}
async function submitExam(silent) {
  const ex = S.ex; if (!ex || ex.submitting) return;
  ex.submitting = true; S.form = {}; if (!silent) render();
  try {
    for (const [qid, choice] of Object.entries(ex.pending)) await saveAnswer(qid, choice);
    const r = await api('/attempts/' + ex.attempt.id + '/submit', { method: 'POST' });
    showResult(r);
  } catch (e) {
    ex.submitting = false;
    if (e.code === 'ATTEMPT_CLOSED' && e.details.result) { showResult(e.details.result); return; }
    if (e.code === 'NETWORK') { ex.remaining = remainingNow(); ex.lost = true; }
    S.form = { msg: 'No se pudo enviar. Tus respuestas siguen guardadas. ' + (e.code === 'NETWORK' ? '' : e.message) };
    if (S.screen !== 'revisar') nav('revisar/' + ex.attempt.id); else render();
  }
}
function showResult(r) {
  S.result = r; S.ex = null;
  nav('resultado/' + (r.attempt_id || ''));
}

/* ---------- Reto: acciones ---------- */
async function checkQuestion() {
  const qz = S.quiz; const q = qz.lesson.quiz[qz.idx];
  qz.busy = true; qz.msg = null; render();
  try {
    const r = await api('/lessons/' + qz.lesson.id + '/quiz/check', { method: 'POST', body: { question_id: q.id, choice: qz.sel } });
    qz.checked = r; qz.answers[qz.idx] = qz.sel; qz.checks[qz.idx] = r;
  } catch (e) { qz.msg = e.message; }
  qz.busy = false; render();
}
async function finishQuiz() {
  const qz = S.quiz; const L = qz.lesson;
  qz.busy = true; qz.msg = null; render();
  try {
    await flush();
    const ev = { event_id: uuid(), type: 'quiz.completed', lesson_id: L.id, occurred_at: new Date().toISOString(), payload: { answers: qz.answers } };
    const r = await api('/sync/events', { method: 'POST', body: { events: [ev] } });
    const res = r.results[0];
    if (res.status !== 'accepted') { qz.busy = false; qz.msg = res.reason === 'LESSON_LOCKED' ? 'Esta lección aún está bloqueada.' : 'No pudimos guardar tu reto. Inténtalo de nuevo.'; render(); return; }
    S.done = { lesson: L, correct: res.correct, total: res.total, checks: qz.checks.slice(), assignment: r.assignments[0] };
    S.quiz = null;
    nav('hecho/' + L.id);
  } catch (e) { qz.busy = false; qz.msg = e.message; render(); }
}

/* ---------- Eventos ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const a = el.dataset.a;
  switch (a) {
    case 'go': nav(el.dataset.to); break;
    case 'retry': route(); break;
    case 'back': history.back(); break;
    case 'toLogin': nav('ingresar'); break;
    case 'toHome': nav('inicio'); break;
    case 'toProfile': nav('perfil'); break;
    case 'toRoute': nav(S.data && S.data.a ? 'ruta/' + S.data.a.id : (S.done && S.done.lesson ? 'ruta/' + S.done.lesson.assignment_id : 'inicio')); break;
    case 'toLesson': nav('leccion/' + S.quiz.lesson.id); break;
    case 'togglePass': syncForm(); S.form.show = !S.form.show; render(); break;
    case 'logout': logout(); break;
    case 'homeTab':
      S.homeTab = el.dataset.v; render();
      if (S.homeTab === 'hechas' && S.data && !S.data.certs) api('/certificates').then((r) => { if (S.screen === 'inicio' && S.data) { S.data.certs = r.certificates; render(); } }).catch((err) => toast(err.message));
      break;
    case 'routeView': S.routeView = el.dataset.v; render(); break;
    case 'locked': S.sheet = { type: 'locked', lv: el.dataset.lv }; render(); break;
    case 'openLesson': S.sheet = null; nav('leccion/' + el.dataset.id); break;
    case 'exitLesson': nav('ruta/' + S.data.l.assignment_id); break;
    case 'play': {
      const v = S.video;
      if (v.phase === 'ended') v.seekTo = 0;
      v.phase = 'loading'; render(); break;
    }
    case 'pause': VID.pause(); S.video.phase = 'paused'; render(); break;
    case 'speed': { const sp = [0.75, 1, 1.25, 1.5]; S.video.speed = sp[(sp.indexOf(S.video.speed) + 1) % sp.length]; render(); break; }
    case 'fullscreen': {
      const b = document.getElementById('vbox');
      try { const p = b.requestFullscreen ? b.requestFullscreen() : b.webkitRequestFullscreen ? b.webkitRequestFullscreen() : (VID.webkitEnterFullscreen && VID.webkitEnterFullscreen()); if (p && p.catch) p.catch(() => toast('Pantalla completa no disponible aquí')); }
      catch (err) { toast('Pantalla completa no disponible aquí'); }
      break;
    }
    case 'readSummary': markWatched(); if (S.video && S.video.phase !== 'playing') S.video.phase = S.video.phase === 'error' ? 'idle' : S.video.phase; S.sheet = { type: 'summary' }; render(); break;
    case 'seen': markWatched(); render(); break;
    case 'aiInfo': S.sheet = { type: 'aiInfo' }; render(); break;
    case 'resources': if (S.video && S.video.phase === 'playing') { VID.pause(); S.video.phase = 'paused'; } S.sheet = { type: 'resources' }; render(); break;
    case 'report': S.sheet = { type: 'report', reason: null, lessonId: S.data && S.data.l ? S.data.l.id : S.quiz.lesson.id, questionId: S.screen === 'reto' ? S.quiz.lesson.quiz[S.quiz.idx].id : null }; render(); break;
    case 'reason': S.sheet.comment = (document.getElementById('rcomment') || {}).value || ''; S.sheet.reason = el.dataset.v; render(); break;
    case 'sendReport': {
      const sh = S.sheet; sh.comment = (document.getElementById('rcomment') || {}).value || ''; sh.busy = true; render();
      const body = { lesson_id: sh.lessonId, reason: sh.reason }; if (sh.questionId) body.question_id = sh.questionId; if (sh.comment.trim()) body.comment = sh.comment.trim();
      api('/content-reports', { method: 'POST', body }).then(() => { sh.sent = true; render(); setTimeout(() => { if (S.sheet === sh) { S.sheet = null; render(); } }, 2500); })
        .catch((err) => { sh.busy = false; sh.msg = err.message; render(); });
      break;
    }
    case 'closeSheet': S.sheet = null; render(); break;
    case 'startQuiz': {
      const L = S.data && S.data.l ? S.data.l : (S.done ? S.done.lesson : null); if (!L) break;
      S.quiz = { lesson: L, idx: 0, sel: null, checked: null, answers: [], checks: [] }; nav('reto/' + L.id); break;
    }
    case 'pick': S.quiz.sel = +el.dataset.i; render(); break;
    case 'checkQ': checkQuestion(); break;
    case 'nextQ': {
      const qz = S.quiz;
      if (qz.idx < qz.lesson.quiz.length - 1) { qz.idx++; qz.sel = null; qz.checked = null; render(); window.scrollTo(0, 0); }
      else finishQuiz();
      break;
    }
    case 'seekVideo': { const id = S.quiz ? S.quiz.lesson.id : S.done.lesson.id; nav('leccion/' + id, { t: el.dataset.t }); break; }
    case 'startExam': startExam(); break;
    case 'answer': { const ex = S.ex; const q = ex.attempt.questions[ex.idx]; const i = +el.dataset.i; ex.answers[q.id] = i; render(); saveAnswer(q.id, i); break; }
    case 'prevQ': S.ex.idx = Math.max(0, S.ex.idx - 1); render(); break;
    case 'nextE': S.ex.idx = Math.min(S.ex.attempt.questions.length - 1, S.ex.idx + 1); render(); window.scrollTo(0, 0); break;
    case 'review': nav('revisar/' + S.ex.attempt.id); break;
    case 'gotoQ': S.ex.idx = +el.dataset.i; nav('intento/' + S.ex.attempt.id); break;
    case 'backExam': nav('intento/' + S.ex.attempt.id); break;
    case 'exitExam': S.sheet = { type: 'exitExam' }; render(); break;
    case 'confirmExitExam': { const aid = S.ex && S.ex.attempt.assignment_id; S.sheet = null; nav(aid ? 'ruta/' + aid : 'inicio'); break; }
    case 'reconnect': heartbeat(); break;
    case 'submitExam': submitExam(false); break;
    case 'viewCert': nav('certificado/' + el.dataset.id); break;
    case 'downloadPdf': downloadPdf(); break;
    case 'resend': resend(); break;
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.sheet) { S.sheet = null; render(); }
  // Los nodos del mapa son <circle>: Enter o espacio los activa como botones.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('circle.hit')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});

function syncForm() {
  [['email', 'email'], ['pass', 'pass'], ['np1', 'np1'], ['np2', 'np2'], ['cur', 'cur'], ['femail', 'email']].forEach(([id, k]) => { const el = document.getElementById(id); if (el) S.form[k] = el.value; });
}
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'np1' || t.id === 'np2' || t.id === 'cur') {
    S.form[t.id] = t.value;
    const ul = document.getElementById('prules'); if (ul) ul.innerHTML = passRulesHtml(S.form.np1, S.form.tried);
  } else if (t.id === 'email' || t.id === 'pass') S.form[t.id] = t.value;
  else if (t.id === 'femail') S.form.email = t.value;
  else if (t.id === 'area') S.form.area = t.value;
  else if (t.id === 'rcomment' && S.sheet) S.sheet.comment = t.value;
});
document.addEventListener('change', (e) => { if (e.target.id === 'area') S.form.area = e.target.value; });

document.addEventListener('submit', async (e) => {
  e.preventDefault(); const id = e.target.id; syncForm(); const f = S.form;
  if (id === 'loginForm') { login(f.email || '', f.pass || ''); return; }
  if (id === 'npForm') {
    const v = f.np1 || '';
    if (!(v.length >= 8 && /\d/.test(v))) { f.tried = true; f.msg = 'Tu contraseña aún no cumple todas las reglas.'; render(); return; }
    if (v !== f.np2) { f.tried = true; f.msg = 'Las dos contraseñas no coinciden.'; render(); return; }
    f.busy = true; f.msg = null; render();
    try {
      if (S.screen === 'crear-contrasena') {
        const r = await api('/auth/password/set', { method: 'POST', body: { token: S.link.token, new_password: v, device_label: deviceLabel() }, auth: false });
        S.link = null; toast('Listo, tu contraseña quedó guardada'); await enter(r);
      } else {
        const body = { new_password: v }; if (f.cur) body.current_password = f.cur;
        const r = await api('/auth/password', { method: 'POST', body });
        // El servidor entrega un token de acceso nuevo que ya no marca "cambio pendiente".
        const s = session(); if (s && r && r.access_token) saveSession({ access_token: r.access_token, refresh_token: s.refresh, expires_in: r.expires_in });
        const first = S.params.mode === 'first' || (S.data && S.data.me && S.data.me.password_change_required);
        if (first) {
          const me = await api('/me');
          toast('Contraseña guardada');
          nav(me.missing_fields && me.missing_fields.includes('area') ? 'datos' : 'inicio');
        } else { toast('Contraseña actualizada'); nav('perfil'); }
      }
    } catch (err) {
      const rules = err.details && err.details.rules;
      S.form = Object.assign({}, f, { busy: false, tried: true, msg: rules && rules.differs === false ? 'La contraseña nueva debe ser distinta a la anterior.' : err.message }); render();
    }
    return;
  }
  if (id === 'fichaForm') {
    const v = (document.getElementById('area') || {}).value;
    if (!v) { f.err = true; render(); return; }
    f.busy = true; render();
    try { await api('/me', { method: 'PATCH', body: { area: v } }); nav('inicio'); }
    catch (err) { S.form = { area: v, msg: err.message }; render(); }
    return;
  }
  if (id === 'fg1') {
    const em = (f.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { f.msg = 'Escribe un correo válido, por ejemplo nombre@empresa.com.'; render(); return; }
    f.busy = true; f.msg = null; render();
    await requestMail(em);
  }
});
async function requestMail(email) {
  const reset = S.screen === 'recuperar';
  try {
    const r = await api(reset ? '/auth/password/forgot' : '/auth/email-link', { method: 'POST', body: { email }, auth: false });
    S.form = { email, sent: true, resendAt: Date.now() + (r.resend_after_s || 60) * 1000 }; render();
  } catch (err) { S.form = { email, msg: err.message }; render(); }
}
function resend() { if (S.form.email) requestMail(S.form.email); }

async function downloadPdf() {
  const ct = S.data.ct; S.form = { busy: true }; render();
  try {
    const res = await api('/certificates/' + ct.id + '/pdf', { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Certificado-' + ct.code + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    S.form = {}; toast('Descargado · Certificado-' + ct.code + '.pdf', 3500);
  } catch (e) { S.form = { msg: 'No se pudo descargar. ' + e.message }; render(); }
}

/* ---------- Reloj ---------- */
setInterval(() => {
  const now = Date.now();
  if (S.toast && now > S.toastUntil) { S.toast = null; const el = document.querySelector('.toast'); if (el) el.remove(); }
  if (S.ex && (S.screen === 'intento' || S.screen === 'revisar')) {
    const left = remainingNow();
    const el = document.getElementById('etimer'); if (el) el.textContent = fClock(left);
    if (left <= 0 && !S.ex.lost && !S.ex.submitting) { toast('Se acabó el tiempo. Enviamos lo que respondiste.', 4000); submitExam(true); return; }
    if (now - S.ex.lastBeat > 15_000) heartbeat();
  }
  if (S.screen === 'recuperar' || S.screen === 'enlace') {
    const b = document.getElementById('resendBtn');
    if (b && S.form.resendAt) { const w = Math.max(0, Math.ceil((S.form.resendAt - now) / 1000)); b.disabled = w > 0; b.textContent = w ? 'Pedir otro en ' + w + ' s' : 'Pedir otro enlace'; }
  }
}, 1000);
setInterval(() => { flush(); }, 30_000);
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.screen === 'leccion') sendPosition(true); flush(); } else if (S.ex) heartbeat(); });
window.addEventListener('online', () => { setNet(false); flush(); if (S.ex) heartbeat(); });
window.addEventListener('offline', () => setNet(true));
window.addEventListener('hashchange', route);

/* ---------- Arranque ----------
 * Los correos traen ?empresa=<slug>&accion=invitacion|restablecer|entrar&token=… */
async function boot() {
  const q = new URLSearchParams(location.search);
  const empresa = q.get('empresa'); const accion = q.get('accion'); const token = q.get('token');
  if (empresa) {
    if (tenant() && tenant() !== empresa.toLowerCase()) clearSession();
    store.set('nivia.tenant', empresa.toLowerCase());
  }
  // El token no debe quedar en el historial ni en la barra de direcciones.
  if (q.toString()) history.replaceState(null, '', location.pathname + location.hash);

  try { S.cfg = await api('/tenant/config', { auth: false }); }
  catch (e) {
    document.getElementById('app').innerHTML = '<main class="scr"><div class="empty">' + icon(e.code === 'NETWORK' ? 'wifioff' : 'info', 40) + '<p class="h2">' + (e.code === 'TENANT_NOT_FOUND' || e.code === 'TENANT_REQUIRED' ? 'Usa el enlace que te envió tu empresa' : 'No pudimos cargar la capacitación') + '</p><p class="muted small">' + esc(e.message) + '</p><button class="btn btn-primary" onclick="location.reload()">Volver a intentar</button></div></main>';
    return;
  }
  if (!tenant()) store.set('nivia.tenant', S.cfg.slug);
  applyTheme();

  if (token && (accion === 'invitacion' || accion === 'restablecer')) {
    try { S.link = { token, info: await api('/auth/link-info?token=' + encodeURIComponent(token), { auth: false }) }; }
    catch (e) { S.link = { token, error: e.message }; }
    clearSession();
    location.hash = '#/crear-contrasena';
    if (parseHash().name === 'crear-contrasena') route();
    return;
  }
  if (token && accion === 'entrar') {
    try { const r = await api('/auth/email-link/verify', { method: 'POST', body: { token, device_label: deviceLabel() }, auth: false }); await enter(r); return; }
    catch (e) { clearSession(); toLogin(e.message + ' Pide otro enlace o entra con tu contraseña.'); return; }
  }
  route();
  flush();
}
boot();
})();
