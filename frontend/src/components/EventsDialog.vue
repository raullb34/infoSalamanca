<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="evd-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-dialog-title"
      @click.self="closeDialog"
    >
      <article class="evd" :style="{ '--accent': accent }">
        <!-- Portada: el cartel del evento sobre su propia imagen desenfocada -->
        <header class="evd-hero" :class="{ 'has-poster': posterOk }">
          <div v-if="posterOk" class="evd-hero-bg" :style="{ backgroundImage: `url('${content.image}')` }" aria-hidden="true"></div>
          <button type="button" class="evd-close" aria-label="Cerrar" @click="closeDialog">✕</button>

          <img
            v-if="content.image && posterOk"
            :src="content.image"
            class="evd-poster"
            alt=""
            @error="posterOk = false"
          />
          <div v-else class="evd-poster evd-poster-empty" aria-hidden="true">{{ emoji }}</div>

          <div class="evd-hero-text">
            <div v-if="dateParts" class="evd-date">
              <span class="evd-day">{{ dateParts.day }}</span>
              <span class="evd-month">{{ dateParts.month }}</span>
              <span class="evd-weekday">{{ dateParts.weekday }}</span>
            </div>
            <h2 id="event-dialog-title" class="evd-title">{{ content.title || 'Evento' }}</h2>
            <div class="evd-chips">
              <span v-if="content.category" class="evd-chip">{{ content.category }}</span>
              <span v-if="content.theme && content.theme !== content.category" class="evd-chip ghost">{{ content.theme }}</span>
              <span v-if="content.audience" class="evd-chip ghost">👥 {{ content.audience }}</span>
            </div>
          </div>
        </header>

        <!-- Datos prácticos -->
        <div class="evd-tiles">
          <div v-if="content.time || content.endDate" class="evd-tile" style="--i: 0">
            <span class="evd-tile-icon" aria-hidden="true">🕐</span>
            <span class="evd-tile-label">Cuándo</span>
            <strong>{{ content.time ? `${content.time} h` : 'Todo el día' }}</strong>
            <small v-if="content.endDate">hasta el {{ formatDate(content.endDate) }}</small>
          </div>
          <div v-if="content.location || content.address" class="evd-tile" style="--i: 1">
            <span class="evd-tile-icon" aria-hidden="true">📍</span>
            <span class="evd-tile-label">Dónde</span>
            <strong>{{ content.location || content.address }}</strong>
            <small v-if="content.location && content.address">{{ content.address }}</small>
            <a v-if="mapsUrl" :href="mapsUrl" target="_blank" rel="noopener" class="evd-tile-link">Cómo llegar →</a>
          </div>
          <div v-if="content.price" class="evd-tile" style="--i: 2">
            <span class="evd-tile-icon" aria-hidden="true">🎟️</span>
            <span class="evd-tile-label">Entrada</span>
            <strong>{{ isFree ? 'Gratis' : content.price }}</strong>
          </div>
          <div v-if="content.organizer || content.contact" class="evd-tile" style="--i: 3">
            <span class="evd-tile-icon" aria-hidden="true">🎪</span>
            <span class="evd-tile-label">Organiza</span>
            <strong>{{ content.organizer || content.contact }}</strong>
            <small v-if="content.organizer && content.contact">{{ content.contact }}</small>
          </div>
        </div>

        <!-- Descripción (HTML de la Junta) -->
        <section v-if="content.description" class="evd-desc">
          <div class="evd-desc-text" :class="{ open: descOpen || !longDesc }" v-html="content.description"></div>
          <button v-if="longDesc" type="button" class="evd-more" @click="descOpen = !descOpen">
            {{ descOpen ? 'Ver menos' : 'Leer más' }}
          </button>
        </section>

        <footer class="evd-actions">
          <button type="button" class="evd-btn primary" @click="addToAgenda">📅 Añadir a mi agenda</button>
          <button type="button" class="evd-btn" @click="addToCalendar">💾 Exportar .ics</button>
          <a v-if="content.link" :href="content.link" target="_blank" rel="noopener" class="evd-btn">Más información ↗</a>
        </footer>
      </article>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

