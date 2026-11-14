// Modelo común de observación y conversiones de unidades y fechas.
// Todo se guarda en UTC y en las unidades internas de VARIABLES. Un valor ausente es null, nunca 0.

const VARIABLES = {
  temperature: { unit: '°C', label: 'Temperatura' },
  temperature_max: { unit: '°C', label: 'Temperatura máxima' },
  temperature_min: { unit: '°C', label: 'Temperatura mínima' },
  relative_humidity: { unit: '%', label: 'Humedad relativa' },
  pressure: { unit: 'hPa', label: 'Presión en la estación' },
  pressure_msl: { unit: 'hPa', label: 'Presión a nivel del mar' },
  wind_speed: { unit: 'm/s', label: 'Velocidad del viento' },
  wind_gust: { unit: 'm/s', label: 'Racha máxima' },
  wind_direction: { unit: '°', label: 'Dirección del viento' },
  precipitation: { unit: 'mm', label: 'Precipitación' },
  solar_radiation: { unit: 'W/m²', label: 'Radiación solar' },
  evapotranspiration: { unit: 'mm', label: 'Evapotranspiración' }
};
const AGGREGATIONS = ['instant', 'mean', 'sum', 'max', 'min'];

// Conversiones a la unidad interna
const CONVERT = {
  'km/h': (v) => v / 3.6,
  'm/s': (v) => v,
  'kt': (v) => v * 0.514444,
  '°F': (v) => (v - 32) * 5 / 9,
  '°C': (v) => v,
  'K': (v) => v - 273.15,
  'Pa': (v) => v / 100,
  'kPa': (v) => v * 10,
  'hPa': (v) => v,
  'mm': (v) => v,
  'in': (v) => v * 25.4,
  '%': (v) => v,
  '°': (v) => v,
  'W/m²': (v) => v,
  'MJ/m²/h': (v) => v * 1e6 / 3600 // radiación acumulada en una hora → media en W/m²
};

// "12,5", "12.5", 12.5 → 12.5; "", null, "-", "Ip" (inapreciable) → null
function toNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(',', '.');
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function convert(value, fromUnit) {
  if (value === null) return null;
  const fn = CONVERT[fromUnit];
  if (!fn) throw new Error(`Unidad no soportada: ${fromUnit}`);
  return Math.round(fn(value) * 1000) / 1000;
}

// Fecha → Date UTC. Las cadenas sin zona se interpretan en la zona indicada (por defecto UTC)
function toUtc(raw, { assume = 'UTC' } = {}) {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim();
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
  if (hasZone) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return null;
  const utcMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  if (assume === 'UTC') return new Date(utcMs);
  if (assume === 'Europe/Madrid') return new Date(utcMs - madridOffsetMinutes(new Date(utcMs)) * 60000);
  throw new Error(`Zona no soportada: ${assume}`);
}

// Desfase de Europe/Madrid (minutos) para un instante: +60 en invierno, +120 en verano
function madridOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(date).reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// Observación común. `intervalMinutes`: duración del intervalo que acaba en observedAt (0 si es instantánea)
function observation({ station, variable, value, unit, aggregation = 'instant', observedAt, intervalMinutes = 0, source }) {
  if (!VARIABLES[variable]) throw new Error(`Variable desconocida: ${variable}`);
  if (!AGGREGATIONS.includes(aggregation)) throw new Error(`Agregación desconocida: ${aggregation}`);
  const v = convert(toNumber(value), unit);
  const end = observedAt instanceof Date ? observedAt : toUtc(observedAt);
  return {
    station,
    variable,
    value: v,
    unit: VARIABLES[variable].unit,
    aggregation,
    observedAt: end,
    intervalStart: end && intervalMinutes ? new Date(end.getTime() - intervalMinutes * 60000) : end,
    intervalEnd: end,
    source
  };
}

// Distancia en km entre dos puntos (haversine)
function distanceKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// "063214000W" (grados, minutos, segundos con 3 decimales y hemisferio) → -6.5372
function dmsToDecimal(raw) {
  const m = /^(\d{2,3})(\d{2})(\d{2})(\d{3})([NSEW])$/.exec(String(raw || '').trim());
  if (!m) return null;
  const deg = Number(m[1]) + Number(m[2]) / 60 + Number(`${m[3]}.${m[4]}`) / 3600;
  return Math.round((/[SW]/.test(m[5]) ? -deg : deg) * 1e6) / 1e6;
}

const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

module.exports = { VARIABLES, AGGREGATIONS, toNumber, convert, toUtc, madridOffsetMinutes, observation, distanceKm, dmsToDecimal, slugify };
