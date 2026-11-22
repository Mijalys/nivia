# Nivia · API

Backend de Nivia según [la propuesta de arquitectura](../arquitectura/README.md): monolito modular en TypeScript (NestJS 11), PostgreSQL con aislamiento por cliente (Row Level Security) y datos de demostración de los Cortes 1 y 2.

## Arrancar

```bash
npm install
APP_SECRET=cambia-esto npm run dev
```

- La API queda en `http://localhost:3000`.
- Sin `DATABASE_URL` usa **PGlite**: PostgreSQL embebido en `./.data/pglite`, sin instalar nada.
- La primera vez aplica las migraciones y carga los clientes, rutas y aprendices de demostración.
- Copia el video vertical de demostración de `../prototipo/media` a `./storage/demo`.
- Sirve la app del aprendiz (`../app`) en `http://localhost:3000/app/`, en el mismo origen que la API. `/` redirige ahí.
- Con varios clientes de demostración, la app elige la empresa por `?empresa=<slug>` o por `DEFAULT_TENANT`. Ejemplo: `DEFAULT_TENANT=riomar`.

Para usar PostgreSQL real:

```bash
docker compose up -d
DATABASE_URL=postgres://nivia:nivia@localhost:5432/nivia APP_SECRET=cambia-esto npm run dev
```

## Probar en un GitHub Codespace

En GitHub: **Code → Codespaces → Create codespace on main**. Al arrancar, `.devcontainer/start.sh` compila, levanta la API con la app en el puerto 3000 y carga el programa de `../contenido/programa-claude`. La terminal muestra el enlace (`https://<codespace>-3000.app.github.dev/app/`) y la clave del administrador. Para abrirlo desde otro dispositivo sin iniciar sesión en GitHub, en la pestaña **Ports** cambia la visibilidad del puerto 3000 a **Public**.

El video de demostración no está en el repositorio: súbelo a `backend/storage/demo/leccion-demo.mp4` del Codespace (arrastrándolo al explorador de archivos) o la lección mostrará que no se pudo reproducir.

## Cargar contenido

```bash
node scripts/cargar-contenido.mjs --api http://localhost:3000 --dir ../contenido/programa-claude --storage ./storage
```

Lee `programa.json`, `lecciones.csv` y `preguntas.csv`; crea la empresa, copia el material de apoyo, crea y publica la ruta y una persona de prueba con la ruta asignada. Se puede correr varias veces: lo que ya existe no se toca.

## Pruebas

```bash
npm test
```

38 pruebas contra la API real y PGlite en memoria, con reloj controlado. Cubren:

- Ingreso con correo, Google y enlace; recuperación por correo; invitaciones; rotación de sesión.
- Bloqueo por niveles y aislamiento entre empresas.
- Video con URL firmada y descargas.
- Avance sin señal idempotente.
- Evaluación aprobada con certificado y PDF, evaluación desaprobada con espera, y pausa por señal cortada.

## Datos de demostración

Empresas `riomar` (Corporación Ríomar) y `altavista` (Grupo Altavista). Se indican con la cabecera `X-Tenant` o el subdominio. Contraseña de todos: `Demo2026`. Correo: `<nombre>@<empresa>.example` (por ejemplo `rosa@riomar.example`).

| Aprendiz | Correo | Estado |
|---|---|---|
| Carlos | carlos@… | Contraseña temporal, sin área, 0 % |
| Rosa | rosa@… | 40 %, vence en 10 días |
| Luis | luis@… | 60 %, venció hace 10 días |
| Marisol | marisol@… | Certificado que vence en 20 días y renovación al 40 % |

## API

Todas las rutas, salvo las públicas, usan `Authorization: Bearer <access_token>`. Los errores llegan como `{ "error": { "code", "message", … } }` con códigos estables para que la PWA muestre los textos de los cortes.

