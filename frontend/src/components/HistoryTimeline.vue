<template>
  <div class="timeline-container" :class="{ 'visible': isVisible }">
    <button class="close-timeline-btn" @click="closeTimeline" title="Cerrar línea de tiempo">
      ✕
    </button>
    <div class="timeline-wrapper">
      <!-- Línea principal -->
      <div class="timeline-line"></div>
      
      <!-- Marcas de siglo -->
      <div class="century-marks">
        <div
          v-for="century in centuries"
          :key="century.label"
          class="century-mark"
          :style="{ left: century.position + '%' }"
        >
          <span class="century-label">{{ century.label }}</span>
        </div>
      </div>
      
      <!-- Eventos en la línea de tiempo -->
      <div class="timeline-events-flex">
        <div 
          v-for="(event, index) in timelineEvents" 
          :key="index"
          class="timeline-event-flex"
          @click="selectEvent(event)"
          :class="{ 'active': selectedEvent?.id === event.id }"
        >
          <div class="medallion">
            <div class="timeline-dot"></div>
          </div>
          <div class="timeline-label-flex">
            <div class="event-year">{{ event.year }}</div>
            <div class="event-title">{{ event.title }}</div>
            <div v-if="event.description" class="event-desc">{{ event.description }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Card de detalle del evento seleccionado -->
    <transition name="slide-up">
      <div v-if="selectedEvent" class="event-detail-card">
        <div class="detail-header">
          <h3>{{ selectedEvent.title }}</h3>
          <span class="detail-year">{{ selectedEvent.year }}</span>
        </div>
        <div class="detail-body">
          <p v-if="selectedEvent.description">{{ selectedEvent.description }}</p>
          <img 
            v-if="selectedEvent.image" 
            :src="selectedEvent.image" 
            :alt="selectedEvent.title"
            class="event-image"
          />
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

function romanCentury(year) {
  const century = Math.floor((year - 1) / 100) + 1
  const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI']
  return romans[century-1] || century + 'º'
}

export default {
  name: 'HistoryTimeline',
  props: {
    isVisible: {
      type: Boolean,
      default: false
    },
    events: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const selectedEvent = ref(null)

    // Calcular eventos ordenados por año
    const timelineEvents = computed(() => {
      return [...props.events].sort((a, b) => a.year - b.year)
    })

    // Calcular marcas de siglo
    const centuries = computed(() => {
      if (!timelineEvents.value.length) return []
      const minYear = timelineEvents.value[0].year
      const maxYear = timelineEvents.value[timelineEvents.value.length - 1].year
      const startCentury = Math.floor((minYear - 1) / 100) + 1
      const endCentury = Math.floor((maxYear - 1) / 100) + 1
      const marks = []
      for (let c = startCentury; c <= endCentury; c++) {
        const year = (c - 1) * 100 + 1
        const position = ((year - minYear) / (maxYear - minYear)) * 90 + 5
        marks.push({
          label: romanCentury(year),
          position: position < 0 ? 0 : position > 100 ? 100 : position
        })
      }
      return marks
    })

    const selectEvent = (event) => {
      selectedEvent.value = selectedEvent.value?.id === event.id ? null : event
    }

    const closeTimeline = () => {
      selectedEvent.value = null
      emit('close')
    }

    return {
      selectedEvent,
      timelineEvents,
      centuries,
      selectEvent,
      closeTimeline
    }
  }
}
</script>

<style scoped>
.timeline-container {
  position: fixed;
  bottom: -200px;
  left: 0;
  right: 0;
  height: 180px;
  background: linear-gradient(135deg, #f5ecd6 0%, #e7d9b1 100%);
  /* Simula pergamino suave */
  border-top: 3px solid var(--primary-color);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  z-index: 3000; /* Muy por encima de paneles laterales */
  transition: bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.timeline-container.visible {
  bottom: 0;
}

.close-timeline-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--accent-color);
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  transition: all 0.2s ease;
}

.close-timeline-btn:hover {
  background: var(--primary-hover);
  transform: scale(1.1);
}

.timeline-wrapper {
  position: relative;
  height: 100%;
  padding: 40px 50px 40px; /* Aumenta el padding inferior para textos */
  overflow-x: auto;
  overflow-y: visible;
}

.timeline-line {
  position: absolute;
  top: 60px;
  left: 5%;
  right: 5%;
  height: 4px;
  background: linear-gradient(to right, var(--primary-color), var(--accent-color));
  border-radius: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.century-marks {
  position: absolute;
  top: 30px;
  left: 5%;
  right: 5%;
  height: 30px;
  width: 90%;
  z-index: 2;
  pointer-events: none;
}

.century-mark {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
}

.century-label {
  color: #a67c2d;
  font-size: 16px;
  font-family: 'Georgia', serif;
  font-weight: 700;
  background: none;
  padding: 0 8px;
  border-radius: 0;
  box-shadow: none;
  letter-spacing: 2px;
}

.timeline-events-flex {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  z-index: 2;
  width: 100%;
  margin-top: 30px;
  margin-bottom: 20px; /* Más espacio debajo de los eventos */
}

.timeline-event-flex {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 140px;
  max-width: 180px;
  cursor: pointer;
  position: relative;
}

.medallion {
  width: 54px;
  height: 54px;
  background: radial-gradient(circle at 60% 40%, #fffbe6 0%, #a67c2d 100%);
  border: 4px solid #a67c2d;
  border-radius: 50%;
  box-shadow: 0 4px 16px rgba(166,124,45,0.25), 0 0 0 6px #fffbe6 inset;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  position: relative;
  z-index: 2;
}

.timeline-dot {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #c0392b 0%, #a67c2d 100%);
  border: 4px solid #fffbe6;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(166,124,45,0.18);
  transition: all 0.3s ease;
}

.timeline-event-flex.active .timeline-dot,
.timeline-event-flex:hover .timeline-dot {
  background: linear-gradient(135deg, #a67c2d 0%, #c0392b 100%);
  box-shadow: 0 0 0 4px #a67c2d, 0 6px 20px rgba(166,124,45,0.25);
  transform: scale(1.1);
}

.timeline-label-flex {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  margin-bottom: 10px; /* Más espacio debajo de cada evento */
}

.event-year {
  font-weight: 700;
  font-size: 18px;
  color: #c0392b;
  margin-top: 2px;
  margin-bottom: 2px;
  font-family: 'Georgia', serif;
  letter-spacing: 1px;
}

.event-title {
  font-size: 13px;
  color: #222;
  max-width: 140px;
  line-height: 1.3;
  word-wrap: break-word;
  white-space: normal;
  text-align: center;
  font-family: 'Georgia', serif;
  margin-bottom: 2px;
}

.event-desc {
  font-size: 11px;
  color: #555;
  max-width: 140px;
  text-align: center;
  font-family: 'Georgia', serif;
  margin-bottom: 2px;
  word-break: break-word;
}

/* Card de detalle */
.event-detail-card {
  position: absolute;
  bottom: 190px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 600px;
  background: var(--bg-primary);
  border: 2px solid var(--primary-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  padding: 20px;
  z-index: 1000;
  max-height: 400px;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--primary-color);
}

.detail-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.3em;
}

.detail-year {
  background: var(--primary-color);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.9em;
}

.detail-body {
  color: var(--text-secondary);
  line-height: 1.6;
}

.detail-body p {
  margin: 0 0 15px 0;
}

.event-image {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  border-radius: 8px;
  margin-top: 10px;
}

/* Animaciones */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Responsive */
@media (max-width: 768px) {
  .timeline-container {
    height: 150px;
  }
  .timeline-event {
    min-width: 70px;
    max-width: 90px;
  }
  .timeline-label {
    margin-top: 22px;
    width: 100%;
  }
  .event-title {
    font-size: 10px;
    max-width: 70px;
  }
  .event-desc {
    font-size: 9px;
    max-width: 70px;
  }
}

/* Scrollbar personalizado */
.timeline-wrapper::-webkit-scrollbar {
  height: 8px;
}

.timeline-wrapper::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 4px;
}

.timeline-wrapper::-webkit-scrollbar-thumb {
  background: var(--primary-color);
  border-radius: 4px;
}

.timeline-wrapper::-webkit-scrollbar-thumb:hover {
  background: var(--primary-hover);
}
</style>
