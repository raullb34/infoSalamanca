<template>
  <div ref="container" class="relieve-container">
    <canvas ref="canvas" class="relieve-canvas" aria-label="Mapa 3D de la provincia de Salamanca: cada municipio tiene la altura de su altitud real"></canvas>

    <div v-if="hover" class="relieve-hover" :style="{ left: hover.x + 'px', top: hover.y + 'px' }">
      <strong>{{ hover.name }}</strong>
      <span>{{ formatNumber(hover.alt) }} m · {{ formatNumber(hover.pop) }} hab.</span>
    </div>

    <div class="relieve-legend" aria-hidden="true">
      <span>Altitud</span>
      <div class="legend-bar" :style="{ background: legendGradient }"></div>
      <div class="legend-labels"><span>500 m</span><span>1.250 m</span></div>
    </div>

    <p class="relieve-help">Arrastra para girar · rueda o pellizco para acercar · toca un pueblo para abrir su ficha</p>

    <div v-if="loading" class="relieve-loading">Cargando el relieve…</div>
    <div v-if="error" class="relieve-loading">{{ error }}</div>
  </div>
</template>

<script>
// Mapa 3D: cada municipio extruido según su altitud real (datos: public/data/relieve.json,
// generado con scripts/build-relieve-data.py). Basado en prototipos/salamanca-en-relieve.
// Comparte la selección con el mapa 2D: emite townSelected y sigue la prop selectedId.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const ALT_LO = 500
const ALT_HI = 1250
const H_MAX = 130
// Del Duero a la sierra: arena de los Arribes, rastrojo de la meseta, robledal, granito y cumbre
const ALT_STOPS = [[0, '#b9783c'], [0.3, '#c8a65a'], [0.52, '#8f9a58'], [0.72, '#4f7350'], [0.88, '#7f8b8e'], [1, '#e8e5dc']]
const isMunicipio = id => /^37\d{3}$/.test(id || '')

