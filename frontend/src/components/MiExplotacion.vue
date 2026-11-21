<template>
  <!-- «Mi explotación»: área privada dentro de la cartografía agrícola. Cuenta propia (sin credenciales de la Junta),
       explotación, recintos guardados, cultivos de campaña, partes de abonado y cuaderno. API: utils/cuaderno.js -->
  <section class="mx" aria-labelledby="mx-title">
    <header class="mx-head">
      <h3 id="mx-title">🔒 Mi explotación</h3>
      <button v-if="sesion.usuario" type="button" class="mx-link" @click="salir">Salir</button>
    </header>

    <p v-if="error" class="mx-error" role="alert">{{ error }}</p>

    <!-- Sin cuenta: entrar o crearla -->
    <form v-if="!sesion.usuario" class="mx-form" @submit.prevent="enviarCuenta">
      <p class="mx-hint">Tu cuaderno de campo, privado: guarda tus recintos, tus cultivos y lo que haces en ellos. No hace falta ninguna credencial de la Junta.</p>
      <div class="mx-seg" role="tablist">
        <button type="button" role="tab" :aria-selected="String(modoCuenta === 'entrar')" @click="modoCuenta = 'entrar'">Entrar</button>
        <button type="button" role="tab" :aria-selected="String(modoCuenta === 'registro')" @click="modoCuenta = 'registro'">Crear cuenta</button>
      </div>
      <label v-if="modoCuenta === 'registro'">Nombre <input id="mx-nombre" v-model.trim="cuentaForm.nombre" autocomplete="name" /></label>
      <label>Correo <input id="mx-email" v-model.trim="cuentaForm.email" type="email" required autocomplete="email" /></label>
      <label>Contraseña <input id="mx-pass" v-model="cuentaForm.password" type="password" required :minlength="modoCuenta === 'registro' ? 10 : null" :autocomplete="modoCuenta === 'registro' ? 'new-password' : 'current-password'" /></label>
      <p v-if="modoCuenta === 'registro'" class="mx-hint">Al menos 10 caracteres.</p>
      <button type="submit" class="mx-btn" :disabled="ocupado">{{ modoCuenta === 'registro' ? 'Crear cuenta' : 'Entrar' }}</button>
    </form>

    <template v-else>
      <!-- Explotación -->
      <div v-if="!explotaciones.length" class="mx-form">
        <p class="mx-hint">Hola, {{ sesion.usuario.nombre }}. Crea tu explotación para empezar.</p>
        <label>Nombre de la explotación <input id="mx-expl" v-model.trim="nuevaExplotacion" placeholder="Explotación de…" /></label>
        <button type="button" class="mx-btn" :disabled="!nuevaExplotacion || ocupado" @click="crearExplotacion">Crear explotación</button>
      </div>
      <template v-else>
        <label v-if="explotaciones.length > 1" class="mx-inline">Explotación
          <select id="mx-sel-expl" v-model="explotacionId" @change="cargarTodo">
            <option v-for="e in explotaciones" :key="e._id" :value="e._id">{{ e.nombre }}</option>
          </select>
        </label>
        <p v-else class="mx-sub">{{ explotacion?.nombre }} · {{ (explotacion?.misRoles || []).join(', ') }}</p>

        <!-- Partes guardados en el teléfono que aún no han llegado al servidor -->
        <p v-if="enCola.length" class="mx-queue" role="status">
          📶 {{ enCola.length }} {{ enCola.length === 1 ? 'parte guardado' : 'partes guardados' }} en este teléfono, pendiente{{ enCola.length === 1 ? '' : 's' }} de enviar.
          <button type="button" class="mx-link" @click="reintentar">Enviar ahora</button>
          <span v-for="q in enCola.filter(x => x.error)" :key="q.id" class="mx-error-inline">· {{ q.error }}</span>
        </p>

        <div class="mx-tabs" role="tablist" aria-label="Secciones de mi explotación">
          <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-selected="String(tab === t.id)" @click="abrirTab(t.id)">{{ t.label }}</button>
        </div>

        <!-- Recintos -->
        <div v-if="tab === 'recintos'" class="mx-pane">
          <button v-if="seleccion && !seleccionGuardada" type="button" class="mx-btn" :disabled="ocupado" @click="guardarSeleccion">
            ⭐ Guardar el recinto {{ seleccion.properties.pol }}/{{ seleccion.properties.par }}/{{ seleccion.properties.rec }}
          </button>
          <p v-else-if="!recintos.length" class="mx-hint">Toca un recinto en el mapa (o usa «Estoy aquí») y guárdalo en tu explotación.</p>
          <ul class="mx-list">
            <li v-for="r in recintos" :key="r._id">
              <button type="button" class="mx-row" @click="$emit('verRecinto', r)">
                <strong>{{ r.alias || `${r.ref.pol}/${r.ref.par}/${r.ref.rec}` }}</strong>
                <small>{{ r.refTexto }} · {{ r.uso.codigo }} · {{ ha(r.superficieOficial.valor) }} <span class="mx-tag" :title="PROCEDENCIA.oficial.title">SIGPAC {{ r.campaña }}</span></small>
              </button>
            </li>
          </ul>
        </div>

        <!-- Cultivos -->
        <div v-if="tab === 'cultivos'" class="mx-pane">
          <label class="mx-inline">Campaña <input id="mx-camp" v-model.number="campaña" type="number" min="2000" max="2100" @change="cargarCultivos" /></label>
          <ul class="mx-list">
            <li v-for="c in cultivos" :key="c._id" class="mx-card">
              <strong>{{ c.especie }}<template v-if="c.variedad"> · {{ c.variedad }}</template></strong>
              <small>{{ c.regimen === 'regadio' ? 'Regadío' : 'Secano' }}<template v-if="c.fechaInicio"> · desde {{ c.fechaInicio }}</template><template v-if="c.fechaFin"> hasta {{ c.fechaFin }}</template></small>
              <small v-for="u in c.unidades" :key="u.recintoId">{{ u.refTexto }}: {{ ha(u.superficie.valor) }} ({{ u.superficie.metodo === 'completa' ? 'recinto completo' : 'declarada' }})</small>
            </li>
          </ul>
          <p v-if="!cultivos.length" class="mx-hint">Sin cultivos en la campaña {{ campaña }}.</p>
          <details class="mx-new" :open="!cultivos.length && recintos.length > 0">
            <summary>+ Nuevo cultivo</summary>
            <form class="mx-form" @submit.prevent="crearCultivo">
              <label>Cultivo <input id="mx-esp" v-model.trim="cultivoForm.especie" list="mx-especies" required placeholder="Trigo blando" /></label>
              <datalist id="mx-especies"><option v-for="e in ESPECIES" :key="e" :value="e" /></datalist>
              <label>Variedad (opcional) <input id="mx-var" v-model.trim="cultivoForm.variedad" /></label>
              <label>Régimen <select id="mx-reg" v-model="cultivoForm.regimen"><option value="secano">Secano</option><option value="regadio">Regadío</option></select></label>
              <div class="mx-two">
                <label>Siembra <input id="mx-ini" v-model="cultivoForm.fechaInicio" type="date" /></label>
                <label>Fin <input id="mx-fin" v-model="cultivoForm.fechaFin" type="date" /></label>
              </div>
              <fieldset class="mx-fs">
                <legend>En qué recintos</legend>
                <p v-if="!recintos.length" class="mx-hint">Primero guarda algún recinto.</p>
                <div v-for="r in recintos" :key="r._id" class="mx-unit">
                  <label class="mx-check"><input v-model="cultivoForm.recintos" type="checkbox" :value="r._id" /> {{ r.alias || r.refTexto }} ({{ ha(r.superficieOficial.valor) }})</label>
                  <label v-if="cultivoForm.recintos.includes(r._id)" class="mx-inline small">Superficie
                    <input v-model="cultivoForm.parcial[r._id]" type="number" step="0.0001" min="0" :placeholder="`entero: ${(r.superficieOficial.valor / 10000).toFixed(4)}`" /> ha
                  </label>
                </div>
              </fieldset>
              <button type="submit" class="mx-btn" :disabled="ocupado || !cultivoForm.recintos.length">Guardar cultivo</button>
            </form>
          </details>
        </div>

        <!-- Partes -->
        <div v-if="tab === 'partes'" class="mx-pane">
          <template v-if="!parteAbierto && !formParte">
            <button type="button" class="mx-btn" :disabled="!cultivosCampaña.length" @click="nuevoParte">+ Parte de abonado</button>
            <p v-if="!cultivosCampaña.length" class="mx-hint">Para registrar un abonado, da de alta antes el cultivo de la campaña {{ campaña }}.</p>
            <ul class="mx-list">
              <li v-for="o in operaciones" :key="o._id">
                <button type="button" class="mx-row" @click="abrirParte(o._id)">
                  <strong>{{ o.fechaEfectiva || 'Sin fecha' }} · Abonado <span class="mx-tag" :class="o.estado">{{ o.estado }}</span></strong>
                  <small>{{ o.imputaciones.map(i => `${i.especie} ${i.refTexto}`).join(' · ') }} · {{ ha(o.derivados?.superficieEjecutada?.valor) }}<template v-if="o.pendientes.length"> · {{ o.pendientes.length }} pendiente(s)</template></small>
                </button>
              </li>
            </ul>
          </template>

          <!-- Nuevo parte de abonado -->
          <form v-if="formParte" class="mx-form" @submit.prevent="revisarParte">
            <h4>Parte de abonado</h4>
            <label>Fecha en que se hizo <input id="mx-pf" v-model="parteForm.fechaEfectiva" type="date" required /></label>
            <label>Cultivo
              <select id="mx-pc" v-model="parteForm.cultivoId" required>
                <option v-for="c in cultivosCampaña" :key="c._id" :value="c._id">{{ c.especie }} · {{ c.unidades.map(u => u.refTexto).join(', ') }}</option>
              </select>
            </label>
            <fieldset v-if="cultivoParte" class="mx-fs">
              <legend>Dónde (superficie realmente abonada)</legend>
              <div v-for="u in cultivoParte.unidades" :key="u.recintoId" class="mx-unit">
                <label class="mx-check"><input v-model="parteForm.recintos" type="checkbox" :value="u.recintoId" /> {{ u.refTexto }} ({{ ha(u.superficie.valor) }})</label>
                <label v-if="parteForm.recintos.includes(u.recintoId)" class="mx-inline small">Abonado
                  <input v-model="parteForm.parcial[u.recintoId]" type="number" step="0.0001" min="0" :placeholder="`todo: ${(u.superficie.valor / 10000).toFixed(4)}`" /> ha
                </label>
              </div>
            </fieldset>
            <fieldset class="mx-fs">
              <legend>Producto</legend>
              <label>Nombre <input id="mx-prod" v-model.trim="parteForm.producto.nombre" required placeholder="NPK 15-15-15" /></label>
              <label>Tipo <select id="mx-ptipo" v-model="parteForm.producto.tipo"><option value="mineral">Mineral</option><option value="organico">Orgánico</option><option value="organomineral">Organomineral</option><option value="enmienda">Enmienda</option></select></label>
              <p class="mx-hint">Riqueza (% en peso, de la etiqueta). Vacío = desconocido, no cero.</p>
              <div class="mx-three">
                <label>N <input v-model="parteForm.producto.composicion.N" type="number" step="0.01" min="0" max="100" /></label>
                <label>P₂O₅ <input v-model="parteForm.producto.composicion.P2O5" type="number" step="0.01" min="0" max="100" /></label>
                <label>K₂O <input v-model="parteForm.producto.composicion.K2O" type="number" step="0.01" min="0" max="100" /></label>
              </div>
              <div class="mx-two">
                <label>Dosis <input id="mx-dosis" v-model="parteForm.dosis.valor" type="number" step="0.01" min="0" required /></label>
                <label>Unidad <select id="mx-unidad" v-model="parteForm.dosis.unidad"><option v-for="u in UNIDADES_DOSIS" :key="u" :value="u">{{ u }}</option></select></label>
              </div>
              <label v-if="/L|m3/.test(parteForm.dosis.unidad)">Densidad (kg/L) <input v-model="parteForm.producto.densidad" type="number" step="0.001" min="0" placeholder="necesaria para pasar a kilos" /></label>
            </fieldset>
            <label>Quién lo hizo <input id="mx-ejec" v-model.trim="parteForm.ejecutor" required /></label>
            <label>Observaciones <textarea v-model="parteForm.observaciones" rows="2"></textarea></label>
            <div class="mx-actions">
              <button type="button" class="mx-btn ghost" @click="formParte = false">Cancelar</button>
              <button type="button" class="mx-btn ghost" :disabled="ocupado" @click="guardarParteForm('borrador')">Guardar borrador</button>
              <button type="submit" class="mx-btn">Revisar y confirmar</button>
            </div>
          </form>

          <!-- Resumen antes de confirmar -->
          <dialog ref="resumenDlg" class="mx-dialog" aria-labelledby="mx-res-title" @keydown.stop>
            <h4 id="mx-res-title">¿Lo confirmas?</h4>
            <dl v-if="resumen" class="mx-dl">
              <div><dt>Cultivo</dt><dd>{{ resumen.cultivo }}</dd></div>
              <div><dt>Dónde</dt><dd>{{ resumen.donde }}</dd></div>
              <div><dt>Fecha</dt><dd>{{ resumen.fecha }}</dd></div>
              <div><dt>Producto</dt><dd>{{ resumen.producto }}</dd></div>
              <div><dt>Dosis</dt><dd>{{ resumen.dosis }}</dd></div>
              <div><dt>Superficie</dt><dd>{{ resumen.superficie }}</dd></div>
              <div><dt>Cantidad</dt><dd>{{ resumen.cantidad }}</dd></div>
              <div><dt>Quién</dt><dd>{{ resumen.ejecutor }}</dd></div>
            </dl>
            <div class="mx-actions">
              <button type="button" class="mx-btn ghost" @click="resumenDlg.close()">Corregir</button>
              <button type="button" class="mx-btn" :disabled="ocupado" @click="guardarParteForm('confirmado')">Confirmar</button>
            </div>
          </dialog>

          <!-- Ficha de un parte -->
          <article v-if="parteAbierto" class="mx-parte">
            <button type="button" class="mx-link" @click="parteAbierto = null">← Partes</button>
            <h4>Abonado del {{ parteAbierto.fechaEfectiva || '(sin fecha)' }} <span class="mx-tag" :class="parteAbierto.estado">{{ parteAbierto.estado }}</span></h4>
            <p class="mx-sub">Versión {{ parteAbierto.version }} · registrado {{ parteAbierto.fechaRegistro.slice(0, 10) }} · {{ parteAbierto.ejecutor?.nombre || 'sin responsable' }} · {{ OFICIAL[parteAbierto.oficial?.estado] || parteAbierto.oficial?.estado }}</p>
            <h5>Dónde</h5>
            <ul class="mx-facts">
              <li v-for="i in parteAbierto.imputaciones" :key="i.recintoId + i.cultivoId">
                {{ i.especie }} · {{ i.refTexto }}: <strong>{{ ha(i.superficie.valor, 4) }}</strong>
                <span class="mx-tag" :title="PROCEDENCIA[i.superficie.procedencia]?.title">{{ PROCEDENCIA[i.superficie.procedencia]?.label }}</span>
                <small>({{ METODO[i.superficie.metodo] }})</small>
              </li>
              <li>Total ejecutado: <strong>{{ ha(parteAbierto.derivados?.superficieEjecutada?.valor, 4) }}</strong> <span class="mx-tag">Calculado</span></li>
            </ul>
            <h5>Productos</h5>
            <ul class="mx-facts">
              <li v-for="(l, k) in parteAbierto.lineas" :key="k">
                <strong>{{ l.producto.nombre }}</strong> a {{ l.dosis.valor }} {{ l.dosis.unidad }} → <strong>{{ cantidadTexto(parteAbierto.derivados.lineas[k]) }}</strong> <span class="mx-tag">Calculado</span>
                <small>Riqueza N {{ pct(l.producto.composicion.N) }} · P₂O₅ {{ pct(l.producto.composicion.P2O5) }} · K₂O {{ pct(l.producto.composicion.K2O) }} <span class="mx-tag">Declarado</span></small>
              </li>
            </ul>
            <h5>Nutrientes aportados</h5>
            <ul class="mx-facts">
              <li v-for="n in ['N', 'P2O5', 'K2O']" :key="n">{{ NUT[n] }}: <strong>{{ kg(parteAbierto.derivados?.totales?.[n]?.valor) }}</strong> <span class="mx-tag">Calculado</span></li>
            </ul>
            <template v-if="parteAbierto.pendientes.length">
              <h5>Pendiente</h5>
              <ul class="mx-facts warn"><li v-for="p in parteAbierto.pendientes" :key="p.campo">{{ p.motivo }}</li></ul>
            </template>
            <template v-if="parteAbierto.incidencias.length">
              <h5>Incidencias</h5>
              <ul class="mx-facts warn"><li v-for="x in parteAbierto.incidencias" :key="x.codigo + x.texto">{{ x.texto }}<template v-if="x.regla"> (regla {{ x.regla.id }}: {{ x.regla.estado }})</template></li></ul>
            </template>
            <p v-if="parteAbierto.rectificaciones?.length" class="mx-sub">Rectificado {{ parteAbierto.rectificaciones.length }} vez/veces: {{ parteAbierto.rectificaciones.map(r => r.motivo).join(' · ') }}</p>
          </article>
        </div>

        <!-- Cuaderno de la campaña -->
        <div v-if="tab === 'cuaderno'" class="mx-pane">
          <label class="mx-inline">Campaña <input v-model.number="campaña" type="number" min="2000" max="2100" @change="cargarCuaderno" /></label>
          <template v-if="cuadernoData">
            <div class="mx-scroll">
              <table class="mx-table">
                <thead><tr><th>Fecha</th><th>Recinto</th><th>Cultivo</th><th>ha</th><th>Producto</th><th>Cantidad</th><th>N</th><th>P₂O₅</th><th>K₂O</th></tr></thead>
                <tbody>
                  <tr v-for="(f, i) in cuadernoData.filas" :key="i" @click="tab = 'partes'; abrirParte(f.operacionId)">
                    <td>{{ f.fecha }}</td><td>{{ f.recinto }}</td><td>{{ f.cultivo }}</td><td>{{ num(f.superficieEjecutada.valor / 10000, 4) }}</td>
                    <td>{{ f.productos.map(p => p.nombre).join(', ') }}</td><td>{{ f.productos.map(p => p.cantidad ? `${num(p.cantidad.valor, 1)} ${p.cantidad.unidad}` : '—').join(', ') }}</td>
                    <td>{{ num(f.nutrientes.N, 1) }}</td><td>{{ num(f.nutrientes.P2O5, 1) }}</td><td>{{ num(f.nutrientes.K2O, 1) }}</td>
                  </tr>
                  <tr v-if="!cuadernoData.filas.length"><td colspan="9">Sin partes confirmados en esta campaña.</td></tr>
                </tbody>
                <tfoot><tr><th colspan="3">Total confirmado</th><th>{{ num(cuadernoData.totales.superficieEjecutada / 10000, 4) }}</th><th colspan="2"></th><th>{{ num(cuadernoData.totales.N, 1) }}</th><th>{{ num(cuadernoData.totales.P2O5, 1) }}</th><th>{{ num(cuadernoData.totales.K2O, 1) }}</th></tr></tfoot>
              </table>
            </div>
            <p class="mx-sub">{{ cuadernoData.ambito }}</p>
            <a class="mx-btn ghost" :href="csvUrl" download>⬇️ Descargar hoja de cálculo (CSV)</a>
            <h5>Bandeja: pendiente de revisar ({{ cuadernoData.bandeja.length }})</h5>
            <ul class="mx-facts warn">
              <li v-for="(b, i) in cuadernoData.bandeja" :key="i"><button type="button" class="mx-link" @click="tab = 'partes'; abrirParte(b.operacionId)">{{ b.texto }}</button></li>
              <li v-if="!cuadernoData.bandeja.length" class="ok">Nada pendiente.</li>
            </ul>
          </template>
        </div>
      </template>
    </template>
  </section>
