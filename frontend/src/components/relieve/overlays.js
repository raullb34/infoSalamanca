// Capas del mapa 3D encima del relieve:
//  - Pines: un palo del color del filtro con el icono del filtro arriba, en cada pueblo que colorea.
//  - Rutas del bibliobús: arcos de pueblo en pueblo con el color de la ruta (el mismo que en el 2D),
//    una esfera por parada y la de la próxima visita más grande.
// Lo usa RelieveMap.vue; las posiciones salen de byId (centroide cx/cz y altura del municipio).

const STEM = 34          // altura del palo de los pines
const PIN_SIZE = 0.036   // tamaño del icono en pantalla (fracción del alto; no crece al acercarse)
const TUBE_R = 1.1       // grosor de las rutas
const STOP_R = 2.6       // radio de las paradas
const NEXT_STOP_R = 4.8  // radio de la parada de la próxima visita
const FADED = 0.15       // opacidad de las rutas no resaltadas

// topOf(m): altura actual del municipio (sube al cargar); finalTop(m): la definitiva
export function createOverlays({ THREE, scene, byId, topOf, finalTop, requestRender }) {
  const pinsGroup = new THREE.Group()
  const routesGroup = new THREE.Group()
  scene.add(pinsGroup, routesGroup)

  const textures = new Map() // icono + color → textura (se reutilizan entre filtros)
  let pins = []
  let routeGroups = []
  let highlighted = null

  const dispose = (group) => {
    group.traverse(o => {
      o.geometry?.dispose()
      o.material?.dispose() // las texturas de los iconos se guardan aparte y se reutilizan
    })
    group.clear()
  }

  // ---------- Pines ----------
  // Icono dentro de un círculo blanco con borde del color del filtro, dibujado en un canvas
  function pinTexture(icon, color) {
    const key = `${icon}|${color}`
    if (textures.has(key)) return textures.get(key)
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const drawDisc = () => {
      ctx.clearRect(0, 0, size, size)
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.lineWidth = 9
      ctx.strokeStyle = color
      ctx.stroke()
    }
    drawDisc()
    const img = new Image()
    img.onload = () => {
      drawDisc()
      const box = 74
      const k = Math.min(box / (img.naturalWidth || box), box / (img.naturalHeight || box))
      const w = (img.naturalWidth || box) * k, h = (img.naturalHeight || box) * k
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      tex.needsUpdate = true
      requestRender()
    }
    img.src = icon
    textures.set(key, tex)
    return tex
  }

  // highlights: { ine: color }; icon: ruta del icono del filtro activo (o null)
  function setPins(highlights = {}, icon = null) {
    dispose(pinsGroup)
    pins = []
    if (!icon) return requestRender()
    for (const [ine, color] of Object.entries(highlights)) {
      const m = byId[ine]
      if (!m) continue
      const pin = new THREE.Group()
      pin.position.set(m.cx, topOf(m), m.cz)
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, STEM, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
      )
      stem.position.y = STEM / 2
      stem.castShadow = true
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTexture(icon, color), depthWrite: false, sizeAttenuation: false }))
      sprite.scale.set(PIN_SIZE, PIN_SIZE, 1)
      sprite.center.set(0.5, 0.05) // el icono se apoya en la punta del palo
      sprite.position.y = STEM
      sprite.userData.m = m
      stem.userData.m = m
      pin.add(stem, sprite)
      pin.userData.m = m
      pinsGroup.add(pin)
      pins.push(pin)
    }
    highlightRoute(highlighted)
  }

  // Los pines siguen al relieve mientras sube (animación inicial)
  function update() {
    for (const pin of pins) pin.position.y = topOf(pin.userData.m)
  }

  // ---------- Rutas ----------
  function setRoutes(routes = []) {
    dispose(routesGroup)
    routeGroups = []
    for (const route of routes) {
      // Pueblos de la ruta en orden de visita, cada uno una vez
      const stops = []
      for (const s of route.stops) {
        const m = s.cod_ine && byId[String(s.cod_ine)]
        if (m && !stops.includes(m)) stops.push(m)
      }
      if (!stops.length) continue
      const g = new THREE.Group()
      g.userData.ruta = route.ruta
      const mat = new THREE.MeshStandardMaterial({ color: route.color, roughness: 0.45, emissive: route.color, emissiveIntensity: 0.25, transparent: true })
      const point = (m) => new THREE.Vector3(m.cx, finalTop(m) + 1.5, m.cz)
      for (let i = 0; i < stops.length - 1; i++) {
        const a = point(stops[i]), b = point(stops[i + 1])
        // Arco: el punto medio sube según la distancia, para que se vea por encima del relieve
        const mid = a.clone().add(b).multiplyScalar(0.5)
        mid.y = Math.max(a.y, b.y) + 6 + a.distanceTo(b) * 0.22
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, TUBE_R, 6, false), mat)
        tube.userData.ruta = route.ruta
        g.add(tube)
      }
      const nextIne = route.nextStop?.cod_ine ? String(route.nextStop.cod_ine) : null
      for (const m of stops) {
        const isNext = m.id === nextIne
        const dot = new THREE.Mesh(new THREE.SphereGeometry(isNext ? NEXT_STOP_R : STOP_R, 16, 12), mat)
        dot.position.copy(point(m))
        dot.castShadow = true
        dot.userData.ruta = route.ruta
        dot.userData.m = m
        g.add(dot)
      }
      routesGroup.add(g)
      routeGroups.push(g)
    }
    highlightRoute(highlighted)
  }

  // Resaltar una ruta y atenuar las demás (null: todas normales)
  function highlightRoute(key) {
    highlighted = routeGroups.some(g => g.userData.ruta === key) ? key : null
    for (const g of routeGroups) {
      const on = !highlighted || g.userData.ruta === highlighted
      g.children[0].material.opacity = on ? 1 : FADED
      g.children[0].material.depthWrite = on
      g.renderOrder = on ? 1 : 0
    }
    // Con una ruta resaltada, los pines se atenúan para que se vean sus paradas (como en el 2D)
    for (const pin of pins) pin.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = highlighted ? 0.3 : 1 } })
    requestRender()
  }

  // Centro y tamaño de una ruta, para encuadrarla con la cámara
  function routeBounds(key) {
    const g = routeGroups.find(r => r.userData.ruta === key)
    if (!g) return null
    const box = new THREE.Box3().setFromObject(g)
    const c = box.getCenter(new THREE.Vector3())
    const s = box.getSize(new THREE.Vector3())
    return { x: c.x, y: c.y, z: c.z, size: Math.max(s.x, s.z) }
  }

  // Objetos que se pueden tocar: paradas, tramos de ruta y pines
  const pickables = () => [...routesGroup.children.flatMap(g => g.children), ...pinsGroup.children.flatMap(p => p.children)]

  function destroy() {
    dispose(pinsGroup)
    dispose(routesGroup)
    textures.forEach(t => t.dispose())
    textures.clear()
  }

  return { setPins, setRoutes, highlightRoute, routeBounds, pickables, update, destroy }
}
