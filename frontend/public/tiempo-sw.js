// Service worker de /tiempo.html (el tiempo de un pueblo instalado en el móvil). Solo para esa página:
//  - la página y sus iconos se guardan para abrir sin conexión;
//  - la predicción va siempre a la red y, si no hay, se sirve la última guardada (con la cabecera x-offline: 1
//    para que la página lo diga).
// v2: la v1 se quedaba con predicciones viejas (sin modelos ni horas por día); al cambiar el nombre se borra
const CACHE = 'tiempo-v2'
const SHELL = ['/tiempo.html', '/icons/tiempo-192.png', '/icons/tiempo-180.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tiempo-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

async function networkFirst(request, { markOffline = false } = {}) {
  const cache = await caches.open(CACHE)
  try {
    // Siempre a la red (revalidando la caché del navegador): lo guardado solo sirve sin conexión
    const res = await fetch(request, { cache: 'no-cache' })
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: !markOffline })
    if (!hit) throw err
    if (!markOffline) return hit
    const headers = new Headers(hit.headers)
    headers.set('x-offline', '1')
    return new Response(await hit.blob(), { status: hit.status, headers })
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname === '/tiempo.html') e.respondWith(networkFirst(e.request))
  else if (/^\/api\/v1\/weather\/municipalities\/[^/]+\/widget$/.test(url.pathname)) e.respondWith(networkFirst(e.request, { markOffline: true }))
})
