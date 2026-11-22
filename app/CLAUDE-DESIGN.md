# Trabajar la UI de Nivia en Claude Design

Este es el punto de partida para rediseñar la app del aprendiz en Claude Design sin romper lo que ya funciona con el backend. El diseño cambia la apariencia y el orden de las cosas; los datos, las acciones y los estados salen del contrato con la API.

## Qué compartir con Claude Design

1. Este archivo.
2. [`CONTRATO-UI.md`](CONTRATO-UI.md): pantallas, datos disponibles, estados y errores.
3. [`fixtures/`](fixtures/): respuestas reales de la API para poblar los diseños con datos verdaderos.
4. [`styles.css`](styles.css): el sistema visual actual (tema D).
5. Capturas de la app en modo demo (ver abajo).

## Ver la app tal como está hoy

Desde la carpeta `nivia/`:

```bash
python3 -m http.server 4178
```

Abre en el navegador, en tamaño de celular:

- `http://localhost:4178/app/index.html?demo`: recorrido completo con evaluación aprobada.
- `http://localhost:4178/app/index.html?demo=desaprobado`: la evaluación no alcanza.
- `http://localhost:4178/app/index.html?demo=0`: sale del modo demo.

En modo demo cualquier correo y contraseña entran, y cada pantalla muestra las capturas de `fixtures/`.

## Sistema visual actual (tema D · Vidrio y lima)

| Elemento | Valor |
|---|---|
| Fuente | Inter Tight (300, 400, 500, 600, 700) |
| Fondo | `#0B0D09` con degradado radial teñido por el color principal de la empresa |
| Vidrio | `rgba(30, 36, 24, .58)` con `blur(22px) saturate(140%)` y borde `rgba(255, 255, 255, .10)` |
| Texto | `#F4F6EE`; secundario `#A9AF9C` |
| Correcto | `#B8F26B` sobre `rgba(184, 242, 107, .12)` |
| A repasar | `#F4A27A` sobre `rgba(244, 162, 122, .13)` |
| Color de la empresa | `--accent`, `--on-accent`, `--principal`, `--ptext`. Vienen de la API. Nivia usa lima `#D4FF3A`; Ríomar, naranja `#F26B1D` |
| Radios | Botones y cápsulas 99 px, tarjetas 26 px, filas 20 px, hojas 30 px, tarjeta principal 32 px |
| Tipografía | Título 28 px liviano con la palabra clave en 600; título grande 40 px en mayúsculas; pregunta 24 px/600; texto 18 px; secundario 15 y 13 px; rótulo 12 px en mayúsculas espaciadas |
| Ancho | Una columna de 480 px como máximo; márgenes de 20 px y zonas seguras del celular |

Componentes existentes (clases en `styles.css`): `btn` y `btn-primary` (cápsula de acción), `cta` (cápsula con perilla circular), `circ` (botón circular de vidrio), `seg2` (selector de pestañas), `ring2` (anillo de avance), `heroc` (tarjeta principal con portada), `stats` y `stat`, `pill` (estados), `map` (ruta como mapa), `lessonbtn` y `certitem` (filas), `opt` (opción de pregunta), `fb` y `fbdock` (retroalimentación del reto), `rules` y `rule`, `cert` (certificado en papel), `sheet` (hoja inferior), `tabs` (barra flotante), `lx-*` (lección a pantalla completa), `toast`, `netbar`.

## Reglas para diseñar

- **Solo datos del contrato.** Cada texto variable del diseño debe poder señalarse en un fixture. Si no está, no va, o se anota como pedido para la API.
- **Todos los estados.** Cada pantalla de `CONTRATO-UI.md` lista los estados que hay que dibujar: cargando, vacío, error, sin conexión, bloqueado.
- **Cualquier marca.** Probar cada pantalla con el acento lima y con el naranja de Ríomar. El color de la empresa va en la acción principal y el avance, no en todo.
- **Celular primero.** 375 px de ancho, toques de 48 px como mínimo, contraste AA (4,5:1), legible a pleno sol.
- **Lenguaje.** Español de Perú, de tú, frases cortas, sin tecnicismos. Los mensajes de error de la API ya vienen redactados.
- **Lo que no se cambia:** el flujo de pantallas y sus rutas (`#/inicio`, `#/leccion/<id>`…), las reglas de negocio (niveles en orden, reto antes de la evaluación, reloj del servidor) y la sesión.

## Qué entregar para llevarlo al código

- Por pantalla: el diseño de cada estado, con los nombres de campo del fixture junto a cada dato.
- Cambios de estilo expresados sobre las variables y clases existentes, o un componente nuevo con su nombre y sus variantes.
- Si se propone un dato o una acción nueva, una lista aparte de «pedidos a la API» con el porqué.

La implementación se hace en `app.js` (pantallas) y `styles.css` (estilo). `api.js` y `fixtures/` no se tocan desde el diseño: cambian solo si cambia la API, y entonces se recapturan con `npm run fixtures`.

## Instrucción lista para pegar en Claude Design

```text
Rediseña la app móvil del aprendiz de Nivia (capacitación corporativa con certificado) partiendo
del sistema visual de styles.css (tema D, vidrio y lima). Usa solo los datos de CONTRATO-UI.md y
puebla cada pantalla con las respuestas reales de fixtures/. Diseña todos los estados que lista el
contrato para cada pantalla. El color de la empresa llega de la API: valida cada pantalla con acento
lima (#D4FF3A) y naranja (#F26B1D). Celular de 375 px, toques de 48 px, contraste AA, español de Perú.
No agregues funciones que la API no tiene (ver «Lo que la API NO tiene»); si algo hace falta,
anótalo como pedido a la API.
```
