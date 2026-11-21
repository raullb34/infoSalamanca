<template>
  <!-- Entrar en «Mi explotación». Pensado para quien usa poco el móvil: botones grandes, pocas palabras, sin
       contraseñas por defecto. La huella (o cara, o PIN) del teléfono va primero; luego Google y Facebook (si están
       activados en el servidor); el correo con contraseña queda como «otra forma». Si no hay cuenta, se crea sola. -->
  <div class="ce">
    <p class="ce-lead">Guarda tus tierras y lo que haces en ellas. Solo lo ves tú y quien tú digas.</p>

    <p v-if="error" class="ce-error" role="alert">{{ error }}</p>

    <!-- Inicio: elegir cómo entrar -->
    <div v-if="paso === 'inicio'" class="ce-botones">
      <p v-if="integrado" class="ce-aviso">
        Estás dentro de la aplicación de Facebook o Instagram. Si algo no funciona, abre esta página en Chrome o Safari: toca los tres puntos <b>⋯</b> y elige «Abrir en el navegador».
      </p>

      <template v-if="huella">
        <button v-if="tieneHuella" type="button" class="ce-btn principal" :disabled="ocupado" @click="entrarHuella">
          <span class="ce-ico" aria-hidden="true">👆</span> Entrar con la huella
        </button>
        <button v-else type="button" class="ce-btn principal" :disabled="ocupado" @click="paso = 'nombre'">
          <span class="ce-ico" aria-hidden="true">👆</span> Crear mi cuenta con la huella
        </button>
        <p class="ce-nota">Con la huella, la cara o el PIN de este teléfono. Sin contraseñas.</p>
      </template>

      <div v-if="formas.google" class="ce-google" :class="{ cargando: !googleListo }">
        <div ref="googleEl" class="ce-google-btn"></div>
        <span v-if="!googleListo" class="ce-nota">Cargando el botón de Google…</span>
      </div>

      <button v-if="formas.facebook" type="button" class="ce-btn facebook" :disabled="ocupado" @click="entrarFacebook">
        <svg class="ce-ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z"/></svg>
        Continuar con Facebook
      </button>

      <div class="ce-mas">
        <button v-if="huella && tieneHuella" type="button" class="ce-link" @click="paso = 'nombre'">Es otra persona: crear otra cuenta con la huella</button>
        <button v-if="huella && !tieneHuella" type="button" class="ce-link" :disabled="ocupado" @click="entrarHuella">Ya tengo cuenta con la huella</button>
        <button type="button" class="ce-link" @click="paso = 'correo'">Con correo y contraseña</button>
      </div>
      <p class="ce-nota">Si no tienes cuenta, se crea sola. No hace falta ninguna clave de la Junta.</p>
    </div>

    <!-- Cuenta nueva con la huella: solo el nombre -->
    <form v-else-if="paso === 'nombre'" class="ce-form" @submit.prevent="crearHuella">
      <label class="ce-grande">¿Cómo te llamas?
        <input ref="nombreEl" v-model.trim="nombre" autocomplete="name" autocapitalize="words" enterkeyhint="go" required minlength="2" maxlength="80" placeholder="Nombre y apellido" />
      </label>
      <p class="ce-nota">Así te verán las personas a las que des acceso a tu explotación.</p>
      <button type="submit" class="ce-btn principal" :disabled="ocupado || nombre.length < 2">
        <span class="ce-ico" aria-hidden="true">👆</span> Seguir y poner la huella
      </button>
      <p class="ce-nota">El teléfono te pedirá la huella, la cara o el PIN. Se guarda en el teléfono, no en infoSalamanca.</p>
      <button type="button" class="ce-link" @click="paso = 'inicio'">‹ Volver</button>
    </form>

    <!-- Correo y contraseña (como antes) -->
    <form v-else class="ce-form" @submit.prevent="enviarCorreo">
      <div class="ce-seg" role="tablist">
        <button type="button" role="tab" :aria-selected="String(modo === 'entrar')" @click="modo = 'entrar'">Ya tengo cuenta</button>
        <button type="button" role="tab" :aria-selected="String(modo === 'registro')" @click="modo = 'registro'">Soy nuevo</button>
      </div>
      <label v-if="modo === 'registro'">Nombre <input id="mx-nombre" v-model.trim="correo.nombre" autocomplete="name" /></label>
      <label>Correo <input id="mx-email" v-model.trim="correo.email" type="email" required autocomplete="username email" inputmode="email" /></label>
      <label>Contraseña <input id="mx-pass" v-model="correo.password" type="password" required :minlength="modo === 'registro' ? 10 : null" :autocomplete="modo === 'registro' ? 'new-password' : 'current-password'" /></label>
      <p v-if="modo === 'registro'" class="ce-nota">Al menos 10 letras o números.</p>
      <button type="submit" class="ce-btn principal" :disabled="ocupado">{{ modo === 'registro' ? 'Crear mi cuenta' : 'Entrar' }}</button>
      <button type="button" class="ce-link" @click="paso = 'inicio'">‹ Volver</button>
    </form>
  </div>
</template>

<script>
import { ref, reactive, onMounted, watch, nextTick } from 'vue'
import { api } from '../utils/cuaderno'
import { huellaDisponible, tieneHuellaAqui, crearConHuella, entrarConHuella, mensajeHuella, navegadorIntegrado, botonGoogle, tokenFacebook } from '../utils/entrar'

