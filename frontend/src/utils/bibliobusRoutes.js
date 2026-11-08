// Rutas del bibliobús: limpieza de los datos de la Junta.
//
// La misma ruta viene escrita de varias formas: "1 (A, B)", "1(A, B)", "1 (A, B) )", "Riofrio"/"Riofrío",
// o con erratas en un pueblo ("Peñacaballera"/"Peñacallera"). Además, bibliobuses distintos reutilizan
// los números de ruta, así que una ruta se identifica por su número + sus pueblos.
// Lo usan el panel de resultados (FilterResults.vue) y el recuento de "Ver lista" (App.vue).

const plain = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const accents = (t) => (t.match(/[áéíóúñü]/gi) || []).length
const stopId = (s) => [s.municipio, s.localidad, s.lugar, s.dia, s.hora].map(plain).join('|')
const time = (s) => (s?.nextDate ? new Date(s.nextDate).getTime() : Infinity)

function parseRuta(ruta) {
  const m = String(ruta || '').match(/^\s*(\d+)\s*(.*)$/s)
  const towns = (m ? m[2] : String(ruta || '')).replace(/[()]/g, '').split(',').map(t => t.trim()).filter(Boolean)
  return { num: m ? m[1] : '', towns }
}

function addStops(target, stops) {
  for (const stop of stops) {
    const id = stopId(stop)
    if (!target.seen.has(id)) {
      target.seen.add(id)
      target.stops.push(stop)
    }
  }
}

// [{ ruta, stops: [...] }] → [{ ruta, num, title, towns, stops, stopsCount, nextStop }], sin duplicados
export function mergeBibliobusRoutes(routes = []) {
  // 1. Misma ruta con distinta escritura: número + pueblos normalizados
  const exact = new Map()
  for (const route of routes) {
    const { num, towns } = parseRuta(route.ruta)
    const key = `${num}|${towns.map(plain).join(',')}`
    if (!exact.has(key)) exact.set(key, { key, num, towns, stops: [], seen: new Set() })
    const r = exact.get(key)
    if (accents(towns.join()) > accents(r.towns.join())) r.towns = towns // la variante con tildes, para el título
    addStops(r, route.stops || [])
  }

  // 2. Erratas en algún pueblo: mismo número y al menos el 60 % de los pueblos en común
  const groups = []
  for (const r of exact.values()) {
    const set = new Set(r.towns.map(plain))
    const twin = groups.find(g => g.num === r.num &&
      [...set].filter(t => g.set.has(t)).length / Math.max(set.size, g.set.size) >= 0.6)
    if (!twin) {
      groups.push({ ...r, set })
      continue
    }
    if (accents(r.towns.join()) > accents(twin.towns.join())) twin.towns = r.towns
    addStops(twin, r.stops)
  }

  // 3. Paradas por fecha y ruta con su próxima parada (de hoy en adelante)
  const now = Date.now()
  return groups.map(r => {
    const stops = [...r.stops].sort((a, b) => time(a) - time(b) || (a.municipio || '').localeCompare(b.municipio || ''))
    return {
      ruta: r.key,
      num: r.num,
      title: r.num ? `Ruta ${r.num}` : 'Ruta',
      towns: r.towns.join(', '),
      stops,
      stopsCount: stops.length,
      nextStop: stops.find(s => time(s) >= now - 86400000) || null
    }
  }).sort((a, b) => time(a.nextStop) - time(b.nextStop) || (+a.num || 0) - (+b.num || 0))
}
