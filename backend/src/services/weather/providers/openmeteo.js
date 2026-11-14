// Conector de predicción Open-Meteo (https://open-meteo.com/en/docs). Sin clave; API gratuita solo para uso
// no comercial (< 10 000 llamadas/día), datos CC BY 4.0 con enlace "Weather data by Open-Meteo.com".
// Una petición por punto trae los tres modelos a la vez (columnas con sufijo _<modelo>).
// La hora de emisión de cada modelo sale de su metadato `last_run_initialisation_time`
// (https://api.open-meteo.com/data/<id>/static/meta.json): así se distingue cuándo se generó la predicción
// (issuedAt) de para cuándo es (times[]).
const axios = require('axios');

const API = 'https://api.open-meteo.com/v1/forecast';
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)';

const MODELS = {
  ecmwf_ifs025: { label: 'ECMWF IFS', centre: 'ECMWF (Centro Europeo)', resolution: '0,25° (~25 km)', meta: 'ecmwf_ifs025', days: 7 },
  icon_eu: { label: 'ICON-EU', centre: 'DWD (Servicio Meteorológico Alemán)', resolution: '~7 km', meta: 'dwd_icon_eu', days: 5 },
  gfs_global: { label: 'GFS', centre: 'NOAA (EE. UU.)', resolution: '0,25° (~25 km)', meta: 'ncep_gfs025', days: 7 }
};

// Variable de Open-Meteo → nombre común (las unidades se piden ya en las internas: °C, %, mm, m/s)
const HOURLY = {
  temperature_2m: 'temperature',
  relative_humidity_2m: 'relative_humidity',
  precipitation: 'precipitation',
  precipitation_probability: 'precipitation_probability',
  wind_speed_10m: 'wind_speed',
  wind_direction_10m: 'wind_direction',
  cloud_cover: 'cloud_cover',
  weather_code: 'weather_code'
};
const DAILY = {
  temperature_2m_max: 'temperature_max',
  temperature_2m_min: 'temperature_min',
  precipitation_sum: 'precipitation_sum',
  precipitation_probability_max: 'precipitation_probability_max',
  wind_speed_10m_max: 'wind_speed_max',
  weather_code: 'weather_code'
};
const UNITS = { temperature: '°C', relative_humidity: '%', precipitation: 'mm', precipitation_probability: '%', wind_speed: 'm/s', wind_direction: '°', cloud_cover: '%', weather_code: 'WMO' };

const get = (url, params) => axios.get(url, { params, timeout: 30000, headers: { 'User-Agent': UA } }).then(r => r.data);

// Hora de inicialización de la última pasada de cada modelo (caché de 20 minutos)
let metaCache = { at: 0, data: {} };
async function runTimes() {
  if (Date.now() - metaCache.at < 20 * 60 * 1000) return metaCache.data;
  const data = {};
  await Promise.all(Object.entries(MODELS).map(async ([id, m]) => {
    try {
      const meta = await get(`https://api.open-meteo.com/data/${m.meta}/static/meta.json`);
      if (meta.last_run_initialisation_time) data[id] = new Date(meta.last_run_initialisation_time * 1000);
    } catch { /* sin metadato: issuedAt será la hora de consulta, marcada como no conocida */ }
  }));
  metaCache = { at: Date.now(), data };
  return data;
}

// Respuesta de la API → una predicción por modelo (modelo común de §5.3)
function parse(json, { point, issued = {}, retrievedAt = new Date() }) {
  const out = [];
  const hours = (json.hourly?.time || []).map(t => new Date(t * 1000));
  const days = (json.daily?.time || []).map(t => new Date(t * 1000));
  for (const model of Object.keys(MODELS)) {
    const series = {};
    for (const [src, name] of Object.entries(HOURLY)) {
      const arr = json.hourly?.[`${src}_${model}`];
      if (Array.isArray(arr)) series[name] = arr.map(v => (v === null || v === undefined ? null : v));
    }
    // Recorta las horas finales sin datos (cada modelo llega hasta donde llega)
    let last = hours.length - 1;
    while (last >= 0 && series.temperature?.[last] === null) last--;
    if (last < 0) continue;
    for (const k of Object.keys(series)) series[k] = series[k].slice(0, last + 1);
    const daily = { time: days };
    for (const [src, name] of Object.entries(DAILY)) {
      const arr = json.daily?.[`${src}_${model}`];
      if (Array.isArray(arr)) daily[name] = arr;
    }
    out.push({
      point: point.ine,
      lat: json.latitude,
      lon: json.longitude,
      model,
      provider: 'openmeteo',
      issuedAt: issued[model] || retrievedAt,
      issuedAtKnown: Boolean(issued[model]),
      retrievedAt,
      times: hours.slice(0, last + 1),
      series,
      daily,
      units: UNITS
    });
  }
  return out;
}

// Predicción de un municipio ({ ine, lat, lon }) con los tres modelos
async function fetchForecast(point) {
  const [json, issued] = await Promise.all([
    get(API, {
      latitude: point.lat,
      longitude: point.lon,
      hourly: Object.keys(HOURLY).join(','),
      daily: Object.keys(DAILY).join(','),
      models: Object.keys(MODELS).join(','),
      forecast_days: 7,
      wind_speed_unit: 'ms',
      timezone: 'Europe/Madrid', // los días se cortan a medianoche de aquí
      timeformat: 'unixtime' // y las horas llegan como instantes UTC
    }),
    runTimes()
  ]);
  if (json.error) throw new Error(`Open-Meteo: ${json.reason}`);
  return parse(json, { point, issued });
}

module.exports = { id: 'openmeteo', capabilities: ['forecast'], MODELS, fetchForecast, _test: { parse, HOURLY, DAILY } };
