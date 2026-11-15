# Difusión: canal de WhatsApp y newsletter

Panel: `https://infosalamanca.duckdns.org/admin/` (Inicio · Difusión · Carteles), con la clave `ADMIN_TOKEN`.

## Cómo se usa cada semana

1. **Difusión** → elige la semana (por defecto, desde hoy y 7 días) y escribe una introducción si quieres.
2. Desmarca lo que no quieras contar. El resumen sale de lo que ya tiene la web: espectáculos (Junta,
   Diputación y Turismo de Salamanca), fiestas, ciencia (eventos y noticias de la USAL) y el tiempo de Salamanca.
3. **Cartel**: en la pestaña WhatsApp sale la imagen de la semana (1080 × 1350: espectáculos, fiestas, ciencia y
   el tiempo; las noticias no). *Descargar cartel* y publícalo en el canal; la newsletter lo lleva arriba solo.
   Si no cabe todo, el cartel reparte el sitio entre las secciones y pone "+ N más en la web"; lo que tiene
   fecha esta semana va antes que lo que ya estaba en marcha (exposiciones, ciclos).
   *Nueva ilustración con IA* (una vez por semana, ~30 s) pinta un paisaje de la provincia según la estación
   y lo que haya esa semana; la IA solo hace el dibujo, sin texto: fechas, títulos y temperaturas los escribe
   la web (los modelos de imagen se equivocan con letras y números).
4. **WhatsApp** → *Copiar texto* y pégalo en el canal desde la app (los canales no se pueden publicar de forma
   automática; WhatsApp no tiene una vía oficial para eso).
5. **Correo** → revisa la vista previa, *Enviar prueba* a tu correo y, si está bien, *Enviar a los suscriptores*.
   El envío va de uno en uno (una pausa de 1,5 s entre correos) y el panel enseña el progreso.

## Configuración (en el `.env` del servidor, nunca en el código)

| Variable | Para qué |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | El buzón desde el que se envía. Gmail: `smtp.gmail.com`, `587`, `false`, la dirección y una **contraseña de aplicación** (Cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones) |
| `MAIL_FROM` | Remitente visible: `infoSalamanca <direccion@gmail.com>` (con Gmail, la misma dirección del usuario) |
| `MAIL_REPLY_TO` | Opcional: a dónde van las respuestas |
| `NEWSLETTER_RESPONSABLE` | **Obligatorio para abrir la suscripción**: quién trata los datos (RGPD), p. ej. `infoSalamanca · Responsable: Nombre Apellidos` |
| `NEWSLETTER_CONTACTO` | Opcional: correo para ejercer los derechos (acceso, supresión…) |
| `WHATSAPP_CHANNEL_URL` | Enlace del canal: sale el botón "Síguenos en WhatsApp" en la web (pestañas Agenda e Info) |
| `MAIL_DELAY_MS` | Pausa entre correos (1500 por defecto) |
| `OPENAI_API_KEY` | Opcional: ilustración del cartel de cada semana con IA (botón *Nueva ilustración con IA*). Sin ella, la de serie |
| `OPENAI_IMAGE_MODEL` | Modelo de imagen (por defecto `gpt-image-2`) |

Después de cambiar el `.env`: `docker compose up -d backend`. En el panel, **Inicio** dice qué falta.

Por qué no un servidor de correo propio: Hetzner bloquea el envío directo (puerto 25) en los servidores
nuevos y un dominio de duckdns.org no puede publicar las firmas SPF/DKIM que exige Gmail, así que los correos
acabarían en spam. Con un buzón normal por SMTP todo lo demás (lista, altas, bajas, envíos) es nuestro.

**Límites**: Gmail permite unos 500 correos al día desde una cuenta normal. Si la lista crece mucho, habrá que
pasar a un buzón con más cupo (el de un dominio propio, por ejemplo).

## Protección de datos

- Solo se guarda el correo, su estado (pendiente, activo, baja), las fechas y el texto de consentimiento aceptado.
- **Doble confirmación**: el alta no vale hasta pulsar el enlace del correo; las no confirmadas se borran a los 7 días.
- **Baja con un clic** en cada correo y cabecera `List-Unsubscribe` (One-Click), para el botón de Gmail y Outlook.
- Confirmar y darse de baja piden pulsar un botón: algunos correos abren los enlaces solos para revisarlos.
- Desde **Difusión → Suscriptores** se puede borrar a alguien del todo (derecho de supresión).
- La web no dice si un correo ya estaba suscrito (la respuesta es siempre la misma).

## Código

- `backend/src/services/difusion/`: `digest.js` (resumen de la semana), `render.js` (WhatsApp y correo),
  `poster.js` (cartel en PNG con @napi-rs/canvas y la tipografía Poppins de `backend/assets/fonts`, SIL OFL),
  `posterStore.js` (carteles guardados en el volumen y servidos en `/api/newsletter/cartel/…`),
  `subscriptions.js` (altas y bajas), `sender.js` (envío), `mailer.js` (SMTP)
- `backend/src/routes/newsletter.js` (público) y `backend/src/routes/admin.js` (panel)
- `frontend/public/admin/` (panel) y `frontend/src/components/NewsletterSignup.vue` (caja de la web)
- Pruebas: `backend/test/difusion/newsletter.test.js` (sin red ni base de datos)
