// Escaparate de un productor Tierra de Sabor: agrupa sus productos por variedad, saca de cada nombre la
// presentación ("Jamón de Bellota 100% Ibérico" → "Bellota 100%"), el precinto del ibérico y los sellos.

import PHOTOS from '@/data/productImages.json'
import PRODUCER_LOGOS from '@/data/producerLogos.json'
import ILLUSTRATIONS from '@/data/productIllustrations.json'
import AWARDS from '@/data/producerAwards.json'

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

// Tipos de comida para filtrar productores (mapa y lista). Salen de la variedad de sus productos, no de la
// sección de la Junta ("Alimentación general" mezcla legumbres, miel, aceite y patatas). El primero que encaje.
export const FOOD_TYPES = [
  { id: 'ibericos', label: 'Ibéricos y embutidos', emoji: '🍖', re: /jamon|paleta|lomo|chorizo|salchichon|morcon|longaniza/ },
  { id: 'carnes', label: 'Carne fresca', emoji: '🥩', re: /cerdo|vacuno|ternera|cordero|cabrito/ },
  { id: 'quesos', label: 'Quesos y lácteos', emoji: '🧀', re: /queso|yogur|leche/ },
  { id: 'legumbres', label: 'Legumbres', emoji: '🫘', re: /lentej|garbanz|alubia|legumbre/ },
  { id: 'miel', label: 'Miel', emoji: '🍯', re: /miel|polen/ },
  { id: 'dulces', label: 'Dulces', emoji: '🍪', re: /rosquill|rosco|bolleria|brioche|bollo|galleta|huevo hilado|magdalena|mantecado|mazapan|pasta|pastel|polvoron|roscon|tarta|bizcocho|torta|turron|caramel/ },
  { id: 'hornazos', label: 'Hornazos y empanadas', emoji: '🥧', re: /hornazo|empanada/ },
  { id: 'vinos', label: 'Vinos', emoji: '🍷', re: /^vino/ },
  { id: 'licores', label: 'Licores', emoji: '🥃', re: /licor|aguardiente|orujo/ },
  { id: 'frutas', label: 'Frutas y verduras', emoji: '🍓', re: /fresa|mora|arandano|tomate|fruta|verdura|hortaliza/ },
  { id: 'otros', label: 'Aceite, agua y aperitivos', emoji: '🫒', re: /aceite|agua|patata/ }
]
export const foodTypeOf = (variedad) => (FOOD_TYPES.find(t => t.re.test(plain(variedad))) || FOOD_TYPES[FOOD_TYPES.length - 1]).id
// Tipos de un productor (de la lista /api/gastro, que trae sus variedades)
export const foodTypesOf = (producer) => [...new Set((producer.variedades || []).map(foodTypeOf))]

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

// Ilustración de cada presentación (scripts/product-illustrations.json, hechas con IA: envases genéricos, sin marcas).
// Primero las concretas de su variedad: las de su productor ('empresas': las rosquillas de Bletisa son las de
// Ledesma aunque se llamen solo "Rosquillas"), por una palabra del nombre ('pardina', 'brezo'…) o por el precinto
// del ibérico (negro, rojo, verde, blanco); si ninguna encaja, la general de la variedad.
export function illustrationFor(product, idempresa = null) {
  const name = plain(product.nombre)
  const precinto = precintoOf(product)?.key || null
  const own = ILLUSTRATIONS.items.filter(it => it.variedad.includes(product.variedad))
  const byProducer = idempresa != null && own.find(it => it.empresas?.includes(Number(idempresa)))
  if (byProducer) return byProducer
  const specific = own.find(it => (it.match || it.precinto) &&
    (!it.match || [].concat(it.match).some(m => name.includes(m))) &&
    (!it.precinto || it.precinto === precinto))
  return specific || own.find(it => !it.match && !it.precinto) || own.find(it => it.card) || null
}
// La de la tarjeta de una variedad
export const cardIllustrationFor = (variedad) => ILLUSTRATIONS.items.find(it => it.card && it.variedad.includes(variedad)) || null
// Imagen de la variedad: la propia del productor si la tiene ('empresas'), la de la tarjeta de la variedad, o si no
// hay ilustración, la foto de Wikimedia Commons
const imageFor = (variedad, idempresa = null) => {
  const own = idempresa != null && ILLUSTRATIONS.items.find(it => it.variedad.includes(variedad) && it.empresas?.includes(Number(idempresa)))
  const il = own || cardIllustrationFor(variedad)
  return il ? { src: il.src, illustration: true } : photoFor(variedad)
}

