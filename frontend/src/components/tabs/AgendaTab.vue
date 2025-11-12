<template>
  <div class="agenda-container">
    <div class="agenda-header">
      <h3>Mi Agenda</h3>
      <div class="agenda-controls">
        <button 
          class="view-toggle" 
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
          title="Vista lista"
        >
          📋
        </button>
        <button 
          class="view-toggle" 
          :class="{ active: viewMode === 'calendar' }"
          @click="viewMode = 'calendar'"
          title="Vista calendario"
        >
          📅
        </button>
        <button 
          class="clear-all-btn"
          @click="showClearConfirm = true"
          title="Limpiar agenda"
          v-if="savedEvents.length > 0"
        >
          🗑️
        </button>
      </div>
    </div>

    <!-- Vista Lista -->
    <div v-if="viewMode === 'list'" class="agenda-content">
      <div v-if="savedEvents.length === 0" class="empty-state">
        <div class="empty-icon">📅</div>
        <h4>Tu agenda está vacía</h4>
        <p>Los eventos que añadas se mostrarán aquí</p>
      </div>

      <div v-else class="events-list">
        <div 
          v-for="event in sortedEvents" 
          :key="event.id"
          class="event-card"
          :class="{ 'past-event': isPastEvent(event) }"
          @click="openEventDetail(event)"
        >
          <div class="event-date">
            <div class="day">{{ formatDay(event.date) }}</div>
            <div class="month">{{ formatMonth(event.date) }}</div>
          </div>
          <div class="event-info">
            <h4>{{ event.title }}</h4>
            <div class="event-meta">
              <span v-if="event.time" class="time">🕐 {{ event.time }}</span>
              <span v-if="event.location" class="location">📍 {{ event.location }}</span>
            </div>
          </div>
          <div class="event-actions">
            <button 
              class="action-btn export-btn"
              @click.stop="exportEvent(event)"
              title="Exportar ICS"
            >
              💾
            </button>
            <button 
              class="action-btn remove-btn"
              @click.stop="removeEvent(event.id)"
              title="Eliminar"
            >
              ❌
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Vista Calendario -->
    <div v-if="viewMode === 'calendar'" class="calendar-view">
      <div class="calendar-header">
        <button class="nav-btn" @click="previousMonth">‹</button>
        <h4>{{ currentMonthYear }}</h4>
        <button class="nav-btn" @click="nextMonth">›</button>
      </div>
      
      <div class="calendar-grid">
        <div class="weekday" v-for="day in weekdays" :key="day">{{ day }}</div>
        <div 
          v-for="date in calendarDays" 
          :key="date.key"
          class="calendar-day"
          :class="{ 
            'other-month': date.otherMonth,
            'today': date.isToday,
            'has-events': date.events.length > 0
          }"
        >
          <span class="day-number">{{ date.day }}</span>
          <div class="day-events">
            <div 
              v-for="event in date.events.slice(0, 2)" 
              :key="event.id"
              class="day-event"
              @click="openEventDetail(event)"
            >
              {{ event.title }}
            </div>
            <div v-if="date.events.length > 2" class="more-events">
              +{{ date.events.length - 2 }} más
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmación de limpieza -->
    <div v-if="showClearConfirm" class="confirm-overlay" @click="showClearConfirm = false">
      <div class="confirm-dialog" @click.stop>
        <h4>¿Limpiar agenda?</h4>
        <p>Se eliminarán todos los eventos guardados</p>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="showClearConfirm = false">Cancelar</button>
          <button class="btn-confirm" @click="clearAllEvents">Limpiar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  name: 'AgendaTab',
  emits: ['event-selected', 'event-exported'],
  setup(props, { emit }) {
    const savedEvents = ref([])
    const viewMode = ref('list')
    const showClearConfirm = ref(false)
    const currentDate = ref(new Date())

    const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    // Cargar eventos del localStorage
    const loadEvents = () => {
      try {
        const stored = localStorage.getItem('infoSalamanca_agenda')
        if (stored) {
          savedEvents.value = JSON.parse(stored)
        }
      } catch (error) {
        console.error('Error cargando eventos:', error)
      }
    }

    // Guardar eventos en localStorage
    const saveEvents = () => {
      try {
        localStorage.setItem('infoSalamanca_agenda', JSON.stringify(savedEvents.value))
      } catch (error) {
        console.error('Error guardando eventos:', error)
      }
    }

    // Añadir evento a la agenda
    const addEvent = (eventData) => {
      const newEvent = {
        id: Date.now() + Math.random(),
        ...eventData,
        addedAt: new Date().toISOString()
      }
      savedEvents.value.push(newEvent)
      saveEvents()
      return newEvent
    }

    // Eliminar evento
    const removeEvent = (eventId) => {
      savedEvents.value = savedEvents.value.filter(event => event.id !== eventId)
      saveEvents()
    }

    // Limpiar todos los eventos
    const clearAllEvents = () => {
      savedEvents.value = []
      saveEvents()
      showClearConfirm.value = false
    }

    // Eventos ordenados por fecha
    const sortedEvents = computed(() => {
      return [...savedEvents.value].sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        return dateA - dateB
      })
    })

    // Verificar si un evento es pasado
    const isPastEvent = (event) => {
      const eventDate = new Date(event.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return eventDate < today
    }

    // Formateo de fechas
    const formatDay = (date) => {
      return new Date(date).getDate()
    }

    const formatMonth = (date) => {
      return new Date(date).toLocaleDateString('es-ES', { month: 'short' })
    }

    // Vista calendario
    const currentMonthYear = computed(() => {
      return currentDate.value.toLocaleDateString('es-ES', { 
        month: 'long', 
        year: 'numeric' 
      })
    })

    const calendarDays = computed(() => {
      const year = currentDate.value.getFullYear()
      const month = currentDate.value.getMonth()
      
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const startDate = new Date(firstDay)
      
      // Ajustar para empezar en lunes (0 = domingo, 1 = lunes)
      const dayOfWeek = firstDay.getDay()
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      startDate.setDate(startDate.getDate() - offset)
      
      const days = []
      const today = new Date()
      
      for (let i = 0; i < 42; i++) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + i)
        
        const dayEvents = savedEvents.value.filter(event => {
          const eventDate = new Date(event.date)
          return eventDate.toDateString() === date.toDateString()
        })
        
        days.push({
          key: date.toISOString(),
          day: date.getDate(),
          otherMonth: date.getMonth() !== month,
          isToday: date.toDateString() === today.toDateString(),
          events: dayEvents
        })
      }
      
      return days
    })

    const previousMonth = () => {
      currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
    }

    const nextMonth = () => {
      currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
    }

    // Abrir detalle del evento
    const openEventDetail = (event) => {
      emit('event-selected', event)
    }

    // Exportar evento individual
    const exportEvent = (event) => {
      emit('event-exported', event)
    }

    // Exponer métodos para uso externo
    const addEventToAgenda = (eventData) => {
      return addEvent(eventData)
    }

    onMounted(() => {
      loadEvents()
    })

    return {
      savedEvents,
      viewMode,
      showClearConfirm,
      currentDate,
      weekdays,
      sortedEvents,
      currentMonthYear,
      calendarDays,
      addEventToAgenda,
      removeEvent,
      clearAllEvents,
      isPastEvent,
      formatDay,
      formatMonth,
      previousMonth,
      nextMonth,
      openEventDetail,
      exportEvent
    }
  }
}
</script>

