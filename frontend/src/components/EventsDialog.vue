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
          <p>{{ content.description }}</p>
        </div>
        
        <div v-if="content.price" class="event-info">
          <div class="info-item">
            <span class="info-icon">💰</span>
            <div>
              <strong>Precio:</strong> {{ content.price }}
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
      </div>
      
      <div class="dialog-footer">
        <button class="btn-close" @click="closeDialog">Cerrar</button>
      </div>
    </div>
  </dialog>
</template>

<script>
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
  emits: ['close'],
  setup(props, { emit }) {
    const closeDialog = () => {
      emit('close')
    }

    const handleBackdropClick = (event) => {
      if (event.target === event.currentTarget) {
        closeDialog()
      }
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
      closeDialog,
      handleBackdropClick,
      formatDate
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
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  background: white;
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.modern-dialog::backdrop {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
}

.dialog-header {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
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
  background: none;
  border: none;
  color: white;
  font-size: 2em;
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
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
}

.info-icon {
  font-size: 1.2em;
  flex-shrink: 0;
}

.info-item div {
  flex: 1;
}

.info-item strong {
  color: #333;
  font-weight: 600;
}

.event-description {
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
}

.event-description h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-weight: 600;
}

.event-description p {
  margin: 0;
  line-height: 1.6;
  color: #555;
  text-align: justify;
}

.dialog-footer {
  padding: 20px 25px;
  border-top: 1px solid #eee;
  background: #fafafa;
  display: flex;
  justify-content: flex-end;
}

.btn-close {
  background: #6c757d;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s;
}

.btn-close:hover {
  background: #5a6268;
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
  }
  
  .btn-close {
    width: 100%;
  }
}
</style>
