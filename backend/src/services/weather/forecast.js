// Predicción por municipio bajo demanda: solo para los 362 municipios conocidos (no es un proxy abierto),
// con caché de 30 minutos en memoria y copia en Mongo (caduca a los 10 días). Si Open-Meteo falla, se
// sirve la última pasada guardada indicando su antigüedad.
const NodeCache = require('node-cache');
const mongoose = require('mongoose');
const openmeteo = require('./providers/openmeteo');
const store = require('./store');
const { WeatherForecast } = require('../../models/weather');
const MUNICIPIOS = require('../../data/municipios-salamanca.json').municipios;

const cache = new NodeCache({ stdTTL: 30 * 60, useClones: false });
const byIne = new Map(MUNICIPIOS.map(m => [m.ine, m]));
const bySlug = new Map(MUNICIPIOS.map(m => [m.slug, m]));

const dbReady = () => mongoose.connection.readyState === 1;

// "37274", "salamanca" o "37085_2" (pieza del mapa) → municipio
const findMunicipio = (id) => byIne.get(String(id || '').split('_')[0]) || bySlug.get(String(id || '').toLowerCase()) || null;

async function forecastFor(municipio) {
  const cached = cache.get(municipio.ine);
  if (cached) return cached;
  let forecasts;
  let stale = false;
  try {
    forecasts = await openmeteo.fetchForecast(municipio);
    if (dbReady()) await Promise.all(forecasts.map(f => store.saveForecast(f).catch(() => {}))); // sin Mongo también funciona
  } catch (err) {
    if (!dbReady()) throw err;
    // Última pasada guardada de cada modelo
    const saved = await WeatherForecast.aggregate([
      { $match: { point: municipio.ine } }, { $sort: { issuedAt: -1 } }, { $group: { _id: '$model', doc: { $first: '$$ROOT' } } }
    ]).catch(() => []);
    if (!saved.length) throw err;
    forecasts = saved.map(s => s.doc);
    stale = true;
  }
  const out = { municipio, forecasts, stale, fetchedAt: new Date() };
  cache.set(municipio.ine, out, stale ? 5 * 60 : undefined);
  return out;
}

module.exports = { MUNICIPIOS, findMunicipio, forecastFor };
