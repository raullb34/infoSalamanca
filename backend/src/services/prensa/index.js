// Prensa local de la provincia (services/prensa/feeds.js): de cada noticia se decide de qué pueblos habla y de qué
// tema es. Fuera sucesos, tráfico, política y esquelas. Con el resto:
//  - las que anuncian algo (fiestas, conciertos, ferias, charlas…) se le pasan a la IA, que saca los eventos con su
//    fecha: entran en la agenda cultural (services/agendaCultural.js) citando el periódico y con enlace a la noticia;
//  - las fiestas con imagen (suele ser el cartel) se proponen como cartel del pueblo en /admin/carteles.html
//    (pendientes: no se publican hasta aprobarlas);
//  - las noticias de cada pueblo se enseñan en su ficha (título, periódico, fecha y enlace; el texto no).
// Se refresca cada 30 minutos. Lo analizado se guarda en disco (volumen de los carteles) para no volver a pedirle
// a la IA lo mismo al reiniciar; las noticias se olvidan a los 60 días.
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const FEEDS = require('./feeds')
const { readFeed } = require('./reader')
const { townsOf, townsIn } = require('./towns')
const { topicsOf } = require('./topics')
const extract = require('./extract')

const DIR = process.env.PRENSA_DIR || path.join(process.env.POSTERS_DIR || path.resolve(__dirname, '../../../uploads/posters'), 'prensa')
const FILE = path.join(DIR, 'noticias.json')
const KEEP_DAYS = 60
const MAX_AI_PER_RUN = 25
const MAX_AI_PER_DAY = 150
const RECENT_DAYS = 7 // lo de hace más de una semana ya no suele anunciar nada que no haya pasado
// Groq corta (429) si se le pide más deprisa: el modelo pequeño admite unos 8.000 tokens por minuto y cada noticia
// gasta unos 1.500 (texto, respuesta y razonamiento), así que ~5 por minuto
const AI_PAUSE_MS = 12000
const AI_RETRY_MS = 65000 // tras un 429, se espera a que pase el minuto y se reintenta una vez

