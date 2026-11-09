// public/data/poblacion.json (censos del INE desde 1842, lo genera scripts/build-poblacion.mjs), descargado una vez
let promise = null
export function loadPoblacion() {
  if (!promise) {
    promise = fetch('/data/poblacion.json')
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
  }
  return promise
}
