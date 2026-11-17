<template>
  <!-- Pueblo pulsado en el mapa: sus productores Tierra de Sabor y su agenda cultural.
       La ficha de la derecha se queda con los datos del pueblo; lo que ver va en la pestaña Rutas. -->
  <section class="town-panel" :aria-label="`En ${town.name}`">
    <header class="tp-head">
      <div>
        <p class="tp-kicker">Pueblo seleccionado</p>
        <h2 class="tp-title">En {{ town.name }}</h2>
      </div>
      <button type="button" class="tp-close" title="Quitar el pueblo" aria-label="Quitar el pueblo" @click="$emit('closeTown')">✕</button>
    </header>

    <!-- Fiestas: las anunciadas (agendas y prensa), las fiestas locales y, si están cerca, el cartel aprobado -->
    <template v-if="fiestaEvents.length || localFestival">
      <h3 class="tp-section">
        <span aria-hidden="true">🎉</span> Fiestas
        <span v-if="nearDays !== null" class="tp-soon">{{ nearDays === 0 ? '¡Ahora!' : nearDays === 1 ? 'Mañana' : `En ${nearDays} días` }}</span>
      </h3>
      <FestivalPoster v-if="nearPoster" :posters="[nearPoster]" :townName="town.name" class="tp-poster" />
      <div v-if="fiestaEvents.length" class="tp-list">
        <article
          v-for="(ev, i) in fiestaEvents"
          :key="ev.id_evento || ev.id || `${ev.titulo}-${i}`"
          class="tp-card"
          tabindex="0"
          @click="$emit('openEvent', ev)"
          @keydown.enter="$emit('openEvent', ev)"
        >
          <div class="tp-date" aria-hidden="true">
            <span v-if="ongoing(ev)" class="tp-until">hasta</span>
            <span class="tp-day">{{ dayOf(ev) }}</span>
            <span class="tp-month">{{ monthOf(ev) }}</span>
          </div>
          <div class="tp-body">
            <h4 class="tp-name">{{ ev.titulo || ev.title }}</h4>
            <p class="tp-meta">{{ [ev.hora_inicio, ev.source === 'prensa' ? ev.fuente : null].filter(Boolean).join(' · ') }}</p>
            <p v-if="ev.lugar_celebracion" class="tp-sub">📍 {{ ev.lugar_celebracion }}</p>
          </div>
        </article>
      </div>
      <p v-if="localFestival" class="tp-local">
        <strong>Fiestas locales:</strong> {{ localFestival.text }}
        <span class="tp-local-days">· {{ localFestival.days === 0 ? 'hoy' : localFestival.days === 1 ? 'mañana' : `faltan ${localFestival.days} días` }}</span>
      </p>
      <ContributeButton
        v-if="!nearPoster"
        block
        tipo="fiesta"
        icon="🖼️"
        label="¿Tienes el cartel de las fiestas? Envíanoslo"
        :title="`El cartel de las fiestas de ${townLabel}`"
        lead="Pega el enlace a la publicación del ayuntamiento o de la comisión de fiestas. Lo revisamos y lo ponemos en la ficha."
        text-label="Algo que debamos saber"
        placeholder="Fiestas de San Martín, del 10 al 12 de noviembre…"
        link-label="Enlace al cartel (Facebook, Instagram o web)"
        link-required
        default-relacion="ayuntamiento"
        :town-ine="townIne"
        :town-name="town.name"
      />
    </template>

    <!-- Próxima visita del bibliobús (calendario de la Junta): no es un evento, pero conviene saberlo -->
    <a v-if="bibliobus" :href="bibliobus.enlace || null" target="_blank" rel="noopener noreferrer" class="tp-bus">
      <span class="tp-bus-icon" aria-hidden="true">🚌</span>
      <span class="tp-bus-text">
        <strong>El bibliobús viene {{ bibliobus.when }}</strong>
        <small>{{ bibliobus.detail }}</small>
      </span>
    </a>

    <!-- Tierra de Sabor -->
    <h3 class="tp-section">
      <span aria-hidden="true">🍯</span> Tierra de Sabor
      <span v-if="producers.length" class="tp-count">{{ producers.length }}</span>
    </h3>
    <p v-if="loadingProducers" class="tp-empty">Buscando productores…</p>
    <div v-else-if="producers.length" class="tp-list">
      <article
        v-for="p in producers"
        :key="p.idempresa"
        class="tp-card"
        tabindex="0"
        @click="selectedProducer = p"
        @keydown.enter="selectedProducer = p"
      >
        <ProducerAvatar :producer="p" :size="46" />
        <div class="tp-body">
          <h4 class="tp-name">{{ niceCase(p.nombre_comercial) }}</h4>
          <p class="tp-meta">{{ (p.secciones || []).join(', ') }}<template v-if="p.num_productos"> · {{ p.num_productos }} productos</template></p>
          <div class="tp-actions">
            <a v-if="p.venta?.online" :href="p.venta.online.url" target="_blank" rel="noopener noreferrer" class="tp-chip buy" @click.stop @keydown.enter.stop>🛒 Tienda</a>
            <a v-if="p.venta?.telefono" :href="`tel:${p.venta.telefono.replace(/\s/g, '')}`" class="tp-chip" @click.stop @keydown.enter.stop>📞 Llamar</a>
            <span class="tp-chip ghost">Ver productos →</span>
          </div>
        </div>
      </article>
    </div>
    <p v-else class="tp-empty">Ningún productor de este pueblo tiene el sello.</p>

    <!-- Agenda cultural -->
    <h3 class="tp-section">
      <span aria-hidden="true">🎭</span> Eventos culturales
      <span v-if="upcoming.length" class="tp-count">{{ upcoming.length }}</span>
    </h3>
    <p v-if="loading" class="tp-empty">Cargando agenda…</p>
    <div v-else-if="upcoming.length" class="tp-list">
      <article
        v-for="(ev, i) in upcoming"
        :key="ev.id_evento || ev.id || `${ev.titulo}-${i}`"
        class="tp-card"
        tabindex="0"
        @click="$emit('openEvent', ev)"
        @keydown.enter="$emit('openEvent', ev)"
      >
        <div class="tp-date" aria-hidden="true">
          <span v-if="ongoing(ev)" class="tp-until">hasta</span>
          <span class="tp-day">{{ dayOf(ev) }}</span>
          <span class="tp-month">{{ monthOf(ev) }}</span>
        </div>
        <div class="tp-body">
          <h4 class="tp-name">{{ ev.titulo || ev.title }}</h4>
          <p class="tp-meta">{{ [ev.categoria || ev.tematica, ev.hora_inicio, ev.source === 'prensa' ? ev.fuente : null].filter(Boolean).join(' · ') }}</p>
          <p v-if="ev.lugar_celebracion || ev.ubicacion || ev.location" class="tp-sub">📍 {{ ev.lugar_celebracion || ev.ubicacion || ev.location }}</p>
        </div>
      </article>
    </div>
    <p v-else class="tp-empty">No hay eventos culturales anunciados.</p>
    <ContributeButton
      block
      tipo="evento"
      icon="📣"
      :label="`¿Organizas algo en ${townLabel}? Avísanos`"
      title="Avísanos de un evento"
      lead="Un concierto, una feria, un taller, una ruta… Dinos qué, cuándo y dónde. Lo revisamos y lo añadimos a la agenda."
      text-label="Qué, cuándo y dónde"
      placeholder="Concierto de la banda municipal, sábado 28 de noviembre a las 20:00 en la iglesia…"
      link-label="Enlace al cartel o al anuncio (opcional)"
      default-relacion="ayuntamiento"
      :town-ine="townIne"
      :town-name="town.name"
    />

    <!-- Cine del pueblo y lo que echa -->
    <template v-if="cines.length">
      <h3 class="tp-section"><span aria-hidden="true">🎬</span> En el cine</h3>
      <div class="tp-list">
        <article
          v-for="c in cines"
          :key="c.id"
          class="tp-card tp-cine"
          tabindex="0"
          @click="selectedCine = c"
          @keydown.enter="selectedCine = c"
        >
          <div class="tp-body">
            <h4 class="tp-name">{{ c.nombre }}</h4>
            <template v-if="nextDay(c)">
              <p class="tp-meta">{{ capitalize(dayLabel(nextDay(c).day)) }}:</p>
              <ul class="tp-films">
                <li v-for="f in nextDay(c).films.slice(0, 4)" :key="f.titulo">
                  <img v-if="f.cartel" :src="f.cartel" alt="" loading="lazy" />
                  <span v-else class="tp-noposter" aria-hidden="true">🎞️</span>
                  <span class="tp-film-title">{{ f.titulo }}</span>
                  <span class="tp-film-times">{{ timesOn(f, nextDay(c).day) }}</span>
                </li>
              </ul>
              <span class="tp-chip ghost">Ver toda la cartelera →</span>
            </template>
            <p v-else class="tp-sub">{{ cineSummary(c) }}</p>
          </div>
        </article>
      </div>
    </template>

    <!-- Lo que cuentan los periódicos del pueblo (sin sucesos, política ni esquelas); enlaza a cada noticia -->
    <template v-if="news.length">
      <h3 class="tp-section">
        <span aria-hidden="true">📰</span> En la prensa
        <span class="tp-count">{{ news.length }}</span>
      </h3>
      <ul class="tp-news">
        <li v-for="n in news" :key="n.enlace">
          <a :href="n.enlace" target="_blank" rel="noopener noreferrer" class="tp-news-link">
            <img v-if="n.imagen" :src="n.imagen" alt="" loading="lazy" referrerpolicy="no-referrer" class="tp-news-img" @error="$event.target.remove()" />
            <span class="tp-news-text">
              <span class="tp-news-title">{{ n.titulo }}</span>
              <span class="tp-news-meta">{{ n.medio }} · {{ newsDate(n.fecha) }}</span>
            </span>
          </a>
        </li>
      </ul>
    </template>

    <!-- Qué ver: está en Rutas, para ir añadiendo sitios a la ruta -->
    <button type="button" class="tp-goto" @click="$emit('goTab', 'rutas')">
      <span aria-hidden="true">🏛️</span>
      <span><strong>Qué ver en {{ town.name }}</strong><small>{{ poiCount ? `${poiCount} ${poiCount === 1 ? 'lugar' : 'lugares'} · en la pestaña Rutas` : 'En la pestaña Rutas' }}</small></span>
      <span aria-hidden="true">→</span>
    </button>

    <!-- ¿Es tu pueblo? Corrige o añade: queda pendiente de revisión -->
    <ContributeButton
      block
      class="tp-contrib"
      tipo="pueblo"
      :label="`¿Es tu pueblo? Corrige o añade cosas de ${townLabel}`"
      :title="`Mejora la ficha de ${townLabel}`"
      lead="¿Falta un sitio que ver, una fecha está mal, cambió el teléfono del ayuntamiento? Cuéntanoslo y lo revisamos."
      text-label="Qué hay que corregir o añadir"
      placeholder="La ermita de San Roque se puede visitar los domingos…"
      :town-ine="townIne"
      :town-name="town.name"
    />

    <CineDialog v-if="selectedCine" :cine="selectedCine" @close="selectedCine = null" />
    <TierraSaborShowcase v-if="selectedProducer" :producer="selectedProducer" @close="selectedProducer = null" />
  </section>