export default {
  name: 'RelieveMap',
  props: {
    active: { type: Boolean, default: true },
    selectedId: { type: String, default: null }
  },
  emits: ['townSelected'],
  setup(props, { emit }) {
    const container = ref(null)
    const canvas = ref(null)
    const loading = ref(true)
    const error = ref('')
    const hover = ref(null)
    const legendGradient = 'linear-gradient(90deg,' + ALT_STOPS.map(([t, c]) => `${c} ${t * 100}%`).join(',') + ')'

    let THREE, renderer, scene, camera, raycaster, resizeObserver
    let meshes = []
    const byId = {}
    let active = null
    let raf = 0
    const tweens = []
    const cam = { tx: 0, ty: 0, tz: 20, r: 900, theta: -0.2, phi: 0.95 }

    const formatNumber = n => (n == null ? '—' : Math.round(n).toLocaleString('es-ES'))
    const hAlt = m => 1.5 + Math.max(0, (m.alt - ALT_LO) / (ALT_HI - ALT_LO)) * H_MAX

    // ---------- Render bajo demanda ----------
    const requestRender = () => { if (!raf && props.active) raf = requestAnimationFrame(frame) }
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    function tween(obj, to, duration, onUpdate) {
      // Sustituir animaciones previas del mismo objeto
      for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj) tweens.splice(i, 1)
      const from = {}
      for (const k of Object.keys(to)) from[k] = obj[k]
      tweens.push({ obj, from, to, start: performance.now(), duration: duration * 1000, onUpdate })
      requestRender()
    }
    function frame(now) {
      raf = 0
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]
        const t = Math.min(1, (now - tw.start) / tw.duration)
        const k = ease(t)
        for (const key of Object.keys(tw.to)) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * k
        tw.onUpdate?.()
        if (t >= 1) tweens.splice(i, 1)
      }
      applyCam()
      renderer.render(scene, camera)
      if (tweens.length) requestRender()
    }

    function applyCam() {
      const sp = Math.sin(cam.phi)
      camera.position.set(cam.tx + cam.r * sp * Math.sin(cam.theta), cam.ty + cam.r * Math.cos(cam.phi), cam.tz + cam.r * sp * Math.cos(cam.theta))
      camera.lookAt(cam.tx, cam.ty, cam.tz)
    }

    // Distancia para que la provincia quepa entera según la forma de la pantalla
    let overview = { tx: 0, ty: 0, tz: 20, r: 900, theta: -0.2, phi: 0.95 }
    function fitOverview() {
      const aspect = camera.aspect || 1.5
      // En vertical (móvil) se acerca un poco más y se mira más desde arriba: los bordes pueden quedar justos
      const portrait = aspect < 1
      overview = { tx: 0, ty: 0, tz: 20, r: (portrait ? 800 : 940) * Math.max(1, 1.45 / aspect), theta: portrait ? 0 : -0.2, phi: portrait ? 0.7 : 0.95 }
    }

    // ---------- Selección ----------
    function highlight(m) {
      if (active?.mesh) tween(active.mesh.material.emissive, { r: 0, g: 0, b: 0 }, 0.5)
      active = m
      if (m?.mesh) tween(m.mesh.material.emissive, { r: 0.45, g: 0.28, b: 0.06 }, 0.5)
    }
    function flyTo(id) {
      const m = byId[id]
      if (!m) return
      highlight(m)
      tween(cam, { tx: m.cx, ty: hAlt(m) * 0.5, tz: m.cz, r: Math.min(cam.r, id === '37274' ? 520 : 440) }, 1.6)
    }

    // ---------- Construcción de la escena ----------
    async function build() {
      THREE = await import('three')
      const munis = await (await fetch('/data/relieve.json')).json()

      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true })
      } catch (e) {
        throw new Error('Tu navegador no puede mostrar el mapa 3D (WebGL desactivado).')
      }
      const narrow = window.matchMedia('(max-width: 767px)').matches
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 1.75))
      renderer.shadowMap.enabled = !narrow // las sombras pesan demasiado en móviles modestos
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(38, 1, 1, 5000)
      raycaster = new THREE.Raycaster()

      // Luz de atardecer: sol bajo desde el suroeste.
      // three r155+ usa luces físicas: las intensidades del prototipo (r128) van multiplicadas por π
      scene.add(new THREE.HemisphereLight(0xfff0d8, 0x3a3f4a, 0.75 * Math.PI))
      const sun = new THREE.DirectionalLight(0xffe2b8, 1.1 * Math.PI)
      sun.position.set(-320, 260, 260)
      sun.castShadow = true
      sun.shadow.mapSize.set(2048, 2048)
      Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 10, far: 1200 })
      sun.shadow.bias = -0.0015
      scene.add(sun)
      const fill = new THREE.DirectionalLight(0x8fa6d6, 0.35 * Math.PI)
      fill.position.set(300, 180, -200)
      scene.add(fill)

      // Centrar y calcular el centroide de cada municipio
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity
      for (const m of munis) for (const r of m.rings) for (let i = 0; i < r.length; i += 2) {
        minx = Math.min(minx, r[i]); maxx = Math.max(maxx, r[i]); miny = Math.min(miny, r[i + 1]); maxy = Math.max(maxy, r[i + 1])
      }
      const cx0 = (minx + maxx) / 2, cy0 = (miny + maxy) / 2
      for (const m of munis) {
        let sx = 0, sy = 0, n = 0
        for (const r of m.rings) for (let i = 0; i < r.length; i += 2) { sx += r[i]; sy += r[i + 1]; n++ }
        m.cx = sx / n - cx0
        m.cz = sy / n - cy0
      }
      // Altitud de las piezas sin datos: media de los 4 vecinos más cercanos
      const withAlt = munis.filter(m => m.alt)
      for (const m of munis.filter(m => !m.alt)) {
        const near = withAlt.map(o => [Math.hypot(o.cx - m.cx, o.cz - m.cz), o.alt]).sort((a, b) => a[0] - b[0]).slice(0, 4)
        m.alt = near.reduce((s, x) => s + x[1], 0) / near.length
      }

      const ramp = t => {
        t = Math.min(1, Math.max(0, t))
        for (let i = 1; i < ALT_STOPS.length; i++) {
          if (t <= ALT_STOPS[i][0]) {
            const [t0, c0] = ALT_STOPS[i - 1], [t1, c1] = ALT_STOPS[i]
            return new THREE.Color(c0).lerp(new THREE.Color(c1), (t - t0) / (t1 - t0))
          }
        }
        return new THREE.Color(ALT_STOPS[ALT_STOPS.length - 1][1])
      }

      const group = new THREE.Group()
      scene.add(group)
      const lineMat = new THREE.LineBasicMaterial({ color: 0x14110c, transparent: true, opacity: 0.38 })
      for (const m of munis) {
        const shapes = m.rings.map(r => {
          const s = new THREE.Shape()
          for (let i = 0; i < r.length; i += 2) {
            const x = r[i] - cx0, y = -(r[i + 1] - cy0)
            i ? s.lineTo(x, y) : s.moveTo(x, y)
          }
          return s
        })
        const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false })
        geo.rotateX(-Math.PI / 2)
        const color = isMunicipio(m.id) ? ramp((m.alt - ALT_LO) / (ALT_HI - ALT_LO)) : new THREE.Color(0x9a9a92)
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, flatShading: true, emissive: 0x000000 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = mesh.receiveShadow = true
        mesh.userData.m = m
        m.mesh = mesh
        for (const r of m.rings) {
          const pts = []
          for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector3(r[i] - cx0, 1.002, r[i + 1] - cy0))
          pts.push(pts[0].clone())
          mesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat))
        }
        mesh.scale.y = 0.15
        group.add(mesh)
        meshes.push(mesh)
        if (isMunicipio(m.id)) byId[m.id] = m
      }
      // Suelo invisible que solo recoge la sombra del relieve
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.ShadowMaterial({ opacity: 0.25 }))
      ground.rotation.x = -Math.PI / 2
      ground.position.y = -0.05
      ground.receiveShadow = true
      scene.add(ground)

      resize()
      fitOverview()
      Object.assign(cam, overview)

      // Subida inicial del relieve, desde el centro hacia fuera
      for (const mesh of meshes) {
        const m = mesh.userData.m
        const delay = 0.15 + Math.hypot(m.cx, m.cz) / 520
        setTimeout(() => tween(mesh.scale, { y: hAlt(m) }, 1.4), delay * 1000)
      }
      if (props.selectedId) setTimeout(() => flyTo(props.selectedId), 900)
      requestRender()
    }

    function resize() {
      if (!renderer) return
      const { clientWidth: w, clientHeight: h } = container.value
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      requestRender()
    }

    // ---------- Gestos: girar, acercar, desplazar y tocar ----------
    const pointers = new Map()
    let gesture = null
    let moved = false

    function pick(clientX, clientY) {
      const rect = canvas.value.getBoundingClientRect()
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(meshes, false)[0]
      return hit?.object.userData.m || null
    }

    function pan(dx, dy) {
      // Mover el punto de mira sobre el suelo, en el sentido de la pantalla
      const k = cam.r / 900
      const c = Math.cos(cam.theta), s = Math.sin(cam.theta)
      cam.tx -= (dx * c + dy * s) * k
      cam.tz -= (-dx * s + dy * c) * k
      cam.tx = Math.max(-450, Math.min(450, cam.tx))
      cam.tz = Math.max(-400, Math.min(400, cam.tz))
    }

    function onPointerDown(ev) {
      canvas.value.setPointerCapture(ev.pointerId)
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      if (pointers.size === 1) moved = false
      startGesture(ev)
      tweens.splice(0, tweens.length, ...tweens.filter(t => t.obj !== cam)) // el usuario manda: parar vuelos
    }
    function startGesture(ev) {
      const pts = [...pointers.values()]
      if (pts.length >= 2) {
        const [a, b] = pts
        gesture = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), r: cam.r, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
      } else if (pts.length === 1) {
        const panMode = ev && (ev.button === 2 || ev.shiftKey || ev.ctrlKey)
        gesture = { type: panMode ? 'pan' : 'rotate', last: { ...pts[0] } }
      } else gesture = null
    }
    function onPointerMove(ev) {
      if (!pointers.has(ev.pointerId)) {
        if (ev.pointerType === 'mouse') updateHover(ev)
        return
      }
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      if (!gesture) return
      if (gesture.type === 'pinch') {
        const [a, b] = [...pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (dist) cam.r = Math.max(180, Math.min(1800, gesture.r * gesture.dist / dist))
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        pan(mid.x - gesture.mid.x, mid.y - gesture.mid.y)
        gesture.mid = mid
        moved = true
      } else {
        const dx = ev.clientX - gesture.last.x, dy = ev.clientY - gesture.last.y
        if (!moved && Math.hypot(dx, dy) < 5) return
        moved = true
        if (gesture.type === 'pan') pan(dx, dy)
        else {
          cam.theta -= dx * 0.005
          cam.phi = Math.max(0.3, Math.min(1.35, cam.phi - dy * 0.004))
        }
        gesture.last = { x: ev.clientX, y: ev.clientY }
      }
      hover.value = null
      requestRender()
    }
    function onPointerUp(ev) {
      const wasTap = pointers.size === 1 && !moved
      pointers.delete(ev.pointerId)
      startGesture()
      if (wasTap) {
        const m = pick(ev.clientX, ev.clientY)
        if (m && isMunicipio(m.id)) {
          flyTo(m.id)
          emit('townSelected', { id: m.id, name: m.name })
        }
      }
    }
    function onWheel(ev) {
      ev.preventDefault()
      cam.r = Math.max(180, Math.min(1800, cam.r * (ev.deltaY > 0 ? 1.12 : 1 / 1.12)))
      requestRender()
    }

    let hoverMesh = null
    let lastHover = 0
    function updateHover(ev) {
      const now = performance.now()
      if (now - lastHover < 50) return
      lastHover = now
      const m = pick(ev.clientX, ev.clientY)
      const mesh = m && isMunicipio(m.id) ? m.mesh : null
      if (mesh !== hoverMesh) {
        if (hoverMesh && hoverMesh.userData.m !== active) tween(hoverMesh.material.emissive, { r: 0, g: 0, b: 0 }, 0.2)
        if (mesh && m !== active) tween(mesh.material.emissive, { r: 0.12, g: 0.12, b: 0.12 }, 0.2)
        hoverMesh = mesh
      }
      const rect = container.value.getBoundingClientRect()
      hover.value = mesh ? { name: m.name, alt: m.alt, pop: m.pop, x: ev.clientX - rect.left + 14, y: ev.clientY - rect.top + 14 } : null
      canvas.value.style.cursor = mesh ? 'pointer' : 'grab'
    }

    // ---------- Ciclo de vida ----------
    onMounted(async () => {
      try {
        await build()
      } catch (e) {
        console.error('RelieveMap:', e)
        error.value = e.message || 'No se pudo cargar el mapa 3D.'
      } finally {
        loading.value = false
      }
      const cv = canvas.value
      cv.addEventListener('pointerdown', onPointerDown)
      cv.addEventListener('pointermove', onPointerMove)
      cv.addEventListener('pointerup', onPointerUp)
      cv.addEventListener('pointercancel', onPointerUp)
      cv.addEventListener('pointerleave', () => { if (!pointers.size) hover.value = null })
      cv.addEventListener('wheel', onWheel, { passive: false })
      cv.addEventListener('contextmenu', ev => ev.preventDefault())
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container.value)
    })

    onBeforeUnmount(() => {
      cancelAnimationFrame(raf)
      resizeObserver?.disconnect()
      for (const mesh of meshes) {
        mesh.geometry.dispose()
        mesh.material.dispose()
        mesh.children.forEach(c => c.geometry?.dispose())
      }
      renderer?.dispose()
    })

    watch(() => props.selectedId, (id) => {
      if (!renderer) return
      if (id && byId[id]) {
        if (active !== byId[id]) flyTo(id)
      } else {
        highlight(null)
      }
    })
    watch(() => props.active, (on) => { if (on) { resize(); requestRender() } })

    // Botones [+] [−] [⟲] de la interfaz
    const zoomIn = () => renderer && tween(cam, { r: Math.max(180, cam.r / 1.4) }, 0.4)
    const zoomOut = () => renderer && tween(cam, { r: Math.min(2600, cam.r * 1.4) }, 0.4)
    const resetView = () => { if (renderer) { fitOverview(); tween(cam, { ...overview }, 1.2) } }

    return { container, canvas, loading, error, hover, legendGradient, formatNumber, zoomIn, zoomOut, resetView }
  }
}
</script>

