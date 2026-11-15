<template>
  <!-- Agenda semanal: botón flotante encima de la rana (SaLLMantino) con el canal de WhatsApp y la newsletter.
       Solo aparece si el servidor tiene configurado uno de los dos. -->
  <div v-if="info && (info.activa || info.canalWhatsapp)" class="dfab">
    <!-- Aviso la primera vez (una sola vez por navegador) -->
    <transition name="dfab-hint">
      <div v-if="hint && !open" class="dfab-hint" role="status">
        <button type="button" class="dfab-hint-text" @click="openPanel">📬 ¿Te mandamos la agenda de la provincia cada semana?</button>
        <button type="button" class="dfab-hint-close" aria-label="No mostrar más" @click="dismissHint">✕</button>
      </div>
    </transition>

    <button
      v-show="!open"
      type="button"
      class="dfab-btn"
      :class="{ pulse: hint }"
      aria-label="La agenda de la semana: canal de WhatsApp y newsletter"
      title="La agenda de la semana"
      @click="openPanel"
    >
      <svg class="dfab-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.2-8 5-8-5V6l8 5 8-5v2.2z"/></svg>
      <span v-if="info.canalWhatsapp" class="dfab-badge" aria-hidden="true">
        <svg class="dfab-icon small" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3z"/></svg>
      </span>
    </button>

    <transition name="dfab-panel">
      <section v-if="open" ref="panel" class="dfab-panel" role="dialog" aria-modal="false" aria-labelledby="dfab-title" tabindex="-1" @keydown.esc="open = false">
        <header class="dfab-head">
          <span class="dfab-head-icon" aria-hidden="true">📬</span>
          <h2 id="dfab-title" class="dfab-title">La agenda de la semana</h2>
          <button type="button" class="dfab-close" aria-label="Cerrar" @click="open = false">✕</button>
        </header>
        <div class="dfab-body">
          <NewsletterSignup bare />
        </div>
      </section>
    </transition>
  </div>
</template>

<script>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import NewsletterSignup from './NewsletterSignup.vue'
import { newsletterInfo } from '@/utils/newsletter'

const HINT_KEY = 'infosalamanca.agendaHint'
const store = {
  get() { try { return localStorage.getItem(HINT_KEY) } catch { return '1' } }, // sin almacenamiento, sin aviso
  set() { try { localStorage.setItem(HINT_KEY, '1') } catch { /* navegación privada */ } }
}

export default {
  name: 'DifusionFab',
  components: { NewsletterSignup },
  setup() {
    const info = ref(null)
    const open = ref(false)
    const hint = ref(false)
    const panel = ref(null)
    let hintTimer = null

    onMounted(async () => {
      info.value = await newsletterInfo()
      // El aviso sale una vez, cuando ya se ha echado un vistazo al mapa
      if (info.value && (info.value.activa || info.value.canalWhatsapp) && !store.get()) {
        hintTimer = setTimeout(() => { hint.value = true }, 15000)
      }
    })
    onBeforeUnmount(() => clearTimeout(hintTimer))

    const dismissHint = () => { hint.value = false; store.set() }
    async function openPanel() {
      dismissHint()
      open.value = true
      await nextTick()
      panel.value?.focus()
    }

    return { info, open, hint, panel, openPanel, dismissHint }
  }
}
</script>

<style scoped>
.dfab-btn {
  position: fixed;
  right: 17px;
  bottom: 236px; /* encima de la rana (164 px + 60 + margen) */
  z-index: 950;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #1f7a4d, #2e9e5f);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: transform 0.2s ease, right 0.35s ease;
}
.dfab-btn:hover,
.dfab-btn:focus-visible {
  transform: scale(1.07);
  outline: none;
}
/* (global.css tiene una regla "svg" para el mapa: tamaño completo y fondo; aquí no) */
.dfab-btn svg.dfab-icon {
  width: 26px;
  height: 26px;
  background: none;
  border-radius: 0;
  box-shadow: none;
}
.dfab-btn svg.dfab-icon.small {
  width: 12px;
  height: 12px;
}
.dfab-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 2px solid #fff;
  border-radius: 50%;
  color: #fff;
  background: #25a35a;
}
/* Una onda suave mientras está el aviso (sin animación si se pide reducir movimiento) */
.dfab-btn.pulse::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 2px solid #2e9e5f;
  animation: dfab-pulse 1.8s ease-out infinite;
}
@keyframes dfab-pulse {
  from { opacity: 0.8; transform: scale(1); }
  to { opacity: 0; transform: scale(1.55); }
}

.dfab-hint {
  position: fixed;
  right: 82px;
  bottom: 240px;
  z-index: 951;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  max-width: 250px;
  padding: 10px 8px 10px 12px;
  border: 1px solid var(--border-light, #ddd);
  border-radius: 14px 14px 4px 14px;
  background: var(--bg-primary, #fff);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  transition: right 0.35s ease;
}
.dfab-hint-text {
  padding: 0;
  border: 0;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.35;
  text-align: left;
  color: var(--text-primary, #222);
  background: none;
  cursor: pointer;
}
.dfab-hint-close {
  flex: 0 0 auto;
  padding: 0 4px;
  border: 0;
  font-size: 0.8rem;
  color: var(--text-muted, #777);
  background: none;
  cursor: pointer;
}

.dfab-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  width: min(370px, calc(100vw - 32px));
  max-height: calc(100vh - var(--topbar-h, 56px) - 32px);
  overflow: hidden;
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 16px;
  color: var(--text-primary, #222);
  background: var(--bg-primary, #fff);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
  outline: none;
  transition: right 0.35s ease;
}
.dfab-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 12px 16px;
  color: #fff;
  background: linear-gradient(135deg, #1f7a4d, #2e9e5f);
}
.dfab-head-icon {
  font-size: 1.3rem;
}
.dfab .dfab-title {
  flex: 1;
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #fff;
}
.dfab-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.18);
  cursor: pointer;
}
.dfab-body {
  overflow-y: auto;
  padding: 14px 16px 16px;
}

.dfab-panel-enter-active,
.dfab-panel-leave-active,
.dfab-hint-enter-active,
.dfab-hint-leave-active {
  transition: opacity 0.2s ease, transform 0.25s ease;
}
.dfab-panel-enter-from,
.dfab-panel-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}
.dfab-hint-enter-from,
.dfab-hint-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

@media (max-width: 767px) {
  .dfab-panel {
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    border-radius: 16px 16px 0 0;
  }
  .dfab-hint {
    max-width: min(240px, calc(100vw - 110px));
  }
}
@media (prefers-reduced-motion: reduce) {
  .dfab-btn,
  .dfab-panel-enter-active,
  .dfab-panel-leave-active,
  .dfab-hint-enter-active,
  .dfab-hint-leave-active { transition: none; }
  .dfab-btn.pulse::after { animation: none; }
}
</style>

<style>
/* Con la ficha del pueblo abierta se aparta como la rana; en el móvil no cabe */
@media (min-width: 768px) {
  #app:has(#sidebar.open) .dfab-btn { right: calc(var(--right-panel-w) + 17px); }
  #app:has(#sidebar.open) .dfab-hint { right: calc(var(--right-panel-w) + 82px); }
  #app:has(#sidebar.open) .dfab-panel { right: calc(var(--right-panel-w) + 16px); }
}
@media (max-width: 767px) {
  #app:has(#sidebar.open) .dfab-btn,
  #app:has(#sidebar.open) .dfab-hint { display: none; }
}
</style>
