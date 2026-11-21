# Mi explotación y cuaderno de campo

Ampliación del visor agrícola (`docs/CARTOGRAFIA-AGRICOLA.md`): ubicación GPS, área privada «Mi explotación»,
cultivos por campaña y un cuaderno que se rellena con el trabajo realmente hecho. Plan completo: fases 0–6 del encargo.
Este documento recoge lo entregado, cómo probarlo y lo pendiente.

## Fase 0 · Línea base (21/11/2026)

- **Visor**: `frontend/src/components/CartografiaAgricola.vue` (Leaflet 1.9.4, ortofoto PNOA y mapa del IGN por WMTS),
  selección de recintos, ficha, búsqueda por polígono/parcela, medición de distancia y superficie, suma de recintos.
- **Datos**: `backend/scripts/build-sigpac.js` genera `frontend/public/data/sigpac/<ine>.json` desde el ITACyL.
  Índice público: `index.json` (21/11/2026: solo Aldeaseca de la Frontera, 37022, campaña 2026, 898 recintos; ese
  número es de esa publicación, no una constante de la aplicación).
  - Esquema por recinto: geometría GeoJSON (Polygon/MultiPolygon, con huecos), `agr`, `zona`, `pol`, `par`, `rec`,
    `uso` (código SIGPAC), `sup` (m², la superficie oficial del SIGPAC, redondeada a m²), `reg` (coeficiente de
    regadío, %), `cat` (referencia catastral de la parcela).
  - Coordenadas ETRS89 geográficas (lon, lat) con 6 decimales (≈ 10 cm).
  - Procedencia: `fuente` (ITACyL, URL del ZIP), `fechaReferencia` de la cartografía (15/12/2025 para 2026),
    licencia IGCYL-NC (uso gratuito, no comercial).
- **Reutilizado**: Express + Mongo del backend, patrón de servicio con almacén inyectable (como la newsletter), el
  visor y su medición, `rateLimit`. **No existía** autenticación de usuarios (solo la clave del panel): se ha creado.

## Qué hay (incremento 1: primer recorrido)

| Pieza | Dónde |
|---|---|
| Cuentas propias (sin credenciales de la Junta), sesión en cookie httpOnly | `backend/src/services/cuaderno/cuentas.js` |
| Explotaciones, papeles (titular, ejecutor, confirmador, asesor), recintos, cultivos, partes, cuaderno | `…/cuaderno/explotacion.js` |
| Cálculo del abonado (cantidades, masa, N/P₂O₅/K₂O, pendientes) | `…/cuaderno/fertilizacion.js` |
| Superficie geodésica (croquis, huecos, multipolígonos) | `…/cuaderno/geo.js` |
| Almacén (Mongo, colecciones `cuaderno_*`, separadas de lo público; memoria en pruebas) | `…/cuaderno/store.js` |
| Exportación CSV con ámbito, versión, pendientes y enlace al parte | `…/cuaderno/exportar.js` |
| API `/api/cuaderno/…` | `backend/src/routes/cuaderno.js` |
| «Estoy aquí», candidatos en lindes, «Mi explotación» en el visor | `CartografiaAgricola.vue`, `MiExplotacion.vue`, `utils/sigpac.js`, `utils/cuaderno.js` |

### El recorrido

1. Móvil: Aldeaseca → **📍 Estoy aquí** (o tocar un recinto) → **⭐ Guardar en mi explotación** → crear cuenta y
   explotación → guardar el recinto (la superficie oficial la pone el servidor desde el SIGPAC publicado, no el móvil).
2. **Cultivos** → nuevo cultivo de la campaña (especie, régimen, fechas, recintos y superficie cultivada).
3. **Partes** → **Parte de abonado**: fecha, dónde y cuánta superficie se abonó de verdad, producto con su riqueza,
   dosis y unidad, quién lo hizo → **Revisar y confirmar** (resumen de cultivo, dónde, fecha, producto, dosis,
   superficie y cantidad) → **Confirmar**.
4. Ordenador: misma cuenta → **Cuaderno**: el mismo parte, la superficie aplicada, los nutrientes calculados, su
   procedencia y la bandeja de pendientes; **Descargar hoja de cálculo**. Cada fila del CSV enlaza al parte original.
5. El visor público sigue igual sin cuenta.

### Reglas del modelo que ya se cumplen

