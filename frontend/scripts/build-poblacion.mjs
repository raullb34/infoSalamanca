// Genera public/data/poblacion.json: población de cada municipio en los censos desde 1842.
// Fuente: INE, "Alteraciones de los municipios en los Censos de Población desde 1842"
// (https://www.ine.es/intercensal/). Se usa la población de derecho y, si falta, la de hecho.
// Resultado: { generated, source, years: [1842, …], towns: { "37170": { pop: [1629, 3121, …], notes: [...] } } }
//
// Uso (desde frontend/):  node scripts/build-poblacion.mjs        (unos 6 minutos: una consulta por segundo)
// Si el JSON ya existe, solo pide los municipios que faltan (el INE a veces responde sin tabla si se va deprisa).
// Los municipios que desaparecieron (p. ej. Campillo de Salvatierra, agregado a Guijuelo) no tienen los censos recientes.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', 'public', 'data', 'poblacion.json')
const INE_JSON = path.join(HERE, '..', '..', 'backend', 'src', 'helpers', 'ine-codigopostal.json')
const URL = (cod) => `https://www.ine.es/intercensal/intercensal.do?search=3&codigoProvincia=37&codigoMunicipio=${cod}&btnBuscarCod=Consultar+selecci%C3%B3n`
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const decode = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é')
  .replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&amp;/g, '&')
  .replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

function parse(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => decode(c[1])))
  // Fila de los censos; algunos años llevan una nota pegada ("1842 [1]")
  const yearsRow = rows.find(r => r.length > 5 && r.every(c => /^\d{4}\b/.test(c)))?.map(c => c.slice(0, 4))
  if (!yearsRow) return null
  const num = (v) => (/^\d+$/.test(v) ? Number(v) : null)
  const row = (label) => rows.find(r => r[0] && r[0].toLowerCase().startsWith(label))
  const derecho = row('población de derecho')?.slice(1).map(num) || []
  const hecho = row('población de hecho')?.slice(1).map(num) || []
  const pop = yearsRow.map((_, i) => derecho[i] ?? hecho[i] ?? null)
  // Cambios del término municipal (incorporaciones, segregaciones…), útiles para entender los saltos
  const notes = rows.map(r => r[0]).filter(t => t && /^Entre el Censo/.test(t)).map(t => t.replace(/\s*\.\s*$/, '.'))
  return { years: yearsRow.map(Number), pop, notes }
}

const ines = [...new Set(JSON.parse(fs.readFileSync(INE_JSON, 'utf8')).map(r => String(r.CodMunicipio)).filter(i => /^37\d{3}$/.test(i)))].sort()
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null
const towns = previous?.towns || {}
let years = previous?.years || null
const todo = ines.filter(ine => !towns[ine])
console.log(`${todo.length} municipios por descargar`)

async function fetchTown(ine) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(URL(Number(ine.slice(2))), { headers: { 'User-Agent': UA } })
    const data = parse(await res.text())
    if (data) return data
    await sleep(4000 * (attempt + 1)) // sin tabla: el INE pide calma
  }
  return null
}
let n = 0
for (const ine of todo) {
  try {
    const data = await fetchTown(ine)
    if (data) {
      years = years || data.years
      // Algunos municipios no tienen todos los censos (se crearon o desaparecieron): se alinean por año
      const pop = years.map(y => { const i = data.years.indexOf(y); return i >= 0 ? data.pop[i] : null })
      if (pop.some(v => v != null)) towns[ine] = { pop, ...(data.notes.length ? { notes: data.notes } : {}) }
    } else {
      console.warn(`  ⚠️ ${ine}: sin tabla`)
    }
  } catch (e) {
    console.warn(`  ⚠️ ${ine}: ${e.message}`)
  }
  if (++n % 25 === 0) console.log(`  ${n}/${todo.length}`)
  await sleep(1000)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(),
  source: 'INE · Alteraciones de los municipios en los Censos de Población desde 1842',
  sourceUrl: 'https://www.ine.es/intercensal/',
  years,
  towns
}))
console.log(`✅ poblacion.json: ${Object.keys(towns).length} municipios, censos ${years?.[0]}–${years?.[years.length - 1]}, ${Math.round(fs.statSync(OUT).size / 1024)} KB`)
