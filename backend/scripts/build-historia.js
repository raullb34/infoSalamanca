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

// Quita bloques anidados como {{...}}, {|...|} o [[Archivo:...]]
function stripNested(text, open, close, keep = () => false) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith(open, i)) {
      let depth = 0;
      let j = i;
      while (j < text.length) {
        if (text.startsWith(open, j)) { depth++; j += open.length; }
        else if (text.startsWith(close, j)) { depth--; j += close.length; if (depth === 0) break; }
        else j++;
      }
      const block = text.slice(i, j);
      if (keep(block)) out += block;
      i = j;
    } else {
      out += text[i++];
    }
  }
  return out;
}

// Convierte en texto las plantillas que aparecen dentro de frases; el resto se borra.
function expandTemplate(inner, ctx) {
  const parts = inner.split('|').map(x => x.trim());
  const name = parts[0].toLowerCase();
  const args = parts.slice(1).filter(a => a && !/^[\w\s-]+=/.test(a));
  if (name.startsWith('población')) return ctx.poblacion || '';
  switch (name) {
    case 'siglo': return args[0] ? `siglo ${args[0].toUpperCase()}` : 'siglo';
    case 'versalita': case 'nowrap': case 'esd': case 'nombre científico': return args[0] || '';
    case 'lang': case 'lang-la': return args[args.length - 1] || '';
    case 'unidad': case 'convertir': case 'convert': return args.slice(0, 2).join(' ');
    case 'población': return ctx.poblacion || '';
    default: return '';
  }
}

function expandTemplates(text, ctx) {
  // De dentro hacia fuera: primero las plantillas que no contienen otras
  const innermost = /\{\{([^{}]*)\}\}/g;
  let prev;
  do { prev = text; text = text.replace(innermost, (_, inner) => expandTemplate(inner, ctx)); } while (text !== prev);
  return text;
}

function cleanWikitext(text, ctx = {}) {
  let t = text;
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/<ref[^>]*\/>/gi, '');
  t = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  // Imágenes y categorías fuera; el resto de enlaces, solo el texto visible
  t = stripNested(t, '[[', ']]', b => !/^\[\[\s*(archivo|file|imagen|image|categoría|category)\s*:/i.test(b));
  t = t.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');
  t = expandTemplates(t, ctx);
  t = stripNested(t, '{|', '|}');
  // Encabezados de wikitexto ("=== Edad Media ===", "====") y de markdown ("### ...")
  t = t.replace(/^\s*(=+[^\n]*|#+\s[^\n]*)$/gm, '\n');
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1');
  t = t.replace(/\[https?:\/\/\S+\]/g, '');
  t = t.replace(/'''?/g, '');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/&nbsp;/g, ' ');
  return t;
}

function paragraphs(text, ctx) {
  return cleanWikitext(text, ctx)
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 40 && !/^[*#:;|!=]/.test(p));
}

function section(md, title) {
  const re = new RegExp(`^##\\s+${title}\\s*$`, 'mi');
  const m = re.exec(md);
  if (!m) return '';
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function intro(md, ctx) {
  // Lo que va antes del primer "##", sin la cabecera "**Superficie:** ..."
  const body = md.split(/^##\s+/m)[0].replace(/^#[^\n]*\n/, '').replace(/^\*\*[^\n]*$/gm, '');
  return paragraphs(body, ctx)[0] || '';
}

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
