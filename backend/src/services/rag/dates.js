// Fechas de fiestas locales: dos días sueltos (start_date y end_date en MM-DD), no un intervalo.
// Igual que frontend/src/utils/festivals.js.
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function festivalDays(dates) {
  const days = new Map()
  for (const v of [dates?.start_date, dates?.end_date]) {
    const m = String(v || '').match(/^(\d{1,2})-(\d{1,2})$/)
    if (m) days.set(+m[1] * 100 + +m[2], { month: +m[1], day: +m[2] })
  }
  return [...days.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d)
}

function formatFestivalDays(dates) {
  const d = festivalDays(dates)
  if (!d.length) return ''
  if (d.length === 1) return `${d[0].day} de ${MONTHS[d[0].month - 1]}`
  if (d[0].month === d[1].month) return `${d[0].day} y ${d[1].day} de ${MONTHS[d[0].month - 1]}`
  return `${d[0].day} de ${MONTHS[d[0].month - 1]} y ${d[1].day} de ${MONTHS[d[1].month - 1]}`
}

// Próximo día de fiesta: { days, date }
function nextFestival(dates, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let best = null
  for (const { month, day } of festivalDays(dates)) {
    let next = new Date(today.getFullYear(), month - 1, day)
    if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day)
    const days = Math.round((next - today) / 86400000)
    if (!best || days < best.days) best = { days, date: next }
  }
  return best
}

module.exports = { formatFestivalDays, nextFestival }