export default {
  name: 'CuentaEntrar',
  emits: ['entrado'],
  setup(_props, { emit }) {
    const paso = ref('inicio')
    const error = ref('')
    const ocupado = ref(false)
    const huella = ref(false)
    const tieneHuella = ref(tieneHuellaAqui())
    const formas = reactive({ google: null, facebook: null })
    const googleEl = ref(null)
    const googleListo = ref(false)
    const nombreEl = ref(null)
    const nombre = ref('')
    const modo = ref('entrar')
    const correo = reactive({ nombre: '', email: '', password: '' })
    const integrado = navegadorIntegrado()

    const run = async (fn, mensaje = (e) => e.message) => {
      error.value = ''
      ocupado.value = true
      try {
        const r = await fn()
        if (r?.usuario) emit('entrado', r.usuario)
      } catch (e) {
        error.value = e.status === 0 ? 'Sin conexión: inténtalo cuando tengas cobertura.' : mensaje(e)
      } finally { ocupado.value = false }
    }

    const entrarHuella = () => run(entrarConHuella, (e) => {
      // Sin huella guardada aquí: ofrecer crear la cuenta
      if (e.status === 401) { tieneHuella.value = false; return e.message }
      return mensajeHuella(e)
    })
    const crearHuella = () => run(() => crearConHuella(nombre.value), mensajeHuella)
    const entrarFacebook = () => run(async () => api.facebook(await tokenFacebook(formas.facebook)))
    const enviarCorreo = () => run(async () => {
      const r = modo.value === 'registro' ? await api.registrar(correo) : await api.entrar(correo)
      correo.password = ''
      return r
    })

    async function pintarGoogle() {
      await nextTick()
      if (!formas.google || !googleEl.value) return
      try {
        await botonGoogle(googleEl.value, formas.google, (credencial) => run(() => api.google(credencial)))
        googleListo.value = true
      } catch (e) { error.value = e.message }
    }

    watch(paso, async (p) => {
      error.value = ''
      if (p === 'inicio') { googleListo.value = false; await pintarGoogle() }
      if (p === 'nombre') { await nextTick(); nombreEl.value?.focus() }
    })

    onMounted(async () => {
      huella.value = await huellaDisponible()
      if (!huella.value) tieneHuella.value = false
      try { Object.assign(formas, await api.formas()) } catch { /* sin red: queda el correo */ }
      await pintarGoogle()
    })

    return { paso, error, ocupado, huella, tieneHuella, formas, googleEl, googleListo, nombreEl, nombre, modo, correo, integrado, entrarHuella, crearHuella, entrarFacebook, enviarCorreo }
  }
}
</script>

<style scoped>
.ce { display: flex; flex-direction: column; gap: 12px; }
.ce-lead { margin: 0; font-size: 15px; line-height: 1.4; color: var(--text-primary); }
.ce-nota { margin: 0; font-size: 13px; line-height: 1.4; color: var(--text-secondary); text-align: center; }
.ce-error { margin: 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, #e53935 14%, transparent); color: var(--text-primary); font-size: 14px; }
.ce-aviso { margin: 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, #f9a825 18%, transparent); color: var(--text-primary); font-size: 14px; line-height: 1.4; }
.ce-botones, .ce-form { display: flex; flex-direction: column; gap: 10px; }
.ce-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 54px; padding: 12px 16px;
  border: 1px solid var(--border-primary); border-radius: 999px; background: var(--bg-secondary); color: var(--text-primary);
  font: inherit; font-size: 17px; font-weight: 700; cursor: pointer; touch-action: manipulation;
}
.ce-btn.principal { border-color: transparent; background: var(--primary-color); color: #fff; }
.ce-btn.facebook { border-color: transparent; background: #1877f2; color: #fff; }
.ce-btn:disabled { opacity: 0.55; cursor: progress; }
.ce-btn:focus-visible, .ce-link:focus-visible { outline: 3px solid var(--primary-color); outline-offset: 2px; }
.ce-ico { font-size: 22px; line-height: 1; flex: none; }
svg.ce-ico { width: 22px !important; height: 22px !important; max-width: none; }
.ce-google { display: flex; flex-direction: column; align-items: center; min-height: 44px; }
.ce-google-btn { width: 100%; display: flex; justify-content: center; }
.ce-google.cargando .ce-google-btn { min-height: 0; }
.ce-mas { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 4px; }
.ce-link { padding: 6px 4px; border: 0; background: none; color: var(--primary-color); font: inherit; font-size: 15px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.ce-link:disabled { opacity: 0.55; }
.ce-form label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: var(--text-primary); }
.ce-form input { min-height: 48px; padding: 10px 12px; border: 1px solid var(--border-primary); border-radius: 12px; background: var(--bg-primary); color: var(--text-primary); font: inherit; font-size: 17px; }
.ce-grande { font-size: 18px !important; font-weight: 700; }
.ce-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 999px; background: var(--bg-secondary); }
.ce-seg button { min-height: 40px; border: 0; border-radius: 999px; background: none; color: var(--text-primary); font: inherit; font-size: 14px; cursor: pointer; }
.ce-seg button[aria-selected="true"] { background: var(--primary-color); color: #fff; font-weight: 700; }
</style>
