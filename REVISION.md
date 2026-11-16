# Nivia · Revisión del estado y mejoras propuestas

**Fecha:** 16 de noviembre de 2026
**Qué revisé:** los dos README de diseño (Corte 1 y Corte 2), los cuatro prototipos, la propuesta de arquitectura y el backend (código y pruebas).

## Resumen en una línea

Tenemos mucho artefacto y poca validación: dos prototipos navegables, un backend que pasa pruebas y tres documentos, pero ninguna prueba con un operario real, nada versionado en git, y el prototipo y el backend no se hablan. Lo que más mejoraría el proyecto no es más código, sino cerrar esos tres huecos en ese orden.

## Lo que está bien y conviene mantener

- **Diseño primero, con hipótesis medibles.** Cada corte tiene H1 a H4 con tarea, métrica y criterio de éxito. Eso es raro y vale.
- **Lenguaje cotidiano en todos los estados.** "Sin señal", "Pendiente de enviar", "Repasemos". Consistente entre documentos, prototipo y códigos de error del backend.
- **El servidor manda en lo que da valor legal.** Evaluación, nota y certificado se deciden en el servidor; el reto, de bajo riesgo, funciona sin señal. Es la decisión de arquitectura más importante y está bien tomada.
- **Aislamiento por cliente en la base** (RLS), probado: un cliente no puede leer ni escribir datos de otro.
- **Avance idempotente por `event_id`.** Reenviar un lote no duplica nada; lo rechazado se guarda con motivo.

## Mejoras, en orden de impacto

### 1. Probar con 3 operarios antes de escribir más código

**Por qué.** Todo el proyecto existe para responder H1 a H4, y aún no se observó a nadie. Cada semana de código sin esa prueba se construye sobre supuestos: que el camino punteado se entiende, que "Pendiente de enviar" se lee, que descargar antes de perder señal es un comportamiento natural. Si alguno falla, cambia el diseño, el backend y los prototipos a la vez.

**Qué haría.** Una sesión de 30 minutos con 3 personas (idealmente 2 operarios y 1 de oficina), con el prototipo publicado, guion de tareas ya escrito en los README, y una hoja de registro: tiempo, toques, dudas en voz alta, pantalla donde se detuvo. Antes de la sesión, 3 ajustes rápidos al prototipo:

- Quitar la barra DEMO para el participante (hoy visible desde el inicio) y dejarla al facilitador en otra pestaña.
- Reemplazar el video de demostración: tiene marca de agua de otro canal y subtítulos quemados, y dura 27 s para lecciones que dicen "4 min". Un operario va a notar la incoherencia.
- Desactivar el orbe animado en la pantalla de ingreso. Es WebGL en celulares de gama media: consume batería y puede retrasar el primer toque, justo lo que mide H1.

### 2. Versionar en git hoy

**Por qué.** No hay repositorio. Hay cuatro copias del prototipo (1.273 a 1.688 líneas cada una), con lógica duplicada a mano. Cualquier ajuste al Corte 1 hay que repetirlo en la copia del cliente con marca propia, en Corte 2 y en Corte 2 de ese cliente. Sin historial, no se puede saber qué cambió ni volver atrás.

**Qué haría.**

- `git init` en `nivia/` con el `.gitignore` del backend extendido (`node_modules`, `.data`, `storage`, `media/*.mp4`).
- Colapsar los cuatro prototipos en **uno**: el de Corte 2 ya contiene el Corte 1 y la marca es un dato de configuración, no una copia del archivo. El cliente con marca propia pasa a ser un tercer cliente en `CLIENTS` detrás del selector oculto, igual que Ríomar y Altavista. Resultado: un archivo en lugar de cuatro.
- El video pesado (2,6 MB) fuera del repo o con Git LFS.

### 3. Conectar el prototipo al backend con un adaptador, no reescribiendo

**Por qué.** Hoy el prototipo simula todo en memoria y el backend simula el frontend en pruebas. Nadie ha comprobado que los contratos coinciden. Ya hay una diferencia: el prototipo identifica lecciones por índice (`a1`, `a2`), el backend por UUID y asignación. Cuanto más tarde se conecten, más caro.

**Qué haría.** En el prototipo, una capa `api.js` con las mismas funciones que hoy leen `S.db` (`login`, `home`, `lesson`, `sync`, `startExam`…) y dos implementaciones: `mock` (la actual) y `http` (contra `localhost:3000`). Un interruptor en el panel DEMO. Así el prototipo sigue sirviendo para pruebas de usabilidad sin servidor, y a la vez valida la API.

### 4. Corregir cinco puntos concretos del backend

