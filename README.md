# Nivia · Corte 1 · Recorrido del aprendiz

Documento de diseño de **qué construir** para un prototipo solo frontend, web adaptable, móvil primero, con datos simulados. Todo texto de la interfaz va en español de Perú, tuteando.

## 1. Objetivo del prototipo

Decidir si el recorrido central funciona para un operario con poca experiencia digital: ingresar, saber qué le toca y para cuándo, aprender en lecciones cortas, rendir la evaluación y obtener su certificado. Se recorre completo, sin ayuda, con cuatro aprendices simulados y dos clientes de marca blanca. No valida contenido real, rendimiento ni seguridad.

## 2. Hipótesis a validar

En cada sesión se registra tiempo, toques, dudas dichas en voz alta y pantalla donde se detuvo.

- **H1. Primera lección en menos de 1 minuto.** Tarea: "Entra como Carlos y empieza tu capacitación." Se mide desde Ingreso hasta que el video de la lección 1 se reproduce. Éxito: menos de 60 s sin ayuda. Lo sostiene: primer ingreso en dos pasos cortos y "Continuar" en Inicio, que abre directo la lección pendiente.
- **H2. Entiende por qué falló y qué repasar.** Tarea: como Rosa, responder mal la pregunta 1 de "Aislar la energía" y explicar con sus palabras por qué falló. Éxito: menciona que apagar no basta y señala qué repasar. Lo sostiene: "Repasemos" con el "por qué" y enlace al minuto del video.
- **H3. Entiende las reglas antes de empezar.** Tarea: abrir la evaluación de la Ruta 1 y, sin empezar, responder: ¿con cuánto apruebas?, ¿cuántos intentos tienes?, ¿qué pasa si desapruebas? Éxito: 3 de 3 correctas. Lo sostiene: pantalla de reglas con cuatro datos grandes y la consecuencia escrita.
- **H4. Encuentra y descarga su certificado.** Tarea: "Como Marisol, descarga tu certificado." Éxito: llega a "Descargar PDF" sin ayuda, en 3 toques o menos desde Inicio. Lo sostiene: pestaña "Mis certificados" y aviso de vencimiento en Inicio.

## 3. Usuarios y contexto de uso

- **Operario de campo** (Corporación Ríomar): celular propio de gama media, 360 px, datos móviles irregulares. Ratos de 5 a 10 minutos entre tareas, a veces con guantes, una mano ocupada o ruido. Usa WhatsApp y YouTube; no lee textos largos.
- **Personal de oficina** (Grupo Altavista): celular o laptop, wifi estable, sesiones de 15 a 30 minutos.

Misma experiencia para ambos. Consecuencias: todo con el pulgar, en vertical, acción principal abajo; video entendible sin audio (subtítulos); lección que cabe en un rato (video de 3 a 5 minutos y reto de 3 preguntas); "Continuar" retoma donde se quedó; en laptop, columna central de máximo 560 px.

## 4. Dirección visual y tono

**Carácter:** sobrio y cercano, como un buen instructor de planta. El juego se nota en el avance (niveles que se desbloquean, barra que se llena, sello al completar), no en adornos.

- Un solo botón principal por pantalla: ancho completo, abajo, 56 px de alto. Todo elemento táctil mide al menos 48 × 48 px.
- Cuerpo 18 px, títulos 26 a 32 px, nunca menos de 14 px.
- Íconos de línea de 24 px, siempre con texto.
- Márgenes laterales de 20 px, 24 px entre bloques. Base: 360 px de ancho.
- Fondo oscuro; bloques en superficies planas un tono más claras, esquinas de 20 px, sin sombras.

**Identidad base Nivia** (de los mockups de marca). El aprendiz ve la marca del cliente, pero la estructura visual es la de Nivia:

- Tipografía geométrica con contraste de pesos: fino para el contexto, extranegrita para lo clave ("Aislar la **energía**").
- Sobretítulos en mayúsculas espaciadas y color de acento: "NIVEL 2 · AISLAR LA ENERGÍA".
- Botón principal relleno del color de acento con texto oscuro; secundario con borde fino.
- Estados en pastillas redondeadas con ícono y texto.
- La ruta como camino punteado curvo con nodos: check (completado), reproducir con halo (en curso), círculo vacío (pendiente), candado (bloqueado).
- El lima de Nivia se reemplaza siempre por el acento del cliente. Nivia solo aparece como "Con Nivia" en Perfil.
- Prohibido: degradados azul-morado, emojis como íconos, confeti, mascotas, frases de startup.
- Orientación permanente: arriba se ve dónde está (Ruta · Nivel), cuánto falta (barra y "Pregunta 2 de 3") y qué sigue (texto del botón).