<style scoped>
.agenda-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.agenda-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 15px;
}

.agenda-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.1em;
}

.agenda-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.view-toggle {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s ease;
}

.view-toggle.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.view-toggle:hover:not(.active) {
  background: var(--bg-tertiary);
}

.clear-all-btn {
  background: none;
  border: none;
  font-size: 1.1em;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-all-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.agenda-content {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 3em;
  margin-bottom: 15px;
}

.empty-state h4 {
  margin: 0 0 10px 0;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  font-size: 0.9em;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.event-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.event-card:hover {
  background: var(--bg-tertiary);
  transform: translateX(2px);
}

.event-card.past-event {
  opacity: 0.6;
  border-left-color: var(--text-secondary);
}

.event-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 50px;
  background: var(--primary-color);
  color: white;
  border-radius: 6px;
  padding: 8px 6px;
}

.event-date .day {
  font-size: 1.2em;
  font-weight: bold;
  line-height: 1;
}

.event-date .month {
  font-size: 0.8em;
  text-transform: uppercase;
}

.event-info {
  flex: 1;
  min-width: 0;
}

.event-info h4 {
  margin: 0 0 4px 0;
  color: var(--text-primary);
  font-size: 0.95em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event-meta span {
  font-size: 0.8em;
  color: var(--text-secondary);
}

.event-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  background: none;
  border: none;
  font-size: 0.9em;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.export-btn:hover {
  background: rgba(34, 197, 94, 0.1);
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Vista calendario */
.calendar-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  margin-bottom: 15px;
}

.calendar-header h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1em;
  text-transform: capitalize;
}

.nav-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 1.2em;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(80px, 1fr));
  gap: 1px;
  background: var(--border-light);
  border-radius: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  /* Enable horizontal scrolling on mobile/small screens */
  scrollbar-width: thin;
  scrollbar-color: var(--primary-color) var(--bg-secondary);
}

