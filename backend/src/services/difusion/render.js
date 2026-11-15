// El resumen de la semana en dos formatos:
//   - whatsapp(digest, opts): texto para el canal de WhatsApp (formato de WhatsApp: *negrita*, _cursiva_)
//   - email(digest, opts): { subject, html, text } de la newsletter. HTML de correo: tablas y estilos en línea
//     (los clientes de correo no respetan CSS moderno), 600 px de ancho, legible sin imágenes.
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const SKY = [[[0], '☀️', 'despejado'], [[1], '🌤️', 'poco nuboso'], [[2], '⛅', 'intervalos nubosos'], [[3], '☁️', 'cubierto'], [[45, 48], '🌫️', 'niebla'],
  [[51, 53, 55, 56, 57], '🌦️', 'llovizna'], [[61, 63, 66, 80, 81], '🌧️', 'lluvia'], [[65, 67, 82], '🌧️', 'lluvia fuerte'], [[71, 73, 75, 77, 85, 86], '🌨️', 'nieve'], [[95, 96, 99], '⛈️', 'tormenta']]
const sky = (c) => SKY.find(([codes]) => codes.includes(Number(c))) || [null, '·', '']

const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)) }
const weekday = (iso) => WEEKDAYS[parse(iso).getUTCDay()]
const dayNum = (iso) => parse(iso).getUTCDate()
const monthName = (iso) => MONTHS[parse(iso).getUTCMonth()]
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const shortDay = (iso) => `${cap(weekday(iso).slice(0, 3))} ${dayNum(iso)}`
const dayMonth = (iso) => `${dayNum(iso)} de ${monthName(iso)}`
const range = (a, b) => (monthName(a) === monthName(b) ? `del ${dayNum(a)} al ${dayMonth(b)}` : `del ${dayMonth(a)} al ${dayMonth(b)}`)
const deg = (v) => `${Math.round(v)}°`

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// En WhatsApp los asteriscos y guiones bajos dan formato: se quitan de los textos que vienen de fuera
const plainWa = (s) => String(s ?? '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim()

// "Centro Cultural (Sancti-Spíritus)" o "Palacio de Congresos…, Salamanca": el pueblo ya va delante
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
function cleanPlace(lugar, pueblo) {
  if (!lugar) return null
  if (!pueblo) return lugar
  let out = lugar.trim()
  const p = norm(pueblo)
  const paren = out.match(/\s*\(([^)]*)\)\s*$/)
  if (paren && norm(paren[1]) === p) out = out.slice(0, paren.index).trim()
  const comma = out.match(/,\s*([^,]+?)\.?$/)
  if (comma && norm(comma[1]) === p) out = out.slice(0, comma.index).trim()
  return out
}
const itemWhere = (i) => { const l = cleanPlace(i.lugar, i.pueblo); return [i.pueblo, l && norm(l) !== norm(i.pueblo) ? l : null].filter(Boolean).join(', ') }
const itemWhen = (i) => (i.empezado && i.hasta ? `Hasta el ${dayMonth(i.hasta)}` : shortDay(i.fecha))

// ---------- WhatsApp ----------
function whatsapp(d, { intro = '' } = {}) {
  const lines = [`*🗓️ infoSalamanca · ${cap(range(d.desde, d.hasta))}*`]
  if (intro.trim()) lines.push('', intro.trim())
  for (const s of d.secciones) {
    if (!s.items.length) continue
    lines.push('', `*${s.emoji} ${s.titulo}*`)
    for (const i of s.items) {
      const extra = [itemWhere(i), i.hora && !i.empezado ? i.hora : null].filter(Boolean).join(' · ')
      lines.push(`• *${itemWhen(i)}* · ${plainWa(i.titulo)}${extra ? ` _(${plainWa(extra)})_` : ''}`)
    }
  }
  if (d.noticias.length) {
    lines.push('', '*📰 Ciencia en la USAL*')
    for (const n of d.noticias) lines.push(`• ${plainWa(n.titulo)}`)
  }
  if (d.tiempo?.dias.length) {
    lines.push('', `*🌦️ El tiempo en ${d.tiempo.lugar}*`)
    lines.push(d.tiempo.dias.map(x => `${shortDay(x.fecha)} ${sky(x.codigo)[1]} ${deg(x.max)}/${deg(x.min)}`).join(' · '))
  }
  lines.push('', `👉 Toda la agenda, el mapa y el tiempo de cada pueblo: ${d.url}`)
  return lines.join('\n')
}

// ---------- Correo ----------
const C = { ink: '#1d2228', muted: '#5f6b77', line: '#e3e6ea', bg: '#f3f4f6', card: '#ffffff', brand: '#2e7d32' }
const font = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"

function emailItem(i) {
  const meta = [itemWhere(i), i.hora && !i.empezado ? `${i.hora} h` : null, i.precio && i.precio.length < 40 ? i.precio : null].filter(Boolean).join(' · ')
  const when = i.empezado && i.hasta ? `Hasta ${dayNum(i.hasta)} ${monthName(i.hasta).slice(0, 3)}` : `${weekday(i.fecha).slice(0, 3)} ${dayNum(i.fecha)}`
  return `<tr><td style="padding:10px 0;border-top:1px solid ${C.line};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="64" valign="top" style="${font}font-size:12px;font-weight:700;color:${C.brand};text-transform:uppercase;line-height:1.3;">${esc(when)}</td>
      <td valign="top" style="${font}">
        <a href="${esc(i.enlace)}" style="font-size:15px;font-weight:700;color:${C.ink};text-decoration:none;line-height:1.35;">${esc(i.titulo)}</a>
        ${meta ? `<div style="font-size:13px;color:${C.muted};line-height:1.4;margin-top:2px;">${esc(meta)}</div>` : ''}
      </td>
    </tr></table>
  </td></tr>`
}

