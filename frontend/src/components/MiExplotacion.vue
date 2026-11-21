<template>
  <!-- «Mi explotación»: área privada dentro de la cartografía agrícola. Cuenta propia (sin credenciales de la Junta),
       explotación, recintos guardados, cultivos de campaña, partes de abonado y cuaderno. API: utils/cuaderno.js -->
  <section class="mx" aria-labelledby="mx-title">
    <header class="mx-head">
      <h3 id="mx-title">🔒 Mi explotación</h3>
      <button v-if="sesion.usuario" type="button" class="mx-link" @click="salir">Salir</button>
    </header>

    <p v-if="error" class="mx-error" role="alert">{{ error }}</p>

    <!-- Sin cuenta: entrar (huella, Google, Facebook o correo); si no hay cuenta, se crea -->
    <CuentaEntrar v-if="!sesion.usuario" @entrado="alEntrar" />

    <template v-else>
      <div v-if="ofrecerHuella" class="mx-oferta" role="status">
        <p><strong>👆 La próxima vez, entra con la huella</strong><br>Sin contraseñas: con la huella, la cara o el PIN de este teléfono.</p>
        <div class="mx-acciones">
          <button type="button" class="mx-btn" :disabled="ocupado" @click="activarHuella">Activar la huella</button>
          <button type="button" class="mx-link" @click="noHuella">Ahora no</button>
        </div>
      </div>
      <p v-if="sesion.usuario.codigo" class="mx-codigo">Tu código: <strong>{{ codigoBonito(sesion.usuario.codigo) }}</strong>
        <span class="mx-hint">Díselo a quien quiera darte acceso a su explotación.</span></p>
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

          <!-- Fincas: como las llama el agricultor; agrupan recintos (o partes) -->
          <template v-if="recintos.length">
            <h5>Fincas</h5>
            <ul class="mx-list">
              <li v-for="f in fincas" :key="f._id" class="mx-card">
                <strong>{{ f.nombre }}<template v-if="f.alias.length"> ({{ f.alias.join(', ') }})</template></strong>
                <small>{{ f.recintos.map(r => r.refTexto).join(' + ') }} · {{ ha(f.superficie.valor) }}</small>
              </li>
            </ul>
            <details class="mx-new">
              <summary>+ Agrupar recintos en una finca</summary>
              <form class="mx-form" @submit.prevent="crearFinca">
                <label>Nombre <input v-model.trim="fincaForm.nombre" required placeholder="La Hoya" /></label>
                <label>Otros nombres (separados por comas) <input v-model.trim="fincaForm.alias" /></label>
                <fieldset class="mx-fs">
                  <legend>Recintos</legend>
                  <label v-for="r in recintos" :key="r._id" class="mx-check"><input v-model="fincaForm.recintos" type="checkbox" :value="r._id" /> {{ r.alias || r.refTexto }} ({{ ha(r.superficieOficial.valor) }})</label>
                </fieldset>
                <label>Observaciones (accesos, linderos…) <textarea v-model="fincaForm.observaciones" rows="2"></textarea></label>
                <button type="submit" class="mx-btn" :disabled="ocupado || !fincaForm.recintos.length">Guardar finca</button>
              </form>
            </details>
          </template>
        </div>

        <!-- Personas: el titular da acceso (asesor, quien ejecuta, quien confirma) -->
        <div v-if="tab === 'personas'" class="mx-pane">
          <ul class="mx-list">
            <li v-for="m in explotacion?.miembros || []" :key="m.userId" class="mx-card">
              <strong>{{ m.nombre || m.userId }}</strong>
              <small>{{ m.roles.join(', ') }}</small>
              <button v-if="esTitular && m.userId !== sesion.usuario.id" type="button" class="mx-link" @click="quitarMiembro(m.userId)">Quitar el acceso</button>
            </li>
          </ul>
          <form v-if="esTitular" class="mx-form" @submit.prevent="ponerMiembro">
            <p class="mx-hint">La persona tiene que crear antes su cuenta en infoSalamanca. Pídele su código (lo ve arriba, al entrar) o su correo.</p>
            <label>Código o correo <input v-model.trim="miembroForm.email" required autocapitalize="characters" autocomplete="off" placeholder="K7P 3QM o nombre@correo.es" /></label>
            <label>Papel
              <select v-model="miembroForm.rol">
                <option value="asesor">Asesor (ve todo, no registra)</option>
                <option value="ejecutor">Ejecuta (registra partes; no confirma)</option>
                <option value="confirmador">Confirma partes</option>
                <option value="titular">Titular</option>
              </select>
            </label>
            <button type="submit" class="mx-btn" :disabled="ocupado">Dar acceso</button>
          </form>
          <p v-else class="mx-hint">Solo el titular puede dar o quitar accesos.</p>
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
          <template v-if="!parteAbierto && !formParte && !formFito">
            <div class="mx-actions">
              <button type="button" class="mx-btn" :disabled="!cultivosHoy.length && !fincas.length" @click="nuevoParte">+ Abonado</button>
              <button type="button" class="mx-btn" @click="nuevoFito">+ Tratamiento</button>
            </div>
            <p v-if="!cultivosHoy.length && !fincas.length" class="mx-hint">Para registrar un abonado o un tratamiento en campo, da de alta antes el cultivo que hay en el campo. Los tratamientos de semilla, poscosecha e instalaciones no lo necesitan.</p>
            <ul class="mx-list">
              <li v-for="o in operaciones" :key="o._id">
                <button type="button" class="mx-row" @click="abrirParte(o._id)">
                  <strong>{{ o.fechaEfectiva || 'Sin fecha' }} · {{ o.tipo === 'fitosanitario' ? SUBTIPOS_FITO[o.fito?.subtipo] || 'Tratamiento' : 'Abonado' }} <span class="mx-tag" :class="o.estado">{{ o.estado }}</span></strong>
                  <small v-if="o.tipo === 'fitosanitario'">{{ o.fito?.problema || 'sin problema' }} · {{ o.lineas.map(l => l.producto.nombre).join(', ') }}<template v-if="o.pendientes.length"> · {{ o.pendientes.length }} pendiente(s)</template></small>
                  <small v-else>{{ o.imputaciones.map(i => `${i.especie} ${i.refTexto}`).join(' · ') }} · {{ ha(o.derivados?.superficieEjecutada?.valor) }}<template v-if="o.pendientes.length"> · {{ o.pendientes.length }} pendiente(s)</template></small>
                </button>
              </li>
            </ul>
          </template>

          <!-- Nuevo tratamiento fitosanitario: los campos cambian según qué se trata -->
          <form v-if="formFito" class="mx-form" @submit.prevent="guardarFito('confirmado')">
            <h4>Tratamiento fitosanitario</h4>
            <label>Qué se trata
              <select id="mx-fsub" v-model="fitoForm.subtipo">
                <option v-for="(label, k) in SUBTIPOS_FITO" :key="k" :value="k">{{ label }}</option>
              </select>
            </label>
            <div class="mx-two">
              <label>Fecha <input id="mx-ff" v-model="fitoForm.fechaEfectiva" type="date" required /></label>
              <label>Hora (si procede) <input v-model="fitoForm.hora" type="time" /></label>
            </div>
            <template v-if="fitoForm.subtipo === 'campo'"><fieldset class="mx-fs">
              <legend>Dónde (superficie tratada)</legend>
              <div v-if="fincas.length" class="mx-seg mx-donde" role="radiogroup" aria-label="Cómo decir dónde">
                <button type="button" role="radio" :aria-checked="String(fitoForm.donde === 'finca')" @click="fitoForm.donde = 'finca'">En una finca</button>
                <button type="button" role="radio" :aria-checked="String(fitoForm.donde === 'cultivo')" @click="fitoForm.donde = 'cultivo'">Elegir cultivo y recintos</button>
              </div>
              <template v-if="fitoForm.donde === 'finca'">
                <label>Finca
                  <select v-model="fitoForm.fincaId">
                    <option v-for="x in fincas" :key="x._id" :value="x._id">{{ x.nombre }}<template v-if="x.alias?.length"> ({{ x.alias.join(', ') }})</template></option>
                  </select>
                </label>
                <template v-if="previewFinca(fitoForm)">
                  <ul class="mx-preview">
                    <li v-for="(it, k) in previewFinca(fitoForm).items" :key="k">{{ it.especie }} · {{ it.refTexto }}: <strong>{{ ha(it.sup, 4) }}</strong></li>
                  </ul>
                  <p v-for="r in previewFinca(fitoForm).sin" :key="r" class="mx-hint">En {{ r }} no hay cultivo dado de alta ese día: no se anotará.</p>
                  <p v-if="!previewFinca(fitoForm).items.length" class="mx-error-inline">En esa fecha no hay ningún cultivo dado de alta en esta finca. Da de alta el cultivo o elige cultivo y recintos.</p>
                </template>
              </template>
              <template v-else>
              <label>Cultivo
                <select v-model="fitoForm.cultivoId">
                  <option v-for="c in cultivosDelDia(fitoForm)" :key="c._id" :value="c._id">{{ c.especie }} ({{ c.campaña }}) · {{ c.unidades.map(u => u.refTexto).join(', ') }}</option>
                </select>
              </label>
              <template v-if="cultivoFito">
                <div v-for="u in cultivoFito.unidades" :key="u.recintoId" class="mx-unit">
                  <label class="mx-check"><input v-model="fitoForm.recintos" type="checkbox" :value="u.recintoId" /> {{ u.refTexto }} ({{ ha(u.superficie.valor) }})</label>
                  <template v-if="fitoForm.recintos.includes(u.recintoId)">
                    <p v-if="fitoForm.croquis[u.recintoId]" class="mx-inline small mx-croquis">✏️ Zona dibujada: <strong>{{ ha(fitoForm.croquis[u.recintoId].area, 4) }}</strong>
                      <button type="button" class="mx-link" @click="dibujar('fitoForm', u)">Repetir</button>
                      <button type="button" class="mx-link" @click="delete fitoForm.croquis[u.recintoId]">Quitar</button></p>
                    <div v-else class="mx-inline small">
                      <label class="mx-inline small">Tratado
                        <input v-model="fitoForm.parcial[u.recintoId]" type="number" step="0.0001" min="0" :placeholder="`todo: ${(u.superficie.valor / 10000).toFixed(4)}`" /> ha
                      </label>
                      <button type="button" class="mx-link" @click="dibujar('fitoForm', u)">✏️ Dibujar en el mapa</button>
                    </div>
                  </template>
                </div>
              </template>
              </template>
            </fieldset></template>
            <fieldset v-if="fitoForm.subtipo === 'semilla' || fitoForm.subtipo === 'poscosecha'" class="mx-fs">
              <legend>{{ fitoForm.subtipo === 'semilla' ? 'Semilla tratada' : 'Lote tratado' }} (sin superficie)</legend>
              <label>Qué es <input v-model.trim="fitoForm.lote.descripcion" :placeholder="fitoForm.subtipo === 'semilla' ? 'Semilla de trigo' : 'Trigo cosechado en silo 2'" /></label>
              <div class="mx-two">
                <label>Identificador del lote <input v-model.trim="fitoForm.lote.identificador" /></label>
                <label>Cantidad <span class="mx-two inner"><input v-model="fitoForm.lote.cantidad" type="number" step="0.01" min="0" /><select v-model="fitoForm.lote.unidad"><option>kg</option><option>t</option></select></span></label>
              </div>
            </fieldset>
            <fieldset v-if="fitoForm.subtipo === 'instalacion'" class="mx-fs">
              <legend>Instalación (sin superficie)</legend>
              <label>Nombre <input v-model.trim="fitoForm.instalacion.nombre" placeholder="Nave 1" /></label>
              <label>Tipo <input v-model.trim="fitoForm.instalacion.tipo" placeholder="almacén de grano, cámara…" /></label>
            </fieldset>
            <label>Problema (plaga, enfermedad o mala hierba) <input id="mx-fprob" v-model.trim="fitoForm.problema" required /></label>
            <label>Justificación <textarea v-model="fitoForm.justificacion" rows="2" placeholder="Qué se observó, umbral, recomendación…"></textarea></label>
            <fieldset class="mx-fs">
              <legend>Producto</legend>
              <label>Nombre comercial <input id="mx-fprod" v-model.trim="fitoForm.producto.nombre" required /></label>
              <label>Nº de registro <input v-model.trim="fitoForm.producto.registro" placeholder="de la etiqueta" /></label>
              <div class="mx-two">
                <label>Dosis <input id="mx-fdosis" v-model="fitoForm.dosis.valor" type="number" step="0.001" min="0" required /></label>
                <label>Unidad <select v-model="fitoForm.dosis.unidad"><option v-for="u in UNIDADES_FITO[fitoForm.subtipo]" :key="u" :value="u">{{ u }}</option></select></label>
              </div>
            </fieldset>
            <fieldset class="mx-fs">
              <legend>Quién y con qué</legend>
              <div class="mx-two">
                <label>Aplicador <input id="mx-fapl" v-model.trim="fitoForm.aplicador.nombre" required /></label>
                <label>Nº de carné <input v-model.trim="fitoForm.aplicador.carne" /></label>
              </div>
              <div class="mx-two">
                <label>Equipo <input v-model.trim="fitoForm.equipo.nombre" placeholder="Pulverizador…" /></label>
                <label>Inscripción (ROMA) <input v-model.trim="fitoForm.equipo.inscripcion" /></label>
              </div>
              <div class="mx-two">
                <label>Asesor (si lo hay) <input v-model.trim="fitoForm.asesor.nombre" /></label>
                <label>Nº de asesor <input v-model.trim="fitoForm.asesor.numero" /></label>
              </div>
            </fieldset>
            <label>Evaluar la eficacia el (opcional) <input v-model="fitoForm.evaluacion" type="date" /></label>
            <p class="mx-hint">El uso autorizado del producto para este cultivo y fecha no se puede comprobar aquí todavía: quedará como pendiente.</p>
            <div class="mx-actions">
              <button type="button" class="mx-btn ghost" @click="formFito = false">Cancelar</button>
              <button type="button" class="mx-btn ghost" :disabled="ocupado" @click="guardarFito('borrador')">Guardar borrador</button>
              <button type="submit" class="mx-btn" :disabled="ocupado">Confirmar</button>
            </div>
          </form>

          <!-- Nuevo parte de abonado -->
          <form v-if="formParte" class="mx-form" @submit.prevent="revisarParte">
            <h4>Parte de abonado</h4>
            <label>Fecha en que se hizo <input id="mx-pf" v-model="parteForm.fechaEfectiva" type="date" required /></label>
            <fieldset class="mx-fs">
              <legend>Dónde (superficie realmente abonada)</legend>
              <div v-if="fincas.length" class="mx-seg mx-donde" role="radiogroup" aria-label="Cómo decir dónde">
                <button type="button" role="radio" :aria-checked="String(parteForm.donde === 'finca')" @click="parteForm.donde = 'finca'">En una finca</button>
                <button type="button" role="radio" :aria-checked="String(parteForm.donde === 'cultivo')" @click="parteForm.donde = 'cultivo'">Elegir cultivo y recintos</button>
              </div>
              <template v-if="parteForm.donde === 'finca'">
                <label>Finca
                  <select v-model="parteForm.fincaId">
                    <option v-for="x in fincas" :key="x._id" :value="x._id">{{ x.nombre }}<template v-if="x.alias?.length"> ({{ x.alias.join(', ') }})</template></option>
                  </select>
                </label>
                <template v-if="previewFinca(parteForm)">
                  <ul class="mx-preview">
                    <li v-for="(it, k) in previewFinca(parteForm).items" :key="k">{{ it.especie }} · {{ it.refTexto }}: <strong>{{ ha(it.sup, 4) }}</strong></li>
                  </ul>
                  <p v-for="r in previewFinca(parteForm).sin" :key="r" class="mx-hint">En {{ r }} no hay cultivo dado de alta ese día: no se anotará.</p>
                  <p v-if="!previewFinca(parteForm).items.length" class="mx-error-inline">En esa fecha no hay ningún cultivo dado de alta en esta finca. Da de alta el cultivo o elige cultivo y recintos.</p>
                </template>
              </template>
              <template v-else>
              <label>Cultivo
                <select v-model="parteForm.cultivoId">
                  <option v-for="c in cultivosDelDia(parteForm)" :key="c._id" :value="c._id">{{ c.especie }} ({{ c.campaña }}) · {{ c.unidades.map(u => u.refTexto).join(', ') }}</option>
                </select>
              </label>
              <template v-if="cultivoParte">
                <div v-for="u in cultivoParte.unidades" :key="u.recintoId" class="mx-unit">
                  <label class="mx-check"><input v-model="parteForm.recintos" type="checkbox" :value="u.recintoId" /> {{ u.refTexto }} ({{ ha(u.superficie.valor) }})</label>
                  <template v-if="parteForm.recintos.includes(u.recintoId)">
                    <p v-if="parteForm.croquis[u.recintoId]" class="mx-inline small mx-croquis">✏️ Zona dibujada: <strong>{{ ha(parteForm.croquis[u.recintoId].area, 4) }}</strong>
                      <button type="button" class="mx-link" @click="dibujar('parteForm', u)">Repetir</button>
                      <button type="button" class="mx-link" @click="delete parteForm.croquis[u.recintoId]">Quitar</button></p>
                    <div v-else class="mx-inline small">
                      <label class="mx-inline small">Abonado
                        <input v-model="parteForm.parcial[u.recintoId]" type="number" step="0.0001" min="0" :placeholder="`todo: ${(u.superficie.valor / 10000).toFixed(4)}`" /> ha
                      </label>
                      <button type="button" class="mx-link" @click="dibujar('parteForm', u)">✏️ Dibujar en el mapa</button>
                    </div>
                  </template>
                </div>
              </template>
              </template>
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
            <h4>{{ parteAbierto.tipo === 'fitosanitario' ? SUBTIPOS_FITO[parteAbierto.fito?.subtipo] || 'Tratamiento' : 'Abonado' }} del {{ parteAbierto.fechaEfectiva || '(sin fecha)' }}<template v-if="parteAbierto.fito?.hora"> a las {{ parteAbierto.fito.hora }}</template> <span class="mx-tag" :class="parteAbierto.estado">{{ parteAbierto.estado }}</span></h4>
            <p class="mx-sub">Versión {{ parteAbierto.version }} · registrado {{ parteAbierto.fechaRegistro.slice(0, 10) }} · {{ parteAbierto.tipo === 'fitosanitario' ? parteAbierto.fito?.aplicador?.nombre : parteAbierto.ejecutor?.nombre || 'sin responsable' }} · {{ OFICIAL[parteAbierto.oficial?.estado] || parteAbierto.oficial?.estado }}</p>

            <!-- Tratamiento fitosanitario -->
            <template v-if="parteAbierto.tipo === 'fitosanitario'">
              <h5>Qué y dónde</h5>
              <ul class="mx-facts">
                <li>Problema: <strong>{{ parteAbierto.fito.problema || '—' }}</strong><small v-if="parteAbierto.fito.justificacion">{{ parteAbierto.fito.justificacion }}</small></li>
                <li v-for="i in parteAbierto.imputaciones" :key="i.recintoId + i.cultivoId">{{ i.especie }} · {{ i.refTexto }}: <strong>{{ ha(i.superficie.valor, 4) }}</strong> <span class="mx-tag">{{ PROCEDENCIA[i.superficie.procedencia]?.label }}</span></li>
                <li v-if="parteAbierto.fito.lote">Lote: <strong>{{ [parteAbierto.fito.lote.descripcion, parteAbierto.fito.lote.identificador].filter(Boolean).join(' · ') }}</strong><template v-if="parteAbierto.fito.lote.cantidad"> · {{ parteAbierto.fito.lote.cantidad.valor }} {{ parteAbierto.fito.lote.cantidad.unidad }}</template> <small>Sin superficie</small></li>
                <li v-if="parteAbierto.fito.instalacion?.nombre">Instalación: <strong>{{ parteAbierto.fito.instalacion.nombre }}</strong><template v-if="parteAbierto.fito.instalacion.tipo"> ({{ parteAbierto.fito.instalacion.tipo }})</template> <small>Sin superficie</small></li>
              </ul>
              <h5>Productos</h5>
              <ul class="mx-facts">
                <li v-for="(l, k) in parteAbierto.lineas" :key="k">
                  <strong>{{ l.producto.nombre }}</strong><template v-if="l.producto.registro"> (nº {{ l.producto.registro }})</template> a {{ l.dosis.valor }} {{ l.dosis.unidad }} →
                  <strong>{{ parteAbierto.derivados?.lineas?.[k]?.cantidad?.valor !== null && parteAbierto.derivados?.lineas?.[k]?.cantidad?.valor !== undefined ? `${num(parteAbierto.derivados.lineas[k].cantidad.valor, 3)} ${parteAbierto.derivados.lineas[k].cantidad.unidad}` : 'cantidad desconocida' }}</strong> <span class="mx-tag">Calculado</span>
                </li>
              </ul>
              <h5>Quién y con qué</h5>
              <ul class="mx-facts">
                <li>Aplicador: {{ parteAbierto.fito.aplicador?.nombre || '—' }}<template v-if="parteAbierto.fito.aplicador?.carne"> (carné {{ parteAbierto.fito.aplicador.carne }})</template></li>
                <li v-if="parteAbierto.fito.equipo?.nombre">Equipo: {{ parteAbierto.fito.equipo.nombre }}<template v-if="parteAbierto.fito.equipo.inscripcion"> ({{ parteAbierto.fito.equipo.inscripcion }})</template></li>
                <li v-if="parteAbierto.fito.asesor">Asesor: {{ parteAbierto.fito.asesor.nombre }}<template v-if="parteAbierto.fito.asesor.numero"> ({{ parteAbierto.fito.asesor.numero }})</template></li>
              </ul>
              <h5>Eficacia</h5>
              <p v-if="parteAbierto.fito.evaluacion?.realizada" class="mx-sub">{{ parteAbierto.fito.evaluacion.realizada.eficacia }} · {{ parteAbierto.fito.evaluacion.realizada.fecha }}<template v-if="parteAbierto.fito.evaluacion.realizada.observaciones"> · {{ parteAbierto.fito.evaluacion.realizada.observaciones }}</template></p>
              <form v-else class="mx-form" @submit.prevent="evaluar">
                <p v-if="parteAbierto.fito.evaluacion?.programada" class="mx-hint">Prevista el {{ parteAbierto.fito.evaluacion.programada }}.</p>
                <div class="mx-two">
                  <label>Fecha <input v-model="evalForm.fecha" type="date" required /></label>
                  <label>Eficacia <select v-model="evalForm.eficacia"><option value="buena">Buena</option><option value="regular">Regular</option><option value="mala">Mala</option></select></label>
                </div>
                <label>Observaciones <input v-model.trim="evalForm.observaciones" /></label>
                <button type="submit" class="mx-btn ghost" :disabled="ocupado">Registrar la evaluación</button>
              </form>
            </template>

            <template v-else>
            <h5>Dónde</h5>
            <p v-if="parteAbierto.finca" class="mx-hint">En la finca <strong>{{ parteAbierto.finca.nombre }}</strong><template v-if="parteAbierto.finca.sinCultivo?.length">; sin anotar (no había cultivo ese día): {{ parteAbierto.finca.sinCultivo.join(', ') }}</template>.</p>
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
            </template>
            <template v-if="parteAbierto.pendientes.length">
              <h5>Pendiente</h5>
              <ul class="mx-facts warn"><li v-for="p in parteAbierto.pendientes" :key="p.campo">{{ p.motivo }}</li></ul>
            </template>
            <template v-if="parteAbierto.incidencias.length">
              <h5>Incidencias</h5>
              <ul class="mx-facts warn"><li v-for="x in parteAbierto.incidencias" :key="x.codigo + x.texto">{{ x.texto }}<template v-if="x.regla"> (regla {{ x.regla.id }}: {{ x.regla.estado }})</template></li></ul>
            </template>
            <button v-if="parteAbierto.estado === 'borrador' && puedeConfirmar" type="button" class="mx-btn" :disabled="ocupado" @click="confirmarParte">Confirmar el parte</button>
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
            <template v-if="cuadernoData.tratamientos?.length">
              <h5>Tratamientos fitosanitarios</h5>
              <div class="mx-scroll">
                <table class="mx-table">
                  <thead><tr><th>Fecha</th><th>Supuesto</th><th>Dónde</th><th>Problema</th><th>Producto</th><th>Nº reg.</th><th>Dosis</th><th>Cantidad</th><th>Aplicador</th><th>Eficacia</th></tr></thead>
                  <tbody>
                    <tr v-for="(t, i) in cuadernoData.tratamientos" :key="i" @click="tab = 'partes'; abrirParte(t.operacionId)">
                      <td>{{ t.fecha }}</td><td>{{ t.subtipo }}</td><td>{{ t.donde }}<template v-if="t.superficieTratada?.valor"> · {{ num(t.superficieTratada.valor / 10000, 2) }} ha</template></td>
                      <td>{{ t.problema }}</td><td>{{ t.producto }}</td><td>{{ t.registro || '—' }}</td><td>{{ t.dosis.valor }} {{ t.dosis.unidad }}</td>
                      <td>{{ t.cantidad?.valor !== null && t.cantidad?.valor !== undefined ? `${num(t.cantidad.valor, 3)} ${t.cantidad.unidad}` : '—' }}</td>
                      <td>{{ t.aplicador?.nombre }}</td><td>{{ t.evaluacion?.realizada?.eficacia || (t.evaluacion?.programada ? `prevista ${t.evaluacion.programada}` : '—') }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
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
import { api, sesion, comprobarSesion, cola, cargarCola, guardarParte, sincronizar, nuevoId, ha, kg, PROCEDENCIA, UNIDADES_DOSIS, UNIDADES_FITO, SUBTIPOS_FITO } from '@/utils/cuaderno'
import { huellaDisponible, tieneHuellaAqui, huellaDescartada, descartarHuella, crearConHuella, mensajeHuella } from '@/utils/entrar'
import CuentaEntrar from './CuentaEntrar.vue'

const TABS = [{ id: 'recintos', label: 'Recintos' }, { id: 'cultivos', label: 'Cultivos' }, { id: 'partes', label: 'Partes' }, { id: 'cuaderno', label: 'Cuaderno' }, { id: 'personas', label: 'Personas' }]
const ESPECIES = ['Trigo blando', 'Trigo duro', 'Cebada', 'Avena', 'Centeno', 'Triticale', 'Maíz', 'Girasol', 'Colza', 'Guisante', 'Veza', 'Lenteja', 'Garbanzo', 'Alfalfa', 'Remolacha', 'Patata', 'Barbecho', 'Pradera']
const METODO = { completa: 'recinto completo', declarada: 'superficie declarada', croquis: 'croquis en el mapa' }
const NUT = { N: 'Nitrógeno (N)', P2O5: 'Fósforo (P₂O₅)', K2O: 'Potasio (K₂O)' }
const OFICIAL = { sin_enviar: 'sin enviar a la Junta', pendiente: 'envío pendiente', aceptado: 'aceptado por la Junta', rechazado: 'rechazado', por_rectificar: 'rectificación pendiente de tramitar' }
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const LS_EXPL = 'cuaderno-explotacion'

export default {
  name: 'MiExplotacion',
  components: { CuentaEntrar },
  props: {
    ine: { type: String, required: true },
    campañaSigpac: { type: Number, default: () => new Date().getFullYear() },
    seleccion: { type: Object, default: null }, // recinto del visor (feature) seleccionado
    abrirParteId: { type: String, default: null },
    croquisHecho: { type: Object, default: null } // { recintoId, geometria, area, seq } dibujado en el visor
  },
  emits: ['verRecinto', 'guardados', 'dibujar'],
  setup(props, { emit }) {
    const error = ref('')
    const ocupado = ref(false)
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
    const formFito = ref(false)
    const fincas = ref([])
    const fincaForm = reactive({ nombre: '', alias: '', recintos: [], observaciones: '' })
    const miembroForm = reactive({ email: '', rol: 'asesor' })
    const resumenDlg = ref(null)
    const resumen = ref(null)

    const explotacion = computed(() => explotaciones.value.find(e => e._id === explotacionId.value))
    const enCola = computed(() => cola.items.filter(x => x.explotacionId === explotacionId.value))
    const cultivosCampaña = computed(() => cultivos.value.filter(c => c.campaña === campaña.value))
    // Cultivos en el campo un día (un trigo sembrado en octubre es ya de la campaña siguiente)
    function cultivoActivo(c, fecha) {
      if (!fecha) return true
      if (c.fechaInicio || c.fechaFin) return (!c.fechaInicio || c.fechaInicio <= fecha) && (!c.fechaFin || c.fechaFin >= fecha)
      const año = Number(String(fecha).slice(0, 4))
      return c.campaña === año || (c.campaña === año + 1 && String(fecha).slice(5, 7) >= '09')
    }
    const cultivosDelDia = (F) => {
      const hoy = cultivos.value.filter(c => cultivoActivo(c, F?.fechaEfectiva))
      return hoy.length ? hoy : cultivosCampaña.value
    }
    const cultivosHoy = computed(() => cultivosDelDia({ fechaEfectiva: today() }))
    const refDe = (p) => `${p.agr}-${p.zona}-${p.pol}-${p.par}-${p.rec}`
    const seleccionGuardada = computed(() => props.seleccion && recintos.value.some(r => r.ine === props.ine && refDe(r.ref) === refDe(props.seleccion.properties)))
    const csvUrl = computed(() => api.csvUrl(explotacionId.value, campaña.value))

    const run = async (fn) => {
      error.value = ''
      ocupado.value = true
      try { return await fn() } catch (e) { error.value = e.status === 0 ? 'Sin conexión: inténtalo cuando tengas cobertura.' : e.message } finally { ocupado.value = false }
    }

    // ---------- Cuenta y explotación ----------
    const ofrecerHuella = ref(false)
    const codigoBonito = (c) => `${c.slice(0, 3)} ${c.slice(3)}`
    // ¿Ofrecer «entra con la huella la próxima vez»? Si el teléfono puede y la cuenta aún no la tiene aquí
    async function revisarHuella() {
      ofrecerHuella.value = false
      if (huellaDescartada() || tieneHuellaAqui() || !(await huellaDisponible())) return
      try {
        const p = await api.cuenta()
        if (p.usuario) sesion.usuario = p.usuario
        ofrecerHuella.value = !(p.formas || []).includes('huella')
      } catch { /* sin red: ya se ofrecerá */ }
    }
    async function alEntrar(usuario) {
      sesion.usuario = usuario
      await run(cargarExplotaciones)
      revisarHuella()
    }
    async function activarHuella() {
      error.value = ''
      ocupado.value = true
      try { await crearConHuella(); ofrecerHuella.value = false } catch (e) { error.value = e.status === 0 ? 'Sin conexión: inténtalo cuando tengas cobertura.' : mensajeHuella(e) } finally { ocupado.value = false }
    }
    function noHuella() { descartarHuella(); ofrecerHuella.value = false }
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
        const [r, c, o, f] = await Promise.all([api.recintos(explotacionId.value), api.cultivos(explotacionId.value), api.operaciones(explotacionId.value), api.fincas(explotacionId.value)])
        recintos.value = r
        fincas.value = f
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
      formParte.value = false
      formFito.value = false
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
      const c = cultivosHoy.value[0]
      Object.assign(parteForm, {
        id: nuevoId(), fechaEfectiva: today(), cultivoId: c?._id || null, recintos: c ? c.unidades.map(u => u.recintoId) : [], parcial: {}, croquis: {},
        donde: fincas.value.length ? 'finca' : 'cultivo', fincaId: fincas.value[0]?._id || null,
        producto: { nombre: '', tipo: 'mineral', composicion: { N: '', P2O5: '', K2O: '' }, densidad: '' },
        dosis: { valor: '', unidad: 'kg/ha' }, ejecutor: sesion.usuario?.nombre || '', observaciones: ''
      })
      formParte.value = true
      parteAbierto.value = null
    }
    const cultivoParte = computed(() => cultivos.value.find(c => c._id === parteForm.cultivoId))
    watch(() => parteForm.cultivoId, () => { if (cultivoParte.value) parteForm.recintos = cultivoParte.value.unidades.map(u => u.recintoId) })

    // Por recinto: zona dibujada > superficie escrita > todo lo cultivado
    const supEn = (F, u) => (F.croquis?.[u.recintoId] ? F.croquis[u.recintoId].area : Number(F.parcial[u.recintoId]) > 0 ? Number(F.parcial[u.recintoId]) * 10000 : u.superficie.valor)
    const supDe = (u) => supEn(parteForm, u)
    const imputacionDe = (F, cultivoId, u) => (F.croquis?.[u.recintoId]
      ? { cultivoId, recintoId: u.recintoId, superficie: { metodo: 'croquis', geometria: F.croquis[u.recintoId].geometria } }
      : Number(F.parcial[u.recintoId]) > 0
        ? { cultivoId, recintoId: u.recintoId, superficie: { metodo: 'declarada', valor: Number(F.parcial[u.recintoId]) * 10000 } }
        : { cultivoId, recintoId: u.recintoId })
    // Dónde, para el servidor: la finca (él la convierte en sus cultivos de esa fecha) o los recintos elegidos
    const dondeBody = (F, cultivo) => (F.donde === 'finca'
      ? { fincaId: F.fincaId, imputaciones: [] }
      : { imputaciones: (cultivo?.unidades || []).filter(u => F.recintos.includes(u.recintoId)).map(u => imputacionDe(F, F.cultivoId, u)) })

    // Lo mismo que hará el servidor con una finca, para enseñarlo antes de guardar (cultivos de esa fecha)
    function previewFinca(F) {
      const finca = fincas.value.find(x => x._id === F.fincaId)
      if (!finca) return null
      const activos = cultivos.value.filter(c => cultivoActivo(c, F.fechaEfectiva))
      const items = []
      const sin = []
      for (const fr of finca.recintos) {
        const aqui = activos.filter(c => c.unidades.some(u => u.recintoId === fr.recintoId))
        if (!aqui.length) { sin.push(fr.refTexto); continue }
        for (const c of aqui) {
          const u = c.unidades.find(x => x.recintoId === fr.recintoId)
          items.push({ especie: c.especie, refTexto: fr.refTexto, sup: fr.superficie.metodo === 'completa' ? u.superficie.valor : Math.min(fr.superficie.valor, u.superficie.valor) })
        }
      }
      return { nombre: finca.nombre, items, sin }
    }

    // Croquis: el visor dibuja y devuelve la zona (prop croquisHecho)
    let croquisDestino = null
    function dibujar(form, u) {
      const r = recintos.value.find(x => x._id === u.recintoId)
      if (!r) return
      croquisDestino = form
      emit('dibujar', { recintoId: r._id, ref: r.ref, etiqueta: r.refTexto })
    }
    watch(() => props.croquisHecho?.seq, () => {
      const c = props.croquisHecho
      const F = croquisDestino === 'fitoForm' ? fitoForm : croquisDestino === 'parteForm' ? parteForm : null
      if (!c || !F) return
      F.croquis = { ...F.croquis, [c.recintoId]: { geometria: c.geometria, area: c.area } }
      if (!F.recintos.includes(c.recintoId)) F.recintos.push(c.recintoId)
      delete F.parcial[c.recintoId]
      croquisDestino = null
    })

    function parteBody(estado) {
      return {
        id: parteForm.id, tipo: 'abonado', estado, fechaEfectiva: parteForm.fechaEfectiva,
        ejecutor: { nombre: parteForm.ejecutor },
        ...dondeBody(parteForm, cultivoParte.value),
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
      const porFinca = parteForm.donde === 'finca'
      const pf = porFinca ? previewFinca(parteForm) : null
      const unidades = porFinca ? [] : (cultivoParte.value?.unidades || []).filter(u => parteForm.recintos.includes(u.recintoId))
      if (porFinca ? !pf?.items.length : !unidades.length) { error.value = porFinca ? 'En esa fecha no hay ningún cultivo dado de alta en esa finca' : 'Marca al menos un recinto'; return }
      error.value = ''
      const sup = porFinca ? pf.items.reduce((s, it) => s + it.sup, 0) : unidades.reduce((s, u) => s + supDe(u), 0)
      const porHa = /\/ha$/.test(parteForm.dosis.unidad)
      const cant = Number(parteForm.dosis.valor) * (porHa ? sup / 10000 : 1)
      resumen.value = {
        cultivo: porFinca ? [...new Set(pf.items.map(it => it.especie))].join(', ') : cultivoParte.value.especie,
        donde: porFinca ? `${pf.nombre} (${pf.items.map(it => it.refTexto).join(', ')})` : unidades.map(u => (parteForm.croquis[u.recintoId] ? `${u.refTexto} (zona dibujada)` : u.refTexto)).join(', '),
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
    // ---------- Fincas y personas ----------
    const misRoles = computed(() => explotacion.value?.misRoles || [])
    const esTitular = computed(() => misRoles.value.includes('titular'))
    const puedeConfirmar = computed(() => misRoles.value.some(r => r === 'titular' || r === 'confirmador'))
    async function crearFinca() {
      await run(async () => {
        await api.crearFinca(explotacionId.value, { nombre: fincaForm.nombre, alias: fincaForm.alias.split(',').map(x => x.trim()).filter(Boolean), recintos: fincaForm.recintos.map(id => ({ recintoId: id })), observaciones: fincaForm.observaciones || null })
        Object.assign(fincaForm, { nombre: '', alias: '', recintos: [], observaciones: '' })
        fincas.value = await api.fincas(explotacionId.value)
      })
    }
    async function ponerMiembro() {
      await run(async () => {
        await api.ponerMiembro(explotacionId.value, { persona: miembroForm.email, roles: [miembroForm.rol] })
        miembroForm.email = ''
        explotaciones.value = await api.explotaciones()
      })
    }
    async function quitarMiembro(userId) {
      await run(async () => { await api.quitarMiembro(explotacionId.value, userId); explotaciones.value = await api.explotaciones() })
    }
    async function confirmarParte() {
      await run(async () => {
        parteAbierto.value = await api.rectificar(explotacionId.value, parteAbierto.value._id, { version: parteAbierto.value.version, confirmar: true })
        operaciones.value = await api.operaciones(explotacionId.value)
      })
    }

    // ---------- Tratamientos fitosanitarios ----------
    const fitoForm = reactive({})
    function nuevoFito() {
      const c = cultivosHoy.value[0]
      Object.assign(fitoForm, {
        id: nuevoId(), subtipo: c ? 'campo' : 'semilla', fechaEfectiva: today(), hora: '',
        cultivoId: c?._id || null, recintos: c ? c.unidades.map(u => u.recintoId) : [], parcial: {}, croquis: {},
        donde: fincas.value.length ? 'finca' : 'cultivo', fincaId: fincas.value[0]?._id || null,
        lote: { descripcion: '', identificador: '', cantidad: '', unidad: 'kg' }, instalacion: { nombre: '', tipo: '' },
        problema: '', justificacion: '', producto: { nombre: '', registro: '' }, dosis: { valor: '', unidad: 'L/ha' },
        aplicador: { nombre: sesion.usuario?.nombre || '', carne: '' }, equipo: { nombre: '', inscripcion: '' }, asesor: { nombre: '', numero: '' },
        evaluacion: ''
      })
      formFito.value = true
      formParte.value = false
      parteAbierto.value = null
    }
    const cultivoFito = computed(() => cultivos.value.find(c => c._id === fitoForm.cultivoId))
    watch(() => fitoForm.cultivoId, () => { if (cultivoFito.value) fitoForm.recintos = cultivoFito.value.unidades.map(u => u.recintoId) })
    // Al cambiar el supuesto, una unidad de dosis que tenga sentido para él
    watch(() => fitoForm.subtipo, (st) => { if (st && !UNIDADES_FITO[st].includes(fitoForm.dosis?.unidad)) fitoForm.dosis.unidad = UNIDADES_FITO[st][0] })

    function fitoBody(estado) {
      const enCampo = fitoForm.subtipo === 'campo'
      return {
        id: fitoForm.id, tipo: 'fitosanitario', estado, fechaEfectiva: fitoForm.fechaEfectiva, campaña: campaña.value,
        ...(enCampo ? dondeBody(fitoForm, cultivoFito.value) : { imputaciones: [] }),
        lineas: [{ producto: { nombre: fitoForm.producto.nombre, registro: fitoForm.producto.registro || null }, dosis: { valor: Number(fitoForm.dosis.valor), unidad: fitoForm.dosis.unidad } }],
        fito: {
          subtipo: fitoForm.subtipo, problema: fitoForm.problema, justificacion: fitoForm.justificacion || null, hora: fitoForm.hora || null,
          lote: ['semilla', 'poscosecha'].includes(fitoForm.subtipo) ? { descripcion: fitoForm.lote.descripcion, identificador: fitoForm.lote.identificador, cantidad: fitoForm.lote.cantidad ? { valor: Number(fitoForm.lote.cantidad), unidad: fitoForm.lote.unidad } : null } : null,
          instalacion: fitoForm.subtipo === 'instalacion' ? { ...fitoForm.instalacion } : null,
          aplicador: { ...fitoForm.aplicador }, equipo: { ...fitoForm.equipo }, asesor: fitoForm.asesor.nombre ? { ...fitoForm.asesor } : null,
          evaluacion: { programada: fitoForm.evaluacion || null }
        },
        dispositivo: navigator.userAgent.slice(0, 80)
      }
    }
    async function guardarFito(estado) {
      await run(async () => {
        const r = await guardarParte(sesion.usuario.id, explotacionId.value, fitoBody(estado))
        formFito.value = false
        if (r.estado === 'guardado') {
          operaciones.value = await api.operaciones(explotacionId.value)
          parteAbierto.value = r.operacion
        } else if (r.estado === 'pendiente') {
          error.value = 'Sin conexión: el tratamiento queda guardado en este teléfono y se enviará solo cuando vuelva la red.'
        } else {
          error.value = `No se ha podido guardar: ${r.error}`
        }
      })
    }
    const evalForm = reactive({ fecha: today(), eficacia: 'buena', observaciones: '' })
    async function evaluar() {
      await run(async () => {
        parteAbierto.value = await api.evaluar(explotacionId.value, parteAbierto.value._id, { ...evalForm })
        operaciones.value = await api.operaciones(explotacionId.value)
      })
    }

    async function abrirParte(id) {
      formParte.value = false
      formFito.value = false
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
        revisarHuella()
        await sincronizar(sesion.usuario.id)
        if (props.abrirParteId) { tab.value = 'partes'; await abrirParte(props.abrirParteId) }
      }
    })
    onBeforeUnmount(() => window.removeEventListener('online', onOnline))

    return {
      sesion, error, ocupado, alEntrar, ofrecerHuella, activarHuella, noHuella, codigoBonito, explotaciones, explotacionId, explotacion, nuevaExplotacion, tab, recintos, cultivos, operaciones,
      campaña, cuadernoData, parteAbierto, formParte, resumenDlg, resumen, enCola, cultivosCampaña, cultivosDelDia, cultivosHoy, seleccionGuardada, csvUrl, cultivoForm, parteForm, cultivoParte,
      fincas, fincaForm, miembroForm, previewFinca, dibujar, esTitular, puedeConfirmar, crearFinca, ponerMiembro, quitarMiembro, confirmarParte,
      formFito, fitoForm, cultivoFito, nuevoFito, guardarFito, evalForm, evaluar, SUBTIPOS_FITO, UNIDADES_FITO,
      salir, crearExplotacion, cargarTodo, cargarCultivos, cargarCuaderno, abrirTab, guardarSeleccion, crearCultivo, nuevoParte, revisarParte, guardarParteForm, abrirParte, reintentar,
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
.mx-oferta { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--primary-color) 40%, transparent); background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
.mx-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.mx-oferta p { margin: 0; font-size: 14px; line-height: 1.4; color: var(--text-primary); }
.mx-oferta .mx-btn { font-size: 15px; padding: 10px 18px; }
.mx-codigo { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 14px; color: var(--text-primary); }
.mx-codigo strong { font-family: ui-monospace, monospace; font-size: 16px; letter-spacing: 0.08em; }
.mx-croquis { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; margin: 0; }
.mx-preview { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-primary); }
.mx-donde { margin-bottom: 4px; }
.mx-link { padding: 0; border: 0; background: none; color: var(--primary-color); font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; text-align: left; }
.mx-seg, .mx-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 3px; border-radius: 16px; background: var(--bg-secondary); }
.mx-seg button, .mx-tabs button { flex: 1; padding: 6px 8px; border: 0; border-radius: 999px; background: transparent; color: var(--text-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.mx-seg button[aria-selected='true'], .mx-seg button[aria-checked='true'], .mx-tabs button[aria-selected='true'] { background: var(--primary-color); color: #fff; font-weight: 700; }
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
