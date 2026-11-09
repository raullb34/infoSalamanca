<template>
  <div class="asistente">
    <!-- Botón: la rana de la Universidad -->
    <button
      v-show="!open"
      type="button"
      class="asistente-fab"
      aria-label="Abrir el asistente SaLLMantino"
      @click="openChat"
    >
      <img src="/assets/icons/frog.png" alt="" width="52" height="52" />
    </button>

    <transition name="asistente">
      <section
        v-if="open"
        class="asistente-panel"
        role="dialog"
        aria-labelledby="asistente-title"
        @keydown.esc="open = false"
      >
        <header class="asistente-head">
          <img src="/assets/icons/frog.png" alt="" width="34" height="34" />
          <div class="asistente-head-text">
            <h2 id="asistente-title">SaLLMantino</h2>
            <p>Pregúntame por los pueblos de Salamanca</p>
          </div>
          <button v-if="messages.length" type="button" class="asistente-icon-btn" title="Empezar de nuevo" aria-label="Empezar una conversación nueva" @click="reset">↺</button>
          <button type="button" class="asistente-icon-btn" aria-label="Cerrar el asistente" @click="open = false">✕</button>
        </header>

        <div ref="listEl" class="asistente-messages" aria-live="polite">
          <!-- Bienvenida con sugerencias -->
          <div v-if="!messages.length" class="asistente-welcome">
            <p>¡Hola! Sé de historia, patrimonio, fiestas, teatro y bibliobuses de los 362 pueblos de la provincia. Respondo con datos de Wikipedia, la Junta y la Diputación, y te digo de dónde sale cada cosa.</p>
            <div class="asistente-chips">
              <button v-for="s in suggestions" :key="s" type="button" class="asistente-chip" @click="ask(s)">{{ s }}</button>
            </div>
          </div>

          <article
            v-for="(m, i) in messages"
            :key="i"
            class="asistente-msg"
            :class="[m.role, { error: m.error }]"
          >
            <!-- Texto con las citas [n] como enlaces a sus fuentes -->
            <p v-if="m.role === 'assistant'" class="asistente-text">
              <template v-for="(part, pi) in withCitations(m)" :key="pi">
                <a
                  v-if="part.cite && part.source?.url"
                  :href="part.source.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="asistente-cite"
                  :title="`${part.source.title} — ${part.source.source}`"
                >{{ part.n }}</a>
                <span v-else-if="part.cite" class="asistente-cite" :title="part.source ? `${part.source.title} — ${part.source.source}` : ''">{{ part.n }}</span>
                <template v-else>{{ part.text }}</template>
              </template>
            </p>
            <p v-else class="asistente-text">{{ m.text }}</p>

            <div v-if="m.towns?.length" class="asistente-chips">
              <button v-for="t in m.towns" :key="t.ine" type="button" class="asistente-chip town" @click="$emit('selectTown', { id: t.ine, name: t.name })">
                Ver {{ t.name }} en el mapa →
              </button>
            </div>

            <details v-if="m.sources?.length" class="asistente-sources">
              <summary>Fuentes ({{ m.sources.length }})</summary>
              <ol>
                <li v-for="s in m.sources" :key="s.n" :value="s.n">
                  <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.title }}</a>
                  <span v-else>{{ s.title }}</span>
                  <span class="asistente-source-name"> · {{ s.source }}</span>
                </li>
              </ol>
            </details>
            <p v-if="m.mode === 'plantilla'" class="asistente-note">Respuesta automática con los datos encontrados.</p>
          </article>

          <div v-if="loading" class="asistente-msg assistant asistente-typing" aria-label="Escribiendo">
            <span></span><span></span><span></span>
          </div>
        </div>

        <!-- Sugerencias sobre el pueblo abierto en la ficha -->
        <div v-if="townSuggestions.length && !loading" class="asistente-chips asistente-town-chips">
          <button v-for="s in townSuggestions" :key="s" type="button" class="asistente-chip" @click="ask(s)">{{ s }}</button>
        </div>

        <form class="asistente-form" @submit.prevent="ask(input)">
          <label for="asistente-input" class="visually-hidden">Tu pregunta</label>
          <input
            id="asistente-input"
            ref="inputEl"
            v-model="input"
            type="text"
            maxlength="500"
            autocomplete="off"
            placeholder="Escribe tu pregunta…"
            :disabled="loading"
          />
          <button type="submit" class="asistente-send" :disabled="loading || !input.trim()" aria-label="Enviar">➤</button>
        </form>
      </section>
    </transition>
  </div>
