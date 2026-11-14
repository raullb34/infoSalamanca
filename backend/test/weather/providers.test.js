// Conectores con respuestas guardadas (sin red). InfoRiego y Open-Meteo: extractos de respuestas reales
// (14/11/2026). AEMET: ejemplo construido según su documentación (ver _nota del fichero).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const inforiego = require('../../src/services/weather/providers/inforiego');
const aemet = require('../../src/services/weather/providers/aemet');
const openmeteo = require('../../src/services/weather/providers/openmeteo');
const { readZip } = require('../../src/services/weather/zip');

const fixture = (f) => fs.readFileSync(path.join(__dirname, '../fixtures/weather', f));

test('InfoRiego: catálogo solo de Salamanca, coordenadas decimales', () => {
  const st = inforiego._test.parseStations(fixture('inforiego-estaciones.csv').toString('latin1'));
  assert.deepEqual(st.map(s => s._id).sort(), ['inforiego:SA01', 'inforiego:SA03', 'inforiego:SA101', 'inforiego:SA102']);
  const cr = st.find(s => s.externalId === 'SA01');
  assert.equal(cr.name, 'Ciudad Rodrigo');
  assert.equal(cr.lat, 40.591111);
  assert.equal(cr.lon, -6.537222);
  assert.equal(cr.altitude, 635);
});

test('InfoRiego: semihorario en UTC, medias y sumas, ausentes fuera, solo Salamanca', () => {
  const obs = inforiego._test.parseObservations(fixture('inforiego-horario-20261113.csv').toString('latin1'));
  assert.ok(obs.every(o => o.station === 'inforiego:SA01'), 'no entran estaciones de Ávila');
  const t = obs.filter(o => o.variable === 'temperature');
  assert.equal(t.length, 6);
  assert.equal(t[0].observedAt.toISOString(), '2026-11-13T00:30:00.000Z');
  assert.equal(t[0].intervalStart.toISOString(), '2026-11-13T00:00:00.000Z');
  assert.equal(t[0].aggregation, 'mean');
  assert.equal(t[0].value, 11.8);
  const p = obs.filter(o => o.variable === 'precipitation');
  assert.equal(p.length, 5, 'la precipitación vacía de las 01:00 no se convierte en 0');
  assert.ok(p.every(o => o.aggregation === 'sum' && o.unit === 'mm'));
  assert.ok(!p.some(o => o.observedAt.toISOString() === '2026-11-13T01:00:00.000Z'));
});

test('ZIP: lee ficheros "deflate" (como los de InfoRiego)', () => {
  // ZIP mínimo de un fichero, montado a mano
  const name = Buffer.from('a.csv');
  const data = Buffer.from('hola;mundo\n'.repeat(20));
  const comp = zlib.deflateRawSync(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = 30 + name.length + comp.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(cdOffset, 16);
  const zip = Buffer.concat([local, name, comp, central, name, end]);
  const files = readZip(zip);
  assert.equal(files[0].name, 'a.csv');
  assert.equal(files[0].data.toString(), data.toString());
  assert.throws(() => readZip(Buffer.from('no soy un zip'.repeat(3))), /ZIP/);
});

test('AEMET: inventario de la provincia y campos de observación', () => {
  const ex = JSON.parse(fixture('aemet-ejemplo.json'));
  const st = aemet._test.parseInventory(ex.inventario);
  assert.equal(st.length, 1);
  assert.equal(st[0]._id, 'aemet:2867');
  assert.equal(st[0].lat, 40.959444);
  assert.equal(st[0].lon, -5.5025);
  const obs = aemet._test.parseObservations(ex.observacion, ['2867']);
  assert.ok(obs.every(o => o.station === 'aemet:2867'));
  const at12 = obs.filter(o => o.observedAt.toISOString() === '2026-11-14T12:00:00.000Z');
  assert.equal(at12.length, 10);
  assert.equal(at12.find(o => o.variable === 'wind_gust').aggregation, 'max');
  assert.equal(at12.find(o => o.variable === 'precipitation').intervalStart.toISOString(), '2026-11-14T11:00:00.000Z');
  const at13 = obs.filter(o => o.observedAt.toISOString() === '2026-11-14T13:00:00.000Z');
  assert.ok(!at13.some(o => o.variable === 'precipitation'), 'prec null no se guarda');
  assert.ok(!at13.some(o => o.variable === 'temperature_max'), 'un campo que no viene no se inventa');
});

test('AEMET: sin clave no hace peticiones', async () => {
  const prev = process.env.AEMET_API_KEY;
  delete process.env.AEMET_API_KEY;
  assert.equal(aemet.enabled(), false);
  await assert.rejects(aemet.fetchLatest([]), (e) => e.code === 'NO_KEY');
  if (prev) process.env.AEMET_API_KEY = prev;
});

test('Open-Meteo: un pronóstico por modelo, emisión distinta de las horas previstas', () => {
  const json = JSON.parse(fixture('openmeteo-salamanca.json'));
  const issued = { ecmwf_ifs025: new Date('2026-11-14T06:00:00Z'), gfs_global: new Date('2026-11-14T06:00:00Z') };
  const retrievedAt = new Date('2026-11-14T18:00:00Z');
  const fs3 = openmeteo._test.parse(json, { point: { ine: '37274' }, issued, retrievedAt });
  assert.deepEqual(fs3.map(f => f.model).sort(), ['ecmwf_ifs025', 'gfs_global', 'icon_eu']);
  const ec = fs3.find(f => f.model === 'ecmwf_ifs025');
  assert.equal(ec.issuedAt.toISOString(), '2026-11-14T06:00:00.000Z');
  assert.equal(ec.issuedAtKnown, true);
  assert.notEqual(ec.times[0].getTime(), ec.issuedAt.getTime());
  assert.equal(ec.times.length, ec.series.temperature.length);
  const icon = fs3.find(f => f.model === 'icon_eu');
  assert.equal(icon.issuedAtKnown, false, 'sin metadato: se marca como no conocida');
  assert.equal(icon.issuedAt.getTime(), retrievedAt.getTime());
  assert.ok(icon.times.length < ec.times.length, 'ICON-EU llega a menos días: se recortan las horas sin datos');
  assert.ok(icon.series.temperature.every(v => v !== null));
});
