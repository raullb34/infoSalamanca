// «Mi explotación»: explotaciones privadas, recintos guardados, cultivos de campaña, partes de trabajo y cuaderno.
//
// Permisos: se comprueban aquí, en cada lectura y escritura, con los papeles del usuario en esa explotación:
//   titular (todo), ejecutor (registra partes), confirmador (confirma), asesor (lee y revisa).
// A quien no es miembro se le responde «no encontrada» (no se revela que existe).
//
// Superficies (m², unidad de origen del SIGPAC), siempre separadas:
//   oficial (del recinto SIGPAC) · cultivada (de cada cultivo en cada recinto) · ejecutada (de cada parte).
// Cada valor lleva cómo se obtuvo (`metodo`) y su procedencia: oficial | usuario | dispositivo | historial | calculado.
//
// Estados independientes de un parte: trabajo (borrador · confirmado), sincronización (`sync`) e intercambio oficial
// (`oficial`: sin_enviar…). Solo los confirmados cuentan en el cuaderno y en los totales.
const { newId } = require('./store')
const { geometryArea, validGeometry } = require('./geo')
const fert = require('./fertilizacion')
const fito = require('./fitosanitarios')

const ROLES = ['titular', 'ejecutor', 'confirmador', 'asesor']
const PERMISOS = {
  leer: ROLES,
  editar: ['titular', 'ejecutor'],
  confirmar: ['titular', 'confirmador'],
  administrar: ['titular']
}
const TOLERANCIA = 1.005 // medida frente a oficial: el SIGPAC redondea y el croquis no es exacto
const PLAZO_FERTILIZACION_DIAS = 31 // ver docs/cuaderno/obligaciones.md (FERT-02): pendiente de revisión normativa

const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra })
const isoDay = (d) => (d ? String(d).slice(0, 10) : null)
const validDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(new Date(`${d}T12:00:00Z`))
const refTexto = (ine, r) => `${ine.slice(0, 2)}:${Number(ine.slice(2))}:${r.agr}:${r.zona}:${r.pol}:${r.par}:${r.rec}`
// ¿Se solapan dos periodos? (sin fin = abierto)
const overlap = (a1, a2, b1, b2) => (!a2 || !b1 || b1 <= a2) && (!b2 || !a1 || a1 <= b2)

/**
 * @param store       almacén (store.js)
 * @param fuenteSigpac async (ine) → GeoJSON del municipio publicado por el visor (procedencia oficial)
 */