</template>

<script>
import { computed, nextTick, ref, watch } from 'vue'
import { apiService } from '@/services/apiService'

const STORAGE_KEY = 'infosalamanca.asistente'
const SUGGESTIONS = [
  '¿Qué ver en La Alberca?',
  '¿Cuándo son las fiestas de Béjar?',
  '¿Cuándo pasa el bibliobús por Ledesma?',
  '¿Qué teatro hay en la provincia?'
]

export default {
  name: 'AsistenteChat',
  props: {
    // Pueblo abierto en la ficha ({ id, name }), para proponer preguntas sobre él
    currentTown: { type: Object, default: null }
  },
  emits: ['selectTown'],
  setup(props) {
    const open = ref(false)
    const input = ref('')
    const loading = ref(false)
    const listEl = ref(null)
    const inputEl = ref(null)

    // La conversación se guarda solo en esta pestaña
    const load = () => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
    const messages = ref(load())
    watch(messages, (m) => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m.slice(-30))) } catch { /* sin almacenamiento */ } }, { deep: true })

    const scrollDown = async () => {
      await nextTick()
      if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
    }

    const openChat = async () => {
      open.value = true
      await nextTick()
      inputEl.value?.focus()
      scrollDown()
    }

    const ask = async (text) => {
      const question = String(text || '').trim()
      if (!question || loading.value) return
      // Lo que se envía como contexto: el texto de las últimas intervenciones, sin las citas
      const history = messages.value.filter(m => !m.error).slice(-4).map(m => ({ role: m.role, text: m.text.replace(/\[\d+\]/g, '') }))
      messages.value.push({ role: 'user', text: question })
      input.value = ''
      loading.value = true
      scrollDown()
      const res = await apiService.askAssistant(question, history)
      loading.value = false
      if (res?.success) {
        messages.value.push({ role: 'assistant', text: res.answer, sources: res.sources || [], towns: res.towns || [], mode: res.mode })
      } else {
        messages.value.push({ role: 'assistant', text: res?.error || 'No he podido responder.', error: true })
      }
      scrollDown()
      nextTick(() => inputEl.value?.focus())
    }

    const reset = () => {
      messages.value = []
      inputEl.value?.focus()
    }

    // "texto [2] más texto" → partes con las citas aparte
    const withCitations = (m) => {
      const parts = []
      const re = /\[(\d+)\]/g
      let last = 0
      let match
      while ((match = re.exec(m.text))) {
        if (match.index > last) parts.push({ text: m.text.slice(last, match.index) })
        const n = Number(match[1])
        parts.push({ cite: true, n, source: (m.sources || []).find(s => s.n === n) })
        last = re.lastIndex
      }
      if (last < m.text.length) parts.push({ text: m.text.slice(last) })
      return parts
    }

    const townSuggestions = computed(() => {
      const name = props.currentTown?.name
      if (!name || !open.value) return []
      return [`Historia de ${name}`, `¿Qué ver en ${name}?`, `Fiestas de ${name}`]
    })

    return { open, input, loading, listEl, inputEl, messages, suggestions: SUGGESTIONS, townSuggestions, openChat, ask, reset, withCitations }
  }
}
</script>

<style scoped>
.asistente-fab {
  position: fixed;
  right: 14px;
  bottom: 164px; /* encima de los botones de zoom */
  z-index: 950;
  width: 60px;
  height: 60px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--primary-color, #4caf50);
  background: var(--bg-primary, #fff);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, right 0.35s ease;
}
.asistente-fab:hover,
.asistente-fab:focus-visible {
  transform: scale(1.07);
  outline: none;
}
.asistente-fab img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
}

.asistente-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 3100;
  width: min(390px, calc(100vw - 32px));
  height: min(620px, calc(100vh - var(--topbar-h, 56px) - 32px));
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #222);
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 16px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  transition: right 0.35s ease;
}
.asistente-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--primary-color, #4caf50);
  color: #fff;
}
.asistente-head img {
  border-radius: 50%;
  background: #fff;
}
.asistente-head-text {
  flex: 1;
  min-width: 0;
}
.asistente-head h2 {
  margin: 0;
  font-size: 1rem;
}
.asistente-head p {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.9;
}
.asistente-icon-btn {
  border: 0;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
}
.asistente-icon-btn:hover,
.asistente-icon-btn:focus-visible {
  background: rgba(255, 255, 255, 0.3);
  outline: none;
}

