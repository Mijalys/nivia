// Datos de demostración: los mismos clientes, rutas y aprendices de los prototipos de los Cortes 1 y 2.
// El contenido de seguridad es ilustrativo, no una capacitación real.

export interface SeedQuestion { q: string; opts: string[]; right: number; why: string; t: number }
export interface SeedLesson { title: string; format: 'presenter' | 'animated'; dur: number; mb: number; sum: string[]; qs: SeedQuestion[] }
export interface SeedRoute { slug: string; title: string; overline: string; levels: { title: string; lessons: SeedLesson[] }[] }

const Q = (q: string, opts: string[], right: number, why: string, t: number): SeedQuestion => ({ q, opts, right, why, t });

export const ROUTE_LOTO: SeedRoute = {
  slug: 'bloqueo-etiquetado', title: 'Bloqueo y etiquetado de equipos', overline: 'Bloqueo y etiquetado',
  levels: [
    { title: 'Por qué bloqueamos', lessons: [{ title: 'Por qué bloqueamos', format: 'presenter', dur: 230, mb: 62,
      sum: ['Una máquina apagada puede volver a arrancar: por un botón, un temporizador o un compañero que no sabe que estás dentro.', 'El bloqueo y etiquetado impide que alguien energice el equipo mientras trabajas en él.', 'Se bloquea antes de cualquier mantenimiento, limpieza, ajuste o desatasco.', 'La duración de la tarea no cambia el riesgo: si metes las manos, bloqueas.', 'Cada persona que trabaja en el equipo coloca su propio candado.'],
      qs: [
        Q('¿Para qué sirve el bloqueo y etiquetado?', ['Para registrar quién usó la máquina', 'Para que nadie pueda energizar el equipo mientras trabajas en él', 'Para que la máquina se enfríe más rápido'], 1, 'El candado impide que alguien encienda el equipo por error mientras tienes las manos dentro.', 50),
        Q('¿Cuándo debes bloquear un equipo?', ['Solo cuando el supervisor está presente', 'Solo si la tarea dura más de una hora', 'Antes de cualquier mantenimiento, limpieza o desatasco'], 2, 'Un desatasco de un minuto basta para un accidente. Si metes las manos, bloqueas.', 100),
        Q('Un compañero dice: “Es rápido, no hace falta bloquear”. ¿Qué haces?', ['Bloqueas igual: la tarea corta no cambia el riesgo', 'Le haces caso, él tiene más experiencia', 'Trabajas rápido para terminar antes'], 0, 'El riesgo depende de la energía del equipo, no del tiempo que dure la tarea.', 150)
      ] }] },
    { title: 'Aislar la energía', lessons: [{ title: 'Aislar la energía', format: 'animated', dur: 252, mb: 38,
      sum: ['Apagar la máquina desde su botón no basta.', 'Aísla cada fuente de energía: corta el suministro eléctrico o cierra la válvula.', 'Algunos equipos guardan energía: presión, resortes o piezas en altura. Libérala o asegúrala.', 'Coloca tu candado y tu tarjeta en el punto de aislamiento.', 'Antes de trabajar, verifica: intenta arrancar el equipo con todos fuera de la zona de riesgo.'],
      qs: [
        Q('Ya apagaste la máquina. ¿Qué haces ahora?', ['Aislar la fuente de energía: cortar el suministro eléctrico o cerrar la válvula', 'Empezar el trabajo, ya está apagada', 'Avisar por radio que está apagada'], 0, 'Apagar no basta. El equipo puede volver a energizarse si alguien lo prende o si queda energía en la línea.', 100),
        Q('Terminó el trabajo. ¿Quién retira el candado?', ['El supervisor del turno', 'Solo la persona que lo colocó', 'Cualquier compañero del área'], 1, 'Cada persona protege su propia seguridad con su propio candado.', 160),
        Q('¿Cómo compruebas que el equipo quedó sin energía?', ['Mirando que las luces del tablero estén apagadas', 'Intentando arrancarlo desde sus controles, con todos fuera de la zona de riesgo', 'Preguntando al operador del turno anterior'], 1, 'Verificar con una prueba real evita suponer que ya está seguro.', 215)
      ] }] },
    { title: 'Candado y tarjeta', lessons: [{ title: 'Candado y tarjeta', format: 'presenter', dur: 280, mb: 78,
      sum: ['Tu candado es personal y tiene una sola llave: la tuya.', 'La tarjeta dice tu nombre, la fecha y el motivo del bloqueo.', 'Si trabajan varias personas, cada una pone su candado en un portacandados.', 'Guarda la llave contigo todo el tiempo que dure el trabajo.', 'Nadie retira un candado ajeno.'],
      qs: [
        Q('¿Qué datos lleva la tarjeta de bloqueo?', ['Solo el nombre del equipo', 'Tu nombre, la fecha y el motivo del bloqueo', 'El código de la máquina y la hora de salida'], 1, 'Quien vea la tarjeta debe saber quién está trabajando y por qué.', 70),
        Q('Tres personas trabajan en el mismo equipo. ¿Cuántos candados se colocan?', ['Uno, el del supervisor', 'Dos, uno por turno', 'Tres: uno por persona, en un portacandados'], 2, 'Cada persona protege su propia seguridad con su propio candado.', 140),
        Q('¿Dónde guardas la llave de tu candado?', ['Contigo, durante todo el trabajo', 'Colgada en el tablero, para que otro la use', 'En la oficina del supervisor'], 0, 'Si la llave está contigo, nadie más puede retirar tu candado.', 210)
      ] }] },
    { title: 'Verificar y devolver el equipo', lessons: [{ title: 'Verificar y devolver el equipo', format: 'animated', dur: 245, mb: 34,
      sum: ['Al terminar, retira herramientas y materiales del equipo.', 'Confirma que todas las personas estén fuera de la zona de riesgo.', 'Avisa a las personas del área que el equipo vuelve a operar.', 'Cada persona retira solo su propio candado y su tarjeta.', 'Si un candado quedó puesto y su dueño no está, avisa al supervisor.'],
      qs: [
        Q('Terminaste. ¿Qué haces antes de retirar tu candado?', ['Retirar el candado y luego avisar', 'Retirar herramientas y confirmar que todos estén fuera de la zona', 'Encender el equipo para probar'], 1, 'Al energizar, cualquier herramienta o persona dentro corre peligro.', 40),
        Q('¿A quién avisas que el equipo vuelve a operar?', ['A todas las personas afectadas del área', 'A nadie, ya terminó el trabajo', 'Solo al almacén'], 0, 'Quien no sabe que el equipo va a arrancar puede estar cerca.', 120),
        Q('Encuentras el candado de otra persona y ella ya se fue a casa. ¿Qué haces?', ['Lo cortas para no detener la producción', 'Lo retiras con una llave maestra', 'Avisas al supervisor para seguir el procedimiento de retiro'], 2, 'Solo la persona que lo colocó lo retira. Si no está, el supervisor sigue el procedimiento.', 200)
      ] }] }
  ]
};

