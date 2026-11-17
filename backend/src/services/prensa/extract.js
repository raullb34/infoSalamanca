// Eventos que anuncia una noticia, sacados con la IA (Groq, la misma del asistente). La IA solo propone: aquí se
// comprueba todo (fecha válida y futura respecto a la publicación, pueblo de la provincia que la noticia nombre,
// tipo conocido). Lo que no pasa, se descarta.
const llm = require('../rag/llm')
const { findTown } = require('../../helpers/townIndex')

const TYPES = new Set(['fiesta', 'espectaculo', 'exposicion', 'actividad', 'feria'])
const MAX_AHEAD_DAYS = 200
// Modelo pequeño: basta para esto y tiene su propio cupo en Groq (el del asistente queda libre)
const MODELS = () => [process.env.PRENSA_MODEL || 'openai/gpt-oss-20b']

const SYSTEM = `Eres un asistente que extrae eventos de noticias de la prensa local de la provincia de Salamanca (España).
Devuelves SOLO un objeto JSON, sin texto alrededor, con esta forma:
{"eventos":[{"titulo":"…","tipo":"fiesta|espectaculo|exposicion|actividad|feria","fecha_inicio":"AAAA-MM-DD","fecha_fin":"AAAA-MM-DD o null","hora":"HH:MM o null","lugar":"… o null","municipio":"…","infantil":true|false}]}
Reglas:
- Solo eventos abiertos al público que todavía no han pasado en la fecha de publicación. Si la noticia cuenta algo que ya pasó, o no anuncia nada con fecha, devuelve {"eventos":[]}.
- La fecha tiene que salir de la noticia: "este sábado", "el próximo 21 de noviembre", "del 5 al 8 de diciembre". Calcúlala con la fecha de publicación. Si no se puede saber el día, no inventes: no lo incluyas.
- tipo: "fiesta" (fiestas patronales, de un barrio, romerías, matanzas populares, verbenas), "espectaculo" (teatro, música, danza, títeres, circo, monólogos, cine), "exposicion", "feria" (ferias y mercados), "actividad" (charlas, talleres, presentaciones de libros, rutas, jornadas, convivencias, concursos, deporte popular).
- Unas fiestas con programa de varios días son UN solo evento (del primer al último día), con un título como "Fiestas de San Martín en Villares de la Reina".
- municipio: el pueblo de la provincia de Salamanca donde se celebra, con su nombre completo.
- titulo: corto y claro, en español, sin el nombre del periódico.
- infantil: true si está pensado para niños o familias.
- Sí son eventos los cursos, talleres, ferias (también las de empleo) y jornadas abiertas. NO son eventos (no los incluyas): el bibliobús (la web ya enseña su calendario); reuniones internas y asambleas; encuentros solo para profesionales de un gremio; plazos de inscripción y convocatorias; misas y actos religiosos (salvo procesiones y romerías de unas fiestas); rodajes y grabaciones; programas o campañas de varias semanas sin un acto concreto con su día.
- Si dos eventos de la noticia son el mismo acto, inclúyelo una sola vez.
- Como mucho 5 eventos por noticia.`

// Lo que no interesa en la agenda aunque tenga fecha (también se aplica a lo ya guardado: ver index.js)
// (los cursos, la formación y las ferias de empleo sí entran; el bibliobús tiene su tarjeta en el pueblo)
const LOW_VALUE = /(?<![\p{L}])(?:bibliob[uú]s|(?:encuentro|reuni[oó]n) de (?:los )?(?:profesionales|empresas|empresarios)|misa|eucarist[ií]a|grabaci[oó]n(?:es)?|rodaje|plazo|convocatoria|asamblea|reuni[oó]n)(?![\p{L}])/iu
const MAX_ACTIVITY_DAYS = 31 // una "actividad" de más de un mes es un programa, no un acto (las exposiciones y ferias sí duran)
function lowValue(e) {
  if (LOW_VALUE.test(e.titulo || '')) return true
  if (e.tipo === 'actividad' && e.fecha_fin && (dayOf(e.fecha_fin) - dayOf(e.fecha_inicio)) / 86400000 > MAX_ACTIVITY_DAYS && /programa|campaña|ciclo/i.test(e.titulo || '')) return true
  return false
}

const parseJson = (text) => {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const dayOf = (iso) => new Date(`${iso}T12:00:00Z`)

// Lo que propone la IA → eventos válidos (o ninguno)
function validate(raw, item, towns) {
  const pub = new Date(item.fecha)
  const pubDay = new Date(Date.UTC(pub.getUTCFullYear(), pub.getUTCMonth(), pub.getUTCDate(), 12))
  const allowed = new Set(towns.map(t => t.ine))
  const out = []
  for (const e of (raw?.eventos || []).slice(0, 5)) {
    if (!e || !TYPES.has(e.tipo) || !ISO.test(e.fecha_inicio || '')) continue
    const start = dayOf(e.fecha_inicio)
    if (isNaN(start)) continue
    // Ni antes de la víspera de la publicación ni demasiado lejos
    if (start < new Date(pubDay - 86400000) || start > new Date(+pubDay + MAX_AHEAD_DAYS * 86400000)) continue
    const fin = ISO.test(e.fecha_fin || '') && e.fecha_fin > e.fecha_inicio && (dayOf(e.fecha_fin) - start) / 86400000 <= 60 ? e.fecha_fin : null
    // El pueblo tiene que ser de la provincia y nombrarse en la noticia
    const town = findTown([e.municipio]) || (towns.length === 1 ? towns[0] : null)
    if (!town || (allowed.size && !allowed.has(town.ine))) continue
    if (lowValue({ ...e, fecha_fin: fin })) continue
    out.push({
      titulo: String(e.titulo || item.titulo).replace(/\s+/g, ' ').trim().slice(0, 140),
      tipo: e.tipo,
      fecha_inicio: e.fecha_inicio,
      fecha_fin: fin,
      hora: /^\d{1,2}:\d{2}$/.test(e.hora || '') ? e.hora.padStart(5, '0') : null,
      lugar: e.lugar ? String(e.lugar).slice(0, 120) : null,
      ine: town.ine,
      municipio: town.name,
      infantil: e.infantil === true
    })
  }
  return out
}

async function eventsOf(item, towns) {
  const pub = new Date(item.fecha)
  const user = `Fecha de publicación: ${pub.toISOString().slice(0, 10)} (${pub.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'Europe/Madrid' })})
Periódico: ${item.medio}
Pueblos que nombra: ${towns.map(t => t.name).join(', ') || 'ninguno claro'}
Título: ${item.titulo}
Texto: ${String(item.texto || item.resumen || '').slice(0, 2500)}`
  const { text } = await llm.complete([{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], { maxTokens: 1200, temperature: 0, models: MODELS() })
  return validate(parseJson(text), item, towns)
}

module.exports = { eventsOf, lowValue, enabled: llm.enabled, _test: { validate, parseJson } }
