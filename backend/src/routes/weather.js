// API pública del tiempo: /api/v1/weather (solo lectura, JSON, fechas ISO 8601 en UTC).
// Documentación: docs/meteorologia/openapi.yaml. Límite: 60 peticiones/minuto por IP.
const express = require('express');
const mongoose = require('mongoose');
const { WeatherStation, WeatherObservation, WeatherSyncState } = require('../models/weather');
const { SOURCES } = require('../services/weather/sources');
const { VARIABLES, distanceKm, toUtc } = require('../services/weather/normalize');
const { MUNICIPIOS, findMunicipio, forecastFor } = require('../services/weather/forecast');
const openmeteo = require('../services/weather/providers/openmeteo');
const scheduler = require('../services/weather/scheduler');
const requireAdmin = require('../middleware/requireAdmin');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();
router.use(rateLimit({ perMinute: 60, perDay: 5000 }));

const dbReady = () => mongoose.connection.readyState === 1;
const bad = (res, msg) => res.status(400).json({ error: msg });
const STATION_ID = /^[a-z]+:[A-Za-z0-9_-]{1,20}$/;
const PERIODS = { '24h': 24 * 3600e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 };
const NEARBY_KM = 30;
const RECENT_MS = 3 * 3600e3; // "ahora" = observación de las últimas 3 horas

