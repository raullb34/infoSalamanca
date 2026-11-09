<template>
  <div class="town-history">
    <p v-if="historia.resumen" class="th-summary">{{ historia.resumen }}</p>

    <!-- Mini línea del tiempo: hitos con fecha sacados de Wikipedia, la Junta y la web del ayuntamiento -->
    <section v-if="eventos.length" class="th-block" aria-label="Línea del tiempo">
      <h4 class="th-heading">Línea del tiempo</h4>
      <ol class="th-timeline">
        <li v-for="(e, i) in visibleEvents" :key="i" class="th-event">
          <span class="th-dot" aria-hidden="true"></span>
          <span class="th-year">{{ e.label }}</span>
          <p class="th-text">{{ e.text }}</p>
          <a v-if="e.url" :href="e.url" target="_blank" rel="noopener noreferrer" class="th-src">{{ sourceName(e.source) }}</a>
        </li>
      </ol>
      <button v-if="eventos.length > FIRST" type="button" class="th-more" @click="allEvents = !allEvents">
        {{ allEvents ? 'Ver menos' : `Ver los ${eventos.length} hitos` }}
      </button>
    </section>

    <!-- Patrimonio: Bienes de Interés Cultural de la Junta -->
    <section v-if="monumentos.length" class="th-block" aria-label="Patrimonio">
      <h4 class="th-heading">Patrimonio protegido <span class="th-count">{{ monumentos.length }}</span></h4>
      <ul class="th-monuments">
        <li v-for="(m, i) in visibleMonuments" :key="i" class="th-monument">
          <button type="button" class="th-monument-head" :aria-expanded="openMonument === i" @click="openMonument = openMonument === i ? null : i">
            <span class="th-monument-name">{{ m.name }}</span>
            <span class="th-monument-meta">{{ [m.type, (m.periods || []).join(', ')].filter(Boolean).join(' · ') }}</span>
          </button>
          <p v-if="openMonument === i && m.description" class="th-monument-desc">{{ m.description }}</p>
        </li>
      </ul>
      <button v-if="monumentos.length > FIRST_MONUMENTS" type="button" class="th-more" @click="allMonuments = !allMonuments">
        {{ allMonuments ? 'Ver menos' : `Ver los ${monumentos.length} monumentos` }}
      </button>
    </section>

    <!-- La historia contada por el propio ayuntamiento: extracto y enlace -->
    <section v-if="historia.ayuntamiento" class="th-block th-ayto">
      <h4 class="th-heading">Según el ayuntamiento</h4>
      <p class="th-excerpt">{{ historia.ayuntamiento.excerpt }}</p>
      <a :href="historia.ayuntamiento.url" target="_blank" rel="noopener noreferrer" class="th-link">Leer en la web del ayuntamiento →</a>
    </section>

    <!-- Texto de Wikipedia, plegado -->
    <section v-if="historia.historia?.length" class="th-block">
      <button type="button" class="th-more th-full-toggle" :aria-expanded="fullText" @click="fullText = !fullText">
        {{ fullText ? 'Ocultar la historia completa' : 'Leer la historia completa' }}
      </button>
      <div v-if="fullText" class="th-full">
        <p v-for="(p, i) in historia.historia" :key="i">{{ p }}</p>
      </div>
    </section>

    <p class="th-sources">
      Fuentes:
      <template v-for="(f, i) in fuentes" :key="f.name">
        <a :href="f.url" target="_blank" rel="noopener noreferrer">{{ f.name }}</a><span v-if="f.license"> ({{ f.license }})</span><span v-if="i < fuentes.length - 1"> · </span>
      </template>
    </p>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'

const SOURCE_NAMES = { wikipedia: 'Wikipedia', jcyl: 'Junta de CyL', ayuntamiento: 'Ayuntamiento' }

