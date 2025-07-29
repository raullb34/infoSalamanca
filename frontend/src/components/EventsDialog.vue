<template>
  <dialog 
    id="eventos-dialog" 
    :open="isOpen"
    @click="handleBackdropClick"
  >
    <div id="eventos-dialog-content" @click.stop>
      <h2>{{ content.title || 'Evento' }}</h2>
      <div v-if="content.date" class="event-date">
        <strong>Fecha:</strong> {{ formatDate(content.date) }}
      </div>
      <div v-if="content.time" class="event-time">
        <strong>Hora:</strong> {{ content.time }}
      </div>
      <div v-if="content.location" class="event-location">
        <strong>Lugar:</strong> {{ content.location }}
      </div>
      <div v-if="content.description" class="event-description">
        <p>{{ content.description }}</p>
      </div>
      <div v-if="content.price" class="event-price">
        <strong>Precio:</strong> {{ content.price }}
      </div>
      <div v-if="content.contact" class="event-contact">
        <strong>Contacto:</strong> {{ content.contact }}
      </div>
    </div>
    <button id="cerrar-dialog" @click="closeDialog">Cerrar</button>
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
dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border: none;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  padding: 0;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  z-index: 10000;
}

dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

#eventos-dialog-content {
  padding: 20px;
}

h2 {
  color: #333;
  margin: 0 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #4CAF50;
}

.event-date,
.event-time,
.event-location,
.event-price,
.event-contact {
  margin: 10px 0;
  color: #555;
}

.event-description {
  margin: 15px 0;
  color: #666;
  line-height: 1.6;
}

#cerrar-dialog {
  position: sticky;
  bottom: 0;
  width: 100%;
  background-color: #f1f1f1;
  border: none;
  border-top: 1px solid #ddd;
  padding: 15px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

#cerrar-dialog:hover {
  background-color: #e1e1e1;
}
</style>
