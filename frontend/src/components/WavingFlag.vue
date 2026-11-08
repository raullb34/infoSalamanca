<template>
  <figure class="waving-flag" :class="{ 'no-flag': !flag }">
    <div class="cloth-area">
      <span class="pole" aria-hidden="true"></span>
      <canvas v-show="webgl" ref="canvas" class="cloth" role="img" :aria-label="label"></canvas>
      <!-- Sin WebGL (o imagen que no se puede usar como textura): imagen fija -->
      <template v-if="!webgl">
        <img v-if="flag" :src="flag" :alt="label" class="cloth static" />
        <div v-else class="cloth static neutral">
          <img v-if="shield" :src="shield" alt="" />
        </div>
      </template>
    </div>
    <figcaption v-if="caption" class="flag-caption">{{ caption }}</figcaption>
  </figure>
</template>

<script>
// Bandera ondeando con WebGL (sin librerías). Si no hay bandera, el escudo sobre una tela neutra.
// Con "reducir movimiento" la tela se queda quieta. Sin WebGL, imagen fija.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const COLS = 24
const ROWS = 12
const NEUTRAL = '#efe8d8'

const VERT = `
attribute vec2 aPos;
uniform float uTime, uAmp, uAspect;
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = vec2(aPos.x, 1.0 - aPos.y);
  float x = aPos.x;
  // La onda crece desde el mástil (x = 0) hacia el extremo
  float phase = x * 7.0 - uTime * 3.0 + aPos.y * 1.5;
  float w = sin(phase) * uAmp * x;
  vShade = 0.86 + 0.14 * cos(phase) * min(1.0, x * 3.0);
  vec2 p = vec2(x, aPos.y + w * 0.6 - x * uAmp * 0.25);
  // Espacio de recorte: margen para la onda
  gl_Position = vec4(p.x * 1.9 - 0.99, (p.y * 2.0 - 1.0) * 0.84, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUv;
varying float vShade;
void main() {
  vec4 c = texture2D(uTex, vUv);
  gl_FragColor = vec4(c.rgb * vShade, c.a);
}`

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Necesario para usar como textura imágenes de otro origen (Commons)
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default {
  name: 'WavingFlag',
  props: {
    flag: { type: String, default: null },
    shield: { type: String, default: null },
    // 'oficial-sin-imagen' | 'sin-oficial' | null
    status: { type: String, default: null },
    townName: { type: String, default: '' }
  },
  setup(props) {
    const canvas = ref(null)
    const webgl = ref(true)
    let gl = null, prog = null, tex = null, raf = 0, visible = true, observer = null
    let uTime = null, uAmp = null, indexCount = 0, start = performance.now()
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const label = computed(() => props.flag
      ? `Bandera de ${props.townName}`
      : `Escudo de ${props.townName} sobre tela neutra`)
    const caption = computed(() => {
      if (props.flag) return ''
      if (props.status === 'oficial-sin-imagen') return 'Bandera oficial sin imagen todavía'
      if (props.status === 'sin-oficial') return 'Sin bandera oficial conocida'
      return 'Sin bandera en nuestros datos'
    })

    const initGl = () => {
      gl = canvas.value?.getContext('webgl', { premultipliedAlpha: false, alpha: true })
      if (!gl) return false
      const sh = (type, src) => {
        const s = gl.createShader(type)
        gl.shaderSource(s, src)
        gl.compileShader(s)
        return s
      }
      prog = gl.createProgram()
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false
      gl.useProgram(prog)

      // Malla de la tela: COLS x ROWS cuadros
      const verts = []
      for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) verts.push(c / COLS, r / ROWS)
      const idx = []
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const a = r * (COLS + 1) + c, b = a + 1, d = a + COLS + 1, e = d + 1
        idx.push(a, b, d, b, e, d)
      }
      indexCount = idx.length
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW)
      const aPos = gl.getAttribLocation(prog, 'aPos')
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW)

      uTime = gl.getUniformLocation(prog, 'uTime')
      uAmp = gl.getUniformLocation(prog, 'uAmp')
      gl.uniform1f(uAmp, reduceMotion ? 0.02 : 0.07)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      tex = gl.createTexture()
      return true
    }

    // Dibuja la bandera (o el escudo sobre tela neutra) en un canvas 2D y lo sube como textura
    const buildTexture = async () => {
      const W = 384, H = 256
      const c2 = document.createElement('canvas')
      c2.width = W
      c2.height = H
      const ctx = c2.getContext('2d')
      if (props.flag) {
        const img = await loadImage(props.flag)
        ctx.drawImage(img, 0, 0, W, H)
      } else {
        ctx.fillStyle = NEUTRAL
        ctx.fillRect(0, 0, W, H)
        if (props.shield) {
          const img = await loadImage(props.shield)
          const ar = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 0.8
          const h = H * 0.72, w = h * ar
          ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, tex)
      // Lanza SecurityError si la imagen es de otro origen sin CORS
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c2)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }

    const resize = () => {
      const cv = canvas.value
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr)
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h }
      gl.viewport(0, 0, cv.width, cv.height)
    }

    const draw = () => {
      resize()
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(uTime, reduceMotion ? 0.6 : (performance.now() - start) / 1000)
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0)
    }

    const loop = () => {
      raf = 0
      if (!gl || !visible || document.hidden) return
      draw()
      if (!reduceMotion) raf = requestAnimationFrame(loop)
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop) }

    const refresh = async () => {
      if (!props.flag && !props.shield) { webgl.value = false; return }
      if (!gl && !initGl()) { webgl.value = false; return }
      try {
        await buildTexture()
        webgl.value = true
        kick()
      } catch (err) {
        // Imagen que no se puede usar como textura (CORS) o que no carga: imagen fija
        webgl.value = false
      }
    }

    onMounted(() => {
      observer = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick() })
      observer.observe(canvas.value)
      document.addEventListener('visibilitychange', kick)
      refresh()
    })
    onBeforeUnmount(() => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', kick)
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    })
    watch(() => [props.flag, props.shield], refresh)

    return { canvas, webgl, label, caption }
  }
}
</script>

<style scoped>
.waving-flag {
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cloth-area {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2.3;
  padding-left: 4px;
}

.pole {
  position: absolute;
  left: 0;
  top: 6%;
  bottom: -12%;
  width: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, #8a8a8a, #d9d9d9 50%, #7a7a7a);
}

.cloth {
  display: block;
  width: 100%;
  height: 100%;
}

.cloth.static {
  object-fit: contain;
  object-position: left top;
  height: 80%;
}

.cloth.static.neutral {
  background: #efe8d8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cloth.static.neutral img {
  height: 72%;
}

.flag-caption {
  margin-top: 6px;
  font-size: 0.62rem;
  line-height: 1.2;
  text-align: center;
  color: var(--text-muted);
}
</style>
