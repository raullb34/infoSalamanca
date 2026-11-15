// Rutas culturales oficiales de la provincia (Mudéjar, Teresiana, Vía de la Plata…), generadas por
// backend/scripts/build-rutas-culturales.js con sus fuentes. Estado compartido: la ruta abierta en el panel
// es la que dibujan los mapas 2D y 3D.
//
// Color (método dataviz): seis rutas no se distinguen a la vez en un mapa (la paleta solo garantiza tres en
// todas las parejas), así que nunca se pintan juntas. Vista general: un solo tono, más oscuro cuantas más
// rutas pasan por el pueblo (rampa azul validada). Ruta abierta: solo esa, en su color, con números y nombres
// en cada parada (el "alivio" que exige su contraste bajo sobre el gris del mapa).
import { reactive } from 'vue'
import data from '@/data/rutasCulturales.json'

export const RUTAS = data.rutas

export const state = reactive({ selectedId: null })
export const selectedRoute = () => RUTAS.find(r => r.id === state.selectedId) || null

// Vista general: 1, 2 o 3+ rutas por el pueblo
export const OVERVIEW_RAMP = [
  { min: 1, color: '#5598e7', label: '1 ruta' },
  { min: 2, color: '#256abf', label: '2 rutas' },
  { min: 3, color: '#104281', label: '3 o más' }
]

// INE → ids de las rutas que pasan por él
export const routesByTown = (() => {
  const map = {}
  for (const r of RUTAS) {
    for (const t of r.tramos) for (const p of t.paradas) {
      map[p.ine] = map[p.ine] || []
      if (!map[p.ine].includes(r.id)) map[p.ine].push(r.id)
    }
  }
  return map
})()

export const townCount = Object.keys(routesByTown).length

// Paradas numeradas de una ruta: cada lugar una vez, en el orden en que aparece (el Camino Norte y el Sur
// de la Ruta Teresiana comparten inicio y final, que llevan el mismo número en el mapa y en la lista)
export const stopKey = (p) => `${p.ine}|${p.localidad || ''}`
export function numberedStops(route) {
  const out = []
  for (const t of route.tramos) {
    for (const p of t.paradas) {
      const key = stopKey(p)
      if (!out.some(o => o.key === key)) out.push({ ...p, key, n: out.length + 1 })
    }
  }
  return out
}
export const stopNumber = (route, p) => numberedStops(route).find(o => o.key === stopKey(p))?.n

// Para el mapa 3D, con la forma de las rutas del bibliobús: una por tramo
export const routes3d = (route) => (route ? route.tramos.map((t, i) => ({
  ruta: `cultural-${route.id}-${i}`,
  color: route.color,
  title: route.nombre,
  label: t.nombre || route.lema,
  stops: t.paradas.map(p => ({ cod_ine: p.ine }))
})) : [])
