// La misma función anunciada por dos agendas (la Junta, la Diputación, Turismo de Salamanca…): mismo día de
// inicio y un título contiene al otro una vez normalizado ("'Ibiza80' (FÉLIX ALBO)" e "Ibiza80";
// "1ª Reunión Científica GEDTOXON" y "1ª Reunión Científica GEDTOXON (AEDV)"). Se queda la primera que llega,
// así que las listas se pasan por orden de preferencia.
const key = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function sameEvent(a, b) {
  if (!a.fecha_inicio || a.fecha_inicio !== b.fecha_inicio) return false
  const ka = key(a.titulo)
  const kb = key(b.titulo)
  if (!ka || !kb) return false
  return ka === kb || (Math.min(ka.length, kb.length) >= 6 && (ka.includes(kb) || kb.includes(ka)))
}

// Varias listas → una, sin repetidos (ni dentro de una misma lista: mismo id o mismo evento)
function mergeEvents(...lists) {
  const out = []
  const ids = new Set()
  for (const list of lists) {
    for (const ev of list || []) {
      if (ev.id_evento && ids.has(String(ev.id_evento))) continue
      if (out.some(o => sameEvent(o, ev))) continue
      if (ev.id_evento) ids.add(String(ev.id_evento))
      out.push(ev)
    }
  }
  return out
}

module.exports = { mergeEvents, sameEvent }
