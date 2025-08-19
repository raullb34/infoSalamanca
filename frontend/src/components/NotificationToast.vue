<template>
  <transition name="notification">
    <div 
      v-if="visible" 
      :class="['notification', type]"
      @click="close"
    >
      <div class="notification-content">
        <span class="notification-icon">{{ icon }}</span>
        <div class="notification-text">
          <div class="notification-title">{{ title }}</div>
          <div v-if="message" class="notification-message">{{ message }}</div>
        </div>
        <button class="notification-close" @click="close">×</button>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'NotificationToast',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: 'success',
      validator: (value) => ['success', 'error', 'warning', 'info'].includes(value)
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      default: ''
    },
    duration: {
      type: Number,
      default: 4000
    },
    autoClose: {
      type: Boolean,
      default: true
    }
  },
  emits: ['close'],
  computed: {
    icon() {
      const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      }
      return icons[this.type] || icons.info
    }
  },
  watch: {
    visible(newVal) {
      if (newVal && this.autoClose) {
        this.startTimer()
      }
    }
  },
  methods: {
    close() {
      this.$emit('close')
    },
    startTimer() {
      if (this.timer) {
        clearTimeout(this.timer)
      }
      this.timer = setTimeout(() => {
        this.close()
      }, this.duration)
    }
  },
  beforeUnmount() {
    if (this.timer) {
      clearTimeout(this.timer)
    }
  }
}
</script>

<style scoped>
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  min-width: 300px;
  max-width: 400px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-primary);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.3s ease;
}

.notification:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
}

.notification.success {
  border-left: 4px solid #22c55e;
}

.notification.error {
  border-left: 4px solid #ef4444;
}

.notification.warning {
  border-left: 4px solid #f59e0b;
}

.notification.info {
  border-left: 4px solid #3b82f6;
}

.notification-content {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  gap: 12px;
}

.notification-icon {
  font-size: 1.2em;
  flex-shrink: 0;
  margin-top: 2px;
}

.notification-text {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-size: 0.95em;
}

.notification-message {
  color: var(--text-secondary);
  font-size: 0.9em;
  line-height: 1.4;
  word-wrap: break-word;
}

.notification-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5em;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.notification-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* Animaciones */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

/* Responsive */
@media (max-width: 768px) {
  .notification {
    top: 10px;
    right: 10px;
    left: 10px;
    min-width: unset;
    max-width: unset;
  }
  
  .notification-content {
    padding: 14px;
  }
  
  .notification-title {
    font-size: 0.9em;
  }
  
  .notification-message {
    font-size: 0.85em;
  }
}
</style>
