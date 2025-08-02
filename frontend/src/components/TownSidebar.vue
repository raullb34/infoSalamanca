<template>
  <div id="sidebar" :class="{ 'open': isOpen }">
    <button id="close-btn" @click="handleClose">Cerrar</button>
    
    <h2 id="town-name">{{ townName.name || 'Selecciona un pueblo' }}</h2>
    
    <div id="town-info-container">
      <div id="town-shape"></div>
      <div id="town-flags-shields" style="display: flex; gap: 32px; align-items: center; justify-content: center; margin: 24px 0;">
        <div id="town-flag" v-if="townFlag && flagExists">
          <img :src="townFlag" @error="onFlagError" style="height: 120px; max-width: 220px; object-fit: contain; box-shadow: 0 2px 12px #0002; border-radius: 8px; background: #fff;" />
        </div>
        <div id="town-shield" v-if="townShield && shieldExists">
          <img :src="townShield" @error="onShieldError" style="height: 120px; max-width: 120px; object-fit: contain; box-shadow: 0 2px 12px #0002; border-radius: 8px; background: #fff;" />
        </div>
      </div>
    </div>
    
    <div class="info-scroll">
      <!-- Información general -->
      <div id="info-content">
        <h3>Información</h3>
        <div v-if="isLoading" class="loading">
          Cargando información...
        </div>
        <div v-else-if="townInfo" class="town-details">
          <p v-if="townInfo.poblacion">
            <strong>Población:</strong> {{ townInfo.poblacion }} hab.
          </p>
          <p v-if="townInfo.latitud">
            <strong>Latitud:</strong> {{ townInfo.latitud }}° N
          </p>
          <p v-if="townInfo.longitud">
            <strong>Longitud:</strong> {{ townInfo.longitud }}° W
          </p>
          <div v-if="townInfo.mancomunidades" class="description">
            <p>{{ townInfo.mancomunidades}}</p>
          </div>
        </div>
        <p v-else>
          Selecciona un municipio para ver su información.
        </p>
      </div>
      
      <!-- Eventos -->
      <div id="events-container">
        <h3>Eventos</h3>
        <div v-if="events.length > 0" id="events-list">
          <div 
            v-for="event in events" 
            :key="event.id"
            class="event-item"
            @click="openEventDialog(event)"
          >
            <h4>{{ event.titulo }}</h4>
            <p class="event-date">{{ formatDate(event.fecha_inicio) }}</p>
            <p class="event-category">{{ event.categoria }}</p>
          </div>
        </div>
        <p v-else class="no-items">
          No hay eventos programados.
        </p>
      </div>
      
      <!-- Puntos de interés -->
      <div id="poi-container">
        <h3>¿Qué ver?</h3>
        <div v-if="pointsOfInterest.length > 0" id="poi-list">
          <div 
            v-for="poi in pointsOfInterest" 
            :key="poi.id"
            class="poi-item"
          >
            <h4>{{ poi.nombre }}</h4>
            <p>{{ poi.tipomonumento }}</p>
            <p v-if="poi.calle" class="poi-address">
              <strong>Dirección:</strong> {{ poi.calle }}
            </p>
          </div>
        </div>
        <p v-else class="no-items">
          No hay puntos de interés registrados.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useTownStore } from '@/store/townStore'
import { ref, watch, nextTick } from 'vue'

export default {
  name: 'TownSidebar',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    townName: {
      type: Object,
      default: () => ({ id: '', name: '' })
    },
    townInfo: {
      type: Object,
      default: null
    },
    events: {
      type: Array,
      default: () => []
    },
    pointsOfInterest: {
      type: Array,
      default: () => []
    },
  },
  emits: ['close', 'openEventDialog'],
  setup(props, { emit }) {
    const shapeContainer = ref(null)
    const townStore = useTownStore()
    const flagExists = ref(true)
    const shieldExists = ref(true)
    
    const isLoading = computed(() => townStore.isLoading)
    
    const codPostal = computed(() => {
      return props.townInfo && Array.isArray(props.townInfo.cod_postal) && props.townInfo.cod_postal.length > 0
        ? props.townInfo.cod_postal[0]
        : 'N/A';
    })


    const townFlag = computed(() => {
      if (!props.townName || !codPostal.value || codPostal.value === 'N/A') return null
      const flagName = props.townName.id + '_' + props.townName.name.toLowerCase()
      return `/assets/flags/${flagName}_bandera.png`
    })

    const townShield = computed(() => {
      if (!props.townName || !props.townName.id || !props.townName.name) return null
      // El escudo está en /public/shields/INE_nombre con espacios_shield.svg
      const shieldName = `${props.townName.id}_${props.townName.name.toLowerCase()}_shield.svg`
      return `/assets/shields/${shieldName}`
    })

    watch(() => props.townName, async (newTown) => {
      // Resetear estado de imágenes
      flagExists.value = true
      shieldExists.value = true
      
      await nextTick()
      if (!shapeContainer.value) return
      shapeContainer.value.innerHTML = ""
      if (newTown && newTown.svgPath) {
        shapeContainer.value.innerHTML = newTown.svgPath
      }
    }, { immediate: true })

    const onFlagError = () => {
      flagExists.value = false
    }

    const onShieldError = () => {
      shieldExists.value = false
    }

    const handleClose = () => {
      emit('close')
      // También llamar al método global para deseleccionar en el mapa
      if (window.mapDeselectTown) {
        window.mapDeselectTown()
      }
    }

    const openEventDialog = (event) => {
      emit('openEventDialog', event)
    }

    const formatDate = (date) => {
      if (!date) return ''
      const d = new Date(date)
      return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    return {
      isLoading,
      townFlag,
      townShield,
      codPostal,
      flagExists,
      shieldExists,
      handleClose,
      openEventDialog,
      formatDate,
      onFlagError,
      onShieldError,
      shapeContainer
    }
  }
}
</script>

<style scoped>
#sidebar {
  width: 450px;
  height: 100vh;
  position: fixed;
  right: -450px;
  top: 0;
  background-color: rgba(255, 255, 255, 0.95);
  box-shadow: -2px 0 5px rgba(0,0,0,0.5);
  transition: right 0.4s ease;
  padding: 20px;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow-y: auto;
}

#sidebar.open {
  right: 0;
}

#close-btn {
  align-self: flex-end;
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 15px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 10px;
}

#close-btn:hover {
  background-color: #45a049;
}

#town-name {
  color: #333;
  margin: 10px 0;
  font-size: 1.5em;
}

#town-info-container {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

#town-flag img {
  max-width: 300px;
  max-height: 180px;
  margin-left: 15px;
  border: 1px solid #ddd;
}

.info-scroll {
  flex: 1;
  overflow-y: auto;
}

.loading {
  color: #666;
  font-style: italic;
  padding: 20px 0;
}

.town-details p {
  margin: 8px 0;
  color: #555;
}

.description {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.event-item, .poi-item {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 12px;
  margin: 10px 0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.event-item:hover {
  background: #f0f0f0;
}

.event-item h4, .poi-item h4 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 1.1em;
}

.event-date {
  color: #666;
  font-size: 0.9em;
  margin: 4px 0;
}

.event-category {
  color: #888;
  font-size: 0.85em;
  font-weight: bold;
  text-transform: uppercase;
}

.poi-address {
  color: #666;
  font-size: 0.9em;
  margin-top: 8px;
}

.no-items {
  color: #999;
  font-style: italic;
  padding: 20px 0;
  text-align: center;
}

h3 {
  color: #333;
  border-bottom: 2px solid #4CAF50;
  padding-bottom: 5px;
  margin: 20px 0 15px 0;
}
</style>
