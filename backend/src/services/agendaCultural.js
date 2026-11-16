// Agenda cultural de la provincia, de las tres agendas y la prensa local: Junta de Castilla y León (agenda cultural categorizada,
// todas sus categorías), Diputación de Salamanca (La Salina, todos sus tipos menos el cine) y Turismo de
// Salamanca (salamanca.es), más los eventos que anuncian los periódicos de la provincia (services/prensa). Se cargan juntas, se quitan las repetidas (la misma función en dos agendas) y se
// reparten en tres grupos para los filtros de Cultura:
//   - espectaculos: teatro, títeres, monólogos, danza, circo, música y conciertos
//   - exposiciones
//   - actividades: charlas y cursos, talleres, clubes de lectura y cuentacuentos, juegos y visitas, concursos,
//     festivales y cultura tradicional
// El cine y las proyecciones van con los cines (services/cinesService.js). Cada evento lleva cod_ine (para
// colorear su pueblo), su fuente y `infantil` (pensado para niños o familias).
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { findTown } = require('../helpers/townIndex')
const { mergeEvents } = require('../helpers/eventDedupe')
const diputacionAgenda = require('./diputacionAgenda')
const agendas = require('./agendas')
const prensa = require('./prensa')

const JUNTA_URL = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-la-agenda-cultural-categorizados-y-geolocalizados/records'
const CPS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../helpers/ine-codigopostal.json'), 'utf8'))

// Categoría (de cualquiera de las tres agendas) → grupo. Lo que no está aquí, a actividades; el cine, fuera.
const KIND = {
  'Espectáculos': 'espectaculos',
  'Música': 'espectaculos',
  'Conciertos': 'espectaculos',
  'Exposiciones': 'exposiciones',
  'Cine': null
}
const kindOf = (e) => (e.categoria in KIND ? KIND[e.categoria] : 'actividades')

// ¿Para niños o familias? La Junta lo dice (destinatarios); en las otras, por el título y la descripción
const KIDS = /\b(infantil(es)?|niñ[oa]s|familia(r|res)?|títeres|marionetas|cuentacuentos|cuentos|peques|bebés|para todos los públicos)\b/i
const isForKids = (e, destinatarios = null) =>
  /infantil|familiar/i.test(destinatarios || '') || KIDS.test(`${e.titulo || ''} ${String(e.descripcion || '').slice(0, 300)}`)

function fromJunta(item) {
  const cpData = item.cp ? CPS.find(m => m.CodigoPostal === parseInt(item.cp, 10)) : null
  const municipio = item.municipio || cpData?.Municipio || item.nombre_localidad || ''
  const town = findTown([item.nombre_localidad, municipio].filter(Boolean), item.cp)
  return {
    // La Junta repite el id en cada sesión de un ciclo (Ateneo, clubes de lectura…): con la fecha, cada sesión
    // es un evento (si no, solo quedaría la primera, que suele haber pasado ya)
    id_evento: item.id_evento ? `jcyl-${item.id_evento}-${String(item.fecha_inicio || '').slice(0, 10)}` : null,
    titulo: item.titulo || 'Evento sin título',
    fecha_inicio: item.fecha_inicio,
    fecha_fin: item.fecha_fin,
    hora_inicio: item.hora_inicio || null,
    categoria: item.categoria,
    tematica: item.tematica || null,
    descripcion: item.descripcion,
    lugar_celebracion: item.lugar_celebracion || null,
    calle: item.calle || null,
    municipio: town?.name || municipio,
    nombre_localidad: item.nombre_localidad || null,
    cod_ine: town?.ine || (cpData ? String(cpData.CodMunicipio) : null),
    cp: item.cp,
    latitud: item.latitud ?? null,
    longitud: item.longitud ?? null,
    precio: item.precio,
    imagen_evento: item.imagen_evento || null,
    enlace_contenido: item.enlace_contenido || null,
    destinatarios: item.destinatarios || null,
    source: 'jcyl',
    fuente: 'Junta de Castilla y León'
  }
}

// Toda la agenda de la Junta para Salamanca (de 100 en 100; suelen ser menos de 100)
async function juntaEvents() {
  const out = []
  for (let offset = 0; offset < 1000; offset += 100) {
    const { data } = await axios.get(JUNTA_URL, {
      params: { limit: 100, offset, refine: 'nombre_provincia:"Salamanca"', order_by: 'fecha_inicio' },
      timeout: 20000
    })
    const page = data?.results || []
    out.push(...page)
    if (page.length < 100) break
  }
  return out
}

let cache = { at: 0, ttl: 0, groups: null }
let inflight = null

// { espectaculos, exposiciones, actividades } (30 minutos en memoria; 5 si alguna fuente ha fallado)
async function getAll() {
  if (cache.groups && Date.now() - cache.at < cache.ttl) return cache.groups
  if (inflight) return inflight
  inflight = (async () => {
    const [junta, dipu, turismo] = await Promise.all([
      juntaEvents().catch(err => { console.warn('⚠️ Agenda cultural de la Junta:', err.message); return [] }),
      diputacionAgenda.getAgenda().catch(() => []),
      agendas.culturalEvents().catch(() => [])
    ])
    const tag = (list, fuente) => list.map(e => ({ ...e, fuente: e.fuente || fuente, infantil: isForKids(e, e.destinatarios) }))
    // La Junta primero: su ficha manda cuando el mismo evento está en varias agendas
    // La prensa local, la última: lo que ya está en una agenda oficial manda; de ella entra lo que no está en ninguna
    // (sus eventos ya vienen marcados como infantiles o no por la IA)
    const press = prensa.events()
    const all = mergeEvents(tag(junta.map(fromJunta), 'Junta de Castilla y León'), tag(dipu, 'Diputación de Salamanca'), tag(turismo, 'Turismo de Salamanca'), press.map(e => ({ ...e, infantil: e.infantil || isForKids(e) })))
    const groups = { espectaculos: [], exposiciones: [], actividades: [] }
    for (const e of all) {
      const k = kindOf(e)
      if (k) groups[k].push(e)
    }
    cache = { at: Date.now(), ttl: junta.length && dipu.length ? 30 * 60 * 1000 : 5 * 60 * 1000, groups }
    console.log(`🎭 Agenda cultural: ${groups.espectaculos.length} espectáculos, ${groups.exposiciones.length} exposiciones, ${groups.actividades.length} actividades (Junta ${junta.length}, Diputación ${dipu.length}, Turismo ${turismo.length})`)
    return groups
  })().finally(() => { inflight = null })
  return inflight
}

const getShows = async () => (await getAll()).espectaculos
const getExhibitions = async () => (await getAll()).exposiciones
const getActivities = async () => (await getAll()).actividades

module.exports = { getAll, getShows, getExhibitions, getActivities, _test: { kindOf, isForKids, fromJunta } }