**Paleta de marca blanca** (contraste WCAG 2.1 calculado; todo texto pasa AA):

| Rol | Ríomar | Altavista | Uso |
|---|---|---|---|
| Acento | Naranja seguridad `#F26B1D` | Amarillo cálido `#F2B630` | Botón principal, nodo en curso, sobretítulos, barras. Fondo oscuro encima: 6,3:1 y 10,5:1. Sobre superficie: 5,6:1 y 9,4:1. |
| Principal | Azul petróleo `#0E4D5C` | Verde bosque `#1F4D3A` | Franja de encabezado y certificado. Texto claro encima: 8,4:1 y 8,6:1. |
| Principal para texto | `#7CC3D0` | `#8FD0A5` | Enlaces sobre superficie: 8,6:1 y 9,5:1. |
| Base común | fondo `#0E0F11`, superficie `#1A1C20`, texto `#F2F2F0`, secundario `#A3A6AD` | | Texto 17,1:1; secundario 7,0:1. |

**Estados**, comunes a ambos clientes:

- Completado o acierto: check en círculo, `#7FD69B` sobre `#16261C` (9,0:1), "Correcto".
- Repaso: flecha circular, `#F4A27A` sobre `#2B1A12` (8,2:1), "Repasemos". Nunca rojo alarma, cruz grande ni "Incorrecto".
- Bloqueado: candado, `#A3A6AD`, "Bloqueado · Completa el Nivel 2".
- En curso: reproducir con halo de acento, "En curso".
- Vencido: reloj con exclamación, `#F4A27A`, "Venció el 31 oct".

**Orbe fluido.** Esfera luminosa de aspecto líquido, como en la identidad Nivia, teñida con el acento del cliente, con movimiento lento. Se usa en tres lugares: detrás del logo en Ingreso (160 px), en la espera del video (P7) y en el resultado aprobado (P13, 200 px). Máximo uno por pantalla. El texto nunca va encima. No representa a la IA ni a un asistente. Con "reducir movimiento" activo, se muestra quieto.

**Video:** portada 16:9, botón reproducir central de 64 px, etiqueta de formato ("Con presentador" o "Animado"), duración ("4:12") y etiqueta discreta "Hecho con IA".

**Tono:** frases cortas, verbos de acción, vocabulario de la operación: "Te faltan 2 lecciones y la evaluación", "Vence el viernes 20 de noviembre", "Casi. Repasemos por qué".

## 5. Arquitectura de navegación

```
Acceso (sin barra inferior)
  Ingreso → [primer ingreso] Crea tu contraseña → Completa tus datos → Inicio
  Ingreso → Recuperar contraseña → Ingreso

Barra inferior fija: Inicio · Mis certificados · Perfil
  Inicio → Ruta → Lección → Reto → Lección completada → Ruta
         Ruta → Reglas → Evaluación → Revisar respuestas → Resultado → Certificado
  Mis certificados → Certificado
  Perfil
```

- **Pantalla completa** (sin barra inferior, "Salir" arriba a la izquierda, barra de progreso arriba): Lección, Reto, Reglas, Evaluación, Revisar respuestas, Resultado.
- Salir de una lección guarda el minuto sin preguntar. Salir de la evaluación pide confirmación: "Tus respuestas se guardan. El tiempo sigue corriendo."
- Ruta y Certificado son pantallas internas con barra inferior y "Atrás".
- No existen Ranking, Premios ni Descargas.
- **Modo libre:** Ruta es una lista de niveles con estado; en modo libre todos quedarían "Disponible" sin cambiar la estructura. Solo se muestra el secuencial.
- **Panel de demostración (oculto):** se abre manteniendo presionado el logo 2 s en Ingreso o Perfil. Cambia cliente y aprendiz, activa "Sin conexión", fuerza video fallido, fuerza cargando, vacío o error en la siguiente pantalla, fuerza el resultado y restablece datos. Con el modo demostración activo, una pestaña "Demo" visible al borde abre el interruptor de conexión.

## 6. Flujos del corte 1

1. **Ingresar:** P1 → primer ingreso: P2 → P3 → P5. Olvido: P4 → P1.
2. **Inicio:** P5; "Continuar" abre la siguiente lección pendiente; capacitaciones ordenadas por urgencia (vencidas primero, luego fecha límite).
3. **Ruta:** P6, secuencial.
4. **Lección y reto:** P7 → P8 → P9.
5. **Evaluación:** P10 → P11 → P12.
6. **Resultado:** P13 o P14.
7. **Certificado:** P15, P16.

