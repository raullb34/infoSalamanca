// Prensa local (services/prensa): pueblos de una noticia, temas que quedan fuera, lo que se le pasa a la IA y la
// comprobación de lo que la IA devuelve. Sin red ni IA.
const test = require('node:test')
const assert = require('node:assert')
const { townsIn, townsOf } = require('../../src/services/prensa/towns')
const { topicsOf } = require('../../src/services/prensa/topics')
const { parseFeed } = require('../../src/services/prensa/reader')
const { _test: ex } = require('../../src/services/prensa/extract')

const names = (s) => townsIn(s).map(t => t.name)

test('pueblos: nombre oficial, sin artículo, formas cortas de la prensa y nombres que son palabras corrientes', () => {
  assert.deepStrictEqual(names('La Fuente de San Esteban acogerá el cierre de las IV Jornadas'), ['La Fuente de San Esteban'])
  assert.deepStrictEqual(names('Villares organiza una doble sesión de teatro'), ['Villares de la Reina'])
  assert.deepStrictEqual(names('La Biblioteca de Peñaranda acogerá una sesión de lectura'), ['Peñaranda de Bracamonte'])
  assert.deepStrictEqual(names('Sancti Spíritus estrena el festival'), ['Sancti-Spíritus'])
  assert.deepStrictEqual(names('Vecinos de Aldeatejada piden más luz'), ['Aldeatejada'], '"Vecinos" al principio no es el pueblo')
  assert.deepStrictEqual(names('Fiestas en Vecinos este fin de semana'), ['Vecinos'])
  assert.deepStrictEqual(names('Rafael Sequeros presenta su libro'), [], 'un apellido no es el pueblo')
  assert.deepStrictEqual(names('una encina centenaria'), [], 'en minúscula no es "Encina de San Silvestre"')
})

test('pueblos: el medio comarcal pone el suyo si la noticia no nombra ninguno; la capital, solo si se nombra como ciudad', () => {
  assert.deepStrictEqual(townsOf({ titulo: 'Nueva sede del club de ajedrez', resumen: '', texto: '', comarcal: 'Béjar' }).map(t => t.name), ['Béjar'])
  assert.deepStrictEqual(townsOf({ titulo: 'Batucada en Salamanca este sábado', resumen: '', texto: '' }).map(t => t.name), ['Salamanca'])
  assert.deepStrictEqual(townsOf({ titulo: 'La provincia de Salamanca y su dehesa', resumen: '', texto: '' }), [])
})

test('temas: fuera sucesos, política y esquelas (sin confundir "en pleno centro" o "se vuelca con")', () => {
  assert.strictEqual(topicsOf({ titulo: 'Un camionero resulta herido tras salirse de la vía en la A-62' }).fuera, 'sucesos')
  assert.strictEqual(topicsOf({ titulo: 'El PSOE presenta enmiendas a los presupuestos de la Junta' }).fuera, 'politica')
  assert.strictEqual(topicsOf({ titulo: 'Esquela de Juan Pérez', categorias: ['Necrológicas'] }).fuera, 'esquelas')
  assert.strictEqual(topicsOf({ titulo: 'Exposición de setas en pleno centro de Salamanca' }).fuera, null)
  assert.strictEqual(topicsOf({ titulo: 'Vitigudino se vuelca con la música en un concierto solidario' }).fuera, null)
})

test('temas: a la IA lo que anuncia algo, no las crónicas', () => {
  assert.ok(topicsOf({ titulo: 'Ciudad Rodrigo celebrará Santa Cecilia con dos conciertos' }).anuncia)
  assert.ok(topicsOf({ titulo: 'La Biblioteca de Peñaranda acogerá una sesión de lectura infantil' }).anuncia)
  assert.ok(!topicsOf({ titulo: 'FOTOS de la X Carrera Popular Taurina' }).anuncia)
  assert.ok(!topicsOf({ titulo: 'Pilar García se proclama campeona de España en ruta' }).anuncia)
})

test('IA: solo eventos con fecha válida, a partir de la publicación y en un pueblo que nombre la noticia', () => {
  const item = { titulo: 'Ciudad Rodrigo celebrará Santa Cecilia', fecha: '2026-11-16T10:00:00Z' }
  const towns = [{ ine: '37107', name: 'Ciudad Rodrigo' }]
  const out = ex.validate({
    eventos: [
      { titulo: 'Concierto de la Banda Municipal', tipo: 'espectaculo', fecha_inicio: '2026-11-21', hora: '20:30', municipio: 'Ciudad Rodrigo' },
      { titulo: 'Concierto de 2025', tipo: 'espectaculo', fecha_inicio: '2025-11-21', municipio: 'Ciudad Rodrigo' }, // ya pasó
      { titulo: 'En otro sitio', tipo: 'espectaculo', fecha_inicio: '2026-11-22', municipio: 'Béjar' }, // no lo nombra
      { titulo: 'Sin fecha', tipo: 'actividad', fecha_inicio: 'pronto', municipio: 'Ciudad Rodrigo' },
      { titulo: 'Tipo raro', tipo: 'boda', fecha_inicio: '2026-11-22', municipio: 'Ciudad Rodrigo' }
    ]
  }, item, towns)
  assert.deepStrictEqual(out.map(e => [e.titulo, e.fecha_inicio, e.hora, e.ine]), [['Concierto de la Banda Municipal', '2026-11-21', '20:30', '37107']])
  assert.deepStrictEqual(ex.parseJson('Aquí tienes: {"eventos":[]} ¡listo!'), { eventos: [] })
  assert.strictEqual(ex.parseJson('nada'), null)
})

