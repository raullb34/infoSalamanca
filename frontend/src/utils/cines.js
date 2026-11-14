// Resúmenes de la cartelera de un cine para listas y fichas de pueblo
const pad = (n) => String(n).padStart(2, '0')
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Primer día con sesiones (hoy si hay) y lo que se echa ese día
export function nextDay(cine) {
  const days = [...new Set((cine.peliculas || []).flatMap(f => f.sesiones.map(s => s.inicio.slice(0, 10))))].sort()
  const day = days[0]
  if (!day) return null
  const films = (cine.peliculas || []).filter(f => f.sesiones.some(s => s.inicio.startsWith(day)))
  return { day, films }
}

export function dayLabel(iso) {
  const today = localIso(new Date())
  const t = new Date()
  t.setDate(t.getDate() + 1)
  if (iso === today) return 'hoy'
  if (iso === localIso(t)) return 'mañana'
  const [y, m, d] = iso.split('-').map(Number)
  return `el ${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d}`
}

export function cineSummary(cine) {
  const next = nextDay(cine)
  // Proyecciones de la Diputación: la próxima, con título y hora
  if (cine.tipo === 'proyecciones' && next) {
    const f = next.films[0]
    const hora = f.sesiones.find(x => x.inicio.startsWith(next.day))?.inicio.slice(11, 16)
    const more = (cine.peliculas || []).length - 1
    return `«${f.titulo}», ${dayLabel(next.day)}${hora ? ` a las ${hora}` : ''}${more > 0 ? ` · y ${more} más` : ''}`
  }
  if (next) return `${next.films.length} ${next.films.length === 1 ? 'película' : 'películas'} ${dayLabel(next.day)} · ${(cine.peliculas || []).length} en dos semanas`
  if (cine.estado === 'sin cartelera en línea') return 'No publica su cartelera en internet'
  if (cine.estado === 'no disponible ahora') return 'Cartelera no disponible ahora'
  return 'Sin sesiones anunciadas estos días'
}

export const cinePosters = (cine) => (cine.peliculas || []).map(f => f.cartel).filter(Boolean).slice(0, 3)
