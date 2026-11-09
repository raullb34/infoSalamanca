// Genera src/data/historia.json a partir de las fichas de Wikipedia descargadas
// (src/SaLLMantino/ragger/script/municipios_md/*.md, en wikitexto).
// Resultado: { "37194": { nombre, resumen, historia: [párrafos], fuente } }
//
// Uso: node scripts/build-historia.js   (desde backend/)

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../src/SaLLMantino/ragger/script/municipios_md');
const OUT = path.resolve(__dirname, '../src/data/historia.json');
const MAX_PARRAFOS = 6;

const { paragraphs, section, intro } = require('./history/wikitext');

// Código INE de referencia por nombre (Wikipedia a veces trae mal cod_municipio, p. ej. Pereña)
const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ineByName = new Map(require('../src/helpers/ine-codigopostal.json')
  .map(x => [normalize(x.Municipio), String(x.CodMunicipio)]));

const result = {};
let sinHistoria = 0;
for (const file of fs.readdirSync(SRC).filter(f => f.endsWith('.md')).sort()) {
  const md = fs.readFileSync(path.join(SRC, file), 'utf8');
  const cod = md.match(/\|\s*cod_municipio\s*=\s*(\d{1,3})/);
  if (!cod) { console.warn(`Sin cod_municipio: ${file}`); continue; }
  const nombre = (md.match(/^#\s+(.+)$/m)?.[1] || file.replace(/\.md$/, '').replace(/_/g, ' ')).trim();
  const ine = ineByName.get(normalize(nombre)) || '37' + cod[1].padStart(3, '0');
  const hab = md.match(/\*\*Población:\*\*\s*(\d+)/)?.[1];
  const ctx = { poblacion: hab ? `${Number(hab).toLocaleString('es-ES')} habitantes` : '' };
  const historia = paragraphs(section(md, 'Historia'), ctx).slice(0, MAX_PARRAFOS);
  if (!historia.length) sinHistoria++;
  result[ine] = {
    nombre,
    resumen: intro(md, ctx),
    historia,
    fuente: `https://es.wikipedia.org/wiki/${encodeURIComponent(file.replace(/\.md$/, ''))}`
  };
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
console.log(`historia.json: ${Object.keys(result).length} municipios (${sinHistoria} sin sección Historia)`);
