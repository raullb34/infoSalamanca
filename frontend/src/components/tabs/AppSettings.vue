<template>
  <!-- Pestaña Ajustes: filas agrupadas, cada una con lo que hace dicho en una línea -->
  <div class="as">
    <section class="as-group" aria-labelledby="as-look">
      <h3 id="as-look" class="as-h">Apariencia</h3>
      <div class="as-card">
        <div class="as-row as-theme" role="radiogroup" aria-labelledby="as-theme-label">
          <span id="as-theme-label" class="as-label">Tema</span>
          <p class="as-hint">Automático sigue al modo claro u oscuro de tu dispositivo.</p>
          <div class="as-segmented">
            <label v-for="o in THEMES" :key="o.value">
              <input v-model="themeChoice" type="radio" name="as-theme" :value="o.value" />
              <span><span aria-hidden="true">{{ o.icon }}</span> {{ o.label }}</span>
            </label>
          </div>
        </div>
      </div>
    </section>

    <section class="as-group" aria-labelledby="as-map">
      <h3 id="as-map" class="as-h">Mapa y panel</h3>
      <div class="as-card">
        <label class="as-row as-switch-row">
          <span class="as-text">
            <span class="as-label">Nombre del pueblo al pasar el ratón</span>
            <span class="as-hint">Una etiqueta con el nombre y un resumen sobre el mapa.</span>
          </span>
          <input :checked="showTooltips" type="checkbox" switch role="switch" class="as-switch" @change="$emit('toggleTooltips', $event.target.checked)" />
        </label>
        <label class="as-row as-switch-row">
          <span class="as-text">
            <span class="as-label">Abrir este panel al elegir un filtro</span>
            <span class="as-hint">Para ver la lista de resultados. En el móvil no se abre solo.</span>
          </span>
          <input :checked="autoExpandSidebar" type="checkbox" switch role="switch" class="as-switch" @change="$emit('toggleAutoExpand', $event.target.checked)" />
        </label>
      </div>
    </section>

    <p class="as-foot">Los ajustes se guardan en este navegador.</p>

    <!-- Reconocimiento: premio del IX Concurso de Datos Abiertos de la Junta (Orden PRE/1253/2025, BOCYL 11-11-2025).
         Los logos son ficheros en public/assets/premios/: si alguno falta, no se enseña (queda el texto). -->
    <a class="as-award" :href="AWARD.url" target="_blank" rel="noopener noreferrer">
      <span v-if="logos.length" class="as-award-logos">
        <img v-for="l in logos" :key="l.src" :src="l.src" :alt="l.alt" :width="l.width" :height="l.height" loading="lazy" @error="logos = logos.filter(x => x !== l)" />
      </span>
      <span class="as-award-text">
        <span class="as-award-kicker"><span aria-hidden="true">🏆</span> Proyecto premiado</span>
        <strong>{{ AWARD.premio }}</strong>
        <span>{{ AWARD.concurso }}</span>
        <small>{{ AWARD.detalle }} · Ver los premiados ↗</small>
      </span>
    </a>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import { useTheme } from '@/composables/useTheme'

const THEMES = [
  { value: 'light', label: 'Claro', icon: '☀️' },
  { value: 'dark', label: 'Oscuro', icon: '🌙' },
  { value: 'system', label: 'Automático', icon: '🖥️' }
]

// Premio: premios «Datos Abiertos de la Comunidad de Castilla y León» 2025 (convocados por la Orden de 14 de julio
// de 2025 de la Consejería de la Presidencia; concedidos por la Orden PRE/1253/2025). Al aceptarlo se acordó hacerlo
// constar en los usos del proyecto con el logo de la Junta que facilita la Consejería de la Presidencia: ese fichero,
// tal cual, va en public/assets/premios/ y en AWARD_LOGOS.
const AWARD = {
  premio: 'Premio Estudiantes',
  concurso: 'Premios «Datos Abiertos de la Comunidad de Castilla y León» 2025',
  detalle: 'Categoría Productos y Servicios · IX edición',
  url: 'https://datosabiertos.jcyl.es/web/jcyl/RISP/es/Plantilla100/1285578390190/_/_/_'
}
// El logo de la cabecera de www.jcyl.es (futuretense_cs/JCYL_17/img/junta-de-castilla-y-leon.png, 130×82), sin tocar.
// Guía de estilos de la Junta (jcyl.es/junta/guia/guia-estilos.html): el escudo no se modifica (color, brillo,
// contraste, opacidad, nitidez), no se recorta, conserva su área de seguridad y no es un recurso decorativo.
// Por eso va a su tamaño o menor (nunca ampliado), con margen y sobre fondo blanco.
const AWARD_LOGOS = [
  { src: '/assets/premios/junta-castilla-y-leon.png', alt: 'Junta de Castilla y León', width: 130, height: 82 }
]

