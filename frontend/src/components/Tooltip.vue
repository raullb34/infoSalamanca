<template>
  <div 
    v-if="visible"
    style="position: fixed; background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 6px; z-index: 9999; pointer-events: none; font-size: 14px; white-space: nowrap;"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    {{ content }}
  </div>
</template>

<script>
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
  }
}
</script>
