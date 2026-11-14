# El tiempo en Salamanca: plan de implementación

Módulo meteorológico de InfoSalamanca. Documento de trabajo (noviembre de 2026). Lo verificado contra la
fuente se indica como tal; lo que no se ha podido comprobar, también.

---

## 1. Estado actual del proyecto

| Aspecto | Qué hay | Consecuencia para el módulo |
|---|---|---|
| Frontend | Vue 3 (Options API con `setup`), Vite, Pinia. **Sin router**: una sola página con el mapa y paneles/modales encima (`App.vue`, `FilterSidebar`, `TownSidebar`, diálogos con `Teleport`) | Las "páginas por municipio" serán un panel/modal del pueblo, enlazable con `?tiempo=<slug>` (hash/query), no rutas `/tiempo/...` |
| Backend | Express 4, Node 18 (Docker `node:18-alpine`), CommonJS | Rutas nuevas en `backend/src/routes/`, servicios en `backend/src/services/` |
| Base de datos | MongoDB 7 con Mongoose 8. No hay PostgreSQL | Mongo basta para el MVP (ver §9). Sin PostGIS: la distancia se calcula con haversine sobre pocas decenas de estaciones |
| Caché | `node-cache` en memoria (Redis comentado en compose) | Igual: `node-cache` + documentos en Mongo para lo que debe sobrevivir a reinicios |
| Tareas programadas | `setInterval`/`setTimeout` dentro del backend (Lonja cada 12 h, cines cada 3 h) | Mismo patrón, con un pequeño planificador común (bloqueo, reintentos, estado) |
| Mapas | SVG propio de los 362 municipios (`InteractiveMap`) y relieve 3D con three.js (`RelieveMap`). Sin Leaflet | Las estaciones se pintan sobre el SVG existente (proyección ya resuelta para bibliobuses). No se añade Leaflet |
| Gráficos | Sin librería: SVG hecho a mano (`LonjaViewer`, `TownEvolution`) con la paleta validada del proyecto | Mismo enfoque; ECharts no compensa (≈ 1 MB) para 3-4 gráficos de líneas |
| Autenticación | Sin usuarios. `ADMIN_TOKEN` para rutas de escritura (`requireAdmin`) | La API meteorológica es de solo lectura y pública; las acciones de mantenimiento, con `requireAdmin` |
| Servicios externos | Junta (Opendatasoft), Diputación (CKAN), INE, IGN, Wikimedia, Groq, webs de cines | Mismo cliente (`axios`) y mismo User-Agent identificado |
| Configuración | `.env` en el servidor (chmod 600) pasado por `docker-compose.yml` | Nueva variable `AEMET_API_KEY` (y opcionales) por el mismo camino |
| Despliegue | Docker Compose en un VPS (mongo, backend, frontend, nginx) tras el nginx del sistema con Let's Encrypt | Sin servicios nuevos |
| Pruebas | No hay framework (`npm test` vacío; dos scripts sueltos) | `node:test` + `node:assert`, incluidos en Node 18: **sin dependencias nuevas** |
| Convenciones | Comentarios y textos en español, datos estáticos en `backend/src/data/*.json`, scripts en `backend/scripts/`, nada de datos inventados | Se siguen |

---

## 2. Arquitectura propuesta

```text
                       ┌───────────────────── backend (Express, mismo proceso) ─────────────────────┐
 Fuentes               │  providers/            normalize + validate        Mongo (mismas BD)        │
 AEMET OpenData ──────▶│  aemet.js     ─┐                                  weatherStations          │
 InfoRiego (ITACyL) ──▶│  inforiego.js ─┼─▶ observación común ─▶ calidad ─▶ weatherObservations      │
 Meteoclimatic (off) ─▶│  meteoclimatic─┘                                  weatherSyncState          │
 Open-Meteo ──────────▶│  openmeteo.js ───▶ predicción común ─────────────▶ weatherForecasts         │
                       │                                                                              │
                       │  scheduler.js: tareas por proveedor (bloqueo, reintentos, backoff, estado)   │
                       │  routes/weather.js  /api/v1/weather/*  (solo lectura, caché, límites)        │
                       │  routes/openData.js /open-data/weather/*  (CSV/JSON, solo redistribuible)    │
                       └──────────────────────────────────────────────────────────────────────────────┘
 Frontend: categoría "Tiempo" en la barra → mapa de estaciones sobre el SVG + panel "El tiempo en <pueblo>"
```