.asistente-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overscroll-behavior: contain;
}
.asistente-welcome p {
  margin: 0 0 10px;
  font-size: 0.9rem;
  line-height: 1.45;
}
.asistente-msg {
  max-width: 88%;
  padding: 9px 12px;
  border-radius: 14px;
  font-size: 0.9rem;
  line-height: 1.45;
}
.asistente-msg.user {
  align-self: flex-end;
  background: var(--primary-color, #4caf50);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.asistente-msg.assistant {
  align-self: flex-start;
  background: var(--bg-secondary, #f3f4f6);
  border-bottom-left-radius: 4px;
}
.asistente-msg.error {
  background: color-mix(in srgb, #d32f2f 12%, var(--bg-secondary, #f3f4f6));
}
.asistente-text {
  margin: 0;
  white-space: pre-line;
}
.asistente-cite {
  display: inline-block;
  min-width: 16px;
  padding: 0 4px;
  margin: 0 1px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  vertical-align: super;
  background: color-mix(in srgb, var(--primary-color, #4caf50) 18%, transparent);
  color: inherit;
  text-decoration: none;
}
a.asistente-cite:hover {
  background: var(--primary-color, #4caf50);
  color: #fff;
}
.asistente-sources {
  margin-top: 6px;
  font-size: 0.78rem;
}
.asistente-sources summary {
  cursor: pointer;
  color: var(--text-secondary, #666);
}
.asistente-sources ol {
  margin: 4px 0 0;
  padding-left: 20px;
}
.asistente-sources a {
  color: var(--primary-color, #2e7d32);
}
.asistente-source-name {
  color: var(--text-secondary, #666);
}
.asistente-note {
  margin: 6px 0 0;
  font-size: 0.72rem;
  color: var(--text-secondary, #666);
}

.asistente-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.asistente-town-chips {
  padding: 0 12px 6px;
  margin: 0;
}
.asistente-chip {
  border: 1px solid var(--border-primary, #ddd);
  background: var(--bg-primary, #fff);
  color: inherit;
  border-radius: 999px;
  padding: 5px 11px;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.asistente-chip:hover,
.asistente-chip:focus-visible {
  border-color: var(--primary-color, #4caf50);
  outline: none;
}
.asistente-chip.town {
  font-weight: 600;
  color: var(--primary-color, #2e7d32);
}

.asistente-typing {
  display: flex;
  gap: 4px;
  padding: 12px 14px;
}
.asistente-typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-secondary, #888);
  animation: asistente-dot 1.2s infinite ease-in-out;
}
.asistente-typing span:nth-child(2) { animation-delay: 0.15s; }
.asistente-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes asistente-dot {
  0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
}

.asistente-form {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-primary, #ddd);
}
.asistente-form input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 10px;
  padding: 9px 12px;
  font: inherit;
  font-size: 0.9rem;
  background: var(--bg-secondary, #fafafa);
  color: inherit;
}
.asistente-form input:focus {
  outline: 2px solid var(--primary-color, #4caf50);
  outline-offset: -1px;
}
.asistente-send {
  width: 42px;
  border: 0;
  border-radius: 10px;
  background: var(--primary-color, #4caf50);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}
.asistente-send:disabled {
  opacity: 0.5;
  cursor: default;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.asistente-enter-active,
.asistente-leave-active {
  transition: opacity 0.2s ease, transform 0.25s ease;
}
.asistente-enter-from,
.asistente-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

/* Móvil: el chat ocupa la pantalla bajo la barra superior */
@media (max-width: 767px) {
  .asistente-panel {
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    height: calc(100dvh - var(--topbar-h, 56px));
    border-radius: 16px 16px 0 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .asistente-fab, .asistente-enter-active, .asistente-leave-active { transition: none; }
  .asistente-typing span { animation: none; }
}
</style>

<style>
/* Con la ficha abierta, la rana se aparta como los botones de zoom; en móvil no cabe */
@media (min-width: 768px) {
  #app:has(#sidebar.open) .asistente-fab {
    right: calc(var(--right-panel-w) + 14px);
  }
  /* El chat también, para no tapar la ficha del pueblo */
  #app:has(#sidebar.open) .asistente-panel {
    right: calc(var(--right-panel-w) + 16px);
  }
}
@media (max-width: 767px) {
  #app:has(#sidebar.open) .asistente-fab {
    display: none;
  }
}
</style>
