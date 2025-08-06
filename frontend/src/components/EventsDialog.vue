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
  box-shadow: var(--shadow-lg);
  background: var(--bg-primary);
  backdrop-filter: blur(10px);
  overflow: hidden;
  border: 1px solid var(--border-primary);
}

.modern-dialog::backdrop {
  background: var(--overlay-bg);
  backdrop-filter: blur(2px);
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
  background: none;
  border: none;
  color: var(--text-light);
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
  justify-content: flex-end;
}

.btn-close {
  background: var(--text-secondary);
  color: var(--text-light);
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s;
}

.btn-close:hover {
  background: var(--text-primary);
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