Principios: un único backend, una única base de datos, adquisición → normalización → almacenamiento →
presentación separados, y un **registro de fuentes** (`sources.js`) que decide qué se puede consultar,
guardar, mostrar y redistribuir.

---

## 3. Tecnologías que se reutilizan

Express, Mongoose/MongoDB, `axios`, `node-cache`, el patrón de tareas en proceso, el mapa SVG con su
proyección, los gráficos SVG y la paleta de datos validada, los diálogos con `Teleport`, el estilo de las
fichas (escaparate), `requireAdmin`, Docker Compose y nginx.

**Dependencias nuevas: ninguna.** Para leer los ZIP de InfoRiego se usa `zlib` (nativo) con un lector
mínimo de ZIP; para las pruebas, `node:test`.

---

## 4. Componentes nuevos

| Componente | Ubicación |
|---|---|
| Registro de fuentes y licencias | `backend/src/services/weather/sources.js` |
| Unidades, fechas y validación | `backend/src/services/weather/normalize.js`, `validate.js` |
| Conectores | `backend/src/services/weather/providers/{aemet,inforiego,openmeteo,meteoclimatic}.js` |
| Persistencia (upserts idempotentes) | `backend/src/services/weather/store.js` |
| Planificador | `backend/src/services/weather/scheduler.js` |
| Municipios (362, coordenadas oficiales) | `backend/src/data/municipios-salamanca.json` (registro de municipios de la Junta) |
| Modelos Mongoose | `backend/src/models/weather{Station,Observation,Forecast,SyncState}.js` |
| API | `backend/src/routes/weather.js` (`/api/v1/weather`), OpenAPI en `docs/meteorologia/openapi.yaml` |
| Datos abiertos | `backend/src/routes/openDataWeather.js` (`/open-data/weather`) |
| Pruebas | `backend/test/weather/*.test.js` con respuestas guardadas en `backend/test/fixtures/` |
| Frontend | `components/weather/*` (panel del pueblo, mapa de estaciones, gráfico, comparador) |

---

## 5. Modelo de datos

### 5.1 Estaciones (`weatherStations`)

`id` interno estable = `<red>:<idExterno>` (p. ej. `aemet:2867`, `inforiego:SA01`), único. Campos:
`network`, `externalId`, `name`, `municipality` (INE + nombre), `province`, `lat`, `lon`, `altitude`,
`stationType` (`oficial` | `agroclimatica` | `colaborativa`), `status` (`activa` | `sin-datos-recientes` |
`baja`), `variables[]`, `sourceUrl`, `license`, `lastObservationAt`, `sameAs[]` (misma estación física en
otra red, se rellena a mano), `createdAt`, `updatedAt`.

### 5.2 Observaciones (`weatherObservations`): formato largo

Un documento por **estación × variable × instante**:

```text
station, variable, value, unit, aggregation (instant|mean|sum|max|min),
observedAt (fin del intervalo, UTC), intervalStart, intervalEnd, source, quality{status, checks[]}, createdAt
```

Índice único `{station, variable, observedAt, aggregation}` (idempotencia: reintentar no duplica) e índices
`{variable, observedAt}` y `{observedAt}`.

