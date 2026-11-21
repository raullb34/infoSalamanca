# Cuentas de «Mi explotación»: cómo se entra

Las cuentas son para agricultores de 25 a 65 años, muchos con poca soltura con el móvil. Por eso:

- **Sin contraseñas por defecto.** El primer botón es **«Crear mi cuenta con la huella»** (o «Entrar con la huella»
  si ese teléfono ya la tiene). Para una cuenta nueva solo se pide el nombre: no hace falta correo.
- **Una decisión por pantalla**, botones grandes (54 px de alto, 17 px de letra) y frases cortas, sin palabras como
  «passkey», «autenticación» u «OAuth».
- **Google y Facebook**, que la mayoría ya tiene abiertos en el teléfono. El correo con contraseña queda como «Con
  correo y contraseña».
- **Si no hay cuenta, se crea sola**: entrar y registrarse son el mismo botón.
- Después de entrar con Google, Facebook o contraseña, si el teléfono puede: **«La próxima vez, entra con la
  huella»** (Activar / Ahora no; si dice que no, no se vuelve a preguntar en ese teléfono).
- **Código de persona** (p. ej. `7UY B8Z`, sin 0/O ni 1/I/L): sale arriba al entrar y sirve para que el titular
  añada a quien trabaja o asesora **dictándolo por teléfono**, sin pedirle el correo. La pestaña Personas acepta
  código o correo.
- Dentro de la app de Facebook o Instagram, Google no deja entrar: se avisa de que se abra en Chrome o Safari.

## Cómo funciona cada forma

| Forma | Qué se guarda | Dónde está el código |
|---|---|---|
| Huella, cara o PIN (llave de acceso, WebAuthn) | Solo la clave pública y un contador; la huella no sale del teléfono | `backend/src/services/cuaderno/cuentas.js` (librería `@simplewebauthn/server`) |
| Google | El identificador de Google (`sub`) y el correo | `federado.js`: firma RS256 con las claves de Google, emisor, destinatario y caducidad |
| Facebook | El identificador de Facebook y el correo | `federado.js`: `debug_token` (que sea de nuestra app) y `/me` con `appsecret_proof` |
| Correo y contraseña | scrypt con sal propia | `cuentas.js` |

- La huella exige que el teléfono compruebe a la persona (`userVerification: required`), y la llave queda ligada al
  **dominio** (`PUBLIC_URL`, o `WEBAUTHN_RP_ID`). Si la web cambia de dominio, las huellas guardadas dejan de valer:
  hay que hacer el cambio de dominio antes de tener muchos usuarios, o mantener el antiguo.
- Si se cambia de teléfono, la huella pasa sola al nuevo cuando se usa la misma cuenta de Google (Android) o de Apple
  (iPhone). Si no, se entra con Google o con el correo y se activa otra vez.
- En el ordenador, «Entrar con la huella» muestra un código QR que se escanea con el teléfono. También se puede entrar
  con Google.
- Una cuenta puede tener varias formas. No se puede quitar la última.

### Unir cuentas (y por qué no se hace siempre)

- **Google con correo verificado** entra en la cuenta que ya tenga ese correo. Si esa cuenta no lo tenía verificado
  (se creó con contraseña o con Facebook), se le quitan las demás formas de entrar y se cierran sus sesiones: así
  nadie puede crear antes una cuenta con el correo de otro y quedarse dentro cuando el dueño entre con Google.
- **Facebook nunca une por correo**, porque Facebook no garantiza que esté verificado. Si el correo ya es de otra
  cuenta, la de Facebook se crea sin correo.

## API

