// Los 362 municipios de Salamanca con coordenadas oficiales, para el módulo meteorológico.
// Fuente: "Registro de municipios de Castilla y León" (Junta, datos abiertos). Nombres del INE.
//   node scripts/build-municipios-salamanca.js  →  src/data/municipios-salamanca.json
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ine = require('../src/helpers/ine-codigopostal.json');
const { slugify } = require('../src/services/weather/normalize');

const URL = 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-municipios-de-castilla-y-leon/records';
const OUT = path.resolve(__dirname, '../src/data/municipios-salamanca.json');
const display = (n) => String(n || '').replace(/^(.*?),\s*(La|El|Los|Las)$/i, '$2 $1');

(async () => {
  const rows = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const { data } = await axios.get(URL, { params: { refine: 'provincia:SALAMANCA', limit: 100, offset }, timeout: 30000 });
    rows.push(...data.results);
    if (data.results.length < 100) break;
  }
  const names = new Map(ine.map(r => [String(r.CodMunicipio), display(r.Municipio)]));
  const municipios = rows.map(r => {
    const code = String(r.cod_ine);
    const name = names.get(code) || r.municipio;
    return { ine: code, name, slug: slugify(name), lat: r.latitud, lon: r.longitud, poblacion: r.poblacion ?? null };
  }).filter(m => m.lat && m.lon).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  // Los slugs tienen que ser únicos (sirven de enlace: ?tiempo=bejar)
  const seen = new Set();
  for (const m of municipios) { if (seen.has(m.slug)) m.slug = `${m.slug}-${m.ine}`; seen.add(m.slug); }
  fs.writeFileSync(OUT, `${JSON.stringify({
    source: { name: 'Registro de municipios de Castilla y León', url: 'https://analisis.datosabiertos.jcyl.es/explore/dataset/registro-de-municipios-de-castilla-y-leon/', publisher: 'Junta de Castilla y León' },
    generated: new Date().toISOString(),
    municipios
  }, null, 1)}\n`);
  console.log(`${municipios.length} municipios → ${path.relative(process.cwd(), OUT)}`);
})().catch(err => { console.error(err.message); process.exit(1); });
