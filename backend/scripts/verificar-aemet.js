// Comprobación de la integración con AEMET al poner la clave (ejecutar una vez):
//   docker compose exec -T backend node scripts/verificar-aemet.js            (en el servidor)
//   AEMET_API_KEY=... node scripts/verificar-aemet.js --guardar                (en local, guarda la prueba)
// 1. La clave funciona.  2. Estaciones de AEMET en Salamanca (inventario).  3. Observación de las últimas 12 h.
// 4. Los campos que usa el conector existen en los METADATOS oficiales y con la unidad esperada.
// 5. Con --guardar, deja una respuesta real recortada en test/fixtures/weather/aemet-real.json.
// No imprime la clave.
const fs = require('fs');
const path = require('path');
// En local lee el .env de la raíz del proyecto (en el servidor la clave llega por docker-compose)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const aemet = require('../src/services/weather/providers/aemet');

const ok = (m) => console.log(`✅ ${m}`);
const warn = (m) => console.log(`⚠️  ${m}`);
const fail = (m) => { console.log(`❌ ${m}`); process.exitCode = 1; };

(async () => {
  if (!process.env.AEMET_API_KEY) return fail('No hay AEMET_API_KEY en el entorno');

  // 1 y 2
  let inventory;
  try {
    inventory = await aemet.request('/api/valores/climatologicos/inventarioestaciones/todasestaciones');
  } catch (err) { return fail(`La clave no funciona o AEMET no responde: ${err.message}`); }
  ok(`Clave válida. Inventario: ${inventory.length} estaciones en España`);
  const stations = aemet._test.parseInventory(inventory);
  if (!stations.length) return fail('Ninguna estación con provincia "SALAMANCA": revisar el campo provincia del inventario');
  ok(`${stations.length} estaciones en Salamanca: ${stations.map(s => `${s.externalId} ${s.name}`).join(', ')}`);

  // 3 y 4
  const { data: obs, meta } = await aemet.request('/api/observacion/convencional/todas', { withMeta: true });
  const ids = new Set(stations.map(s => s.externalId));
  const mine = obs.filter(r => ids.has(r.idema));
  if (!mine.length) warn('Sin observaciones de Salamanca en las últimas 12 h (¿estaciones sin datos o indicativos distintos?)');
  else ok(`${mine.length} registros de Salamanca en las últimas 12 h (${new Set(mine.map(r => r.idema)).size} estaciones)`);

  const campos = meta?.campos || [];
  if (!campos.length) warn('No se pudo leer el fichero de metadatos: los campos quedan sin verificar');
  for (const f of aemet._test.FIELDS) {
    const c = campos.find(x => x.id === f.field);
    const seen = mine.some(r => r[f.field] !== undefined);
    if (!c && campos.length) fail(`El campo "${f.field}" (${f.variable}) NO está en los metadatos de AEMET: corregir FIELDS en providers/aemet.js`);
    else if (c) console.log(`   ${f.field.padEnd(10)} → ${f.variable.padEnd(18)} metadatos: "${c.descripcion}" [${c.unidad || '-'}]${seen ? '' : '  (sin datos ahora)'}`);
  }
  const fint = campos.find(x => x.id === 'fint');
  if (fint) console.log(`   fint (fecha) → metadatos: "${fint.descripcion}" — debe ser UTC y el fin del periodo`);
  const sample = mine[0];
  if (sample) {
    const parsed = aemet._test.parseObservations([sample], [sample.idema]);
    ok(`Ejemplo normalizado (${sample.idema}, ${sample.fint}): ${parsed.map(o => `${o.variable}=${o.value}${o.unit}`).join(', ')}`);
  }

  // 5
  if (process.argv.includes('--guardar') && mine.length) {
    const out = path.resolve(__dirname, '../test/fixtures/weather/aemet-real.json');
    fs.writeFileSync(out, `${JSON.stringify({
      _nota: `Respuesta REAL de AEMET OpenData (${new Date().toISOString()}), recortada a Salamanca. © AEMET.`,
      inventario: inventory.filter(r => String(r.provincia).toUpperCase() === 'SALAMANCA'),
      observacion: mine.slice(0, 30),
      metadatos: meta
    }, null, 1)}\n`);
    ok(`Respuesta real guardada en ${path.relative(process.cwd(), out)}: sustituir el ejemplo en las pruebas`);
  }
  console.log(process.exitCode ? '\nHay cosas que corregir antes de dar por buena la integración.' : '\nIntegración con AEMET verificada.');
})().catch(err => { fail(err.message); });