export default {
  name: 'EventsDialog',
  props: {
    isOpen: { type: Boolean, default: false },
    content: { type: Object, default: () => ({}) }
  },
  emits: ['close', 'calendar-added', 'calendar-error', 'add-to-agenda'],
  setup(props, { emit }) {
    const closeDialog = () => emit('close')

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && props.isOpen) closeDialog()
    }

    onMounted(() => document.addEventListener('keydown', handleKeyDown))
    onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))

    const formatDate = (date) => {
      if (!date) return ''
      const d = new Date(date)
      return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    }

    const formatPrice = (priceString) => {
      if (!priceString) return ''
      if (priceString.includes('-')) {
        const prices = priceString.split('-').filter(p => p.trim())
        const formatted = prices.map(price => {
          const clean = price.replace(/[^\d,.-]/g, '').trim()
          if (clean) {
            if (!price.includes('€') && !price.toLowerCase().includes('euro')) {
              return `${clean}€`
            }
            return clean.includes('€') ? clean : `${clean}€`
          }
          return price.trim()
        })
        if (formatted.length === 2) {
          return `<div class="price-breakdown">
            <span class="price-item"><strong>General:</strong> ${formatted[0]}</span>
            <span class="price-item"><strong>Reducida:</strong> ${formatted[1]}</span>
          </div>`
        } else if (formatted.length === 3) {
          return `<div class="price-breakdown">
            <span class="price-item"><strong>General:</strong> ${formatted[0]}</span>
            <span class="price-item"><strong>Reducida:</strong> ${formatted[1]}</span>
            <span class="price-item"><strong>Especial:</strong> ${formatted[2]}</span>
          </div>`
        }
        return `<div class="price-breakdown">${formatted.map(f => `<span class="price-item">${f}</span>`).join('')}</div>`
      }
      const cleanSingle = priceString.replace(/[^\d,.-]/g, '').trim()
      if (cleanSingle && !priceString.includes('€') && !priceString.toLowerCase().includes('euro')) {
        return `${cleanSingle}€`
      }
      return priceString
    }

    const generateICS = (event) => {
      const formatICSDate = (date, time = null) => {
        const d = new Date(date)
        if (time) {
          const [hours, minutes] = time.split(':')
          d.setHours(parseInt(hours), parseInt(minutes))
        }
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      }
      const escapeICSText = (text) => {
        if (!text) return ''
        return text.toString().replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\,').replace(/\n/g, '\n').replace(/\r/g, '')
      }
      const startDate = formatICSDate(event.date, event.time)
      const endDate = formatICSDate(event.date, event.time ? (parseInt(event.time.split(':')[0]) + 1) + ':' + event.time.split(':')[1] : null)
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//InfoSalamanca//EventCalendar//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${Date.now()}@infosalamanca.es`,
        `DTSTART:${startDate}`,
        `DTEND:${endDate}`,
        `SUMMARY:${escapeICSText(event.title)}`,
        `DESCRIPTION:${escapeICSText(event.description?.replace(/<[^>]*>/g, '') || '')}`,
        `LOCATION:${escapeICSText(event.location || '')}`,
        `ORGANIZER:${escapeICSText(event.organizer || '')}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n')
    }

    const addToAgenda = () => {
      try {
        emit('add-to-agenda', { ...props.content })
        emit('calendar-added', { message: 'Evento añadido a tu agenda', eventTitle: props.content.title })
      } catch (error) {
        console.error('Error añadiendo evento a la agenda:', error)
        emit('calendar-error', { message: 'Error al añadir el evento a la agenda', error: error.message })
      }
    }

    const addToCalendar = () => {
      try {
        const icsContent = generateICS(props.content)
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `evento-${props.content.title?.replace(/[^a-zA-Z0-9]/g, '-') || 'evento'}.ics`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        emit('calendar-added', { message: 'Evento añadido a tu calendario', eventTitle: props.content.title })
      } catch (error) {
        console.error('Error generando archivo ICS:', error)
        emit('calendar-error', { message: 'Error al generar el evento', error: error.message })
      }
    }

    // ---------- Presentación ----------
    const posterOk = ref(true)
    const descOpen = ref(false)
    watch(() => props.content, () => { posterOk.value = !!props.content?.image; descOpen.value = false }, { immediate: true })

    const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const dateParts = computed(() => {
      const m = String(props.content?.date || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (!m) return null
      const d = new Date(+m[1], +m[2] - 1, +m[3])
      return { day: d.getDate(), month: MONTHS[d.getMonth()], weekday: WEEKDAYS[d.getDay()] }
    })

    // Color e icono según el tipo de evento
    const TYPES = [
      [/teatro|t[ií]teres|mon[oó]logo|esc[eé]nic/i, '#7a2a5c', '🎭'],
      [/concierto|m[uú]sica/i, '#2a4f8a', '🎵'],
      [/cine|proyecci/i, '#2b2b4a', '🎬'],
      [/exposici/i, '#2f7a6a', '🖼️'],
      [/danza|baile/i, '#a8323e', '💃'],
      [/infantil|familia|cuentacuentos/i, '#c2702a', '🧸'],
      [/libro|lectura|literatur|presentaci/i, '#5f4b8b', '📚'],
      [/conferencia|charla|curso|taller/i, '#3f6b2a', '🎤']
    ]
    const type = computed(() => {
      const text = `${props.content?.category || ''} ${props.content?.theme || ''}`
      return TYPES.find(([re]) => re.test(text)) || [null, '#4a7c3a', '📅']
    })
    const accent = computed(() => type.value[1])
    const emoji = computed(() => type.value[2])

    const mapsUrl = computed(() => {
      const c = props.content || {}
      if (c.lat && c.lon) return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}`
      const q = [c.location, c.address].filter(Boolean).join(', ')
      return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
    })
    const isFree = computed(() => /gratu|libre/i.test(props.content?.price || ''))
    const longDesc = computed(() => String(props.content?.description || '').replace(/<[^>]+>/g, '').length > 380)

    return {
      closeDialog, formatDate, formatPrice, addToAgenda, addToCalendar,
      posterOk, descOpen, dateParts, accent, emoji, mapsUrl, isFree, longDesc
    }
  }
}
</script>

