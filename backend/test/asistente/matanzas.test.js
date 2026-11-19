// Circuito de Matanzas Tradicionales de la Diputación (services/matanzas): todos los pueblos del cartel con su INE,
// una fiesta por cita, títulos distintos el mismo día (la agenda junta los que coinciden) y la de la prensa, una vez.
const test = require('node:test')
const assert = require('node:assert')
const { allEvents } = require('../../src/services/matanzas')
const { mergeEvents } = require('../../src/helpers/eventDedupe')

const events = allEvents()

test('las 105 citas del cartel 2026-2027, cada una en su pueblo', () => {
  const season = events.filter(e => e.fecha_inicio >= '2026-11-01' && e.fecha_inicio <= '2027-03-31')
  assert.strictEqual(season.length, 105)
  assert.ok(season.every(e => /^37\d{3}$/.test(e.cod_ine)), 'todas con INE de Salamanca')
  assert.strictEqual(new Set(season.map(e => e.id_evento)).size, 105)
  assert.deepStrictEqual(season.map(e => [e.fecha_inicio, e.municipio])[0], ['2026-11-07', 'Cristóbal'])
  const machacon = season.find(e => e.cod_ine === '37175')
  assert.strictEqual(machacon.titulo, 'Fiesta de la Matanza Tradicional en Machacón y Francos')
  const teresa = season.find(e => e.titulo.endsWith('Santa Teresa'))
  assert.strictEqual(teresa.municipio, 'Galisancho')
  assert.match(season.find(e => e.municipio === 'Candelario').descripcion, /singulares/)
})

test('el mismo sábado no se juntan las doce y la de la prensa no se repite', () => {
  const dia = events.filter(e => e.fecha_inicio === '2026-12-05')
  assert.strictEqual(dia.length, 12)
  assert.strictEqual(mergeEvents(dia).length, 12)
  const navasfrias = dia.find(e => e.municipio === 'Navasfrías')
  const prensa = { id_evento: 'prensa-x-0', titulo: 'Fiesta de la Matanza', fecha_inicio: '2026-12-05', cod_ine: navasfrias.cod_ine, source: 'prensa' }
  const merged = mergeEvents(dia, [prensa])
  assert.strictEqual(merged.length, 12, 'la de la prensa en Navasfrías es la misma')
  assert.ok(!merged.some(e => e.source === 'prensa'))
  // La misma noticia en un pueblo que no está en el circuito sí entra
  const otra = { ...prensa, id_evento: 'prensa-y-0', cod_ine: '37001' }
  assert.strictEqual(mergeEvents(dia, [otra]).length, 13)
})