// Premios del productor (data/producerAwards.json, añadidos a mano con su fuente)
export const awardsFor = (idempresa) => AWARDS.premios[String(idempresa)] || []

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
// Logotipos de cada consejo regulador o marca (aportados a mano): mandan sobre el genérico de la UE
const OWN_LOGOS = [
  [/LENTEJA DE LA ARMU/i, 'lenteja-armuna'],
  [/LENTEJA DE TIERRA DE CAMPOS/i, 'lenteja-tierra-de-campos'],
  [/GARBANZO DE FUENTESAUCO/i, 'garbanzo-fuentesauco'],
  [/GARBANZO DE PEDROSILLO/i, 'garbanzo-pedrosillo'],
  [/ALUBIA DE LA BA/i, 'alubia-la-baneza'],
  [/CARNE DE SALAMANCA/i, 'carne-de-salamanca'],
  [/VINO DE LA TIERRA DE CASTILLA Y LEON/i, 'vino-tierra-castilla-leon'],
  [/TIERRA DEL VINO DE ZAMORA/i, 'tierra-del-vino-zamora'],
  [/SIERRA DE SALAMANCA/i, 'sierra-de-salamanca'],
  [/QUESO ARRIBES DE SALAMANCA/i, 'queso-arribes'],
  [/D\.O\. ARRIBES/i, 'arribes'],
  [/JAMON DE GUIJUELO/i, 'guijuelo'],
  [/IBERICOS DE SALAMANCA/i, 'ibericos-de-salamanca'],
  [/E\.T\.G\. JAMON SERRANO/i, 'consorcio-serrano'],
  [/TERNERA CHARRA/i, 'ternera-charra'],
  [/ARTESANIA ALIMENTARIA/i, 'artesania-alimentaria']
]
// Las DOP, IGP y ETG llevan los dos: el de su consejo regulador (si lo tenemos) y el oficial de la UE
export function sealOf(raw) {
  const s = sealInfo(raw)
  const own = OWN_LOGOS.find(([re]) => re.test(raw || ''))
  const eu = PHOTOS.sellos[LOGOS[s.abbr]]?.src || null
  if (own) return { ...s, logo: `/assets/sellos/${own[1]}.webp`, own: true, euLogo: eu }
  return eu ? { ...s, logo: eu } : s
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
export function groupProducts(products, idempresa = null) {
  const groups = new Map()
  for (const p of products) {
    const key = p.variedad || p.categoria || p.nombre
    if (!groups.has(key)) {
      groups.set(key, {
        key, title: /[a-z]/.test(key) ? key.charAt(0).toUpperCase() + key.slice(1) : niceCase(key), seccion: p.seccion, categoria: p.categoria,
        emoji: emojiFor(key, p.seccion), photo: imageFor(key, idempresa), accent: sectionTheme(p.seccion).accent, variants: new Map(), marcas: new Set(), total: 0
      })
    }
    const g = groups.get(key)
    g.total++
    const marca = p.marca ? niceCase(p.marca) : null
    if (marca) g.marcas.add(marca)
    const label = presentationOf(p)
    if (!g.variants.has(label)) g.variants.set(label, { label, nombre: niceCase(p.nombre), precinto: precintoOf(p), illustration: illustrationFor(p, idempresa), marcas: new Set(), seals: new Set() })
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
