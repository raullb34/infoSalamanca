<template>
  <!-- Ciencia: eventos (congresos, jornadas, divulgación, tecnología) o noticias de ciencia de la USAL -->
  <div class="cr">
    <header class="cr-head">
      <div class="cr-title-row">
        <h2 class="cr-title">{{ mode === 'eventos' ? '🧪 Eventos de ciencia' : '📰 Noticias de ciencia' }}</h2>
        <button type="button" class="cr-clear" title="Quitar el filtro" @click="$emit('clearFilter')">Quitar filtro ✕</button>
      </div>
      <p class="cr-sub">
        <template v-if="!loading && count">{{ count }} {{ count === 1 ? 'resultado' : 'resultados' }} · </template>
        <template v-if="mode === 'eventos'">Congresos, jornadas, divulgación y tecnología</template>
        <template v-else>De la Universidad de Salamanca</template>
      </p>
      <div v-if="mode === 'eventos' && categories.length > 1" class="cr-chips" role="group" aria-label="Tipo de evento">
        <button type="button" :class="{ on: !category }" :aria-pressed="!category" @click="category = null">Todos</button>
        <button v-for="c in categories" :key="c" type="button" :class="{ on: category === c }" :aria-pressed="category === c" @click="category = c">{{ c }}</button>
      </div>
    </header>

    <div v-if="loading" class="cr-empty"><span class="cr-spinner" aria-hidden="true"></span>Cargando…</div>
    <p v-else-if="error" class="cr-empty">No se ha podido cargar ahora mismo. Prueba en un rato.</p>

    <!-- Eventos, por mes -->
    <div v-else-if="mode === 'eventos'" class="cr-list">
      <template v-for="group in byMonth" :key="group.label">
        <h3 class="cr-month">{{ group.label }}</h3>
        <article
          v-for="ev in group.items"
          :key="ev.id_evento"
          class="cr-card"
          tabindex="0"
          @click="$emit('itemSelected', ev)"
          @keydown.enter="$emit('itemSelected', ev)"
        >
          <div class="cr-date" aria-hidden="true">
            <span v-if="ongoing(ev)" class="cr-until">hasta</span>
            <span class="cr-day">{{ shown(ev).getDate() }}</span>
            <span class="cr-mon">{{ MONTHS_SHORT[shown(ev).getMonth()] }}</span>
          </div>
          <div class="cr-body">
            <h4 class="cr-name">{{ ev.titulo }}</h4>
            <p class="cr-meta">
              {{ ev.lugar_celebracion || ev.municipio }}<template v-if="ev.hora_inicio"> · {{ ev.hora_inicio.replace(/\s*h$/, '') }} h</template>
            </p>
            <p class="cr-tags">
              <span class="cr-tag">{{ ev.categoria }}</span>
              <span class="cr-source">{{ SOURCE_LABELS[ev.source] || ev.fuente }}</span>
              <span v-if="range(ev)" class="cr-source">{{ range(ev) }}</span>
            </p>
          </div>
        </article>
      </template>
      <p v-if="!filtered.length" class="cr-empty">No hay eventos de ciencia anunciados.</p>
    </div>

    <!-- Noticias -->
    <div v-else class="cr-list">
      <a v-for="n in news" :key="n.id" :href="n.enlace" target="_blank" rel="noopener" class="cr-news">
        <!-- Sin imagen: la web de la USAL no permite mostrar sus fotos desde otras páginas (responde 403) -->
        <div class="cr-news-body">
          <p class="cr-news-date">{{ newsDate(n.fecha) }}</p>
          <h4 class="cr-name">{{ n.titulo }}</h4>
          <p class="cr-news-text">{{ n.resumen }}</p>
          <span class="cr-more">Leer en usal.es ↗</span>
        </div>
      </a>
      <p v-if="!news.length" class="cr-empty">No hay noticias ahora mismo.</p>
      <p class="cr-credit">Noticias de la sección de Ciencia de <a href="https://comunicacion.usal.es/ciencia" target="_blank" rel="noopener">comunicacion.usal.es</a>.</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { scienceEvents, scienceNews, SOURCE_LABELS } from '@/utils/ciencia'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const day = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()) }

