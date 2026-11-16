# Nivia · Corte 2 · Aprender donde no hay señal

Documento de diseño de **qué construir**. Extiende el prototipo del Corte 1 (rol aprendiz) y solo describe lo nuevo. Se mantienen dirección visual, marca blanca y pantallas P1 a P18. Español de Perú, tuteando.

## 1. Objetivo del corte y qué NO valida

**Objetivo:** comprobar que el aprendiz entiende cuándo tiene señal, qué lecciones tiene listas en su celular y si su avance ya quedó guardado o falta enviarlo, y que confía en que no pierde lo avanzado.

**Qué NO valida:** la viabilidad técnica. No mide el peso real de los videos, los tiempos de descarga, el espacio de almacenamiento ni el comportamiento del navegador sin red. Todo eso se simula y esta prueba no sirve para decidirlo.

**Simulación.** En modo demostración (como en el Corte 1) aparece una barra fija abajo, solo para quien conduce la prueba:

- **Señal:** "Con señal" / "Sin señal".
- **Descargas:** "Normales" / "Lentas" / "Fallan".
- **Envío del avance:** "Funciona" / "Falla".
- **Espacio libre:** "3,4 GB" / "300 MB" / "40 MB".

## 2. Hipótesis a validar

Se registra tiempo, toques, dudas dichas en voz alta y pantalla donde se detuvo.

- **H1. Deja lecciones listas antes de perder la señal.** Tarea, como Carlos: "Mañana trabajas en una zona sin señal. Deja lista tu próxima capacitación." Éxito: descarga al menos una lección en menos de 90 s, sin ayuda.
- **H2. Distingue qué puede hacer sin señal.** Como Rosa, sin señal: "¿Qué puedes hacer ahora y qué no?"; luego intenta abrir una lección no descargada y la evaluación. Éxito: separa lo descargado y sus retos (sí) de lo no descargado y la evaluación (no).
- **H3. Entiende "pendiente de enviar" y "guardado".** Rosa resuelve un reto sin señal: "¿Dónde está tu avance?". Vuelve la señal: "¿Y ahora?". Éxito: primero "en el celular, falta enviarlo"; después "ya quedó guardado".
- **H4. Resuelve problemas de descarga.** Luis termina su descarga fallida; Marisol descarga con poco espacio. Éxito: ambos lo logran sin ayuda.

## 3. Usuarios y contexto de uso

- **Operario de campo** (principal): celular propio de gama media, poco espacio, datos limitados. Pasa de zonas con señal (comedor, garita) a zonas sin señal (planta, campo). Poca experiencia digital y poca paciencia con mensajes técnicos.
- **Personal de oficina** (secundario): casi siempre con wifi; descarga al viajar.

Consecuencias de diseño:

- Se descarga cuando hay señal: la invitación está a la vista en Inicio y Ruta.
- El estado del avance siempre se ve.
- Nunca se dice offline, caché ni sincronización; se dice "Sin señal", "guardado en este celular", "pendiente de enviar".
- Perder la señal es normal: se informa con calma, nunca como error.

## 4. Cambios en la navegación y en pantallas existentes

**Navegación.** La barra inferior no cambia. "Mis descargas" (N1) es una pantalla interna con "Atrás". Se entra desde el botón "Mis descargas" en Inicio, la fila "Mis descargas · 3 lecciones · 150 MB" en Perfil y el aviso de sin espacio.

**Indicador de conexión y avance** (componente nuevo). Franja discreta y fija arriba de Inicio y de la Ruta, bajo el encabezado del cliente. Siempre con ícono y texto; al tocarla abre el detalle (N6). Reemplaza la franja "Sin conexión" del Corte 1 en esas dos pantallas.

| Situación | Ícono | Texto |
|---|---|---|
| Con señal, todo enviado | nube con check | "Todo tu avance está guardado" |
| Con señal, enviando | flechas en círculo | "Enviando tu avance…" |
| Sin señal, sin pendientes | señal tachada | "Sin señal · Puedes usar tus lecciones descargadas" |
| Sin señal, con pendientes | reloj | "Sin señal · 1 lección pendiente de enviar" |
| Envío fallido | flecha circular | "No pudimos enviar tu avance · Reintentar" |

**Inicio (P5).** Indicador arriba. En "Sigue donde te quedaste", estado de descarga de la lección siguiente: "Lista sin señal" o "Descargar para ver sin señal · 78 MB". Botón secundario "Descargar lo que sigue" con señal. Sin señal, "Continuar" abre la siguiente lección descargada; si no hay, abre N5.

**Ruta (P6).** Indicador arriba. Cada lección muestra su estado de descarga (N4) y, si aplica, "Pendiente de enviar". Botón nuevo "Descargar para ver sin señal" (abre N2). Sin señal, lo no descargado se ve atenuado con "Necesita señal", pero sigue visible.