```
GET  /api/cuaderno/cuenta              quién soy, mi código y cómo puedo entrar (formas, llaves)
GET  /api/cuaderno/cuenta/formas       qué botones enseñar { google: clientId|null, facebook: appId|null, huella }
POST /api/cuaderno/cuenta/google       { credencial }   (con sesión: añade Google a la cuenta)
POST /api/cuaderno/cuenta/facebook     { token }        (con sesión: añade Facebook a la cuenta)
POST /api/cuaderno/cuenta/huella/opciones          { nombre } sin sesión (cuenta nueva) · {} con sesión
POST /api/cuaderno/cuenta/huella/crear             { retoId, respuesta, dispositivo }
POST /api/cuaderno/cuenta/huella/entrar/opciones
POST /api/cuaderno/cuenta/huella/entrar            { retoId, respuesta }
DELETE /api/cuaderno/cuenta/huella/:id
```

Cada reto vale una vez y 5 minutos (colección `cuaderno_retos`, con borrado automático).

## Activarlo en producción

La huella funciona sin configurar nada (usa el dominio de `PUBLIC_URL`). Google y Facebook necesitan sus claves en el
`.env` del servidor; sin ellas, sus botones no salen.

**Google** (gratis):
1. console.cloud.google.com → nuevo proyecto → «APIs y servicios» → «Pantalla de consentimiento de OAuth»: tipo
   externo, nombre «infoSalamanca», correo de soporte, logotipo opcional; ámbitos `openid`, `email`, `profile`.
   Publicarla («En producción»): con esos ámbitos no hace falta verificación de Google.
2. «Credenciales» → «Crear credenciales» → «ID de cliente de OAuth» → «Aplicación web». Orígenes de JavaScript
   autorizados: `https://infosalamanca.duckdns.org` (y `http://localhost:3000` para probar).
3. En el `.env`: `GOOGLE_CLIENT_ID=…apps.googleusercontent.com`. No hace falta el secreto.

**Facebook** (gratis):
1. developers.facebook.com → «Crear app» → caso de uso «Autenticar y solicitar datos a los usuarios con el inicio de
   sesión con Facebook».
2. Ajustes básicos: dominio `infosalamanca.duckdns.org`, URL de la política de privacidad y de las instrucciones para
   borrar los datos (Meta las exige para publicar la app). Permisos: `public_profile` y `email`.
3. Inicio de sesión con Facebook → ajustes: «Inicio de sesión con el SDK de JavaScript» activado y el dominio en
   «Dominios permitidos para el SDK de JavaScript».
4. Pasar la app a modo «Activo».
5. En el `.env`: `FACEBOOK_APP_ID=…` y `FACEBOOK_APP_SECRET=…` (el secreto nunca en el repositorio).

Después: `docker compose up -d backend` (lee el `.env`).

## Pruebas

- `backend/test/cuaderno/cuentas.test.js`: un «teléfono» de software (firma ES256, atestación «none») crea la cuenta
  con la huella y vuelve a entrar; otra web no puede usar la llave; sin comprobación de la persona no vale; firma
  repetida rechazada; añadir la huella a una cuenta y no poder quitar la última forma; Google (firma, destinatario,
  caducidad) y unión segura por correo; Facebook (token de otra app rechazado; no une por correo); código de persona
  dictado en minúsculas y con espacio.
- En el navegador (Edge a 390 px, con un autenticador virtual): crear la cuenta con la huella → salir → entrar con
  la huella; cuenta con correo → «Activar la huella» → salir → entrar con la huella. El botón de Google se ha probado
  dibujado con un client ID de prueba; el inicio real con Google y Facebook necesita las claves.

## Pendiente

- Recuperar la cuenta sin teléfono ni Google: hoy, si se pierde el único teléfono y la huella no estaba copiada en la
  cuenta de Google o Apple, no hay forma de volver a entrar. Opciones: código de recuperación impreso, o que el titular
  de la explotación vuelva a invitar a la persona (sus partes siguen en la explotación).
- Entrar con un código por SMS o WhatsApp (cuesta dinero por mensaje).
- Pantalla «Mi cuenta» para ver y quitar huellas y desvincular Google o Facebook (la API ya lo permite para las huellas).
