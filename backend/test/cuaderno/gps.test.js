// «Estoy aquí» (frontend/src/utils/sigpac.js, candidatosEn) con los recintos reales de Aldeaseca de la Frontera:
// dentro y lejos del borde → recinto seguro; en la linde entre dos → candidatos, sin asignar ninguno; posición
// imprecisa → candidatos; fuera de todo recinto → ninguno.
const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const { pathToFileURL } = require('url')

const data = require('../../../frontend/public/data/sigpac/37022.json')
const load = () => import(pathToFileURL(path.resolve(__dirname, '../../../frontend/src/utils/sigpac.js')).href)
const key = (f) => `${f.properties.pol}/${f.properties.par}/${f.properties.rec}`

test('dentro de un recinto y lejos del borde, con buena precisión: ese recinto, seguro', async () => {
  const { candidatosEn } = await load()
  const r = candidatosEn(data.features, [-5.227908, 40.934001], 8)
  assert.strictEqual(r.seguro, true)
  assert.strictEqual(key(r.candidatos[0].feature), '501/293/1')
})

test('en la linde entre dos recintos: los dos como candidatos y ninguno seguro', async () => {
  const { candidatosEn, pointInGeometry } = await load()
  const f = data.features.find(x => key(x) === '501/293/1')
  const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]
  // Un vértice compartido con otro recinto: está en la linde
  let hit = null
  for (const p of ring) {
    const vecinos = data.features.filter(x => x !== f && distanceOk(x, p))
    if (vecinos.length) { hit = p; break }
  }
  function distanceOk (x, p) { return JSON.stringify(x.geometry.coordinates).includes(`[${p[0]},${p[1]}]`) }
  assert.ok(hit, 'hay un vértice compartido')
  const r = candidatosEn(data.features, hit, 5)
  assert.strictEqual(r.seguro, false)
  assert.ok(r.candidatos.length >= 2, `candidatos: ${r.candidatos.map(c => key(c.feature)).join(', ')}`)
  assert.ok(r.candidatos.some(c => key(c.feature) === '501/293/1'))
  assert.strictEqual(typeof pointInGeometry, 'function')
})

test('posición imprecisa (el círculo de precisión pasa del borde): no se da por segura', async () => {
  const { candidatosEn, distanceToEdge } = await load()
  const pt = [-5.227908, 40.934001]
  const f = data.features.find(x => key(x) === '501/293/1')
  const borde = distanceToEdge(pt, f.geometry)
  // Con una precisión menor que la distancia al borde es seguro; si la supera, ya no
  assert.strictEqual(candidatosEn(data.features, pt, borde - 10).seguro, true)
  const r = candidatosEn(data.features, pt, borde + 20)
  assert.strictEqual(r.seguro, false)
  assert.ok(r.candidatos.length >= 2, 'entran también los vecinos dentro del círculo')
})

test('lejos de todo recinto del municipio: ningún candidato', async () => {
  const { candidatosEn } = await load()
  const r = candidatosEn(data.features, [-5.6640, 40.9650], 10) // Salamanca capital
  assert.strictEqual(r.candidatos.length, 0)
  assert.strictEqual(r.seguro, false)
})