</template>

<script>
import { ref, computed, watch } from 'vue'
import TierraSaborShowcase from '@/components/TierraSaborShowcase.vue'
import { producersIn } from '@/utils/tierraSaborList'
import ProducerAvatar from '@/components/ProducerAvatar.vue'
import CineDialog from '@/components/CineDialog.vue'
import { apiService } from '@/services/apiService'
import { nextDay, dayLabel, cineSummary } from '@/utils/cines'
import { niceCase } from '@/utils/tierraSabor'
import FestivalPoster from '@/components/FestivalPoster.vue'
import ContributeButton from '@/components/ContributeButton.vue'
import { daysUntilFestival, formatFestivalDays } from '@/utils/festivals'

// Las fiestas van en su sección (por la categoría, no por el título: "Fiesta flamenca" es un taller)
const isFiesta = (ev) => /fiesta/i.test(`${ev.categoria || ''} ${ev.tematica || ''}`)
// El cartel se enseña si la fiesta es dentro de 30 días como mucho
const NEAR_DAYS = 30
const DAY = 86400000

// Paradas del bibliobús de toda la provincia: se piden una vez y valen para todos los pueblos
let bibliobusStops = null
const loadBibliobus = () => (bibliobusStops ||= apiService.getBibliobusPoints().then(r => r?.data || []))
const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const parseDay = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
const startOf = (ev) => parseDay(ev.fecha_inicio || ev.date || ev.fecha)

