<template>
  <dialog 
    id="eventos-dialog" 
    :open="isOpen"
    @click="handleBackdropClick"
    class="modern-dialog"
  >
    <div id="eventos-dialog-content" @click.stop>
      <div class="dialog-header">
        <h2>{{ content.title || 'Evento' }}</h2>
        <button class="close-btn" @click="closeDialog">×</button>
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
        <button class="btn-add-calendar" @click="addToAgenda">
          <span class="calendar-icon">📅</span>
          Añadir a mi agenda
        </button>
        <button class="btn-export-ics" @click="addToCalendar">
          <span class="export-icon">💾</span>
          Exportar ICS
        </button>
        <button class="btn-close" @click="closeDialog">Cerrar</button>
      </div>
    </div>
  </dialog>
</template>

<script>
import { onMounted, onUnmounted } from 'vue'

export default {
  name: 'EventsDialog',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    content: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['close', 'calendar-added', 'calendar-error', 'add-to-agenda'],
  setup(props, { emit }) {
    const closeDialog = () => {
      emit('close')
    }

    const handleBackdropClick = (event) => {
      if (event.target === event.currentTarget) {
        closeDialog()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && props.isOpen) {
        closeDialog()
      }
    }

    // Añadir/quitar listener de teclado cuando el diálogo se abre/cierra
    onMounted(() => {
      document.addEventListener('keydown', handleKeyDown)
    })
    
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeyDown)
    })

    const formatDate = (date) => {
      if (!date) return ''
      const d = new Date(date)
      return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const formatPrice = (priceString) => {
      if (!priceString) return ''
      
      // Si contiene múltiples precios separados por guiones
      if (priceString.includes('-')) {
        const prices = priceString.split('-').filter(price => price.trim())
        
        // Formatear cada precio individual
        const formattedPrices = prices.map(price => {
          // Extraer solo números, comas y puntos
          const cleanPrice = price.replace(/[^\d,.-]/g, '').trim()
          if (cleanPrice) {
            // Asegurar formato de euro
            if (!price.includes('€') && !price.toLowerCase().includes('euro')) {
              return `${cleanPrice}€`
            }
            return cleanPrice.includes('€') ? cleanPrice : `${cleanPrice}€`
          }
          return price.trim()
        })
        
        // Crear HTML estructurado para múltiples precios
        if (formattedPrices.length === 2) {
          return `
            <div class="price-breakdown">
              <span class="price-item"><strong>General:</strong> ${formattedPrices[0]}</span>
              <span class="price-item"><strong>Reducida:</strong> ${formattedPrices[1]}</span>
            </div>
          `
        } else if (formattedPrices.length === 3) {
          return `
            <div class="price-breakdown">
              <span class="price-item"><strong>General:</strong> ${formattedPrices[0]}</span>
              <span class="price-item"><strong>Reducida:</strong> ${formattedPrices[1]}</span>
              <span class="price-item"><strong>Especial:</strong> ${formattedPrices[2]}</span>
            </div>
          `
        } else {
          return `<div class="price-breakdown">${formattedPrices.map(price => `<span class="price-item">${price}</span>`).join('')}</div>`
        }
      }
      
      // Para precios simples, limpiar y formatear
      const cleanPrice = priceString.replace(/[^\d,.-]/g, '').trim()
      if (cleanPrice && !priceString.includes('€') && !priceString.toLowerCase().includes('euro')) {
        return `${cleanPrice}€`
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
        return text.toString()
          .replace(/\\/g, '\\\\')
          .replace(/;/g, '\\;')
          .replace(/,/g, '\\,')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '')
      }

      const startDate = formatICSDate(event.date, event.time)
      const endDate = formatICSDate(event.date, event.time ? 
        (parseInt(event.time.split(':')[0]) + 1) + ':' + event.time.split(':')[1] : 
        null)

      const icsContent = [
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

      return icsContent
    }

    const addToAgenda = () => {
      try {
        // Emitir evento para añadir a la agenda interna
        emit('add-to-agenda', {
          title: props.content.title,
          date: props.content.date,
          time: props.content.time,
          location: props.content.location,
          description: props.content.description,
          price: props.content.price,
          contact: props.content.contact,
          organizer: props.content.organizer,
          municipality: props.content.municipality,
          category: props.content.category
        })
        
        // Mostrar notificación de éxito
        emit('calendar-added', { 
          message: 'Evento añadido a tu agenda',
          eventTitle: props.content.title 
        })
      } catch (error) {
        console.error('Error añadiendo evento a la agenda:', error)
        emit('calendar-error', { 
          message: 'Error al añadir el evento a la agenda',
          error: error.message 
        })
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
        
        // Mostrar notificación de éxito
        emit('calendar-added', { 
          message: 'Evento añadido a tu calendario',
          eventTitle: props.content.title 
        })
      } catch (error) {
        console.error('Error generando archivo ICS:', error)
        emit('calendar-error', { 
          message: 'Error al generar el evento',
          error: error.message 
        })
      }
    }

    return {
      closeDialog,
      handleBackdropClick,
      formatDate,
      formatPrice,
      addToAgenda,
      addToCalendar
    }
  }
}
</script>

