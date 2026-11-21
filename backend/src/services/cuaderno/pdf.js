// Cuaderno de explotación en PDF (A4 apaisado), a partir de lo mismo que la hoja de cálculo (explotacion.cuaderno).
// Para leerlo, imprimirlo o enseñarlo en una inspección; cada fila lleva la referencia corta del parte y su versión.
// No es una comunicación oficial: lo dice el pie de cada página.
const PDFDocument = require('pdfkit')

const fmt = (v, d = 2) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }))
const ha = (m2, d = 2) => fmt(m2 / 10000, d)
const ref = (id, v) => `${String(id).slice(0, 8)} v${v}`
// Las fuentes base del PDF (Helvetica, WinAnsi) no tienen subíndices ni emojis: se pasan a texto normal
const limpio = (t) => String(t ?? '')
  .replace(/₂/g, '2').replace(/₅/g, '5').replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
  .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}️]/gu, '').replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ€·–—‘’“”…]/g, '?').trim()

const METODO = { completa: 'recinto completo', declarada: 'declarada', croquis: 'dibujada' }
const C = { texto: '#1b1f1d', suave: '#5b6660', linea: '#c9d1cc', cabecera: '#e8efe9', verde: '#2e7d32' }

function exportarPdf(c, opciones = {}) {
  const { titulo = 'Cuaderno de explotación', base = '' } = opciones
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: opciones.compress !== false, size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 46, left: 36, right: 36 }, bufferPages: true, info: { Title: `${titulo} ${c.campaña}`, Author: 'infoSalamanca', Subject: limpio(c.explotacion.nombre) } })
    const chunks = []
    doc.on('data', (b) => chunks.push(b))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    const W = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const X0 = doc.page.margins.left
    const bottom = () => doc.page.height - doc.page.margins.bottom

    // ---------- Cabecera ----------
    doc.fillColor(C.verde).font('Helvetica-Bold').fontSize(18).text(limpio(`${titulo} · campaña ${c.campaña}`), X0, doc.page.margins.top)
    doc.moveDown(0.2).fillColor(C.texto).font('Helvetica').fontSize(10)
    doc.text(limpio(`Explotación: ${c.explotacion.nombre}${c.explotacion.titular ? ` · Titular: ${c.explotacion.titular}` : ''}`))
    doc.fillColor(C.suave).fontSize(8.5)
    doc.text(limpio(`Generado el ${new Date(c.generado).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })} · ${c.version.length} parte(s) confirmados · ${c.ambito}`))
    doc.moveDown(0.6)

    // ---------- Tabla con saltos de página ----------
    function tabla(tituloTabla, cols, filas, { total = null } = {}) {
      const anchos = cols.map(col => col.w * W)
      const pad = 3
      const fs = 7.5
      const altoFila = (celdas, font) => {
        doc.font(font).fontSize(fs)
        return Math.max(...celdas.map((t, i) => doc.heightOfString(limpio(t), { width: anchos[i] - pad * 2 }))) + pad * 2
      }
      const pintaFila = (celdas, { font = 'Helvetica', fondo = null } = {}) => {
        const h = altoFila(celdas, font)
        if (doc.y + h > bottom()) { doc.addPage(); cabecera() }
        const y = doc.y
        if (fondo) doc.rect(X0, y, W, h).fill(fondo)
        let x = X0
        doc.fillColor(C.texto).font(font).fontSize(fs)
        celdas.forEach((t, i) => {
          doc.text(limpio(t), x + pad, y + pad, { width: anchos[i] - pad * 2, align: cols[i].num ? 'right' : 'left' })
          x += anchos[i]
        })
        doc.moveTo(X0, y + h).lineTo(X0 + W, y + h).lineWidth(0.4).strokeColor(C.linea).stroke()
        doc.y = y + h
      }
      const cabecera = () => pintaFila(cols.map(col => col.t), { font: 'Helvetica-Bold', fondo: C.cabecera })
      if (doc.y + 60 > bottom()) doc.addPage()
      doc.x = X0
      doc.fillColor(C.verde).font('Helvetica-Bold').fontSize(11).text(limpio(tituloTabla), X0, doc.y)
      doc.moveDown(0.3)
      if (!filas.length) {
        doc.fillColor(C.suave).font('Helvetica').fontSize(8.5).text('Sin partes confirmados.', X0, doc.y)
        doc.moveDown(0.8)
        return
      }
      cabecera()
      for (const f of filas) pintaFila(f)
      if (total) pintaFila(total, { font: 'Helvetica-Bold', fondo: C.cabecera })
      doc.moveDown(0.8)
    }

    // Abonado
    tabla('Abonado', [
      { t: 'Fecha', w: 0.07 }, { t: 'Recinto SIGPAC', w: 0.12 }, { t: 'Finca', w: 0.07 }, { t: 'Cultivo', w: 0.08 },
      { t: 'ha', w: 0.05, num: true }, { t: 'Superficie', w: 0.07 }, { t: 'Producto', w: 0.12 }, { t: 'Dosis', w: 0.07, num: true },
      { t: 'Cantidad', w: 0.07, num: true }, { t: 'N (kg)', w: 0.05, num: true }, { t: 'P2O5 (kg)', w: 0.05, num: true },
      { t: 'K2O (kg)', w: 0.05, num: true }, { t: 'Quién', w: 0.06 }, { t: 'Parte', w: 0.07 }
    ], c.filas.flatMap(f => f.productos.map((p, i) => [
      f.fecha, f.recinto, f.finca || '', f.cultivo, ha(f.superficieEjecutada.valor, 4), METODO[f.superficieEjecutada.metodo] || f.superficieEjecutada.metodo,
      p.nombre, `${fmt(p.dosis.valor)} ${p.dosis.unidad}`, p.cantidad ? `${fmt(p.cantidad.valor)} ${p.cantidad.unidad}` : 'desconocida',
      i === 0 ? (f.nutrientes.N === null ? '¿?' : fmt(f.nutrientes.N)) : '', i === 0 ? (f.nutrientes.P2O5 === null ? '¿?' : fmt(f.nutrientes.P2O5)) : '',
      i === 0 ? (f.nutrientes.K2O === null ? '¿?' : fmt(f.nutrientes.K2O)) : '', f.ejecutor || '', ref(f.operacionId, f.version)
    ])), { total: c.filas.length ? ['Total', '', '', '', ha(c.totales.superficieEjecutada, 4), '', '', '', '', fmt(c.totales.N), fmt(c.totales.P2O5), fmt(c.totales.K2O), '', ''] : null })
    if (c.totales.desconocidos?.length) {
      doc.fillColor(C.suave).font('Helvetica').fontSize(8).text(limpio(`Sin calcular (faltan datos): ${c.totales.desconocidos.join(' · ')}`), X0, doc.y - 6, { width: W })
      doc.moveDown(0.8)
    }

    // Tratamientos fitosanitarios
    tabla('Tratamientos fitosanitarios', [
      { t: 'Fecha', w: 0.07 }, { t: 'Supuesto', w: 0.08 }, { t: 'Dónde / lote', w: 0.13 }, { t: 'ha', w: 0.04, num: true },
      { t: 'Problema', w: 0.09 }, { t: 'Producto', w: 0.09 }, { t: 'Nº registro', w: 0.06 }, { t: 'Dosis', w: 0.07, num: true },
      { t: 'Cantidad', w: 0.06, num: true }, { t: 'Aplicador (carné)', w: 0.1 }, { t: 'Equipo', w: 0.06 }, { t: 'Eficacia', w: 0.09 }, { t: 'Parte', w: 0.06 }
    ], (c.tratamientos || []).map(t => [
      `${t.fecha}${t.hora ? ` ${t.hora}` : ''}`, t.subtipo, t.donde || '', t.superficieTratada?.valor ? ha(t.superficieTratada.valor) : '',
      t.problema || '', t.producto, t.registro || '', `${fmt(t.dosis.valor, 3)} ${t.dosis.unidad}`,
      t.cantidad?.valor != null ? `${fmt(t.cantidad.valor, 3)} ${t.cantidad.unidad}` : '',
      `${t.aplicador?.nombre || ''}${t.aplicador?.carne ? ` (${t.aplicador.carne})` : ''}`, t.equipo?.nombre || '',
      t.evaluacion?.realizada?.eficacia || (t.evaluacion?.programada ? `prevista ${t.evaluacion.programada}` : ''), ref(t.operacionId, t.version)
    ]))

    // Siembra, riego, labores y cosecha
    tabla('Siembra, riego, labores y cosecha', [
      { t: 'Fecha', w: 0.07 }, { t: 'Trabajo', w: 0.07 }, { t: 'Recinto SIGPAC', w: 0.12 }, { t: 'Finca', w: 0.07 }, { t: 'Cultivo', w: 0.08 },
      { t: 'ha', w: 0.05, num: true }, { t: 'Detalle', w: 0.3 }, { t: 'Cantidad', w: 0.08, num: true }, { t: 'Quién', w: 0.08 }, { t: 'Parte', w: 0.08 }
    ], (c.labores || []).map(l => [
      l.fecha, l.tipo, l.recinto, l.finca || '', l.cultivo, ha(l.superficie.valor), l.detalle || '',
      l.cantidad ? `${fmt(l.cantidad.valor, 1)} ${l.cantidad.unidad}` : '', l.ejecutor || '', ref(l.operacionId, l.version)
    ]))

    // Pendiente de revisar
    tabla(`Pendiente de revisar (${c.bandeja.length})`, [{ t: 'Qué', w: 0.15 }, { t: 'Detalle', w: 0.75 }, { t: 'Parte', w: 0.1 }],
      c.bandeja.map(b => [{ borrador: 'Sin confirmar', pendiente: 'Falta un dato', incidencia: 'Revisar', vencimiento: 'Vence', conflicto: 'Conflicto' }[b.tipo] || b.tipo, b.texto, String(b.operacionId).slice(0, 8)]))

    // ---------- Pie de cada página ----------
    const rango = doc.bufferedPageRange()
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i)
      doc.page.margins.bottom = 0 // si no, escribir en el pie abre otra página
      const y = doc.page.height - 30
      doc.fillColor(C.suave).font('Helvetica').fontSize(7)
      doc.text(limpio(`${c.explotacion.nombre} · campaña ${c.campaña} · Generado con infoSalamanca${base ? ` (${base})` : ''}. Registro propio de la explotación: no es una comunicación a la Administración.`), X0, y, { width: W - 70, lineBreak: false, height: 10 })
      doc.text(`Página ${i + 1} de ${rango.count}`, X0 + W - 70, y, { width: 70, align: 'right', lineBreak: false, height: 10 })
    }
    doc.end()
  })
}

module.exports = { exportarPdf, _test: { limpio } }
