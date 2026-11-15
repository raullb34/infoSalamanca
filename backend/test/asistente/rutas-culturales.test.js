// Datos de las rutas culturales (frontend/src/data/rutasCulturales.json, generado por
// scripts/build-rutas-culturales.js): que cada parada sea un municipio de la provincia con coordenadas
// dentro de ella y que cada ruta tenga su color y su fuente.
const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const data = require(path.resolve(__dirname, '../../../frontend/src/data/rutasCulturales.json'))
const munis = require('../../src/data/municipios-salamanca.json').municipios

test('rutas culturales: municipios, coordenadas, colores y fuentes', () => {
  const ines = new Set(munis.map(m => String(m.ine)))
  assert.ok(data.rutas.length >= 6)
  assert.strictEqual(new Set(data.rutas.map(r => r.color)).size, data.rutas.length, 'un color por ruta')
  for (const r of data.rutas) {
    assert.match(r.fuente.url, /^https:\/\//, `${r.id}: fuente`)
    assert.ok(r.tramos.length >= 1, `${r.id}: tramos`)
    for (const t of r.tramos) {
      for (const p of t.paradas) {
        assert.ok(ines.has(String(p.ine)), `${r.id}: ${p.municipio} (${p.ine}) es municipio de Salamanca`)
        assert.ok(p.lat > 40.2 && p.lat < 41.3 && p.lon > -7.0 && p.lon < -5.0, `${r.id}: ${p.municipio} dentro de la provincia`)
      }
    }
  }
})

test('Ruta del Mudéjar: los 15 lugares de su mapa (16 templos: Alba de Tormes tiene dos)', () => {
  const m = data.rutas.find(r => r.id === 'mudejar')
  const stops = m.tramos[0].paradas
  assert.strictEqual(stops.length, 15)
  assert.strictEqual(stops[0].municipio, 'Alba de Tormes')
  assert.ok(stops.every(p => p.lugar), 'cada parada nombra su iglesia')
})
