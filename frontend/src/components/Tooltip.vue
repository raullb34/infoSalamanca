<template>
  <div 
    id="tooltip" 
    v-show="visible"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    {{ content }}
  </div>
</template>

<script>
import { onMounted, onUnmounted } from 'vue'

export default {
  name: 'Tooltip',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    content: {
      type: String,
      default: ''
    },
    x: {
      type: Number,
      default: 0
    },
    y: {
      type: Number,
      default: 0
    }
  },
  setup(props, { emit }) {
    const handleShowTooltip = (event) => {
      emit('show', {
        content: event.detail.content,
        x: event.detail.x,
        y: event.detail.y
      })
    }

    const handleHideTooltip = () => {
      emit('hide')
    }

    onMounted(() => {
      window.addEventListener('showTooltip', handleShowTooltip)
      window.addEventListener('hideTooltip', handleHideTooltip)
    })

    onUnmounted(() => {
      window.removeEventListener('showTooltip', handleShowTooltip)
      window.removeEventListener('hideTooltip', handleHideTooltip)
    })

    return {}
  }
}
</script>

<style scoped>
.tooltip {
  position: fixed;
  z-index: 1000;
  padding: 8px 12px;
  background: var(--tooltip-background);
  color: var(--tooltip-color);
  border-radius: 6px;
  font-size: 14px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
  border: 1px solid var(--tooltip-border, rgba(255, 255, 255, 0.1));
}
</style>