export default {
  name: 'TownPanel',
  components: { TierraSaborShowcase, ProducerAvatar, CineDialog, FestivalPoster, ContributeButton },
  props: {
    town: { type: Object, required: true },
    events: { type: Array, default: () => [] },
    poiCount: { type: Number, default: 0 },
    loading: { type: Boolean, default: false }
  },
  emits: ['openEvent', 'goTab', 'closeTown'],
  setup(props) {
    const producers = ref([])
    const loadingProducers = ref(false)
    const selectedProducer = ref(null)
    const cines = ref([])
    const selectedCine = ref(null)
    const news = ref([])
    const festivalDates = ref(null) // fiestas locales (tabla de la Diputación)
    const posters = ref([]) // carteles aprobados, el más reciente primero
    const busStop = ref(null) // la próxima parada del bibliobús en el pueblo

    watch(() => props.town?.id, async (id) => {
      selectedProducer.value = null
      selectedCine.value = null
      producers.value = []
      cines.value = []
      news.value = []
      festivalDates.value = null
      posters.value = []
      busStop.value = null
      if (!id) return
      const ine = String(id).split('_')[0]
      loadBibliobus().then(stops => {
        if (props.town?.id !== id) return
        const today = +todayDate()
        busStop.value = stops
          .filter(s => String(s.cod_ine) === ine && s.nextDate && Date.parse(s.nextDate) >= today)
          .sort((a, b) => Date.parse(a.nextDate) - Date.parse(b.nextDate))[0] || null
      })
      apiService.getCines(id).then(list => { if (props.town?.id === id) cines.value = list })
      apiService.getTownPrensa(id).then(list => { if (props.town?.id === id) news.value = list })
      apiService.getMunicipalFestivals(ine).then(res => { if (props.town?.id === id) festivalDates.value = res?.data?.[0]?.celebration_dates || null })
      apiService.getTownPosters(ine).then(list => { if (props.town?.id === id) posters.value = list })
      loadingProducers.value = true
      const list = await producersIn(id)
      if (props.town?.id === id) producers.value = list // por si ya se ha pulsado otro pueblo
      loadingProducers.value = false
    }, { immediate: true })

    const townIne = computed(() => String(props.town?.id || '').split('_')[0])
    // El nombre para las frases (el mapa lo da en mayúsculas)
    const townLabel = computed(() => niceCase(props.town?.name || ''))
    const todayDate = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()) }

    // De hoy en adelante (si no tienen fecha, al final)
    const upcomingAll = computed(() => {
      const today = todayDate()
      return (props.events || [])
        .filter(ev => {
          const end = parseDay(ev.fecha_fin) || startOf(ev)
          return !end || end >= today
        })
        .sort((a, b) => (startOf(a) || Infinity) - (startOf(b) || Infinity))
    })
    const fiestaEvents = computed(() => upcomingAll.value.filter(ev => isFiesta(ev) && startOf(ev)))
    const upcoming = computed(() => upcomingAll.value.filter(ev => !fiestaEvents.value.includes(ev)))

    // Fiestas locales: los dos días de la tabla y cuántos faltan
    const localFestival = computed(() => {
      const days = daysUntilFestival(festivalDates.value)
      return days === null ? null : { days, text: formatFestivalDays(festivalDates.value) }
    })

    // La fiesta más cercana (anunciada o local): cuántos días faltan y de qué año es
    const nearest = computed(() => {
      const today = todayDate()
      const options = fiestaEvents.value.map(ev => {
        const start = startOf(ev)
        return start <= today ? { days: 0, year: today.getFullYear() } : { days: Math.round((start - today) / DAY), year: start.getFullYear() }
      })
      if (localFestival.value) {
        const days = localFestival.value.days
        options.push({ days, year: new Date(+today + days * DAY).getFullYear() })
      }
      return options.sort((a, b) => a.days - b.days)[0] || null
    })
    const nearDays = computed(() => (nearest.value && nearest.value.days <= NEAR_DAYS ? nearest.value.days : null))
    // Bibliobús: "dentro de 3 días" y el día, la hora y el sitio de la parada
    const bibliobus = computed(() => {
      const s = busStop.value
      if (!s) return null
      const date = new Date(s.nextDate)
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const days = Math.round((day - todayDate()) / DAY)
      const when = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `dentro de ${days} días`
      const hh = (t) => String(t).replace(/\s*h$/i, '') // "13:25h" → "13:25"
      const hours = s.llegada && s.salida ? `de ${hh(s.llegada)} a ${hh(s.salida)}` : s.hora
      const place = [s.lugar, s.localidad && s.localidad !== s.municipio ? s.localidad : null].filter(Boolean).join(', ')
      return { when, detail: [capitalize(WEEKDAY.format(day).replace(',', '')), hours, place].filter(Boolean).join(' · '), enlace: s.enlace }
    })

    // El cartel aprobado de ese año, solo si la fiesta está cerca
    const nearPoster = computed(() => (nearDays.value === null ? null : posters.value.find(p => p.year === nearest.value.year) || null))

    // Exposiciones y ciclos ya empezados: se muestra hasta cuándo siguen
    const ongoing = (ev) => {
      const start = startOf(ev)
      const end = parseDay(ev.fecha_fin)
      const now = new Date()
      return Boolean(start && end && start < new Date(now.getFullYear(), now.getMonth(), now.getDate()) && end > start)
    }
    const shownDay = (ev) => (ongoing(ev) ? parseDay(ev.fecha_fin) : startOf(ev))
    const dayOf = (ev) => shownDay(ev)?.getDate() ?? '—'
    const monthOf = (ev) => { const d = shownDay(ev); return d ? MONTHS[d.getMonth()] : '' }

    const timesOn = (f, day) => f.sesiones.filter(s => s.inicio.startsWith(day)).map(s => s.inicio.slice(11, 16)).join(' · ')
    const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1)
    // 'hoy', 'ayer', 'hace 3 días' o la fecha
    const newsDate = (iso) => {
      const d = new Date(iso)
      const days = Math.floor((Date.now() - d) / 86400000)
      if (days <= 0) return 'hoy'
      if (days === 1) return 'ayer'
      if (days < 7) return `hace ${days} días`
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    }

    return {
      producers, loadingProducers, selectedProducer, upcoming, dayOf, monthOf, ongoing, niceCase,
      cines, selectedCine, nextDay, dayLabel, cineSummary, timesOn, capitalize, news, newsDate,
      fiestaEvents, localFestival, nearDays, nearPoster, bibliobus, townIne, townLabel
    }
  }
}
</script>

