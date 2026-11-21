# El tiempo de un pueblo en el móvil

Flujo: pulsar el pueblo → tarjeta del tiempo → **📲 Añadir a mi teléfono** (en la cabecera de la ficha del tiempo) →
`/tiempo.html?m=<pueblo>`.

Una web no puede poner un widget vivo en la pantalla de inicio (ni Chrome en Android ni Safari en iPhone lo permiten).
Por eso hay dos piezas:

## 1. Icono en la pantalla de inicio (Android y iPhone) — `frontend/public/tiempo.html`

Página ligera, sin Vue, con lo del widget: ahora, las próximas 24 horas y 7 días; "Ver todo el tiempo" abre la web
con la ficha del tiempo (`/?tiempo=<pueblo>`).

- Se instala como una "app" propia de cada pueblo: su manifest lo da la API
  (`/api/v1/weather/municipalities/<pueblo>/manifest.webmanifest`, con `id` y `start_url` del pueblo) y sus iconos
  están en `frontend/public/icons/tiempo-*.png` (`backend/scripts/build-weather-icons.js`).
- Android: el botón "Añadir a la pantalla de inicio" sale solo si el navegador puede instalar
  (`navigator.install()` o `beforeinstallprompt`); si no, los pasos del menú ⋮.
- iPhone: Safari → Compartir → Añadir a pantalla de inicio.
- Se actualiza al abrirla (y cada 15 minutos abierta). Sin conexión enseña la última predicción
  (`frontend/public/tiempo-sw.js`, solo para esta página).

## 2. Widget vivo en iPhone — `frontend/public/widget/tiempo-scriptable.js`

Con la app gratuita **Scriptable**: la página da el código con el pueblo ya puesto y los pasos. El widget (pequeño,
mediano o grande) enseña ahora, las próximas horas y la semana, se actualiza solo (iOS decide cuándo, más o menos cada
media hora), guarda lo último para cuando no hay red y al tocarlo abre el tiempo en la web.

En Android no hay equivalente sin una app nativa: queda el icono.

## Datos — `GET /api/v1/weather/municipalities/<pueblo>/widget`

Resumen compacto del modelo europeo (ECMWF, el de la newsletter): `ahora` (con la temperatura medida en la estación
cercana más reciente, si la hay), `horas` (24) y `dias` (7), con icono, texto, temperatura y probabilidad de lluvia.
Se guarda 15 minutos en caché.
