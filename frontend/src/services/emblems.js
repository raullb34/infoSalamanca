// Banderas y escudos por código INE, desde /assets/emblems.json
// (lo genera scripts/build-emblems-manifest.mjs). Se descarga una sola vez.
import { ref } from 'vue'

export const emblems = ref({})
let loading = null

export function loadEmblems() {
  if (!loading) {
    loading = fetch('/assets/emblems.json')
      .then(res => (res.ok ? res.json() : {}))
      .then(data => { emblems.value = data })
      .catch(err => console.warn('No se pudo cargar emblems.json:', err))
  }
  return loading
}

// Imagen que se muestra: la miniatura ligera si existe, si no el original
export const emblemSrc = e => (e ? e.thumb || e.url : null)

// Caché de imágenes ya descargadas y decodificadas (una promesa por URL)
const imageCache = new Map()
export function loadImage(src) {
  if (!src) return Promise.reject(new Error('sin imagen'))
  if (!imageCache.has(src)) {
    const p = new Promise((resolve, reject) => {
      const img = new Image()
      // Necesario para usarla como textura WebGL si viene de otro origen (Commons)
      if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
    p.catch(() => imageCache.delete(src)) // reintentar la próxima vez
    imageCache.set(src, p)
  }
  return imageCache.get(src)
}

// Empezar a descargar la bandera y el escudo de un municipio (al pasar el ratón o al hacer clic)
export function preloadEmblems(id) {
  const ine = String(id || '').split('_')[0]
  const e = emblems.value[ine]
  if (!e) return
  for (const kind of ['bandera', 'escudo']) {
    const src = emblemSrc(e[kind])
    if (src) loadImage(src).catch(() => {})
  }
}
