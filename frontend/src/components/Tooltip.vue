<template>
  <div 
    v-if="visible"
    style="position: fixed; background: rgba(0,0,0,0.85); color: white; padding: 10px 12px; border-radius: 8px; z-index: 9999; pointer-events: none; font-size: 13px; line-height: 1.3; white-space: pre-line; max-width: 260px; box-shadow: 0 6px 18px rgba(0,0,0,0.25);"
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
