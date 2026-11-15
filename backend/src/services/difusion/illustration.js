// Ilustración del cartel semanal generada con la API de imágenes de OpenAI (OPENAI_API_KEY en el .env).
// Solo la ilustración: el prompt pide "sin texto" y todos los datos del cartel los escribe poster.js, porque los
// modelos de imagen se equivocan con letras y números. Se genera una vez por semana (botón del panel) y se guarda
// junto a los carteles; si no hay clave o falla, el cartel usa la ilustración de serie.
const fs = require('fs')
const path = require('path')
const { DIR } = require('./posterStore')

const MODEL = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'
const enabled = () => Boolean(process.env.OPENAI_API_KEY)

// Paisajes de la provincia, uno por semana del año para que el cartel cambie
const SCENES = [
  'la Plaza Mayor de Salamanca y las torres de la Catedral en piedra dorada de Villamayor, con la dehesa y la sierra al fondo',
  'el puente romano sobre el río Tormes con la Catedral de Salamanca al fondo y los chopos de la ribera',
  'un pueblo de la Sierra de Francia con casas de piedra y entramado de madera, balcones con flores y castaños',
  'los Arribes del Duero: cañones de granito sobre el río, bancales de olivos y almendros',
  'la dehesa salmantina con encinas, toros bravos a lo lejos y un cortijo de piedra',
  'las murallas y la catedral de Ciudad Rodrigo sobre el río Águeda'
]
const SEASON = (month) => (month <= 1 || month === 11 ? { name: 'invierno', light: 'luz fría de invierno, alguna helada o nieve en la sierra' }
  : month <= 4 ? { name: 'primavera', light: 'campos verdes y flores, luz limpia de primavera' }
    : month <= 7 ? { name: 'verano', light: 'luz dorada de atardecer de verano, campos de cereal' }
      : { name: 'otoño', light: 'hojas ocres y doradas, luz cálida de tarde de otoño' })

function isoWeek(iso) {
  const d = new Date(`${iso}T12:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
}

function buildPrompt(digest) {
  const month = Number(digest.desde.slice(5, 7)) - 1
  const season = SEASON(month)
  const scene = SCENES[isoWeek(digest.desde) % SCENES.length]
  const has = (id) => digest.secciones.some(s => s.id === id && s.items.length)
  const details = [
    has('espectaculos') && 'un pequeño escenario de teatro con telón rojo y una guitarra',
    has('fiestas') && 'guirnaldas de banderines y farolillos de fiesta de pueblo',
    has('ciencia') && 'un telescopio antiguo de latón'
  ].filter(Boolean)
  return `Ilustración editorial plana y cálida para la cabecera de un cartel semanal de agenda cultural de la provincia de Salamanca (España), en ${season.name}.
Escena panorámica horizontal: ${scene}.${details.length ? `\nEn primer plano, pequeños detalles que sugieren la agenda de la semana: ${details.join('; ')}.` : ''}
Estilo: ilustración vectorial plana con texturas suaves, paleta verde oliva, ocre, terracota y azul cielo, ${season.light}.
La parte inferior izquierda, más tranquila (cielo o suelo despejado), porque irá encima un título.
Sin texto, sin letras, sin números, sin carteles escritos, sin logotipos, sin marcas de agua.`
}

const fileFor = (desde) => path.join(DIR, `ilustracion-${desde}.png`)
const existing = (desde) => (fs.existsSync(fileFor(desde)) ? fileFor(desde) : null)

async function generate(digest) {
  if (!enabled()) throw new Error('Falta OPENAI_API_KEY en el .env del servidor')
  const prompt = buildPrompt(digest)
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL(), prompt, size: '1536x1024', quality: 'medium', n: 1 }),
    signal: AbortSignal.timeout(120000)
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`OpenAI: ${json.error?.message || res.status}`)
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI no ha devuelto imagen')
  await fs.promises.mkdir(DIR, { recursive: true })
  await fs.promises.writeFile(fileFor(digest.desde), Buffer.from(b64, 'base64'))
  return { file: fileFor(digest.desde), prompt, modelo: MODEL() }
}

module.exports = { generate, existing, enabled, buildPrompt, _test: { isoWeek } }
