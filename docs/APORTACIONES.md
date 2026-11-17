# Aportaciones de la gente

Mientras no haya usuarios, la gente puede mandar correcciones y novedades con un enlace discreto en las secciones
donde más ayuda. Nada se publica solo: todo queda pendiente hasta que alguien lo revisa en el panel.

## Dónde está el enlace

| Sitio | Texto | Tipo |
|---|---|---|
| Panel del pueblo, fiestas (si no hay cartel aprobado cerca) | ¿Tienes el cartel de las fiestas? Envíanoslo | `fiesta` (enlace obligatorio) |
| Panel del pueblo, eventos | ¿Organizas algo en …? Avísanos | `evento` |
| Panel del pueblo, al final | ¿Es tu pueblo? Corrige o añade cosas de … | `pueblo` |
| Ficha de la derecha, Información | ¿Algún dato mal o que falte? Avísanos | `pueblo` |
| Ficha del productor de Tierra de Sabor | ¿Es tu negocio? Corrige o añade información | `negocio` |
| Pestaña Info | Escríbenos | `otro` |

Es el componente `frontend/src/components/ContributeButton.vue`: un enlace de texto que abre un `<dialog>` con
"Tú eres…", el texto, un enlace y, solo si el servidor tiene `NEWSLETTER_RESPONSABLE`, el correo para contestar.

## Qué pasa al enviarla

`POST /api/aportaciones` (`backend/src/routes/aportaciones.js`, `services/contributions.js`):

- Se comprueba (texto de 10 a 2.000 letras o un enlace, enlace `http(s)`, correo válido si lo hay), con límite de
  3 por minuto y 20 al día por IP, un campo trampa para robots y sin repetir el mismo texto del mismo pueblo en un día.
- Se guarda pendiente en la colección `contributions`. Solo lo imprescindible: ni nombre ni IP.
- Un cartel de fiestas con enlace va además a `/admin/carteles.html` como pendiente ("enviado por un usuario"), donde
  se aprueba como los demás.

## Revisarlas

`/admin/aportaciones.html` (y el recuento en Inicio): se cambia lo que diga donde toque y se marca **aplicada**, o se
**descarta**, con una nota opcional. Al revisarla se borra el correo, si lo dejaron.

Pruebas: `backend/test/aportaciones/aportaciones.test.js` (sin base de datos).