<style scoped>
.relieve-container {
  position: relative;
  width: calc(100% - 690px); /* igual que el mapa 2D: 320 px de filtros + 370 px de ficha */
  height: 100vh;
  margin-left: 320px;
  margin-right: 370px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 40%, rgba(255, 240, 216, 0.35), transparent 65%),
    var(--bg-primary);
  touch-action: none;
}

.relieve-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.relieve-canvas:active {
  cursor: grabbing;
}

.relieve-hover {
  position: absolute;
  pointer-events: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
}

.relieve-hover span {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.relieve-legend {
  position: absolute;
  left: 16px;
  bottom: 100px; /* por encima de la barra de la leyenda de eventos */
  width: 160px;
  font-size: 0.7rem;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  padding: 6px 8px;
  border-radius: 8px;
}

.legend-bar {
  height: 8px;
  border-radius: 4px;
  margin: 3px 0;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
}

.relieve-help {
  position: absolute;
  left: 0;
  right: 0;
  top: 122px; /* bajo el selector 2D/3D */
  margin: 0;
  text-align: center;
  font-size: 0.72rem;
  color: var(--text-muted);
  pointer-events: none;
}

.relieve-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 0.95rem;
  pointer-events: none;
}

@media (max-width: 768px) {
  .relieve-container {
    width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .relieve-legend {
    bottom: 70px;
  }

  .relieve-help {
    top: 116px;
    padding: 0 16px;
  }
}
</style>
