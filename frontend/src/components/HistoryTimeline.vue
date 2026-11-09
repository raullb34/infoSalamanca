<template>
  <transition name="ht">
    <section
      v-if="isVisible"
      class="history-timeline"
      role="dialog"
      aria-labelledby="ht-title"
      tabindex="-1"
      @keydown.esc="closeTimeline"
    >
      <button type="button" class="ht-close" aria-label="Cerrar la línea del tiempo" @click="closeTimeline">✕</button>

      <header class="ht-header">
        <p class="ht-kicker">Línea del tiempo</p>
        <h2 id="ht-title" class="ht-title">Breve historia de la provincia de Salamanca</h2>
        <p class="ht-subtitle">Del castro vetón a capital europea de la cultura · pulsa un hito para verlo en el mapa</p>
      </header>

      <!-- Recorrido en zigzag: una fila de izquierda a derecha y la siguiente de vuelta -->
      <div ref="trackEl" class="ht-track" :class="{ 'one-col': cols === 1 }">
        <svg class="ht-path" :width="size.w" :height="size.h" aria-hidden="true">
          <path v-if="pathD" :d="pathD" class="ht-path-line" />
          <circle v-if="start" :cx="start.x" :cy="start.y" r="5" class="ht-path-start" />
          <!-- La rana de la fachada de la Universidad recorre la historia -->
          <g v-if="pathD && !reduceMotion" class="ht-frog">
            <g transform="scale(1.35) translate(-11 -9)">
              <ellipse cx="11" cy="11" rx="9" ry="6.5" class="frog-body" />
              <circle cx="6.5" cy="5" r="3" class="frog-body" />
              <circle cx="15.5" cy="5" r="3" class="frog-body" />
              <circle cx="6.5" cy="4.6" r="1.2" class="frog-eye" />
              <circle cx="15.5" cy="4.6" r="1.2" class="frog-eye" />
            </g>
            <animateMotion :dur="`${events.length * 4}s`" repeatCount="indefinite" :path="pathD" />
          </g>
        </svg>

        <div
          v-for="(row, ri) in rows"
          :key="ri"
          class="ht-row"
          :class="{ reverse: ri % 2 === 1 }"
          :style="{ '--cols': cols }"
        >
          <article
            v-for="item in row"
            :key="item.index"
            class="ht-item"
            :style="{ '--i': item.index }"
          >
            <button
              type="button"
              class="ht-node"
              :data-index="item.index"
              :disabled="!item.ine"
              :aria-label="item.ine ? `${item.title}: ver ${item.town} en el mapa` : item.title"
              @click="goTo(item)"
            >
              <span class="ht-icon">
                <!-- Ilustración (public/assets/history-icons, generadas con scripts/gen-history-icons.py);
                     si no carga, el icono SVG de reserva -->
                <img
                  v-if="!failedIcons.has(item.icon)"
                  :src="`/assets/history-icons/${item.icon}.webp`"
                  alt=""
                  width="84"
                  height="84"
                  decoding="async"
                  @error="failedIcons.add(item.icon)"
                >
                <HistoryIcons v-else :name="item.icon" />
              </span>
            </button>
            <p class="ht-year">{{ item.label || item.year }}</p>
            <h3 class="ht-item-title">{{ item.title }}</h3>
            <p class="ht-desc">{{ item.description }}</p>
            <button v-if="item.ine" type="button" class="ht-link" @click="goTo(item)">
              {{ item.town }} en el mapa →
            </button>
          </article>
        </div>
      </div>
    </section>
  </transition>
</template>

<script>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import HistoryIcons from './HistoryIcons.vue'
import HISTORIA_PROVINCIA from '@/data/historiaProvincia'

