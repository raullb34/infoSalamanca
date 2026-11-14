// Tareas programadas del módulo meteorológico. Frecuencias según cuándo cambian los datos de cada fuente:
//   InfoRiego publica el día anterior hacia las 13:45 (Madrid): mirar cada 3 h basta.
//   AEMET actualiza la observación continuamente: cada hora (solo con AEMET_API_KEY).
//   Open-Meteo: cada modelo sale cada 6 h; se archiva una pasada por punto de verificación cada 6 h.
const scheduler = require('./scheduler');
const store = require('./store');
const inforiego = require('./providers/inforiego');
const aemet = require('./providers/aemet');
const openmeteo = require('./providers/openmeteo');
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
  scheduler.register('estado-estaciones', () => store.refreshStationStatus().then(n => ({ marcadas: n })), { everyMs: HOUR, firstInMs: 5 * 60000 });
  scheduler.register('predicciones-archivo', archiveForecasts, { everyMs: 6 * HOUR, firstInMs: 3 * 60000, timeoutMs: 10 * 60 * 1000 });
}

module.exports = { registerAll, inforiegoStations, inforiegoObservations, aemetStations, aemetObservations, archiveForecasts, verificationPoints };