function email(d, { intro = '', subject, unsubscribeUrl = '#', responsable = '' } = {}) {
  const title = subject || `Agenda de la provincia ${range(d.desde, d.hasta)}`
  const sections = d.secciones.filter(s => s.items.length).map(s => `
    <tr><td style="padding:22px 24px 4px;${font}">
      <h2 style="margin:0 0 4px;font-size:17px;color:${C.ink};">${s.emoji} ${esc(s.titulo)}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.items.map(emailItem).join('')}</table>
    </td></tr>`).join('')
  const news = d.noticias.length ? `
    <tr><td style="padding:22px 24px 4px;${font}">
      <h2 style="margin:0 0 4px;font-size:17px;color:${C.ink};">📰 Ciencia en la Universidad de Salamanca</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.noticias.map(n => `<tr><td style="padding:10px 0;border-top:1px solid ${C.line};${font}">
        <a href="${esc(n.enlace)}" style="font-size:15px;font-weight:700;color:${C.ink};text-decoration:none;line-height:1.35;">${esc(n.titulo)}</a>
        ${n.resumen ? `<div style="font-size:13px;color:${C.muted};line-height:1.45;margin-top:3px;">${esc(n.resumen.length > 200 ? `${n.resumen.slice(0, n.resumen.lastIndexOf(' ', 200))}…` : n.resumen)}</div>` : ''}
      </td></tr>`).join('')}</table>
    </td></tr>` : ''
  const weather = d.tiempo?.dias.length ? `
    <tr><td style="padding:22px 24px 4px;${font}">
      <h2 style="margin:0 0 10px;font-size:17px;color:${C.ink};">🌦️ El tiempo en ${esc(d.tiempo.lugar)}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${d.tiempo.dias.map(x => `
        <td align="center" style="padding:8px 2px;background:${C.bg};border:2px solid ${C.card};border-radius:8px;${font}">
          <div style="font-size:12px;color:${C.muted};">${shortDay(x.fecha)}</div>
          <div style="font-size:20px;line-height:1.4;">${sky(x.codigo)[1]}</div>
          <div style="font-size:13px;color:${C.ink};font-weight:700;">${deg(x.max)}</div>
          <div style="font-size:12px;color:${C.muted};">${deg(x.min)}</div>
        </td>`).join('')}</tr></table>
      <div style="font-size:11px;color:${C.muted};margin-top:6px;">Previsión del modelo ${esc(d.tiempo.modelo)} (Open-Meteo).</div>
    </td></tr>` : ''
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(intro.trim() || `Espectáculos, fiestas y ciencia en la provincia ${range(d.desde, d.hasta)}.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:20px 10px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border-radius:14px;overflow:hidden;">
    <tr><td style="padding:22px 24px;background:${C.brand};${font}">
      <div style="font-size:14px;color:#dcefdc;">info<b style="color:#ffffff;">Salamanca</b></div>
      <h1 style="margin:6px 0 0;font-size:22px;line-height:1.25;color:#ffffff;">${esc(cap(title))}</h1>
    </td></tr>
    ${intro.trim() ? `<tr><td style="padding:20px 24px 0;${font}font-size:15px;line-height:1.55;color:${C.ink};">${esc(intro.trim()).replace(/\n/g, '<br>')}</td></tr>` : ''}
    ${sections}${news}${weather}
    <tr><td style="padding:24px;${font}" align="center">
      <a href="${esc(d.url)}" style="display:inline-block;padding:11px 22px;border-radius:999px;background:${C.brand};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;">Ver el mapa y la agenda completa</a>
    </td></tr>
    <tr><td style="padding:16px 24px 22px;background:${C.bg};${font}font-size:12px;line-height:1.5;color:${C.muted};">
      Recibes este correo porque te suscribiste a la agenda semanal de infoSalamanca.
      <a href="${esc(unsubscribeUrl)}" style="color:${C.muted};">Darte de baja</a> es un clic.${responsable ? `<br>${esc(responsable)}` : ''}
      <br>Datos de la Junta de Castilla y León, la Diputación de Salamanca, Turismo de Salamanca, Salamanca Tech, la Universidad de Salamanca y Open-Meteo.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`

  // Texto plano (los correos con versión de texto llegan mejor y se leen en cualquier cliente)
  const t = [cap(title), '']
  if (intro.trim()) t.push(intro.trim(), '')
  for (const s of d.secciones.filter(x => x.items.length)) {
    t.push(s.titulo.toUpperCase())
    for (const i of s.items) t.push(`- ${itemWhen(i)}: ${i.titulo}${itemWhere(i) ? ` (${itemWhere(i)}${i.hora && !i.empezado ? `, ${i.hora} h` : ''})` : ''}`)
    t.push('')
  }
  if (d.noticias.length) { t.push('CIENCIA EN LA USAL'); for (const n of d.noticias) t.push(`- ${n.titulo}: ${n.enlace}`); t.push('') }
  if (d.tiempo?.dias.length) t.push(`EL TIEMPO EN ${d.tiempo.lugar.toUpperCase()}`, d.tiempo.dias.map(x => `${shortDay(x.fecha)} ${sky(x.codigo)[2]} ${deg(x.max)}/${deg(x.min)}`).join(' | '), '')
  t.push(`Agenda completa: ${d.url}`, '', `Darte de baja: ${unsubscribeUrl}`)
  return { subject: cap(title), html, text: t.join('\n') }
}

module.exports = { whatsapp, email, range, _test: { shortDay, plainWa, cleanPlace } }
