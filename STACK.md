# Stack de Nivia

Nivia es una sola aplicación web: un backend NestJS que expone la API y, en la misma dirección, sirve la app del aprendiz en `/app/`. No hay framework de front ni paso de compilación en la app.

## Piezas

| Pieza | Carpeta | Qué es |
|---|---|---|
| API | `backend/` | NestJS 11 en Node 22, TypeScript 5.9 |
| App del aprendiz | `app/` | HTML, CSS y JavaScript sin framework ni compilación |
| Contenido | `contenido/` | Programas en CSV + JSON, y su material de apoyo |
| Prototipo | `prototipo/` | Demo con datos simulados para pruebas de usabilidad. No habla con la API |
| Diseño y documentos | `diseno/`, `arquitectura/`, `README.md`, `corte-2/` | Opciones visuales, arquitectura y documentos de cada corte |
| Codespace | `.devcontainer/` | Entorno de pruebas en GitHub Codespaces |

## Backend (`backend/`)

| Tema | Elección | Versión |
|---|---|---|
| Lenguaje y entorno | TypeScript sobre Node | Node 22 o más, TS 5.9.3 |
| Framework | NestJS (CommonJS; NestJS 12 ya es solo ESM) | 11.2.8 |
| Base de datos | PostgreSQL con Row Level Security por empresa (rol `nivia_app`, `app.tenant_id`) | `pg` 8.16.3 |
| Base en desarrollo y pruebas | PGlite: PostgreSQL embebido, sin instalar nada | 0.5.14 |
| Validación | zod | 4.1.13 |
| Contraseñas | argon2 (`@node-rs/argon2`) | 2.2.2 |
| Sesión | JWT HS256 propio (acceso de 15 min) + token de renovación rotativo por dispositivo | — |
| Google | Verificación del `id_token` con las llaves públicas de Google (sin secreto de cliente) | — |
| Correo | Brevo por API; sin clave, los correos van al log | — |
| Certificados | PDF con pdfkit | 0.17.2 |
| Archivos | Carpeta local `STORAGE_DIR` servida con URL firmada y por rangos (video) | — |
| Pruebas | Jest + ts-jest + supertest, sobre PGlite | Jest 30.1.3 |

Módulos en `backend/src/modules/`: `tenants` (marca), `identity` (ingreso, contraseñas, perfil), `learning` (inicio, rutas, lecciones, reto, avance), `assessment` (evaluación con reloj en el servidor), `certification` (certificados y verificación), `media` (archivos firmados), `admin` (consola por API), `email` y `google`.

Comandos:

```bash
cd backend
npm install
npm run dev          # compila y arranca en http://localhost:3000 (app en /app/)
npm test             # 40 pruebas
npm run fixtures     # recaptura las respuestas reales de la API en app/fixtures/
node scripts/cargar-contenido.mjs --api http://localhost:3000 --dir ../contenido/programa-claude --storage ./storage
```

Variables de entorno: ver `backend/.env.example`. En producción (`NODE_ENV=production`) son obligatorias `APP_SECRET`, `DATABASE_URL`, `PUBLIC_URL` y `ADMIN_PASSWORD`.

## App del aprendiz (`app/`)

| Archivo | Rol |
|---|---|
| `index.html` | Carga la fuente, los estilos y los dos scripts |
| `styles.css` | Tema D «Vidrio y lima»: variables de color, componentes y pantallas |
| `api.js` | **Capa de datos.** Contrato con la API: una función por ruta, sesión, renovación de tokens, cola de avance y modo demo |
| `app.js` | **Capa de UI.** Pantallas, hojas, navegación por hash, video, reloj de la evaluación |
| `fixtures/` | Respuestas reales de la API, capturadas con `npm run fixtures` |
| `CONTRATO-UI.md` | Qué pide y qué recibe cada pantalla |
| `CLAUDE-DESIGN.md` | Cómo trabajar la UI en Claude Design sin inventar datos |

Decisiones:

- **Sin framework ni compilación:** se edita y se recarga. Las pantallas son funciones que devuelven HTML como texto; los botones llevan `data-a="<acción>"` y un solo manejador de clics.
- **Navegación por hash** (`#/inicio`, `#/leccion/<id>`): el botón Atrás del celular funciona.
- **Fuente:** Inter Tight desde Google Fonts. **Orbe:** WebGL con respaldo en canvas 2D.
- **Marca por empresa:** `--accent`, `--on-accent`, `--principal` y `--ptext` salen de `GET /tenant/config` al cargar.
- **Fechas** en hora de Lima (UTC−5) y en español de Perú.
- **Guardado en el navegador:** `nivia.session` (tokens), `nivia.tenant`, `nivia.outbox` (avance pendiente de enviar), `nivia.routeTitle`, `nivia.demo`.
- **Sin modo sin señal:** se descartó para el piloto. Si se cae la red, la evaluación pausa el reloj del servidor y reintenta.

Modo demo, sin backend (desde la carpeta `nivia/`):

```bash
python3 -m http.server 4178
```

Abre `http://localhost:4178/app/index.html?demo` (aprueba) o `?demo=desaprobado`. Con `?demo=0` vuelve al modo normal. El video de demostración no está en el repositorio: sin él, la lección muestra el aviso de video que no carga.

## Despliegue y pruebas compartidas

- **Un solo servicio:** la API sirve la app; no hace falta CORS. Pasos en `DESPLIEGUE.md`.
- **GitHub Codespaces:** `.devcontainer/` levanta todo y carga el programa; enlace `https://<codespace>-3000.app.github.dev/app/`.
- **Repositorio:** https://github.com/Mijalys/nivia. La marca de clientes reales no se sube.