<style scoped>
.evd-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 12, 10, 0.55);
  backdrop-filter: blur(6px);
  animation: evd-fade 0.25s ease both;
}
.evd {
  --ink: #1f1a17;
  --ink-soft: #6b6159;
  --paper: #fffaf4;
  --card: #ffffff;
  --line: rgba(31, 26, 23, 0.1);
  width: min(760px, 100%);
  max-height: min(92vh, 900px);
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 24px;
  color: var(--ink);
  background: var(--paper);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  animation: evd-rise 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
}

/* ---------- Portada ---------- */
.evd-hero {
  position: relative;
  display: flex;
  gap: 24px;
  align-items: flex-end;
  padding: 32px 28px 26px;
  color: #fff;
  background: radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.2), transparent 50%), var(--accent);
  overflow: hidden;
}
.evd-hero-bg {
  position: absolute;
  inset: -40px;
  background-size: cover;
  background-position: center;
  filter: blur(28px) saturate(1.3) brightness(0.55);
  transform: scale(1.1);
}
.evd-hero > *:not(.evd-hero-bg):not(.evd-close) {
  position: relative;
}
.evd-poster {
  flex: 0 0 auto;
  width: 170px;
  max-height: 240px;
  object-fit: cover;
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  transform: rotate(-3deg);
  animation: evd-pop 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.1s backwards;
}
.evd-poster-empty {
  display: grid;
  place-items: center;
  height: 170px;
  font-size: 72px;
  background: rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35);
}
.evd-hero-text {
  min-width: 0;
  flex: 1;
}
.evd-date {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px 14px;
  border-radius: 999px;
  color: var(--accent);
  background: #fff;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  animation: evd-pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.4) 0.25s backwards;
}
.evd-day {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1;
}
.evd-month {
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: uppercase;
}
.evd-weekday {
  font-size: 0.8rem;
  color: #6b6159;
}
.evd-title {
  margin: 0;
  font-size: clamp(1.3rem, 3.4vw, 1.9rem);
  font-weight: 800;
  line-height: 1.15;
  color: #fff;
  text-wrap: balance;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.evd-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.evd-chip {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  background: #fff;
}
.evd-chip.ghost {
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}
.evd-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 50%;
  font-size: 1rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
.evd-close:hover,
.evd-close:focus-visible {
  background: rgba(0, 0, 0, 0.5);
}

/* ---------- Datos ---------- */
.evd-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  padding: 20px 24px 0;
}
.evd-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--line), 0 6px 18px rgba(31, 26, 23, 0.06);
  animation: evd-in 0.4s ease backwards;
  animation-delay: calc(0.2s + var(--i) * 0.06s);
}
.evd-tile-icon {
  font-size: 1.3rem;
}
.evd-tile-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.evd-tile strong {
  font-size: 0.95rem;
  line-height: 1.3;
}
.evd-tile small {
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.evd-tile-link {
  margin-top: 4px;
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
  color: var(--accent) !important;
}

/* ---------- Descripción ---------- */
.evd-desc {
  margin: 18px 24px 0;
  padding: 18px 20px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--line);
}
.evd-desc-text {
  max-height: 9.5em;
  overflow: hidden;
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--ink);
  -webkit-mask-image: linear-gradient(#000 60%, transparent);
  mask-image: linear-gradient(#000 60%, transparent);
}
.evd-desc-text.open {
  max-height: none;
  -webkit-mask-image: none;
  mask-image: none;
}
.evd-desc-text :deep(p) {
  margin: 0 0 0.7em;
}
.evd-more {
  margin-top: 6px;
  padding: 0;
  border: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
  background: none;
  cursor: pointer;
}

/* ---------- Acciones ---------- */
.evd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 18px 24px 22px;
}
.evd-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  color: var(--ink) !important;
  background: var(--card);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.evd-btn:hover,
