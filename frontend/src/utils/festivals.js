// Fechas de fiestas locales.
//
// Los datos vienen de la tabla de la Diputación ("20 de enero y 5 de mayo"): son DOS días de fiesta local,
// guardados como start_date y end_date (MM-DD). No es un intervalo: "30 de junio y 4 de diciembre" no son
// cinco meses de fiesta. Lo usan la lista de fiestas, el coloreado del mapa y la ficha del pueblo.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DAY = 86400000

const parse = (mmdd) => {
  const m = String(mmdd || '').match(/^(\d{1,2})-(\d{1,2})$/)
  return m ? { month: +m[1], day: +m[2] } : null
}

// Días de fiesta sin repetir y en orden del año
function festivalDays(dates) {
  const seen = new Map()
  for (const d of [dates?.start_date, dates?.end_date].map(parse).filter(Boolean)) {
    seen.set(d.month * 100 + d.day, d)
  }
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d)
}

// Días que faltan para la próxima de las fechas (0 = hoy). null si no hay fecha.
export function daysUntilFestival(dates, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let best = null
  for (const { month, day } of festivalDays(dates)) {
    let next = new Date(today.getFullYear(), month - 1, day)
    if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day)
    const days = Math.round((next - today) / DAY)
    if (best === null || days < best) best = days
  }
  return best
}

// "20 de enero y 5 de mayo", "5 y 6 de agosto", "4 de diciembre"
export function formatFestivalDays(dates) {
  const days = festivalDays(dates)
  if (!days.length) return ''
  if (days.length === 1) return `${days[0].day} de ${MONTHS[days[0].month - 1]}`
  const [a, b] = days
  if (a.month === b.month) return `${a.day} y ${b.day} de ${MONTHS[a.month - 1]}`
  return `${a.day} de ${MONTHS[a.month - 1]} y ${b.day} de ${MONTHS[b.month - 1]}`
}