<style scoped>
.modern-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  padding: 0;
  border: none;
  border-radius: 12px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  background: var(--bg-primary);
  backdrop-filter: blur(10px);
  overflow: hidden;
  border: 1px solid var(--border-primary);
  z-index: 10000;
}

.modern-dialog::backdrop {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 9999;
}

.dialog-header {
  background: var(--bg-header);
  color: var(--text-light);
  padding: 20px 25px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.4em;
  font-weight: 600;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-light);
  font-size: 1.5em;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.close-btn:active {
  transform: scale(0.95);
}

.dialog-body {
  padding: 25px;
  overflow-y: auto;
  max-height: 60vh;
}

.event-info {
  margin-bottom: 15px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
}

.info-icon {
  font-size: 1.2em;
  flex-shrink: 0;
}

.info-item div {
  flex: 1;
  color: var(--text-secondary);
}

.info-item strong {
  color: var(--text-primary);
  font-weight: 600;
}

.price-display {
  margin-top: 4px;
}

.price-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.price-item {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(var(--primary-color-rgb), 0.1);
  border-radius: 12px;
  font-size: 0.9em;
  border: 1px solid rgba(var(--primary-color-rgb), 0.2);
}

.price-item strong {
  color: var(--primary-color);
  margin-right: 4px;
}

.event-description {
  margin: 20px 0;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
}

.event-description h4 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-weight: 600;
}

.event-description div {
  margin: 0;
  line-height: 1.6;
  color: var(--text-secondary);
  text-align: justify;
}

/* Estilos para contenido HTML en la descripción */
.event-description div p {
  margin: 0 0 10px 0;
}

.event-description div h1,
.event-description div h2,
.event-description div h3,
.event-description div h4,
.event-description div h5,
.event-description div h6 {
  color: var(--text-primary);
  margin: 15px 0 8px 0;
}

.event-description div ul,
.event-description div ol {
  margin: 10px 0;
  padding-left: 20px;
}

.event-description div li {
  margin: 5px 0;
  color: var(--text-secondary);
}

.event-description div a {
  color: var(--primary-color);
  text-decoration: none;
}

.event-description div a:hover {
  text-decoration: underline;
}

.dialog-footer {
  padding: 20px 25px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-add-calendar {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  color: white;
  border: none;
  padding: 12px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn-add-calendar:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background: linear-gradient(135deg, var(--primary-dark), var(--primary-color));
}

.btn-add-calendar:active {
  transform: translateY(0);
}

.btn-export-ics {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  border: none;
  padding: 12px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn-export-ics:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background: linear-gradient(135deg, #16a34a, #22c55e);
}

.btn-export-ics:active {
  transform: translateY(0);
}

.calendar-icon, .export-icon {
  font-size: 1.1em;
}

.btn-close {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95em;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: var(--text-secondary);
  color: var(--text-light);
  border-color: var(--text-secondary);
}

/* Responsive design */
@media (max-width: 768px) {
  .modern-dialog {
    width: 95%;
    max-height: 90vh;
  }
  
  .dialog-header {
    padding: 15px 20px;
  }
  
  .dialog-header h2 {
    font-size: 1.2em;
  }
  
  .dialog-body {
    padding: 20px;
  }
  
  .dialog-footer {
    padding: 15px 20px;
    flex-direction: column;
    gap: 10px;
  }
  
  .btn-add-calendar,
  .btn-export-ics,
  .btn-close {
    width: 100%;
    justify-content: center;
  }
}
</style>
