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
// Primera hora del horario ("12:15-12:45", "09:00h Crecemos…") en minutos, para ordenar las paradas del mismo día
const firstHour = (s) => {
  const m = String(s?.hora || '').match(/(\d{1,2})[:.](\d{2})/)
  return m ? +m[1] * 60 + +m[2] : 24 * 60
}

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

// "A, B, C" → "A, B y C"
const listEs = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0] || '')

// [{ ruta, stops: [...] }] → [{ ruta, num, title, towns, comarca, stops, stopsCount, nextStop }], sin duplicados.
// comarcas: { '37001': 'Campo de Salamanca', ... } (public/data/comarcas.json) para saber la zona de cada ruta.
export function mergeBibliobusRoutes(routes = [], comarcas = {}) {
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
  const result = groups.map(r => {
    const stops = [...r.stops].sort((a, b) => time(a) - time(b) || firstHour(a) - firstHour(b) || (a.municipio || '').localeCompare(b.municipio || ''))
    // Zona de la ruta: la comarca que más se repite entre sus paradas
    const count = {}
    for (const s of stops) {
      const c = comarcas[String(s.cod_ine || '')]
      if (c) count[c] = (count[c] || 0) + 1
    }
    const comarca = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    return {
      ruta: r.key,
      num: r.num,
      // El número se repite entre bibliobuses: el título son los pueblos
      title: listEs(r.towns) || (r.num ? `Ruta ${r.num}` : 'Ruta'),
      label: r.num ? `Ruta ${r.num}` : '',
      comarca,
      towns: r.towns.join(', '),
      stops,
      stopsCount: stops.length,
      nextStop: stops.find(s => time(s) >= now - 86400000) || null
    }
  }).sort((a, b) => time(a.nextStop) - time(b.nextStop) || (+a.num || 0) - (+b.num || 0))

  // 4. Color de cada ruta, igual en el mapa y en la lista. Se reparten en orden de comarca para que
  // las rutas de una misma zona (las que se ven juntas en el mapa) no repitan color.
  const byZone = [...result].sort((a, b) =>
    (a.comarca || '~').localeCompare(b.comarca || '~', 'es') || (+a.num || 0) - (+b.num || 0) || a.title.localeCompare(b.title, 'es'))
  byZone.forEach((r, i) => { r.color = ROUTE_COLORS[i % ROUTE_COLORS.length] })
  return result
}

// Colores de ruta: se distinguen entre sí y del azul con que se pintan los municipios con biblioteca
export const ROUTE_COLORS = [
  '#e6194b', // rojo
  '#2e9e44', // verde
  '#f58231', // naranja
  '#911eb4', // morado
  '#d6338a', // rosa
  '#9a6324', // marrón
  '#00897b', // verde azulado
  '#c99a00', // mostaza
  '#3d2c8d', // índigo
  '#6b8e23'  // oliva
]

// Rutas agrupadas por comarca (orden alfabético; las que no tienen zona, al final)
export function groupRoutesByComarca(routes) {
  const groups = new Map()
  for (const r of routes) {
    const key = r.comarca || 'Otras zonas'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'Otras zonas') - (b === 'Otras zonas') || a.localeCompare(b, 'es'))
    .map(([comarca, list]) => ({ comarca, routes: list }))
}

// public/data/comarcas.json, descargado una sola vez
let comarcasPromise = null
export function loadComarcas() {
  if (!comarcasPromise) {
    comarcasPromise = fetch('/data/comarcas.json')
      .then(res => (res.ok ? res.json() : {}))
      .catch(() => ({}))
  }
  return comarcasPromise
}
