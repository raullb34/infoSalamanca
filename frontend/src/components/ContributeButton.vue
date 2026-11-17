<template>
  <!-- "¿Es tu pueblo? / ¿Es tu negocio?…": un enlace discreto que abre un formulario corto. Lo que se manda queda
       pendiente de revisión (/admin/aportaciones.html): nada se publica solo. -->
  <div class="contrib" :class="{ block }">
    <button type="button" class="contrib-link" @click="open">
      <span aria-hidden="true">{{ icon }}</span>
      <span>{{ label }}</span>
    </button>

    <!-- Las teclas no salen del diálogo: la ficha que lo contiene puede tener atajos (Esc, flechas) -->
    <dialog ref="dialog" class="contrib-dialog" closedby="any" :aria-labelledby="`${uid}-title`" @close="onClose" @keydown.stop>
      <form v-if="!done" class="contrib-form" :class="{ tried }" novalidate @submit.prevent="send">
        <header class="contrib-head">
          <h2 :id="`${uid}-title`">{{ title }}</h2>
          <button type="button" class="contrib-x" aria-label="Cerrar" @click="dialog.close()">✕</button>
        </header>
        <p class="contrib-lead">{{ lead }}</p>

        <label class="contrib-field">
          <span>Tú eres…</span>
          <select v-model="relacion">
            <option v-for="r in RELACIONES" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </label>

        <label class="contrib-field">
          <span>{{ textLabel }} <span aria-hidden="true">*</span></span>
          <textarea
            v-model="mensaje"
            :required="!linkRequired"
            minlength="10"
            maxlength="2000"
            rows="5"
            :placeholder="placeholder"
            autofocus
            :data-error="`${uid}-msg-error`"
            @blur="sync"
            @input="sync"
          ></textarea>
          <span :id="`${uid}-msg-error`" class="contrib-error"><span role="img" aria-label="Error">⚠️</span> Cuéntanos un poco más (al menos 10 letras).</span>
        </label>

        <label class="contrib-field">
          <span>{{ linkLabel }}<template v-if="linkRequired"> <span aria-hidden="true">*</span></template></span>
          <input
            v-model="enlace"
            type="url"
            inputmode="url"
            :required="linkRequired"
            placeholder="https://…"
            :data-error="`${uid}-url-error`"
            @blur="sync"
            @input="sync"
          />
          <span :id="`${uid}-url-error`" class="contrib-error"><span role="img" aria-label="Error">⚠️</span> Pon una dirección web completa (https://…).</span>
        </label>

        <!-- El correo solo se pide si el servidor dice quién trata los datos (obligatorio por ley) -->
        <label v-if="info?.responsable" class="contrib-field">
          <span>Tu correo, si quieres que te contestemos</span>
          <input v-model="email" type="email" autocomplete="email" placeholder="tu@correo.es" :data-error="`${uid}-mail-error`" @blur="sync" @input="sync" />
          <span :id="`${uid}-mail-error`" class="contrib-error"><span role="img" aria-label="Error">⚠️</span> El correo no parece válido. Puedes dejarlo vacío.</span>
        </label>

        <!-- Campo trampa para robots: la gente no lo ve -->
        <input v-model="web" class="contrib-trap" type="text" name="web" tabindex="-1" autocomplete="off" aria-hidden="true" />

        <p class="contrib-legal">
          Lo revisamos antes de publicar nada.
          <template v-if="info?.responsable">El correo solo sirve para contestarte sobre esto y se borra al revisarlo. {{ responsableText }}</template>
          <span class="contrib-req"><span aria-hidden="true">*</span> obligatorio</span>
        </p>
        <p v-if="error" class="contrib-fail" role="alert">{{ error }}</p>

        <div class="contrib-actions">
          <button type="button" class="contrib-btn ghost" @click="dialog.close()">Cancelar</button>
          <button type="submit" class="contrib-btn" :disabled="sending">{{ sending ? 'Enviando…' : 'Enviar' }}</button>
        </div>
      </form>

      <div v-else class="contrib-done" role="status">
        <p class="contrib-done-icon" aria-hidden="true">🙌</p>
        <h2 :id="`${uid}-title`">{{ done }}</h2>
        <p>Cuando lo revisemos, lo verás en la web.</p>
        <form method="dialog"><button class="contrib-btn" autofocus>Cerrar</button></form>
      </div>
    </dialog>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { apiService } from '@/services/apiService'
import { newsletterInfo } from '@/utils/newsletter'

const RELACIONES = [
  { value: 'vecino', label: 'Vecino o vecina' },
  { value: 'ayuntamiento', label: 'Del ayuntamiento o una asociación' },
  { value: 'negocio', label: 'El dueño o la dueña del negocio' },
  { value: 'visitante', label: 'De visita' },
  { value: 'otro', label: 'Otra cosa' }
]

let n = 0

export default {
  name: 'ContributeButton',
  props: {
    // pueblo · negocio · fiesta · evento · otro
    tipo: { type: String, default: 'otro' },
    label: { type: String, required: true },
    icon: { type: String, default: '✏️' },
    title: { type: String, default: 'Ayúdanos a mejorar' },
    lead: { type: String, default: 'Cuéntanos qué falta o qué está mal.' },
    textLabel: { type: String, default: 'Qué quieres contarnos' },
    placeholder: { type: String, default: '' },
    linkLabel: { type: String, default: 'Un enlace que lo confirme (opcional)' },
    linkRequired: { type: Boolean, default: false },
    defaultRelacion: { type: String, default: 'vecino' },
    // De qué va: el pueblo y, si es de algo concreto, su id y nombre
    townIne: { type: String, default: '' },
    townName: { type: String, default: '' },
    refId: { type: [String, Number], default: '' },
    refName: { type: String, default: '' },
    // Ocupa su propia línea (en vez de ir en medio del texto)
    block: { type: Boolean, default: false }
  },
  setup(props) {
    const uid = `contrib-${++n}`
    const dialog = ref(null)
    const info = ref(null)
    const relacion = ref(props.defaultRelacion)
    const mensaje = ref('')
    const enlace = ref('')
    const email = ref('')
    const web = ref('')
    const sending = ref(false)
    const error = ref('')
    const done = ref('')
    const tried = ref(false) // se intentó enviar con algo mal: se enseñan todos los avisos

    const responsableText = computed(() => {
      const t = String(info.value?.responsable || '').trim().replace(/\.$/, '')
      return t ? `${/responsable/i.test(t) ? '' : 'Responsable: '}${t}.` : ''
    })

    async function open() {
      error.value = ''
      done.value = ''
      tried.value = false
      relacion.value = props.defaultRelacion
      dialog.value.showModal()
      info.value = info.value || await newsletterInfo()
    }

    // aria-invalid y el mensaje de error siguen al estado :user-invalid (el aviso solo tras tocar el campo)
    function sync(e) {
      const el = e.target
      const invalid = el.matches(':user-invalid') || (tried.value && el.matches(':invalid'))
      el.setAttribute('aria-invalid', String(invalid))
      const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== el.dataset.error)
      if (invalid) ids.push(el.dataset.error)
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '))
      else el.removeAttribute('aria-describedby')
    }

    async function send(e) {
      const form = e.target
      if (!form.checkValidity()) {
        // Sin el globo del navegador (repetiría el aviso): se marcan los campos que faltan y el foco va al primero,
        // que lee su mensaje de error
        tried.value = true
        const bad = [...form.querySelectorAll('textarea:invalid, input:invalid')]
        bad.forEach(el => {
          el.setAttribute('aria-invalid', 'true')
          if (!(el.getAttribute('aria-describedby') || '').includes(el.dataset.error)) el.setAttribute('aria-describedby', el.dataset.error)
        })
        bad[0]?.focus()
        return
      }
      sending.value = true
      error.value = ''
      const r = await apiService.sendContribution({
        tipo: props.tipo,
        cod_ine: props.townIne || undefined,
        municipio: props.townName || undefined,
        ref: props.refId ? String(props.refId) : undefined,
        ref_nombre: props.refName || undefined,
        relacion: relacion.value,
        mensaje: mensaje.value,
        enlace: enlace.value || undefined,
        email: email.value || undefined,
        web: web.value || undefined
      })
      sending.value = false
      if (r.ok) {
        done.value = r.mensaje || '¡Gracias!'
        mensaje.value = ''
        enlace.value = ''
        email.value = ''
      } else {
        error.value = r.mensaje
      }
    }

    function onClose() {
      dialog.value.returnValue = ''
    }

    return { uid, dialog, tried, info, relacion, mensaje, enlace, email, web, sending, error, done, responsableText, open, send, sync, onClose, RELACIONES }
  }
}
</script>