**Lección (P7).** Descargada: funciona completa sin señal, sin avisos que interrumpan. No descargada y sin señal: abre N5. Si la señal se va durante una no descargada: "Se fue la señal y esta lección no está descargada. Te quedaste en 2:10." con "Ver lo que tengo descargado".

**Reto (P8) y Lección completada (P9).** Sin señal funcionan igual y muestran "Pendiente de enviar": "Tu avance está guardado en este celular. Se enviará solo cuando vuelva la señal."

**Reglas de la evaluación (P10).** Nuevo dato destacado: "Necesitas señal durante toda la evaluación." Sin señal se muestra N9; si la señal se va en P11 o P12, N10.

**Perfil (P17).** Fila "Mis descargas"; sin señal, "Cambiar contraseña" desactivado con el motivo.

## 5. Flujos nuevos

1. **Descargar:** Inicio o Ruta → "Descargar lo que sigue" (próximas 2 lecciones no descargadas) → N3 → N4. O Ruta → "Descargar para ver sin señal" → N2 → N3 → N4.
2. **Gestionar descargas:** Inicio o Perfil → N1 → "Quitar" o "Quitar lo ya completado".
3. **Aprender sin señal:** se va la señal → aviso breve (N5) → sigue con lo descargado. Algo no descargado → N5 bloqueo.
4. **Enviar el avance:** hecho sin señal → "Pendiente de enviar" → vuelve la señal → "Enviando tu avance…" → "Tu avance ya está guardado". Si falla → "Reintentar" (N6).
5. **Evaluación sin señal:** antes de empezar → N9; a mitad → N10. Enviar exige señal.
6. **Problemas de descarga:** falla → N7; sin espacio → N8; interrumpida → "En pausa · 62 %", se retoma sola desde ahí.

## 6. Pantallas nuevas y sus estados

Cargando, vacío, error y sin conexión siguen los patrones del Corte 1 salvo lo indicado.

**N1. Mis descargas.**
- Propósito: ver qué está listo sin señal y cuánto ocupa.
- Acción principal: "Quitar lo ya completado"; si no hay completadas, "Descargar lo que sigue".
- Contenido: barra "Usas 150 MB · Te quedan 2,1 GB libres". Lista por ruta: título, nivel, peso, estado (N4), "Pendiente de enviar" si aplica, y "Quitar" con ícono de tacho. Confirmación: "¿Quitar «Aislar la energía»? Liberas 38 MB. Tu avance no se borra."
- Aviso de liberación (SUPUESTO): "Ya completaste «Aislar la energía». Quitaremos su descarga mañana para liberar 38 MB." con "Quitar ahora" y "Mantener".
- Cargando: bloques planos. Vacío: "Aún no tienes lecciones descargadas. Descárgalas con señal para verlas en planta o en campo." y "Descargar lo que sigue". Error: "No pudimos revisar tus descargas." y "Volver a intentar". Sin conexión: lista y "Quitar" funcionan; descargar se desactiva: "Necesitas señal para descargar".

**N2. Selección de descargas** (dentro de la Ruta).
- Propósito: elegir qué llevarse.
- Acción principal: "Descargar 112 MB" (cambia con el total).
- Contenido: atajo "Descargar lo que sigue (2 lecciones · 112 MB)". Niveles con casilla de nivel completo y su total ("Nivel 3 · 78 MB"). Lecciones con casilla, peso y estado; las ya descargadas dicen "Lista sin señal" y no se eligen. Barra fija: "2 lecciones · 112 MB · Te quedan 2,1 GB libres".
- Cargando: casillas desactivadas. Vacío: "Ya tienes todo descargado." y "Ver mis descargas". Error: patrón. Sin conexión: no se abre; se muestra N5.

**N3. Confirmación de descarga** (hoja inferior).
- Propósito: ver el tamaño antes de gastar datos o espacio.
- Acción principal: "Descargar". Secundario: "Cancelar".
- Contenido: lecciones con su peso; total en grande ("112 MB"); "Después te quedarán 2,0 GB libres."; "Si puedes, usa wifi para no gastar tus datos." Si el total supera el espacio libre, se abre N8.
- Error o sin conexión al confirmar: "Se fue la señal. Tu selección queda guardada; descarga cuando vuelva."

**N4. Estado de descarga por lección** (componente en Ruta, Inicio, N1 y N2). Siempre ícono y texto:

| Estado | Ícono | Texto |
|---|---|---|
| No descargada | flecha abajo | "Descargar · 78 MB" |
| En espera | reloj | "En espera" |
| Descargando | anillo de progreso | "Descargando 45 %" y "Cancelar" |
| En pausa | pausa | "En pausa · 62 %. Seguirá cuando vuelva la señal" |
| Lista | celular con check | "Lista sin señal" |
| Con error | flecha circular | "No se pudo descargar · Intentar de nuevo" |