## 7. Pantallas y sus estados

**Patrones comunes**, salvo que la pantalla diga otra cosa:

- **Cargando:** bloques planos con la forma del contenido. A los 8 s: "Está demorando más de lo normal" y "Volver a intentar".
- **Vacío:** ícono de línea, una frase de qué pasa y una acción.
- **Error:** "No pudimos cargar [cosa]. Revisa tu señal." y "Volver a intentar". Lo escrito se conserva.
- **Sin conexión:** franja fija arriba: "Sin conexión. Lo que ya cargaste sigue disponible." Las acciones que necesitan red se desactivan con el motivo escrito.

**P1. Ingreso.** Propósito: entrar. Acción: "Ingresar". Contenido: orbe y logo del cliente, "Celular" (teclado numérico, 987 654 321), "Contraseña" con "Mostrar", "¿Olvidaste tu contraseña?". Cargando: "Ingresando…" en el botón. Vacío: indica el campo que falta. Error: "El celular o la contraseña no coinciden." Sin conexión: "Necesitas señal para ingresar".

**P2. Crea tu contraseña.** Propósito: reemplazar la temporal. Acción: "Guardar contraseña". Contenido: "Paso 1 de 2"; reglas antes del campo (8 caracteres, un número, distinta a la temporal), cada una pasa a check y "Cumple" al escribir; confirmación. Error: la regla incumplida dice "Falta".

**P3. Completa tus datos.** Propósito: completar la ficha. Acción: "Empezar". Contenido: "Paso 2 de 2"; nombre, empresa y celular de solo lectura; pide lo faltante (Carlos: "Área"). Vacío: si no falta nada, se salta.

**P4. Recuperar contraseña.** Acción: "Enviar código", luego "Validar", luego "Guardar contraseña". Contenido: celular; "Te enviamos un código al 987 *** 321", seis casillas, "Reenviar en 30 s"; nueva contraseña con reglas de P2. Error: "El código no coincide. Te quedan 2 intentos."

**P5. Inicio.** Propósito: saber qué hacer y para cuándo. Acción: "Continuar". Contenido: "Hola, Rosa"; bloque "Sigue donde te quedaste"; lista "Tus capacitaciones" con barra y "40 %", "Vence el vie 20 nov · faltan 10 días", "Te quedan 27 min aprox."; aviso de certificado próximo a vencer. Ruta vencida: primera, con franja "Venció el 31 oct. Aún puedes terminarla." Vacío: "No tienes capacitaciones pendientes. Cuando tu empresa te asigne una, aparecerá aquí." y "Ver mis certificados" como acción principal. Sin conexión: lo último cargado con su hora.

**P6. Ruta.** Propósito: ver el camino y cuánto falta. Acción: "Continuar Nivel 2". Contenido: nombre, avance, fecha límite; niveles sobre el camino punteado vertical, cada nodo con número, título, duración y estado en pastilla; al final, "Evaluación final", bloqueada hasta completar niveles. Nivel bloqueado: hoja "Primero completa el Nivel 2: Aislar la energía" con "Ir al Nivel 2". Vacío: "Esta ruta aún no tiene lecciones."

**P7. Lección.** Propósito: aprender con el video. Acción: "Hacer el reto (3 preguntas)", activa al terminar el video o tocar "Ya lo vi". Contenido: "Nivel 2 de 4", título, video con formato, duración y "Hecho con IA"; subtítulos (encendidos por defecto), velocidad 0,75× a 1,5×, pantalla completa; "Retomar desde 1:40"; resumen desplegable; "Reportar un problema". Cargando: portada con orbe y "Preparando el video…". Error de video: "El video no se pudo reproducir." con "Volver a intentar" y "Leer el resumen"; leer el resumen habilita el reto. Sin conexión: "Necesitas señal para ver el video. Mientras, lee el resumen."

**P8. Reto.** Propósito: comprobar lo aprendido. Acción: "Comprobar", luego "Siguiente". Contenido: "Pregunta 1 de 3", pregunta grande, tres opciones de ancho completo. Acierto: "Correcto" y por qué. Repaso: "Repasemos", respuesta correcta marcada, por qué y "Ver ese momento del video (1:40)". "Reportar un problema" al pie. Error o sin conexión: la respuesta se guarda en el celular y se sincroniza después.