- Superficies separadas: **oficial** (recinto SIGPAC), **cultivada** (cada cultivo en cada recinto) y **ejecutada**
  (cada parte), en m², cada una con `metodo` (completa, declarada, croquis) y procedencia (oficial, usuario,
  dispositivo, historial, calculado). Redondeo solo al presentar.
- Sin doble cómputo: los cultivos que coinciden en el tiempo en un recinto no pueden sumar más que su superficie
  oficial (tolerancia 0,5 %); uno sucesivo, sí.
- Lo desconocido se queda desconocido: riqueza vacía → nutriente desconocido (no cero); dosis en litros sin densidad
  → masa y nutrientes pendientes.
- Un parte con varias unidades es **un** parte con varias imputaciones.
- Mismo identificador = mismo parte (los reintentos de un móvil sin red no duplican).
- Rectificar guarda la versión anterior y recalcula; una edición desde otro dispositivo con versión antigua no pisa:
  queda como **conflicto** con las dos versiones.
- Nueva campaña SIGPAC de un recinto guardado: se actualiza y conserva la anterior (`versionesAnteriores`); los
  cultivos guardan la campaña SIGPAC con la que se dieron de alta.
- Estados independientes: trabajo (borrador, confirmado), sincronización (`sync`, y en el móvil local/pendiente/
  guardado) e intercambio oficial (`oficial.estado`: sin_enviar…). Solo lo confirmado entra en el cuaderno.
- Permisos en el servidor en cada lectura y escritura; a quien no es miembro, 404 (no se revela la explotación).
  Las escrituras exigen la cabecera `X-Cuaderno` además de la cookie (SameSite=Lax).

## Cómo probar

```
cd backend && npm test                # incluye test/cuaderno/*.test.js
```

- `fertilizacion.test.js`: 918 kg / 137,7 kg, litros sin densidad, riqueza desconocida, unidades no admitidas,
  excluir una franja.
- `recorrido.test.js`: recorrido completo, permisos entre cuentas, dos cultivos simultáneos y uno sucesivo, finca de
  varios recintos, reintentos, borrador fuera de totales, plazo de registro, rectificación y conflicto, nueva campaña
  SIGPAC, croquis, CSV.
- `api.test.js`: la API por HTTP (cookie, cabecera, 404 a otra cuenta, 401 sin sesión, CSV).
- `gps.test.js`: «Estoy aquí» con los recintos reales de Aldeaseca (seguro, linde, imprecisión, fuera).

Probado además en el navegador (Edge, móvil 390 px y escritorio): recorrido completo, el mismo parte en el
ordenador, enlace del CSV al parte, permiso de ubicación denegado y posición fuera del municipio.

Sin Mongo local, el backend de desarrollo puede montar la API con el almacén en memoria:
`require('./src/routes/cuaderno').createRouter({ store: memoryStore(), fuente, needsDb: false })`.

## Pendiente (relación precisa)

- **Fase 1**: favoritos/alias en la interfaz (la API ya los guarda), capas, croquis persistentes dibujados en el
  mapa (el servidor ya acepta croquis), medición caminando, entrada real con foto y navegación hasta ella.
- **Fase 2**: fincas de trabajo (agrupación con nombre habitual), importación por fichero con vista previa,
  asignación masiva, rotaciones/fin de cultivo en la interfaz, divisiones y fusiones SIGPAC entre campañas (hoy se
  conserva la versión anterior del mismo recinto; una división crea recintos nuevos sin enlazar).
- **Fase 3**: fitosanitarios (con número de registro y comprobación de uso autorizado), siembra, riego, labores,
  cosecha, poscosecha, semilla tratada, instalaciones; catálogos de personas, máquinas y productos; adjuntos;
  cola sin conexión persistente para adjuntos y paquete de jornada (hoy la cola de partes usa localStorage).
- **Fase 4**: PDF, exportación estructurada documentada con geometrías, revisión por asesor en la interfaz, gestión
  de miembros (invitar a ejecutor/asesor: la API de permisos existe, falta el alta de miembros).
- **Fase 5**: intercambio con la Junta (REACyL, Cuecyl): no iniciado, depende de acceso (ver `obligaciones.md`).
- **Fase 6**: más municipios (el importador ya vale para cualquier código), incidencias, encargos, notas de voz,
  costes, meteorología, GeoJSON/KML/GPX.
- Verificación del correo de la cuenta y recuperación de contraseña (necesitan el correo configurado).
- Copia y restauración de la base y adjuntos: sin probar todavía.
