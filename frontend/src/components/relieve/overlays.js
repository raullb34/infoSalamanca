// Capas del mapa 3D encima del relieve:
//  - Pines: un palo del color del filtro con el icono del filtro arriba, en cada pueblo que colorea.
//  - Estaciones meteorológicas: un palo fino con una etiqueta (forma de la red + temperatura).
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
  const stationsGroup = new THREE.Group()
  scene.add(pinsGroup, routesGroup, stationsGroup)
  let stationPins = []

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
    for (const pin of stationPins) if (pin.userData.m) pin.position.y = topOf(pin.userData.m)
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

  // ---------- Estaciones meteorológicas ----------
  // Etiqueta en un canvas: forma de la red (círculo, cuadrado, rombo) y la temperatura sobre el color de su tramo.
  // Sin dato reciente: blanca con borde gris discontinuo y "—".
  function stationTexture({ shape, color, ink, text, stale, dark }) {
    const W = 168, H = 84
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    const r = 22
    ctx.beginPath()
    ctx.roundRect(5, 5, W - 10, H - 10, r)
    ctx.fillStyle = stale ? (dark ? '#1f262e' : '#ffffff') : color
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = stale ? '#7a858f' : (dark ? '#eef2f6' : '#16202a')
    if (stale) ctx.setLineDash([10, 7])
    ctx.stroke()
    ctx.setLineDash([])
    const fg = stale ? (dark ? '#c8d0d8' : '#5b6670') : ink
    // forma de la red
    const sx = 40, sy = H / 2, sr = 14
    ctx.beginPath()
    if (shape === 'square') ctx.rect(sx - sr, sy - sr, sr * 2, sr * 2)
    else if (shape === 'diamond') { ctx.moveTo(sx, sy - sr * 1.3); ctx.lineTo(sx + sr * 1.3, sy); ctx.lineTo(sx, sy + sr * 1.3); ctx.lineTo(sx - sr * 1.3, sy); ctx.closePath() }
    else ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.lineWidth = 5
    ctx.strokeStyle = fg
    ctx.stroke()
    ctx.fillStyle = fg
    ctx.font = '700 40px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 108, sy + 2)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  // stations: [{ station, x, z, m, label: {shape,color,ink,text,stale,dark} }] ya proyectadas por RelieveMap
  function setStations(items = []) {
    stationsGroup.traverse(o => { o.material?.map?.dispose() })
    dispose(stationsGroup)
    stationPins = []
    for (const it of items) {
      const pin = new THREE.Group()
      pin.position.set(it.x, it.m ? topOf(it.m) : 0, it.z)
      const stemH = STEM * 0.7
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, stemH, 6),
        new THREE.MeshStandardMaterial({ color: it.label.stale ? 0x7a858f : 0x16202a, roughness: 0.6 })
      )
      stem.position.y = stemH / 2
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: stationTexture(it.label), depthWrite: false, sizeAttenuation: false }))
      const k = it.label.stale ? 0.55 : 0.75 // sin dato reciente, más pequeña: pesa menos a la vista
      sprite.scale.set(PIN_SIZE * 2 * k, PIN_SIZE * k, 1)
      sprite.center.set(0.5, 0)
      sprite.position.y = stemH
      sprite.renderOrder = it.label.stale ? 1 : 2
      stem.userData.station = sprite.userData.station = it.station
      pin.add(stem, sprite)
      pin.userData.m = it.m
      stationsGroup.add(pin)
      stationPins.push(pin)
    }
    requestRender()
  }

  // Objetos que se pueden tocar: paradas, tramos de ruta, pines y estaciones
  const pickables = () => [
    ...stationsGroup.children.flatMap(p => p.children),
    ...routesGroup.children.flatMap(g => g.children), ...pinsGroup.children.flatMap(p => p.children)
  ]

  function destroy() {
    dispose(pinsGroup)
    dispose(routesGroup)
    stationsGroup.traverse(o => { o.material?.map?.dispose() })
    dispose(stationsGroup)
    textures.forEach(t => t.dispose())
    textures.clear()
  }

  return { setPins, setStations, setRoutes, highlightRoute, routeBounds, pickables, update, destroy }
}
