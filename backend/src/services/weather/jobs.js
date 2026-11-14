// Tareas programadas del módulo meteorológico. Frecuencias según cuándo cambian los datos de cada fuente:
//   InfoRiego publica el día anterior hacia las 13:45 (Madrid): mirar cada 3 h basta.
//   AEMET actualiza la observación continuamente: cada hora (solo con AEMET_API_KEY).
//   Open-Meteo: cada modelo sale cada 6 h; se archiva una pasada por punto de verificación cada 6 h.
const scheduler = require('./scheduler');
const store = require('./store');
const inforiego = require('./providers/inforiego');
const aemet = require('./providers/aemet');
const openmeteo = require('./providers/openmeteo');
const meteoclimatic = require('./providers/meteoclimatic');
const INE_CP = require('../../helpers/ine-codigopostal.json');
const { WeatherStation, WeatherObservation } = require('../../models/weather');
const MUNICIPIOS = require('../../data/municipios-salamanca.json').municipios;

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const BACKFILL_DAYS = 35; // para los gráficos de 30 días
const RECENT_DAYS = 3;

const utcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

async function inforiegoStations() {
  return store.upsertStations(await inforiego.fetchStations());
}

// Días que faltan (o están incompletos) en los últimos `days`, y se descargan
async function inforiegoObservations({ days } = {}) {
  const stations = await WeatherStation.find({ network: 'inforiego' }).select('_id').lean();
  if (!stations.length) await inforiegoStations();
  const hasAny = await WeatherObservation.exists({ source: 'inforiego' });
  const span = days || (hasAny ? RECENT_DAYS : BACKFILL_DAYS);
  const today = utcDay(new Date());
  const from = new Date(today.getTime() - span * DAY);
  // Observaciones por día ya guardadas
  const counts = await WeatherObservation.aggregate([
    { $match: { source: 'inforiego', variable: 'temperature', observedAt: { $gt: from } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: { $subtract: ['$observedAt', 60000] } } }, n: { $sum: 1 } } }
  ]);
  const have = new Map(counts.map(c => [c._id, c.n]));
  const expected = Math.max(1, stations.length || 4) * 40; // 48 medias horas por estación, con margen
  const totals = { days: 0, inserted: 0, duplicates: 0, suspicious: 0, errors: 0, pending: [] };
  for (let d = new Date(from.getTime() + DAY); d < today; d = new Date(d.getTime() + DAY)) {
    const key = d.toISOString().slice(0, 10);
    if ((have.get(key) || 0) >= expected) continue;
    const obs = await inforiego.fetchDay(d);
    if (!obs) { totals.pending.push(key); continue; } // aún no publicado
    const r = await store.ingestObservations(obs);
    totals.days++;
    for (const k of ['inserted', 'duplicates', 'suspicious', 'errors']) totals[k] += r[k];
  }
  return totals;
}

async function aemetStations() {
  if (!aemet.enabled()) return { skipped: 'sin AEMET_API_KEY' };
  return store.upsertStations(await aemet.fetchStations());
}

async function aemetObservations() {
  if (!aemet.enabled()) return { skipped: 'sin AEMET_API_KEY' };
  let ids = (await WeatherStation.find({ network: 'aemet' }).select('externalId').lean()).map(s => s.externalId);
  if (!ids.length) { await aemetStations(); ids = (await WeatherStation.find({ network: 'aemet' }).select('externalId').lean()).map(s => s.externalId); }
  return store.ingestObservations(await aemet.fetchLatest(ids));
}

// Meteoclimatic: el código de estación lleva el código postal (ESCYL3700000037120A → 37120). El municipio
// sale de él (y del nombre si el código postal es de varios); la ubicación es la del municipio, aproximada
const plain = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function meteoclimaticMunicipio(code, name) {
  const cp = Number(String(code).slice(-6, -1));
  const candidates = INE_CP.filter(r => r.CodigoPostal === cp).map(r => MUNICIPIOS.find(m => m.ine === String(r.CodMunicipio))).filter(Boolean);
  return candidates.find(m => plain(name).includes(plain(m.name)) || plain(m.name).includes(plain(name))) || candidates[0] || null;
}