**Por qué formato largo y no una fila con muchas columnas.** Las redes no miden lo mismo ni con el mismo
significado temporal: AEMET da temperatura instantánea y máxima/mínima de la hora; InfoRiego, medias y
acumulados semihorarios. Con columnas habría que inventar huecos o mezclar una "precipitación" horaria con
una semihoraria en el mismo campo. En largo, cada valor lleva su unidad, su agregación y su intervalo, los
ausentes simplemente no existen (nunca un cero falso) y una red nueva no obliga a cambiar el esquema. El
coste (más documentos) es asumible: ~25 estaciones × 8 variables × 24-48 registros/día ≈ 5-10 mil
documentos/día, unos 3 millones al año, de sobra para Mongo con estos índices. Las exportaciones de datos
abiertos piden precisamente este formato (§13.3).

Variables canónicas y unidad interna: `temperature` °C, `relative_humidity` %, `pressure` hPa (estación) y
`pressure_msl` hPa (nivel del mar), `wind_speed` y `wind_gust` m/s, `wind_direction` grados,
`precipitation` mm, `solar_radiation` W/m², `evapotranspiration` mm.

### 5.3 Predicciones (`weatherForecasts`)

Un documento por **punto × modelo × emisión**, con las series horarias en arrays (compacto):

```text
point (INE del municipio), lat, lon, model, provider, issuedAt (inicio de la pasada del modelo, UTC),
retrievedAt, times[], temperature[], relative_humidity[], precipitation[], precipitation_probability[],
wind_speed[], wind_direction[], cloud_cover[], weather_code[], units{}, daily{...}
```

`issuedAt` (cuándo se generó) y `times[]` (para cuándo) van siempre separados. Índice único
`{point, model, issuedAt}`: una pasada nueva **no** pisa la anterior. Retención: todas las pasadas 10 días
(TTL); para los municipios con estación cerca se conserva una pasada al día de forma indefinida (para
evaluar modelos más adelante). El resto de municipios se pide bajo demanda y se guarda en caché 1 hora.

### 5.4 Estado de sincronización (`weatherSyncState`)

Por tarea: `lastRunAt`, `lastSuccessAt`, `lastError`, `consecutiveFailures`, `nextRunAt`, `running` +
`lockedUntil` (evita ejecuciones simultáneas), contadores de insertados/duplicados/sospechosos.

---

## 6. Fuentes meteorológicas (verificadas en noviembre de 2026)

