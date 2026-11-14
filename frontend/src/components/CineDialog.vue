<template>
  <Teleport to="body">
    <div class="cnd-overlay" role="dialog" aria-modal="true" :aria-label="`Cartelera de ${cine.nombre}`" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <article ref="panel" class="cnd" tabindex="-1">
        <!-- Portada: carteles de la semana en mosaico, desenfocados, y los datos del cine -->
        <header class="cnd-hero">
          <div class="cnd-mosaic" aria-hidden="true">
            <img v-for="(p, i) in posters" :key="i" :src="p" alt="" loading="lazy" />
          </div>
          <button type="button" class="cnd-close" aria-label="Cerrar" @click="$emit('close')">✕</button>
          <div class="cnd-hero-text">
            <p class="cnd-kicker">🎬 Cine · {{ cine.pueblo }}</p>
            <h2 class="cnd-title">{{ cine.nombre }}</h2>
            <p v-if="cine.direccion" class="cnd-sub">📍 {{ cine.direccion }}</p>
            <div class="cnd-cta">
              <a v-if="mapsUrl" :href="mapsUrl" target="_blank" rel="noopener" class="cnd-btn">🧭 Cómo llegar</a>
              <a v-if="cine.telefono" :href="`tel:${cine.telefono.replace(/\s/g, '')}`" class="cnd-btn">📞 {{ cine.telefono }}</a>
              <a v-if="cine.web" :href="cine.web" target="_blank" rel="noopener" class="cnd-btn">Web del cine ↗</a>
            </div>
          </div>
        </header>

        <!-- Días con sesiones -->
        <nav v-if="days.length" class="cnd-days" aria-label="Día">
          <button
            v-for="d in days"
            :key="d.iso"
            type="button"
            class="cnd-day"
            :class="{ on: day === d.iso }"
            :aria-pressed="day === d.iso"
            @click="day = d.iso"
          >
            <span class="cnd-day-name">{{ d.name }}</span>
            <span class="cnd-day-num">{{ d.num }}</span>
            <span class="cnd-day-count">{{ d.count }} {{ d.count === 1 ? 'película' : 'películas' }}</span>
          </button>
        </nav>

        <!-- Películas del día -->
        <section v-if="filmsOfDay.length" :key="day" class="cnd-films">
          <article v-for="(f, i) in filmsOfDay" :key="f.titulo" class="cnd-film" :style="{ '--i': i }">
            <a :href="f.url || cine.web" target="_blank" rel="noopener" class="cnd-poster" :aria-label="`Ficha de ${f.titulo}`">
              <img v-if="f.cartel" :src="f.cartel" alt="" loading="lazy" @error="e => e.target.remove()" />
              <span v-else aria-hidden="true">🎞️</span>
            </a>
            <div class="cnd-film-body">
              <h3 class="cnd-film-title">{{ f.titulo }}</h3>
              <p class="cnd-film-meta">
                <span v-if="f.calificacion" class="cnd-rating">{{ rating(f.calificacion) }}</span>
                <template v-if="f.duracion">{{ f.duracion }} min</template>
                <template v-if="f.generos.length"> · {{ f.generos.join(', ') }}</template>
              </p>
              <div class="cnd-times">
                <component
                  :is="s.entradas ? 'a' : 'span'"
                  v-for="s in f.today"
                  :key="s.inicio"
                  :href="s.entradas || undefined"
                  :target="s.entradas ? '_blank' : undefined"
                  rel="noopener"
                  class="cnd-time"
                  :class="{ past: s.past, buy: s.entradas }"
                  :title="s.entradas ? 'Comprar entradas en la web del cine' : null"
                >{{ s.inicio.slice(11, 16) }}<small v-if="s.version"> {{ s.version }}</small></component>
              </div>
            </div>
          </article>
        </section>

        <!-- Sin cartelera -->
        <div v-else class="cnd-empty">
          <span aria-hidden="true">🍿</span>
          <p v-if="cine.estado === 'sin cartelera en línea'">Este cine no publica su cartelera en internet. {{ cine.nota || '' }}</p>
          <p v-else-if="cine.estado === 'no disponible ahora'">No hemos podido leer la cartelera de su web ahora mismo. Prueba en un rato o mira en su web.</p>
          <p v-else>No tiene sesiones anunciadas para los próximos días. {{ cine.nota || '' }}</p>
          <p v-if="cine.telefono">Para preguntar: <a :href="`tel:${cine.telefono.replace(/\s/g, '')}`">{{ cine.telefono }}</a></p>
        </div>

        <p class="cnd-source">
          Horarios de la web del cine<template v-if="cine.fuente"> (<a :href="cine.fuente" target="_blank" rel="noopener">{{ host(cine.fuente) }}</a>)</template>;
          las entradas se compran allí. Pueden cambiar: confírmalos antes de ir.
        </p>
      </article>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const pad = (n) => String(n).padStart(2, '0')
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default {
  name: 'CineDialog',
  props: {
    cine: { type: Object, required: true }
  },
  emits: ['close'],
  setup(props) {
    const panel = ref(null)
    const day = ref(null)

    const days = computed(() => {
      const map = new Map()
      for (const f of props.cine.peliculas || []) {
        for (const s of f.sesiones) {
          const iso = s.inicio.slice(0, 10)
          if (!map.has(iso)) map.set(iso, new Set())
          map.get(iso).add(f.titulo)
        }
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([iso, titles]) => {
        const [y, m, d] = iso.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const diff = Math.round((date - start) / 864e5)
        return { iso, name: diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : WEEKDAYS[date.getDay()], num: d, count: titles.size }
      })
    })
    watch(days, (list) => { if (!list.some(d => d.iso === day.value)) day.value = list[0]?.iso || null }, { immediate: true })

    const filmsOfDay = computed(() => {
      const now = new Date()
      const nowIso = `${localIso(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`
      return (props.cine.peliculas || [])
        .map(f => ({ ...f, today: f.sesiones.filter(s => s.inicio.startsWith(day.value)).map(s => ({ ...s, past: s.inicio < nowIso })) }))
        .filter(f => f.today.length)
        .sort((a, b) => a.today[0].inicio.localeCompare(b.today[0].inicio))
    })

    // Carteles para el mosaico de la portada
    const posters = computed(() => (props.cine.peliculas || []).map(f => f.cartel).filter(Boolean).slice(0, 8))

    const mapsUrl = computed(() => {
      const c = props.cine
      if (c.lat && c.lon) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.nombre}, ${c.pueblo}`)}`
      return c.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.nombre}, ${c.direccion}, ${c.pueblo}`)}` : null
    })
    const rating = (r) => String(r).replace(/^ICAA\s*/i, '').replace(/^TP$/i, 'Todos los públicos').replace(/^(\d+)$/, '+$1')
    const host = (u) => { try { return new URL(u).host.replace(/^www\./, '') } catch { return u } }

    onMounted(() => panel.value?.focus())
    return { panel, day, days, filmsOfDay, posters, mapsUrl, rating, host }
  }
}
</script>

