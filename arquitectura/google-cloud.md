# Activar "Continuar con Google"

Pasos para crear el cliente OAuth de Google que usa Nivia. Toman unos 10 minutos. Nivia solo pide el **nombre, el correo y la foto** de la cuenta (permisos básicos), así que Google no exige una revisión de seguridad.

## 1. Proyecto

1. Entra a https://console.cloud.google.com con la cuenta de Google de Nivia (no una personal, si puedes).
2. Arriba, en el selector de proyectos, elige **Proyecto nuevo**.
3. Nombre: `Nivia`. Crear.

## 2. Pantalla de consentimiento

Es lo que ve la persona cuando Google le pregunta si deja entrar a Nivia.

1. Menú ☰ › **APIs y servicios** › **Pantalla de consentimiento de OAuth** (en consolas nuevas aparece como **Google Auth Platform** › **Branding**).
2. Tipo de usuario: **Externo**. Crear.
3. Completa:
   - Nombre de la app: `Nivia`
   - Correo de asistencia: el correo de soporte de Nivia
   - Logo: opcional. Si lo subes, Google revisa la marca y puede tardar unos días; sin logo funciona igual.
   - Dominios autorizados: el dominio donde vivirá la app (por ejemplo `nivia.pe`). Para probar en local no hace falta.
   - Correo de contacto del desarrollador.
4. **Permisos (scopes):** agrega solo `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`. Nada más.
5. **Usuarios de prueba:** mientras la app esté en modo *Prueba*, solo pueden entrar los correos que pongas aquí (hasta 100). Agrega los tuyos y los de las personas de la primera clase.
6. Cuando quieras abrirlo a todos: **Publicar app** (pasa a *En producción*). Con estos permisos básicos no pide verificación.

## 3. ID de cliente

1. **APIs y servicios** › **Credenciales** › **Crear credenciales** › **ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**. Nombre: `Nivia web`.
3. **Orígenes de JavaScript autorizados** (la dirección exacta desde donde se abre la app, sin barra final):
   - `http://localhost:4178` (prototipo en tu computadora)
   - `https://app.nivia.pe` o el dominio real, cuando exista
   - Si cada empresa tendrá subdominio, agrega cada uno: `https://riomar.nivia.pe`, etc.
4. **URIs de redireccionamiento autorizados:** déjalo vacío. Nivia usa el botón de Google, que devuelve el resultado en la misma página.
5. Crear. Copia el **ID de cliente**: termina en `.apps.googleusercontent.com`.
   - El **secreto del cliente** no se usa. No lo compartas ni lo pongas en el código.

## 4. Configurar Nivia

En el servidor del backend:

```bash
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
```

Al reiniciar, `GET /tenant/config` devuelve `sign_in.google_client_id` y la app muestra el botón. Sin esa variable, el botón no aparece y `POST /auth/google` responde `GOOGLE_DISABLED`.

## Qué valida el backend

Cada vez que alguien toca "Continuar con Google", el backend comprueba que el token:

- está firmado por Google (llaves públicas de Google, cacheadas 1 hora);
- fue emitido para **este** ID de cliente, no para otra app;
- no está vencido y trae un correo **verificado**.

Después busca a la persona por ese correo **dentro de la empresa** que abrió la app. Si la empresa no la invitó, responde "Tu empresa aún no te invitó. Pide acceso a tu supervisor." La primera vez vincula la cuenta de Google; las siguientes la reconoce aunque cambie el correo de Google.

## Problemas conocidos

- **`Error 400: origin_mismatch`**: la dirección desde donde abriste la app no está en "Orígenes de JavaScript autorizados". Debe coincidir exactamente, incluido `http`/`https` y el puerto.
- **`Error 403: disallowed_useragent`**: la página se abrió dentro de WhatsApp, Facebook o Instagram. Google no permite ingresar ahí. La app muestra un aviso para abrirla en Chrome; el ingreso con correo sí funciona.
- **"Acceso bloqueado: esta app no completó la verificación"**: la persona no está en *Usuarios de prueba* y la app sigue en modo *Prueba*. Agrégala o publica la app.
