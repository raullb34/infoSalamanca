// Genera frontend/src/data/rutasCulturales.json: las rutas culturales oficiales de la provincia con sus paradas.
//   node scripts/build-rutas-culturales.js
// Fuentes (solo rutas publicadas por organismos, con sus pueblos tal como los nombran):
//  - Ruta del Mudéjar, Ruta Teresiana, Camino de la Peña de Francia y Caminos de Arte en la Naturaleza:
//    Turismo de la Diputación de Salamanca (turismo.lasalina.es). La del Mudéjar trae además su mapa de
//    Google My Maps, del que salen la iglesia (BIC) de cada pueblo y sus coordenadas.
//  - Ruta de las Fortificaciones de Frontera: Fundación del Patrimonio Histórico de Castilla y León y los
//    ayuntamientos de la ruta (Turismo de Castilla y León).
//  - Vía de la Plata (Camino de Santiago): sus etapas por la provincia, de sur a norte.
// Las paradas que no son municipio (Galleguillos de Alba, Turra de Alba, La Lurda) se asignan a su término con
// la búsqueda inversa de OpenStreetMap (Nominatim, una petición por parada y con pausa, como pide su política).
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { findTown } = require('../src/helpers/townIndex')

const OUT = path.resolve(__dirname, '../../frontend/src/data/rutasCulturales.json')
const MUNIS = require('../src/data/municipios-salamanca.json').municipios
const UA = 'infoSalamanca-bot/1.0 (+https://infosalamanca.duckdns.org)'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const LASALINA = 'https://turismo.lasalina.es/es/que-hacer'

