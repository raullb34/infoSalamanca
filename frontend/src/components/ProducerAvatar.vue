<template>
  <!-- Logotipo del productor (de su web) o, si no hay, su inicial con el color de su sección -->
  <span
    class="pav"
    :class="{ logo: logo && ok, light: logo?.light }"
    :style="{ '--size': `${size}px`, '--accent': theme.accent }"
    aria-hidden="true"
  >
    <img v-if="logo && ok" :src="logo.src" alt="" loading="lazy" @error="ok = false" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { logoFor, sectionTheme } from '@/utils/tierraSabor'

export default {
  name: 'ProducerAvatar',
  props: {
    producer: { type: Object, required: true },
    size: { type: Number, default: 44 }
  },
  setup(props) {
    const ok = ref(true)
    watch(() => props.producer?.idempresa, () => { ok.value = true })
    const logo = computed(() => logoFor(props.producer?.idempresa))
    const theme = computed(() => sectionTheme((props.producer?.secciones || [])[0]))
    const initial = computed(() => (String(props.producer?.nombre_comercial || props.producer?.nombre || '?').trim()[0] || '?').toUpperCase())
    return { ok, logo, theme, initial }
  }
}
</script>

<style scoped>
.pav {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: var(--size);
  height: var(--size);
  border-radius: 12px;
  font-size: calc(var(--size) * 0.42);
  font-weight: 800;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, #fff);
}
.pav.logo {
  padding: calc(var(--size) * 0.08);
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
/* Logotipos claros (blancos, dorados pálidos…) sobre fondo oscuro */
.pav.logo.light {
  background: #2b2622;
}
.pav img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: none !important;
}
</style>
