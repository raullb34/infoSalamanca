<template>
  <!-- Tarjeta de información (bibliotecas, paradas del bibliobús): se queda abierta hasta cerrarla -->
  <div
    v-if="card"
    ref="cardEl"
    class="map-card"
    role="dialog"
    tabindex="-1"
    :aria-label="card.title"
    :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    @keydown.esc="$emit('close')"
  >
    <header class="map-card-head">
      <div>
        <h3 class="map-card-title">{{ card.title }}</h3>
        <p v-if="card.subtitle" class="map-card-subtitle">{{ card.subtitle }}</p>
      </div>
      <button type="button" class="map-card-close" aria-label="Cerrar" @click="$emit('close')">✕</button>
    </header>
    <section v-for="(section, si) in card.sections" :key="si" class="map-card-section">
      <h4 class="map-card-heading">{{ section.heading }}</h4>
      <ul class="map-card-items">
        <li v-for="(item, ii) in section.items" :key="ii" class="map-card-item">
          <span v-if="item.color" class="map-card-swatch" :style="{ background: item.color }" aria-hidden="true"></span>
          <span v-else-if="item.icon" class="map-card-icon" aria-hidden="true">{{ item.icon }}</span>
          <div class="map-card-item-body">
            <a v-if="item.href" :href="item.href" target="_blank" rel="noopener noreferrer" class="map-card-item-title">{{ item.title }}</a>
            <span v-else class="map-card-item-title">{{ item.title }}</span>
            <span v-for="(line, li) in item.lines || []" :key="li" class="map-card-line">{{ line }}</span>
            <span v-if="item.note" class="map-card-note">⚠️ {{ item.note }}</span>
          </div>
        </li>
      </ul>
    </section>
  </div>

  <!-- Etiqueta al pasar el ratón (nombre del pueblo) -->
  <div
    v-else-if="visible"
    class="map-label"
    :style="{ left: x + 'px', top: y + 'px' }"
  >{{ content }}</div>
</template>

<script>
import { nextTick, reactive, ref, watch } from 'vue'

export default {
  name: 'Tooltip',
  props: {
    visible: { type: Boolean, default: false },
    content: { type: String, default: '' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    // { title, subtitle?, sections: [{ heading, items: [{ title, href?, lines?, note?, color?, icon? }] }] }
    card: { type: Object, default: null },
    cardX: { type: Number, default: 0 },
    cardY: { type: Number, default: 0 }
  },
  emits: ['close'],
  setup(props) {
    const cardEl = ref(null)
    const pos = reactive({ x: 0, y: 0 })

    // Junto al punto pulsado, pero siempre dentro de la ventana
    const place = async () => {
      pos.x = props.cardX + 14
      pos.y = props.cardY + 14
      await nextTick()
      const el = cardEl.value
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      const margin = 8
      if (pos.x + width > window.innerWidth - margin) pos.x = Math.max(margin, props.cardX - width - 14)
      if (pos.y + height > window.innerHeight - margin) pos.y = Math.max(margin, window.innerHeight - height - margin)
      el.focus?.()
    }
    watch(() => [props.card, props.cardX, props.cardY], () => { if (props.card) place() })

    return { cardEl, pos }
  }
}
</script>

<style scoped>
.map-label {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background: rgba(20, 24, 28, 0.88);
  color: #fff;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.3;
  max-width: 260px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.map-card {
  position: fixed;
  z-index: 9999;
  width: min(320px, calc(100vw - 16px));
  max-height: min(70vh, 520px);
  overflow-y: auto;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1d2228);
  border: 1px solid var(--border-primary, rgba(0, 0, 0, 0.12));
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
  padding: 12px 14px 10px;
  font-size: 13px;
  line-height: 1.4;
  outline: none;
}
.map-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.map-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.map-card-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #5f6b77);
}
.map-card-close {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.7;
}
.map-card-close:hover,
.map-card-close:focus-visible {
  opacity: 1;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.06));
}
.map-card-section + .map-card-section {
  border-top: 1px solid var(--border-primary, rgba(0, 0, 0, 0.1));
  margin-top: 8px;
  padding-top: 8px;
}
.map-card-heading {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary, #5f6b77);
}
.map-card-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.map-card-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.map-card-swatch {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 3px;
  box-shadow: 0 0 0 2px var(--bg-primary, #fff), 0 0 0 3px rgba(0, 0, 0, 0.15);
}
.map-card-icon {
  flex: 0 0 auto;
  width: 16px;
  text-align: center;
}
.map-card-item-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.map-card-item-title {
  font-weight: 600;
  color: inherit;
}
a.map-card-item-title {
  color: var(--primary-color, #2e7d32);
  text-decoration: none;
}
a.map-card-item-title:hover {
  text-decoration: underline;
}
.map-card-line {
  color: var(--text-secondary, #5f6b77);
}
.map-card-note {
  margin-top: 2px;
  font-size: 12px;
  color: #b45309;
}
</style>
