// Redacción de respuestas con Groq (API compatible con la de OpenAI).
// GROQ_API_KEY en el .env del servidor; GROQ_MODEL y GROQ_FALLBACK_MODEL opcionales.
// Si no hay clave, se acaba el cupo o falla, lanza un error y el asistente responde por plantilla.
const axios = require('axios')

const URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODELS = () => [
  process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant'
]

const enabled = () => !!process.env.GROQ_API_KEY

async function complete(messages, { maxTokens = 550, temperature = 0.2 } = {}) {
  if (!enabled()) throw new Error('Sin GROQ_API_KEY')
  let lastError
  for (const model of [...new Set(MODELS())]) {
    try {
      const { data } = await axios.post(URL, { model, messages, temperature, max_tokens: maxTokens }, {
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