"Lentas": unos 20 s por lección y "Esto puede demorar unos minutos". "Fallan": se detiene en 40 % y abre N7.

**N5. Aviso de sin señal.**
- Aviso breve, al perder la señal: franja calmada de 4 s, "Te quedaste sin señal. Tus lecciones descargadas siguen funcionando." Luego queda el indicador.
- Versión bloqueo (hoja al tocar algo no descargado). Propósito: explicar y ofrecer qué sí hacer. Acción principal: "Ver mis lecciones descargadas" ("Volver a Inicio" si no hay). Contenido: "Esta lección necesita señal. No la descargaste antes." y "Puedes hacer ahora": lecciones descargadas con sus retos, Mis certificados, último resultado. Vacío (sin descargas): "Cuando tengas señal, descarga lo que sigue." Cargando y error no aplican.

**N6. Avance pendiente y avance guardado.**
- Propósito: que siempre sepa dónde está su avance.
- Acción principal: "Reintentar" si falló el envío; si no, "Entendido".
- Contenido: pastilla "Pendiente de enviar" con reloj en cada lección afectada. Hoja al tocar el indicador: "Tu avance está guardado en este celular. Se enviará solo cuando vuelva la señal." con cada pendiente y su hora ("Reto de «Candado y tarjeta» · hoy 10:12"). Al enviarse: aviso de 3 s con check, "Tu avance ya está guardado", y la pastilla desaparece.
- Cargando: "Enviando tu avance…". Vacío: "Todo tu avance está guardado." Error: "No pudimos enviar tu avance. Sigue guardado en este celular." y "Reintentar". Sin conexión: es su estado normal, sin reintentar.

**N7. Descarga fallida** (hoja).
- Propósito: recuperar la descarga sin ayuda.
- Acción principal: "Intentar de nuevo". Secundario: "Quitar esta descarga".
- Contenido: "No se pudo descargar «Verificar y devolver el equipo». La señal se cortó o está muy débil." "Lo que ya bajó se guarda: seguirá desde 40 %." "Acércate a una zona con mejor señal o usa wifi." Tras tres fallos: "Si sigue fallando, intenta más tarde con wifi."
- Cargando: "Descargando 40 %". Sin conexión: botón desactivado, "Necesitas señal para descargar".

**N8. Sin espacio** (hoja).
- Propósito: decir cuánto falta y cómo liberarlo.
- Acción principal: "Quitar lo ya completado (libera 100 MB)".
- Contenido: "Tu celular no tiene espacio suficiente. Para descargar estas lecciones te faltan 72 MB." "Puedes quitar lecciones que ya completaste. Tu avance no se borra." Lista de completadas descargadas con su peso. Secundarios: "Elegir menos lecciones" (vuelve a N2) y "Liberar espacio en tu celular" (sugiere borrar fotos o apps que no usa). Tras quitar: "Listo, ahora tienes 140 MB libres." y "Descargar 112 MB".
- Vacío: sin completadas que quitar, solo "Elegir menos lecciones" y el consejo.

**N9. Evaluación sin señal** (en lugar de P10).
- Propósito: explicar que necesita señal, sin alarmar.
- Acción principal: "Reintentar". Secundario: "Seguir con mis lecciones descargadas".
- Contenido: señal tachada, "La evaluación necesita señal." "Tu avance está guardado. Cuando tengas señal, vuelve aquí para rendirla." Recordatorio de nota mínima, intentos y duración. "Reintentar" sin señal: "Aún sin señal. Prueba en otra zona."; con señal abre P10.

**N10. Evaluación interrumpida.**
- Propósito: conservar las respuestas y reanudar.
- Acción principal: "Reanudar evaluación", activa solo con señal.
- Contenido: "Se fue la señal. Tus respuestas están guardadas y el tiempo está en pausa." "Respondiste 6 de 10 · Te quedan 9:40". Al volver: "Volvió la señal. Puedes seguir donde te quedaste." "Salir" guarda todo. En Revisar respuestas, "Enviar evaluación" desactivado: "Necesitas señal para enviar. Tus respuestas están guardadas."
- Error al reanudar: "No pudimos retomar la evaluación. Tus respuestas siguen guardadas." y "Reintentar".

## 7. Reglas de comportamiento sin conexión