export default {
  name: 'TownHistory',
  props: {
    // Respuesta de GET /api/towns/:id/historia
    historia: { type: Object, required: true }
  },
  setup(props) {
    const FIRST = 6
    const FIRST_MONUMENTS = 4
    const allEvents = ref(false)
    const allMonuments = ref(false)
    const openMonument = ref(null)
    const fullText = ref(false)
    watch(() => props.historia, () => {
      allEvents.value = allMonuments.value = fullText.value = false
      openMonument.value = null
    })

    const eventos = computed(() => props.historia.eventos || [])
    const monumentos = computed(() => props.historia.monumentos || [])
    const visibleEvents = computed(() => (allEvents.value ? eventos.value : eventos.value.slice(0, FIRST)))
    const visibleMonuments = computed(() => (allMonuments.value ? monumentos.value : monumentos.value.slice(0, FIRST_MONUMENTS)))
    // Las fuentes de la respuesta; con datos antiguos (solo Wikipedia), la de Wikipedia
    const fuentes = computed(() => (props.historia.fuentes?.length
      ? props.historia.fuentes
      : [{ name: 'Wikipedia', url: props.historia.fuente, license: 'CC BY-SA' }]).filter(f => f.url))
    const sourceName = (s) => SOURCE_NAMES[s] || s

    return { FIRST, FIRST_MONUMENTS, allEvents, allMonuments, openMonument, fullText, eventos, monumentos, visibleEvents, visibleMonuments, fuentes, sourceName }
  }
}
</script>

<style scoped>
.town-history {
  --th-gold: #c07c12;
  --th-line: #c9a46c;
  font-size: 0.9rem;
  line-height: 1.5;
}
.th-summary {
  margin: 0 0 0.8rem;
}
.th-block {
  margin: 0 0 1rem;
}
.th-heading {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary, #5f6b77);
  display: flex;
  align-items: center;
  gap: 6px;
}
.th-count {
  background: var(--th-gold);
  color: #fff;
  border-radius: 10px;
  padding: 0 7px;
  font-size: 0.7rem;
  letter-spacing: 0;
}

/* Línea del tiempo vertical con camino discontinuo, como la de la provincia */
.town-history .th-timeline {
  list-style: none;
  margin: 0;
  /* !important: un estilo global del panel quita el margen de las listas */
  padding: 0 0 0 22px !important;
  position: relative;
}
.th-timeline::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 6px;
  bottom: 6px;
  border-left: 2px dashed var(--th-line);
}
.th-event {
  position: relative;
  padding: 0 0 0.75rem;
}
.th-dot {
  position: absolute;
  left: -22px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bg-primary, #fff);
  border: 3px solid var(--th-gold);
}
.th-year {
  display: block;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--th-gold);
}
.th-text {
  margin: 0.1rem 0 0.15rem;
}
.th-src {
  font-size: 0.72rem;
  color: var(--text-secondary, #5f6b77);
  text-decoration: none;
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 8px;
  padding: 0 6px;
}
.th-src:hover {
  text-decoration: underline;
}

.th-monuments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.th-monument {
  border: 1px solid var(--border-primary, #e0e0e0);
  border-radius: 10px;
  overflow: hidden;
}
.th-monument-head {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 8px 10px;
  border: 0;
  background: var(--bg-secondary, #f8f9fa);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.th-monument-head:hover,
.th-monument-head:focus-visible {
  background: color-mix(in srgb, var(--th-gold) 10%, var(--bg-secondary, #f8f9fa));
}
.th-monument-name {
  font-weight: 700;
}
.th-monument-meta {
  font-size: 0.75rem;
  color: var(--text-secondary, #5f6b77);
}
.th-monument-desc {
  margin: 0;
  padding: 8px 10px;
  font-size: 0.85rem;
}

.th-excerpt {
  margin: 0 0 0.3rem;
  font-style: italic;
}
.th-link,
.th-more {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--th-gold);
}
.th-more {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}
.th-link {
  text-decoration: none;
}
.th-link:hover,
.th-more:hover {
  text-decoration: underline;
}
.th-full p {
  margin: 0.5rem 0 0;
  text-align: justify;
}
.th-sources {
  font-size: 0.72rem;
  opacity: 0.75;
  margin: 0;
}
</style>

<style>
/* Modo oscuro (sin scoped: data-theme está en <html>) */
[data-theme="dark"] .town-history {
  --th-gold: #e8b54e;
  --th-line: #8b6d45;
}
</style>
