# Nivia · API

Backend de Nivia según [la propuesta de arquitectura](../arquitectura/README.md): monolito modular en TypeScript (NestJS 11), PostgreSQL con aislamiento por cliente (Row Level Security) y datos de demostración de los Cortes 1 y 2.

## Arrancar

```bash
npm install
APP_SECRET=cambia-esto DEV_OTP_CODE=123456 npm run dev
```

- La API queda en `http://localhost:3000`.
- Sin `DATABASE_URL` usa **PGlite**: PostgreSQL embebido en `./.data/pglite`, sin instalar nada.
- La primera vez aplica las migraciones y carga los clientes, rutas y aprendices de demostración.
- Copia el video vertical de demostración de `../prototipo/media` a `./storage/demo`.

Para usar PostgreSQL real:

```bash
docker compose up -d
DATABASE_URL=postgres://nivia:nivia@localhost:5432/nivia APP_SECRET=cambia-esto npm run dev
```

## Pruebas

```bash
npm test
```

18 pruebas de punta a punta contra la API real y PGlite en memoria, con reloj controlado. Cubren:

- Ingreso, primer ingreso, recuperación por SMS y rotación de sesión.
- Bloqueo por niveles y aislamiento entre empresas.
- Video con URL firmada y descargas.
- Avance sin señal idempotente.
- Evaluación aprobada con certificado y PDF, evaluación desaprobada con espera, y pausa por señal cortada.

## Datos de demostración

Empresas `riomar` (Corporación Ríomar) y `altavista` (Grupo Altavista). Se indican con la cabecera `X-Tenant` o el subdominio. Contraseña de todos: `Demo2026`.

| Aprendiz | Celular | Estado |
|---|---|---|
| Carlos | 987 654 321 | Contraseña temporal, sin área, 0 % |
| Rosa | 987 111 222 | 40 %, vence en 10 días |
| Luis | 987 333 444 | 60 %, venció hace 10 días |
| Marisol | 987 555 666 | Certificado que vence en 20 días y renovación al 40 % |

## API

Todas las rutas, salvo las públicas, usan `Authorization: Bearer <access_token>`. Los errores llegan como `{ "error": { "code", "message", … } }` con códigos estables para que la PWA muestre los textos de los cortes.

| Método y ruta | Uso |
|---|---|
| `GET /tenant/config` (pública) | Marca, áreas y reglas de evaluación del cliente |
| `POST /auth/login` (pública) | Celular y contraseña. Devuelve `password_change_required` |
| `POST /auth/password` | Crear o cambiar contraseña (8 caracteres, un número, distinta a la anterior) |
| `POST /auth/otp` · `POST /auth/otp/verify` · `POST /auth/password/reset` (públicas) | Recuperación por código de 6 dígitos |
| `POST /auth/refresh` (pública) · `POST /auth/logout` | Sesión por dispositivo con token de renovación rotativo |
| `GET /me` · `PATCH /me` | Ficha y área faltante |
| `GET /home` | Inicio: asignaciones por urgencia, siguiente lección, certificados por vencer |
| `GET /assignments/:id` | Ruta con niveles, estado y bloqueo secuencial |
| `GET /lessons/:id` | Lección: video firmado, resumen y reto (con respuestas, para usarlo sin señal) |
| `GET /lessons/:id/offline-package` | Tamaño y archivos para descargar |
| `POST /sync/events` | Avance con o sin señal: `video.position`, `lesson.watched`, `quiz.completed` |
| `POST /content-reports` | Reportar un problema con el contenido |
| `GET /assignments/:id/exam` | Reglas, intentos, espera y si puede empezar |
| `POST /assignments/:id/attempts` | Empieza o reanuda la evaluación |
| `GET /attempts/:id` · `PUT /attempts/:id/answers/:qid` · `POST /attempts/:id/heartbeat` · `POST /attempts/:id/submit` | Evaluación con tiempo en el servidor |
| `GET /certificates` · `GET /certificates/:id` · `GET /certificates/:id/pdf` | Certificados |
| `GET /certificates/verify/:code` (pública) | Verificación por código dentro de la empresa |
| `GET /media/*` (URL firmada) | Video, portada y paquetes, con soporte de rangos |

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
    notifications.ts   SMS (consola en desarrollo)
test/                  pruebas de punta a punta
```

## Qué falta para producción

- **Pipeline de contenido con IA:** está en la arquitectura, pero aún no tiene código.
- **Consola de administración:** aún no existe.
- **Paso a la nube:** almacenamiento S3 con CDN y video HLS real; hoy los archivos se sirven de una carpeta local y todas las lecciones usan el MP4 de demostración.
- **Proveedor real de SMS o WhatsApp:** hoy los mensajes se escriben en el log.
- **Límite de intentos compartido** (Redis) cuando haya más de una instancia; hoy vive en memoria.
- **Pruebas contra PostgreSQL real:** las pruebas corren en PGlite. El mismo SQL y las mismas políticas RLS deberían funcionar igual, pero no se probó.
- **Certificado:** el PDF usa pdfkit con fuentes base; el diseño final con el logo del cliente va con plantilla HTML.