**P9. Lección completada.** Acción: "Siguiente lección: [título]". Contenido: sello en color de acento, "2 de 3 correctas", preguntas a repasar con enlace, barra de la ruta, "Repetir el reto" secundario.

**P10. Reglas de la evaluación.** Propósito: entender las reglas antes. Acción: "Empezar evaluación". Contenido: cuatro datos grandes con ícono: "Apruebas con 80 %", "Te quedan 3 de 3 intentos", "Si no apruebas, esperas 1 hora", "10 preguntas · 15 minutos"; "Si se acaba el tiempo, se envía lo respondido"; "Necesitas señal durante la evaluación". En espera: botón desactivado, "Podrás reintentar a las 16:40". Sin conexión: "Conéctate para empezar".

**P11. Evaluación.** Acción: "Siguiente". Contenido: "Pregunta 4 de 10 · faltan 6", tiempo restante, opciones; "Anterior" secundario; en la última, "Revisar respuestas". Sin conexión: franja "Se perdió la señal. Tus respuestas están guardadas." con "Reintentar"; el tiempo se pausa y no se puede enviar.

**P12. Revisar respuestas.** Acción: "Enviar evaluación". Contenido: lista 1 a 10 con "Respondida" o "Sin responder" (ícono y texto), cada una lleva a su pregunta; aviso "Tienes 2 preguntas sin responder". Error: "No se pudo enviar. Tus respuestas siguen guardadas." con "Reintentar".

**P13. Resultado aprobado.** Acción: "Ver mi certificado". Contenido: orbe, "¡Aprobaste!", "90 %" frente a "mínimo 80 %", "Tu certificado está listo".

**P14. Resultado no aprobado.** Acción: "Repasar [tema]". Contenido: "Esta vez no alcanzó", "60 % · necesitas 80 %", "Temas a reforzar" con enlace a cada lección, "Te quedan 2 intentos", "Podrás reintentar hoy a las 16:40". Sin intentos: "Usaste tus 3 intentos" y el paso del cliente.

**P15. Certificado.** Acción: "Descargar PDF". Contenido: documento horizontal en papel claro con logo y color principal del cliente: "[Empresa] certifica que [Nombre y apellidos] aprobó la capacitación interna «[Ruta]», definida por la empresa"; fecha, resultado, "Vigente hasta", código de verificación; pie "Capacitación interna de [Empresa]. No constituye una certificación externa." Descarga: "Descargando…" y "Guardado en Descargas". Error: "No se pudo descargar." Sin conexión: visible si ya cargó; descarga desactivada.

**P16. Mis certificados.** Acción: tocar uno. Contenido: ruta, fecha y "Vigente hasta"; los que vencen en 30 días o menos van arriba con "Vence en 20 días"; vencidos al final. Vacío: "Aún no tienes certificados. Aparecerán cuando apruebes una evaluación." y "Ir a Inicio".

**P17. Perfil.** Acción: "Cerrar sesión". Contenido: nombre, celular, empresa, área, "Cambiar contraseña" (como P2).

**P18. Reportar un problema** (hoja inferior). Opciones: "La pregunta es confusa", "Hay un error en el contenido", "El video no se entiende"; comentario opcional; "Enviar reporte". Confirmación: "Gracias. Lo revisaremos." Sin conexión: se envía luego.

## 8. Contenido y datos simulados

**Fecha simulada:** martes 10 de noviembre de 2026, 15:40.

**Clientes:** Corporación Ríomar (monograma "R" con onda) y Grupo Altavista (monograma "A" con horizonte), dibujados en su color principal.

**Rutas** (el avance cuenta lecciones más la evaluación):

- **Ruta 1 · Bloqueo y etiquetado de equipos** (Ríomar, operarios): "Por qué bloqueamos", "Aislar la energía", "Candado y tarjeta", "Verificar y devolver el equipo"; una lección por nivel, más evaluación: 5 unidades. Lecciones 1 y 3 con presentador; 2 y 4 animadas.
- **Ruta 2 · Primeros pasos en el sistema de compras** (Altavista, oficina): "Tu acceso y tu bandeja", "Crear una solicitud de compra" (2 lecciones), "Aprobaciones y seguimiento"; 5 unidades.
- Segunda ruta por cliente, solo para el orden por urgencia: "Orden y limpieza en el área" y "Atención a proveedores".

**Aprendices** (existen en ambos clientes):

