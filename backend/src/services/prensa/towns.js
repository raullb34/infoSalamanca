// ¿De qué pueblos de la provincia habla una noticia? Se buscan los 362 nombres oficiales en el texto, con su
// mayúscula ("Encina de San Silvestre", no "encina") y con o sin el artículo ("La Fuente de San Esteban" y
// "Fuente de San Esteban"). Los nombres que también son palabras corrientes o nombres de persona ("Vecinos",
// "Pastores", "Valero", "Cristóbal"…) solo cuentan tras una preposición ("en Vecinos", "de Valero").
// La capital se trata aparte: casi todas las noticias dicen "Salamanca" (el medio, la provincia).
const ineJson = require('../../helpers/ine-codigopostal.json')
const { displayName } = require('../../helpers/townIndex')

// Nombres de una palabra que también son palabras corrientes, nombres o apellidos
const AMBIGUOUS = new Set(['Vecinos', 'Pastores', 'Puertas', 'Huerta', 'Valero', 'Cristóbal', 'Vita', 'Agallas', 'Sando', 'Navales', 'Hoya', 'Payo', 'Lagunilla', 'Molinillo', 'Moriscos', 'Rollán', 'Mieza', 'Sequeros'])
// Cómo los nombra la prensa cuando no usa el nombre oficial completo
const ALIASES = {
  'Peñaranda de Bracamonte': ['Peñaranda'],
  'Villares de la Reina': ['Villares'],
  'Santa Marta de Tormes': ['Santa Marta'],
  'Carbajosa de la Sagrada': ['Carbajosa'],
  'Aldeadávila de la Ribera': ['Aldeadávila'],
  'Sancti-Spíritus': ['Sancti Spíritus', 'Sancti Spiritus'],
  'Castellanos de Moriscos': []
}
const CAPITAL = '37274'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const towns = new Map() // ine → { ine, name, variants }
for (const row of ineJson) {
  const ine = String(row.CodMunicipio)
  if (towns.has(ine) || ine === CAPITAL) continue
  const name = displayName(row.Municipio)
  if (!name.trim()) continue // hay una fila sin nombre
  const bare = name.replace(/^(La|El|Los|Las)\s+/, '')
  towns.set(ine, { ine, name, variants: [...new Set([name, bare, ...(ALIASES[name] || [])])].filter(v => v.trim()) })
}

// Una expresión por pueblo (se prueban todas: son pocas y el texto es corto)
const PREP = '(?:en|de|del|a|al|desde|hasta|para|por|entre)\\s+(?:(?:la|el|los|las)\\s+)?'
const matchers = [...towns.values()].map(t => {
  const alts = t.variants.map(esc).join('|')
  const ambiguous = t.variants.some(v => AMBIGUOUS.has(v))
  const re = new RegExp(`(?<![\\p{L}])${ambiguous ? PREP : ''}(?:${alts})(?![\\p{L}])`, ambiguous ? 'iu' : 'u')
  // Los ambiguos: la preposición sin mayúsculas, pero el nombre sí con la suya
  return { ...t, re, ambiguous }
})

// Pueblos que nombra un texto, en orden de aparición
function townsIn(text) {
  const s = String(text || '')
  const hits = []
  for (const t of matchers) {
    const m = t.re.exec(s)
    if (!m) continue
    // En los ambiguos la bandera i permitiría "en vecinos": el nombre tiene que ir con mayúscula
    if (t.ambiguous && !t.variants.some(v => m[0].includes(v))) continue
    hits.push({ ine: t.ine, name: t.name, at: m.index })
  }
  return hits.sort((a, b) => a.at - b.at).map(({ ine, name }) => ({ ine, name }))
}

const capital = { ine: CAPITAL, name: 'Salamanca' }
// La capital solo si se nombra como ciudad ("en Salamanca", "la ciudad", "el Ayuntamiento de Salamanca"…)
// ("la provincia de Salamanca", "la Diputación de Salamanca" no son la ciudad)
const CAPITAL_RE = /(?<![\p{L}])(?:(?:en|la ciudad de|el ayuntamiento de)\s+Salamanca(?![\p{L}])(?!\s+y\s+(?:su\s+)?provincia)|Salamanca capital|la capital salmantina)/iu

/**
 * Pueblos de una noticia, del más al menos seguro: los del título, los de las categorías del medio y los del
 * principio del texto; si es de un medio comarcal y no nombra ninguno, su pueblo; la capital, si no hay otro.
 */
function townsOf(item) {
  const seen = new Map()
  const add = (list) => list.forEach(t => { if (!seen.has(t.ine)) seen.set(t.ine, t) })
  add(townsIn(item.titulo))
  add(townsIn((item.categorias || []).join(' · ')))
  add(townsIn(`${item.resumen || ''} ${String(item.texto || '').slice(0, 800)}`))
  if (!seen.size && item.comarcal) add(townsIn(item.comarcal))
  if (!seen.size && (CAPITAL_RE.test(item.titulo) || CAPITAL_RE.test(String(item.texto || '').slice(0, 400)))) add([capital])
  return [...seen.values()]
}

// ¿Lo nombra en el título? (para las noticias de la ficha del pueblo: las de título, más seguras)
const inTitle = (item, ine) => (ine === CAPITAL ? CAPITAL_RE.test(item.titulo) : townsIn(item.titulo).some(t => t.ine === ine))

module.exports = { townsOf, townsIn, inTitle, CAPITAL }
