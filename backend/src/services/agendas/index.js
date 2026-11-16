// Agendas añadidas a las de la Junta y la Diputación:
//  - Turismo de Salamanca y Salamanca Convention Bureau (salamanca.es): cultura y congresos de la capital
//  - Salamanca Tech: ciencia, tecnología e innovación
//  - Universidad de Salamanca: noticias de ciencia y convocatorias (sus actos: conferencias, exposiciones, jornadas)
// Cada fuente tiene su caché; si una falla, las demás siguen (y la que falla da lo último que tenía, o nada).
const salamancaEs = require('./salamancaEs')
const salamancaTech = require('./salamancaTech')
const usal = require('./usalNoticias')
const usalConvocatorias = require('./usalConvocatorias')
const { mergeEvents } = require('../../helpers/eventDedupe')

const safe = (name, p) => p.catch(err => {
  console.warn(`⚠️ Agenda ${name}:`, err.message)
  return []
})

const byDate = (a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)) || String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''))

// Eventos culturales de las agendas añadidas (para los pueblos y el asistente)
async function culturalEvents() {
  const [es, uni] = await Promise.all([safe('salamanca.es', salamancaEs.getEvents()), safe('USAL convocatorias', usalConvocatorias.getEvents())])
  return mergeEvents(es.filter(e => e.ambito === 'cultura'), uni.filter(e => e.ambito === 'cultura')).sort(byDate)
}

// Eventos de ciencia: congresos y jornadas, divulgación, tecnología. Salamanca Tech primero (sus fichas son
// las del organizador), luego los de salamanca.es que no estén ya
async function scienceEvents() {
  const [tech, es, uni] = await Promise.all([safe('Salamanca Tech', salamancaTech.getEvents()), safe('salamanca.es', salamancaEs.getEvents()), safe('USAL convocatorias', usalConvocatorias.getEvents())])
  return mergeEvents(tech, es.filter(e => e.ambito === 'ciencia'), uni.filter(e => e.ambito === 'ciencia')).sort(byDate)
}

const scienceNews = () => safe('USAL', usal.getNews())

module.exports = { culturalEvents, scienceEvents, scienceNews }
