// Persistencia del módulo meteorológico. Todas las escrituras son idempotentes: repetir una sincronización
// no duplica observaciones (índice único + $setOnInsert) ni predicciones (una por punto × modelo × emisión).
const { WeatherStation, WeatherObservation, WeatherForecast } = require('../../models/weather');
const { validateBatch } = require('./validate');
const { distanceKm } = require('./normalize');
const { can } = require('./sources');
const MUNICIPIOS = require('../../data/municipios-salamanca.json').municipios;

const STALE_MS = 48 * 60 * 60 * 1000;

// Municipio comprobado a mano para estaciones cuyo nombre no es el de un pueblo (punto de la estación
// contra los límites municipales de OpenStreetMap, 14/11/2026). Manda sobre el cálculo automático
const STATION_MUNICIPALITY = {
  'aemet:2867': '37069', // Salamanca Aeropuerto (Matacán): el aeródromo ocupa Machacón, Calvarrasa de Abajo y Villagonzalo de Tormes; la estación cae en Calvarrasa de Abajo
  'aemet:2491C': '37212', // La Covatilla, estación de esquí → Navacarros
  'aemet:2914C': '37135' // Boadilla Fuente San Esteban → La Fuente de San Esteban
};

const plain = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Municipio de una estación: primero por nombre (InfoRiego y AEMET suelen llamarla como el pueblo:
// "Arabayona" → Arabayona de Mógica) si está cerca; si no, el término cuyo centro está más cerca.
// El centro del término es el del ayuntamiento, así que lo segundo es una aproximación.
function municipioOf(name, lat, lon) {
  const n = plain(name).replace(/\s*\(.*\)$/, '');
  if (n) {
    const byName = MUNICIPIOS.filter(m => { const mn = plain(m.name); return mn === n || mn.startsWith(`${n} `) || n.startsWith(`${mn} `); })
      .map(m => ({ m, d: distanceKm(lat, lon, m.lat, m.lon) })).filter(x => x.d < 12).sort((a, b) => a.d - b.d)[0];
    if (byName) return { ine: byName.m.ine, name: byName.m.name, distanceKm: byName.d };
  }
  return nearestMunicipio(lat, lon);
}

// Municipio más cercano (para estaciones sin municipio en origen)
function nearestMunicipio(lat, lon) {
  let best = null;
  for (const m of MUNICIPIOS) {
    const d = distanceKm(lat, lon, m.lat, m.lon);
    if (!best || d < best.d) best = { m, d };
  }
  return best ? { ine: best.m.ine, name: best.m.name, distanceKm: best.d } : null;
}

async function upsertStations(stations) {
  if (!stations.length) return { upserted: 0, modified: 0 };
  const ops = stations.map(s => {
    const fixed = MUNICIPIOS.find(m => m.ine === STATION_MUNICIPALITY[s._id]);
    const near = s.municipality?.ine || fixed ? null : municipioOf(s.name, s.lat, s.lon);
    const doc = { ...s, municipality: s.municipality || (fixed ? { ine: fixed.ine, name: fixed.name } : near ? { ine: near.ine, name: near.name } : undefined) };
    const { _id, ...rest } = doc;
    return { updateOne: { filter: { _id }, update: { $set: rest }, upsert: true } };
  });
  const r = await WeatherStation.bulkWrite(ops, { ordered: false });
  return { upserted: r.upsertedCount, modified: r.modifiedCount };
}

// Valida e inserta. Las que ya existían se cuentan como duplicadas y no se tocan
async function ingestObservations(observations, { now = new Date() } = {}) {
  const present = observations.filter(o => o.value !== null && o.value !== undefined); // ausente ≠ 0
  if (present.length && !can(present[0].source, 'store')) throw new Error(`La fuente ${present[0].source} no permite guardar datos`);
  const { observations: valid, duplicates: batchDuplicates } = validateBatch(present, now);
  if (!valid.length) return { inserted: 0, duplicates: batchDuplicates, suspicious: 0, errors: 0 };
  const ops = valid.map(o => ({
    updateOne: {
      filter: { station: o.station, variable: o.variable, observedAt: o.observedAt, aggregation: o.aggregation },
      update: { $setOnInsert: o },
      upsert: true
    }
  }));
  let inserted = 0;
  for (let i = 0; i < ops.length; i += 2000) {
    const r = await WeatherObservation.bulkWrite(ops.slice(i, i + 2000), { ordered: false });
    inserted += r.upsertedCount;
  }
  // Última observación por estación
  const last = new Map();
  for (const o of valid) if (!last.has(o.station) || o.observedAt > last.get(o.station)) last.set(o.station, o.observedAt);
  await WeatherStation.bulkWrite([...last].map(([station, at]) => ({
    updateOne: { filter: { _id: station, $or: [{ lastObservationAt: { $lt: at } }, { lastObservationAt: null }] }, update: { $set: { lastObservationAt: at, status: 'activa' } } }
  })), { ordered: false });
  return {
    inserted,
    duplicates: batchDuplicates + (valid.length - inserted),
    suspicious: valid.filter(o => o.quality.status === 'sospechosa').length,
    errors: valid.filter(o => o.quality.status === 'erronea').length
  };
}

// Estaciones sin datos en 48 h → 'sin-datos-recientes' (InfoRiego publica con un día de retraso)
async function refreshStationStatus(now = new Date()) {
  const limit = new Date(now.getTime() - STALE_MS);
  const r = await WeatherStation.updateMany(
    { status: 'activa', $or: [{ lastObservationAt: { $lt: limit } }, { lastObservationAt: null }] },
    { $set: { status: 'sin-datos-recientes' } }
  );
  return r.modifiedCount;
}

// Guarda una pasada de predicción. keep=true: archivo permanente; si no, caduca a los 10 días
async function saveForecast(f, { keep = false } = {}) {
  // Un mismo campo no puede ir en $setOnInsert y en $set a la vez
  const update = keep
    ? { $setOnInsert: f, $set: { keep: true }, $unset: { expiresAt: 1 } } // si ya estaba con caducidad, pasa a archivo
    : { $setOnInsert: { ...f, keep: false, expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000) } };
  await WeatherForecast.updateOne({ point: f.point, model: f.model, issuedAt: f.issuedAt }, update, { upsert: true });
}

module.exports = { municipioOf, nearestMunicipio, upsertStations, ingestObservations, refreshStationStatus, saveForecast, STALE_MS };
