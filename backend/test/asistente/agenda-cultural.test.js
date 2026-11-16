// Agenda cultural (services/agendaCultural.js): reparto en espectáculos, exposiciones y actividades, la marca
// de "para niños" y las sesiones de un mismo ciclo de la Junta. Sin red.
const test = require('node:test')
const assert = require('node:assert')
const { _test: ag } = require('../../src/services/agendaCultural')
const { _test: dip } = require('../../src/services/diputacionAgenda')
const { mergeEvents } = require('../../src/helpers/eventDedupe')

test('grupos: los conciertos de la Junta son espectáculos; charlas, lectura y festivales, actividades; el cine, fuera', () => {
  assert.strictEqual(ag.kindOf({ categoria: 'Conciertos' }), 'espectaculos')
  assert.strictEqual(ag.kindOf({ categoria: 'Música' }), 'espectaculos')
  assert.strictEqual(ag.kindOf({ categoria: 'Espectáculos' }), 'espectaculos')
  assert.strictEqual(ag.kindOf({ categoria: 'Exposiciones' }), 'exposiciones')
  for (const c of ['Conferencias y Cursos', 'Libros y Lectura', 'Otros', 'Cursos y talleres', 'Actividades', 'Concursos y certámenes']) {
    assert.strictEqual(ag.kindOf({ categoria: c }), 'actividades', c)
  }
  assert.strictEqual(ag.kindOf({ categoria: 'Cine' }), null)
})

test('para niños: lo dice la Junta (destinatarios) o el título', () => {
  assert.ok(ag.isForKids({ titulo: 'Raíces' }, 'Público familiar'))
  assert.ok(ag.isForKids({ titulo: "'Cuentilaura: Navidad'" }, 'Público infantil'))
  assert.ok(ag.isForKids({ titulo: 'La poeta de los colores. Títeres' }))
  assert.ok(!ag.isForKids({ titulo: 'El Ateneo de Salamanca en la Casa de las Conchas' }, 'Adultos'))
})

test('Junta: cada sesión de un ciclo es un evento (no se queda solo la primera)', () => {
  const s = (fecha) => ag.fromJunta({ id_evento: 'ATENEO', titulo: 'El Ateneo de Salamanca', fecha_inicio: `${fecha}T00:00:00+00:00`, categoria: 'Conferencias y Cursos', nombre_localidad: 'Salamanca', cp: '37002' })
  const merged = mergeEvents([s('2026-09-14'), s('2026-11-25'), s('2026-12-17')])
  assert.strictEqual(merged.length, 3)
  assert.notStrictEqual(merged[0].id_evento, merged[1].id_evento)
})

test('La Salina: una clase desconocida toma la categoría del tipo de actividad', () => {
  const ev = dip.toEvent({ id: 1, titulo: 'Certamen de pintura rápida', clase: 'evento otraClase', nucleo: 'Béjar' }, { inicio: '2026-12-01' }, 'concursos')
  assert.strictEqual(ev.categoria, 'Concursos y certámenes')
  assert.strictEqual(ag.kindOf(ev), 'actividades')
})

test('USAL convocatorias: lista, ruedas de prensa, campus de fuera, pueblo y fin de las exposiciones', () => {
  const { _test: u } = require('../../src/services/agendas/usalConvocatorias')
  const html = `<article data-history-node-id="141175" class="node node--teaser node--type-usal-convocatoria">
    <div class="date_section"><span class="date-day">16</span><span class="date-month">Noviembre</span><span class="date-year">2026</span></div>
    <h2><a href="/convocatoria/vicerrector-inaugura-exposicion">El Vicerrector inaugura la exposición “La escuela lingüística de Salamanca"</a></h2></article>`
  const [it] = u.parseList(html)
  assert.deepStrictEqual([it.id, it.fecha, it.link], ['141175', '2026-11-16', 'https://comunicacion.usal.es/convocatoria/vicerrector-inaugura-exposicion'])
  const expo = u.toEvent(it, { descripcion: 'La exposición de carácter divulgativo estará abierta hasta el 22 de diciembre.' })
  assert.strictEqual(expo.categoria, 'Exposiciones')
  assert.strictEqual(expo.fecha_fin, '2026-12-22')
  assert.strictEqual(expo.municipio, 'Salamanca')
  const at = (titulo, descripcion = '') => u.toEvent({ id: 'x', titulo, fecha: '2026-11-12', link: 'https://comunicacion.usal.es/convocatoria/x' }, { descripcion })
  assert.strictEqual(at('RUEDA DE PRENSA: La USAL presenta la XXIV Feria de Empleo'), null)
  assert.strictEqual(at('RUEDA DE PRENSA: Actividades Culturales inaugura la exposición “El cuaderno escolar”').titulo, 'Actividades Culturales inaugura la exposición “El cuaderno escolar”')
  assert.strictEqual(at('La Politécnica de Ávila acoge una conferencia sobre ciberataques'), null)
  assert.strictEqual(at('La Universidad de Salamanca inviste doctor “honoris causa” a un diplomático'), null)
  assert.strictEqual(at('La Universidad de Salamanca celebra en Alba de Tormes el II Simposio en IA').municipio, 'Alba de Tormes')
  assert.strictEqual(u.hourOf('El acto será a las 19:30 horas en el Paraninfo'), '19:30')
})