</template>

<script>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { api, sesion, comprobarSesion, cola, cargarCola, guardarParte, sincronizar, nuevoId, ha, kg, PROCEDENCIA, UNIDADES_DOSIS } from '@/utils/cuaderno'

const TABS = [{ id: 'recintos', label: 'Recintos' }, { id: 'cultivos', label: 'Cultivos' }, { id: 'partes', label: 'Partes' }, { id: 'cuaderno', label: 'Cuaderno' }]
const ESPECIES = ['Trigo blando', 'Trigo duro', 'Cebada', 'Avena', 'Centeno', 'Triticale', 'Maíz', 'Girasol', 'Colza', 'Guisante', 'Veza', 'Lenteja', 'Garbanzo', 'Alfalfa', 'Remolacha', 'Patata', 'Barbecho', 'Pradera']
const METODO = { completa: 'recinto completo', declarada: 'superficie declarada', croquis: 'croquis en el mapa' }
const NUT = { N: 'Nitrógeno (N)', P2O5: 'Fósforo (P₂O₅)', K2O: 'Potasio (K₂O)' }
const OFICIAL = { sin_enviar: 'sin enviar a la Junta', pendiente: 'envío pendiente', aceptado: 'aceptado por la Junta', rechazado: 'rechazado', por_rectificar: 'rectificación pendiente de tramitar' }
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const LS_EXPL = 'cuaderno-explotacion'