<style scoped>
.cnd-overlay {
  position: fixed;
  inset: 0;
  z-index: 10002;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(10, 10, 16, 0.6);
  backdrop-filter: blur(6px);
  animation: cnd-fade 0.25s ease both;
}
.cnd {
  --ink: #1d1b22;
  --ink-soft: #66606f;
  --paper: #faf8fc;
  --card: #ffffff;
  --line: rgba(29, 27, 34, 0.1);
  --accent: #b3261e;
  width: min(860px, 100%);
  max-height: min(92vh, 920px);
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 24px;
  color: var(--ink);
  background: var(--paper);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
  outline: none;
  animation: cnd-rise 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
}

/* ---------- Portada ---------- */
.cnd-hero {
  position: relative;
  min-height: 220px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  color: #fff;
  background: #16131c;
}
.cnd-mosaic {
  position: absolute;
  inset: -20px;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  filter: blur(3px) brightness(0.45) saturate(1.2);
  transform: rotate(-4deg) scale(1.15);
}
.cnd-mosaic img {
  width: 100%;
  height: 100%;
  min-height: 240px;
  object-fit: cover;
  border-radius: 0 !important;
}
.cnd-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 20%, rgba(10, 8, 14, 0.85));
}
.cnd-hero-text {
  position: relative;
  z-index: 1;
  padding: 28px;
}
.cnd-kicker {
  margin: 0 0 4px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
}
.cnd-title {
  margin: 0;
  font-size: clamp(1.5rem, 3.6vw, 2.2rem);
  font-weight: 800;
  line-height: 1.1;
  color: #fff;
  text-wrap: balance;
}
.cnd-sub {
  margin: 6px 0 0;
  font-size: 0.9rem;
  opacity: 0.85;
}
.cnd-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.cnd-btn {
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 0.86rem;
  font-weight: 600;
  text-decoration: none;
  color: #fff !important;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}
.cnd-btn:hover,
.cnd-btn:focus-visible {
  background: rgba(255, 255, 255, 0.26);
}
.cnd-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

/* ---------- Días ---------- */
.cnd-days {
  display: flex;
  gap: 8px;
  padding: 18px 24px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.cnd-day {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 78px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  color: var(--ink);
  background: var(--card);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.cnd-day:hover {
  transform: translateY(-1px);
}
.cnd-day.on {
  color: #fff;
  border-color: var(--accent);
  background: var(--accent);
}
.cnd-day-name {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.cnd-day-num {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.1;
}
.cnd-day-count {
  font-size: 0.68rem;
  opacity: 0.8;
}

/* ---------- Películas ---------- */
.cnd-films {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 12px;
  padding: 14px 24px 0;
}
.cnd-film {
  display: flex;
  gap: 14px;
  padding: 12px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--line), 0 6px 18px rgba(29, 27, 34, 0.06);
  animation: cnd-in 0.35s ease backwards;
  animation-delay: calc(min(var(--i), 10) * 0.04s);
}
.cnd-poster {
  flex: 0 0 86px;
  height: 126px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 10px;
  font-size: 2rem;
  text-decoration: none;
  background: #2a2532;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}
.cnd-poster:hover {
  transform: scale(1.04) rotate(-1deg);
}
.cnd-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0 !important;
  box-shadow: none !important;
}
.cnd-film-body {
  min-width: 0;
  flex: 1;
}
.cnd-film-title {
  margin: 2px 0 4px;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink);
}
.cnd-film-meta {
  margin: 0 0 10px;
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.cnd-rating {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 4px;
  font-weight: 700;
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.cnd-times {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cnd-time {
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
  color: var(--ink) !important;
  background: var(--paper);
}
.cnd-time small {
  font-size: 0.68rem;
  color: var(--accent);
}
.cnd-time.buy:hover,
.cnd-time.buy:focus-visible {
  color: #fff !important;
  border-color: var(--accent);
  background: var(--accent);
}
.cnd-time.buy:hover small {
  color: #fff;
}
.cnd-time.past {
  opacity: 0.4;
  text-decoration: line-through;
}

.cnd-empty {
  margin: 18px 24px 0;
  padding: 28px 20px;
  border-radius: 16px;
  text-align: center;
  color: var(--ink-soft);
  background: var(--card);
}
.cnd-empty span {
  font-size: 2.6rem;
}
.cnd-empty p {
  margin: 8px 0 0;
}
.cnd-source {
  margin: 16px 24px 22px;
  font-size: 0.74rem;
  color: var(--ink-soft);
}
.cnd-source a {
  color: inherit;
}

@keyframes cnd-fade { from { opacity: 0; } }
@keyframes cnd-rise { from { opacity: 0; transform: translateY(40px) scale(0.96); } }
@keyframes cnd-in { from { opacity: 0; transform: translateY(12px); } }
@media (prefers-reduced-motion: reduce) {
  .cnd, .cnd-overlay, .cnd-film { animation: none !important; }
}

@media (max-width: 640px) {
  .cnd-overlay { padding: 0; }
  .cnd {
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
  .cnd-hero-text { padding: 22px 16px; }
  .cnd-mosaic { grid-template-columns: repeat(4, 1fr); }
  .cnd-days { padding: 14px 16px 4px; }
  .cnd-films { grid-template-columns: 1fr; padding: 12px 16px 0; }
  .cnd-empty { margin: 16px 16px 0; }
  .cnd-source { margin: 16px; }
}
</style>

<style>
[data-theme='dark'] .cnd {
  --ink: #f1eef6;
  --ink-soft: #b3abbf;
  --paper: #18151d;
  --card: #241f2b;
  --line: rgba(255, 255, 255, 0.1);
  --accent: #e5534b;
}
</style>
