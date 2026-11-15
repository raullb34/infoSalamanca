// Newsletter y canal de WhatsApp: qué está configurado en el servidor (GET /api/newsletter/info) y suscribirse.
// La consulta se hace una vez y la comparten el botón flotante y las cajas de las pestañas Agenda e Info.
import axios from 'axios'

const base = import.meta.env.PROD
  ? '/api'
  : `http://${import.meta.env.VITE_BACKEND_HOST || 'localhost'}:${import.meta.env.VITE_BACKEND_PORT || '4000'}/api`

let infoPromise = null
export const newsletterInfo = () => {
  infoPromise = infoPromise || axios.get(`${base}/newsletter/info`, { timeout: 15000 }).then(r => r.data).catch(() => null)
  return infoPromise
}

export const subscribe = (email, acepto) => axios.post(`${base}/newsletter/suscribir`, { email, acepto }, { timeout: 30000 }).then(r => r.data)