test('IA: fuera lo que no es un acto para el público (bibliobús, encuentros de un gremio, misas, programas largos), los cursos y ferias sí', () => {
  const { lowValue } = require('../../src/services/prensa/extract')
  const ev = (titulo, extra = {}) => ({ titulo, tipo: 'actividad', fecha_inicio: '2026-11-20', ...extra })
  assert.ok(lowValue(ev('Bibliobús Ruta 11')))
  assert.ok(lowValue(ev('Encuentro de profesionales de talleres de automoción')))
  assert.ok(lowValue(ev('Misa de acción de gracias por la temporada taurina')))
  assert.ok(lowValue(ev('Grabaciones Ferrero Rocher en la Plaza Mayor')))
  assert.ok(lowValue(ev('Programa Educar en Familia', { fecha_inicio: '2026-11-14', fecha_fin: '2026-12-31' })))
  assert.ok(!lowValue(ev('Salón del Libro Infantil y Juvenil', { fecha_inicio: '2026-11-21', fecha_fin: '2027-01-10' })))
  assert.ok(!lowValue(ev('Taller gratuito de repostería tradicional')))
  assert.ok(!lowValue(ev('Curso de Discernimiento Vocacional')))
  assert.ok(!lowValue(ev('Feria de Empleo Universidad de Salamanca', { tipo: 'feria', fecha_fin: '2026-12-02' })))
  assert.ok(!lowValue(ev('Escuela de Familias 2026-2027')))
  assert.ok(!lowValue(ev('Fiestas de San Martín', { tipo: 'fiesta' })))
})

test('prensa: el mismo acto en dos periódicos sale una vez (también resumen frente a actos sueltos)', () => {
  const { _test: { dedupe } } = require('../../src/services/prensa/index')
  const ev = (noticia, titulo, fecha_inicio, extra = {}) => ({ noticia, titulo, fecha_inicio, fecha_fin: null, ine: '37085', municipio: 'Carbajosa de la Sagrada', ...extra })
  const titles = (list) => dedupe(list).map(e => e.titulo)
  // Mismo acto con otro título
  assert.deepStrictEqual(titles([
    ev('a', 'Salón del Libro Infantil y Juvenil', '2026-11-21', { fecha_fin: '2027-01-10' }),
    ev('b', 'VII Salón del Libro Infantil y Juvenil en Salamanca', '2026-11-21', { fecha_fin: '2027-01-10' })
  ]), ['Salón del Libro Infantil y Juvenil'])
  // Un periódico da el resumen y otro los actos sueltos
  assert.deepStrictEqual(titles([
    ev('a', 'Talleres y visitas culturales para mayores', '2026-11-20'),
    ev('b', 'Salida cultural al Palacio Episcopal', '2026-11-20'),
    ev('b', 'Taller de Libros decorados', '2026-11-20'),
    ev('c', 'Feria de Negocio Rural en Carbajosa de la Sagrada', '2026-11-20')
  ]), ['Talleres y visitas culturales para mayores', 'Feria de Negocio Rural en Carbajosa de la Sagrada'])
  // "25N" dentro de un ciclo corto que lo incluye
  assert.deepStrictEqual(titles([
    ev('a', 'Programa de concienciación 25N', '2026-11-24', { fecha_fin: '2026-11-27' }),
    ev('b', 'Acto conmemorativo del 25-N', '2026-11-25')
  ]), ['Programa de concienciación 25N'])
  // Los actos distintos de una misma noticia se quedan, y otro día es otro acto
  assert.strictEqual(dedupe([
    ev('a', 'Taller de Libros decorados', '2026-11-20'),
    ev('a', 'Salida cultural al Palacio Episcopal', '2026-11-20'),
    ev('b', 'Taller de Libros decorados', '2026-11-27')
  ]).length, 3)
})

test('RSS: título, enlace, fecha, resumen sin HTML, imagen y categorías', () => {
  const xml = `<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/"><channel>
    <item><title>La Biblioteca de Peñaranda acogerá una sesión de lectura</title><link>https://noticiasatiempo.es/a</link>
    <pubDate>Mon, 16 Nov 2026 10:00:00 +0100</pubDate><category>Peñaranda</category>
    <description><![CDATA[<p>El <b>miércoles</b> a las 19:00&nbsp;h.</p>]]></description>
    <content:encoded><![CDATA[<p>Texto</p><img src="https://noticiasatiempo.es/cartel.jpg">]]></content:encoded></item></channel></rss>`
  const [n] = parseFeed(xml, { id: 'noticiasatiempo', nombre: 'Noticias a Tiempo', comarcal: 'Peñaranda de Bracamonte' })
  assert.strictEqual(n.titulo, 'La Biblioteca de Peñaranda acogerá una sesión de lectura')
  assert.strictEqual(n.resumen, 'El miércoles a las 19:00 h.')
  assert.strictEqual(n.imagen, 'https://noticiasatiempo.es/cartel.jpg')
  assert.deepStrictEqual(n.categorias, ['Peñaranda'])
  assert.strictEqual(n.fecha, '2026-11-16T09:00:00.000Z')
  assert.strictEqual(n.medio, 'Noticias a Tiempo')
})