export default {
  name: 'MiExplotacion',
  props: {
    ine: { type: String, required: true },
    campañaSigpac: { type: Number, default: () => new Date().getFullYear() },
    seleccion: { type: Object, default: null }, // recinto del visor (feature) seleccionado
    abrirParteId: { type: String, default: null }
  },
  emits: ['verRecinto', 'guardados'],
  setup(props, { emit }) {
    const error = ref('')
    const ocupado = ref(false)
    const modoCuenta = ref('entrar')
    const cuentaForm = reactive({ nombre: '', email: '', password: '' })
    const explotaciones = ref([])
    const explotacionId = ref(null)
    const nuevaExplotacion = ref('')
    const tab = ref('recintos')
    const recintos = ref([])
    const cultivos = ref([])
    const operaciones = ref([])
    const campaña = ref(props.campañaSigpac)
    const cuadernoData = ref(null)
    const parteAbierto = ref(null)
    const formParte = ref(false)
    const resumenDlg = ref(null)
    const resumen = ref(null)

    const explotacion = computed(() => explotaciones.value.find(e => e._id === explotacionId.value))
    const enCola = computed(() => cola.items.filter(x => x.explotacionId === explotacionId.value))
    const cultivosCampaña = computed(() => cultivos.value.filter(c => c.campaña === campaña.value))
    const refDe = (p) => `${p.agr}-${p.zona}-${p.pol}-${p.par}-${p.rec}`
    const seleccionGuardada = computed(() => props.seleccion && recintos.value.some(r => r.ine === props.ine && refDe(r.ref) === refDe(props.seleccion.properties)))
    const csvUrl = computed(() => api.csvUrl(explotacionId.value, campaña.value))

    const run = async (fn) => {
      error.value = ''
      ocupado.value = true
      try { return await fn() } catch (e) { error.value = e.status === 0 ? 'Sin conexión: inténtalo cuando tengas cobertura.' : e.message } finally { ocupado.value = false }
    }

    // ---------- Cuenta y explotación ----------
    async function enviarCuenta() {
      await run(async () => {
        const r = modoCuenta.value === 'registro' ? await api.registrar(cuentaForm) : await api.entrar(cuentaForm)
        sesion.usuario = r.usuario
        cuentaForm.password = ''
        await cargarExplotaciones()
      })
    }
    async function salir() {
      await run(async () => { await api.salir(); sesion.usuario = null; explotaciones.value = []; cargarCola(null) })
    }
    async function cargarExplotaciones() {
      explotaciones.value = await api.explotaciones()
      let saved = null
      try { saved = localStorage.getItem(LS_EXPL) } catch { /* sin almacenamiento */ }
      explotacionId.value = explotaciones.value.find(e => e._id === saved)?._id || explotaciones.value[0]?._id || null
      cargarCola(sesion.usuario?.id)
      if (explotacionId.value) await cargarTodo()
    }
    async function crearExplotacion() {
      await run(async () => {
        const e = await api.crearExplotacion({ nombre: nuevaExplotacion.value })
        nuevaExplotacion.value = ''
        explotaciones.value = await api.explotaciones()
        explotacionId.value = e._id
        await cargarTodo()
      })
    }
    async function cargarTodo() {
      try { localStorage.setItem(LS_EXPL, explotacionId.value) } catch { /* sin almacenamiento */ }
      await run(async () => {
        const [r, c, o] = await Promise.all([api.recintos(explotacionId.value), api.cultivos(explotacionId.value), api.operaciones(explotacionId.value)])
        recintos.value = r
        cultivos.value = c
        operaciones.value = o
        emit('guardados', r)
        if (tab.value === 'cuaderno') await cargarCuaderno()
      })
    }
    const cargarCultivos = async () => { cultivos.value = await api.cultivos(explotacionId.value).catch(() => cultivos.value) }
    async function cargarCuaderno() {
      await run(async () => { cuadernoData.value = await api.cuaderno(explotacionId.value, campaña.value) })
    }
    function abrirTab(id) {
      tab.value = id
      parteAbierto.value = null
      if (id === 'cuaderno') cargarCuaderno()
    }

    // ---------- Recintos ----------
    async function guardarSeleccion() {
      const p = props.seleccion.properties
      await run(async () => {
        await api.guardarRecinto(explotacionId.value, { ine: props.ine, ref: { agr: p.agr, zona: p.zona, pol: p.pol, par: p.par, rec: p.rec } })
        recintos.value = await api.recintos(explotacionId.value)
        emit('guardados', recintos.value)
      })
    }

    // ---------- Cultivos ----------
    const cultivoForm = reactive({ especie: '', variedad: '', regimen: 'secano', fechaInicio: '', fechaFin: '', recintos: [], parcial: {} })
    async function crearCultivo() {
      await run(async () => {
        await api.crearCultivo(explotacionId.value, {
          campaña: campaña.value, especie: cultivoForm.especie, variedad: cultivoForm.variedad || null, regimen: cultivoForm.regimen,
          fechaInicio: cultivoForm.fechaInicio || null, fechaFin: cultivoForm.fechaFin || null,
          unidades: cultivoForm.recintos.map(id => {
            const v = Number(cultivoForm.parcial[id])
            return v > 0 ? { recintoId: id, superficie: { metodo: 'declarada', valor: v * 10000 } } : { recintoId: id }
          })
        })
        Object.assign(cultivoForm, { especie: '', variedad: '', fechaInicio: '', fechaFin: '', recintos: [], parcial: {} })
        cultivos.value = await api.cultivos(explotacionId.value)
      })
    }

    // ---------- Partes ----------
    const parteForm = reactive({})
    function nuevoParte() {
      const c = cultivosCampaña.value[0]
      Object.assign(parteForm, {
        id: nuevoId(), fechaEfectiva: today(), cultivoId: c?._id || null, recintos: c ? c.unidades.map(u => u.recintoId) : [], parcial: {},
        producto: { nombre: '', tipo: 'mineral', composicion: { N: '', P2O5: '', K2O: '' }, densidad: '' },
        dosis: { valor: '', unidad: 'kg/ha' }, ejecutor: sesion.usuario?.nombre || '', observaciones: ''
      })
      formParte.value = true
      parteAbierto.value = null
    }
    const cultivoParte = computed(() => cultivos.value.find(c => c._id === parteForm.cultivoId))
    watch(() => parteForm.cultivoId, () => { if (cultivoParte.value) parteForm.recintos = cultivoParte.value.unidades.map(u => u.recintoId) })

    const supDe = (u) => (Number(parteForm.parcial[u.recintoId]) > 0 ? Number(parteForm.parcial[u.recintoId]) * 10000 : u.superficie.valor)
    function parteBody(estado) {
      const unidades = (cultivoParte.value?.unidades || []).filter(u => parteForm.recintos.includes(u.recintoId))
      return {
        id: parteForm.id, tipo: 'abonado', estado, fechaEfectiva: parteForm.fechaEfectiva,
        ejecutor: { nombre: parteForm.ejecutor },
        imputaciones: unidades.map(u => (Number(parteForm.parcial[u.recintoId]) > 0
          ? { cultivoId: parteForm.cultivoId, recintoId: u.recintoId, superficie: { metodo: 'declarada', valor: Number(parteForm.parcial[u.recintoId]) * 10000 } }
          : { cultivoId: parteForm.cultivoId, recintoId: u.recintoId })),
        lineas: [{
          producto: {
            nombre: parteForm.producto.nombre, tipo: parteForm.producto.tipo, composicion: { ...parteForm.producto.composicion },
            densidad: parteForm.producto.densidad ? { valor: Number(parteForm.producto.densidad), unidad: 'kg/L' } : null
          },
          dosis: { valor: Number(parteForm.dosis.valor), unidad: parteForm.dosis.unidad }
        }],
        observaciones: parteForm.observaciones || null,
        dispositivo: navigator.userAgent.slice(0, 80)
      }
    }
    // Resumen breve antes de confirmar: finca, cultivo, fecha, producto, dosis y superficie
    function revisarParte() {
      const unidades = (cultivoParte.value?.unidades || []).filter(u => parteForm.recintos.includes(u.recintoId))
      if (!unidades.length) { error.value = 'Marca al menos un recinto'; return }
      const sup = unidades.reduce((s, u) => s + supDe(u), 0)
      const porHa = /\/ha$/.test(parteForm.dosis.unidad)
      const cant = Number(parteForm.dosis.valor) * (porHa ? sup / 10000 : 1)
      resumen.value = {
        cultivo: cultivoParte.value.especie,
        donde: unidades.map(u => u.refTexto).join(', '),
        fecha: parteForm.fechaEfectiva,
        producto: parteForm.producto.nombre,
        dosis: `${parteForm.dosis.valor} ${parteForm.dosis.unidad}`,
        superficie: ha(sup, 4),
        cantidad: `${cant.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${parteForm.dosis.unidad.replace('/ha', '')}`,
        ejecutor: parteForm.ejecutor
      }
      resumenDlg.value.showModal()
    }
    async function guardarParteForm(estado) {
      resumenDlg.value?.open && resumenDlg.value.close()
      await run(async () => {
        const r = await guardarParte(sesion.usuario.id, explotacionId.value, parteBody(estado))
        formParte.value = false
        if (r.estado === 'guardado') {
          operaciones.value = await api.operaciones(explotacionId.value)
          parteAbierto.value = r.operacion
        } else if (r.estado === 'pendiente') {
          error.value = 'Sin conexión: el parte queda guardado en este teléfono y se enviará solo cuando vuelva la red.'
        } else {
          error.value = `No se ha podido guardar: ${r.error}`
        }
      })
    }
    async function abrirParte(id) {
      formParte.value = false
      await run(async () => { parteAbierto.value = await api.operacion(explotacionId.value, id) })
    }
    async function reintentar() {
      await sincronizar(sesion.usuario?.id)
      operaciones.value = await api.operaciones(explotacionId.value).catch(() => operaciones.value)
    }
    const onOnline = () => reintentar()

    const num = (v, d) => (v === null || v === undefined ? '—' : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }))
    const pct = (v) => (v === null || v === undefined ? 'desconocida' : `${v} %`)
    const cantidadTexto = (l) => (l.cantidad.valor === null ? 'cantidad desconocida' : `${num(l.cantidad.valor, 2)} ${l.cantidad.unidad}${l.masa && l.cantidad.unidad !== 'kg' ? ` (${num(l.masa.valor, 1)} kg)` : ''}`)

    onMounted(async () => {
      window.addEventListener('online', onOnline)
      if (!sesion.comprobada) await comprobarSesion()
      if (sesion.usuario) {
        await cargarExplotaciones()
        await sincronizar(sesion.usuario.id)
        if (props.abrirParteId) { tab.value = 'partes'; await abrirParte(props.abrirParteId) }
      }
    })
    onBeforeUnmount(() => window.removeEventListener('online', onOnline))

    return {
      sesion, error, ocupado, modoCuenta, cuentaForm, explotaciones, explotacionId, explotacion, nuevaExplotacion, tab, recintos, cultivos, operaciones,
      campaña, cuadernoData, parteAbierto, formParte, resumenDlg, resumen, enCola, cultivosCampaña, seleccionGuardada, csvUrl, cultivoForm, parteForm, cultivoParte,
      enviarCuenta, salir, crearExplotacion, cargarTodo, cargarCultivos, cargarCuaderno, abrirTab, guardarSeleccion, crearCultivo, nuevoParte, revisarParte, guardarParteForm, abrirParte, reintentar,
      TABS, ESPECIES, METODO, NUT, OFICIAL, PROCEDENCIA, UNIDADES_DOSIS, ha, kg, num, pct, cantidadTexto
    }
  }
}
</script>