export default {
  name: 'CienciaResults',
  props: {
    // 'eventos' | 'noticias'
    mode: { type: String, required: true }
  },
  emits: ['clearFilter', 'itemSelected'],
  setup(props) {
    const events = ref([])
    const news = ref([])
    const loading = ref(true)
    const error = ref(false)
    const category = ref(null)

    async function load() {
      loading.value = true
      error.value = false
      try {
        if (props.mode === 'eventos') events.value = await scienceEvents()
        else news.value = await scienceNews()
      } catch {
        error.value = true
      }
      loading.value = false
    }
    watch(() => props.mode, () => { category.value = null; load() }, { immediate: true })

    const categories = computed(() => [...new Set(events.value.map(e => e.categoria).filter(Boolean))])
    const filtered = computed(() => events.value.filter(e => !category.value || e.categoria === category.value))
    // Lo ya empezado (un congreso de tres días) se agrupa en el mes de hoy
    const ongoing = (ev) => { const s = day(ev.fecha_inicio); const e = day(ev.fecha_fin); return Boolean(s && e && s < today() && e >= today()) }
    const shown = (ev) => (ongoing(ev) ? day(ev.fecha_fin) : day(ev.fecha_inicio))
    const byMonth = computed(() => {
      const groups = []
      for (const ev of filtered.value) {
        const d = ongoing(ev) ? today() : day(ev.fecha_inicio)
        if (!d) continue
        const label = `${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`
        const g = groups.find(x => x.label === label) || groups[groups.push({ label, items: [] }) - 1]
        g.items.push(ev)
      }
      return groups
    })
    const range = (ev) => {
      const s = day(ev.fecha_inicio)
      const e = day(ev.fecha_fin)
      if (!s || !e || ongoing(ev)) return ''
      return `hasta el ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`
    }
    const count = computed(() => (props.mode === 'eventos' ? filtered.value.length : news.value.length))
    const newsDate = (iso) => (iso ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(iso)) : '')

    return { events, news, loading, error, category, categories, filtered, byMonth, ongoing, shown, range, count, newsDate, MONTHS_SHORT, SOURCE_LABELS }
  }
}
</script>

<style scoped>
.cr-head {
  margin-bottom: 12px;
}
.cr-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.cr .cr-title {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}
.cr-clear {
  flex-shrink: 0;
  padding: 2px 4px;
  border: none;
  border-radius: 6px;
  font-size: 0.78rem;
  color: var(--text-muted);
  background: none;
  cursor: pointer;
}
.cr-clear:hover {
  color: var(--danger-color, #e53935);
  background: var(--bg-secondary);
}
.cr-sub {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.cr-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.cr-chips button {
  padding: 4px 10px;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-primary);
  cursor: pointer;
}
.cr-chips button.on {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, var(--bg-primary));
}
.cr-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cr-month {
  margin: 10px 0 2px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.cr-list > .cr-month:first-child {
  margin-top: 0;
}
.cr-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-primary);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cr-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
.cr-card:focus-visible,
.cr-news:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.cr-date {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 44px;
  padding: 4px 0;
  border-radius: 10px;
  color: #3f51b5;
  background: color-mix(in srgb, #3f51b5 12%, var(--bg-primary));
}
.cr-until {
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}
.cr-day {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.1;
}
.cr-mon {
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.cr-body,
.cr-news-body {
  flex: 1;
  min-width: 0;
}
.cr-name {
  margin: 0 0 2px;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}
.cr-meta {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--text-secondary);
}
.cr-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 4px 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}
.cr-tag {
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 600;
  color: #3f51b5;
  background: color-mix(in srgb, #3f51b5 12%, var(--bg-primary));
}
.cr-news {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  background: var(--bg-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cr-news:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
.cr-news img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: var(--bg-secondary);
}
.cr-news-body {
  padding: 10px 12px 12px;
}
.cr-news-date {
  margin: 0 0 2px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.cr-news-text {
  display: -webkit-box;
  margin: 4px 0 6px;
  overflow: hidden;
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--text-secondary);
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.cr-more {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--primary-color);
}
.cr-credit {
  margin: 4px 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}
.cr-credit a {
  color: inherit;
}
.cr-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 8px;
  font-size: 0.85rem;
  text-align: center;
  color: var(--text-muted);
}
.cr-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-light);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: cr-spin 0.8s linear infinite;
}
@keyframes cr-spin { to { transform: rotate(360deg); } }
[data-theme='dark'] .cr-date,
[data-theme='dark'] .cr-tag {
  color: #9fa8ff;
  background: color-mix(in srgb, #7986cb 22%, var(--bg-primary));
}
</style>