| Método y ruta | Uso |
|---|---|
| `GET /tenant/config` (pública) | Marca, áreas y reglas de evaluación del cliente |
| `POST /auth/login` (pública) | Correo y contraseña. Devuelve `password_change_required` |
| `POST /auth/password` | Crear o cambiar contraseña (8 caracteres, un número, distinta a la anterior) |
| `POST /auth/google` (pública) | Ingreso con Google: `id_token` del botón de Google. Solo personas invitadas por la empresa |
| `POST /auth/password/forgot` · `POST /auth/email-link` (públicas) | Envían un enlace al correo: restablecer (30 min) o entrar sin contraseña (15 min) |
| `GET /auth/link-info` · `POST /auth/password/set` · `POST /auth/email-link/verify` (públicas) | Lo que hace la app al abrir el enlace: saludar, crear contraseña (invitación o restablecer) o entrar |
| `POST /auth/refresh` (pública) · `POST /auth/logout` | Sesión por dispositivo con token de renovación rotativo |
| `GET /me` · `PATCH /me` | Ficha y área faltante |
| `GET /home` | Inicio: asignaciones por urgencia, siguiente lección, certificados por vencer |
| `GET /assignments/:id` | Ruta con niveles, estado y bloqueo secuencial |
| `GET /lessons/:id` | Lección: video firmado, resumen y reto **sin respuestas** |
| `POST /lessons/:id/quiz/check` | Verifica una respuesta del reto y recién ahí devuelve la correcta y el "por qué" |
| `POST /sync/events` | Avance en lotes: `video.position`, `lesson.watched`, `quiz.completed` |
| `POST /content-reports` | Reportar un problema con el contenido |
| `GET /assignments/:id/exam` | Reglas, intentos, espera y si puede empezar |
| `POST /assignments/:id/attempts` | Empieza o reanuda la evaluación |
| `GET /attempts/:id` · `PUT /attempts/:id/answers/:qid` · `POST /attempts/:id/heartbeat` · `POST /attempts/:id/submit` | Evaluación con tiempo en el servidor |
| `GET /certificates` · `GET /certificates/:id` · `GET /certificates/:id/pdf` | Certificados |
| `GET /certificates/verify/:code` (pública) | Verificación por código dentro de la empresa |
| `GET /media/*` (URL firmada) | Video, portada y paquetes, con soporte de rangos |

## Consola de administración (API)

Dos tipos de administrador:

- **De plataforma (Nivia):** usuario `admin`. Contraseña: `ADMIN_PASSWORD` al arrancar, o `Demo2026` si no se define. Crea empresas y opera cualquiera.
- **De empresa:** una persona de la empresa con rol `admin`. Entra con su correo por `POST /auth/login` o con Google y usa el mismo token; solo ve su empresa.

| Método y ruta | Uso |
|---|---|
| `POST /admin/auth/login` | Usuario y contraseña del administrador de plataforma |
| `GET /admin/tenants` · `POST /admin/tenants` | Listar y crear empresas (valida contraste AA de la marca) |
| `GET /admin/tenants/:slug/users` · `POST /admin/tenants/:slug/users` | Listar y crear personas por correo (una o una lista). Envía la invitación con la marca de la empresa |
| `POST /admin/tenants/:slug/users/:id/invite` | Reenviar la invitación |
| `PUT /admin/tenants/:slug/users/:id/role` | `admin`, `supervisor` o `learner` |
| `GET /admin/tenants/:slug/routes` · `POST /admin/tenants/:slug/routes` | Crear una ruta completa en borrador: niveles, lecciones, preguntas |
| `POST /admin/tenants/:slug/routes/:id/publish` | Publicar: exige al menos una pregunta de evaluación por lección y congela la versión |
| `POST /admin/tenants/:slug/assignments` | Asignar una ruta publicada a personas con fecha límite |
| `GET /admin/tenants/:slug/progress` | Seguimiento: avance, intentos, aprobados, certificados y quién va tarde |

### Crear una clase real en cinco llamadas

