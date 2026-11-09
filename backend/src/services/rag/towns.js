// Pueblos que se nombran en una pregunta ("¿qué ver en la alberca?", "fiestas de Bejar").
const ineJson = require('../../helpers/ine-codigopostal.json')
const { displayName } = require('../../helpers/townIndex')

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim()

// Variantes de cada nombre: "La Alberca" y "Alberca"; "Valdefuentes de Sangusín"...
// Sin artículo solo si el nombre es largo: "Encina" o "Tejado" son palabras corrientes
const variants = []
const seen = new Set()
for (const row of ineJson) {
  const ine = String(row.CodMunicipio)
  if (!/^37\d{3}$/.test(ine) || seen.has(ine)) continue
  seen.add(ine)
  const name = displayName(row.Municipio)
  const full = plain(name)
  variants.push({ ine, name, key: full })
  const bare = full.replace(/^(la|el|los|las) /, '')
  if (bare !== full && bare.length >= 7) variants.push({ ine, name, key: bare })
}
variants.sort((a, b) => b.key.length - a.key.length) // los nombres largos primero ("Villar de Ciervo" antes que "Villar")

function findTownsInText(text) {
  let q = ` ${plain(text)} `
  // "la provincia de Salamanca" no es el municipio de Salamanca
  q = q.replace(/ provincia de salamanca /g, ' provincia ')
  const found = []
  for (const v of variants) {
    const needle = ` ${v.key} `
    if (!q.includes(needle)) continue
    if (!found.some(f => f.ine === v.ine)) found.push({ ine: v.ine, name: v.name })
    q = q.split(needle).join(' ') // que "Ciudad Rodrigo" no cuente también como otro pueblo
  }
  return found.slice(0, 3)
}

module.exports = { findTownsInText }
