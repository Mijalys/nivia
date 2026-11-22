# Contrato entre la UI y la API

La UI solo puede mostrar lo que la API entrega y solo puede hacer lo que la API permite. Este documento dice, pantalla por pantalla, qué función de `api.js` se llama, qué devuelve y qué estados hay que diseñar. Las respuestas exactas están en `fixtures/` (capturas reales: `_captura.status` es el código HTTP y `body` la respuesta).

Si un diseño necesita un dato que no aparece aquí, no se inventa en la UI: se pide primero en la API.

## Reglas generales

- **Errores:** siempre `{ "error": { "code": "…", "message": "…" } }`. El `message` ya está en español y se puede mostrar tal cual. La UI decide qué hacer según el `code`.
- **Fechas:** llegan en ISO UTC (`2026-12-16T04:59:00.000Z`). La UI las muestra en hora de Lima.
- **Marca:** viene de `GET /tenant/config`. Un diseño debe funcionar con cualquier acento de empresa, no solo con lima.
- **Sesión:** la maneja `api.js` (tokens, renovación, cierre al vencer). Ninguna pantalla toca tokens.
- **Sin señal:** cualquier llamada puede fallar con `NETWORK`. La UI muestra la barra «Sin conexión» y deja reintentar.

## Pantallas

| Pantalla (hash) | Funciones de `api.js` | Fixtures | Estados que se diseñan |
|---|---|---|---|
| Ingreso `#/ingresar` | `tenantConfig`, `login`, `loginWithGoogle` | `tenant-config`, `auth-login`, `auth-login-primer-ingreso`, `errores/invalid-credentials`, `errores/too-many-attempts`, `errores/not-invited` | Normal, enviando, error de credenciales, bloqueo por intentos, Google no invitado, sin botón de Google (`sign_in.google_client_id` nulo), navegador dentro de WhatsApp o Instagram |
| Recuperar `#/recuperar` y Enlace `#/enlace` | `forgotPassword`, `requestEmailLink` | `auth-forgot` | Formulario, correo inválido, enviado con cuenta regresiva para reenviar (`resend_after_s`) |
| Crear contraseña `#/crear-contrasena` | `linkInfo`, `setPasswordWithToken` | `auth-link-info-invite`, `auth-link-info-reset`, `errores/link-invalid`, `errores/weak-password` | Invitación (saluda con `first_name` y `company`), restablecer, enlace vencido o usado |
| Contraseña `#/contrasena` | `me`, `changePassword` | `me`, `auth-password`, `errores/weak-password`, `errores/password-change-required` | Primer ingreso (paso 1 de 2), cambiar (pide la actual si `sign_in.password`), crear (solo Google) |
| Datos `#/datos` | `me`, `updateArea` | `me` | Elegir área de `area_options` (paso 2 de 2). Aparece si `missing_fields` incluye `area` |
| Inicio `#/inicio` | `home`, `lesson` (portada de la siguiente), `certificates` (pestaña Completadas) | `home`, `home-exam-ready`, `home-late`, `home-renewal`, `home-empty`, `certificates` | Siguiente lección, toca evaluación (`next.type = exam`), vencida (`late`), renovación (`kind = renewal`), certificado por vencer (`certificates_expiring`), sin pendientes |
| Ruta `#/ruta/<id>` | `assignment` | `assignment`, `assignment-in-progress` | Mapa y lista; niveles `done`, `in_progress`, `available`, `locked`; evaluación `locked`, `available`, `passed` |
| Lección `#/leccion/<id>` | `lesson`; avance con `queue('video.position' \| 'lesson.watched')` | `lesson`, `errores/lesson-locked` | Video detenido, cargando, reproduciendo, terminado, error; reto bloqueado hasta ver el video; material de apoyo; hecho con IA |
| Reto `#/reto/<id>` | `checkQuizAnswer`, `sendProgress` | `quiz-check-correct`, `quiz-check-incorrect`, `sync-quiz-completed` | Elegir, comprobando, correcta, incorrecta (muestra la correcta, el porqué y el minuto del video) |
| Lección completada `#/hecho/<id>` | — (usa el resultado del reto) | `sync-quiz-completed` | Todo bien, temas para repasar, siguiente lección o evaluación, material de apoyo |
| Reglas `#/evaluacion/<id>` | `examInfo`, `assignment`, `startAttempt` | `exam-info`, `exam-info-retry-after`, `errores/retry-after` | Puede empezar, continuar intento, esperar (`retry_at`), sin intentos, lecciones pendientes, ya aprobada |
| Evaluación `#/intento/<id>` | `attempt`, `saveAnswer`, `heartbeat` | `attempt-start`, `attempt`, `attempt-answer`, `attempt-heartbeat` | Pregunta, respondida, sin señal (reloj en pausa), tiempo agotado |
| Revisar `#/revisar/<id>` | `submitAttempt` | `attempt` | Todas respondidas, faltan respuestas, enviando, error al enviar |
| Resultado `#/resultado/<id>` | — (usa la respuesta del envío) | `result-passed`, `result-failed` | Aprobado con certificado, no alcanzó con temas a reforzar, cerrado por tiempo (`closed_by_time`), sin intentos |
| Certificados `#/certificados` | `certificates` | `certificates` | Lista (`valid`, `expiring_soon`, `expired`), vacía |
| Certificado `#/certificado/<id>` | `certificate`, `certificatePdf` | `certificate` | Detalle, descargando PDF, error de descarga |
| Perfil `#/perfil` | `me`, `logout` | `me` | Con o sin Google vinculado, con o sin contraseña |