<style scoped>
.contrib {
  display: inline;
}
.contrib.block {
  display: block;
  margin: 10px 0 0;
}
/* Discreto: un enlace de texto pequeño, no un botón llamativo */
.contrib-link {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 2px 0;
  border: 0;
  background: none;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
  text-underline-offset: 3px;
  cursor: pointer;
}
.contrib-link:hover {
  color: var(--primary-color);
  text-decoration-color: currentColor;
}
.contrib-link:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
  border-radius: 4px;
}

.contrib-dialog {
  width: min(100% - 32px, 460px);
  max-height: min(100% - 32px, 760px);
  padding: 0;
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  background: var(--bg-card, var(--bg-primary));
  color: var(--text-primary);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}
/* Sin ellos, el scroll dentro del diálogo o sobre el fondo mueve la página de detrás */
.contrib-dialog:modal {
  margin: auto; /* el reset global quita el centrado del diálogo */
  overscroll-behavior: contain;
}
.contrib-dialog::backdrop {
  background: rgba(10, 14, 18, 0.55);
  overflow: hidden;
  overscroll-behavior: contain;
}

.contrib-form,
.contrib-done {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
}
.contrib-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.contrib-head h2,
.contrib-done h2 {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.3;
}
.contrib-x {
  flex: none;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
}
.contrib-lead {
  margin: -4px 0 2px;
  color: var(--text-secondary);
  font-size: 14px;
}
.contrib-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 14px;
  font-weight: 600;
}
.contrib-field select,
.contrib-field textarea,
.contrib-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 11px;
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font: inherit;
  font-weight: 400;
}
.contrib-field textarea {
  resize: vertical;
  min-height: 96px;
}
.contrib-field :is(select, textarea, input):focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}
/* El aviso solo después de tocar el campo o de intentar enviar */
.contrib-error {
  display: none;
  color: #d93025;
  font-size: 13px;
  font-weight: 500;
}
.contrib-field :is(textarea, input):user-invalid,
.tried .contrib-field :is(textarea, input):invalid {
  border-color: #d93025;
}
.contrib-field :is(textarea, input):user-invalid + .contrib-error,
.tried .contrib-field :is(textarea, input):invalid + .contrib-error {
  display: block;
}
:global([data-theme='dark']) .contrib-error {
  color: #f28b82;
}
.contrib-trap {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.contrib-legal {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.contrib-req {
  display: block;
  margin-top: 2px;
}
.contrib-fail {
  margin: 0;
  color: #d93025;
  font-size: 14px;
}
.contrib-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.contrib-btn {
  padding: 9px 18px;
  border: 0;
  border-radius: 999px;
  background: var(--primary-color);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.contrib-btn.ghost {
  background: transparent;
  color: var(--text-secondary);
}
.contrib-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
.contrib-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.contrib-done {
  align-items: center;
  text-align: center;
}
.contrib-done-icon {
  margin: 0;
  font-size: 40px;
}
.contrib-done p {
  margin: 0;
  color: var(--text-secondary);
}
</style>
