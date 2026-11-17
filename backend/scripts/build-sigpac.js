#!/usr/bin/env node
// Cartografía agrícola (SIGPAC) de un municipio para la pantalla "Cartografía agrícola" de la web.
//
//   node scripts/build-sigpac.js 37022            (uno o varios códigos; piloto: Aldeaseca de la Frontera)
//
// Fuente: SIGPAC que publica el ITACyL (http://ftp.itacyl.es/cartografia/05_SIGPAC/<año>_ETRS89/), un ZIP por
// municipio con tres Shapefile en ETRS89 geográficas: polígonos (POLFE), parcelas (PARFE) y recintos (RECFE).
// Los municipios van con el código del Catastro, que casi siempre coincide con el del INE (no en todos: Ledesma es
// 37171 en el Catastro y 37170 en el INE); aquí se busca el fichero por el código y, si no está, por el nombre.
//
// Licencia del ITACyL (IGCYL-NC): "uso gratuito de los datos, pero queda prohibida su explotación comercial".
// Vale para la web, que es gratuita. Para un uso de pago (la API) hay que tomar los recintos del FEGA (servicio
// ATOM, CC BY 4.0). En los dos casos hay que citar la fuente; los recintos, además, a la Dirección General del
// Catastro con la fecha de la cartografía.
//
// Salida: frontend/public/data/sigpac/<ine>.json, un GeoJSON de recintos con lo que enseña la pantalla
// (polígono, parcela, recinto, uso, superficie, regadío y la referencia catastral de su parcela), coordenadas con
// 6 decimales (unos 10 cm). La superficie oficial es la del SIGPAC; la geometría solo es para dibujar y medir.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const axios = require('axios')

const BASE = 'http://ftp.itacyl.es/cartografia/05_SIGPAC'
const OUT = path.resolve(__dirname, '../../frontend/public/data/sigpac')
const UA = { 'User-Agent': 'infoSalamanca (cartografía agrícola)' }

// ---------- DBF (atributos) ----------
function readDbf(file) {
  const b = fs.readFileSync(file)
  const n = b.readUInt32LE(4)
  const headerLen = b.readUInt16LE(8)
  const recordLen = b.readUInt16LE(10)
  const fields = []
  for (let o = 32; b[o] !== 0x0d; o += 32) {
    fields.push({ name: b.toString('latin1', o, o + 11).replace(/\0.*$/, '').toUpperCase(), len: b[o + 16] })
  }
  const rows = []
  for (let r = 0; r < n; r++) {
    let o = headerLen + r * recordLen + 1 // el primer byte marca si está borrado
    const row = {}
    for (const f of fields) { row[f.name] = b.toString('latin1', o, o + f.len).trim(); o += f.len }
    rows.push(row)
  }
  return rows
}

// ---------- SHP (geometría de polígonos) ----------
const round = (v) => Math.round(v * 1e6) / 1e6
// Área con signo de un anillo: en Shapefile los exteriores van en sentido horario (área negativa aquí)
const signedArea = (ring) => { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); return s / 2 }
function readShp(file) {
  const b = fs.readFileSync(file)
  const shapes = []
  let o = 100
  while (o < b.length) {
    const contentBytes = b.readInt32BE(o + 4) * 2
    const c = o + 8
    const type = b.readInt32LE(c)
    if (type === 5 || type === 15 || type === 25) { // polígono (con Z o M también: se ignoran)
      const numParts = b.readInt32LE(c + 36)
      const numPoints = b.readInt32LE(c + 40)
      const parts = []
      for (let i = 0; i < numParts; i++) parts.push(b.readInt32LE(c + 44 + i * 4))
      const p0 = c + 44 + numParts * 4
      const rings = parts.map((start, i) => {
        const end = i + 1 < numParts ? parts[i + 1] : numPoints
        const ring = []
        for (let k = start; k < end; k++) ring.push([round(b.readDoubleLE(p0 + k * 16)), round(b.readDoubleLE(p0 + k * 16 + 8))])
        return ring
      })
      // Exteriores (horario) abren polígono; los huecos (antihorario) van al último exterior
      const polys = []
      for (const ring of rings) {
        if (signedArea(ring) > 0 || !polys.length) polys.push([ring])
        else polys[polys.length - 1].push(ring)
      }
      shapes.push(polys)
    } else {
      shapes.push(null)
    }
    o = c + contentBytes
  }
  return shapes
}

// ---------- Descarga ----------
async function latestYear() {
  const { data } = await axios.get(`${BASE}/`, { headers: UA, timeout: 30000 })
  const years = [...String(data).matchAll(/href="(\d{4})_ETRS89\/"/g)].map(m => m[1]).sort()
  if (!years.length) throw new Error('No encuentro los años del SIGPAC en el ITACyL')
  return years[years.length - 1]
}