// Envoltorio: errores → 500 JSON; sin base de datos → 503
const handler = (fn, { needsDb = true } = {}) => async (req, res) => {
  if (needsDb && !dbReady()) return res.status(503).json({ error: 'Base de datos no disponible' });
  try { await fn(req, res); } catch (err) {
    console.error('API tiempo:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
};
// El identificador de estación se valida antes que nada (también sin base de datos)
const validStation = (req, res, next) => (STATION_ID.test(req.params.id) ? next() : bad(res, 'Identificador de estación no válido (p. ej. inforiego:SA01)'));

const attributionOf = (sourceIds) => [...new Set(sourceIds)].map(id => SOURCES[id]).filter(Boolean)
  .map(s => ({ source: s.id, attribution: s.attribution, license: s.license, url: s.url }));

// Último valor de cada variable de unas estaciones
async function latestByStation(stationIds) {
  if (!stationIds.length) return {};
  const rows = await WeatherObservation.aggregate([
    { $match: { station: { $in: stationIds }, observedAt: { $gt: new Date(Date.now() - 4 * 86400e3) }, 'quality.status': { $ne: 'erronea' } } },
    { $sort: { observedAt: -1 } },
    { $group: { _id: { station: '$station', variable: '$variable', aggregation: '$aggregation' }, value: { $first: '$value' }, unit: { $first: '$unit' }, observedAt: { $first: '$observedAt' }, intervalStart: { $first: '$intervalStart' }, quality: { $first: '$quality.status' } } }
  ]);
  const out = {};
  for (const r of rows) {
    const s = (out[r._id.station] ||= {});
    // Si hay varias agregaciones de la misma variable, se prefiere la instantánea y luego la media
    const prev = s[r._id.variable];
    const rank = { instant: 0, mean: 1, sum: 2, max: 3, min: 4 };
    if (!prev || rank[r._id.aggregation] < rank[prev.aggregation]) {
      s[r._id.variable] = { value: r.value, unit: r.unit, aggregation: r._id.aggregation, observedAt: r.observedAt, intervalStart: r.intervalStart, quality: r.quality };
    }
  }
  return out;
}

// ---------- Fuentes, variables y estado ----------
router.get('/sources', handler(async (req, res) => {
  res.json({ sources: Object.values(SOURCES), variables: VARIABLES });
}, { needsDb: false }));

router.get('/status', handler(async (req, res) => {
  const tasks = await WeatherSyncState.find().lean();
  res.json({ tasks: tasks.map(({ lockedUntil, ...t }) => ({ ...t, running: Boolean(lockedUntil && lockedUntil > new Date()) })) });
}));

// Ejecutar una tarea a mano (mantenimiento)
router.post('/sync/:task', requireAdmin, handler(async (req, res) => {
  if (!scheduler.list().includes(req.params.task)) return bad(res, `Tarea desconocida. Disponibles: ${scheduler.list().join(', ')}`);
  res.json({ task: req.params.task, result: await scheduler.runTask(req.params.task) });
}));

// ---------- Estaciones ----------
router.get('/stations', handler(async (req, res) => {
  const { network, status, municipality } = req.query;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const filter = {};
  if (network) filter.network = String(network);
  if (status) filter.status = String(status);
  if (municipality) filter['municipality.ine'] = String(municipality).split('_')[0];
  const [total, stations] = await Promise.all([
    WeatherStation.countDocuments(filter),
    WeatherStation.find(filter).sort({ network: 1, name: 1 }).skip(offset).limit(limit).lean()
  ]);
  const withLatest = req.query.latest === 'true';
  const latest = withLatest ? await latestByStation(stations.map(s => s._id)) : {};
  res.json({
    total, limit, offset,
    stations: stations.map(s => ({ id: s._id, ...s, _id: undefined, latest: withLatest ? latest[s._id] || {} : undefined })),
    attribution: attributionOf(stations.map(s => s.network))
  });
}));

router.get('/stations/:id', validStation, handler(async (req, res) => {
  const s = await WeatherStation.findById(req.params.id).lean();
  if (!s) return res.status(404).json({ error: 'Estación no encontrada' });
  res.json({ id: s._id, ...s, _id: undefined, attribution: attributionOf([s.network]) });
}));

router.get('/stations/:id/latest', validStation, handler(async (req, res) => {
  const s = await WeatherStation.findById(req.params.id).lean();
  if (!s) return res.status(404).json({ error: 'Estación no encontrada' });
  const latest = await latestByStation([s._id]);
  res.json({ station: s._id, lastObservationAt: s.lastObservationAt, status: s.status, variables: latest[s._id] || {}, attribution: attributionOf([s.network]) });
}));

// Histórico agregado: 24 h tal cual; 7 d por horas; 30 d por días (media, mín., máx. y suma)
router.get('/stations/:id/history', validStation, handler(async (req, res) => {
  const variable = String(req.query.variable || 'temperature');
  if (!VARIABLES[variable]) return bad(res, `Variable no válida. Disponibles: ${Object.keys(VARIABLES).join(', ')}`);
  const period = String(req.query.period || '24h');
  if (!PERIODS[period]) return bad(res, 'Periodo no válido: 24h, 7d o 30d');
  const s = await WeatherStation.findById(req.params.id).select('network lastObservationAt').lean();
  if (!s) return res.status(404).json({ error: 'Estación no encontrada' });
  // El periodo se cuenta hacia atrás desde la última observación (InfoRiego va con un día de retraso)
  const end = s.lastObservationAt || new Date();
  const start = new Date(end.getTime() - PERIODS[period]);
  const match = { station: s._id, variable, observedAt: { $gt: start, $lte: end }, 'quality.status': { $ne: 'erronea' } };
  const unit = VARIABLES[variable].unit;
  if (period === '24h') {
    const rows = await WeatherObservation.find(match).sort({ observedAt: 1 }).select('observedAt value aggregation quality.status -_id').lean();
    return res.json({ station: s._id, variable, unit, period, resolution: 'original', from: start, to: end, points: rows.map(r => ({ t: r.observedAt, v: r.value, aggregation: r.aggregation, quality: r.quality?.status })), attribution: attributionOf([s.network]) });
  }
  const unitStr = period === '7d' ? 'hour' : 'day';
  const rows = await WeatherObservation.aggregate([
    { $match: match },
    { $group: { _id: { $dateTrunc: { date: { $subtract: ['$observedAt', 1] }, unit: unitStr, timezone: 'Europe/Madrid' } }, mean: { $avg: '$value' }, min: { $min: '$value' }, max: { $max: '$value' }, sum: { $sum: '$value' }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  const round = (v) => (v === null ? null : Math.round(v * 10) / 10);
  res.json({
    station: s._id, variable, unit, period, resolution: unitStr === 'hour' ? 'hora' : 'día (Europe/Madrid)', from: start, to: end,
    points: rows.map(r => ({ t: r._id, mean: round(r.mean), min: round(r.min), max: round(r.max), sum: variable === 'precipitation' ? round(r.sum) : undefined, n: r.n })),
    attribution: attributionOf([s.network])
  });
}));

// ---------- Municipios ----------
router.get('/municipalities', handler(async (req, res) => {
  res.json({ total: MUNICIPIOS.length, municipalities: MUNICIPIOS.map(({ ine, name, slug, lat, lon }) => ({ id: ine, name, slug, lat, lon })) });
}, { needsDb: false }));

async function nearbyStations(m) {
  const stations = await WeatherStation.find({ status: { $ne: 'baja' } }).lean();
  return stations.map(s => ({ id: s._id, name: s.name, network: s.network, stationType: s.stationType, status: s.status, municipality: s.municipality, lat: s.lat, lon: s.lon, altitude: s.altitude, lastObservationAt: s.lastObservationAt, distanceKm: Math.round(distanceKm(m.lat, m.lon, s.lat, s.lon) * 10) / 10 }))
    .filter(s => s.distanceKm <= NEARBY_KM).sort((a, b) => a.distanceKm - b.distanceKm);
}

router.get('/municipalities/:id', handler(async (req, res) => {
  const m = findMunicipio(req.params.id);
  if (!m) return res.status(404).json({ error: 'Municipio no encontrado (INE o nombre de la provincia de Salamanca)' });
  const stations = dbReady() ? await nearbyStations(m) : [];
  res.json({ id: m.ine, name: m.name, slug: m.slug, lat: m.lat, lon: m.lon, nearbyStations: stations, nearbyRadiusKm: NEARBY_KM });
}, { needsDb: false }));

// Situación actual: observaciones de las estaciones cercanas (nunca se presentan como medidas en el pueblo)
// y, aparte, lo que dicen los modelos para la hora en curso
router.get('/municipalities/:id/current', handler(async (req, res) => {
  const m = findMunicipio(req.params.id);
  if (!m) return res.status(404).json({ error: 'Municipio no encontrado' });
  const stations = dbReady() ? await nearbyStations(m) : [];
  const latest = dbReady() ? await latestByStation(stations.map(s => s.id)) : {};
  const now = Date.now();
  const observed = stations.filter(s => latest[s.id]).map(s => ({
    ...s,
    variables: latest[s.id],
    recent: Boolean(s.lastObservationAt && now - new Date(s.lastObservationAt).getTime() < RECENT_MS)
  }));
  const { forecasts, stale } = await forecastFor(m);
  const modelNow = forecasts.map(f => {
    const i = f.times.findIndex(t => new Date(t).getTime() > now - 3600e3);
    if (i < 0) return null;
    const pick = (k) => f.series[k]?.[i] ?? null;
    return { model: f.model, label: openmeteo.MODELS[f.model]?.label, issuedAt: f.issuedAt, validAt: f.times[i], temperature: pick('temperature'), relative_humidity: pick('relative_humidity'), precipitation: pick('precipitation'), wind_speed: pick('wind_speed'), wind_direction: pick('wind_direction'), weather_code: pick('weather_code'), cloud_cover: pick('cloud_cover') };
  }).filter(Boolean);
  res.json({
    municipality: { id: m.ine, name: m.name, slug: m.slug },
    observations: observed,
    note: 'Las observaciones son de estaciones cercanas, no del propio municipio. La distancia va en cada estación.',
    forecastNow: modelNow,
    forecastStale: stale,
    attribution: attributionOf([...observed.map(s => s.network), 'openmeteo'])
  });
}, { needsDb: false }));

// Predicción: por horas (48 h) y por días (7) de cada modelo
router.get('/municipalities/:id/forecast', handler(async (req, res) => {
  const m = findMunicipio(req.params.id);
  if (!m) return res.status(404).json({ error: 'Municipio no encontrado' });
  const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 48));
  const { forecasts, stale, fetchedAt } = await forecastFor(m);
  const now = Date.now() - 3600e3;
  res.json({
    municipality: { id: m.ine, name: m.name, slug: m.slug, lat: m.lat, lon: m.lon },
    stale,
    fetchedAt,
    models: forecasts.map(f => {
      const start = Math.max(0, f.times.findIndex(t => new Date(t).getTime() > now));
      const slice = (arr) => (arr || []).slice(start, start + hours);
      return {
        model: f.model, ...openmeteo.MODELS[f.model], issuedAt: f.issuedAt, issuedAtKnown: f.issuedAtKnown, gridLat: f.lat, gridLon: f.lon,
        hourly: { time: slice(f.times), ...Object.fromEntries(Object.entries(f.series).map(([k, v]) => [k, slice(v)])) },
        daily: f.daily, units: f.units
      };
    }),
    attribution: attributionOf(['openmeteo'])
  });
}, { needsDb: false }));

// ---------- Modelos ----------
router.get('/models', handler(async (req, res) => {
  res.json({ provider: 'openmeteo', models: Object.entries(openmeteo.MODELS).map(([id, m]) => ({ id, ...m })), attribution: attributionOf(['openmeteo']) });
}, { needsDb: false }));

// Comparación de modelos para un municipio y un instante (por defecto, mañana a las 15:00 de Madrid)
router.get('/models/compare', handler(async (req, res) => {
  const m = findMunicipio(req.query.municipality || 'salamanca');
  if (!m) return res.status(404).json({ error: 'Municipio no encontrado' });
  let at = req.query.time ? new Date(String(req.query.time)) : null;
  if (req.query.time && Number.isNaN(at?.getTime())) return bad(res, 'time no válido (ISO 8601)');
  if (!at) {
    // Mañana a las 15:00 de Madrid, en UTC
    // Fecha de mañana en Madrid por partes ("en-CA" no da AAAA-MM-DD en todas las compilaciones de Node)
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(Date.now() + 86400e3)).map(x => [x.type, x.value]));
    const ymd = `${p.year}-${p.month}-${p.day}`;
    at = toUtc(`${ymd}T15:00`, { assume: 'Europe/Madrid' });
  }
  const { forecasts } = await forecastFor(m);
  const rows = forecasts.map(f => {
    let best = -1;
    let diff = Infinity;
    f.times.forEach((t, i) => { const d = Math.abs(new Date(t).getTime() - at.getTime()); if (d < diff) { diff = d; best = i; } });
    if (best < 0 || diff > 90 * 60000) return { model: f.model, label: openmeteo.MODELS[f.model]?.label, available: false, issuedAt: f.issuedAt };
    const v = (k) => f.series[k]?.[best] ?? null;
    return { model: f.model, label: openmeteo.MODELS[f.model]?.label, available: true, issuedAt: f.issuedAt, validAt: f.times[best], temperature: v('temperature'), precipitation: v('precipitation'), precipitation_probability: v('precipitation_probability'), wind_speed: v('wind_speed'), weather_code: v('weather_code') };
  });
  res.json({ municipality: { id: m.ine, name: m.name }, time: at, models: rows, attribution: attributionOf(['openmeteo']) });
}, { needsDb: false }));

module.exports = router;
