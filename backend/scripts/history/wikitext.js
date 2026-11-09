// Limpieza del wikitexto de los artículos de Wikipedia descargados
// (src/SaLLMantino/ragger/script/municipios_md/*.md). Lo usan build-historia.js y build-town-history.js.
//
// Los artículos vienen en dos formatos de encabezado: "## Historia" (319) y "== Historia ==" (43);
// section() entiende los dos.

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
    // {{Siglo|VII|a|s}}: el segundo parámetro "a" es antes de Cristo
    case 'siglo': return args[0] ? `siglo ${args[0].toUpperCase()}${/^a/i.test(parts[2] || '') ? ' a. C.' : ''}` : 'siglo';
    case 'versalita': case 'nowrap': case 'esd': case 'nombre científico': return args[0] || '';
    case 'lang': case 'lang-la': return args[args.length - 1] || '';
    case 'unidad': case 'convertir': case 'convert': return args.slice(0, 2).join(' ');
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

// Sección de primer nivel ("## Título" o "== Título ==") hasta la siguiente del mismo nivel.
// title puede ser una expresión regular en texto ("Patrimonio|Monumentos").
function section(md, title) {
  const re = new RegExp(`^(?:##\\s+(?:${title})\\s*|==\\s*(?:${title})\\s*==\\s*)$`, 'mi');
  const m = re.exec(md);
  if (!m) return '';
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^(?:##\s+\S|==[^=][^\n]*==\s*$)/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function intro(md, ctx) {
  // Lo que va antes de la primera sección, sin la cabecera "**Superficie:** ..."
  const body = md.split(/^(?:##\s+|==[^=])/m)[0].replace(/^#[^\n]*\n/, '').replace(/^\*\*[^\n]*$/gm, '');
  return paragraphs(body, ctx)[0] || '';
}

module.exports = { cleanWikitext, paragraphs, section, intro };
