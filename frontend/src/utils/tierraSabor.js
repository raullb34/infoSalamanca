// Escaparate de un productor Tierra de Sabor: agrupa sus productos por variedad, saca de cada nombre la
// presentación ("Jamón de Bellota 100% Ibérico" → "Bellota 100%"), el precinto del ibérico y los sellos.

import PHOTOS from '@/data/productImages.json'
import PRODUCER_LOGOS from '@/data/producerLogos.json'

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// La Junta publica los nombres en mayúsculas y sin tildes
const ACCENTS = {
  jamon: 'jamón', iberico: 'ibérico', iberica: 'ibérica', ibericos: 'ibéricos', ibericas: 'ibéricas',
  salchichon: 'salchichón', morcon: 'morcón', leon: 'León', ecologica: 'ecológica', artesania: 'artesanía',
  fuentesauco: 'Fuentesaúco', polvoron: 'polvorón', polvorones: 'polvorones', turron: 'turrón', mazapan: 'mazapán',
  roscon: 'roscón', limon: 'limón', anis: 'anís', azucar: 'azúcar', platano: 'plátano', unico: 'único',
  tipico: 'típico', tipicos: 'típicos', clasico: 'clásico', clasicos: 'clásicos', atun: 'atún', datiles: 'dátiles',
  angel: 'ángel', chicharron: 'chicharrón', 'piñon': 'piñón', sesamo: 'sésamo', maimon: 'maimón', cana: 'caña', canas: 'cañas'
}
const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'con', 'al'])

export function niceCase(text) {
  return String(text || '').toLowerCase().split(/(\s+|-|\/)/).map((w, i) => {
    const fixed = ACCENTS[w] || w
    if (i > 0 && SMALL.has(fixed)) return fixed
    return /[a-záéíóúñü]/.test(fixed) ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed
  }).join('')
}

// Color e icono de cada sección del catálogo de Tierra de Sabor
const SECTIONS = {
  'Charcutería': { accent: '#a8323e', emoji: '🍖' },
  'Carnes': { accent: '#8e2a2a', emoji: '🥩' },
  'Quesos y otros lácteos': { accent: '#c28a00', emoji: '🧀' },
  'Bebidas': { accent: '#7a2a5c', emoji: '🍷' },
  'Panadería y repostería': { accent: '#b8692a', emoji: '🥐' },
  'Alimentación general': { accent: '#5f7f1f', emoji: '🫘' },
  'Conservas': { accent: '#2f7a6a', emoji: '🥫' },
  'Platos preparados': { accent: '#9a4f2a', emoji: '🥟' },
  'Frutas': { accent: '#c23a55', emoji: '🍓' },
  'Verduras, hortalizas y productos silvestres': { accent: '#3f8a2a', emoji: '🍅' }
}
export const sectionTheme = (s) => SECTIONS[s] || { accent: '#4a7c3a', emoji: '🧺' }

// Icono de cada variedad (el primero que encaje)
const EMOJI = [
  [/jamon|paleta/, '🍖'], [/lomo|salchichon|chorizo|longaniza|morcon/, '🥓'], [/cerdo/, '🐖'], [/vacuno|ternera/, '🥩'],
  [/queso/, '🧀'], [/yogur|leche/, '🥛'], [/vino/, '🍷'], [/licor|aguardiente|orujo/, '🥃'], [/agua/, '💧'],
  [/miel|polen/, '🍯'], [/lentej|garbanz|alubia|legumbre/, '🫘'], [/aceite/, '🫒'], [/patata/, '🥔'],
  [/caramelizad|almendra/, '🥜'], [/caramelo|golosina/, '🍬'], [/rosquill|rosco/, '🍩'], [/roscon/, '👑'],
  [/hornazo|empanada/, '🥧'], [/magdalena|bollo|brioche|bolleria/, '🧁'], [/tarta|bizcocho|pastel/, '🍰'],
  [/galleta|pasta|mantecado|polvoron|tortas/, '🍪'], [/turron|mazapan/, '🍫'], [/huevo/, '🥚'],
  [/fresa/, '🍓'], [/arandano|mora/, '🫐'], [/tomate/, '🍅'], [/pan/, '🥖']
]
export function emojiFor(variedad, seccion) {
  const p = plain(variedad)
  return (EMOJI.find(([re]) => re.test(p)) || [])[1] || sectionTheme(seccion).emoji
}

// Foto de Wikimedia Commons de cada variedad (scripts/build-product-images.mjs), con autor y licencia
export const photoFor = (variedad) => PHOTOS.variedades[variedad] || null

// Logotipo del productor sacado de su web (backend/scripts/build-tierra-sabor-logos.js)
export const logoFor = (idempresa) => PRODUCER_LOGOS.logos[idempresa] || null

// Precinto del ibérico (Real Decreto 4/2014): negro, rojo, verde o blanco según alimentación y raza
const PRECINTOS = {
  negro: { label: 'Bellota 100% ibérico', color: '#1d1d1f', rank: 0 },
  rojo: { label: 'Bellota ibérico', color: '#c8102e', rank: 1 },
  verde: { label: 'Cebo de campo ibérico', color: '#2e8b3e', rank: 2 },
  blanco: { label: 'Cebo ibérico', color: '#f2f2f2', rank: 3 }
}
export function precintoOf(product) {
  if (!/NORMA DE CALIDAD DEL IBERICO/i.test(product.calidad || '')) return null
  const n = plain(product.nombre)
  let key = null
  if (/bellota/.test(n)) key = /100\s*%/.test(n) ? 'negro' : 'rojo'
  else if (/cebo de campo/.test(n)) key = 'verde'
  else if (/cebo/.test(n)) key = 'blanco'
  return key ? { key, ...PRECINTOS[key] } : null
}
export const PRECINTO_LIST = Object.entries(PRECINTOS).map(([key, v]) => ({ key, ...v }))

