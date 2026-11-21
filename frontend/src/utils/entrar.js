// Formas de entrar en «Mi explotación» sin contraseña: huella/cara/PIN del teléfono (llave de acceso), Google y
// Facebook. El servidor comprueba todo; aquí solo se habla con el teléfono y con los botones de Google y Facebook.
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { api } from './cuaderno'

const HUELLA_KEY = 'cuaderno-huella' // este dispositivo ya tiene una huella guardada para infoSalamanca
const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento: no pasa nada */ } }
}

export const tieneHuellaAqui = () => store.get(HUELLA_KEY) === '1'
export const recordarHuella = () => store.set(HUELLA_KEY, '1')
export const huellaDescartada = () => store.get('cuaderno-huella-no') === '1'
export const descartarHuella = () => store.set('cuaderno-huella-no', '1')

// ¿Puede este dispositivo usar la huella (o cara, o PIN)?
export async function huellaDisponible() {
  try {
    return Boolean(window.PublicKeyCredential) && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

export function nombreDispositivo() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Teléfono Android' : 'Tableta Android'
  if (/Windows/.test(ua)) return 'Ordenador con Windows'
  if (/Macintosh/.test(ua)) return 'Mac'
  return 'Este dispositivo'
}

// Dentro de la app de Facebook o Instagram, Google no deja entrar (y la huella a veces tampoco)
export const navegadorIntegrado = () => /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\//.test(navigator.userAgent)

// Lo que dice el teléfono, en palabras normales
export function mensajeHuella(err) {
  const n = err?.name || err?.cause?.name
  if (n === 'NotAllowedError' || n === 'AbortError') return 'No se ha usado la huella. Si quieres, vuelve a intentarlo.'
  if (n === 'InvalidStateError') return 'Esta huella ya está guardada en este teléfono.'
  if (n === 'SecurityError' || n === 'NotSupportedError') return 'Este navegador no deja usar la huella aquí. Prueba con Chrome o Safari.'
  return err?.message || 'No se ha podido usar la huella.'
}

// Cuenta nueva solo con el nombre, o (con sesión) añadir la huella a la cuenta actual
export async function crearConHuella(nombre) {
  const { retoId, opciones } = await api.huellaOpciones(nombre ? { nombre } : {})
  const respuesta = await startRegistration({ optionsJSON: opciones })
  const r = await api.huellaCrear({ retoId, respuesta, dispositivo: nombreDispositivo() })
  recordarHuella()
  return r
}

export async function entrarConHuella() {
  const { retoId, opciones } = await api.huellaEntrarOpciones()
  const respuesta = await startAuthentication({ optionsJSON: opciones })
  const r = await api.huellaEntrar({ retoId, respuesta })
  recordarHuella()
  return r
}

// ---------- Scripts de Google y Facebook (solo se cargan si se van a usar) ----------
const scripts = new Map()
function cargarScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src; s.async = true
      s.onload = resolve
      s.onerror = () => { scripts.delete(src); reject(new Error('No se ha podido cargar. ¿Hay conexión?')) }
      document.head.appendChild(s)
    }))
  }
  return scripts.get(src)
}

// Dibuja el botón oficial de Google en `el`; al elegir cuenta llama a onCredencial(jwt)
export async function botonGoogle(el, clientId, onCredencial) {
  await cargarScript('https://accounts.google.com/gsi/client')
  window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => onCredencial(r.credential), ux_mode: 'popup', context: 'signin' })
  const ancho = Math.min(400, Math.max(240, Math.round(el.getBoundingClientRect().width || 320)))
  window.google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'left', width: ancho, locale: 'es' })
}

export async function tokenFacebook(appId) {
  await cargarScript('https://connect.facebook.net/es_ES/sdk.js')
  if (!window.__fbIniciado) { window.FB.init({ appId, version: 'v21.0', cookie: false, xfbml: false }); window.__fbIniciado = true }
  return new Promise((resolve, reject) => {
    window.FB.login((r) => (r.authResponse?.accessToken ? resolve(r.authResponse.accessToken) : reject(new Error('No se ha entrado con Facebook.'))), { scope: 'public_profile,email' })
  })
}
