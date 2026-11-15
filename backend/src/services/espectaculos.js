// Espectáculos de la provincia (teatro, música y danza) de las tres agendas: Junta de Castilla y León,
// Diputación de Salamanca (La Salina) y Turismo de Salamanca, sin repetir la misma función.
// Las exposiciones no entran (no son espectáculos). Cada evento lleva cod_ine para colorear su pueblo y su fuente.
// Lo usan el filtro "Espectáculos" (/api/towns/teatro), el resumen semanal (difusión) y el asistente.
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { findTown } = require('../helpers/townIndex')
const { mergeEvents } = require('../helpers/eventDedupe')
const diputacionAgenda = require('./diputacionAgenda')
const agendas = require('./agendas')

const JUNTA_URL = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/eventos-de-la-agenda-cultural-categorizados-y-geolocalizados/records?limit=100&refine=nombre_provincia%3A%22Salamanca%22&refine=categoria%3A%22Espect%C3%A1culos%22'
const SHOW_CATEGORIES = new Set(['Espectáculos', 'Música'])
const CPS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../helpers/ine-codigopostal.json'), 'utf8'))

let cache = { at: 0, ttl: 0, events: null }
let inflight = null

function fromJunta(item) {
  const cpData = item.cp ? CPS.find(m => m.CodigoPostal === parseInt(item.cp, 10)) : null
  const municipio = item.municipio || cpData?.Municipio || item.nombre_localidad || ''
  const town = findTown([item.nombre_localidad, municipio].filter(Boolean), item.cp)
  return {
    id_evento: item.id_evento ? `jcyl-${item.id_evento}` : null,
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
    source: 'jcyl_teatro',
    fuente: 'Junta de Castilla y León'
  }
}

// Todos los espectáculos (30 minutos en memoria; 5 si alguna fuente ha fallado, para reintentarlo antes)
async function getShows() {
  if (cache.events && Date.now() - cache.at < cache.ttl) return cache.events
  if (inflight) return inflight
  inflight = (async () => {
    const [junta, dipu, turismo] = await Promise.all([
      axios.get(JUNTA_URL, { timeout: 20000 }).then(r => r.data?.results || []).catch(err => {
        console.warn('⚠️ Espectáculos de la Junta:', err.message)
        return []
      }),
      diputacionAgenda.getAgenda().catch(() => []),
      agendas.culturalEvents().catch(() => [])
    ])
    const shows = (list, fuente) => list.filter(e => SHOW_CATEGORIES.has(e.categoria)).map(e => ({ ...e, fuente: e.fuente || fuente }))
    const events = mergeEvents(junta.map(fromJunta), shows(dipu, 'Diputación de Salamanca'), shows(turismo, 'Turismo de Salamanca'))
    cache = { at: Date.now(), ttl: junta.length && dipu.length ? 30 * 60 * 1000 : 5 * 60 * 1000, events }
    console.log(`🎭 Espectáculos: ${events.length} (Junta ${junta.length}, Diputación ${dipu.length}, Turismo ${turismo.length} antes de filtrar)`)
    return events
  })().finally(() => { inflight = null })
  return inflight
}

module.exports = { getShows }
