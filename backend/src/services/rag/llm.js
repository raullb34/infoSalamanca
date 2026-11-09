// Redacción de respuestas con Groq (API compatible con la de OpenAI).
// GROQ_API_KEY en el .env del servidor; GROQ_MODEL y GROQ_FALLBACK_MODEL opcionales.
// Si no hay clave, se acaba el cupo o falla, lanza un error y el asistente responde por plantilla.
const axios = require('axios')

const URL = 'https://api.groq.com/openai/v1/chat/completions'
// Los modelos de Groq cambian: en nov. 2026 ya no están los Llama 3.x (404). Se cambian con GROQ_MODEL.
const MODELS = () => [
  process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  process.env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b'
]

const enabled = () => !!process.env.GROQ_API_KEY

// maxTokens incluye el razonamiento de los modelos gpt-oss (se les pide poco)
async function complete(messages, { maxTokens = 1500, temperature = 0.2 } = {}) {
  if (!enabled()) throw new Error('Sin GROQ_API_KEY')
  let lastError
  for (const model of [...new Set(MODELS())]) {
    try {
      const body = { model, messages, temperature, max_tokens: maxTokens }
      if (/gpt-oss/.test(model)) body.reasoning_effort = 'low'
      const { data } = await axios.post(URL, body, {
        timeout: 25000,
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }
      })
      const text = data?.choices?.[0]?.message?.content?.trim()
      if (text) return { text, model }
      lastError = new Error('Respuesta vacía')
    } catch (err) {
      const status = err.response?.status
      lastError = new Error(`Groq ${model}: ${status || err.code || err.message}`)
      // Sin cupo, modelo retirado o error del servicio: probar el siguiente modelo; clave mala: parar
      if (status === 401 || status === 403) break
    }
  }
  throw lastError
}

module.exports = { complete, enabled }
