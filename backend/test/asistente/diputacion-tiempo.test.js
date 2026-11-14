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

test('la ficha da las coordenadas del lugar ("Ver mapa")', () => {
  const d = dip.parseDetail(fixture('detalle-149204.html'))
  assert.strictEqual(d.lat, 40.962886)
  assert.strictEqual(d.lon, -5.665831)
})

test('proyecciones de La Salina → un "cine" por lugar, con la forma de la cartelera', () => {
  const { _test: cines } = require('../../src/services/cinesService')
  const d = new Date(Date.now() + 3 * 86400e3)
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const base = { cod_ine: '37274', municipio: 'Salamanca', lugar_celebracion: 'Teatro Juan del Enzina', latitud: 40.96, longitud: -5.66, organiza: 'Filmoteca de Castilla y León' }
  const venues = cines.screeningVenues([
    { ...base, titulo: 'Ellas en la ciudad', fecha_inicio: day, fecha_fin: null, hora_inicio: '19:30 h', precio: 'Entrada libre', imagen_evento: 'http://www.lasalina.es/a.jpg', enlace_contenido: 'https://x/1' },
    { ...base, titulo: 'Atlas oculto', fecha_inicio: day, fecha_fin: null, hora_inicio: '21:00 h', precio: null, imagen_evento: null, enlace_contenido: 'https://x/2' },
    { ...base, titulo: 'Ciclo de un mes sin horario fijo', fecha_inicio: day, fecha_fin: '2099-01-01', hora_inicio: '19:00 h' }
  ])
  assert.strictEqual(venues.length, 1)
  const v = venues[0]
  assert.strictEqual(v.tipo, 'proyecciones')
  assert.strictEqual(v.nombre, 'Teatro Juan del Enzina')
  assert.strictEqual(v.peliculas.length, 2) // el ciclo de varios días no se convierte en sesiones inventadas
  assert.deepStrictEqual(v.peliculas[0].sesiones, [{ inicio: `${day}T19:30`, version: null, entradas: null }])
  assert.strictEqual(v.peliculas[0].precio, 'Entrada libre')
  assert.ok(v.peliculas[0].cartel.startsWith('https://'))
})