let store = null // { items: { id: noticia } }
function load() {
  if (store) return store
  try { store = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { store = { items: {} } }
  if (!store.items) store.items = {}
  return store
}
function save() {
  fs.mkdirSync(DIR, { recursive: true })
  const tmp = `${FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store))
  fs.renameSync(tmp, FILE)
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const CATEGORY = { fiesta: 'Fiestas', espectaculo: 'Espectáculos', exposicion: 'Exposiciones', actividad: 'Actividades', feria: 'Ferias y mercados' }

// Fiesta con imagen → cartel pendiente del pueblo (solo con la base de datos)
async function proposePoster(item, ev) {
  if (!item.imagen || mongoose.connection.readyState !== 1) return
  try {
    await require('../posterService').addCandidate({
      cod_ine: ev.ine,
      municipality_name: ev.municipio,
      year: Number(ev.fecha_inicio.slice(0, 4)),
      source_url: item.enlace,
      image_url: item.imagen,
      title: `${ev.titulo} (${item.medio})`,
      snippet: item.resumen,
      found_by: 'prensa',
      score: 80
    })
  } catch (err) {
    console.warn('⚠️ Prensa, cartel propuesto:', err.message)
  }
}

let running = null
async function refresh() {
  if (running) return running
  running = (async () => {
    load()
    const results = await Promise.allSettled(FEEDS.map(readFeed))
    const fresh = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') return console.warn(`⚠️ Prensa (${FEEDS[i].nombre}):`, r.reason?.message)
      for (const it of r.value) if (!store.items[it.id]) fresh.push(it)
    })
    const recent = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString()
    for (const it of fresh) {
      const towns = townsOf(it)
      const { fuera, anuncia } = topicsOf(it)
      store.items[it.id] = {
        id: it.id, medio: it.medio, medio_id: it.medio_id, titulo: it.titulo, enlace: it.enlace, fecha: it.fecha,
        resumen: String(it.resumen || '').slice(0, 300), imagen: it.imagen,
        towns, enTitulo: townsIn(it.titulo).map(t => t.ine),
        fuera,
        // Pendiente de la IA: se guarda el texto hasta analizarla
        pendiente: Boolean(anuncia && towns.length && it.fecha >= recent),
        texto: anuncia && towns.length && it.fecha >= recent ? String(it.texto || '').slice(0, 2500) : undefined,
        eventos: []
      }
    }
    // La IA, para las pendientes (las más nuevas primero), con pausa entre una y otra
    let analyzed = 0
    // Tope diario de llamadas a la IA
    const day = new Date().toISOString().slice(0, 10)
    if (store.ia?.dia !== day) store.ia = { dia: day, usadas: 0 }
    if (extract.enabled()) {
      const pending = Object.values(store.items).filter(n => n.pendiente).sort((a, b) => b.fecha.localeCompare(a.fecha))
      const room = Math.max(0, Math.min(MAX_AI_PER_RUN, MAX_AI_PER_DAY - store.ia.usadas))
      const ask = (n) => { store.ia.usadas++; return extract.eventsOf({ ...n, texto: n.texto }, n.towns) }
      const limited = (err) => /429|cupo|rate/i.test(err.message)
      for (const n of pending.slice(0, room)) {
        try {
          let eventos
          try {
            eventos = await ask(n)
          } catch (err) {
            if (!limited(err) || store.ia.usadas >= MAX_AI_PER_DAY) throw err
            await sleep(AI_RETRY_MS) // cupo del minuto agotado: se espera y se reintenta una vez
            eventos = await ask(n)
          }
          n.eventos = eventos
          n.pendiente = false
          delete n.texto
          analyzed++
          for (const ev of n.eventos.filter(e => e.tipo === 'fiesta')) await proposePoster(n, ev)
        } catch (err) {
          console.warn('⚠️ Prensa, IA:', err.message)
          if (limited(err)) break // sigue sin cupo: en la próxima vuelta
        }
        await sleep(AI_PAUSE_MS)
      }
    }
    // Se olvidan las de hace más de 60 días
    const limit = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString()
    for (const [id, n] of Object.entries(store.items)) if (n.fecha < limit) delete store.items[id]
    save()
    const events = Object.values(store.items).reduce((a, n) => a + n.eventos.length, 0)
    console.log(`📰 Prensa: ${fresh.length} noticias nuevas, ${analyzed} analizadas con IA, ${events} eventos guardados`)
    return { nuevas: fresh.length, analizadas: analyzed }
  })().finally(() => { running = null })
  return running
}

// ---------- El mismo acto contado por varios periódicos ----------
// Dos medios lo titulan distinto ("Salón del Libro Infantil y Juvenil" / "VII Salón del Libro Infantil y Juvenil
// en Salamanca"), o uno da el resumen y otro cada acto ("Talleres y visitas culturales para mayores" frente a
// "Salida cultural al Palacio Episcopal" y "Taller de Libros decorados"). Son el mismo si son del mismo pueblo,
// coinciden en el día (o uno es un ciclo corto que lo incluye) y comparten las palabras que importan.
const STOP = new Set(['para', 'como', 'sobre', 'entre', 'desde', 'hasta', 'contra', 'este', 'esta', 'estos', 'estas', 'gran', 'nuevo', 'nueva',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'salamanca'])
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// Raíces de las palabras con significado (5 letras: "taller"/"talleres", "cultural"/"culturales"), sin el pueblo
function stems(e) {
  let t = plain(e.titulo).replace(/(\d+)-([a-z])(?![a-z])/g, '$1$2') // "25-N" → "25n"
  for (const w of plain(e.municipio).split(/\s+/)) if (w.length >= 4) t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), ' ')
  return new Set(t.split(/[^a-z0-9]+/).filter(w => (w.length >= 4 && !STOP.has(w)) || /^\d+[a-z]$/.test(w)).map(w => w.slice(0, 5)))
}
const union = (sets) => new Set(sets.flatMap(s => [...s]))
const MAX_CYCLE_DAYS = 15
const spanDays = (e) => (e.fecha_fin ? (Date.parse(e.fecha_fin) - Date.parse(e.fecha_inicio)) / 86400000 : 0)
const covers = (a, b) => spanDays(a) <= MAX_CYCLE_DAYS && a.fecha_inicio <= b.fecha_inicio && b.fecha_inicio <= (a.fecha_fin || a.fecha_inicio)
const sameTime = (a, b) => a.fecha_inicio === b.fecha_inicio || covers(a, b) || covers(b, a)
// Comparten al menos dos palabras, o una que sea una cuarta parte de todas. Las fechas con letra ("25N") son muy
// propias de un acto: cuentan por dos.
function similar(sa, sb) {
  let shared = 0
  let common = 0
  for (const w of sa) if (sb.has(w)) { common++; shared += /\d/.test(w) ? 2 : 1 }
  return shared >= 2 || (common >= 1 && common / (sa.size + sb.size - common) >= 0.25)
}

// Se queda lo de la noticia que se publicó primero. De las siguientes se descarta lo que repite algo ya visto ese
// día en el pueblo: acto por acto, cada acto frente a todo lo que contó otra noticia, y todo lo que cuenta esta
// noticia ese día frente a todo lo de otra (el resumen de un periódico frente a los actos sueltos de otro).
function dedupe(list) {
  const groups = new Map() // noticia · pueblo · día → actos, en el orden de llegada
  for (const e of list) {
    const key = `${e.noticia}|${e.ine}|${e.fecha_inicio}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...e, stems: stems(e) })
  }
  const kept = []
  for (const group of groups.values()) {
    const first = group[0]
    const rivals = kept.filter(k => k.ine === first.ine && k.noticia !== first.noticia && sameTime(k, first))
    const byNews = new Map()
    for (const k of rivals) byNews.set(k.noticia, [...(byNews.get(k.noticia) || []), k.stems])
    const others = [...byNews.values()].map(union)
    const all = union(group.map(e => e.stems))
    if (group.length > 1 && others.some(o => similar(all, o))) continue
    for (const e of group) {
      if (rivals.some(k => sameTime(k, e) && similar(e.stems, k.stems)) || others.some(o => similar(e.stems, o))) continue
      kept.push(e)
    }
  }
  return kept
}

