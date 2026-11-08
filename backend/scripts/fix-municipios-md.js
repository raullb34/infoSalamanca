// Algunas fichas de municipios_md descargaron el artículo equivocado (desambiguaciones,
// "Almendra" el fruto...). Se reconocen porque no tienen "cod_municipio".
// Este script vuelve a bajar "<Nombre> (Salamanca)" de es.wikipedia y conserva la cabecera.
//
// Uso: node scripts/fix-municipios-md.js   (desde backend/)

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../src/SaLLMantino/ragger/script/municipios_md');
const API = 'https://es.wikipedia.org/w/api.php';

async function fetchWikitext(titles) {
  const params = new URLSearchParams({
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
    format: 'json', formatversion: '2', redirects: '1', titles: titles.join('|')
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': 'infoSalamanca-historia/1.0' } });
  if (!res.ok) throw new Error(`Wikipedia respondió ${res.status}`);
  const data = await res.json();
  // Deshacer redirecciones y normalizaciones para volver al título pedido
  const back = {};
  for (const n of [...(data.query.normalized || []), ...(data.query.redirects || [])]) back[n.to] = back[n.from] || n.from;
  const out = {};
  for (const p of data.query.pages) {
    if (p.missing || !p.revisions) continue;
    out[back[p.title] || p.title] = p.revisions[0].slots.main.content;
  }
  return out;
}

(async () => {
  const broken = fs.readdirSync(DIR)
    .filter(f => f.endsWith('.md'))
    .filter(f => !/\|\s*cod_municipio\s*=\s*\d/.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
  console.log(`Fichas sin cod_municipio: ${broken.length}`);

  // Títulos de Wikipedia que no salen del nombre del fichero
  const SPECIAL = { 'Sancti_Spíritus.md': 'Sancti-Spíritus (Salamanca)' };
  const titleOf = f => SPECIAL[f] || `${f.replace(/\.md$/, '').replace(/_/g, ' ')} (Salamanca)`;
  let fixed = 0;
  for (let i = 0; i < broken.length; i += 40) {
    const batch = broken.slice(i, i + 40);
    const texts = await fetchWikitext(batch.map(titleOf));
    for (const f of batch) {
      const wikitext = texts[titleOf(f)];
      if (!wikitext || !/\|\s*cod_municipio\s*=\s*\d/.test(wikitext)) {
        console.warn(`  No se encontró un artículo válido para ${titleOf(f)}`);
        continue;
      }
      const old = fs.readFileSync(path.join(DIR, f), 'utf8');
      // Cabecera: "# Nombre" y las líneas "**Superficie:** ..." del principio
      const header = old.match(/^#[^\n]*\n(?:\s*\n|\*\*[^\n]*\n)*/)?.[0] || `# ${f.replace(/\.md$/, '').replace(/_/g, ' ')}\n\n`;
      fs.writeFileSync(path.join(DIR, f), header.trimEnd() + '\n\n' + wikitext + '\n');
      fixed++;
    }
  }
  console.log(`Corregidas: ${fixed}`);
})();
