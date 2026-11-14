// API /api/v1/weather sin red ni base de datos: Open-Meteo se sustituye por la respuesta guardada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const express = require('express');
const openmeteo = require('../../src/services/weather/providers/openmeteo');

const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/weather/openmeteo-salamanca.json'), 'utf8'));
let calls = 0;
openmeteo.fetchForecast = async (point) => { calls++; return openmeteo._test.parse(json, { point, issued: { ecmwf_ifs025: new Date('2026-11-14T06:00:00Z') } }); };

const app = express();
app.use('/api/v1/weather', require('../../src/routes/weather'));
// Servidor en un puerto libre; unref() para que el proceso termine al acabar las pruebas
const ready = new Promise(r => { const server = app.listen(0, () => { server.unref(); r(`http://127.0.0.1:${server.address().port}/api/v1/weather`); }); });
const get = async (p) => { const r = await fetch((await ready) + p); return { status: r.status, body: await r.json() }; };

test('municipios: los 362 con slug', async () => {
  const { status, body } = await get('/municipalities');
  assert.equal(status, 200);
  assert.equal(body.total, 362);
  assert.ok(body.municipalities.some(m => m.slug === 'penaranda-de-bracamonte'));
});

test('municipio por INE o por nombre; 404 si no es de Salamanca', async () => {
  assert.equal((await get('/municipalities/37046')).body.name, 'Béjar');
  assert.equal((await get('/municipalities/bejar')).body.id, '37046');
  assert.equal((await get('/municipalities/37046_2')).body.id, '37046');
  assert.equal((await get('/municipalities/madrid')).status, 404);
});

test('predicción: modelos con hora de emisión y horas previstas separadas, y atribución', async () => {
  const { status, body } = await get('/municipalities/salamanca/forecast?hours=6');
  assert.equal(status, 200);
  assert.equal(body.models.length, 3);
  const ec = body.models.find(m => m.model === 'ecmwf_ifs025');
  assert.equal(ec.issuedAt, '2026-11-14T06:00:00.000Z');
  assert.ok(ec.hourly.time.length <= 6);
  assert.equal(ec.hourly.time.length, ec.hourly.temperature.length);
  assert.equal(body.attribution[0].attribution, 'Weather data by Open-Meteo.com');
});

test('la predicción se cachea: no se repite la petición al proveedor', async () => {
  const before = calls;
  await get('/municipalities/salamanca/forecast');
  await get('/municipalities/37274/current');
  assert.equal(calls, before);
});

test('comparador: un valor por modelo para un instante', async () => {
  const t = new Date(json.hourly.time[30] * 1000).toISOString();
  const { status, body } = await get(`/models/compare?municipality=salamanca&time=${encodeURIComponent(t)}`);
  assert.equal(status, 200);
  const ec = body.models.find(m => m.model === 'ecmwf_ifs025');
  assert.equal(ec.available, true);
  assert.equal(ec.validAt, t);
  assert.equal(ec.temperature, json.hourly.temperature_2m_ecmwf_ifs025[30]);
  assert.equal((await get('/models/compare?time=ayer')).status, 400);
});

test('parámetros no válidos y sin base de datos', async () => {
  assert.equal((await get('/stations/<script>/latest')).status, 400);
  assert.equal((await get('/stations')).status, 503); // sin Mongo responde 503, no se cuelga
});

test('fuentes: derechos de uso por proveedor', async () => {
  const { body } = await get('/sources');
  const mc = body.sources.find(s => s.id === 'meteoclimatic');
  assert.equal(mc.rights.redistribute, false);
  assert.equal(body.sources.find(s => s.id === 'inforiego').license, 'ODbL 1.0');
});
