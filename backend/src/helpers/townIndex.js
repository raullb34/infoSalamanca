// Nombre de municipio → código INE (municipios de Salamanca).
// Acepta las distintas formas en que vienen los nombres en los datos de la Junta:
//   "Las Veguillas", "Veguillas, Las", "Veguillas (Las)", sin tildes, en mayúsculas...
// El código postal solo se usa si es de un único municipio: 108 de los 283 CP de la provincia
// son compartidos, y tomar el primero ponía paradas en el pueblo equivocado.
const ineJson = require('./ine-codigopostal.json');

const norm = (name) => {
  let s = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  // "veguillas (las)" / "veguillas, las" → "las veguillas"
  const m = s.match(/^(.*?)\s*(?:,\s*|\()\s*(la|el|los|las)\s*\)?$/);
  if (m) s = `${m[2]} ${m[1]}`;
  return s.replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
};

const byName = new Map();
const byCp = new Map();
for (const row of ineJson) {
  const ine = String(row.CodMunicipio);
  if (!byName.has(norm(row.Municipio))) byName.set(norm(row.Municipio), { ine, name: row.Municipio });
  if (!byCp.has(row.CodigoPostal)) byCp.set(row.CodigoPostal, new Map());
  byCp.get(row.CodigoPostal).set(ine, row.Municipio);
}

// "Alberguería de Argañán, La" → "La Alberguería de Argañán"
const displayName = (name) => String(name || '').replace(/^(.*?),\s*(La|El|Los|Las)$/i, '$2 $1');

// { ine, name } o null. names: posibles nombres en orden de preferencia (localidad, municipio...)
function findTown(names = [], cp = null) {
  for (const n of names) {
    const hit = n && byName.get(norm(n));
    if (hit) return { ine: hit.ine, name: displayName(hit.name) };
  }
  const towns = cp != null ? byCp.get(Number(cp)) : null;
  if (towns && towns.size === 1) {
    const [[ine, name]] = [...towns.entries()];
    return { ine, name: displayName(name) };
  }
  return null;
}

module.exports = { findTown, norm, displayName };