export const ROUTE_COMPRAS: SeedRoute = {
  slug: 'sistema-compras', title: 'Primeros pasos en el sistema de compras', overline: 'Sistema de compras',
  levels: [
    { title: 'Tu acceso y tu bandeja', lessons: [{ title: 'Tu acceso y tu bandeja', format: 'presenter', dur: 210, mb: 56,
      sum: ['Ingresas al sistema de compras con tu usuario personal; no lo compartas.', 'La bandeja “Pendientes” reúne lo que necesita tu acción.', '“Mis solicitudes” muestra todo lo que creaste y su estado.', 'Una solicitud “Observada” vuelve a ti para corregirla.', 'Si olvidas tu clave, usa “Recuperar acceso”.'],
      qs: [
        Q('¿Dónde ves las solicitudes que esperan tu acción?', ['En el historial de compras', 'En la bandeja “Pendientes”', 'En el correo de bienvenida'], 1, '“Pendientes” reúne solo lo que necesita tu respuesta.', 60),
        Q('Olvidaste tu clave del sistema de compras. ¿Qué haces?', ['Pides la clave a un compañero', 'Creas otra cuenta', 'Usas “Recuperar acceso” en la pantalla de ingreso'], 2, 'Tu cuenta registra tus aprobaciones. Si la compartes, quedan compras a tu nombre.', 180),
        Q('¿Qué significa una solicitud en estado “Observada”?', ['Que el aprobador pidió un cambio antes de aprobarla', 'Que ya fue pagada', 'Que fue anulada'], 0, '“Observada” vuelve a ti para corregir y reenviar.', 140)
      ] }] },
    { title: 'Crear una solicitud de compra', lessons: [
      { title: 'Crear una solicitud de compra', format: 'animated', dur: 260, mb: 41,
        sum: ['Ten a mano el centro de costo y una descripción clara del bien o servicio.', 'Registra una línea por artículo, con su cantidad.', 'Indica la fecha en que lo necesitas.', 'Si el monto supera el límite de tu área, adjunta cotizaciones.', 'Revisa el resumen antes de enviar.'],
        qs: [
          Q('¿Qué necesitas antes de crear una solicitud?', ['La factura del proveedor', 'El centro de costo y una descripción clara del bien o servicio', 'La firma del gerente general'], 1, 'Sin centro de costo, la solicitud no sabe a qué presupuesto cargarse.', 30),
          Q('Necesitas 10 sillas iguales. ¿Cómo las registras?', ['Una línea con cantidad 10', 'Diez líneas de una silla', 'Diez solicitudes separadas'], 0, 'Una línea por artículo facilita la cotización y la aprobación.', 90),
          Q('¿Cuándo adjuntas cotizaciones?', ['Nunca, Compras las pide después', 'Solo si el proveedor lo exige', 'Cuando el monto supera el límite que indica tu área'], 2, 'Sobre ese monto, el aprobador necesita comparar precios.', 200)
        ] },
      { title: 'Enviar y corregir la solicitud', format: 'presenter', dur: 235, mb: 64,
        sum: ['Al enviar, el sistema te da un número de solicitud (SC-…).', 'Si notas un error, retírala desde “Mis solicitudes” y corrígela.', 'No crees una segunda solicitud por lo mismo.', 'Si está “Observada”, lee el comentario del aprobador y corrige lo que pide.', 'Usa el número SC para cualquier consulta con Compras.'],
        qs: [
          Q('Enviaste la solicitud con un error de cantidad. ¿Qué haces?', ['Creas otra igual y dejas las dos', 'La retiras desde “Mis solicitudes” y la corriges', 'Esperas a que el aprobador la corrija'], 1, 'Retirarla evita que se aprueben dos compras por lo mismo.', 60),
          Q('Tu solicitud fue “Observada”. ¿Qué haces primero?', ['Lees el comentario del aprobador', 'La reenvías sin cambios', 'La anulas y empiezas de cero'], 0, 'El comentario dice exactamente qué corregir.', 140),
          Q('¿Qué número usas para hacer seguimiento con Compras?', ['Tu número de DNI', 'El número de factura', 'El número de solicitud (SC-…)'], 2, 'Con el número SC, Compras encuentra tu pedido al instante.', 190)
        ] }] },
    { title: 'Aprobaciones y seguimiento', lessons: [{ title: 'Aprobaciones y seguimiento', format: 'animated', dur: 250, mb: 36,
      sum: ['El sistema envía tu solicitud al responsable del centro de costo, según el monto.', '“En aprobación” muestra quién la tiene en ese momento.', 'Si se demora, escribe al aprobador indicando el número SC.', '“Aprobada” autoriza la compra; “Orden emitida” significa que Compras ya la hizo.', 'Nunca compres por tu cuenta para adelantar.'],
      qs: [
        Q('¿Quién aprueba tu solicitud?', ['Cualquier jefe disponible', 'El responsable del centro de costo, según el monto', 'El proveedor'], 1, 'El sistema la envía según el centro de costo y el monto.', 40),
        Q('La solicitud lleva 3 días “En aprobación”. ¿Qué haces?', ['Revisas quién la tiene y le escribes con el número SC', 'Creas una nueva solicitud', 'Compras con tu dinero y pides reembolso'], 0, 'Hacer seguimiento con el número evita duplicar compras.', 120),
        Q('¿Qué estado indica que Compras ya emitió la orden?', ['“Aprobada”', '“Enviada”', '“Orden emitida”'], 2, '“Aprobada” solo autoriza. La compra existe cuando hay orden emitida.', 190)
      ] }] }
  ]
};