async function fileFor(year, ine) {
  const dir = `${BASE}/${year}_ETRS89/Parcelario_SIGPAC_CyL_Municipios/SALAMANCA/`
  const { data } = await axios.get(dir, { headers: UA, timeout: 30000 })
  const files = [...String(data).matchAll(/href="(\d{5})_([^"]+)\.(zip|rar)"/g)].map(m => ({ code: m[1], name: m[2], file: `${m[1]}_${m[2]}.${m[3]}` }))
  const hit = files.find(f => f.code === ine)
  if (!hit) throw new Error(`No hay fichero del SIGPAC para ${ine}`)
  if (!hit.file.endsWith('.zip')) throw new Error(`${hit.file}: solo se leen .zip`)
  return { url: dir + hit.file, name: hit.name.replace(/-/g, ' '), catastro: hit.code }
}

// Fecha de referencia de la cartografía de ese año (hay que citarla con el Catastro), del fichero de metadatos
async function referenceDate(year) {
  const yy = String(year).slice(2)
  const { data } = await axios.get(`${BASE}/${year}_ETRS89/Metadados${yy}_SHP_SIGPAC.txt`, { headers: UA, timeout: 30000, responseType: 'arraybuffer' }).catch(() => ({ data: null }))
  const text = data ? Buffer.from(data).toString('utf8') : ''
  const m = text.match(new RegExp(`año ${year}\\.\\s*\\(fecha de referencia (\\d{2})-(\\d{2})-(\\d{4})\\)`))
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

async function build(ine) {
  const year = await latestYear()
  const src = await fileFor(year, ine)
  const fecha = await referenceDate(year)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `sigpac-${ine}-`))
  try {
    const zip = path.join(tmp, 'm.zip')
    const { data } = await axios.get(src.url, { headers: UA, responseType: 'arraybuffer', timeout: 120000 })
    fs.writeFileSync(zip, Buffer.from(data))
    execFileSync('unzip', ['-o', '-q', zip, '-d', tmp])
    const find = (suffix) => {
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
      const f = walk(tmp).find(p => p.toUpperCase().endsWith(suffix))
      if (!f) throw new Error(`Falta ${suffix} en ${src.url}`)
      return f
    }
    // Referencia catastral de cada parcela (polígono-parcela → REFERENCIA)
    const refs = new Map(readDbf(find('_PARFE.DBF')).map(p => [`${Number(p.POLIGONO)}-${Number(p.PARCELA)}`, p.REFERENCIA]))
    const attrs = readDbf(find('_RECFE.DBF'))
    const geoms = readShp(find('_RECFE.SHP'))
    const features = []
    attrs.forEach((a, i) => {
      if (!geoms[i]) return
      const pol = Number(a.POLIGONO)
      const par = Number(a.PARCELA)
      features.push({
        type: 'Feature',
        geometry: geoms[i].length === 1 ? { type: 'Polygon', coordinates: geoms[i][0] } : { type: 'MultiPolygon', coordinates: geoms[i] },
        properties: {
          pol, par, rec: Number(a.RECINTO),
          agr: Number(a.AGREGADO) || 0, zona: Number(a.ZONA) || 0,
          uso: a.USO_SIGPAC,
          sup: Math.round(Number(a.SUPERFICIE)), // m²
          reg: Number(a.COEF_REGAD) || 0, // coeficiente de regadío (%)
          cat: refs.get(`${pol}-${par}`) || null
        }
      })
    })
    const out = {
      type: 'FeatureCollection',
      municipio: { ine, catastro: src.catastro, nombre: src.name },
      campaña: Number(year),
      fuente: {
        datos: `SIGPAC ${year} · ITACyL, Junta de Castilla y León (datos del FEGA)`,
        cartografia: 'Dirección General del Catastro',
        fechaReferencia: fecha, // AAAA-MM-DD
        licencia: 'Uso gratuito; prohibida su explotación comercial (licencia IGCYL-NC)',
        url: src.url,
        generado: new Date().toISOString().slice(0, 10)
      },
      features
    }
    fs.mkdirSync(OUT, { recursive: true })
    const file = path.join(OUT, `${ine}.json`)
    fs.writeFileSync(file, JSON.stringify(out))
    // Índice de los pueblos con cartografía (la ficha del pueblo solo enseña el botón en estos)
    const indexFile = path.join(OUT, 'index.json')
    let index = {}
    try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')) } catch { /* primero */ }
    index[ine] = { nombre: src.name, campaña: Number(year), recintos: features.length }
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 1))
    console.log(`✅ ${src.name} (${ine}): ${features.length} recintos, campaña ${year} → ${path.relative(process.cwd(), file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

if (require.main === module) {
  const codes = process.argv.slice(2).filter(c => /^37\d{3}$/.test(c))
  if (!codes.length) { console.error('Uso: node scripts/build-sigpac.js 37022 [37xxx …]'); process.exit(1) }
  ;(async () => { for (const c of codes) await build(c) })().catch(err => { console.error('❌', err.message); process.exit(1) })
}

module.exports = { readDbf, readShp, _test: { signedArea } }