| Acción | Con señal | Sin señal |
|---|---|---|
| Ver lección descargada | Sí. | Sí, completa: video, subtítulos, velocidad y resumen. |
| Ver lección no descargada | Sí, en línea. | No. Muestra título y "Necesita señal"; abre N5. |
| Resolver reto de lección descargada | Sí; se guarda al momento. | Sí; queda "Pendiente de enviar". |
| Resolver reto de lección no descargada | Sí. | No; el reto viene con la lección. |
| Rendir evaluación final | Sí. | No se puede empezar (N9). Si se corta a mitad: respuestas conservadas y tiempo en pausa (N10). Enviar exige señal. |
| Ver resultado ya obtenido | Sí. | Sí, el último visto en este celular. |
| Ver certificado ya obtenido | Sí. | Sí, si se abrió antes en este celular. |
| Descargar certificado en PDF | Sí. | No: "Necesitas señal para descargar el PDF". |
| Emitir certificado | Solo tras aprobar. | No. |
| Ver Inicio y avance | Sí, actualizado. | Sí, con lo guardado en el celular, lo pendiente y "Actualizado hoy 08:15". |
| Descargar lecciones | Sí. | No; una descarga en curso queda en pausa. |
| Quitar descargas | Sí. | Sí. |
| Cambiar contraseña | Sí. | No: "Necesitas señal para cambiar tu contraseña". |
| Ingresar a la app | Sí. | Solo si la sesión ya estaba abierta en este celular. |

## 8. Contenido y datos simulados

**Fecha simulada:** martes 10 de noviembre de 2026, 15:40 (como en el Corte 1).

**Pesos por lección** (con presentador pesan más que las animadas):

| Ruta 1 · Ríomar | Peso | Ruta 2 · Altavista | Peso |
|---|---|---|---|
| N1 Por qué bloqueamos | 62 MB | N1 Tu acceso y tu bandeja | 56 MB |
| N2 Aislar la energía | 38 MB | N2 Crear una solicitud de compra | 41 MB |
| N3 Candado y tarjeta | 78 MB | N2 Enviar y corregir la solicitud | 64 MB |
| N4 Verificar y devolver el equipo | 34 MB | N3 Aprobaciones y seguimiento | 36 MB |
| **Total** | **212 MB** | **Total** (Nivel 2: 105 MB) | **197 MB** |

**Aprendices** (en ambos clientes; ejemplos con la Ruta 1):

| Aprendiz | Espacio libre | Estado |
|---|---|---|
| Carlos | 3,4 GB | Sin descargas, primer ingreso ya hecho, 0 %. |
| Rosa | 2,1 GB | 40 % enviado. Lecciones 2, 3 y 4 descargadas (150 MB). Reto de la lección 3 "Pendiente de enviar" (hoy 10:12); al enviarse, 60 %. La lección 2, completada, dispara el aviso de liberación. |
| Luis | 1,5 GB | Ruta vencida, 60 %. Lección 4 "No se pudo descargar" en 40 %. |
| Marisol | 40 MB | Renovación de su certificado (vence el 30/11/2026): ruta reiniciada, 40 %. Lecciones 1 y 2 completadas y aún descargadas (100 MB). "Descargar lo que sigue" (lecciones 3 y 4, 112 MB) abre N8: faltan 72 MB. |

**Otros textos ya redactados:**

- Vuelve la señal sin pendientes: "Volvió la señal."
- Vuelve con pendientes: "Volvió la señal. Enviando tu avance…" y luego "Tu avance ya está guardado".
- Descarga terminada: "Listo. «Candado y tarjeta» ya está lista para ver sin señal."
- Descarga quitada: "Quitaste «Aislar la energía». Liberaste 38 MB."
- "Continuar" sin señal ni descargas: "Para seguir sin señal, primero descarga tus lecciones cuando tengas señal."

## 9. Supuestos

Cada uno puede retirarse sin romper el flujo.

1. Del brief: la descarga de una lección completada se libera sola al día siguiente, con aviso y opción "Mantener".
2. "Descargar lo que sigue" toma 2 lecciones.
3. Reto y resumen vienen con su lección.
4. Sin señal se ven el último resultado y el certificado ya abiertos.
5. PDF del certificado solo con señal.
6. Cambiar contraseña necesita señal.
7. Sin señal solo se ingresa con sesión ya abierta.
8. Evaluación cortada: el tiempo se pausa.
9. Descarga interrumpida: se retoma sola donde quedó.
10. El prototipo no distingue wifi de datos.
11. Marisol renueva su certificado, para probar sin espacio.
12. El indicador reemplaza la franja "Sin conexión" del Corte 1.
13. Tras tres fallos se sugiere wifi.

## 10. Fuera de alcance

Ranking, premios, puntos e insignias, compartir certificado, preferencias de notificación, perfil avanzado, evaluación sin conexión, roles de administrador o supervisor, backend, almacenamiento real en el dispositivo, sincronización real, descarga automática en segundo plano e idiomas distintos al español.
