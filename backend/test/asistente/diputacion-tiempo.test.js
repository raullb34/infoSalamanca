// Agenda cultural de la Diputación (La Salina) y detección de preguntas del tiempo en el asistente.
// Sin red: los HTML son extractos reales guardados en test/fixtures/diputacion.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { _test: dip } = require('../../src/services/diputacionAgenda')
const { isWeather, detectIntents } = require('../../src/services/rag/liveData')

const fixture = (f) => fs.readFileSync(path.join(__dirname, '../fixtures/diputacion', f), 'utf8')

test('listado de La Salina: id, título, pueblo y lugar de cada actividad', () => {
  const items = dip.parseList(fixture('listado.html'))
  assert.strictEqual(items.length, 10)
  const first = items[0]
  assert.strictEqual(first.id, '149204')
  assert.strictEqual(first.titulo, 'Teatro para todos los públicos')
  assert.strictEqual(first.anteTitulo, 'Biblioescena 2026')
  assert.strictEqual(first.municipio, 'Salamanca')
  assert.strictEqual(first.lugar, 'Casa de las Conchas')
  assert.ok(first.imagen.startsWith('http'))
  assert.strictEqual(new Set(items.map(i => i.id)).size, items.length)
})

test('ficha de La Salina: fechas completas, hora y descripción', () => {
  const d = dip.parseDetail(fixture('detalle-149204.html'))
  assert.strictEqual(d.inicio, '2026-09-22')
  assert.strictEqual(d.fin, '2026-12-18')
  assert.strictEqual(d.hora, '18:00')
  assert.match(d.descripcion, /Rockanroleando/)
})

test('evento con la forma de la agenda de la Junta y el municipio por su código INE', () => {
  const [item] = dip.parseList(fixture('listado.html'))
  const e = dip.toEvent(item, dip.parseDetail(fixture('detalle-149204.html')))
  assert.strictEqual(e.titulo, 'Biblioescena 2026: Teatro para todos los públicos')
  assert.strictEqual(e.cod_ine, '37274')
  assert.strictEqual(e.fecha_inicio, '2026-09-22')
  assert.strictEqual(e.hora_inicio, '18:00 h')
  assert.strictEqual(e.categoria, 'Espectáculos')
  assert.strictEqual(e.source, 'diputacion')
})

test('una línea de créditos no se pega al título: va a la descripción', () => {
  const e = dip.toEvent({ id: '1', titulo: 'Juan, el espíritu del amor', anteTitulo: 'Escrita y dirigida por Denis Rafter', clase: 'evento escenaTeatro', municipio: 'Villaflores' },
    { inicio: '2026-11-15', descripcion: 'El montaje teatral…' })
  assert.strictEqual(e.titulo, 'Juan, el espíritu del amor')
  assert.match(e.descripcion, /^Escrita y dirigida por Denis Rafter\. El montaje/)
})

test('"el tiempo" es el meteorológico salvo en los giros de siempre', () => {
  const si = ['¿Qué tiempo hace en Béjar?', '¿Va a llover mañana?', '¿hará frío en la sierra?', '¿qué tal el tiempo?', '¿hará sol el domingo?', '¿necesito paraguas en Alba?']
  const no = ['¿cuánto tiempo se tarda en ver la catedral?', 'tengo tiempo libre en Alba', 'hace mucho tiempo que no voy', 'la línea del tiempo de la provincia',
    'en tiempos de los romanos', '¿llego a tiempo al concierto?', 'puesta de sol en los Arribes', 'fiestas de Béjar']
  for (const q of si) assert.ok(isWeather(q), q)
  for (const q of no) assert.ok(!isWeather(q), q)
})

test('con una pregunta del tiempo, la agenda solo si se pide expresamente', () => {
  assert.deepStrictEqual(detectIntents('¿Va a llover el fin de semana?'), ['tiempo'])
  assert.deepStrictEqual(detectIntents('¿Qué hacer el fin de semana?'), ['teatro'])
  assert.deepStrictEqual(detectIntents('¿Hay teatro si llueve el sábado?'), ['tiempo', 'teatro'])
})