// Colores de la paleta categórica validada (una ruta en el mapa cada vez; ver docs en el componente)
const ROUTES = [
  {
    id: 'mudejar',
    nombre: 'Ruta del Mudéjar',
    lema: 'Iglesias de ladrillo de las comarcas de Alba y Peñaranda',
    icono: '⛪',
    color: '#eb6834',
    descripcion: 'Dieciséis templos románico-mudéjares de los siglos XII y XIII, con el ladrillo como seña, y artesonados del siglo XVI —los "cielos mudéjares"— en Macotera, Cantaracillo, Rágama o Villoria. En Alba de Tormes, San Juan, con su triple ábside y su Apostolado, y Santiago.',
    fuente: { nombre: 'Turismo de la Diputación de Salamanca', url: `${LASALINA}/cultural-turismo-religioso/ruta-del-mudejar` },
    kml: 'https://www.google.com/maps/d/kml?mid=1PmEz0-mOvfgimeBsFOZLys9h5_g&forcekml=1',
    inicio: 'Alba de Tormes',
    // La fuente nombra los templos, no un orden: se propone un recorrido por cercanía desde Alba de Tormes
    nota: 'Recorrido sugerido por cercanía: la ruta no fija un orden.',
    extra: { 'Alba de Tormes': 'Iglesias de San Juan y de Santiago (BIC)' }
  },
  {
    id: 'teresiana',
    nombre: 'Ruta Teresiana',
    lema: '"De la cuna al sepulcro": de Ávila a Alba de Tormes',
    icono: '🕊️',
    color: '#6250d6',
    descripcion: 'Tras los pasos de Santa Teresa entre Ávila, su cuna, y Alba de Tormes, donde murió en 1582 y donde el convento de la Anunciación guarda su sepulcro. En la provincia empieza en Mancera de Abajo y se abre en dos caminos señalizados.',
    fuente: { nombre: 'Turismo de la Diputación de Salamanca', url: `${LASALINA}/turismo-religioso/ruta-teresiana-de-avila-alba-de-tormes-con-teresa-de-jesus` },
    tramos: [
      { nombre: 'Camino Norte', km: 40, pueblos: ['Mancera de Abajo', 'Bóveda del Río Almar', 'Peñaranda de Bracamonte', 'Nava de Sotrobal', 'Coca de Alba', 'Peñarandilla', 'Garcihernández', 'Alba de Tormes'] },
      { nombre: 'Camino Sur', km: 30, pueblos: ['Mancera de Abajo', 'Macotera', 'Tordillos', 'La Lurda', 'Garcihernández', 'Alba de Tormes'] }
    ],
    lugares: { 'Alba de Tormes': 'Convento de la Anunciación: sepulcro de Santa Teresa', Macotera: 'Artesonado mudéjar, el "Cielo de Macotera"' },
    fuera: ['Ávila (inicio)']
  },
  {
    id: 'pena-de-francia',
    nombre: 'Camino de la Peña de Francia',
    lema: 'De la Vía de la Plata al santuario de la Virgen Negra',
    icono: '⛰️',
    color: '#1baf7a',
    descripcion: 'El desvío de los peregrinos jacobeos hacia el monasterio de la Peña de Francia: 72 km señalizados desde Puerto de Béjar entre castaños, robledales, viñas y cerezos de las sierras de Béjar y Francia, Reserva de la Biosfera.',
    fuente: { nombre: 'Turismo de la Diputación de Salamanca', url: `${LASALINA}/turismo-religioso/camino-de-la-pena-de-francia-de-la-de-la-plata-al-santuario-de-la-virgen-negra` },
    tramos: [{ km: 72, pueblos: ['Puerto de Béjar', 'Peñacaballera', 'Montemayor del Río', 'Lagunilla', 'Valdelageve', 'Sotoserrano', 'Cepeda', 'Madroñal', 'Monforte de la Sierra', 'La Alberca', 'El Cabaco'] }],
    lugares: {
      Peñacaballera: 'Jardín romántico de El Coto de Nuestra Señora del Carmen',
      'Montemayor del Río': 'Conjunto histórico y castillo de San Vicente',
      'La Alberca': 'Conjunto histórico: arquitectura popular y tradiciones',
      'El Cabaco': 'Santuario de la Peña de Francia (Virgen Negra)'
    },
    nota: 'La fuente nombra los pueblos sin etapas: van en orden geográfico, de Puerto de Béjar a la Peña.'
  },
  {
    id: 'caminos-de-arte',
    nombre: 'Caminos de Arte en la Naturaleza',
    lema: 'Cuatro senderos con obras de arte en la Sierra de Francia',
    icono: '🎨',
    color: '#e87ba4',
    descripcion: 'Cuatro senderos circulares de 7 a 10 km por el parque natural de Las Batuecas-Sierra de Francia, con obras de arte en el camino: jaulas sobre el valle, sirenas junto al arroyo, plumas de bronce, puertas en el campo o piedras cosidas.',
    fuente: { nombre: 'Turismo de la Diputación de Salamanca', url: `${LASALINA}/senderismo/caminos-de-arte-en-la-naturaleza-en-la-sierra-de-francia` },
    circular: true,
    tramos: [
      { nombre: 'Camino de los Prodigios', pueblos: ['Miranda del Castañar', 'Villanueva del Conde'] },
      { nombre: 'Asentadero – Bosque de los Espejos', pueblos: ['Sequeros', 'Las Casas del Conde', 'San Martín del Castañar'] },
      { nombre: 'Camino de las Raíces', pueblos: ['La Alberca'] },
      { nombre: 'Camino del Agua', pueblos: ['Mogarraz', 'Monforte de la Sierra'] }
    ]
  },
  {
    id: 'fortificaciones',
    nombre: 'Fortificaciones de Frontera',
    lema: 'Castros, castillos y plazas fuertes de la Raya',
    icono: '🏰',
    color: '#2a78d6',
    descripcion: 'Arquitectura militar de la frontera con Portugal, del castro prerromano a los recintos abaluartados de los siglos XVII al XIX, con centros de interpretación en cada pueblo. El principal está en Ciudad Rodrigo, junto a las puertas del Conde y de San Pelayo.',
    fuente: { nombre: 'Fundación del Patrimonio Histórico de Castilla y León (Turismo de Castilla y León)', url: 'https://www.turismocastillayleon.com/es/patrimonio-cultura/centro-interpretacion-fortificaciones-frontera' },
    tramos: [{ pueblos: ['Ciudad Rodrigo', 'Yecla de Yeltes', 'San Felices de los Gallegos', 'Aldea del Obispo'] }],
    lugares: {
      'Ciudad Rodrigo': 'Recinto abaluartado y centro de interpretación (Puerta del Conde)',
      'Yecla de Yeltes': 'Castro de Yecla la Vieja',
      'San Felices de los Gallegos': 'Castillo, centro de interpretación de la ruta'
    },
    fuera: ['Almeida (Portugal)']
  },
  {
    id: 'via-de-la-plata',
    nombre: 'Vía de la Plata',
    lema: 'Camino de Santiago por la calzada romana, de sur a norte',
    icono: '🐚',
    color: '#eda100',
    descripcion: 'La calzada romana de Mérida a Astorga, hoy Camino de Santiago, cruza la provincia en cinco etapas, desde el límite con Cáceres hasta el de Zamora, con miliarios, puentes y la mayor altitud del Camino entre Mérida y Astorga en la Sierra de la Dueña.',
    fuente: { nombre: 'Etapas de la Vía de la Plata en Salamanca', url: 'https://www.terranostrum.es/turismo/via-de-la-plata-en-salamanca' },
    tramos: [{ km: 112, pueblos: ['Puerto de Béjar', 'La Calzada de Béjar', 'Valverde de Valdelacasa', 'Valdelacasa', 'Fuenterroble de Salvatierra', 'San Pedro de Rozados', 'Morille', 'Aldeatejada', 'Salamanca', 'Calzada de Valdunciel'] }],
    lugares: { 'Valverde de Valdelacasa': 'La antigua Ad Lippos', Salamanca: 'Patrimonio de la Humanidad' },
    fuera: ['Cáceres (viene de)', 'El Cubo de la Tierra del Vino, Zamora (sigue a)']
  }
]

