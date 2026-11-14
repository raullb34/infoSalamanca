// Monumentos (Junta de Castilla y León): color e icono por tipo y foto de Wikimedia Commons.
import { apiService } from '@/services/apiService'

const THEMES = [
  [/religios|iglesia|ermita|convento|monasterio|catedral|capilla|santuario/i, '#7a4a2a', '⛪'],
  [/militar|castillo|muralla|torre|fortific/i, '#5a5a6a', '🏰'],
  [/arqueol|yacimiento|castro|dolmen|romano|verraco/i, '#8a6a2a', '🏺'],
  [/puente|ingenier|obra p[uú]blica/i, '#2f6a7a', '🌉'],
  [/civil|palacio|casa|ayuntamiento|plaza|colegio|hospital/i, '#6a3a5a', '🏛️'],
  [/etnol|molino|fuente|lavadero|palomar/i, '#4a7a3a', '🏡']
]

export function themeFor(poi) {
  const text = `${poi?.clasificacion || ''} ${poi?.tipomonumento || ''} ${[].concat(poi?.tipoconstruccion || []).join(' ')}`
  const t = THEMES.find(([re]) => re.test(text)) || [null, '#4a6a7a', '🏛️']
  return { accent: t[1], emoji: t[2] }
}

export const coordsOf = (poi) => ({
  lat: Number(poi?.coordenadas_latitud || poi?.latitud || poi?.pto_geolocalizado?.lat) || null,
  lon: Number(poi?.coordenadas_longitud || poi?.longitud || poi?.pto_geolocalizado?.lon) || null
})

// Foto del monumento, una sola petición por monumento y como mucho 3 a la vez
const cache = new Map()
const queue = []
let running = 0
function pump() {
  while (running < 3 && queue.length) {
    const job = queue.shift()
    running++
    apiService.getPlacePhoto(job.params).then(job.resolve).finally(() => { running--; pump() })
  }
}
export function photoFor(poi) {
  const { lat, lon } = coordsOf(poi)
  const nombre = poi?.nombre || poi?.name
  if (!lat || !lon || !nombre) return Promise.resolve(null)
  const key = `${lat},${lon},${nombre}`
  if (!cache.has(key)) {
    cache.set(key, new Promise(resolve => {
      queue.push({ params: { id: poi.identificador || '', lat, lon, nombre, pueblo: poi.poblacion_municipio || poi.poblacion || '' }, resolve })
      pump()
    }))
  }
  return cache.get(key)
}