function createService(store, { fuenteSigpac, now = () => new Date() } = {}) {
  // ---------- Permisos ----------
  async function explotacionDe(actor, explId, accion = 'leer') {
    if (!actor) throw fail(401, 'Tienes que entrar con tu cuenta')
    const e = await store.get('explotaciones', explId)
    const m = e?.miembros.find(x => x.userId === actor.id)
    if (!e || !m) throw fail(404, 'Explotación no encontrada')
    if (!m.roles.some(r => PERMISOS[accion].includes(r))) throw fail(403, `Tu papel en esta explotación no permite ${{ editar: 'registrar ni cambiar datos', confirmar: 'confirmar partes', administrar: 'administrarla' }[accion] || accion}`)
    return { explotacion: e, roles: m.roles }
  }

  // ---------- Explotaciones ----------
  async function crearExplotacion(actor, { nombre, titular = {}, identificadores = {} }) {
    if (!actor) throw fail(401, 'Tienes que entrar con tu cuenta')
    const n = String(nombre || '').trim()
    if (!n) throw fail(400, 'Ponle un nombre a la explotación')
    return store.insert('explotaciones', {
      nombre: n.slice(0, 120),
      titular: { nombre: String(titular.nombre || actor.nombre || '').slice(0, 120), nif: titular.nif ? String(titular.nif).toUpperCase().slice(0, 12) : null },
      // REA, código de explotación… solo si se conocen; no hacen falta para usar el cuaderno
      identificadores: { rea: identificadores.rea || null },
      miembros: [{ userId: actor.id, nombre: actor.nombre, roles: ['titular'] }],
      creada: now().toISOString()
    })
  }

  const listarExplotaciones = async (actor) => {
    if (!actor) throw fail(401, 'Tienes que entrar con tu cuenta')
    return (await store.find('explotaciones', { 'miembros.userId': actor.id })).map(e => ({ ...e, misRoles: e.miembros.find(m => m.userId === actor.id).roles }))
  }

  // ---------- Miembros: el titular da acceso a otras cuentas con su papel ----------
  // La persona tiene que haber creado su cuenta (no se crean cuentas por otros). Siempre queda al menos un titular.
  async function buscarPersona(valor) {
    const v = String(valor || '').trim()
    if (v.includes('@')) return (await store.find('usuarios', { email: v.toLowerCase() }))[0] || null
    const c = v.toUpperCase().replace(/[^A-Z0-9]/g, '')
    return c.length === 6 ? (await store.find('usuarios', { codigo: c }))[0] || null : null
  }
  // La persona se busca por su correo o por su código (el que ve en su cuenta, p. ej. «K7P 3QM»)
  async function ponerMiembro(actor, explId, { email, codigo, persona, roles }) {
    const { explotacion: e } = await explotacionDe(actor, explId, 'administrar')
    const rs = [...new Set((roles || []).filter(r => ROLES.includes(r)))]
    if (!rs.length) throw fail(400, `Indica al menos un papel: ${ROLES.join(', ')}`)
    const u = await buscarPersona(persona || codigo || email)
    if (!u) throw fail(404, 'No hay ninguna cuenta con ese correo o código: tiene que crearla antes')
    const miembros = e.miembros.filter(m => m.userId !== u._id)
    miembros.push({ userId: u._id, nombre: u.nombre, roles: rs, desde: now().toISOString(), porId: actor.id })
    if (!miembros.some(m => m.roles.includes('titular'))) throw fail(400, 'La explotación tiene que tener al menos un titular')
    return store.update('explotaciones', explId, { miembros })
  }

  async function quitarMiembro(actor, explId, userId) {
    const { explotacion: e } = await explotacionDe(actor, explId, 'administrar')
    const miembros = e.miembros.filter(m => m.userId !== userId)
    if (miembros.length === e.miembros.length) throw fail(404, 'No es miembro de esta explotación')
    if (!miembros.some(m => m.roles.includes('titular'))) throw fail(400, 'La explotación tiene que tener al menos un titular')
    return store.update('explotaciones', explId, { miembros })
  }

  // ---------- Recintos (copia del SIGPAC de la campaña) ----------
  async function guardarRecinto(actor, explId, { ine, ref, alias }) {
    await explotacionDe(actor, explId, 'editar')
    if (!/^37\d{3}$/.test(String(ine || ''))) throw fail(400, 'Municipio no válido')
    const r = { agr: Number(ref?.agr) || 0, zona: Number(ref?.zona) || 0, pol: Number(ref?.pol), par: Number(ref?.par), rec: Number(ref?.rec) }
    if (![r.pol, r.par, r.rec].every(Number.isInteger)) throw fail(400, 'Referencia del recinto incompleta (polígono, parcela y recinto)')
    // Lo oficial sale de la fuente publicada, no de lo que manda el móvil
    const fuente = await fuenteSigpac(String(ine))
    if (!fuente) throw fail(404, 'No hay cartografía SIGPAC de ese municipio')
    const f = fuente.features.find(x => ['agr', 'zona', 'pol', 'par', 'rec'].every(k => Number(x.properties[k]) === r[k]))
    if (!f) throw fail(404, `El recinto ${r.pol}/${r.par}/${r.rec} no está en el SIGPAC ${fuente.campaña} de ese municipio`)
    const texto = refTexto(fuente.municipio.catastro || String(ine), r)
    const oficial = {
      campaña: fuente.campaña,
      geometria: f.geometry,
      superficieOficial: { valor: f.properties.sup, unidad: 'm2', procedencia: 'oficial' },
      uso: { codigo: f.properties.uso, procedencia: 'oficial' },
      regadio: { coeficiente: f.properties.reg, unidad: '%', procedencia: 'oficial' },
      referenciaCatastral: f.properties.cat || null,
      fuente: { datos: fuente.fuente?.datos, url: fuente.fuente?.url, fechaReferencia: fuente.fuente?.fechaReferencia, licencia: fuente.fuente?.licencia }
    }
    const [existente] = await store.find('recintos', { explotacionId: explId, refTexto: texto })
    if (existente) {
      if (existente.campaña === oficial.campaña) return existente
      // Nueva campaña: se guarda la anterior (el historial y los partes siguen apuntando a ella)
      const anterior = Object.fromEntries(['campaña', 'geometria', 'superficieOficial', 'uso', 'regadio', 'referenciaCatastral', 'fuente'].map(k => [k, existente[k]]))
      return store.update('recintos', existente._id, { ...oficial, versionesAnteriores: [...(existente.versionesAnteriores || []), anterior], actualizado: now().toISOString() })
    }
    return store.insert('recintos', {
      explotacionId: explId, ine: String(ine), municipio: fuente.municipio.nombre, ref: r, refTexto: texto,
      alias: alias ? String(alias).slice(0, 80) : null, favorito: false, versionesAnteriores: [], creado: now().toISOString(), ...oficial
    })
  }

  async function listarRecintos(actor, explId) {
    await explotacionDe(actor, explId)
    return store.find('recintos', { explotacionId: explId })
  }

  async function editarRecinto(actor, explId, recintoId, { alias, favorito, observaciones }) {
    await explotacionDe(actor, explId, 'editar')
    const r = await store.get('recintos', recintoId)
    if (!r || r.explotacionId !== explId) throw fail(404, 'Recinto no encontrado')
    const patch = {}
    if (alias !== undefined) patch.alias = alias ? String(alias).slice(0, 80) : null
    if (favorito !== undefined) patch.favorito = Boolean(favorito)
    if (observaciones !== undefined) patch.observaciones = String(observaciones || '').slice(0, 2000)
    return store.update('recintos', recintoId, patch)
  }

  // Superficie de una unidad (cultivo en un recinto, o parte de un parte): completa, declarada o por croquis
  function superficieDe(u, maximo, procedenciaDeclarada = 'usuario') {
    const metodo = u.superficie?.metodo || 'completa'
    let valor
    if (metodo === 'completa') valor = maximo
    else if (metodo === 'declarada') valor = Number(u.superficie?.valor)
    else if (metodo === 'croquis') {
      if (!validGeometry(u.superficie?.geometria)) throw fail(400, 'El croquis no es una superficie válida')
      valor = geometryArea(u.superficie.geometria)
    } else throw fail(400, `Método de superficie no válido: ${metodo}`)
    if (!(valor > 0)) throw fail(400, 'La superficie tiene que ser mayor que cero')
    if (valor > maximo * TOLERANCIA) throw fail(400, `La superficie (${(valor / 10000).toFixed(4)} ha) supera la disponible (${(maximo / 10000).toFixed(4)} ha)`)
    return {
      valor: Math.min(valor, maximo), unidad: 'm2', metodo,
      procedencia: metodo === 'completa' ? 'calculado' : metodo === 'croquis' ? 'dispositivo' : procedenciaDeclarada,
      ...(metodo === 'croquis' ? { geometria: u.superficie.geometria } : {})
    }
  }

  // ---------- Fincas de trabajo ----------
  // Como la llama el agricultor ("La Hoya"), con alias, sus recintos o partes de recintos (puede ser discontinua),
  // accesos (punto y descripción) y observaciones. No sustituye a los recintos: los agrupa.
  async function crearFinca(actor, explId, d) {
    await explotacionDe(actor, explId, 'editar')
    const nombre = String(d.nombre || '').trim()
    if (!nombre) throw fail(400, 'Ponle un nombre a la finca')
    if (!Array.isArray(d.recintos) || !d.recintos.length) throw fail(400, 'Indica qué recintos forman la finca')
    const recintos = []
    for (const x of d.recintos) {
      const r = await store.get('recintos', x.recintoId)
      if (!r || r.explotacionId !== explId) throw fail(404, 'Recinto no encontrado en esta explotación')
      recintos.push({ recintoId: r._id, refTexto: r.refTexto, superficie: superficieDe(x, r.superficieOficial.valor) })
    }
    const accesos = (d.accesos || []).filter(a => Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lng)) && Math.abs(a.lat) <= 90 && Math.abs(a.lng) <= 180)
      .slice(0, 10).map(a => ({ lat: Number(a.lat), lng: Number(a.lng), descripcion: a.descripcion ? String(a.descripcion).slice(0, 200) : null, procedencia: a.procedencia === 'dispositivo' ? 'dispositivo' : 'usuario' }))
    return store.insert('fincas', {
      explotacionId: explId, nombre: nombre.slice(0, 120), alias: (d.alias || []).map(a => String(a).trim()).filter(Boolean).slice(0, 10),
      recintos, accesos, observaciones: d.observaciones ? String(d.observaciones).slice(0, 2000) : null,
      superficie: { valor: recintos.reduce((s, x) => s + x.superficie.valor, 0), unidad: 'm2', procedencia: 'calculado' },
      creada: now().toISOString(), autorId: actor.id
    })
  }

  async function listarFincas(actor, explId) {
    await explotacionDe(actor, explId)
    return store.find('fincas', { explotacionId: explId })
  }

  // ---------- Cultivos de campaña ----------
  async function crearCultivo(actor, explId, d) {
    await explotacionDe(actor, explId, 'editar')
    const campaña = Number(d.campaña ?? d.campana) // también sin ñ (clientes que no envían UTF-8)
    if (!Number.isInteger(campaña) || campaña < 2000 || campaña > 2100) throw fail(400, 'Campaña no válida')
    const especie = String(d.especie || '').trim()
    if (!especie) throw fail(400, 'Falta el cultivo (especie)')
    if (d.fechaInicio && !validDay(d.fechaInicio)) throw fail(400, 'Fecha de siembra no válida')
    if (d.fechaFin && !validDay(d.fechaFin)) throw fail(400, 'Fecha de fin no válida')
    if (d.fechaInicio && d.fechaFin && d.fechaFin < d.fechaInicio) throw fail(400, 'El cultivo no puede acabar antes de empezar')
    if (!Array.isArray(d.unidades) || !d.unidades.length) throw fail(400, 'Indica en qué recintos está el cultivo')
    const otros = (await store.find('cultivos', { explotacionId: explId, campaña })).filter(c => c.estado !== 'anulado')
    const unidades = []
    for (const u of d.unidades) {
      const r = await store.get('recintos', u.recintoId)
      if (!r || r.explotacionId !== explId) throw fail(404, 'Recinto no encontrado en esta explotación')
      const oficial = r.superficieOficial.valor
      const sup = superficieDe(u, oficial)
      // Sin doble cómputo: lo cultivado a la vez en un recinto no puede pasar de su superficie oficial
      const ocupado = otros.filter(c => overlap(c.fechaInicio, c.fechaFin, d.fechaInicio, d.fechaFin))
        .flatMap(c => c.unidades.filter(x => x.recintoId === r._id)).reduce((s, x) => s + x.superficie.valor, 0)
      if (ocupado + sup.valor > oficial * TOLERANCIA) throw fail(409, `En el recinto ${r.refTexto} ya hay ${(ocupado / 10000).toFixed(4)} ha cultivadas en esas fechas; con este cultivo pasaría de su superficie oficial (${(oficial / 10000).toFixed(4)} ha)`)
      unidades.push({ recintoId: r._id, refTexto: r.refTexto, campañaSigpac: r.campaña, superficie: sup })
    }
    return store.insert('cultivos', {
      explotacionId: explId, campaña, especie: especie.slice(0, 80), variedad: d.variedad ? String(d.variedad).slice(0, 80) : null,
      regimen: d.regimen === 'regadio' ? 'regadio' : 'secano', precedente: d.precedente ? String(d.precedente).slice(0, 80) : null,
      fechaInicio: d.fechaInicio || null, fechaFin: d.fechaFin || null, unidades,
      // Declaración oficial (DGC/UHC) y observación de campo, cada una con su procedencia
      referenciasOficiales: { dgc: d.dgc || null, uhc: d.uhc || null },
      procedencia: { especie: 'usuario', superficie: 'calculado' },
      estado: 'activo', creado: now().toISOString(), autorId: actor.id
    })
  }

  async function listarCultivos(actor, explId, { campaña } = {}) {
    await explotacionDe(actor, explId)
    const filtro = { explotacionId: explId }
    if (campaña) filtro.campaña = Number(campaña)
    return store.find('cultivos', filtro)
  }

  // ---------- Partes (operaciones de campo) ----------
  const TIPOS = { abonado: 'Abonado', fitosanitario: 'Tratamiento fitosanitario' }
  const txt = (v, n = 200) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim().slice(0, n))

  // Datos propios de un tratamiento fitosanitario (el uso autorizado no se comprueba aquí: ver fitosanitarios.js)
  function datosFito(d = {}) {
    return {
      subtipo: fito.SUBTIPOS[d.subtipo] ? d.subtipo : null,
      problema: txt(d.problema, 200), // plaga, enfermedad o mala hierba
      justificacion: txt(d.justificacion, 1000),
      hora: /^\d{1,2}:\d{2}$/.test(String(d.hora || '')) ? String(d.hora).padStart(5, '0') : null,
      lote: d.lote ? { descripcion: txt(d.lote.descripcion, 200), identificador: txt(d.lote.identificador, 80), cantidad: d.lote.cantidad?.valor ? { valor: Number(d.lote.cantidad.valor), unidad: d.lote.cantidad.unidad === 't' ? 't' : 'kg' } : null } : null,
      instalacion: d.instalacion ? { nombre: txt(d.instalacion.nombre, 120), tipo: txt(d.instalacion.tipo, 80) } : null,
      aplicador: { nombre: txt(d.aplicador?.nombre, 120), carne: txt(d.aplicador?.carne, 40) },
      equipo: { nombre: txt(d.equipo?.nombre, 120), inscripcion: txt(d.equipo?.inscripcion, 40), inspeccion: txt(d.equipo?.inspeccion, 40) },
      asesor: d.asesor?.nombre ? { nombre: txt(d.asesor.nombre, 120), numero: txt(d.asesor.numero, 40) } : null,
      evaluacion: { programada: /^\d{4}-\d{2}-\d{2}$/.test(String(d.evaluacion?.programada || '')) ? d.evaluacion.programada : null, realizada: d.evaluacion?.realizada || null }
    }
  }

  // Imputaciones: dónde se hizo, con la superficie ejecutada en cada cultivo y recinto
  async function resolverImputaciones(explId, imputaciones = []) {
    const out = []
    for (const i of imputaciones) {
      const c = await store.get('cultivos', i.cultivoId)
      if (!c || c.explotacionId !== explId) throw fail(404, 'Cultivo no encontrado en esta explotación')
      const u = i.recintoId ? c.unidades.find(x => x.recintoId === i.recintoId) : c.unidades.length === 1 ? c.unidades[0] : null
      if (!u) throw fail(400, `Indica en qué recinto del cultivo ${c.especie} se hizo`)
      out.push({ cultivoId: c._id, especie: c.especie, campaña: c.campaña, recintoId: u.recintoId, refTexto: u.refTexto, fechasCultivo: [c.fechaInicio, c.fechaFin], superficie: superficieDe(i, u.superficie.valor) })
    }
    return out
  }

  // Lo que falta para poder confirmar (realización, fecha, producto, dosis y unidad, zona y responsable)
  function faltaParaConfirmar(op) {
    const f = []
    const esFito = op.tipo === 'fitosanitario'
    if (!validDay(op.fechaEfectiva)) f.push({ campo: 'fechaEfectiva', motivo: 'Falta la fecha en que se hizo' })
    // Dónde: superficie (abonado y tratamiento en campo), lote o instalación (sin superficie, explícito)
    const ambito = esFito ? fito.SUBTIPOS[op.fito?.subtipo]?.ambito : 'superficie'
    if (esFito && !op.fito?.subtipo) f.push({ campo: 'fito.subtipo', motivo: 'Falta qué se trató (campo, semilla, poscosecha o instalación)' })
    if (ambito === 'superficie' && !op.imputaciones.length) f.push({ campo: 'imputaciones', motivo: 'Falta dónde se hizo' })
    if (ambito === 'lote' && !(op.fito?.lote?.descripcion || op.fito?.lote?.identificador)) f.push({ campo: 'fito.lote', motivo: 'Falta el lote tratado' })
    if (ambito === 'instalacion' && !op.fito?.instalacion?.nombre) f.push({ campo: 'fito.instalacion', motivo: 'Falta la instalación tratada' })
    if (esFito && !op.fito?.problema) f.push({ campo: 'fito.problema', motivo: 'Falta el problema tratado (plaga, enfermedad o mala hierba)' })
    if (!op.lineas.length) f.push({ campo: 'lineas', motivo: 'Falta el producto' })
    const UNIDADES = esFito ? fito.DOSIS : fert.DOSIS
    op.lineas.forEach((l, i) => {
      if (!String(l.producto?.nombre || '').trim()) f.push({ campo: `lineas[${i}].producto.nombre`, motivo: 'Falta el nombre del producto' })
      if (!(Number(l.dosis?.valor) > 0) || !UNIDADES[l.dosis?.unidad]) f.push({ campo: `lineas[${i}].dosis`, motivo: 'Falta la dosis o su unidad' })
    })
    if (esFito ? !op.fito?.aplicador?.nombre : !String(op.ejecutor?.nombre || '').trim()) f.push({ campo: esFito ? 'fito.aplicador' : 'ejecutor', motivo: esFito ? 'Falta quién lo aplicó' : 'Falta quién lo hizo' })
    return f
  }

  // Incidencias (no impiden guardar): fuera de las fechas del cultivo, registro fuera de plazo…
  function incidenciasDe(op) {
    const inc = []
    for (const i of op.imputaciones) {
      const [ini, fin] = i.fechasCultivo || []
      if (op.fechaEfectiva && ((ini && op.fechaEfectiva < ini) || (fin && op.fechaEfectiva > fin))) {
        inc.push({ codigo: 'FECHA-CULTIVO', texto: `La fecha (${op.fechaEfectiva}) está fuera de las fechas del cultivo de ${i.especie} en ${i.refTexto}`, regla: null })
      }
    }
    if (op.tipo === 'abonado' && validDay(op.fechaEfectiva)) {
      const dias = Math.floor((new Date(op.fechaRegistro) - new Date(`${op.fechaEfectiva}T00:00:00Z`)) / 86400e3)
      if (dias > PLAZO_FERTILIZACION_DIAS) {
        inc.push({ codigo: 'FERT-02', texto: `Registrado ${dias} días después de hacerlo (el plazo de referencia es de un mes)`, regla: { id: 'FERT-02', estado: 'pendiente de revisión' } })
      }
    }
    return inc
  }

  function derivar(op) {
    const calc = op.tipo === 'abonado' ? fert.calcularAbonado(op) : op.tipo === 'fitosanitario' ? fito.calcularTratamiento({ ...op, subtipo: op.fito?.subtipo, lote: op.fito?.lote }) : null
    const pendientes = [...faltaParaConfirmar(op), ...(calc?.pendientes || [])]
    const vistos = new Set()
    return {
      derivados: calc,
      pendientes: pendientes.filter(p => (vistos.has(p.campo) ? false : vistos.add(p.campo))),
      incidencias: incidenciasDe(op)
    }
  }

  // Producto: se guarda lo que se usó en la fecha del asiento (nombre, composición, densidad, registro)
  const productoDe = (p = {}) => ({
    nombre: String(p.nombre || '').trim().slice(0, 120),
    tipo: ['mineral', 'organico', 'organomineral', 'enmienda'].includes(p.tipo) ? p.tipo : null,
    composicion: Object.fromEntries(fert.NUTRIENTES.map(n => [n, p.composicion?.[n] === undefined || p.composicion[n] === '' || p.composicion[n] === null ? null : Number(p.composicion[n])])),
    densidad: p.densidad?.valor ? { valor: Number(p.densidad.valor), unidad: p.densidad.unidad || 'kg/L' } : null,
    registro: p.registro ? String(p.registro).slice(0, 40) : null,
    productoId: p.productoId || null
  })

  async function crearOperacion(actor, explId, d) {
    const { roles } = await explotacionDe(actor, explId, 'editar')
    if (!TIPOS[d.tipo]) throw fail(400, `De momento el cuaderno registra: ${Object.values(TIPOS).join(', ')}`)
    // Mismo id = mismo parte: los reintentos de un móvil sin red no lo duplican
    const id = String(d.id || newId())
    const previo = await store.get('operaciones', id)
    if (previo) {
      if (previo.explotacionId !== explId) throw fail(409, 'Ese identificador de parte ya existe')
      return { ...previo, repetida: true }
    }
    const op = {
      _id: id, explotacionId: explId, tipo: d.tipo,
      fechaEfectiva: d.fechaEfectiva || null,
      fechaRegistro: now().toISOString(),
      autorId: actor.id,
      ejecutor: { nombre: String(d.ejecutor?.nombre || '').slice(0, 120) || null, userId: d.ejecutor?.userId || null },
      imputaciones: await resolverImputaciones(explId, d.imputaciones),
      lineas: (d.lineas || []).map(l => ({ producto: productoDe(l.producto), dosis: { valor: Number(l.dosis?.valor), unidad: l.dosis?.unidad } })),
      ...(d.tipo === 'fitosanitario' ? { fito: datosFito(d.fito) } : {}),
      observaciones: d.observaciones ? String(d.observaciones).slice(0, 2000) : null,
      procedencias: { fechaEfectiva: d.procedencias?.fechaEfectiva || 'usuario', imputaciones: d.procedencias?.imputaciones || 'usuario', lineas: 'usuario' },
      version: 1, versiones: [], rectificaciones: [], conflictos: [],
      sync: { estado: 'guardado', dispositivo: d.dispositivo || null },
      oficial: { estado: 'sin_enviar' }
    }
    // Campaña del parte: la de sus cultivos o, sin superficie (lote, instalación), la indicada o la del año
    op.campaña = op.imputaciones[0]?.campaña || Number(d.campaña ?? d.campana) || Number(String(op.fechaEfectiva || now().toISOString()).slice(0, 4))
    if (op.tipo === 'fitosanitario' && ['poscosecha', 'instalacion'].includes(op.fito.subtipo) && op.imputaciones.length) throw fail(400, 'Un tratamiento poscosecha o de instalación no lleva superficie: quita los recintos')
    Object.assign(op, derivar(op))
    // Confirmar: lo pide quien puede confirmar y no falta nada esencial; si no, queda en borrador
    const quiereConfirmar = d.estado === 'confirmado'
    const puede = roles.some(r => PERMISOS.confirmar.includes(r))
    const esenciales = faltaParaConfirmar(op)
    op.estado = quiereConfirmar && puede && !esenciales.length ? 'confirmado' : 'borrador'
    if (op.estado === 'confirmado') op.confirmado = { por: actor.id, fecha: now().toISOString() }
    if (quiereConfirmar && !puede) op.pendientes.push({ campo: 'confirmacion', motivo: 'Lo tiene que confirmar el titular o quien confirma' })
    return store.insert('operaciones', op)
  }

  // Rectificar: se guarda la versión anterior y se recalculan los derivados. Con versión desfasada (otro dispositivo
  // cambió el parte antes), no se pisa: se guarda la propuesta como conflicto hasta resolverlo.
  async function rectificarOperacion(actor, explId, opId, { cambios = {}, motivo, version, confirmar = false }) {
    const { roles } = await explotacionDe(actor, explId, 'editar')
    const op = await store.get('operaciones', opId)
    if (!op || op.explotacionId !== explId) throw fail(404, 'Parte no encontrado')
    if (op.estado === 'confirmado' && !String(motivo || '').trim()) throw fail(400, 'Indica el motivo de la rectificación')
    if (version !== undefined && Number(version) !== op.version) {
      const conflicto = { id: newId(), autorId: actor.id, fecha: now().toISOString(), basadoEn: Number(version), cambios, motivo: motivo || null }
      await store.update('operaciones', opId, { conflictos: [...(op.conflictos || []), conflicto] })
      throw fail(409, 'El parte ha cambiado desde otro dispositivo: se han guardado las dos versiones para que elijas', { conflicto })
    }
    const { versiones, conflictos, ...anterior } = op
    const nuevo = { ...op }
    if (cambios.fechaEfectiva !== undefined) nuevo.fechaEfectiva = cambios.fechaEfectiva
    if (cambios.ejecutor !== undefined) nuevo.ejecutor = { nombre: String(cambios.ejecutor?.nombre || '').slice(0, 120) || null, userId: cambios.ejecutor?.userId || null }
    if (cambios.imputaciones !== undefined) nuevo.imputaciones = await resolverImputaciones(explId, cambios.imputaciones)
    if (cambios.lineas !== undefined) nuevo.lineas = cambios.lineas.map(l => ({ producto: productoDe(l.producto), dosis: { valor: Number(l.dosis?.valor), unidad: l.dosis?.unidad } }))
    if (cambios.fito !== undefined && op.tipo === 'fitosanitario') nuevo.fito = { ...datosFito({ ...op.fito, ...cambios.fito }), evaluacion: op.fito.evaluacion }
    if (cambios.observaciones !== undefined) nuevo.observaciones = cambios.observaciones ? String(cambios.observaciones).slice(0, 2000) : null
    Object.assign(nuevo, derivar(nuevo))
    const puede = roles.some(r => PERMISOS.confirmar.includes(r))
    if ((op.estado === 'confirmado' || confirmar) && puede && !faltaParaConfirmar(nuevo).length) {
      nuevo.estado = 'confirmado'
      if (op.estado !== 'confirmado') nuevo.confirmado = { por: actor.id, fecha: now().toISOString() }
    } else if (op.estado === 'confirmado') {
      throw fail(400, 'La rectificación deja el parte incompleto o sin quien lo confirme: corrígelo antes de guardarlo')
    }
    nuevo.version = op.version + 1
    nuevo.versiones = [...(versiones || []), anterior]
    if (op.estado === 'confirmado') nuevo.rectificaciones = [...(op.rectificaciones || []), { version: nuevo.version, motivo: String(motivo).slice(0, 500), autorId: actor.id, fecha: now().toISOString() }]
    // Si ya se había enviado, lo enviado queda en la versión anterior y hay que tramitar la rectificación
    if (op.oficial?.estado && op.oficial.estado !== 'sin_enviar') nuevo.oficial = { ...op.oficial, estado: 'por_rectificar' }
    const saved = await store.update('operaciones', opId, nuevo, { version: op.version })
    if (!saved) throw fail(409, 'El parte ha cambiado mientras lo guardabas; vuelve a abrirlo')
    return saved
  }

  // Evaluación posterior de un tratamiento (eficacia): un hecho nuevo, con su fecha y autor; nueva versión del parte
  async function registrarEvaluacion(actor, explId, opId, { fecha, eficacia, observaciones } = {}) {
    await explotacionDe(actor, explId, 'editar')
    const op = await store.get('operaciones', opId)
    if (!op || op.explotacionId !== explId) throw fail(404, 'Parte no encontrado')
    if (op.tipo !== 'fitosanitario') throw fail(400, 'Solo los tratamientos llevan evaluación de eficacia')
    if (!validDay(fecha)) throw fail(400, 'Falta la fecha de la evaluación')
    if (!['buena', 'regular', 'mala'].includes(eficacia)) throw fail(400, 'Eficacia: buena, regular o mala')
    const { versiones, conflictos, ...anterior } = op
    const fitoNuevo = { ...op.fito, evaluacion: { ...op.fito.evaluacion, realizada: { fecha, eficacia, observaciones: txt(observaciones, 1000), autorId: actor.id, registrada: now().toISOString() } } }
    const saved = await store.update('operaciones', opId, { fito: fitoNuevo, version: op.version + 1, versiones: [...(versiones || []), anterior] }, { version: op.version })
    if (!saved) throw fail(409, 'El parte ha cambiado mientras lo guardabas; vuelve a abrirlo')
    return saved
  }

  async function listarOperaciones(actor, explId) {
    await explotacionDe(actor, explId)
    return (await store.find('operaciones', { explotacionId: explId })).sort((a, b) => String(b.fechaEfectiva).localeCompare(String(a.fechaEfectiva)))
  }

  async function obtenerOperacion(actor, explId, opId) {
    await explotacionDe(actor, explId)
    const op = await store.get('operaciones', opId)
    if (!op || op.explotacionId !== explId) throw fail(404, 'Parte no encontrado')
    return op
  }

  // ---------- Cuaderno de una campaña ----------
  // Solo partes confirmados; una fila por imputación (finca/recinto y cultivo), con el enlace al parte original.
  // La bandeja reúne lo pendiente (borradores, datos que faltan e incidencias).
  async function cuaderno(actor, explId, { campaña }) {
    const { explotacion } = await explotacionDe(actor, explId)
    const camp = Number(campaña)
    const ops = (await store.find('operaciones', { explotacionId: explId })).filter(o => o.campaña === camp || o.imputaciones.some(i => i.campaña === camp))
    const confirmados = ops.filter(o => o.estado === 'confirmado').sort((a, b) => String(a.fechaEfectiva).localeCompare(String(b.fechaEfectiva)))
    const filas = []
    const totales = { superficieEjecutada: 0, N: 0, P2O5: 0, K2O: 0, desconocidos: [] }
    for (const o of confirmados.filter(x => x.tipo === 'abonado')) {
      const total = o.derivados?.superficieEjecutada?.valor || 0
      for (const i of o.imputaciones.filter(x => x.campaña === camp)) {
        // Lo de cada línea se reparte entre las imputaciones según su superficie ejecutada
        const parte = total ? i.superficie.valor / total : 0
        const productos = o.lineas.map((l, k) => ({
          nombre: l.producto.nombre, dosis: l.dosis,
          cantidad: o.derivados.lineas[k].cantidad.valor === null ? null : { valor: o.derivados.lineas[k].cantidad.valor * parte, unidad: o.derivados.lineas[k].cantidad.unidad }
        }))
        const nutrientes = Object.fromEntries(fert.NUTRIENTES.map(n => [n, o.derivados.totales[n].valor === null ? null : o.derivados.totales[n].valor * parte]))
        filas.push({ operacionId: o._id, version: o.version, fecha: o.fechaEfectiva, tipo: TIPOS[o.tipo], recinto: i.refTexto, cultivo: i.especie, superficieEjecutada: { valor: i.superficie.valor, unidad: 'm2', metodo: i.superficie.metodo }, productos, nutrientes, ejecutor: o.ejecutor?.nombre, pendientes: o.pendientes.length })
        totales.superficieEjecutada += i.superficie.valor
        for (const n of fert.NUTRIENTES) {
          if (nutrientes[n] === null) totales.desconocidos.push(`${n} en el parte del ${o.fechaEfectiva}`)
          else totales[n] += nutrientes[n]
        }
      }
    }
    // Tratamientos fitosanitarios: una fila por parte y producto, con su ámbito (superficie, lote o instalación)
    const tratamientos = []
    for (const o of confirmados.filter(x => x.tipo === 'fitosanitario')) {
      const st = fito.SUBTIPOS[o.fito.subtipo]
      const donde = st.ambito === 'superficie' ? o.imputaciones.map(i => `${i.especie} · ${i.refTexto}`).join(' + ')
        : st.ambito === 'lote' ? [o.fito.lote?.descripcion, o.fito.lote?.identificador].filter(Boolean).join(' · ')
          : o.fito.instalacion?.nombre
      o.lineas.forEach((l, k) => tratamientos.push({
        operacionId: o._id, version: o.version, fecha: o.fechaEfectiva, hora: o.fito.hora, subtipo: st.label, ambito: st.ambito, donde,
        superficieTratada: o.derivados?.superficieTratada || null, lote: o.fito.lote?.cantidad || null,
        problema: o.fito.problema, justificacion: o.fito.justificacion, producto: l.producto.nombre, registro: l.producto.registro,
        dosis: l.dosis, cantidad: o.derivados?.lineas?.[k]?.cantidad || null,
        aplicador: o.fito.aplicador, equipo: o.fito.equipo, asesor: o.fito.asesor, evaluacion: o.fito.evaluacion, pendientes: o.pendientes.length
      }))
    }
    const hoy = now().toISOString().slice(0, 10)
    const bandeja = ops.flatMap(o => [
      ...(o.tipo === 'fitosanitario' && o.fito?.evaluacion?.programada && !o.fito.evaluacion.realizada && o.fito.evaluacion.programada <= hoy
        ? [{ operacionId: o._id, tipo: 'vencimiento', texto: `Evaluar la eficacia del tratamiento del ${o.fechaEfectiva} (prevista el ${o.fito.evaluacion.programada})` }] : []),
      ...(o.estado === 'borrador' ? [{ operacionId: o._id, tipo: 'borrador', texto: `Parte de ${TIPOS[o.tipo].toLowerCase()} sin confirmar (${o.fechaEfectiva || 'sin fecha'})` }] : []),
      ...o.pendientes.map(p => ({ operacionId: o._id, tipo: 'pendiente', campo: p.campo, texto: p.motivo })),
      ...o.incidencias.map(x => ({ operacionId: o._id, tipo: 'incidencia', codigo: x.codigo, texto: x.texto, regla: x.regla })),
      ...(o.conflictos || []).map(x => ({ operacionId: o._id, tipo: 'conflicto', texto: 'Dos dispositivos cambiaron este parte: elige la versión buena' }))
    ])
    return {
      explotacion: { id: explotacion._id, nombre: explotacion.nombre, titular: explotacion.titular },
      campaña: camp, generado: now().toISOString(), version: confirmados.map(o => `${o._id}@${o.version}`),
      filas, totales, tratamientos, bandeja,
      ambito: 'Partes confirmados de abonado y de tratamientos fitosanitarios. El resto de labores (siembra, riego, cosecha…) aún no se registran en esta versión.'
    }
  }

  return {
    crearExplotacion, listarExplotaciones, ponerMiembro, quitarMiembro, guardarRecinto, listarRecintos, editarRecinto, crearFinca, listarFincas,
    crearCultivo, listarCultivos, crearOperacion, rectificarOperacion, registrarEvaluacion, listarOperaciones, obtenerOperacion, cuaderno,
    ROLES, PERMISOS
  }
}

module.exports = { createService, refTexto }
