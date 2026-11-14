// Conector InfoRiego (ITACyL). Ficheros abiertos, sin clave:
//   Situacion/UbicacionEstacionesITACyL 2009.csv            → catálogo (coordenadas ED50 en GGGMMSSsss)
//   DatosHorarios/AAAA/AAAAMMDD_RedClimaITACYL_Horario.zip  → registros semihorarios del día AAAAMMDD
// El día anterior se publica hacia las 13:45 (hora de Madrid). La hora del fichero es UTC y marca el FINAL
// de cada media hora (deducido del máximo de radiación solar; pendiente de confirmación por ITACyL).
// Licencia pendiente de confirmar (ODbL 1.0 o CC BY 4.0); cita obligatoria "©Instituto Tecnológico Agrario de
// Castilla y León". Mientras tanto se muestra pero no se redistribuye (ver sources.js).
const axios = require('axios');
const { readZip } = require('../zip');
const { observation, dmsToDecimal, toNumber } = require('../normalize');

const BASE = 'https://ftp.itacyl.es/Meteorologia/Datos_observacion_Red_InfoRiego';
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)';
const PROVINCE = '37'; // Salamanca. Para toda Castilla y León bastaría con quitar el filtro
const INTERVAL_MIN = 30;

// Columnas del CSV semihorario → variable común (unidad del fichero y tipo de agregación del intervalo)
const COLUMNS = [
  { col: 'Precipitación (mm)', variable: 'precipitation', unit: 'mm', aggregation: 'sum' },
  { col: 'Temperatura (ºC)', variable: 'temperature', unit: '°C', aggregation: 'mean' },
  { col: 'Humedad relativa (%)', variable: 'relative_humidity', unit: '%', aggregation: 'mean' },
  { col: 'Radiación (W/m2)', variable: 'solar_radiation', unit: 'W/m²', aggregation: 'mean' },
  { col: 'Vel. viento (m/s)', variable: 'wind_speed', unit: 'm/s', aggregation: 'mean' },
  { col: 'Dir. viento (º)', variable: 'wind_direction', unit: '°', aggregation: 'mean' }
];

const get = (url) => axios.get(url, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': UA } }).then(r => Buffer.from(r.data));
const latin1 = (buf) => buf.toString('latin1');
const rowsOf = (text) => text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()).map(l => l.split(';').map(c => c.replace(/^"|"$/g, '').trim()));

// ---------- Catálogo ----------
function parseStations(csvText) {
  const [header, ...rows] = rowsOf(csvText);
  const ix = (re) => header.findIndex(h => re.test(h));
  const iProv = ix(/IDPROVINCIA/i), iShort = ix(/SHORT NAME/i), iName = ix(/^NAME$/i), iLon = ix(/LONGITUD/i), iLat = ix(/LATITUD/i), iAlt = ix(/HEIGHT/i);
  return rows.filter(r => r[iProv] === String(Number(PROVINCE))).map(r => ({
    _id: `inforiego:${r[iShort]}`,
    network: 'inforiego',
    externalId: r[iShort],
    name: r[iName],
    lat: dmsToDecimal(r[iLat]),
    lon: dmsToDecimal(r[iLon]),
    altitude: toNumber(r[iAlt]),
    stationType: 'agroclimatica',
    variables: COLUMNS.map(c => c.variable),
    sourceUrl: 'https://www.inforiego.org/',
    license: 'Pendiente de confirmar por ITACyL'
  })).filter(s => s.lat !== null && s.lon !== null);
}

async function fetchStations() {
  return parseStations(latin1(await get(`${BASE}/Situacion/UbicacionEstacionesITACyL%202009.csv`)));
}

// ---------- Observaciones ----------
// Hora "2400" o "0000": se trata como minutos desde el inicio del día (24:00 = 00:00 del día siguiente)
function parseObservations(csvText, { stationPrefix = 'SA' } = {}) {
  const [header, ...rows] = rowsOf(csvText);
  const iCode = header.findIndex(h => /^C.digo$/i.test(h));
  const iDate = header.findIndex(h => /^Fecha/i.test(h));
  const iHour = header.findIndex(h => /^Hora/i.test(h));
  const cols = COLUMNS.map(c => ({ ...c, i: header.indexOf(c.col) })).filter(c => c.i >= 0);
  const out = [];
  for (const r of rows) {
    const code = r[iCode];
    if (!code || (stationPrefix && !code.startsWith(stationPrefix))) continue;
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r[iDate] || '');
    const h = /^(\d{1,2})(\d{2})$/.exec(r[iHour] || '');
    if (!d || !h) continue;
    const end = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]) + (Number(h[1]) * 60 + Number(h[2])) * 60000);
    for (const c of cols) {
      if (toNumber(r[c.i]) === null) continue; // ausente: no se crea observación (nunca 0)
      out.push(observation({
        station: `inforiego:${code}`, variable: c.variable, value: r[c.i], unit: c.unit, aggregation: c.aggregation,
        observedAt: end, intervalMinutes: INTERVAL_MIN, source: 'inforiego'
      }));
    }
  }
  return out;
}

const ymd = (date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

// Observaciones de un día (fecha UTC). null si el fichero aún no está publicado
async function fetchDay(date) {
  const day = ymd(date);
  let buf;
  try {
    buf = await get(`${BASE}/DatosHorarios/${day.slice(0, 4)}/${day}_RedClimaITACYL_Horario.zip`);
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
  const csv = readZip(buf).find(f => /\.csv$/i.test(f.name));
  if (!csv) throw new Error(`ZIP de ${day} sin CSV`);
  return parseObservations(latin1(csv.data));
}

module.exports = {
  id: 'inforiego',
  capabilities: ['stations', 'observations', 'history'],
  fetchStations,
  fetchDay,
  _test: { parseStations, parseObservations, COLUMNS }
};