| Fuente | Acceso | Qué da | Frecuencia | Licencia | Redistribuible | Estado en el MVP |
|---|---|---|---|---|---|---|
| **AEMET OpenData** | API REST con clave gratuita (`api_key`), respuesta en dos pasos (URL de datos + metadatos). Endpoints comprobados en su especificación: `/api/observacion/convencional/todas` (últimas 12 h, horario), `/datos/estacion/{idema}`, `/api/valores/climatologicos/inventarioestaciones/todasestaciones`, `/api/prediccion/especifica/municipio/{diaria,horaria}/{municipio}`, `/api/valores/climatologicos/diarios/...` | Observación horaria oficial; predicción oficial por municipio; climatología diaria | Continua (observación); el MVP consulta cada hora | Nota legal de AEMET: reutilización comercial y no comercial **citando "© AEMET"** e indicando la fecha de actualización; no sugerir patrocinio | Sí, con atribución | Conector hecho y probado con datos de ejemplo; **bloqueado hasta tener `AEMET_API_KEY`**. Los nombres de los campos de la respuesta deben confirmarse con el fichero de metadatos (requiere clave) |
| **InfoRiego (ITACyL)** | Ficheros abiertos sin clave: `https://ftp.itacyl.es/Meteorologia/Datos_observacion_Red_InfoRiego/` (`DatosHorarios/AAAA/AAAAMMDD_RedClimaITACYL_Horario.zip`, `DatosDiarios/`, `Situacion/` con la ubicación de las estaciones) | Semihorario: precipitación, temperatura, humedad, radiación, velocidad y dirección del viento. Histórico desde 2001 | Diaria: el día anterior se publica hacia las 13:45 | `LICENSE.txt` del servidor: **ODbL 1.0** con cita obligatoria "©Instituto Tecnológico Agrario de Castilla y León". (La ficha de datos.gob.es dice CC BY 4.0: discrepancia a aclarar con ITACyL) | Sí, con atribución y **compartir igual** (ODbL) | Conector activo. 4 estaciones en Salamanca: SA01 Ciudad Rodrigo, SA03 Aldearrubia, SA101 Arabayona, SA102 Éjeme. Hora en **UTC** (deducido del máximo de radiación; pendiente de confirmar) |
| **SIAR (MAPA)** | API REST con clave (token por correo) y límites por usuario | Mismas estaciones agroclimáticas | — | Por confirmar | Por confirmar | No necesario: InfoRiego ya da estas estaciones sin clave |
| **Meteoclimatic** | Feeds RSS/XML por estación (los usan paquetes de terceros) | Red colaborativa: actuales y extremos del día | — | **No se ha encontrado** ninguna condición de reutilización publicada | **No** (pendiente de autorización) | Conector preparado y **desactivado** |
| **Weathercloud / Weather Underground** | API con cuenta/clave, condiciones comerciales | Estaciones particulares | — | Restrictiva | No | Fuera del MVP |
| **Open-Meteo** | API sin clave; `models=ecmwf_ifs025,icon_seamless,gfs_seamless` comprobado para Salamanca | Predicción horaria de varios modelos (temperatura, precipitación y su probabilidad, viento, nubosidad, código de tiempo) | Según la pasada de cada modelo | Datos **CC BY 4.0**, enlace "Weather data by Open-Meteo.com" junto a los datos. API gratuita **solo para uso no comercial** y < 10 000 llamadas/día | Sí, con atribución (uso no comercial) | Conector activo. **Requisito**: InfoSalamanca debe seguir siendo no comercial; si cambia, plan de pago o API propia |

---

## 7. Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1. Auditoría | Este documento, registro de fuentes y licencias | Hecho |
| 2. Backend de observaciones | Modelos, normalización, validación, conectores InfoRiego y AEMET, persistencia idempotente, planificador | Hecho (AEMET a la espera de clave) |
| 3. Predicciones | Conector Open-Meteo (3 modelos), por municipio bajo demanda con caché, archivo de pasadas en puntos con estación, comparador | Hecho en el backend (API) |
| 4. Frontend | Categoría "Tiempo", estaciones sobre el mapa, panel del municipio (ahora, horas, días, estaciones cercanas, modelos), gráficos 24 h / 7 d / 30 d | — |
| 5. Datos abiertos | API v1 con OpenAPI, CSV/JSON estables, históricos mensuales, `metadata.json` DCAT-AP-ES, propuesta a la Junta | — |
| 6. Validación | Pruebas, rendimiento, revisión de licencias, instrucciones de despliegue | Continuo |

---

## 8. Riesgos y dependencias

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Sin `AEMET_API_KEY` | No hay observación oficial "de ahora" | Conector listo y desactivado; el resto funciona. La clave es gratuita (se pide con un correo en opendata.aemet.es) |
| InfoRiego publica con un día de retraso | No sirve como "tiempo actual" | Se usa para histórico y gráficos; "ahora" sale de AEMET y, si no hay, de la predicción indicando que lo es |
| Licencia ODbL de InfoRiego | Compartir igual: lo derivado se publica también con ODbL | Exportaciones de InfoRiego con ODbL y su cita; aclarar con ITACyL la discrepancia con CC BY 4.0 |
| Open-Meteo solo no comercial | Si InfoSalamanca pasa a ser comercial, deja de valer | Documentado; cambiar a plan de pago o AEMET |
| Formato de AEMET sin verificar | Puede fallar al recibir datos reales | Conector tolerante; pruebas con ejemplo; verificación con la clave antes de activarlo |
| Crecimiento de Mongo | Disco del VPS | Formato compacto de predicciones, TTL de 10 días, archivo solo de puntos con estación |
| Caídas de fuentes | Huecos | Reintentos con backoff, estado visible, datos antiguos marcados como tales |