<style scoped>
/* Fiestas: aviso de cuánto falta, el cartel y las fiestas locales */
.tp-soon {
  margin-left: auto;
  padding: 1px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, #e65100 14%, transparent);
  color: var(--text-primary, inherit);
  font-size: 12px;
  font-weight: 600;
}
.tp-poster {
  margin: 0 0 10px;
}
.tp-local {
  margin: 6px 2px 0;
  font-size: 13px;
  color: var(--text-secondary, inherit);
}
.tp-local-days {
  white-space: nowrap;
}

/* Bibliobús: tarjeta pequeña, no es un evento */
.tp-bus {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 4px;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(127, 127, 127, 0.25));
  background: color-mix(in srgb, #1e88e5 10%, transparent);
  color: inherit;
  text-decoration: none;
}
.tp-bus:hover {
  background: color-mix(in srgb, #1e88e5 16%, transparent);
}
.tp-bus:focus-visible {
  outline: 2px solid #1e88e5;
  outline-offset: 2px;
}
.tp-bus-icon {
  font-size: 22px;
}
.tp-bus-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 14px;
}
.tp-bus-text small {
  font-size: 12px;
  color: var(--text-secondary, inherit);
}

/* En la prensa: titular, periódico y fecha; la imagen pequeña a la izquierda */
.tp-news {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}
.tp-news-link {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  background: var(--bg-secondary);
}
.tp-news-link:hover .tp-news-title {
  text-decoration: underline;
}
.tp-news-link:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.tp-news-img {
  flex: 0 0 64px;
  width: 64px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
}
.tp-news-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.tp-news-title {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
}
.tp-news-meta {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.town-panel {
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
  animation: tp-in 0.3s ease backwards;
}
.tp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.tp-kicker {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-color);
}
.town-panel .tp-title {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
}
.tp-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  font-size: 0.8rem;
  color: var(--text-muted);
  background: var(--bg-secondary);
  cursor: pointer;
}
.tp-close:hover {
  color: var(--text-primary);
}
.town-panel .tp-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 16px 0 8px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.tp-count {
  padding: 0 7px;
  border-radius: 999px;
  font-size: 0.7rem;
  line-height: 1.6;
  color: #fff;
  background: var(--primary-color);
}
.tp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tp-card {
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
.tp-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
.tp-card:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.tp-date {
  flex-shrink: 0;
  width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  border-radius: 10px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, var(--bg-primary));
}
.tp-until {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1;
}
.tp-day {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.1;
}
.tp-month {
  font-size: 0.66rem;
  font-weight: 600;
  text-transform: uppercase;
}
.tp-body {
  flex: 1;
  min-width: 0;
}
.town-panel .tp-name {
  margin: 0 0 2px;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}
