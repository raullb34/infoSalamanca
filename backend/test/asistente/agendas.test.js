// Agendas añadidas (Turismo de Salamanca, Convention Bureau, Salamanca Tech) y noticias de ciencia de la USAL.
// Sin red: extractos reales en test/fixtures/agendas.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { _test: es } = require('../../src/services/agendas/salamancaEs')
const { _test: tech } = require('../../src/services/agendas/salamancaTech')
const { _test: usal } = require('../../src/services/agendas/usalNoticias')
const { classify } = require('../../src/services/agendas/classify')
const { mergeEvents } = require('../../src/helpers/eventDedupe')

const fixture = (f) => fs.readFileSync(path.join(__dirname, '../fixtures/agendas', f), 'utf8')

test('sitemap de salamanca.es: solo las fichas en español de la agenda y del Convention Bureau', () => {
  assert.deepStrictEqual(es.eventUrls(fixture('salamanca-es-sitemap.xml')), [
    'https://salamanca.es/agenda/eventos/chavela',
    'https://salamanca.es/convention-bureau/agenda/eventos/7-cold-atom-workshop-caws-2026'
  ])
})

test('ficha de Turismo de Salamanca (JSON-LD): fecha, hora, lugar con coordenadas, precio y municipio', () => {
  const e = es.parseEvent(fixture('salamanca-es-chavela.html'), 'https://www.salamanca.es/agenda/eventos/chavela')
  assert.strictEqual(e.titulo, 'Chavela')
  assert.strictEqual(e.fecha_inicio, '2026-11-14')
  assert.strictEqual(e.fecha_fin, null)
  assert.strictEqual(e.hora_inicio, '20:00')
  assert.strictEqual(e.lugar_celebracion, 'Teatro Liceo')
  assert.strictEqual(e.cod_ine, '37274')
  assert.ok(Math.abs(e.latitud - 40.966) < 0.01)
  assert.strictEqual(e.precio, '20 €')
  assert.strictEqual(e.ambito, 'cultura')
  assert.strictEqual(e.source, 'turismo-salamanca')
})

test('ficha del Convention Bureau: un workshop científico va a ciencia', () => {
  const url = 'https://www.salamanca.es/convention-bureau/agenda/eventos/7-cold-atom-workshop-caws-2026'
  const e = es.parseEvent(fixture('convention-bureau-cold-atom.html'), url)
  assert.strictEqual(e.fecha_inicio, '2026-11-26')
  assert.strictEqual(e.fecha_fin, '2026-11-27')
  assert.strictEqual(e.ambito, 'ciencia')
  assert.strictEqual(e.categoria, 'Congresos y jornadas')
  assert.strictEqual(e.source, 'convention-bureau')
})

test('clasificación: cultura, ciencia o fuera (deporte)', () => {
  const c = (titulo, opts, extra = {}) => classify({ titulo, ...extra }, opts)
  assert.strictEqual(c('Campeonato de España de Pádel', { congresses: true }).ambito, null)
  assert.strictEqual(c('San Silvestre Universitaria', { congresses: true }).ambito, null)
  assert.strictEqual(c('38ª Reunión GEDOC', { congresses: true }).ambito, 'ciencia')
  assert.strictEqual(c('Joven Orquesta Sinfónica. 1er Concierto').categoria, 'Música')
  // El lugar decide cuando el título no lo dice: una exposición del DA2 que habla de "investigación"
  assert.strictEqual(c('Eva Herrero. Llámese Baldía', {}, { descripcion: 'Una investigación artística…', lugar_celebracion: 'DA2 (DOMUS ARTIUM 2002)' }).ambito, 'cultura')
  assert.strictEqual(c('El retablo de las maravillas', {}, { descripcion: 'Cervantes y la ciencia…', lugar_celebracion: 'Teatro Liceo' }).ambito, 'cultura')
})

test('Salamanca Tech: solo los próximos (no los de "Eventos pasados") y solo los de la provincia', () => {
  const items = tech.parseList(fixture('salamanca-tech-eventos.html'))
  assert.ok(items.length >= 1)
  assert.ok(items.every(i => !/SALAMAQ|UPSAFest|South Summit/.test(i.titulo)), 'los pasados no entran')
  const muy = items.find(i => /MUY Science Fest/.test(i.titulo))
  assert.strictEqual(muy.dia, 18)
  assert.strictEqual(muy.mes, 11)
  assert.match(muy.lugar, /Palacio de Congresos/)
  assert.ok(tech.inProvince(muy.lugar))
  assert.strictEqual(tech.inProvince('James L. Knight Center, Downtown Miami (EE.UU.)'), null)
  assert.strictEqual(tech.inProvince('Marbella'), null)
  assert.strictEqual(tech.inProvince('Plaza del Oeste, Calle Melchor Cano').ine, '37274')
})

test('Salamanca Tech: año del evento a partir de la fecha de publicación', () => {
  assert.strictEqual(tech.eventDate(18, 11, '2026-11-12T09:19:27'), '2026-11-18')
  assert.strictEqual(tech.eventDate(1, 3, '2026-09-29T10:24:46'), '2027-03-01')
})

test('noticias de ciencia de la USAL: título, fecha, imagen y resumen sin la cabecera', () => {
  const news = usal.parseFeed(fixture('usal-ciencia.xml'))
  assert.strictEqual(news.length, 3)
  const n = news[0]
  assert.match(n.titulo, /Neurociencia a Medida/)
  assert.strictEqual(n.fecha, '2026-11-13T08:23:24.000Z')
  assert.ok(n.enlace.startsWith('https://comunicacion.usal.es/'))
  assert.ok(n.imagen.startsWith('https://comunicacion.usal.es/'))
  assert.ok(!/^Ciencia \d/.test(n.resumen))
  assert.ok(n.resumen.length > 40 && n.resumen.length <= 330)
})

test('la misma función en dos agendas sale una vez (se queda la primera)', () => {
  const junta = [{ id_evento: 'j1', titulo: "'Ibiza80' (FÉLIX ALBO)", fecha_inicio: '2026-11-18' }, { id_evento: 'j1', titulo: "'Ibiza80' (FÉLIX ALBO)", fecha_inicio: '2026-11-18' }]
  const turismo = [{ id_evento: 't1', titulo: 'Ibiza80', fecha_inicio: '2026-11-18' }, { id_evento: 't2', titulo: 'Ibiza80', fecha_inicio: '2026-11-19' }]
  const merged = mergeEvents(junta, turismo)
  assert.deepStrictEqual(merged.map(e => e.id_evento), ['j1', 't2'])
})