export const TENANTS = [
  {
    slug: 'riomar', name: 'Corporación Ríomar', cert_prefix: 'RIO', route: ROUTE_LOTO,
    branding: { mono: 'R', accent: '#F26B1D', on_accent: '#0E0F11', principal: '#0E4D5C', principal_text: '#7CC3D0', logo_url: null,
      areas: ['Mantenimiento', 'Producción', 'Almacén', 'Calidad'] },
    exam_policy: { min_score: 80, attempts: 3, wait_minutes: 60, question_count: 10, minutes: 15, max_pause_minutes: 10,
      exhausted_message: 'Habla con tu supervisor para habilitar un nuevo intento.' },
    areas: { carlos: null, rosa: 'Mantenimiento', luis: 'Producción', marisol: 'Calidad' }
  },
  {
    slug: 'altavista', name: 'Grupo Altavista', cert_prefix: 'ALT', route: ROUTE_COMPRAS,
    branding: { mono: 'A', accent: '#F2B630', on_accent: '#0E0F11', principal: '#1F4D3A', principal_text: '#8FD0A5', logo_url: null,
      areas: ['Administración', 'Finanzas', 'Logística', 'Recursos Humanos'] },
    exam_policy: { min_score: 70, attempts: 2, wait_minutes: 0, question_count: 8, minutes: 12, max_pause_minutes: 10,
      exhausted_message: 'Tu ruta se reinicia el lunes; repasarás desde el Nivel 1.' },
    areas: { carlos: null, rosa: 'Finanzas', luis: 'Logística', marisol: 'Administración' }
  }
] as const;

/** Estado de cada aprendiz, relativo a la fecha en que se cargan los datos. */
export const PERSONAS = [
  { key: 'carlos', first: 'Carlos', last: 'Mendoza Ríos', phone: '987654321', temporary: true, completed: 0, dueInDays: 24 },
  { key: 'rosa', first: 'Rosa', last: 'Quispe Huamán', phone: '987111222', temporary: false, completed: 2, dueInDays: 10 },
  { key: 'luis', first: 'Luis', last: 'Huamaní Torres', phone: '987333444', temporary: false, completed: 3, dueInDays: -10 },
  // Marisol aprobó hace casi un año; su certificado vence en 20 días y ya tiene asignada la renovación.
  { key: 'marisol', first: 'Marisol', last: 'Paredes Vega', phone: '987555666', temporary: false, completed: 2, dueInDays: 20,
    certificate: { issuedDaysAgo: 345, score: { riomar: 90, altavista: 85 } } }
] as const;

export const DEMO_PASSWORD = 'Demo2026';
export const DEMO_VIDEO_KEY = 'demo/leccion-demo.mp4';
export const DEMO_POSTER_KEY = 'demo/portada.jpg';