---

## 9. Decisiones técnicas

1. **MongoDB y no PostgreSQL/PostGIS.** Ya está desplegado y respaldado; el volumen (~3 M observaciones/año) y
   las consultas (por estación y rango de fechas, por variable) se resuelven con índices compuestos. La
   única operación espacial (estaciones cercanas a un municipio) afecta a unas decenas de puntos: haversine
   en memoria. Añadir otra base de datos duplicaría copias de seguridad y despliegue sin ventaja real.
2. **Sin base de datos de series temporales.** No hay volumen que la justifique.
3. **Observaciones en formato largo** (§5.2) y **predicciones en arrays por pasada** (§5.3).
4. **Tareas en proceso** con bloqueo en Mongo y reintentos: mismo patrón que el resto del backend, sin cron
   del sistema ni colas.
5. **Sin librería de mapas ni de gráficos nuevas**: se reutilizan el SVG de municipios y los gráficos SVG.
6. **Sin router**: el municipio se abre como panel, con enlace compartible por query (`?tiempo=bejar`).
7. **Datos abiertos solo de fuentes redistribuibles** según `sources.js`; cada fichero lleva su licencia y
   atribución. Lo dudoso (Meteoclimatic) no se publica.
8. **Fechas en UTC** en base de datos y API (ISO 8601 con `Z`); el frontend muestra Europe/Madrid.
9. **La API no es un proxy**: solo sirve lo almacenado o lo pedido para los 362 municipios conocidos, con
   caché y límite de peticiones.

---

## 10. Estado (14 de noviembre de 2026)

**Hecho y comprobado con datos reales** (Mongo en memoria):

- InfoRiego: 4 estaciones de Salamanca y 34 días de relleno inicial (39 144 observaciones en 23 s). Volver a
  leer los mismos días no inserta nada (idempotente).
- Calidad: 692 lecturas de humedad del 0 % (sensor averiado) marcadas como erróneas, guardadas pero fuera de
  "ahora" y de los gráficos.
- Bloqueo: dos ejecuciones simultáneas de la misma tarea → la segunda se salta.
- Open-Meteo: ECMWF IFS, ICON-EU y GFS con su hora de emisión real (metadato de cada modelo); archivo de
  pasadas en los 4 municipios con estación sin duplicar.
- API `/api/v1/weather`: estaciones, último dato, histórico 24 h / 7 d / 30 d agregado, municipios,
  situación actual (estaciones cercanas + modelos, sin hacerlas pasar por medidas del pueblo), predicción
  por horas y días, comparador de modelos, fuentes y estado de las tareas.
- Pruebas: `npm test` en `backend/` (node:test, 20 pruebas, sin red ni base de datos).

**Pendiente de decisiones externas**

| Bloqueo | Qué hace falta | Quién |
|---|---|---|
| Observación oficial de AEMET | Pedir la clave gratuita en https://opendata.aemet.es/centrodedescargas/altaUsuario y ponerla en `.env` como `AEMET_API_KEY`; al activarla, verificar los nombres de campo con el fichero de metadatos y guardar una respuesta real como prueba | Responsable del proyecto |
| Uso de Open-Meteo gratuito | Confirmar que InfoSalamanca es y seguirá siendo **no comercial** | Responsable del proyecto |
| Licencia de InfoRiego | Aclarar con inforiego@itacyl.es si rige ODbL 1.0 (LICENSE.txt) o CC BY 4.0 (datos.gob.es) | Responsable del proyecto |
| Meteoclimatic | Autorización por escrito para mostrar y redistribuir | Responsable del proyecto |

**Siguiente**: fase 4 (frontend) y fase 5 (exportaciones CSV/JSON, `metadata.json`, OpenAPI y propuesta a la Junta).
