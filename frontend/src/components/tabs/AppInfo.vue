<template>
  <!-- Pestaña Info: qué es la web, cómo se usa, la agenda por correo, de dónde salen los datos y cómo avisarnos -->
  <div class="ai">
    <header class="ai-hero">
      <p class="ai-kicker">info<strong>Salamanca</strong></p>
      <h2 class="ai-title">Toda la provincia en un mapa</h2>
      <p class="ai-lead">Los 362 pueblos con su agenda, sus fiestas, los productores de Tierra de Sabor, el tiempo y qué ver. Datos públicos, juntos y al día.</p>
      <dl class="ai-stats">
        <div><dt>pueblos</dt><dd>362</dd></div>
        <div><dt>en tu ruta</dt><dd>{{ routeCount }}</dd></div>
        <div><dt>fuentes</dt><dd>{{ SOURCES.length }}</dd></div>
      </dl>
    </header>

    <section class="ai-block" aria-labelledby="ai-how">
      <h3 id="ai-how" class="ai-h">Cómo se usa</h3>
      <ul class="ai-steps">
        <li v-for="s in STEPS" :key="s.title">
          <component
            :is="s.tab ? 'button' : 'div'"
            class="ai-step"
            v-bind="s.tab ? { type: 'button' } : {}"
            @click="s.tab && $emit('goTab', s.tab)"
          >
            <span class="ai-step-icon" aria-hidden="true">{{ s.icon }}</span>
            <span class="ai-step-text">
              <strong>{{ s.title }}</strong>
              <small>{{ s.text }}</small>
            </span>
            <span v-if="s.tab" class="ai-step-go" aria-hidden="true">→</span>
          </component>
        </li>
      </ul>
    </section>

    <NewsletterSignup class="ai-newsletter" />

    <section class="ai-block" aria-labelledby="ai-sources">
      <h3 id="ai-sources" class="ai-h">De dónde salen los datos</h3>
      <ul class="ai-chips">
        <li v-for="s in SOURCES" :key="s">{{ s }}</li>
      </ul>
      <p class="ai-note">Enlazamos siempre a la fuente. Los carteles y lo que nos mandáis se revisan antes de publicarlos.</p>
    </section>

    <section class="ai-block ai-help" aria-labelledby="ai-help">
      <h3 id="ai-help" class="ai-h">¿Falta algo o algo está mal?</h3>
      <p class="ai-note">Si eres de un pueblo, tienes un negocio u organizas algo, cuéntanoslo. En la ficha de cada pueblo y de cada productor también tienes un enlace para avisarnos.</p>
      <ContributeButton
        block
        tipo="otro"
        icon="💬"
        label="Escríbenos"
        title="Escríbenos"
        lead="Una idea, un error, algo que falta… Lo leemos todo."
        placeholder="Estaría bien que la web…"
        default-relacion="otro"
      />
    </section>
  </div>
</template>

<script>
import NewsletterSignup from '@/components/NewsletterSignup.vue'
import ContributeButton from '@/components/ContributeButton.vue'

const STEPS = [
  { icon: '👆', title: 'Pulsa un pueblo', text: 'Sus fiestas, su agenda, sus productores y qué ver.' },
  { icon: '🔍', title: 'Filtros', text: 'Colorea el mapa: teatro, fiestas, Tierra de Sabor, el tiempo…', tab: 'filtros' },
  { icon: '📅', title: 'Agenda', text: 'Lo que hay estos días en toda la provincia.', tab: 'agenda' },
  { icon: '🗺️', title: 'Rutas', text: 'Junta pueblos y sitios para tu escapada.', tab: 'rutas' },
  { icon: '💬', title: 'Asistente', text: 'El botón de abajo a la derecha: pregúntale lo que quieras.' }
]

const SOURCES = [
  'Junta de Castilla y León', 'Diputación de Salamanca', 'Turismo de Salamanca', 'Tierra de Sabor',
  'Universidad de Salamanca', 'Prensa local', 'AEMET', 'InfoRiego', 'INE', 'Wikipedia y Wikimedia Commons'
]

export default {
  name: 'AppInfo',
  components: { NewsletterSignup, ContributeButton },
  props: {
    routeCount: { type: Number, default: 0 }
  },
  emits: ['goTab'],
  setup() {
    return { STEPS, SOURCES }
  }
}
</script>

<style scoped>
.ai {
  display: flex;
  flex-direction: column;
  gap: 22px;
  color: var(--text-secondary);
}

/* Cabecera: qué es, en una frase, y tres cifras */
.ai-hero {
  padding: 18px 16px 16px;
  border-radius: 16px;
  background:
    radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--primary-color) 22%, transparent), transparent 60%),
    var(--bg-secondary);
  border: 1px solid var(--border-primary);
}
.ai-kicker {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
.ai-kicker strong {
  color: var(--primary-color);
}
.ai-title {
  margin: 0 0 8px;
  font-size: 1.3rem;
  line-height: 1.25;
  color: var(--text-primary);
  text-wrap: balance;
}
.ai-lead {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
}
.ai-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 14px 0 0;
}
.ai-stats div {
  display: flex;
  flex-direction: column-reverse;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--bg-primary);
}
.ai-stats dd {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ai-stats dt {
  font-size: 12px;
  color: var(--text-secondary);
}

.ai-h {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* Cómo se usa: filas con icono; las que llevan a una pestaña son botones */
.ai-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-primary);
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-secondary);
}
.ai-steps li + li {
  border-top: 1px solid var(--border-primary);
}
.ai-step {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
}
button.ai-step {
  cursor: pointer;
}
button.ai-step:hover {
  background: var(--hover-bg);
}
button.ai-step:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}
.ai-step-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--bg-primary);
  font-size: 18px;
}
.ai-step-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.ai-step-text strong {
  color: var(--text-primary);
  font-size: 14px;
}
.ai-step-text small {
  font-size: 13px;
  line-height: 1.4;
}
.ai-step-go {
  color: var(--text-secondary);
}

/* Fuentes */
.ai-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.ai-chips li {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--text-primary);
}
.ai-note {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.5;
}
.ai-help .ai-note {
  margin-top: 0;
}
</style>