| # | Problema | Por qué importa | Arreglo |
|---|---|---|---|
| B1 | `GET /lessons/:id` entrega `correct_index` y `why` de las preguntas del reto, y esas mismas preguntas se usan en la evaluación final (`in_exam = true`). | Un aprendiz con curiosidad técnica ve las respuestas de la evaluación en la respuesta de red de cualquier lección. | Separar bancos: preguntas de reto (`in_quiz`) con respuesta en el cliente, y preguntas de evaluación (`in_exam`) distintas, que nunca viajan con `correct_index`. El seed hoy pone las mismas 3 por lección en ambos; hacen falta 2 o 3 más por lección solo para evaluación. |
| B2 | La tabla `outbox` recibe `certificate.issued` pero nadie la consume. El PDF se genera en cada descarga. | Está bien para la demo, pero el documento de arquitectura promete PDF generado una vez y guardado. Hoy el código y el documento dicen cosas distintas. | O quitar el `outbox` hasta que exista un trabajador, o escribir el trabajador mínimo (un `setInterval` que genera el PDF a `storage/certificates/<id>.pdf`). Prefiero lo segundo: 40 líneas y deja el patrón listo. |
| B3 | `sweepExpired` cierra intentos abandonados uno por uno, reutilizando `get()` con un `AuthCtx` falso (`sessionId: ''`). | Funciona, pero mezcla un camino de usuario con uno de sistema; con 1.500 intentos abiertos en un cambio de turno hace 1.500 transacciones por minuto. | Una sola consulta de sistema que cierre en lote los intentos con `time_used_s + gap > time_limit_s`, y califique en la misma transacción. |
| B4 | El límite de intentos de ingreso vive en memoria y solo se aplica por celular, no por IP. | Con dos instancias el límite se divide; y un atacante que rota celulares no tiene freno. | Redis o la propia base (`rate_limit` con `upsert`), y segunda clave por IP con límite más alto. |
| B5 | `enableCors({ origin: true })` acepta cualquier origen. | En desarrollo es cómodo; en producción permite que cualquier sitio llame a la API con el token del usuario si ese token se filtra. | Lista de orígenes por cliente (`tenant_domain` ya está en el modelo de datos del documento, pero no en la migración). |

### 5. Alinear el documento de arquitectura con lo que se construyó

**Por qué.** El documento dice `deadline_at` y la implementación usa `time_used_s` con pausa (mejor, porque soporta el corte de señal), dice `POST /attempts` y la API es `POST /assignments/:id/attempts`, menciona `tenant_domain` y `manual_chunk` que no existen en la migración. Un desarrollador nuevo va a confiar en el documento y chocar.

**Qué haría.** Una sección "Estado de implementación" al final, con una tabla módulo por módulo: hecho, parcial, no empezado. Y mover a "no empezado" lo que es solo diseño: pipeline de IA, consola, `tenant_domain`, `manual_chunk`, colas.

### 6. Decidir PWA vs. contenedor nativo con una prueba de 1 día, no con un documento

**Por qué.** Es la decisión abierta (D8) con más riesgo en el Corte 2: iOS puede borrar el almacenamiento de una web no instalada, y Android de gama media tiene cuotas pequeñas. Toda la experiencia "aprender sin señal" depende de esto, y hoy solo hay una línea de riesgo (R1) en el documento.

**Qué haría.** Un HTML de 100 líneas con service worker que descargue 3 videos de 8 MB a Cache Storage, pida `storage.persist()`, y muestre `storage.estimate()`. Probarlo en 3 celulares reales (un iPhone, un Android de gama media, un Android viejo), apagar los datos y abrirlo al día siguiente. Esa tarde se sabe si la PWA alcanza.

### 7. Reducir el peso simulado al real y cambiar la hipótesis de descarga

**Por qué.** El README del Corte 2 simula 15 a 90 MB por lección, pero la arquitectura calcula 5 a 8 MB para 4 minutos a 360p. Con el peso real, "Sin espacio" casi nunca ocurre y "Descargar lo que sigue" podría ser "descargar toda la ruta" (unos 30 MB). Eso simplifica N2 (selección) y N8 (sin espacio) a casos de borde.

**Qué haría.** Mantener N2 y N8 en el prototipo para la prueba de usabilidad (sirven para H4), pero en el documento añadir el supuesto de que, con pesos reales, el camino por defecto es descargar la ruta completa y la selección queda como opción avanzada.

### 8. Código: dos limpiezas que pagan rápido

- **El prototipo es un solo archivo de 1.700 líneas con HTML, CSS y JS.** Para una prueba de usabilidad está bien; para conectarlo al backend conviene separar `data.js` (contenido), `state.js`, `screens.js` y `styles.css`. No un framework, solo archivos.
- **`learning.ts` tiene 368 líneas y mezcla Inicio, ruta, lección, paquete, sync y reportes.** Separar `sync.ts` (eventos y reglas de combinación) porque es la lógica con más riesgo y la que más pruebas va a necesitar.

## Lo que NO cambiaría

- **Un solo backend modular en lugar de microservicios.** Correcto para el tamaño del equipo.
- **PGlite para desarrollo y pruebas.** Las 18 pruebas corren en 5 segundos sin instalar nada. Vale la pena, aunque haya que correr una vez la suite contra PostgreSQL real antes de desplegar.
- **Reloj inyectable en las pruebas.** Permite probar la espera de 1 hora y el cierre por tiempo sin esperar.
- **Dos clientes ficticios con contraste AA calculado**, y el seed que rechaza marcas que no pasan AA. Es una regla de producto convertida en código.

## Orden sugerido para las próximas dos semanas

| Semana | Qué | Resultado |
|---|---|---|
| 1 | git + un solo prototipo + los 3 ajustes previos a la prueba + sesión con 3 operarios | Saber si H1 a H4 se cumplen; lista de cambios de diseño |
| 1 | Prueba de 1 día de PWA sin señal en 3 celulares | Decisión D8 cerrada |
| 2 | B1 y B2 en el backend; adaptador `api.js` en el prototipo | Prototipo corriendo contra la API real |
| 2 | Sección "Estado de implementación" en la arquitectura | Documento confiable para quien entre al proyecto |

Lo demás (B3 a B5, pipeline de IA, consola) espera a ver qué dice la prueba con usuarios.
