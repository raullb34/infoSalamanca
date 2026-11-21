// Cliente del área privada «Mi explotación» (API /api/cuaderno). Misma web, así que la sesión va en su cookie
// (httpOnly: este código no la ve). Las escrituras llevan la cabecera X-Cuaderno que pide el servidor.
//
// Partes sin conexión: se guardan en este dispositivo (localStorage, por usuario y explotación) con un identificador
// fijo y se envían cuando vuelve la red. El servidor reconoce ese identificador, así que un reintento no duplica el
// parte. Estados de sincronización: local → pendiente → guardado (o conflicto/error con su motivo).
import { reactive } from 'vue'

const BASE = '/api/cuaderno'

export class CuadernoError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data }
}

async function call(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-Cuaderno': '1' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch {
    throw new CuadernoError('Sin conexión', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new CuadernoError(data.error || `Error ${res.status}`, res.status, data)
  return data
}

export const api = {
  cuenta: () => call('/cuenta'),
  registrar: (d) => call('/cuenta/registro', { method: 'POST', body: d }),
  entrar: (d) => call('/cuenta/entrar', { method: 'POST', body: d }),
  salir: () => call('/cuenta/salir', { method: 'POST', body: {} }),
  explotaciones: () => call('/explotaciones'),
  crearExplotacion: (d) => call('/explotaciones', { method: 'POST', body: d }),
  recintos: (e) => call(`/explotaciones/${e}/recintos`),
  guardarRecinto: (e, d) => call(`/explotaciones/${e}/recintos`, { method: 'POST', body: d }),
  editarRecinto: (e, r, d) => call(`/explotaciones/${e}/recintos/${r}`, { method: 'PATCH', body: d }),
  cultivos: (e, campaña) => call(`/explotaciones/${e}/cultivos${campaña ? `?campaña=${campaña}` : ''}`),
  crearCultivo: (e, d) => call(`/explotaciones/${e}/cultivos`, { method: 'POST', body: d }),
  operaciones: (e) => call(`/explotaciones/${e}/operaciones`),
  operacion: (e, id) => call(`/explotaciones/${e}/operaciones/${id}`),
  crearOperacion: (e, d) => call(`/explotaciones/${e}/operaciones`, { method: 'POST', body: d }),
  rectificar: (e, id, d) => call(`/explotaciones/${e}/operaciones/${id}/rectificar`, { method: 'POST', body: d }),
  cuaderno: (e, campaña) => call(`/explotaciones/${e}/cuaderno?campaña=${campaña}`),
  csvUrl: (e, campaña) => `${BASE}/explotaciones/${e}/cuaderno.csv?campaña=${campaña}`
}

// ---------- Sesión compartida por la pantalla ----------
export const sesion = reactive({ usuario: null, comprobada: false })
export async function comprobarSesion() {
  try { sesion.usuario = (await api.cuenta()).usuario } catch { /* sin red o sin cuaderno: sigue el visor */ }
  sesion.comprobada = true
  return sesion.usuario
}

// ---------- Cola de partes sin conexión ----------
const qKey = (userId) => `cuaderno-cola-${userId}`
const readQ = (userId) => { try { return JSON.parse(localStorage.getItem(qKey(userId)) || '[]') } catch { return [] } }
const writeQ = (userId, q) => { try { localStorage.setItem(qKey(userId), JSON.stringify(q)) } catch { /* sin almacenamiento */ } }
export const cola = reactive({ items: [] })
export const cargarCola = (userId) => { cola.items = userId ? readQ(userId) : []; return cola.items }

// Identificador estable del parte (el mismo en todos los reintentos)
export const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`)

/**
 * Guarda un parte: primero en el dispositivo y luego intenta enviarlo. Si no hay red, queda pendiente.
 * → { estado: 'guardado' | 'pendiente' | 'error', operacion?, error? }
 */
export async function guardarParte(userId, explotacionId, parte) {
  const item = { id: parte.id, explotacionId, parte, estado: 'pendiente', intentos: 0, creado: new Date().toISOString() }
  const q = readQ(userId).filter(x => x.id !== parte.id)
  q.push(item)
  writeQ(userId, q)
  cola.items = q
  return enviarUno(userId, item)
}

async function enviarUno(userId, item) {
  item.intentos++
  try {
    const operacion = await api.crearOperacion(item.explotacionId, item.parte)
    writeQ(userId, readQ(userId).filter(x => x.id !== item.id))
    cola.items = readQ(userId)
    return { estado: 'guardado', operacion }
  } catch (e) {
    const q = readQ(userId)
    const it = q.find(x => x.id === item.id)
    if (it) {
      it.intentos = item.intentos
      // Sin red: sigue pendiente. Rechazado por el servidor: se queda con el motivo para corregirlo
      it.estado = e.status === 0 ? 'pendiente' : 'error'
      it.error = e.status === 0 ? null : e.message
      writeQ(userId, q)
      cola.items = q
    }
    return { estado: e.status === 0 ? 'pendiente' : 'error', error: e.message }
  }
}

// Reintenta todo lo pendiente (al volver la red o al abrir la pantalla)
export async function sincronizar(userId) {
  if (!userId) return []
  const results = []
  for (const it of readQ(userId).filter(x => x.estado === 'pendiente')) results.push(await enviarUno(userId, it))
  return results
}

export const descartarDeCola = (userId, id) => { writeQ(userId, readQ(userId).filter(x => x.id !== id)); cola.items = readQ(userId) }

// ---------- Presentación ----------
const nf = (v, d) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
export const ha = (m2, d = 2) => (m2 === null || m2 === undefined ? '—' : `${nf(m2 / 10000, d)} ha`)
export const kg = (v, d = 1) => (v === null || v === undefined ? 'desconocido' : `${nf(v, d)} kg`)
export const PROCEDENCIA = {
  oficial: { label: 'Oficial', title: 'Importado de una fuente oficial (SIGPAC)' },
  usuario: { label: 'Declarado', title: 'Lo has declarado tú' },
  dispositivo: { label: 'Medido', title: 'Observado por el dispositivo (GPS o croquis en el mapa)' },
  historial: { label: 'Propuesto', title: 'Propuesto a partir del historial' },
  calculado: { label: 'Calculado', title: 'Calculado a partir de datos confirmados' }
}
export const UNIDADES_DOSIS = ['kg/ha', 't/ha', 'L/ha', 'm3/ha', 'kg', 't', 'L', 'm3']