| Aprendiz | Celular | Estado |
|---|---|---|
| Carlos Mendoza Ríos | 987 654 321 | Primer ingreso, sin área, 0 %. |
| Rosa Quispe Huamán | 987 111 222 | 40 %, lecciones 1 y 2 completas, vence el 20/11/2026. |
| Luis Huamaní Torres | 987 333 444 | 60 %, venció el 31/10/2026. |
| Marisol Paredes Vega | 987 555 666 | Sin asignaciones; certificado vence el 30/11/2026. |

Contraseña de demostración `Demo2026`; código `123456`.

**Reglas de evaluación.** Ríomar: 80 %, 3 intentos, 1 hora de espera, 10 preguntas, 15 minutos; sin intentos: "Habla con tu supervisor para habilitar un nuevo intento". Altavista: 70 %, 2 intentos, sin espera, 8 preguntas, 12 minutos; sin intentos: "Tu ruta se reinicia el lunes desde el Nivel 1". Cada pregunta guarda su lección de origen para "Temas a reforzar".

**Lección de referencia** (ilustrativa). Ruta 1, Lección 2 "Aislar la energía", animada, 4:12. Correcta en negrita:

1. "Ya apagaste la máquina. ¿Qué haces ahora?" **Aislar la fuente de energía: cortar el suministro eléctrico o cerrar la válvula** · Empezar el trabajo, ya está apagada · Avisar por radio que está apagada. Por qué: "Apagar no basta. El equipo puede volver a energizarse."
2. "Terminó el trabajo. ¿Quién retira el candado?" El supervisor del turno · **Solo la persona que lo colocó** · Cualquier compañero del área. Por qué: "Cada persona protege su propia seguridad con su propio candado."
3. "¿Cómo compruebas que el equipo quedó sin energía?" Mirando que las luces del tablero estén apagadas · **Intentando arrancarlo desde sus controles, con todos fuera de la zona de riesgo** · Preguntando al operador anterior. Por qué: "Verificar con una prueba real evita suponer que ya está seguro."

El resto del contenido sigue esta claridad: preguntas de situación, tres opciones, un "por qué" de una o dos frases con vocabulario de la operación. Sin texto de relleno.

**Certificado de ejemplo:** Marisol Paredes Vega, "Primeros pasos en el sistema de compras", 30/11/2025, 85 %, vigente hasta 30/11/2026, código ALT-2025-7K3M-09.

## 9. Experiencia con IA

- El aprendiz ve capacitación, no tecnología: sin chats, sin "modelo" ni "generando", sin íconos de chispas.
- Dos formatos de video con placeholder propio: **Con presentador** (persona hablando a cámara en un ambiente de trabajo, estilo celular) y **Animado** (diagramas y textos en movimiento con los colores del cliente).
- Etiqueta "Hecho con IA" (gris, 14 px, ícono de información) junto a la duración; al tocarla: "Este video se hizo con IA a partir del manual de [Empresa]."
- "Reportar un problema con este contenido" en cada lección y reto (P18).
- Si el video no carga o se corta: mensaje claro, "Volver a intentar" y "Leer el resumen" (5 a 7 líneas que permiten seguir al reto).
- Retos y explicaciones salen del manual del cliente, con su vocabulario.

## 10. Supuestos

Cada uno puede retirarse sin romper el flujo.

1. Recuperación de contraseña por código al celular, simulada.
2. Etiqueta "Hecho con IA" en la lección.
3. "Reportar un problema con este contenido" con confirmación breve.
4. Una ruta vencida sigue disponible.
5. El reto no se aprueba ni desaprueba: completarlo completa la lección.
6. "Próximo a vencer" es 30 días o menos.
7. Altavista sin espera entre intentos; pasos al agotar intentos según sección 8.
8. La evaluación pausa el tiempo sin señal y envía lo respondido al acabarse.
9. Reglas de contraseña de P2.
10. Segunda ruta por cliente para probar el orden.
11. Fecha, contraseña y código de demostración fijos.
12. Tipografía geométrica de la identidad Nivia (aproximación: Plus Jakarta Sans).
13. Modo oscuro como base, por la identidad Nivia; el certificado va en papel claro para imprimir.
14. Colores de estado comunes a ambos clientes.
15. Orbe fluido según la referencia del equipo: componente `fluid-orb` de rare-ui, teñido con el acento del cliente.

## 11. Fuera de alcance

Ranking, premios e incentivos, puntos e insignias, descarga de lecciones y modo sin señal completo, compartir certificado, verificación pública del código, perfil avanzado y preferencias de notificación, roles de administrador o supervisor, producción real de video y retos, backend, autenticación real y envío real de mensajes, idiomas distintos al español, asistente conversacional libre, modo libre visible.
