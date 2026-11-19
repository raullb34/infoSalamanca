// Circuito Provincial de Matanzas Tradicionales de la Diputación de Salamanca: una fiesta por pueblo, de noviembre a
// marzo. La Diputación no la publica en su agenda (La Salina), sino como nota de prensa con un cartel en PDF; el
// calendario de cada temporada se transcribe a src/data/matanzas-<temporada>.json.
//
// Cada cita es un evento de la agenda (categoría Fiestas): sale en la agenda, en la sección de fiestas del pueblo y en
// la difusión de la semana. El título lleva el pueblo: la agenda junta los eventos del mismo día con el mismo título,
// y el mismo sábado hay hasta doce matanzas.
const fs = require('fs')
const path = require('path')
const { findTown } = require('../helpers/townIndex')

const DIR = path.resolve(__dirname, '../data')

// Todas las temporadas que haya en src/data (matanzas-2026-2027.json, …)
function load() {
  return fs.readdirSync(DIR).filter(f => /^matanzas-\d{4}-\d{4}\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
}

// Pueblo del cartel → { ine, nombre }. Los que no son municipio traen su INE (y el municipio) en el fichero.
function townOf(p) {
  if (typeof p === 'object') return { ine: p.ine, nombre: p.nombre, municipio: p.municipio || null }
  const t = findTown([p])
  return t ? { ine: t.ine, nombre: p, municipio: null } : null
}

// Todos los eventos (pasados incluidos); los que no se sabe de qué pueblo son se avisan y se dejan fuera
function allEvents() {
  const out = []
  for (const season of load()) {
    for (const cita of season.citas) {
      // Dos localidades del mismo municipio el mismo día (Machacón y Francos) son una sola fiesta
      const byIne = new Map()
      for (const p of cita.pueblos) {
        const t = townOf(p)
        if (!t) { console.warn(`⚠️ Matanzas: no sé de qué pueblo es «${p}»`); continue }
        if (!byIne.has(t.ine)) byIne.set(t.ine, [])
        byIne.get(t.ine).push(t)
      }
      for (const [ine, towns] of byIne) {
        const names = towns.map(t => t.nombre)
        const lugar = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0]
        const municipio = towns.find(t => t.municipio)?.municipio || findTown([towns[0].nombre])?.name || towns[0].nombre
        const singular = towns.some(t => (season.singulares || []).includes(t.nombre))
        out.push({
          id_evento: `matanza-${ine}-${cita.fecha}`,
          titulo: `Fiesta de la Matanza Tradicional en ${lugar}`,
          descripcion: `${season.nombre} ${season.temporada}, de la ${season.organiza}.${singular ? ' Una de las tres matanzas singulares de la temporada.' : ''}`,
          categoria: 'Fiestas',
          tematica: 'Fiestas',
          fecha_inicio: cita.fecha,
          fecha_fin: null,
          hora_inicio: null,
          precio: null,
          lugar_celebracion: towns[0].municipio ? lugar : null, // la pedanía, si no es el propio municipio
          nombre_localidad: lugar,
          municipio,
          cod_ine: ine,
          imagen_evento: null,
          enlace_contenido: season.fuente,
          infantil: false,
          source: 'diputacion',
          fuente: season.organiza
        })
      }
    }
  }
  return out.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
}

let cache = null
// Las de hoy en adelante
function events() {
  cache = cache || allEvents()
  const today = new Date().toISOString().slice(0, 10)
  return cache.filter(e => e.fecha_inicio >= today)
}

module.exports = { events, allEvents }