.evd-btn:focus-visible {
  transform: translateY(-1px);
  border-color: var(--accent);
}
.evd-btn.primary {
  border-color: var(--accent);
  color: #fff !important;
  background: var(--accent);
}

@keyframes evd-fade { from { opacity: 0; } }
@keyframes evd-rise { from { opacity: 0; transform: translateY(40px) scale(0.96); } }
@keyframes evd-in { from { opacity: 0; transform: translateY(14px); } }
@keyframes evd-pop { from { opacity: 0; transform: scale(0.6) rotate(-8deg); } }

@media (prefers-reduced-motion: reduce) {
  .evd, .evd-overlay, .evd-poster, .evd-date, .evd-tile { animation: none !important; }
}

@media (max-width: 640px) {
  .evd-overlay { padding: 0; }
  .evd {
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
  .evd-hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 24px 16px 20px;
  }
  .evd-poster { width: 130px; max-height: 180px; }
  .evd-tiles { padding: 16px 16px 0; grid-template-columns: 1fr 1fr; }
  .evd-desc { margin: 16px 16px 0; }
  .evd-actions { padding: 16px; }
  .evd-btn { flex: 1 1 auto; justify-content: center; }
}
</style>

<!-- Modo oscuro (fuera de scoped: el atributo está en <html>) -->
<style>
[data-theme='dark'] .evd {
  --ink: #f3ece6;
  --ink-soft: #b9ada3;
  --paper: #1d1916;
  --card: #29231f;
  --line: rgba(255, 255, 255, 0.1);
}
[data-theme='dark'] .evd .evd-tile-link,
[data-theme='dark'] .evd .evd-more {
  color: color-mix(in srgb, var(--accent) 45%, #fff) !important;
}
</style>
