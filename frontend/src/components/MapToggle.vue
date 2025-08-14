<template>
  <button 
    class="map-toggle" 
    @click="toggleTooltips"
    :title="showTooltips ? 'Ocultar tooltips del mapa' : 'Mostrar tooltips del mapa'"
  >
    <div class="toggle-container">
      <div class="toggle-track" :class="{ 'active': showTooltips }">
        <div class="toggle-thumb" :class="{ 'active': showTooltips }">
          <span class="icon">{{ showTooltips ? '🗺️' : '📍' }}</span>
        </div>
      </div>
    </div>
  </button>
</template>

<script>
export default {
  name: 'MapToggle',
  props: {
    modelValue: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:modelValue'],
  computed: {
    showTooltips: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      }
    }
  },
  methods: {
    toggleTooltips() {
      this.showTooltips = !this.showTooltips;
    }
  }
}
</script>

<style scoped>
.map-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50px;
  transition: all 0.3s ease;
  position: relative;
}

.map-toggle:hover {
  background: var(--hover-bg);
}

.toggle-container {
  position: relative;
  width: 50px;
  height: 26px;
}

.toggle-track {
  width: 100%;
  height: 100%;
  background: var(--bg-quaternary);
  border-radius: 50px;
  border: 2px solid var(--border-primary);
  position: relative;
  transition: all 0.3s ease;
  overflow: hidden;
}

/* Aplicar gradiente cuando el toggle está activo */
.toggle-track.active {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 50%, #2d7f2d 100%);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: var(--bg-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.toggle-thumb.active {
  transform: translateX(20px);
}

.icon {
  font-size: 10px;
  transition: all 0.3s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* Animación de rotación al cambiar */
.map-toggle:active .toggle-thumb {
  transform: scale(0.9);
}

.map-toggle:active .toggle-thumb.active {
  transform: translateX(20px) scale(0.9);
}

/* Efecto hover mejorado */
.map-toggle:hover .toggle-track {
  border-color: var(--primary-color);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .toggle-container {
    width: 45px;
    height: 24px;
  }
  
  .toggle-thumb {
    width: 16px;
    height: 16px;
  }
  
  .toggle-thumb.active {
    transform: translateX(17px);
  }
  
  .icon {
    font-size: 9px;
  }
}
</style>
