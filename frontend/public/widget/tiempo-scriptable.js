// infoSalamanca · El tiempo en __NOMBRE__
// Widget para la pantalla de inicio del iPhone con la app gratuita Scriptable.
//  1. Instala Scriptable (App Store) y crea un script nuevo con el botón +.
//  2. Pega este código entero y ponle de nombre "Tiempo __NOMBRE__".
//  3. En la pantalla de inicio, mantén pulsado → + → Scriptable → elige tamaño (mediano o grande) → Añadir.
//  4. Mantén pulsado el widget → Editar widget → Script: "Tiempo __NOMBRE__".
// Se actualiza solo (iOS decide cuándo, más o menos cada media hora). Al tocarlo se abre el tiempo en infoSalamanca.
const PUEBLO = '__SLUG__'
const API = `https://infosalamanca.duckdns.org/api/v1/weather/municipalities/${PUEBLO}/widget`

const fm = FileManager.local()
const cachePath = fm.joinPath(fm.cacheDirectory(), `infosalamanca-tiempo-${PUEBLO}.json`)

// Datos: de la web; sin conexión, los últimos que se guardaron
async function load() {
  try {
    const req = new Request(API)
    req.timeoutInterval = 15
    const data = await req.loadJSON()
    if (data && data.horas) {
      fm.writeString(cachePath, JSON.stringify(data))
      return { data, offline: false }
    }
  } catch (e) { /* sin red: lo guardado */ }
  if (fm.fileExists(cachePath)) return { data: JSON.parse(fm.readString(cachePath)), offline: true }
  return { data: null, offline: true }
}

const WHITE = Color.white()
const SOFT = new Color('#ffffff', 0.75)
const RAIN = new Color('#9fd3ff')
const deg = (v) => (v === null || v === undefined ? '–' : `${v}°`)

function text(stack, value, size, { bold = false, color = WHITE, align = 'left' } = {}) {
  const t = stack.addText(String(value))
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size)
  t.textColor = color
  t.lineLimit = 1
  t.minimumScaleFactor = 0.7
  if (align === 'center') t.centerAlignText()
  if (align === 'right') t.rightAlignText()
  return t
}

// Columna de una hora o un día: etiqueta, icono, temperatura y lluvia si la hay
function column(row, top, icon, bottom, rain, size) {
  const col = row.addStack()
  col.layoutVertically()
  col.centerAlignContent()
  const line = (v, s, opts) => { const h = col.addStack(); h.addSpacer(); text(h, v, s, opts); h.addSpacer() }
  line(top, size - 2, { color: SOFT })
  line(icon, size + 3)
  line(bottom, size, { bold: true })
  line(rain >= 30 ? `${rain}%` : ' ', size - 3, { color: RAIN })
  return col
}

function build(data, offline, family) {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [new Color('#2e7d32'), new Color('#14532d')]
  g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(12, 14, 12, 14)
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)

  if (!data) {
    text(w, 'infoSalamanca', 13, { bold: true })
    w.addSpacer(6)
    text(w, 'No se ha podido cargar el tiempo. Lo intentará de nuevo en un rato.', 12, { color: SOFT })
    return w
  }
  w.url = data.url

  // Cabecera: pueblo, ahora y hoy
  const head = w.addStack()
  head.centerAlignContent()
  const left = head.addStack()
  left.layoutVertically()
  text(left, data.municipio.nombre, family === 'small' ? 13 : 15, { bold: true })
  const hoy = data.dias[0]
  text(left, `${data.ahora.texto} · ${deg(hoy?.max)} / ${deg(hoy?.min)}${offline ? ' · sin conexión' : ''}`, 11, { color: SOFT })
  head.addSpacer()
  text(head, data.ahora.icono || '', family === 'small' ? 22 : 26)
  head.addSpacer(4)
  text(head, deg(data.ahora.temp), family === 'small' ? 24 : 30, { bold: true })

  if (family === 'small') {
    // Pequeño: las próximas 3 horas
    w.addSpacer()
    const row = w.addStack()
    data.horas.slice(1, 4).forEach((h, i) => { if (i) row.addSpacer(); column(row, `${h.hora}h`, h.icono, deg(h.temp), h.lluvia, 11) })
    return w
  }

  // Por horas (6 en el mediano, 8 en el grande)
  w.addSpacer(8)
  const nHours = family === 'large' || family === 'extraLarge' ? 8 : 6
  const hours = w.addStack()
  data.horas.slice(1, 1 + nHours).forEach((h, i) => { if (i) hours.addSpacer(); column(hours, `${h.hora}h`, h.icono, deg(h.temp), h.lluvia, 11) })

  // La semana
  w.addSpacer(family === 'medium' ? 6 : 12)
  if (family === 'medium') {
    const days = w.addStack()
    data.dias.slice(1, 7).forEach((d, i) => { if (i) days.addSpacer(); column(days, d.dia, d.icono, `${deg(d.max)}${d.min !== null ? ` ${d.min}°` : ''}`, d.lluvia, 10) })
  } else {
    for (const d of data.dias.slice(0, 7)) {
      const r = w.addStack()
      r.centerAlignContent()
      const name = r.addStack(); name.size = new Size(52, 0); text(name, d.dia, 13, { bold: d.dia === 'Hoy' })
      text(r, d.icono, 15)
      r.addSpacer()
      if (d.lluvia >= 30) { text(r, `${d.lluvia}%`, 12, { color: RAIN }); r.addSpacer(10) }
      text(r, `${deg(d.max)}  ${deg(d.min)}`, 13, { bold: true })
      w.addSpacer(4)
    }
  }
  w.addSpacer()
  text(w, `infoSalamanca · ${data.modelo}`, 9, { color: SOFT })
  return w
}

const { data, offline } = await load()
const family = config.widgetFamily || 'medium'
const widget = build(data, offline, family)
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  // Al ejecutarlo dentro de Scriptable, vista previa
  if (family === 'large') await widget.presentLarge()
  else await widget.presentMedium()
}
Script.complete()
