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
#tooltip {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  pointer-events: none;
  z-index: 10000;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>
