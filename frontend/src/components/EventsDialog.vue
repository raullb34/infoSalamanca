<template>
  <div 
    v-if="isOpen" 
    class="events-overlay" 
    role="dialog" 
    aria-modal="true" 
    aria-labelledby="event-dialog-title"
    @click="closeDialog"
  >
    <div 
      id="eventos-dialog-content" 
      class="events-dialog glass-panel" 
      @click.stop
    >
      <div class="dialog-header">
        <h2 id="event-dialog-title" class="dialog-title" :title="content.title">{{ content.title || 'Evento' }}</h2>
        <button class="close-btn" @click="closeDialog" aria-label="Cerrar">×</button>
      </div>

      <div class="dialog-body">
        <div v-if="content.date" class="event-info">
          <div class="info-item">
            <span class="info-icon">📅</span>
            <div>
              <strong>Fecha:</strong> {{ formatDate(content.date) }}
            </div>
          </div>
        </div>
        <div v-if="content.time" class="event-info">
          <div class="info-item">
            <span class="info-icon">🕐</span>
            <div>
              <strong>Hora:</strong> {{ content.time }}
            </div>
          </div>
        </div>
        <div v-if="content.location" class="event-info">
          <div class="info-item">
            <span class="info-icon">📍</span>
            <div>
              <strong>Lugar:</strong> {{ content.location }}
            </div>
          </div>
        </div>
        <div v-if="content.category" class="event-info">
          <div class="info-item">
            <span class="info-icon">🏷️</span>
            <div>
              <strong>Categoría:</strong> {{ content.category }}
            </div>
          </div>
        </div>
        <div v-if="content.description" class="event-description">
          <h4>Descripción</h4>
          <div v-html="content.description"></div>
        </div>
        <div v-if="content.price" class="event-info">
          <div class="info-item">
            <span class="info-icon">💰</span>
            <div>
              <strong>Precio:</strong>
              <div class="price-display" v-html="formatPrice(content.price)"></div>
            </div>
          </div>
        </div>
        <div v-if="content.contact" class="event-info">
          <div class="info-item">
            <span class="info-icon">📞</span>
            <div>
              <strong>Contacto:</strong> {{ content.contact }}
            </div>
          </div>
        </div>
        <div v-if="content.organizer" class="event-info">
          <div class="info-item">
            <span class="info-icon">🎪</span>
            <div>
              <strong>Organizador:</strong> {{ content.organizer }}
            </div>
          </div>
        </div>
        <div v-if="content.municipality" class="event-info">
          <div class="info-item">
            <span class="info-icon">🏘️</span>
            <div>
              <strong>Municipio:</strong> {{ content.municipality }}
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <div class="footer-actions">
          <button class="btn-add-calendar" @click="addToAgenda">
            <span class="calendar-icon">📅</span>
            Añadir a mi agenda
          </button>
          <button class="btn-export-ics" @click="addToCalendar">
            <span class="export-icon">💾</span>
            Exportar ICS
          </button>
        </div>
        <button class="btn-close" @click="closeDialog">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, onUnmounted } from 'vue'

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

    return { closeDialog, formatDate, formatPrice, addToAgenda, addToCalendar }
  }
}
</script>

<style scoped>
.events-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 40px 20px;
}

.events-dialog {
  width: 100%;
  max-width: 620px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  box-shadow: 0 25px 50px rgba(0,0,0,0.35);
  overflow: hidden;
  position: relative;
  animation: scaleFade 0.28s cubic-bezier(.4,0,.2,1);
}

.glass-panel { background: var(--glass-bg); backdrop-filter: blur(14px) saturate(130%); }

@keyframes scaleFade { from { opacity:0; transform:scale(.96);} to { opacity:1; transform:scale(1);} }

.dialog-header {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  color: var(--text-light);
  padding: 18px 24px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 16px;
  position: relative;
}

.dialog-title {
  margin: 0;
  font-size: 1.35em;
  font-weight: 600;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-light);
  font-size: 1.4em;
  cursor: pointer;
  padding: 0;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}
.close-btn:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); transform: scale(1.05); }
.close-btn:active { transform: scale(0.95); }

.dialog-body { padding: 24px; overflow-y: auto; max-height: 58vh; }

.event-info { margin-bottom: 15px; }
.info-item { display:flex; align-items:flex-start; gap:12px; padding:12px; background: var(--bg-secondary); border-radius:8px; border-left:4px solid var(--primary-color); }
.info-icon { font-size:1.2em; flex-shrink:0; }
.info-item div { flex:1; color: var(--text-secondary); }
.info-item strong { color: var(--text-primary); font-weight:600; }

.price-display { margin-top:4px; }
.price-breakdown { display:flex; flex-direction:column; gap:4px; margin-top:4px; }
.price-item { display:inline-block; padding:2px 8px; background: rgba(var(--primary-color-rgb),0.1); border-radius:12px; font-size:0.9em; border:1px solid rgba(var(--primary-color-rgb),0.2); }
.price-item strong { color: var(--primary-color); margin-right:4px; }

.event-description { margin:20px 0; padding:20px; background: var(--bg-secondary); border-radius:8px; border-left:4px solid var(--primary-color); }
.event-description h4 { margin:0 0 12px 0; color: var(--text-primary); font-weight:600; }
.event-description div { margin:0; line-height:1.6; color: var(--text-secondary); text-align:justify; }
.event-description div p { margin:0 0 10px 0; }
.event-description div a { color: var(--primary-color); text-decoration:none; }
.event-description div a:hover { text-decoration:underline; }

.dialog-footer { padding:18px 24px; border-top:1px solid var(--border-light); background: var(--bg-secondary); display:flex; align-items:center; gap:16px; }
.footer-actions { display:flex; gap:12px; flex-wrap:wrap; }

.btn-add-calendar, .btn-export-ics {
  color:#fff; border:none; padding:12px 18px; border-radius:8px; cursor:pointer; font-size:0.9em; font-weight:500; display:flex; align-items:center; gap:8px; transition: all .2s ease; box-shadow:0 2px 8px rgba(0,0,0,.1);
}
.btn-add-calendar { background: linear-gradient(135deg, var(--primary-color), var(--primary-dark)); }
.btn-add-calendar:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.15); background: linear-gradient(135deg, var(--primary-dark), var(--primary-color)); }
.btn-export-ics { background: linear-gradient(135deg, #22c55e, #16a34a); }
.btn-export-ics:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.15); background: linear-gradient(135deg, #16a34a, #22c55e); }

.btn-close { margin-left:auto; background: var(--bg-tertiary); color: var(--text-primary); border:1px solid var(--border-primary); padding:12px 22px; border-radius:8px; cursor:pointer; font-size:0.9em; font-weight:500; transition: all .2s ease; backdrop-filter:blur(4px); }
.btn-close:hover { background: var(--primary-color); color: var(--text-light); border-color: var(--primary-color); }

@media (max-width: 768px) {
  .events-overlay { padding:20px 12px; }
  .events-dialog { max-height:88vh; }
  .dialog-header { padding:16px 18px; }
  .dialog-title { font-size:1.15em; }
  .dialog-body { padding:20px 18px; max-height:60vh; }
  .dialog-footer { flex-direction:column; align-items:stretch; }
  .footer-actions { width:100%; }
  .btn-add-calendar, .btn-export-ics, .btn-close { width:100%; justify-content:center; }
}
</style>