export default {
  name: 'HistoryTimeline',
  components: { HistoryIcons },
  props: {
    isVisible: { type: Boolean, default: false },
    // [{ year, label?, title, description, icon, ine?, town? }]; por defecto, la historia de la provincia
    events: { type: Array, default: () => [] }
  },
  emits: ['close', 'goToTown'],
  setup(props, { emit }) {
    const trackEl = ref(null)
    const failedIcons = reactive(new Set())
    const width = ref(0)
    const size = reactive({ w: 0, h: 0 })
    const pathD = ref('')
    const start = ref(null)
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const events = computed(() =>
      [...(props.events.length ? props.events : HISTORIA_PROVINCIA)]
        .sort((a, b) => a.year - b.year)
        .map((e, index) => ({ ...e, index })))

    // Hitos por fila según el ancho: 3, 2 o 1
    const cols = computed(() => (width.value >= 860 ? 3 : width.value >= 560 ? 2 : 1))
    const rows = computed(() => {
      const out = []
      for (let i = 0; i < events.value.length; i += cols.value) out.push(events.value.slice(i, i + cols.value))
      return out
    })

    // Camino discontinuo que une los iconos en orden: ondulado dentro de una fila y con una curva
    // en U al pasar a la siguiente (por el lado donde acaba la fila)
    const buildPath = () => {
      const track = trackEl.value
      if (!track) return
      const box = track.getBoundingClientRect()
      size.w = track.clientWidth
      size.h = track.scrollHeight
      const pts = [...track.querySelectorAll('.ht-node')]
        .sort((a, b) => a.dataset.index - b.dataset.index)
        .map(el => {
          const r = el.getBoundingClientRect()
          return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 }
        })
      if (!pts.length) { pathD.value = ''; return }
      start.value = { x: pts[0].x, y: Math.max(6, pts[0].y - 70) }
      let d = `M ${start.value.x} ${start.value.y} L ${pts[0].x} ${pts[0].y}`
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1]
        if (cols.value === 1) {
          // Una columna: el camino baja por la izquierda, junto a los iconos, con una ligera onda
          const dy = b.y - a.y
          d += ` C ${a.x + 22} ${a.y + dy / 3} ${b.x - 22} ${a.y + (2 * dy) / 3} ${b.x} ${b.y}`
        } else if (Math.abs(a.y - b.y) < 20) {
          const dx = b.x - a.x
          d += ` C ${a.x + dx / 3} ${a.y - 16} ${a.x + (2 * dx) / 3} ${a.y + 16} ${b.x} ${b.y}`
        } else {
          // Hacia fuera por el lado en que está el hito (con una columna, alternando)
          const side = cols.value === 1 ? (i % 2 ? -1 : 1) : (a.x > size.w / 2 ? 1 : -1)
          const reach = side > 0 ? Math.min(90, size.w - a.x - 8) : -Math.min(90, a.x - 8)
          d += ` C ${a.x + reach} ${a.y} ${b.x + reach} ${b.y} ${b.x} ${b.y}`
        }
      }
      pathD.value = d
    }

    let ro = null
    const observe = async () => {
      await nextTick()
      const track = trackEl.value
      if (!track) return
      width.value = track.clientWidth
      ro?.disconnect()
      ro = new ResizeObserver(() => {
        width.value = track.clientWidth
        nextTick(buildPath)
      })
      ro.observe(track)
      buildPath()
      // Otra vez cuando terminan las animaciones de entrada (mueven los hitos unos píxeles)
      setTimeout(buildPath, events.value.length * 60 + 600)
      track.closest('.history-timeline')?.focus()
    }
    watch(() => props.isVisible, (on) => { if (on) observe(); else { ro?.disconnect(); ro = null } }, { immediate: true })
    watch(cols, () => nextTick(buildPath))
    onBeforeUnmount(() => ro?.disconnect())

    const closeTimeline = () => emit('close')
    const goTo = (item) => { if (item.ine) emit('goToTown', { id: item.ine, name: item.town }) }

    return { trackEl, failedIcons, size, pathD, start, reduceMotion, events, cols, rows, closeTimeline, goTo }
  }
}
</script>

<style scoped>
.history-timeline {
  --ht-paper: #fbf5e6;
  --ht-text: #4a3420;
  --ht-muted: #7d6449;
  --ht-year: #c07c12;
  --ht-line: #b48a52;
  --ht-disc: #ffffff;
  --hi-main: #e2b15b;
  --hi-light: #fbeccb;
  --hi-accent: #c46b3a;
  --hi-dark: #5a3b1e;
  --hi-water: #3f8fc4;

  position: fixed;
  z-index: 3000;
  top: calc(var(--topbar-h, 56px) + 62px);
  bottom: 12px;
  left: 12px;
  right: 12px;
  max-width: 1080px;
  margin: 0 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--ht-paper);
  color: var(--ht-text);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(40, 25, 10, 0.28);
  padding: 28px 28px 40px;
  outline: none;
}

.ht-close {
  position: sticky;
  top: 0;
  float: right;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--ht-text) 20%, transparent);
  background: var(--ht-paper);
  color: var(--ht-text);
  font-size: 16px;
  cursor: pointer;
  z-index: 2;
}
.ht-close:hover,
.ht-close:focus-visible {
  background: color-mix(in srgb, var(--ht-year) 15%, var(--ht-paper));
}

