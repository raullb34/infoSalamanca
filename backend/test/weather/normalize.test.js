// node --test test/weather
const test = require('node:test');
const assert = require('node:assert/strict');
const { toNumber, convert, toUtc, observation, dmsToDecimal, distanceKm, slugify } = require('../../src/services/weather/normalize');
const { checkOne, validateBatch } = require('../../src/services/weather/validate');

test('toNumber: comas, vacíos y textos no numéricos', () => {
  assert.equal(toNumber('12,5'), 12.5);
  assert.equal(toNumber(' -3.2 '), -3.2);
  assert.equal(toNumber(0), 0); // un cero es un cero
  assert.equal(toNumber(''), null);
  assert.equal(toNumber(null), null);
  assert.equal(toNumber('Ip'), null); // "inapreciable" no es un número
  assert.equal(toNumber(NaN), null);
});

test('convert: unidades a las internas', () => {
  assert.equal(convert(36, 'km/h'), 10);
  assert.equal(convert(1013, 'hPa'), 1013);
  assert.equal(convert(101300, 'Pa'), 1013);
  assert.equal(convert(32, '°F'), 0);
  assert.equal(convert(null, 'km/h'), null);
  assert.throws(() => convert(1, 'parsecs'), /no soportada/);
});

test('toUtc: zonas explícitas, UTC por defecto y hora de Madrid en invierno y verano', () => {
  assert.equal(toUtc('2026-11-14T12:00:00Z').toISOString(), '2026-11-14T12:00:00.000Z');
  assert.equal(toUtc('2026-11-14T12:00:00+0100').toISOString(), '2026-11-14T11:00:00.000Z');
  assert.equal(toUtc('2026-11-14T12:00').toISOString(), '2026-11-14T12:00:00.000Z');
  assert.equal(toUtc('2026-11-14T15:00', { assume: 'Europe/Madrid' }).toISOString(), '2026-11-14T14:00:00.000Z'); // CET
  assert.equal(toUtc('2026-07-14T15:00', { assume: 'Europe/Madrid' }).toISOString(), '2026-07-14T13:00:00.000Z'); // CEST
  assert.equal(toUtc('mañana'), null);
});

test('observation: unidad interna, intervalo e instante final', () => {
  const o = observation({ station: 'x:1', variable: 'wind_speed', value: '18', unit: 'km/h', aggregation: 'mean', observedAt: '2026-11-14T12:00:00Z', intervalMinutes: 30, source: 'inforiego' });
  assert.equal(o.value, 5);
  assert.equal(o.unit, 'm/s');
  assert.equal(o.intervalStart.toISOString(), '2026-11-14T11:30:00.000Z');
  assert.equal(o.intervalEnd.toISOString(), '2026-11-14T12:00:00.000Z');
  assert.throws(() => observation({ station: 'x', variable: 'nieve', value: 1, unit: 'mm', observedAt: '2026-01-01T00:00Z' }), /desconocida/);
});

test('dmsToDecimal y distancias', () => {
  assert.equal(dmsToDecimal('063214000W'), -6.537222);
  assert.equal(dmsToDecimal('403528000N'), 40.591111);
  assert.equal(dmsToDecimal('basura'), null);
  const d = distanceKm(40.967368, -5.665381, 40.387034, -5.767484); // Salamanca–Béjar
  assert.ok(d > 63 && d < 66, `distancia ${d}`);
  assert.equal(slugify('Peñaranda de Bracamonte'), 'penaranda-de-bracamonte');
});

test('validación: rangos, futuro, estructura', () => {
  const base = { station: 's', variable: 'temperature', unit: '°C', aggregation: 'instant', observedAt: new Date('2026-11-14T12:00Z') };
  const now = new Date('2026-11-14T13:00Z');
  assert.equal(checkOne({ ...base, value: 12 }, now).status, 'ok');
  assert.equal(checkOne({ ...base, value: 46 }, now).status, 'sospechosa');
  assert.equal(checkOne({ ...base, value: 80 }, now).status, 'erronea');
  assert.equal(checkOne({ ...base, variable: 'relative_humidity', unit: '%', value: 104 }, now).status, 'erronea');
  assert.equal(checkOne({ ...base, variable: 'relative_humidity', unit: '%', value: 0 }, now).status, 'erronea'); // sensor averiado
  assert.equal(checkOne({ ...base, variable: 'precipitation', unit: 'mm', value: -1 }, now).status, 'erronea');
  assert.equal(checkOne({ ...base, value: 10, observedAt: new Date('2026-11-14T15:00Z') }, now).status, 'erronea'); // futura
  assert.equal(checkOne({ ...base, value: 10, unit: '°F' }, now).checks[0].code, 'unidad-incorrecta');
  assert.equal(checkOne({ ...base, value: null }, now).checks[0].code, 'valor-no-numerico');
});

test('validación: duplicados en el mismo lote no se repiten', () => {
  const o = { station: 's', variable: 'temperature', unit: '°C', aggregation: 'mean', value: 10, observedAt: new Date('2026-11-14T12:00Z') };
  const { observations, duplicates } = validateBatch([o, { ...o }, { ...o, aggregation: 'max' }], new Date('2026-11-15T00:00Z'));
  assert.equal(observations.length, 2);
  assert.equal(duplicates, 1);
});
