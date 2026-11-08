// Zoom y desplazamiento para el mapa SVG, cambiando su viewBox.
// - Móvil: pellizco para hacer zoom y un dedo para moverse (solo con zoom).
// - Escritorio: rueda del ratón para zoom y arrastrar para moverse.
// - Doble toque / doble clic: vuelve a la vista completa.
// Si el gesto ha movido el mapa, se anula el "click" para no seleccionar un pueblo sin querer.

const MAX_ZOOM = 8
const DRAG_THRESHOLD = 6 // px antes de considerar que es un arrastre
const BASE_STROKE = 1.5 // stroke-width de los municipios en Limites_salamanca.svg
export const ROUTE_STOP_R = 4 // radio de los puntos de parada del bibliobús (unidades del SVG sin zoom)
export const NEXT_STOP_SCALE = 1.9 // la parada de la próxima visita, más gorda

// Devuelve { zoomBy(k), reset() } para los botones [+] [−] [⟲]
export function enableSvgPanZoom(svg) {
  if (!svg) return null
  if (svg.__panZoom) return svg.__panZoom

  const vb = svg.viewBox.baseVal
  const base = { x: vb.x, y: vb.y, w: vb.width, h: vb.height }
  if (!base.w || !base.h) return

  svg.style.touchAction = 'none'
  const strokeStyle = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'style')
  svg.appendChild(strokeStyle)

  const pointers = new Map()
  let gesture = null
  let suppressClick = false
  let lastTap = 0

  const setView = (x, y, w) => {
    w = Math.min(base.w, Math.max(base.w / MAX_ZOOM, w))
    const h = w * (base.h / base.w)
    x = Math.min(base.x + base.w - w, Math.max(base.x, x))
    y = Math.min(base.y + base.h - h, Math.max(base.y, y))
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
    // Bordes de municipio con el mismo grosor en pantalla a cualquier zoom
    // (y las paradas del bibliobús con el mismo tamaño; sus líneas usan non-scaling-stroke)
    const k = w / base.w
    strokeStyle.textContent = `path { stroke-width: ${BASE_STROKE * k} !important; } .route-stop { r: ${ROUTE_STOP_R * k}px; } .route-stop.next-stop { r: ${ROUTE_STOP_R * NEXT_STOP_SCALE * k}px; }` +
      // Iconos de biblioteca con el mismo tamaño en pantalla (escalan desde su base, que marca el pueblo)
      ` #library-markers image { transform-box: fill-box; transform-origin: 50% 100%; transform: scale(${k}); }`
  }

  // Mapa pantalla → SVG: svgX = originX_svg + (clientX - e) / a
  const snapshot = () => {
    const m = svg.getScreenCTM()
    return { x: vb.x, y: vb.y, w: vb.width, ctm: { a: m.a, d: m.d, e: m.e, f: m.f } }
  }
  const toSvg = (snap, cx, cy) => ({
    x: (cx - snap.ctm.e) / snap.ctm.a,
    y: (cy - snap.ctm.f) / snap.ctm.d
  })

  // Hace zoom con factor k (<1 acerca) manteniendo fijo el punto (cx, cy) de la pantalla
  const zoomAround = (snap, anchor, cx, cy, k) => {
    const newW = Math.min(base.w, Math.max(base.w / MAX_ZOOM, snap.w * k))
    const kk = newW / snap.w
    // Unidades SVG por px tras el zoom; el origen en pantalla (e, f) no cambia porque el aspecto es el mismo
    const upp = kk / snap.ctm.a
    setView(anchor.x - (cx - snap.ctm.e) * upp, anchor.y - (cy - snap.ctm.f) * (kk / snap.ctm.d), newW)
  }

  const startGesture = () => {
    const pts = [...pointers.values()]
    const snap = snapshot()
    if (pts.length >= 2) {
      const [p1, p2] = pts
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      gesture = { type: 'pinch', snap, dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), anchor: toSvg(snap, mid.x, mid.y) }
    } else if (pts.length === 1) {
      gesture = { type: 'pan', snap, start: { ...pts[0] }, moved: false }
    } else {
      gesture = null
    }
  }

  svg.addEventListener('pointerdown', (ev) => {
    // Gesto nuevo: olvidar el bloqueo de un pellizco anterior (tras un pellizco no siempre llega click)
    if (pointers.size === 0) suppressClick = false
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    startGesture()
  })

  svg.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId) || !gesture) return
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    const pts = [...pointers.values()]

    if (gesture.type === 'pinch' && pts.length >= 2) {
      const [p1, p2] = pts
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      if (!dist) return
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      zoomAround(gesture.snap, gesture.anchor, mid.x, mid.y, gesture.dist / dist)
      suppressClick = true
    } else if (gesture.type === 'pan') {
      const dx = ev.clientX - gesture.start.x
      const dy = ev.clientY - gesture.start.y
      if (!gesture.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      gesture.moved = true
      if (gesture.snap.w >= base.w) return // sin zoom no hay nada que mover
      suppressClick = true
      const s = gesture.snap
      setView(s.x - dx / s.ctm.a, s.y - dy / s.ctm.d, s.w)
    }
  })

  const endPointer = (ev) => {
    pointers.delete(ev.pointerId)
    startGesture()
  }
  svg.addEventListener('pointerup', endPointer)
  svg.addEventListener('pointercancel', endPointer)

  // Anular el click que llega tras un arrastre o un pellizco
  svg.addEventListener('click', (ev) => {
    if (suppressClick) {
      ev.stopPropagation()
      ev.preventDefault()
      suppressClick = false
      return
    }
    // Doble toque o doble clic: vista completa
    const now = Date.now()
    if (now - lastTap < 300 && vb.width < base.w) {
      setView(base.x, base.y, base.w)
    }
    lastTap = now
  }, true)

  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault()
    const snap = snapshot()
    const k = ev.deltaY > 0 ? 1.2 : 1 / 1.2
    zoomAround(snap, toSvg(snap, ev.clientX, ev.clientY), ev.clientX, ev.clientY, k)
  }, { passive: false })

  // Zoom desde los botones: alrededor del centro de la vista actual (k < 1 acerca)
  const api = {
    zoomBy(k) {
      const w = vb.width * k
      const cx = vb.x + vb.width / 2, cy = vb.y + vb.height / 2
      setView(cx - w / 2, cy - (w * base.h / base.w) / 2, w)
    },
    reset() {
      setView(base.x, base.y, base.w)
    },
    // Encuadra un rectángulo del SVG (p. ej. una ruta del bibliobús) con margen y una transición corta
    fitTo({ x, y, width, height }, { padding = 2, maxZoom = 2.5 } = {}) {
      const aspect = base.h / base.w
      let w = Math.max(width, height / aspect) * padding
      w = Math.min(base.w, Math.max(base.w / maxZoom, w))
      const h = w * aspect
      const to = { x: x + width / 2 - w / 2, y: y + height / 2 - h / 2, w }
      const from = { x: vb.x, y: vb.y, w: vb.width }
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (reduce) return setView(to.x, to.y, to.w)
      const t0 = performance.now()
      const step = (now) => {
        const t = Math.min(1, (now - t0) / 450)
        const e = 1 - Math.pow(1 - t, 3) // ease-out
        setView(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, from.w + (to.w - from.w) * e)
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
  }
  svg.__panZoom = api
  return api
}