// Sellos de calidad: sigla para la "estampilla" y nombre legible
// Logotipos oficiales de la UE (dominio público): DOP (también las D.O. de vino), IGP, ETG y ecológico
const LOGOS = { DOP: 'dop', DO: 'dop', IGP: 'igp', ETG: 'etg', ECO: 'eco' }
export function sealOf(raw) {
  const s = sealInfo(raw)
  const logo = PHOTOS.sellos[LOGOS[s.abbr]]
  return logo ? { ...s, logo: logo.src } : s
}
function sealInfo(raw) {
  const c = String(raw || '').trim()
  let m
  if (/NORMA DE CALIDAD DEL IBERICO/i.test(c)) return { abbr: 'RD', name: 'Norma de calidad del ibérico' }
  if ((m = c.match(/^D\.?O\.?P\.?\s+(.+)/i))) return { abbr: 'DOP', name: niceCase(m[1]) }
  if ((m = c.match(/^I\.G\.P\.\s+(.+)/i))) return { abbr: 'IGP', name: niceCase(m[1]) }
  if ((m = c.match(/^M\.G\.\s+(.+)/i))) return { abbr: 'MG', name: niceCase(m[1]) }
  if ((m = c.match(/^E\.T\.G\.\s+(.+)/i))) return { abbr: 'ETG', name: niceCase(m[1]) }
  if ((m = c.match(/D\.O\.\s+(.+)/i))) return { abbr: 'DO', name: niceCase(m[1]) }
  if (/ECOLOGICA/i.test(c)) return { abbr: 'ECO', name: 'Agricultura ecológica' }
  if (/ARTESANIA/i.test(c)) return { abbr: 'ART', name: 'Artesanía alimentaria' }
  if ((m = c.match(/PROTOCOLO PRIVADO \((.+)\)/i))) return { abbr: m[1].replace(/\s+/g, ''), name: `Certificación ${m[1]}` }
  if (/AGUAS MINERALES/i.test(c)) return { abbr: 'RD', name: 'Agua mineral natural' }
  return { abbr: '✓', name: niceCase(c) }
}
export const sealsOf = (products) => {
  const out = new Map()
  for (const p of products) {
    for (const c of String(p.calidad || '').split(';').map(x => x.trim()).filter(Boolean)) {
      if (!out.has(c)) out.set(c, { ...sealOf(c), raw: c, count: 0 })
      out.get(c).count++
    }
  }
  // Las denominaciones (DOP, IGP…) primero; las certificaciones privadas al final
  const order = ['DOP', 'IGP', 'DO', 'ETG', 'MG', 'ECO', 'ART', 'RD']
  return [...out.values()].sort((a, b) => ((order.indexOf(a.abbr) + 1 || 99) - (order.indexOf(b.abbr) + 1 || 99)) || b.count - a.count)
}

// Lo que el nombre añade a la variedad: "Jamon de Cebo de Campo 100% Iberico" (Jamón ibérico) → "Cebo de Campo 100%"
const GENERIC = new Set(['iberico', 'iberica', 'curado', 'curada', 'extra'])
export function presentationOf(product) {
  const drop = new Set([...plain(product.variedad).split(/\s+/), ...GENERIC])
  const words = String(product.nombre || '').split(/\s+/).filter(w => !drop.has(plain(w)))
  while (words.length && SMALL.has(plain(words[0]))) words.shift()
  while (words.length && SMALL.has(plain(words[words.length - 1]))) words.pop()
  // "Caña de Lomo de Bellota" sin "Lomo" deja "Caña de de Bellota"
  for (let i = words.length - 1; i > 0; i--) if (SMALL.has(plain(words[i])) && plain(words[i]) === plain(words[i - 1])) words.splice(i, 1)
  const label = niceCase(words.join(' '))
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : niceCase(product.nombre)
}

// Grupos para el carrusel: una tarjeta por variedad, con sus presentaciones (sin repetir) y marcas
export function groupProducts(products) {
  const groups = new Map()
  for (const p of products) {
    const key = p.variedad || p.categoria || p.nombre
    if (!groups.has(key)) {
      groups.set(key, {
        key, title: /[a-z]/.test(key) ? key.charAt(0).toUpperCase() + key.slice(1) : niceCase(key), seccion: p.seccion, categoria: p.categoria,
        emoji: emojiFor(key, p.seccion), photo: photoFor(key), accent: sectionTheme(p.seccion).accent, variants: new Map(), marcas: new Set(), total: 0
      })
    }
    const g = groups.get(key)
    g.total++
    const marca = p.marca ? niceCase(p.marca) : null
    if (marca) g.marcas.add(marca)
    const label = presentationOf(p)
    if (!g.variants.has(label)) g.variants.set(label, { label, nombre: niceCase(p.nombre), precinto: precintoOf(p), marcas: new Set(), seals: new Set() })
    const v = g.variants.get(label)
    if (marca) v.marcas.add(marca)
    for (const c of String(p.calidad || '').split(';').map(x => x.trim()).filter(Boolean)) v.seals.add(sealOf(c).abbr)
  }
  return [...groups.values()].map(g => ({
    ...g,
    marcas: [...g.marcas].sort(),
    variants: [...g.variants.values()]
      .map(v => ({ ...v, marcas: [...v.marcas].sort(), seals: [...v.seals] }))
      .sort((a, b) => ((a.precinto?.rank ?? 9) - (b.precinto?.rank ?? 9)) || a.label.localeCompare(b.label, 'es'))
  })).sort((a, b) => b.total - a.total || a.title.localeCompare(b.title, 'es'))
}
