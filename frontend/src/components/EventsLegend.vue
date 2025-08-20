<template>
  <div id="legend">
    <button 
      v-if="showCarousel" 
      class="carousel-btn left" 
      @click="scrollLeft"
      :disabled="scrollPosition <= 0"
    >
      ‹
    </button>
    
    <div class="legend-container" ref="legendContainer" @scroll="updateScrollPosition">
      <label 
        v-for="(value, filterName) in filters" 
        :key="filterName"
        @click="onFilterClick(filterName)"
      >
        <input 
          :id="getFilterId(filterName)"
          type="checkbox" 
          class="filter-checkbox" 
          :data-category="filterName"
          :checked="value"
          @change="handleFilterChange(filterName, $event.target.checked)"
        > 
        <img 
          v-if="getIconPath(filterName)"
          class="icon-legend" 
          :src="getIconPath(filterName)"
          :alt="filterName"
        />
        {{ filterName }}
      </label>
    </div>
    
    <button 
      v-if="showCarousel" 
      class="carousel-btn right" 
      @click="scrollRight"
      :disabled="scrollPosition >= maxScroll"
    >
      ›
    </button>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

export default {
  name: 'EventsLegend',
  props: {
    filters: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['filterChange', 'filterClick'],
  setup(props, { emit }) {
    const legendContainer = ref(null)
    const showCarousel = ref(false)
    const scrollPosition = ref(0)
    const maxScroll = ref(0)

    const handleFilterChange = (filterName, isChecked) => {
      emit('filterChange', filterName, isChecked)
    }

    const getFilterId = (filterName) => {
      return filterName.toLowerCase().replace(/\s+/g, '-')
    }

    const getIconPath = (filterName) => {
      const iconMap = {
        'Tierra de Sabor': '/assets/icons/tierra-sabor.svg',
        'Teatro': '/assets/icons/teatro.png',
        'Pantallas': '/assets/icons/pantalla.png',
        'Exposición': '/assets/icons/exposición.png',
        'Carnet Joven': '/assets/icons/EYCA.png',
        'Bibliotecas y Bibliobuses': '/assets/icons/libreria-digital.png',
        'Incendios': null, // Icono pendiente
        'Cotos': null, // Icono pendiente
        'Tratamiento de Residuos': null // Icono pendiente
      }
      return iconMap[filterName] || null
    }

    // Emitir evento especial al hacer click en filtros que requieren carga de datos
    const onFilterClick = (filterName) => {
      const dataFilters = [
        'Tierra de Sabor', 'Teatro', 'Pantallas', 'Exposición', 
        'Carnet Joven', 'Bibliotecas y Bibliobuses',
        'Incendios', 'Cotos', 'Tratamiento de Residuos'
      ]
      
      if (dataFilters.includes(filterName)) {
        // Emitimos un evento especial para que el padre cargue los datos y pinte la capa
        emit('filterClick', filterName)
      }
    }

    const checkOverflow = () => {
      if (legendContainer.value) {
        const container = legendContainer.value
        showCarousel.value = container.scrollWidth > container.clientWidth
        maxScroll.value = container.scrollWidth - container.clientWidth
      }
    }

    const scrollLeft = () => {
      if (legendContainer.value) {
        legendContainer.value.scrollBy({ left: -150, behavior: 'smooth' })
      }
    }

    const scrollRight = () => {
      if (legendContainer.value) {
        legendContainer.value.scrollBy({ left: 150, behavior: 'smooth' })
      }
    }

    const updateScrollPosition = () => {
      if (legendContainer.value) {
        scrollPosition.value = legendContainer.value.scrollLeft
      }
    }

    onMounted(() => {
      checkOverflow()
      window.addEventListener('resize', checkOverflow)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', checkOverflow)
    })

    // Watcher para recalcular overflow cuando cambien los filtros
    watch(() => props.filters, () => {
      nextTick(() => {
        checkOverflow()
      })
    }, { deep: true })

    return {
      legendContainer,
      showCarousel,
      scrollPosition,
      maxScroll,
      handleFilterChange,
      getFilterId,
      getIconPath,
      onFilterClick,
      scrollLeft,
      scrollRight,
      updateScrollPosition
    }
  }
}
</script>

<style scoped>
#legend {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  width: calc(100% - 40px);
  max-width: 600px;
  background: var(--bg-primary);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 8px;
  box-shadow: var(--shadow-md);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition, all 0.3s ease);
}

#legend:hover {
  box-shadow: var(--shadow-lg);
}

.legend-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 4px 8px;
}

.legend-container::-webkit-scrollbar {
  display: none;
}

.carousel-btn {
  background: var(--primary-color);
  color: var(--text-light);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.carousel-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: scale(1.1);
}

.carousel-btn:disabled {
  background: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.5;
}

label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  gap: 8px;
  margin: 0;
  padding: 6px 12px;
  border-radius: 6px;
  transition: var(--transition, all 0.3s ease);
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
}

label:hover {
  background: var(--hover-bg);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.filter-checkbox {
  margin: 0;
  width: 16px;
  height: 16px;
  accent-color: var(--primary-color);
  cursor: pointer;
  flex-shrink: 0;
}

.icon-legend {
  width: 20px;
  height: 20px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  flex-shrink: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  #legend {
    bottom: 10px;
    width: calc(100% - 20px);
    padding: 6px;
    gap: 6px;
  }
  
  .carousel-btn {
    width: 28px;
    height: 28px;
    font-size: 16px;
  }
  
  label {
    font-size: 12px;
    padding: 5px 10px;
    gap: 6px;
  }
  
  .icon-legend {
    width: 18px;
    height: 18px;
  }
  
  .filter-checkbox {
    width: 14px;
    height: 14px;
  }
}

@media (max-width: 480px) {
  #legend {
    bottom: 5px;
    width: calc(100% - 10px);
    padding: 4px;
    gap: 4px;
  }
  
  .carousel-btn {
    width: 24px;
    height: 24px;
    font-size: 14px;
  }
  
  label {
    font-size: 11px;
    padding: 4px 8px;
    gap: 5px;
  }
  
  .icon-legend {
    width: 16px;
    height: 16px;
  }
  
  .filter-checkbox {
    width: 12px;
    height: 12px;
  }
}

/* Mejoras para accesibilidad */
label:focus-within {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.filter-checkbox:focus {
  outline: none;
}

/* Animaciones para los checkboxes */
.filter-checkbox:checked {
  animation: checkboxPulse 0.3s ease;
}

@keyframes checkboxPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* Animación verde para filtros cuando aparecen */
.legend-container {
  transition: all 0.3s ease-in-out;
}

.legend-container label {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeInScale 0.5s ease-out forwards;
}

@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Efecto de entrada escalonado para múltiples filtros */
.legend-container label:nth-child(1) { animation-delay: 0ms; }
.legend-container label:nth-child(2) { animation-delay: 100ms; }
.legend-container label:nth-child(3) { animation-delay: 200ms; }
.legend-container label:nth-child(4) { animation-delay: 300ms; }
</style>
