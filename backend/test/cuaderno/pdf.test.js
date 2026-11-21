// Cuaderno en PDF (services/cuaderno/pdf.js): el mismo contenido que la hoja de cálculo, con saltos de página, pie en
// cada página y texto sin caracteres que las fuentes del PDF no tienen.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const { exportarPdf, _test } = require('../../src/services/cuaderno/pdf')

// Texto de un PDF sin comprimir: cada línea es un [<hex> ajuste <hex>…] TJ; se juntan los trozos
const textoPdf = (buf) => [...buf.toString('latin1').matchAll(/\[(.*?)\] TJ/g)].map(m => [...m[1].matchAll(/<([0-9a-f]*)>/g)].map(x => Buffer.from(x[1], 'hex').toString('latin1')).join('')).join('\n')

const cuaderno = (n) => ({
  explotacion: { id: 'e1', nombre: 'Explotación de Ana', titular: 'Ana' },
  campaña: 2027, generado: '2026-11-21T10:00:00Z', version: Array.from({ length: n }, (_, i) => `p${i}@1`),
  ambito: 'Partes confirmados de abonado, tratamientos fitosanitarios, siembra, riego, labores y cosecha.',
  filas: Array.from({ length: n }, (_, i) => ({
    operacionId: `abono-${i}-xxxxxxxx`, version: 1, fecha: '2026-11-10', tipo: 'Abonado', recinto: '37:22:0:0:501:77:1', finca: 'La Hoya', cultivo: 'Trigo blando',
    superficieEjecutada: { valor: 51000, unidad: 'm2', metodo: i % 2 ? 'croquis' : 'completa' },
    productos: [{ nombre: 'NPK 15-15-15', dosis: { valor: 180, unidad: 'kg/ha' }, cantidad: { valor: 918, unidad: 'kg' } }],
    nutrientes: { N: 137.7, P2O5: 137.7, K2O: i === 3 ? null : 137.7 }, ejecutor: 'Ana', pendientes: 0
  })),
  totales: { superficieEjecutada: 51000 * n, N: 137.7 * n, P2O5: 137.7 * n, K2O: 137.7 * (n - 1), desconocidos: ['K2O en el parte del 2026-11-10'] },
  tratamientos: [{ operacionId: 't1', version: 2, fecha: '2026-11-12', hora: '09:30', subtipo: 'Tratamiento en campo', ambito: 'superficie', donde: 'Trigo blando · 501-77-1', superficieTratada: { valor: 51000 }, problema: 'Pulgón', producto: 'Insecticida X', registro: 'ES-00123', dosis: { valor: 1.5, unidad: 'L/ha' }, cantidad: { valor: 7.65, unidad: 'L' }, aplicador: { nombre: 'Luis', carne: 'CL-99' }, equipo: { nombre: 'Pulverizador' }, evaluacion: { programada: '2026-11-26' } }],
  labores: [{ operacionId: 'l1', version: 1, fecha: '2026-10-28', tipo: 'Siembra', recinto: '501-77-1', finca: null, cultivo: 'Trigo blando', superficie: { valor: 51000, metodo: 'completa' }, detalle: 'Variedad Nogal, certificada, 180 kg/ha (918 kg)', cantidad: { valor: 918, unidad: 'kg' }, ejecutor: 'Ana' }],
  bandeja: [{ operacionId: 't1-aaaaaaaa', tipo: 'vencimiento', texto: 'Evaluar la eficacia del tratamiento del 2026-11-12' }]
})

test('PDF: cabecera, tres secciones, totales, bandeja y pie en cada página', async () => {
  const pdf = await exportarPdf(cuaderno(60), { base: 'infosalamanca.duckdns.org', compress: false })
  const txt = pdf.toString('latin1')
  assert.ok(txt.startsWith('%PDF-'))
  const paginas = (txt.match(/\/Type \/Page\b/g) || []).length
  assert.ok(paginas >= 3, `60 filas ocupan varias páginas (${paginas})`)
  const texto = textoPdf(pdf)
  const tiene = (s) => texto.includes(s)
  for (const s of ['Abonado', 'Tratamientos fitosanitarios', 'Siembra, riego, labores y cosecha', 'Pendiente de revisar (1)', 'Total', 'Pulg', 'abono-0- v1', 'campa'])
    assert.ok(tiene(s), `falta «${s}»`)
  assert.ok(tiene(`Página 1 de ${paginas}`) && tiene(`Página ${paginas} de ${paginas}`), 'pie numerado en todas')
  assert.ok(tiene('no es una comunicaci'), 'dice que no es una comunicación oficial')
  // Para mirarlo: PDF_MUESTRA=/ruta/cuaderno.pdf npm test
  if (process.env.PDF_MUESTRA) fs.writeFileSync(process.env.PDF_MUESTRA, await exportarPdf(cuaderno(60), { base: 'infosalamanca.duckdns.org' }))
})

test('PDF: sin partes, dice que no hay; y el texto raro se limpia', async () => {
  const vacio = { ...cuaderno(0), tratamientos: [], labores: [], bandeja: [] }
  assert.ok(textoPdf(await exportarPdf(vacio, { compress: false })).includes('Sin partes confirmados.'))
  assert.strictEqual(_test.limpio('P₂O₅ 🌱 Siembra · 3 m³'), 'P2O5  Siembra · 3 m³')
})
