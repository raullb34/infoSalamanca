// Exportación del cuaderno de una campaña a hoja de cálculo (CSV para Excel en español: separador «;», coma decimal y
// BOM para que abra bien los acentos). Cabecera con el ámbito, la versión (partes@versión) y los pendientes; cada fila
// lleva el identificador del parte y el enlace para abrirlo en la web. Las cantidades son las de los partes
// confirmados, sin redondear más que al presentar.
const fmt = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '' : v.toFixed(d).replace('.', ','))
const cell = (v) => {
  const s = String(v ?? '')
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportarCsv(c, { base = '' } = {}) {
  const rows = []
  rows.push(['Cuaderno de explotación', c.explotacion.nombre])
  rows.push(['Titular', c.explotacion.titular?.nombre || ''])
  rows.push(['Campaña', c.campaña])
  rows.push(['Generado', c.generado])
  rows.push(['Ámbito', c.ambito])
  rows.push(['Versión (parte@versión)', c.version.join(' ')])
  rows.push(['Pendientes', c.bandeja.length ? `${c.bandeja.length} (ver la bandeja en la web)` : 'ninguno'])
  rows.push([])
  rows.push(['Fecha', 'Labor', 'Recinto SIGPAC', 'Cultivo', 'Superficie ejecutada (ha)', 'Cómo se obtuvo la superficie', 'Producto', 'Dosis', 'Unidad de dosis', 'Cantidad', 'Unidad', 'N (kg)', 'P2O5 (kg)', 'K2O (kg)', 'Quién lo hizo', 'Parte', 'Versión del parte', 'Datos pendientes', 'Enlace'])
  for (const f of c.filas) {
    f.productos.forEach((p, i) => {
      rows.push([
        f.fecha, f.tipo, f.recinto, f.cultivo, fmt(f.superficieEjecutada.valor / 10000, 4), { completa: 'Recinto completo', declarada: 'Declarada', croquis: 'Croquis en el mapa' }[f.superficieEjecutada.metodo] || f.superficieEjecutada.metodo,
        p.nombre, fmt(p.dosis.valor, 2), p.dosis.unidad, p.cantidad ? fmt(p.cantidad.valor, 2) : '', p.cantidad?.unidad || '',
        // Los nutrientes son del parte entero (todas sus líneas) en esa imputación: solo en la primera línea
        i === 0 ? fmt(f.nutrientes.N, 2) : '', i === 0 ? fmt(f.nutrientes.P2O5, 2) : '', i === 0 ? fmt(f.nutrientes.K2O, 2) : '',
        f.ejecutor || '', f.operacionId, f.version, f.pendientes || 0,
        base ? `${base}/?explotacion=${encodeURIComponent(c.explotacion.id)}&parte=${encodeURIComponent(f.operacionId)}` : ''
      ])
    })
  }
  rows.push([])
  rows.push(['Totales confirmados', '', '', '', fmt(c.totales.superficieEjecutada / 10000, 4), '', '', '', '', '', '', fmt(c.totales.N), fmt(c.totales.P2O5), fmt(c.totales.K2O)])
  if (c.totales.desconocidos.length) rows.push(['Sin calcular (faltan datos)', c.totales.desconocidos.join(' · ')])
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n'
}

module.exports = { exportarCsv }