.ht-header {
  text-align: center;
  margin: 0 auto 8px;
  max-width: 640px;
}
.ht-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ht-year);
}
.ht-title {
  margin: 6px 0 6px;
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.2;
}
.ht-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--ht-muted);
}

.ht-track {
  position: relative;
  padding: 80px 0 10px;
}
.ht-path {
  position: absolute;
  inset: 0;
  /* global.css da fondo, borde redondeado y sombra a todos los svg */
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  pointer-events: none;
  overflow: visible;
}
.ht-path-line {
  fill: none;
  stroke: var(--ht-line);
  stroke-width: 2.5;
  stroke-dasharray: 5 7;
  stroke-linecap: round;
}
.ht-path-start {
  fill: var(--ht-year);
}
.frog-body {
  fill: #6aa84f;
  stroke: #2f5a1f;
  stroke-width: 1.2;
}
.frog-eye {
  fill: #1d2a12;
}

.ht-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 36px;
}
.ht-row.reverse {
  flex-direction: row-reverse;
}
.ht-item {
  position: relative;
  flex: 0 0 calc(100% / var(--cols));
  padding: 0 14px;
  text-align: center;
  animation: ht-in 0.5s ease-out both;
  animation-delay: calc(var(--i) * 60ms);
}
@keyframes ht-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

.ht-node {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 92px;
  height: 92px;
  padding: 0;
  border-radius: 50%;
  border: 2.5px dashed var(--ht-line);
  background: var(--ht-paper);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.ht-node:disabled {
  cursor: default;
}
.ht-node:not(:disabled):hover,
.ht-node:not(:disabled):focus-visible {
  transform: translateY(-3px) scale(1.06);
  border-style: solid;
  border-color: var(--ht-year);
  outline: none;
}
.ht-icon {
  margin: 5px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ht-disc);
  padding: 7px;
  box-shadow: 0 3px 10px rgba(90, 59, 30, 0.15);
}
.ht-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.2s ease;
}
.ht-node:not(:disabled):hover .ht-icon img,
.ht-node:not(:disabled):focus-visible .ht-icon img {
  transform: scale(1.08);
}

.ht-year {
  margin: 12px 0 2px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--ht-year);
}
.ht-item-title {
  margin: 0 auto 4px;
  max-width: 260px;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.3;
}
.ht-desc {
  margin: 0 auto;
  max-width: 260px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ht-muted);
}
.ht-link {
  margin-top: 6px;
  border: 0;
  background: none;
  padding: 2px 4px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--ht-year);
  cursor: pointer;
}
.ht-link:hover,
.ht-link:focus-visible {
  text-decoration: underline;
}

/* Entrada y salida del panel */
.ht-enter-active,
.ht-leave-active {
  transition: opacity 0.25s ease, transform 0.3s ease;
}
.ht-enter-from,
.ht-leave-to {
  opacity: 0;
  transform: translateY(24px);
}

/* Una columna (móvil): icono a la izquierda y texto al lado; el camino baja por la izquierda */
.ht-track.one-col {
  padding-top: 40px;
}
.ht-track.one-col .ht-row {
  margin-bottom: 26px;
}
.ht-track.one-col .ht-item {
  display: grid;
  grid-template-columns: 92px 1fr;
  column-gap: 14px;
  text-align: left;
  padding: 0;
}
.ht-track.one-col .ht-node {
  grid-row: 1 / span 4;
}
.ht-track.one-col .ht-year {
  margin-top: 4px;
}
.ht-track.one-col .ht-item-title,
.ht-track.one-col .ht-desc {
  margin: 0 0 4px;
  max-width: none;
}
.ht-track.one-col .ht-link {
  justify-self: start;
  padding-left: 0;
}

@media (max-width: 767px) {
  .history-timeline {
    top: calc(var(--topbar-h, 56px) + 56px);
    left: 8px;
    right: 8px;
    bottom: 8px;
    padding: 20px 14px 30px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ht-item { animation: none; }
  .ht-node, .ht-icon img { transition: none; }
  .ht-enter-active, .ht-leave-active { transition: none; }
}
</style>

<style>
/* Modo oscuro (sin scoped: el atributo data-theme está en <html>) */
[data-theme="dark"] .history-timeline {
  --ht-paper: #221d17;
  --ht-text: #f1e4c8;
  --ht-muted: #c9b48f;
  --ht-year: #e8b54e;
  --ht-line: #8b6d45;
  --ht-disc: #f6ead0;
}
</style>