Hojas que se abren sobre una pantalla: nivel bloqueado, lección bloqueada, reportar un problema (`reportContent`, fixture `content-report`), salir de la evaluación, hecho con IA, resumen de la lección y material de apoyo.

## Datos disponibles

**Empresa** (`tenantConfig`): `name`, `slug`, `branding.{mono, accent, on_accent, principal, principal_text, logo_url, areas}`, `exam_policy.{min_score, attempts, wait_minutes, question_count, minutes, max_pause_minutes, exhausted_message}`, `sign_in.{email_password, email_link, google_client_id}`.

**Persona** (`me`): `first_name`, `last_name`, `email`, `phone`, `area`, `company`, `missing_fields`, `area_options`, `sign_in.{password, google}`, `password_change_required`.

**Inicio** (`home`): `user.first_name`, `today`, `next` (`type` = `lesson` con `lesson.{id, title, level_position, level_count, format, duration_s}`, o `exam` con `question_count`), `assignments[]` con `{id, kind, route_title, pct, due_at, late, days_left, remaining_minutes}`, `certificates_expiring[]` con `{id, route_title, expires_at, days_left}`.

**Ruta** (`assignment`): `route.{title, overline}`, `pct`, `due_at`, `late`, `days_left`, `remaining_minutes`, `levels[]` con `{position, title, state, lessons[]}`; cada lección `{id, title, format, duration_s, completed, watched, video_position_s}`; `exam.{state, question_count, minutes}`; `next_lesson`.

**Lección** (`lesson`): `title`, `format` (`presenter` o `animated`), `duration_s`, `level.{position, title, count}`, `ai_generated`, `summary[]`, `media.{hls, mp4_offline, poster}.url`, `quiz[]` con `{id, prompt, options[], video_t}` **sin la respuesta correcta**, `resources[]` con `{title, kind: file | link, url, filename, size_bytes}`, `progress.{completed, watched, video_position_s}`.

**Respuesta del reto** (`checkQuizAnswer`): `correct`, `correct_index`, `why`, `video_t`.

**Reto terminado** (`sendProgress`): `results[0].{status, correct, total, review[]}`; `assignments[0].{pct, next_lesson, exam_available}`.

**Evaluación**: reglas (`examInfo`) `rules`, `attempts_used`, `attempts_left`, `retry_at`, `in_progress_attempt_id`, `can_start`, `blocked_reason` (`LESSONS_INCOMPLETE`, `ATTEMPTS_EXHAUSTED`, `RETRY_AFTER`, `ALREADY_PASSED`). Intento (`attempt`): `number`, `time_limit_s`, `remaining_s`, `pause_left_s`, `questions[]` sin respuestas, `answers` (pregunta → opción), `unanswered`. Resultado (`submitAttempt`): `score`, `min_score`, `passed`, `closed_by_time`, `topics_to_review[]`, `attempts_left`, `retry_at`, `exhausted_message`, `certificate.{id, code}`.

**Certificado**: `route_title`, `score`, `code`, `holder`, `issued_at`, `expires_at`, `days_left`, `state`, y en el detalle `company`, `statement`, `disclaimer`. El PDF se descarga aparte.

## Códigos de error que la UI debe contemplar

| Código | Dónde | Qué hace la UI |
|---|---|---|
| `INVALID_CREDENTIALS` | Ingreso | Mensaje bajo el formulario |
| `TOO_MANY_ATTEMPTS` | Ingreso, correos | Mensaje; trae `retry_at` |
| `NOT_INVITED`, `GOOGLE_TOKEN_INVALID`, `GOOGLE_EMAIL_UNVERIFIED`, `GOOGLE_DISABLED` | Google | Mensaje sobre el botón de Google |
| `PASSWORD_CHANGE_REQUIRED` | Cualquier pantalla | Lleva a crear contraseña |
| `WEAK_PASSWORD`, `CURRENT_PASSWORD_INVALID` | Contraseña | Mensaje; `rules` dice qué falta |
| `LINK_INVALID`, `LINK_EXPIRED` | Enlaces del correo | Pantalla «este enlace ya no sirve» |
| `SESSION_EXPIRED`, `SESSION_INVALID`, `SESSION_REVOKED`, `TOKEN_INVALID` | Cualquier pantalla | `api.js` cierra la sesión y vuelve al ingreso |
| `LESSON_LOCKED` | Lección | Hoja «primero completa el nivel…» |
| `RETRY_AFTER`, `ATTEMPTS_EXHAUSTED`, `LESSONS_INCOMPLETE`, `ALREADY_PASSED` | Evaluación | Botón deshabilitado con el motivo |
| `ATTEMPT_CLOSED` | Evaluación | Muestra el resultado que trae el error |
| `MEDIA_URL_EXPIRED` | Video o archivo | Volver a abrir la lección |
| `NOT_FOUND`, `TENANT_NOT_FOUND` | Cualquiera | Pantalla de error con reintento |
| `NETWORK` | Cualquiera | Barra «Sin conexión» y reintento |

## Lo que la API NO tiene

No diseñar pantallas ni elementos para esto sin antes agregarlo a la API:

- Foto o avatar de la persona.
- Notificaciones, mensajes o chat.
- Puntos, insignias, rachas o ranking.
- Comentarios, foro o comunidad.
- Búsqueda o catálogo de cursos fuera de lo asignado.
- Descargar lecciones para ver sin señal.
- Subtítulos separados del video.
- Fecha de apertura de cada nivel: hoy los niveles se abren solo al terminar el anterior.
- Calendario, recordatorios o agenda.
- Tema claro: la app tiene solo el tema oscuro D.
- Panel del administrador: hoy la administración es solo por API.
