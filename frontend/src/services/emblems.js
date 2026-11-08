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