export default {
  name: 'AppSettings',
  props: {
    showTooltips: { type: Boolean, default: true },
    autoExpandSidebar: { type: Boolean, default: true }
  },
  emits: ['toggleTooltips', 'toggleAutoExpand'],
  setup() {
    const { mode, setTheme, followSystem } = useTheme()
    const themeChoice = computed({
      get: () => mode.value,
      set: (v) => (v === 'system' ? followSystem() : setTheme(v))
    })
    const logos = ref([...AWARD_LOGOS])
    return { THEMES, themeChoice, AWARD, logos }
  }
}
</script>

<style scoped>
.as {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.as-h {
  margin: 0 0 8px 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
/* Grupo de filas en una tarjeta, separadas por una línea */
.as-card {
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  background: var(--bg-secondary);
  overflow: hidden;
}
.as-row {
  display: block;
  margin: 0;
  padding: 12px 14px 14px;
  border: 0;
  min-width: 0;
}
.as-row + .as-row {
  border-top: 1px solid var(--border-primary);
}
.as-label {
  display: block;
  padding: 2px 0 0;
  float: none;
  width: auto;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.as-hint {
  display: block;
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
}

/* Tema: tres opciones en una pastilla (radios de verdad, con su teclado) */
.as-segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-top: 10px;
  padding: 4px;
  border-radius: 12px;
  background: var(--bg-primary);
}
.as-segmented label {
  position: relative;
  cursor: pointer;
}
.as-segmented input {
  position: absolute;
  inset: 0;
  opacity: 0;
  margin: 0;
  cursor: pointer;
}
.as-segmented input + span {
  display: block;
  padding: 7px 4px;
  border-radius: 9px;
  font-size: 13px;
  text-align: center;
  color: var(--text-secondary);
  white-space: nowrap;
}
.as-segmented input:checked + span {
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
.as-segmented input:focus-visible + span {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

/* Interruptores: casilla nativa (switch donde existe) con aspecto de interruptor en todos los navegadores */
.as-switch-row {
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
}
.as-text {
  flex: 1;
  min-width: 0;
}
.as-switch {
  appearance: none;
  flex: none;
  position: relative;
  width: 44px;
  height: 26px;
  margin: 0;
  border-radius: 999px;
  background: var(--bg-quaternary, #9aa4ae);
  border: 1px solid var(--border-primary);
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.as-switch::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: translate 0.2s ease;
}
.as-switch:checked {
  background: var(--primary-color);
  border-color: var(--primary-color);
}
.as-switch:checked::before {
  translate: 18px 0;
}
.as-switch:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .as-switch,
  .as-switch::before {
    transition: none;
  }
}

.as-foot {
  margin: 0 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* Premio: tarjeta sobria al final, con los logos sobre fondo blanco (se ven igual en tema claro y oscuro) */
.as-award {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  padding: 14px;
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, #c9a227 14%, transparent), transparent 60%),
    var(--bg-secondary);
  color: inherit;
  text-decoration: none;
}
.as-award:hover {
  border-color: #c9a227;
}
.as-award:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
/* El logo, sin tocar: a su tamaño (o menor si no cabe), con su área de seguridad alrededor */
.as-award-logos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #fff;
}
.as-award-logos img {
  display: block;
  height: auto;
  max-width: 100%;
}
.as-award-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-secondary);
}
.as-award-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a8841a;
}
:global([data-theme='dark']) .as-award-kicker {
  color: #e0bd4f;
}
.as-award-text strong {
  font-size: 15px;
  color: var(--text-primary);
}
.as-award-text small {
  margin-top: 4px;
  font-size: 12px;
}
</style>
