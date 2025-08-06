<template>
  <button 
    class="theme-toggle" 
    @click="toggleTheme"
    :title="isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
  >
    <div class="toggle-container">
      <div class="toggle-track">
        <div class="toggle-thumb" :class="{ 'dark': isDark() }">
          <span class="icon">{{ isDark() ? '🌙' : '☀️' }}</span>
        </div>
      </div>
    </div>
  </button>
</template>

<script>
import { useTheme } from '@/composables/useTheme'

export default {
  name: 'ThemeToggle',
  setup() {
    const { toggleTheme, isDark } = useTheme()

    return {
      toggleTheme,
      isDark
    }
  }
}
</script>

<style scoped>
.theme-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50px;
  transition: all 0.3s ease;
  position: relative;
}

.theme-toggle:hover {
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

.toggle-track::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #87CEEB 0%, #4682B4 50%, #1e3c72 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: inherit;
}

[data-theme="dark"] .toggle-track::before {
  opacity: 1;
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

.toggle-thumb.dark {
  transform: translateX(20px);
}

.icon {
  font-size: 10px;
  transition: all 0.3s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* Animación de rotación al cambiar */
.theme-toggle:active .toggle-thumb {
  transform: scale(0.9);
}

.theme-toggle:active .toggle-thumb.dark {
  transform: translateX(20px) scale(0.9);
}

/* Efecto hover mejorado */
.theme-toggle:hover .toggle-track {
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
  
  .toggle-thumb.dark {
    transform: translateX(17px);
  }
  
  .icon {
    font-size: 9px;
  }
}
</style>