.tp-meta,
.tp-sub {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--text-secondary);
}
.tp-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.tp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 6px;
}
.tp-chip {
  padding: 3px 8px;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  color: var(--text-primary) !important;
}
.tp-chip.buy {
  border-color: var(--primary-color);
  color: #fff !important;
  background: var(--primary-color);
}
.tp-chip.ghost {
  border-color: transparent;
  color: var(--primary-color) !important;
}
.tp-films {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0 8px;
  padding: 0;
  list-style: none;
}
.tp-films li {
  display: grid;
  grid-template-columns: 28px 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  font-size: 0.8rem;
}
.tp-films img {
  grid-row: span 2;
  width: 28px;
  height: 40px;
  object-fit: cover;
  border-radius: 3px !important;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2) !important;
}
.tp-noposter {
  grid-row: span 2;
  display: grid;
  place-items: center;
  width: 28px;
  height: 40px;
  border-radius: 3px;
  background: var(--bg-secondary);
}
.tp-film-title {
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-primary);
}
.tp-film-times {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
.tp-empty {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}
.tp-goto {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px dashed var(--primary-color);
  border-radius: 12px;
  text-align: left;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--primary-color) 7%, var(--bg-primary));
  cursor: pointer;
}
.tp-goto > span:first-child {
  font-size: 1.4rem;
}
.tp-goto > span:nth-child(2) {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}
.tp-goto small {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.tp-goto:hover {
  border-style: solid;
}
@keyframes tp-in {
  from { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .town-panel { animation: none; }
}
</style>
