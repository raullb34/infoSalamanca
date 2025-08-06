<template>
  <div 
    v-if="isOpen" 
    class="dialog-overlay"
    @click="closeDialog"
  >
    <div 
      class="dialog-content"
      @click.stop
    >
      <div class="dialog-header">
        <h2>{{ poi.nombre || poi.name }}</h2>
        <button 
          class="close-btn"
          @click="closeDialog"
        >
          ×
        </button>
      </div>
      
      <div class="dialog-body">
        <div v-if="poi.imagen" class="poi-image">
          <img 
            :src="poi.imagen" 
            :alt="poi.nombre"
            @error="onImageError"
          />
        </div>
        
        <div class="poi-details">
          <div v-if="poi.tipomonumento" class="detail-item">
            <strong>Tipo:</strong> {{ poi.tipomonumento }}
          </div>
          
          <div v-if="poi.poblacion" class="detail-item">
            <strong>Municipio:</strong> {{ poi.poblacion }}
          </div>
          
          <div v-if="poi.calle" class="detail-item">
            <strong>Dirección:</strong> {{ poi.calle }}
          </div>
          
          <div v-if="poi.descripcion" class="detail-item">
            <strong>Descripción:</strong>
            <div class="description-content">
              <div class="description" v-html="poi.descripcion"></div>
            </div>
          </div>
          
          <div v-if="poi.datac" class="detail-item">
            <strong>Información adicional:</strong>
            <p class="additional-info">{{ poi.datac }}</p>
          </div>
          
          <div v-if="poi.latitud && poi.longitud" class="detail-item coordinates">
            <strong>Coordenadas:</strong>
            <span>{{ poi.latitud }}°N, {{ poi.longitud }}°W</span>
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button 
          id="add-to-route-btn"
          class="add-to-route-btn"
          @click="addToRoute"
        >
          <span class="btn-icon">📍</span>
          Añadir a la ruta
        </button>
        
        <button 
          class="cancel-btn"
          @click="closeDialog"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'POIDialog',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    poi: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['close', 'addToRoute'],
  setup(props, { emit }) {
    const imageExists = ref(true)
    
    const closeDialog = () => {
      emit('close')
    }
    
    const addToRoute = () => {
      console.log('POIDialog - Adding to route:', props.poi)
      if (props.poi && (props.poi.id || props.poi.nombre || props.poi.name)) {
        emit('addToRoute', props.poi)
        console.log('POIDialog - Event emitted successfully')
        // Optionally close dialog after adding to route
        closeDialog()
      } else {
        console.error('POIDialog - No valid POI data available:', props.poi)
      }
    }
    
    const onImageError = () => {
      imageExists.value = false
    }
    
    return {
      closeDialog,
      addToRoute,
      onImageError,
      imageExists
    }
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--overlay-bg);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}

.dialog-content {
  background: var(--bg-primary);
  border-radius: 12px;
  max-width: 600px;
  max-height: 80vh;
  width: 90%;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-primary);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px;
  border-bottom: 1px solid var(--border-light);
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  color: var(--text-light);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.4em;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2em;
  color: var(--text-light);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.dialog-body {
  padding: 25px;
  overflow-y: auto;
  flex: 1;
}

.poi-image {
  margin-bottom: 20px;
  text-align: center;
}

.poi-image img {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.detail-item {
  margin-bottom: 15px;
  color: var(--text-primary);
}

.detail-item strong {
  color: var(--text-primary);
  font-weight: 600;
  display: block;
  margin-bottom: 5px;
}

.description, 
.additional-info {
  margin: 8px 0 0 0;
  line-height: 1.6;
  color: var(--text-secondary);
  text-align: justify;
}

.description-content {
  background: var(--bg-secondary);
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
  margin-top: 8px;
}

.description-content .description {
  margin: 0;
  font-size: 0.95em;
  line-height: 1.7;
  color: var(--text-primary);
}

/* Estilos para HTML renderizado en la descripción */
.description-content .description p {
  margin: 0 0 1em 0;
}

.description-content .description p:last-child {
  margin-bottom: 0;
}

.description-content .description strong,
.description-content .description b {
  color: var(--text-primary);
  font-weight: 600;
}

.description-content .description em,
.description-content .description i {
  font-style: italic;
  color: var(--text-secondary);
}

.description-content .description ul,
.description-content .description ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.description-content .description li {
  margin: 0.25em 0;
  color: var(--text-primary);
}

.coordinates {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--primary-color);
}

.coordinates span {
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: var(--primary-color);
}

.dialog-footer {
  padding: 20px 25px;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: var(--bg-secondary);
}

.add-to-route-btn {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  color: var(--text-light);
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.add-to-route-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
  background: linear-gradient(135deg, #45a049, #3d8b40);
}

.add-to-route-btn:active {
  transform: translateY(0);
}

.btn-icon {
  font-size: 1.1em;
}

.cancel-btn {
  background: var(--text-secondary);
  color: var(--text-light);
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s;
}

.cancel-btn:hover {
  background: var(--text-tertiary);
}

/* Responsive design */
@media (max-width: 768px) {
  .dialog-content {
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
    flex-direction: column-reverse;
  }
  
  .add-to-route-btn,
  .cancel-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