<style scoped>
.mx { display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
.mx-head { display: flex; align-items: center; justify-content: space-between; }
.mx-head h3 { margin: 0; font-size: 15px; }
.mx-sub, .mx-hint { margin: 0; font-size: 12px; color: var(--text-secondary); }
.mx-error { margin: 0; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, #e53935 14%, transparent); color: var(--text-primary); font-size: 13px; }
.mx-error-inline { color: #e53935; }
.mx-queue { margin: 0; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, #f9a825 16%, transparent); font-size: 13px; }
.mx-form { display: flex; flex-direction: column; gap: 8px; }
.mx-form h4, .mx-parte h4 { margin: 0; font-size: 15px; }
.mx label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.mx input, .mx select, .mx textarea { width: 100%; box-sizing: border-box; padding: 7px 9px; border: 1px solid var(--border-primary); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font: inherit; font-weight: 400; }
.mx :is(input, select, textarea):focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
.mx .mx-inline { flex-direction: row; align-items: center; gap: 8px; }
.mx .mx-inline input, .mx .mx-inline select { width: auto; flex: 1; min-width: 0; }
.mx .mx-inline.small { font-weight: 400; padding-left: 22px; }
.mx .mx-check { flex-direction: row; align-items: center; gap: 6px; font-weight: 400; color: var(--text-primary); }
.mx .mx-check input { width: auto; }
.mx-two, .mx-three { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
.mx-three { grid-template-columns: 1fr 1fr 1fr; }
.mx-fs { margin: 0; padding: 8px 10px; border: 1px solid var(--border-primary); border-radius: 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.mx-fs legend { padding: 0 4px; font-size: 12px; font-weight: 700; }
.mx-unit { display: flex; flex-direction: column; gap: 4px; }
.mx-btn { align-self: flex-start; padding: 8px 14px; border: 0; border-radius: 999px; background: var(--primary-color); color: #fff; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none; }
.mx-btn.ghost { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary); }
.mx-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mx-link { padding: 0; border: 0; background: none; color: var(--primary-color); font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; text-align: left; }
.mx-seg, .mx-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: var(--bg-secondary); }
.mx-seg button, .mx-tabs button { flex: 1; padding: 6px 8px; border: 0; border-radius: 999px; background: transparent; color: var(--text-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.mx-seg button[aria-selected='true'], .mx-tabs button[aria-selected='true'] { background: var(--primary-color); color: #fff; font-weight: 700; }
.mx-pane { display: flex; flex-direction: column; gap: 8px; }
.mx-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.mx-row, .mx-card { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 8px 10px; border: 1px solid var(--border-primary); border-radius: 10px; background: var(--bg-secondary); color: var(--text-primary); font: inherit; text-align: left; }
.mx-row { cursor: pointer; }
.mx-row small, .mx-card small { font-size: 12px; color: var(--text-secondary); }
.mx-tag { display: inline-block; padding: 0 6px; border-radius: 6px; background: var(--bg-primary); color: var(--text-secondary); font-size: 11px; font-weight: 600; }
.mx-tag.confirmado { background: color-mix(in srgb, #43a047 22%, transparent); color: var(--text-primary); }
.mx-tag.borrador { background: color-mix(in srgb, #f9a825 22%, transparent); color: var(--text-primary); }
.mx-new summary { cursor: pointer; font-weight: 700; color: var(--primary-color); }
.mx-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.mx-dialog { width: min(100% - 32px, 380px); padding: 16px; border: 1px solid var(--border-primary); border-radius: 14px; background: var(--bg-card, var(--bg-primary)); color: var(--text-primary); }
.mx-dialog:modal { margin: auto; overscroll-behavior: contain; }
.mx-dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
.mx-dialog h4 { margin: 0 0 8px; }
.mx-dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 12px; }
.mx-dl div { display: contents; }
.mx-dl dt { color: var(--text-secondary); }
.mx-dl dd { margin: 0; font-weight: 600; }
.mx-parte { display: flex; flex-direction: column; gap: 6px; }
.mx-parte h5, .mx-pane h5 { margin: 6px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.mx-facts { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
.mx-facts small { display: block; color: var(--text-secondary); }
.mx-facts.warn li { color: var(--text-primary); }
.mx-facts .ok { list-style: none; color: var(--text-secondary); }
.mx-scroll { overflow-x: auto; border: 1px solid var(--border-primary); border-radius: 10px; }
.mx-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.mx-table th, .mx-table td { padding: 6px 8px; border-bottom: 1px solid var(--border-primary); text-align: left; white-space: nowrap; }
.mx-table tbody tr { cursor: pointer; }
.mx-table tbody tr:hover { background: var(--bg-secondary); }
.mx-table tfoot th { font-weight: 700; }
</style>
