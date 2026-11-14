// Meteoclimatic: tabla pública (extracto real) y RSS (ejemplo de su documentación). Sin red.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mc = require('../../src/services/weather/providers/meteoclimatic');
const { SOURCES, can } = require('../../src/services/weather/sources');

const fixture = (f) => fs.readFileSync(path.join(__dirname, '../fixtures/weather', f), 'utf8');

test('números con millares y decimales españoles; "x" es ausente', () => {
  assert.equal(mc._test.num('1.017'), 1017);
  assert.equal(mc._test.num('13,8'), 13.8);
  assert.equal(mc._test.num('x'), null);
  assert.equal(mc._test.num(''), null);
  assert.equal(mc._test.num('0,0'), 0);
});

test('tabla: estaciones de Salamanca con sus valores; los "x" no se inventan', () => {
  const { stations, values } = mc._test.parseMapTable(fixture('meteoclimatic-mapinfo.html'));
  assert.deepEqual(stations.map(s => s.code), ['ESCYL3700000037120A', 'ESCYL3700000037789A', 'ESCYL3700000037260B']);
  const d = values.find(v => v.code === 'ESCYL3700000037120A');
  assert.equal(stations[0].name, 'Doñinos de Salamanca');
  assert.equal(stations[0].altitude, 825);
  assert.deepEqual(d.v, { t: 11.5, tmax: 13.8, tmin: 10.4, h: 82, b: 1017, w: 11, wdir: 270, wmax: 37, p: 5.5 });
  const cc = values.find(v => v.code === 'ESCYL3700000037789A');
  assert.equal(cc.v.h, null, 'Cuatro Calzadas no da humedad');
});

test('observaciones: unidades internas, máximas y lluvia desde la medianoche de Madrid, hora aproximada', () => {
  const at = new Date('2026-11-14T17:50:00Z');
  const obs = mc._test.toObservations('ESCYL3700000037120A', { t: 11.5, tmax: 13.8, tmin: 10.4, h: 82, b: 1017, w: 36, wdir: 270, wmax: 37, p: 5.5 }, at, { approximateTime: true });
  const by = Object.fromEntries(obs.map(o => [o.variable, o]));
  assert.equal(by.wind_speed.value, 10); // 36 km/h → 10 m/s
  assert.equal(by.wind_speed.unit, 'm/s');
  assert.equal(by.precipitation.aggregation, 'sum');
  assert.equal(by.precipitation.intervalStart.toISOString(), '2026-11-13T23:00:00.000Z'); // 00:00 de Madrid (CET)
  assert.equal(by.temperature_max.aggregation, 'max');
  assert.equal(by.pressure_msl.value, 1017);
  assert.ok(obs.every(o => o.approximateTime === true && o.source === 'meteoclimatic' && o.station === 'meteoclimatic:ESCYL3700000037120A'));
  const summer = mc._test.madridMidnight(new Date('2026-07-01T10:00:00Z'));
  assert.equal(summer.toISOString(), '2026-06-30T22:00:00.000Z'); // CEST
});

test('RSS: formato documentado, con la hora de publicación', () => {
  const rows = mc._test.parseFeed(fixture('meteoclimatic-rss-doc.xml'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, 'ESCAT0800000008226A');
  assert.equal(rows[0].name, 'Terrassa - Sant Pere');
  assert.equal(rows[0].at.toISOString(), '2026-11-14T17:48:00.000Z');
  assert.deepEqual(rows[0].v, { t: 13.9, tmax: 13.9, tmin: 10, h: 58, b: 1015.4, w: 13, wdir: null, wmax: 16, p: 0 });
});

test('derechos: apagado por defecto; nunca redistribuible', async () => {
  delete process.env.METEOCLIMATIC_ACCESO;
  assert.equal(mc.enabled(), false);
  assert.equal(can('meteoclimatic', 'display'), false);
  await assert.rejects(mc.fetchLatest(), (e) => e.code === 'NO_KEY');
  process.env.METEOCLIMATIC_ACCESO = 'mapa';
  assert.equal(can('meteoclimatic', 'display'), true);
  assert.equal(can('meteoclimatic', 'redistribute'), false);
  assert.equal(SOURCES.meteoclimatic.license, 'CC BY-NC-ND 3.0');
  delete process.env.METEOCLIMATIC_ACCESO;
});