const centroid = (ine) => MUNIS.find(m => String(m.id || m.ine) === String(ine))

async function nominatim(params) {
  await sleep(1100)
  const { data } = await axios.get(`https://nominatim.openstreetmap.org/${params.lat ? 'reverse' : 'search'}`, {
    params: { format: 'jsonv2', addressdetails: 1, 'accept-language': 'es', ...params },
    headers: { 'User-Agent': UA }, timeout: 20000
  })
  return Array.isArray(data) ? data[0] : data
}

// Municipio de una parada: por su nombre o, si no es municipio, por la búsqueda inversa de sus coordenadas
async function resolve(name, point = null) {
  const town = findTown([name])
  if (town) return { ...town, exacto: true }
  let place = point
  if (!place) {
    const hit = await nominatim({ q: `${name}, Salamanca, España`, limit: 1 })
    if (!hit) throw new Error(`No encuentro ${name}`)
    place = { lat: Number(hit.lat), lon: Number(hit.lon) }
  }
  const rev = await nominatim({ lat: place.lat, lon: place.lon, zoom: 10 })
  const a = rev.address || {}
  const muni = findTown([a.municipality, a.town, a.city, a.village].filter(Boolean))
  if (!muni) throw new Error(`Sin municipio para ${name}: ${JSON.stringify(a)}`)
  console.log(`  ${name} → término de ${muni.name}`)
  return { ...muni, exacto: false, ...place }
}

function stop(town, name, extra = {}) {
  const c = centroid(town.ine) || {}
  return {
    ine: town.ine,
    municipio: town.name,
    localidad: name !== town.name ? name : null, // pedanía o anejo
    lat: extra.lat ?? town.lat ?? c.lat,
    lon: extra.lon ?? town.lon ?? c.lon,
    lugar: extra.lugar || null
  }
}

// Recorrido por cercanía (vecino más próximo) desde una parada
function nearestOrder(stops, firstName) {
  const rest = stops.slice()
  const start = rest.findIndex(s => (s.localidad || s.municipio) === firstName)
  const out = rest.splice(start < 0 ? 0 : start, 1)
  const d = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 84)
  while (rest.length) {
    const last = out[out.length - 1]
    let k = 0
    rest.forEach((s, i) => { if (d(last, s) < d(last, rest[k])) k = i })
    out.push(rest.splice(k, 1)[0])
  }
  return out
}

async function main() {
  const out = []
  for (const r of ROUTES) {
    console.log(r.nombre)
    let tramos
    if (r.kml) {
      const xml = (await axios.get(r.kml, { headers: { 'User-Agent': UA }, timeout: 30000, responseType: 'text' })).data
      const stops = []
      for (const p of xml.split('<Placemark>').slice(1)) {
        const name = (p.match(/<name>([\s\S]*?)<\/name>/) || [])[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        const desc = ((p.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').trim()
        const [lon, lat] = (p.match(/<coordinates>\s*([^<]*)<\/coordinates>/) || [])[1].trim().split(',').map(Number)
        const town = await resolve(name, { lat, lon })
        stops.push(stop(town, name, { lat, lon, lugar: r.extra?.[name] || desc || null }))
      }
      tramos = [{ nombre: null, km: null, paradas: nearestOrder(stops, r.inicio) }]
    } else {
      tramos = []
      for (const t of r.tramos) {
        const paradas = []
        for (const name of t.pueblos) paradas.push(stop(await resolve(name), name, { lugar: r.lugares?.[name] }))
        tramos.push({ nombre: t.nombre || null, km: t.km || null, paradas })
      }
    }
    const { kml, extra, lugares, inicio, tramos: _t, ...info } = r
    out.push({ ...info, circular: Boolean(r.circular), tramos, fuera: r.fuera || [], nota: r.nota || null })
  }
  fs.writeFileSync(OUT, JSON.stringify({
    _nota: 'Generado por backend/scripts/build-rutas-culturales.js con las fuentes de cada ruta. No editar a mano.',
    generado: new Date().toISOString().slice(0, 10),
    rutas: out
  }, null, 2) + '\n')
  console.log(`✅ ${out.length} rutas → ${path.relative(process.cwd(), OUT)}`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
