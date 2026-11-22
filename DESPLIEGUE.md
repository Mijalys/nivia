# Piloto de 10 personas: qué está listo y cómo publicarlo

Decisión: opción A, sin modo sin señal. La app del aprendiz (`app/`) habla con la API real y la API la sirve en `/app/`, en la misma dirección. El prototipo (`prototipo/`) se queda para demostraciones.

## Qué está listo

- **App del aprendiz conectada:** ingreso con correo y contraseña, Google (cuando haya `GOOGLE_CLIENT_ID`), enlaces del correo (invitación, restablecer, entrar sin contraseña), Inicio, Ruta (mapa y lista), Lección con video, Reto, Evaluación con tiempo en el servidor, Resultado, Certificados con PDF y Perfil.
- **Reto sin fuga de respuestas:** la lección ya no trae las respuestas. Cada respuesta se verifica en el servidor. Una pregunta va al reto o a la evaluación, nunca a ambos.
- **Producción protegida:** sin `APP_SECRET`, `DATABASE_URL`, `PUBLIC_URL` y `ADMIN_PASSWORD`, la API no arranca. No carga datos de demostración. CORS cerrado. Cabeceras de seguridad.
- **Videos:** la API rechaza una ruta si sus videos no están en el almacenamiento.
- **Probado:** 40 pruebas automáticas y un recorrido completo en el navegador contra la API local. Se probó ingreso, primer ingreso con contraseña temporal, ficha, restablecer por enlace, lección, reto, evaluación aprobada y desaprobada, recarga a mitad de la evaluación, certificado y PDF.

## Qué necesito de ti antes de publicar

1. **Dónde publicar.** Un servidor con Node 22 y disco persistente para los videos. Sirve una máquina pequeña (1 vCPU, 1 GB) o un servicio tipo Render o Railway con disco.
2. **PostgreSQL administrado**, con copia de seguridad diaria. La URL va en `DATABASE_URL`.
3. **Dominio con HTTPS**, por ejemplo `capacitacion.tuempresa.pe`. Va en `PUBLIC_URL`.
4. **Google:** el `GOOGLE_CLIENT_ID` creado con [arquitectura/google-cloud.md](arquitectura/google-cloud.md). Agrega el dominio real a los orígenes autorizados.
5. **Correo:** una clave de Brevo y un remitente verificado, con SPF y DKIM en el dominio. Sin esto, las invitaciones caen en spam o no salen.
6. **Contenido real:** los videos MP4 verticales, su portada, el resumen y las preguntas de cada lección. Las preguntas van separadas: unas para el reto y otras para la evaluación.
7. **Las 10 personas:** nombre, apellido, correo y área.
8. **Aviso de privacidad** (Ley 29733) y, si el piloto es con una empresa cliente, su permiso para usar su marca.

## Pasos para publicar

```bash
# En el servidor
git clone <repositorio> nivia && cd nivia/backend
npm ci && npm run build

# Variables (en el panel del servicio o en un .env que no se sube al repositorio)
NODE_ENV=production
PORT=3000
PUBLIC_URL=https://capacitacion.tuempresa.pe
APP_SECRET=<openssl rand -hex 32>
ADMIN_PASSWORD=<12 caracteres o más>
DATABASE_URL=postgres://...
STORAGE_DIR=/datos/videos
APP_DIR=../app
DEFAULT_TENANT=<slug de la empresa>
GOOGLE_CLIENT_ID=...
BREVO_API_KEY=...
EMAIL_FROM=capacitacion@tuempresa.pe

npm start
```

Después, con la API de administración ([backend/README.md](backend/README.md)):

1. Crear la empresa (marca y reglas de evaluación).
2. Copiar los videos a `STORAGE_DIR` y crear la ruta con `video_key` y `poster_key`.
3. Publicar la ruta.
4. Crear a las 10 personas: a cada una le llega la invitación.
5. Asignar la ruta con fecha límite.
6. Seguir el avance en `GET /admin/tenants/<slug>/progress`.

## Riesgos que siguen abiertos

- **Sin consola web de administración:** todo se carga con llamadas a la API. Para 10 personas alcanza, pero alguien técnico tiene que hacer la carga.
- **Nunca se probó contra PostgreSQL real:** las pruebas corren en PGlite. Hay que repetir el recorrido en el servidor antes de invitar.
- **Sin monitoreo ni alertas:** hay que revisar los registros a mano los primeros días.
- **Video en MP4 servido por la API:** para 10 personas está bien. Con más gente conviene una CDN.
- **Tema oscuro bajo el sol:** no se probó en planta.
- **Límite de intentos de ingreso en memoria:** sirve con una sola instancia, que es lo que tiene el piloto.
