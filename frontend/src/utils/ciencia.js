// Ciencia: eventos (congresos, jornadas, divulgación, tecnología) y noticias de ciencia de la USAL (/api/ciencia).
// Las peticiones se comparten 2 minutos: App.vue (colores del mapa) y la lista del panel piden lo mismo.
import axios from 'axios'

const base = import.meta.env.PROD
  ? '/api'
  : `http://${import.meta.env.VITE_BACKEND_HOST || 'localhost'}:${import.meta.env.VITE_BACKEND_PORT || '4000'}/api`

const cache = new Map()
function cached(path, pick) {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < 2 * 60 * 1000) return hit.p
  const p = axios.get(`${base}${path}`, { timeout: 30000 }).then(r => pick(r.data))
  p.catch(() => cache.delete(path))
  cache.set(path, { at: Date.now(), p })
  return p
}

export const scienceEvents = () => cached('/ciencia/eventos', d => d.eventos || [])
export const scienceNews = () => cached('/ciencia/noticias', d => d.noticias || [])

// Etiqueta corta de la fuente, para la tarjeta
export const SOURCE_LABELS = {
  'salamanca-tech': 'Salamanca Tech',
  'convention-bureau': 'Convention Bureau',
  'turismo-salamanca': 'Turismo de Salamanca'
}