async function meteoclimaticStations() {
  if (!meteoclimatic.enabled()) return { skipped: 'METEOCLIMATIC_ACCESO=off' };
  const stations = (await meteoclimatic.fetchStations()).map(s => {
    const m = meteoclimaticMunicipio(s.code, s.name);
    if (!m) return null;
    return {
      _id: `meteoclimatic:${s.code}`, network: 'meteoclimatic', externalId: s.code, name: s.name, altitude: s.altitude,
      lat: m.lat, lon: m.lon, approximateLocation: true, municipality: { ine: m.ine, name: m.name },
      stationType: 'colaborativa', sourceUrl: `https://www.meteoclimatic.net/perfil/${s.code}`, license: 'CC BY-NC-ND 3.0',
      variables: ['temperature', 'temperature_max', 'temperature_min', 'relative_humidity', 'pressure_msl', 'wind_speed', 'wind_direction', 'wind_gust', 'precipitation']
    };
  }).filter(Boolean);
  return store.upsertStations(stations);
}

async function meteoclimaticObservations() {
  if (!meteoclimatic.enabled()) return { skipped: 'METEOCLIMATIC_ACCESO=off' };
  if (!(await WeatherStation.exists({ network: 'meteoclimatic' }))) await meteoclimaticStations();
  return store.ingestObservations(await meteoclimatic.fetchLatest());
}

// Municipios con alguna estación a menos de 10 km: ahí se guardan todas las pasadas para evaluar modelos
async function verificationPoints() {
  const stations = await WeatherStation.find({ status: { $ne: 'baja' } }).select('municipality').lean();
  const ines = new Set(stations.map(s => s.municipality?.ine).filter(Boolean));
  return MUNICIPIOS.filter(m => ines.has(m.ine));
}

async function archiveForecasts() {
  const points = await verificationPoints();
  let saved = 0;
  for (const p of points) {
    for (const f of await openmeteo.fetchForecast(p)) {
      await store.saveForecast(f, { keep: true });
      saved++;
    }
  }
  return { points: points.length, saved };
}

function registerAll() {
  scheduler.register('inforiego-estaciones', inforiegoStations, { everyMs: DAY, firstInMs: 20000 });
  scheduler.register('inforiego-observaciones', () => inforiegoObservations(), { everyMs: 3 * HOUR, firstInMs: 60000, timeoutMs: 20 * 60 * 1000 });
  scheduler.register('aemet-estaciones', aemetStations, { everyMs: DAY, firstInMs: 40000 });
  scheduler.register('aemet-observaciones', aemetObservations, { everyMs: HOUR, firstInMs: 90000 });
  scheduler.register('meteoclimatic-estaciones', meteoclimaticStations, { everyMs: DAY, firstInMs: 50000 });
  // Tabla pública: una petición cada 30 min; con el RSS autorizado, cada 15
  scheduler.register('meteoclimatic-observaciones', meteoclimaticObservations, { everyMs: (meteoclimatic.access() === 'feed' ? 15 : 30) * 60000, firstInMs: 2 * 60000 });
  scheduler.register('estado-estaciones', () => store.refreshStationStatus().then(n => ({ marcadas: n })), { everyMs: HOUR, firstInMs: 5 * 60000 });
  scheduler.register('predicciones-archivo', archiveForecasts, { everyMs: 6 * HOUR, firstInMs: 3 * 60000, timeoutMs: 10 * 60 * 1000 });
}

module.exports = { registerAll, meteoclimaticStations, meteoclimaticObservations, meteoclimaticMunicipio, inforiegoStations, inforiegoObservations, aemetStations, aemetObservations, archiveForecasts, verificationPoints };