```bash
API=http://localhost:3000
T=$(curl -s -X POST $API/admin/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Clase2026!"}' | jq -r .access_token)

# 1. Empresa
curl -s -X POST $API/admin/tenants -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{
  "slug":"minera-sur","name":"Minera Sur","cert_prefix":"MSU",
  "branding":{"mono":"M","accent":"#F26B1D","principal":"#0E4D5C","principal_text":"#7CC3D0","areas":["Mina","Planta"]},
  "exam_policy":{"min_score":80,"attempts":3,"wait_minutes":60,"question_count":10,"minutes":15,"exhausted_message":"Habla con tu supervisor."}}'

# 2. Personas: a cada una le llega una invitación al correo (también vuelve invite_url, por si hay que compartirla a mano)
curl -s -X POST $API/admin/tenants/minera-sur/users -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '[{"first_name":"Jorge","last_name":"Ticona","email":"jorge@minerasur.pe","area":"Mina"}]'

# 3. Ruta (ver test/admin.e2e.spec.ts para el formato completo de lecciones y preguntas)
curl -s -X POST $API/admin/tenants/minera-sur/routes -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d @ruta.json

# 4. Publicar y 5. asignar
curl -s -X POST $API/admin/tenants/minera-sur/routes/<route_id>/publish -H "Authorization: Bearer $T"
curl -s -X POST $API/admin/tenants/minera-sur/assignments -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"route_id":"<route_id>","user_ids":["<user_id>"],"due_at":"2026-12-15T23:59:00-05:00"}'
```

Cada pregunta va al reto (`in_quiz`, por defecto) o a la evaluación (`in_exam: true, in_quiz: false`), nunca a ambos: el reto muestra la respuesta correcta al elegir. Cada lección necesita al menos una de evaluación para publicar.

Videos: copia el MP4 (vertical, H.264) y su portada a `STORAGE_DIR`, por ejemplo `storage/minera-sur/leccion-1.mp4`, y pasa esa ruta como `video_key` y `poster_key`. La API comprueba que existan y toma el tamaño real. En producción `video_key` es obligatorio; en desarrollo, sin él, la lección usa el video de demostración.

## Estructura

```
src/
  config.ts            configuración y tokens de inyección
  db/                  conexión (pg o PGlite), migraciones, datos de demostración
  common/              autenticación, errores, firmas, límites, contraste de color
  modules/
    tenants.ts         marca blanca y reglas
    identity.ts        ingreso, contraseñas, códigos, sesiones, ficha
    learning.ts        inicio, rutas, lecciones, paquetes, avance sin señal, reportes
    assessment.ts      evaluación, reloj con pausa, calificación
    certification.ts   emisión, PDF, verificación
    media.ts           archivos con URL firmada
    email.ts           correos con la marca del cliente (Brevo, o el log en desarrollo)
    google.ts          verificación del token de "Continuar con Google"
    admin.ts           consola: empresas, personas, rutas, publicación, asignaciones, seguimiento
test/                  pruebas de punta a punta
```

## Piloto

El modo sin señal quedó fuera del piloto. Ver [../DESPLIEGUE.md](../DESPLIEGUE.md) para publicar la API con la app.

- Cada pregunta va al reto **o** a la evaluación, nunca a ambos: el reto revela la respuesta al elegir. La API de administración lo valida.
- Los datos de demostración aún comparten preguntas entre reto y evaluación. No se cargan en producción.
- Con `NODE_ENV=production` la API no arranca sin `APP_SECRET` (32+ caracteres), `DATABASE_URL`, `PUBLIC_URL` y `ADMIN_PASSWORD` (12+). Tampoco carga datos de demostración.

## Qué falta para producción

- **Pipeline de contenido con IA:** está en la arquitectura, pero aún no tiene código.
- **Consola de administración:** existe la API; falta la interfaz web.
- **Paso a la nube:** almacenamiento S3 con CDN y video HLS real; hoy los archivos se sirven de una carpeta local y todas las lecciones usan el MP4 de demostración.
- **Correos:** con `BREVO_API_KEY` y un remitente verificado en Brevo (`EMAIL_FROM`) salen de verdad; sin eso se escriben en el log.
- **Google:** necesita `GOOGLE_CLIENT_ID`. Pasos en [../arquitectura/google-cloud.md](../arquitectura/google-cloud.md).
- **Límite de intentos compartido** (Redis) cuando haya más de una instancia; hoy vive en memoria.
- **Pruebas contra PostgreSQL real:** las pruebas corren en PGlite. El mismo SQL y las mismas políticas RLS deberían funcionar igual, pero no se probó.
- **Certificado:** el PDF usa pdfkit con fuentes base; el diseño final con el logo del cliente va con plantilla HTML.
