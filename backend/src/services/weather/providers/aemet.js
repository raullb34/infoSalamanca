// Conector AEMET OpenData. Necesita AEMET_API_KEY (gratuita: https://opendata.aemet.es/centrodedescargas/altaUsuario).
// Las respuestas llegan en dos pasos: la API devuelve { estado, descripcion, datos, metadatos } y los datos se
// descargan de la URL `datos` (JSON en ISO-8859-15). Endpoints comprobados en la especificación oficial
// (https://opendata.aemet.es/AEMET_OpenData_specification.json):
//   /api/valores/climatologicos/inventarioestaciones/todasestaciones   (catálogo, con provincia)
//   /api/observacion/convencional/todas                                (última observación horaria, 12 h)
//
// PENDIENTE DE VERIFICAR CON LA CLAVE: los nombres y significados de los campos se han tomado de la
// documentación de AEMET (fichero de metadatos de cada producto, que exige clave). Si al activar el conector
// los metadatos dicen otra cosa, se corrige FIELDS y su prueba.
const axios = require('axios');
const { observation, toNumber, toUtc } = require('../normalize');

const BASE = 'https://opendata.aemet.es/opendata';
const PROVINCE = 'SALAMANCA';

// Campo de la observación convencional → variable común
const FIELDS = [
  { field: 'ta', variable: 'temperature', unit: '°C', aggregation: 'instant', minutes: 0 },
  { field: 'tamax', variable: 'temperature_max', unit: '°C', aggregation: 'max', minutes: 60 },
  { field: 'tamin', variable: 'temperature_min', unit: '°C', aggregation: 'min', minutes: 60 },
  { field: 'hr', variable: 'relative_humidity', unit: '%', aggregation: 'instant', minutes: 0 },
  { field: 'prec', variable: 'precipitation', unit: 'mm', aggregation: 'sum', minutes: 60 },
  { field: 'vv', variable: 'wind_speed', unit: 'm/s', aggregation: 'mean', minutes: 10 },
  { field: 'dv', variable: 'wind_direction', unit: '°', aggregation: 'mean', minutes: 10 },
  { field: 'vmax', variable: 'wind_gust', unit: 'm/s', aggregation: 'max', minutes: 60 },
  { field: 'pres', variable: 'pressure', unit: 'hPa', aggregation: 'instant', minutes: 0 },
  { field: 'pres_nmar', variable: 'pressure_msl', unit: 'hPa', aggregation: 'instant', minutes: 0 }
];

const enabled = () => Boolean(process.env.AEMET_API_KEY);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Paso 1 (índice) y paso 2 (datos). Los 429 se propagan para que el planificador espere.
// `withMeta`: devuelve también el fichero de metadatos (descripción de los campos)
async function request(path, { withMeta = false } = {}) {
  const key = process.env.AEMET_API_KEY;
  if (!key) throw Object.assign(new Error('Falta AEMET_API_KEY'), { code: 'NO_KEY' });
  const { data: index } = await axios.get(`${BASE}${path}`, { params: { api_key: key }, timeout: 30000, validateStatus: s => s < 500 });
  if (index?.estado === 404) return withMeta ? { data: [], meta: null } : []; // "no hay datos que satisfagan esos criterios"
  if (index?.estado === 401) throw Object.assign(new Error('AEMET: clave no válida o caducada (401)'), { code: 'NO_KEY' });
  if (index?.estado !== 200 || !index?.datos) {
    throw Object.assign(new Error(`AEMET ${path}: ${index?.estado} ${index?.descripcion || ''}`.trim()), { status: index?.estado });
  }
  // El enlace de datos a veces tarda unos segundos en estar listo: un reintento corto
  const download = async (url) => {
    for (let i = 0; ; i++) {
      try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
        return JSON.parse(Buffer.from(res.data).toString('latin1'));
      } catch (err) {
        if (i >= 1 || ![404, 429, 500, 502, 503].includes(err.response?.status)) throw err;
        await sleep(3000);
      }
    }
  };
  const data = await download(index.datos);
  if (!withMeta) return data;
  return { data, meta: index.metadatos ? await download(index.metadatos).catch(() => null) : null };
}

// "405730N" / "0054020W" (grados, minutos, segundos) → grados decimales
function aemetDms(raw) {
  const m = /^(\d{2,3})(\d{2})(\d{2})([NSEW])$/.exec(String(raw || '').trim());
  if (!m) return toNumber(raw);
  const v = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return Math.round((/[SW]/.test(m[4]) ? -v : v) * 1e6) / 1e6;
}

function parseInventory(rows) {
  return (rows || []).filter(r => String(r.provincia || '').toUpperCase() === PROVINCE).map(r => ({
    _id: `aemet:${r.indicativo}`,
    network: 'aemet',
    externalId: r.indicativo,
    name: r.nombre,
    lat: aemetDms(r.latitud),
    lon: aemetDms(r.longitud),
    altitude: toNumber(r.altitud),
    stationType: 'oficial',
    sourceUrl: 'https://opendata.aemet.es/',
    license: 'Condiciones de reutilización de AEMET'
  })).filter(s => s.lat !== null && s.lon !== null);
}

// Observaciones de las estaciones conocidas (ids externos). `fint` es el fin del periodo, en UTC
function parseObservations(rows, stationIds) {
  const wanted = stationIds ? new Set(stationIds) : null;
  const out = [];
  for (const r of rows || []) {
    if (!r.idema || (wanted && !wanted.has(r.idema))) continue;
    const end = toUtc(r.fint, { assume: 'UTC' });
    if (!end) continue;
    for (const f of FIELDS) {
      if (toNumber(r[f.field]) === null) continue; // ausente: no se crea observación
      out.push(observation({
        station: `aemet:${r.idema}`, variable: f.variable, value: r[f.field], unit: f.unit, aggregation: f.aggregation,
        observedAt: end, intervalMinutes: f.minutes, source: 'aemet'
      }));
    }
  }
  return out;
}

const fetchStations = async () => parseInventory(await request('/api/valores/climatologicos/inventarioestaciones/todasestaciones'));
const fetchLatest = async (stationIds) => parseObservations(await request('/api/observacion/convencional/todas'), stationIds);

module.exports = {
  id: 'aemet',
  capabilities: ['stations', 'observations'],
  enabled,
  fetchStations,
  fetchLatest,
  request,
  _test: { parseInventory, parseObservations, aemetDms, FIELDS }
};
