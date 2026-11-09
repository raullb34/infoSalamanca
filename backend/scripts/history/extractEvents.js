// Hitos con fecha a partir de un texto: cada frase que menciona un año ("en 1161", "hacia 1258"),
// un año antes de Cristo ("220 a. C.") o un siglo ("siglo XII") se convierte en { year, label, text }.
// year sirve para ordenar (negativo = a. C.; los siglos van a su mitad); label es lo que se muestra.

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 }
const roman = (s) => {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], next = ROMAN[s[i + 1]] || 0
    n += v < next ? -v : v
  }
  return n
}

const NOW = new Date().getFullYear()
const MAX_TEXT = 240

// Frases sobre población, elecciones o datos de hoy: no son historia
const NOT_HISTORY = /habitantes|censo|padr[oó]n|\bINE\b|elecciones|concejal|alcald[ea]s? actual|tasa|renta|desempleo|km²|hect[aá]reas/i

function splitSentences(text) {
  // Proteger abreviaturas con punto para no cortar ahí
  const safe = String(text || '')
    .replace(/\ba\.\s?C\./g, 'a·C·').replace(/\bd\.\s?C\./g, 'd·C·')
    .replace(/\b(S|Sta|Sto|Dña|Dª|D|Fr|Mons|Excmo|ss|s|aprox|etc|n\.º|núm)\./g, '$1·')
  return safe
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"(0-9])/)
    .map(s => s.replace(/·/g, '.').replace(/\bsiglos siglo\b/g, 'siglos').replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 25)
}

// Fecha más concreta de una frase: año a. C. > año > siglo
function dateOf(sentence) {
  const bc = sentence.match(/\b(\d{1,4})\s*a\.\s?C\./)
  if (bc && !/siglo/i.test(sentence.slice(Math.max(0, bc.index - 12), bc.index))) {
    const n = Number(bc[1])
    return { year: -n, label: `${n} a. C.` }
  }
  // Año: 3 o 4 cifras precedidas por una palabra de fecha, o 4 cifras de 1000 a hoy; nunca seguidas de unidades
  const units = '(?!\\s*(?:habitantes|vecinos|metros|m\\b|km|kil[oó]metros|hect|ha\\b|%|euros|€|reales|maraved|fanegas|cabezas|personas|alumnos))'
  const withWord = new RegExp(`\\b(?:en|año|años|hacia|desde|hasta|entre|del|de|el|c\\.|circa|fechad[oa] en|data de)\\s+(?:el\\s+)?(?:año\\s+)?(\\d{3,4})\\b${units}`, 'i')
  const plain = new RegExp(`(?<![\\d.,])\\b(1\\d{3}|20[0-2]\\d)\\b(?![.,]\\d)${units}`)
  const m = sentence.match(withWord) || sentence.match(plain)
  if (m) {
    const y = Number(m[1])
    if (y >= 400 && y <= NOW) return { year: y, label: String(y) }
  }
  const c = sentence.match(/\bsiglos?\s+([IVXLC]+)\b(\s*a\.\s?C\.)?/)
  if (c) {
    const n = roman(c[1])
    if (n >= 1 && n <= 21) {
      return c[2]
        ? { year: -(n - 1) * 100 - 50, label: `Siglo ${c[1]} a. C.` }
        : { year: (n - 1) * 100 + 50, label: `Siglo ${c[1]}` }
    }
  }
  return null
}

const cut = (s) => (s.length <= MAX_TEXT ? s : s.slice(0, s.lastIndexOf(' ', MAX_TEXT - 1)) + '…')

// texts: [string]; devuelve [{ year, label, text }] en orden del texto
function extractEvents(texts, { prefix = '' } = {}) {
  const out = []
  for (const text of [].concat(texts || [])) {
    for (const sentence of splitSentences(text)) {
      if (NOT_HISTORY.test(sentence)) continue
      const d = dateOf(sentence)
      if (!d) continue
      out.push({ ...d, text: cut(prefix ? `${prefix}: ${sentence}` : sentence) })
    }
  }
  return out
}

// Ordena, quita casi repetidos y, si hay demasiados, se queda con un reparto por toda la historia
function pickEvents(events, max = 16) {
  const seen = new Set()
  const unique = []
  for (const e of [...events].sort((a, b) => a.year - b.year)) {
    const key = `${e.label}|${e.text.toLowerCase().replace(/[^a-záéíóúñ]/g, '').slice(0, 60)}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(e)
  }
  if (unique.length <= max) return unique
  // Años exactos antes que siglos, repartidos a lo largo del tiempo
  const step = unique.length / max
  return Array.from({ length: max }, (_, i) => unique[Math.floor(i * step)])
}

module.exports = { extractEvents, pickEvents, splitSentences, dateOf }
