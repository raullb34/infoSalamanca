<template>
  <!-- Agenda semanal por correo y canal de WhatsApp. Solo aparece lo que está configurado en el servidor:
       sin correo ni responsable de los datos no se ofrece la suscripción (la ley obliga a decir quién los trata). -->
  <section v-if="info && (info.activa || info.canalWhatsapp)" class="nl" :class="{ bare }" :aria-labelledby="bare ? null : 'nl-title'">
    <h3 v-if="!bare" id="nl-title" class="nl-title">📬 La agenda de la semana</h3>
    <p class="nl-lead">Espectáculos, fiestas, ciencia y el tiempo de la provincia, cada semana.</p>

    <a v-if="info.canalWhatsapp" :href="info.canalWhatsapp" target="_blank" rel="noopener" class="nl-wa">
      <svg class="nl-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3z"/></svg>
      Síguenos en el canal de WhatsApp
    </a>

    <form v-if="info.activa && !done" class="nl-form" @submit.prevent="submit">
      <label class="nl-label" :for="uid">Recíbela por correo</label>
      <div class="nl-row">
        <input :id="uid" v-model="email" type="email" required autocomplete="email" placeholder="tu@correo.es" :disabled="sending" />
        <button type="submit" :disabled="sending || !accept">{{ sending ? 'Enviando…' : 'Suscribirme' }}</button>
      </div>
      <label class="nl-consent">
        <input v-model="accept" type="checkbox" required />
        <span>{{ info.consentimiento }}</span>
      </label>
      <p class="nl-legal">
        Te enviaremos un correo para confirmar. Solo guardamos tu dirección para mandarte la agenda y puedes darte de baja con un clic.
        <template v-if="info.responsable">Responsable: {{ info.responsable }}.</template>
        <template v-if="info.contacto"> Contacto: {{ info.contacto }}.</template>
      </p>
      <p v-if="error" class="nl-error" role="alert">{{ error }}</p>
    </form>
    <p v-else-if="done" class="nl-done" role="status">✉️ {{ done }}</p>
  </section>
</template>

<script>
import { ref, onMounted } from 'vue'
import { newsletterInfo, subscribe } from '@/utils/newsletter'

export default {
  name: 'NewsletterSignup',
  props: {
    // En el panel del botón flotante no hace falta el marco de tarjeta
    bare: { type: Boolean, default: false }
  },
  setup() {
    const info = ref(null)
    const email = ref('')
    const accept = ref(false)
    const sending = ref(false)
    const error = ref('')
    const done = ref('')
    const uid = `nl-email-${Math.random().toString(36).slice(2, 8)}`

    onMounted(async () => {
      info.value = await newsletterInfo()
    })

    async function submit() {
      error.value = ''
      sending.value = true
      try {
        done.value = (await subscribe(email.value, accept.value)).mensaje
      } catch (e) {
        error.value = e.response?.data?.mensaje || e.response?.data?.error || 'No se ha podido completar. Prueba más tarde.'
      }
      sending.value = false
    }

    return { info, email, accept, sending, error, done, submit, uid }
  }
}
</script>

<style scoped>
.nl {
  margin: 14px 0;
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg-primary);
}
.nl.bare {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
}
.nl .nl-title {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}
.nl-lead {
  margin: 4px 0 10px;
  font-size: 0.84rem;
  color: var(--text-secondary);
}
.nl-wa {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 0.86rem;
  font-weight: 700;
  text-decoration: none;
  color: #fff;
  background: #1f7a4d; /* verde oscuro: contraste AA con texto blanco */
}
/* (global.css tiene una regla "svg" para el mapa: tamaño completo y fondo; aquí no) */
.nl-wa svg.nl-icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  background: none;
  border-radius: 0;
  box-shadow: none;
}
.nl-wa:hover {
  background: #17603c;
}
.nl-label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
}
.nl-row {
  display: flex;
  gap: 6px;
}
.nl-row input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  font: inherit;
  font-size: 0.88rem;
  color: var(--text-primary);
  background: var(--bg-secondary);
}
.nl-row button {
  padding: 8px 14px;
  border: 0;
  border-radius: 10px;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  color: #fff;
  background: var(--primary-color);
  cursor: pointer;
}
.nl-row button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.nl-consent {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 8px;
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--text-secondary);
  cursor: pointer;
}
.nl-consent input {
  margin-top: 2px;
}
.nl-legal {
  margin: 6px 0 0;
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--text-muted);
}
.nl-error {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: var(--danger-color, #c62828);
}
.nl-done {
  margin: 4px 0 0;
  font-size: 0.86rem;
  color: var(--text-primary);
}
</style>