.calendar-grid::-webkit-scrollbar {
  height: 6px;
}

.calendar-grid::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 3px;
}

.calendar-grid::-webkit-scrollbar-thumb {
  background: var(--primary-color);
  border-radius: 3px;
}

.calendar-grid::-webkit-scrollbar-thumb:hover {
  background: var(--primary-hover);
}

.weekday {
  background: var(--bg-header);
  color: var(--text-light);
  padding: 8px 4px;
  text-align: center;
  font-size: 0.8em;
  font-weight: 600;
  min-width: 80px;
}

.calendar-day {
  background: var(--bg-primary);
  min-height: 60px;
  min-width: 80px;
  padding: 4px;
  position: relative;
  display: flex;
  flex-direction: column;
}

.calendar-day.other-month {
  background: var(--bg-secondary);
  opacity: 0.5;
}

.calendar-day.today {
  background: rgba(var(--primary-color-rgb), 0.1);
}

.calendar-day.has-events {
  border-top: 3px solid var(--primary-color);
}

.day-number {
  font-size: 0.8em;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 2px;
}

.day-events {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.day-event {
  background: var(--primary-color);
  color: white;
  font-size: 0.7em;
  padding: 1px 3px;
  border-radius: 2px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-events {
  font-size: 0.6em;
  color: var(--text-secondary);
  padding: 1px 3px;
}

/* Confirmación */
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.confirm-dialog {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 20px;
  max-width: 300px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-primary);
}

.confirm-dialog h4 {
  margin: 0 0 10px 0;
  color: var(--text-primary);
}

.confirm-dialog p {
  margin: 0 0 20px 0;
  color: var(--text-secondary);
  font-size: 0.9em;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-cancel, .btn-confirm {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s ease;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-confirm {
  background: #ef4444;
  color: white;
}

.btn-cancel:hover {
  background: var(--bg-tertiary);
}

.btn-confirm:hover {
  background: #dc2626;
}

/* Responsive */
@media (max-width: 768px) {
  .agenda-controls {
    gap: 4px;
  }
  
  .event-card {
    padding: 10px;
    gap: 10px;
  }
  
  .event-date {
    min-width: 45px;
    padding: 6px 4px;
  }
  
  .calendar-day {
    min-height: 50px;
  }
  
  .day-event {
    font-size: 0.65em;
  }
}
</style>
