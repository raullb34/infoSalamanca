// Control de calidad de observaciones. No se borra nada: cada observación sale con
// quality = { status: 'ok' | 'sospechosa' | 'erronea', checks: [...] }.
//  Nivel 1 (estructura): estación, variable, fecha válida, valor numérico, unidad correcta.
//  Nivel 2 (meteorología): rangos plausibles, fechas futuras, duplicados en el mismo lote.
//  Nivel 3 (preparado, sin activar): comparación con vecinas, sensor bloqueado, anomalías, inactividad.
const { VARIABLES } = require('./normalize');

// Rangos plausibles en la provincia de Salamanca (con margen). Fuera de "posible" es error; fuera de
// "habitual" es sospechoso.
const RANGES = {
  temperature: { possible: [-35, 50], usual: [-20, 44] },
  temperature_max: { possible: [-35, 50], usual: [-20, 44] },
  temperature_min: { possible: [-35, 50], usual: [-20, 44] },
  relative_humidity: { possible: [1, 100], usual: [5, 100] }, // 0 % exacto es un sensor averiado (InfoRiego, nov. 2026)
  pressure: { possible: [800, 1100], usual: [870, 960] }, // estaciones entre ~600 y ~1700 m
  pressure_msl: { possible: [900, 1080], usual: [960, 1050] },
  wind_speed: { possible: [0, 75], usual: [0, 40] },
  wind_gust: { possible: [0, 90], usual: [0, 50] },
  wind_direction: { possible: [0, 360], usual: [0, 360] },
  precipitation: { possible: [0, 300], usual: [0, 60] }, // por intervalo
  solar_radiation: { possible: [0, 1500], usual: [0, 1200] },
  evapotranspiration: { possible: [0, 20], usual: [0, 12] }
};

const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

function checkOne(o, now = new Date()) {
  const checks = [];
  // Nivel 1
  if (!o.station) checks.push({ level: 1, code: 'sin-estacion' });
  if (!VARIABLES[o.variable]) checks.push({ level: 1, code: 'variable-desconocida' });
  if (!(o.observedAt instanceof Date) || Number.isNaN(o.observedAt.getTime())) checks.push({ level: 1, code: 'fecha-invalida' });
  if (o.value === null || o.value === undefined || !Number.isFinite(o.value)) checks.push({ level: 1, code: 'valor-no-numerico' });
  if (VARIABLES[o.variable] && o.unit !== VARIABLES[o.variable].unit) checks.push({ level: 1, code: 'unidad-incorrecta' });
  if (checks.length) return { status: 'erronea', checks };

  // Nivel 2
  const r = RANGES[o.variable];
  if (r) {
    if (o.value < r.possible[0] || o.value > r.possible[1]) checks.push({ level: 2, code: 'fuera-de-rango', severity: 'erronea' });
    else if (o.value < r.usual[0] || o.value > r.usual[1]) checks.push({ level: 2, code: 'valor-inusual', severity: 'sospechosa' });
  }
  if (o.observedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) checks.push({ level: 2, code: 'fecha-futura', severity: 'erronea' });

  const status = checks.some(c => c.severity === 'erronea') ? 'erronea' : checks.length ? 'sospechosa' : 'ok';
  return { status, checks };
}

// Valida un lote y marca los duplicados dentro de él (misma estación, variable, instante y agregación)
function validateBatch(observations, now = new Date()) {
  const seen = new Set();
  const out = [];
  let duplicates = 0;
  for (const o of observations) {
    const key = `${o.station}|${o.variable}|${o.observedAt?.toISOString?.()}|${o.aggregation}`;
    if (seen.has(key)) { duplicates++; continue; } // el repetido no se inserta; el primero se queda
    seen.add(key);
    out.push({ ...o, quality: checkOne(o, now) });
  }
  return { observations: out, duplicates };
}

// Nivel 3: ganchos preparados para versiones futuras (no hacen nada todavía)
const advancedChecks = {
  neighbours: null, // comparar con estaciones a < 25 km
  stuckSensor: null, // mismo valor durante muchas horas seguidas
  anomaly: null, // desviación respecto a la climatología de la estación
  inactive: null // estación sin datos > 48 h → status 'sin-datos-recientes' (lo hace store.refreshStationStatus)
};

module.exports = { RANGES, checkOne, validateBatch, advancedChecks };