// Eventos de la prensa (de hoy en adelante, y lo que sigue abierto) con la forma de los de la agenda
function events() {
  load()
  const today = new Date().toISOString().slice(0, 10)
  const found = []
  // Las noticias, de la más antigua a la más nueva: si dos cuentan lo mismo, manda la primera
  for (const n of Object.values(store.items).sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    n.eventos.forEach((e, i) => {
      // El filtro de lo que no interesa se repite aquí: así vale también para lo analizado antes
      if ((e.fecha_fin || e.fecha_inicio) < today || extract.lowValue(e)) return
      found.push({ ...e, noticia: n.id, i, n })
    })
  }
  const out = []
  for (const { n, i, ...e } of dedupe(found)) {
    out.push({
      id_evento: `prensa-${n.id}-${i}`,
      titulo: e.titulo,
      descripcion: n.resumen || null,
      categoria: CATEGORY[e.tipo],
      tematica: e.tipo === 'fiesta' ? 'Fiestas' : e.tipo === 'feria' ? 'Feria' : null,
      fecha_inicio: e.fecha_inicio,
      fecha_fin: e.fecha_fin,
      hora_inicio: e.hora,
      precio: null,
      lugar_celebracion: e.lugar,
      nombre_localidad: e.municipio,
      municipio: e.municipio,
      cod_ine: e.ine,
      imagen_evento: n.imagen || null,
      enlace_contenido: n.enlace,
      infantil: e.infantil,
      source: 'prensa',
      fuente: n.medio
    })
  }
  return out.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
}

// Medios comarcales → INE de su pueblo (sus noticias sin pueblo en el título suelen ser de él)
const COMARCAL = Object.fromEntries(FEEDS.filter(f => f.comarcal).map(f => [f.id, townsIn(f.comarcal)[0]?.ine]))

// Noticias de un pueblo para su ficha: las que lo nombran en el título (o las de su medio comarcal que no nombran
// otro), sin sucesos, política ni esquelas; la más reciente primero
function newsFor(ine, limit = 8) {
  load()
  const code = String(ine).split('_')[0]
  return Object.values(store.items)
    // El descarte se repite con el título: así valen las reglas nuevas también para lo ya guardado
    .filter(n => !n.fuera && !topicsOf({ titulo: n.titulo }).fuera && (n.enTitulo.includes(code) || (!n.enTitulo.length && COMARCAL[n.medio_id] === code && n.towns[0]?.ine === code)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, limit)
    .map(n => ({ titulo: n.titulo, medio: n.medio, fecha: n.fecha, enlace: n.enlace, imagen: n.imagen || null }))
}

function status() {
  load()
  const all = Object.values(store.items)
  return {
    medios: FEEDS.length,
    noticias: all.length,
    conPueblo: all.filter(n => n.towns.length).length,
    descartadas: all.filter(n => n.fuera).length,
    pendientesIA: all.filter(n => n.pendiente).length,
    iaHoy: store.ia?.dia === new Date().toISOString().slice(0, 10) ? store.ia.usadas : 0,
    eventos: events().length
  }
}

module.exports = { refresh, events, newsFor, status, FEEDS, _test: { dedupe } }
