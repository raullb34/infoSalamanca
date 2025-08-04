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
        <h2>{{ poi.nombre }}</h2>
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
          
          <div v-if="poi.calle" class="detail-item">
            <strong>Dirección:</strong> {{ poi.calle }}
          </div>
          
          <div v-if="poi.descripcion" class="detail-item">
            <strong>Descripción:</strong>
            <div class="description-content">
              <p class="description">{{ poi.descripcion }}</p>
            </div>
          </div>
          
          <div v-if="poi.datac" class="detail-item">
            <strong>Información adicional:</strong>
            <p class="additional-info">{{ poi.datac }}</p>
          </div>
          
          <div v-if="poi.coordenadas" class="detail-item coordinates">
            <strong>Coordenadas:</strong>
            <span>{{ poi.coordenadas.lat }}°N, {{ poi.coordenadas.lng }}°W</span>
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
      if (props.poi && props.poi.id) {
        emit('addToRoute', props.poi)
        // Optionally close dialog after adding to route
        // closeDialog()
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
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}

.dialog-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  max-height: 80vh;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
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
  color: white;
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
}

.detail-item strong {
  color: #333;
  font-weight: 600;
  display: block;
  margin-bottom: 5px;
}

.description, 
.additional-info {
  margin: 8px 0 0 0;
  line-height: 1.6;
  color: #555;
  text-align: justify;
}

.description-content {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
  margin-top: 8px;
}

.description-content .description {
  margin: 0;
  font-size: 0.95em;
  line-height: 1.7;
}

.coordinates {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid #4CAF50;
}

.coordinates span {
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: #2c5aa0;
}

.dialog-footer {
  padding: 20px 25px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: #fafafa;
}

.add-to-route-btn {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
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
  background: #6c757d;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s;
}

.cancel-btn:hover {
  background: #5a6268;
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
