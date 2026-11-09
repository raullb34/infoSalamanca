// robots.txt (versión sencilla: bloques "User-agent: *" y el nuestro, reglas Disallow por prefijo)
const { safeGet } = require('../../src/services/posterService')

const cache = new Map()

// Regla de robots.txt → expresión regular: "*" es cualquier cosa y "$" final ancla el final
function toRegex(rule) {
  const anchored = rule.endsWith('$')
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp('^' + body + (anchored ? '$' : ''))
}

async function allowedByRobots(url) {
  const u = new URL(url)
  if (!cache.has(u.origin)) {
    let rules = []
    try {
      const { data } = await safeGet(`${u.origin}/robots.txt`, { timeout: 8000, maxBytes: 200000 })
      let applies = false
      for (const line of String(data).split(/\r?\n/)) {
        const [k, ...rest] = line.replace(/#.*/, '').split(':')
        const v = rest.join(':').trim()
        if (/^user-agent$/i.test(k.trim())) applies = v === '*' || /infosalamanca/i.test(v)
        else if (applies && /^disallow$/i.test(k.trim()) && v) rules.push(v)
      }
    } catch { rules = [] }
    // "/*nPagina=" o "/fin$": comodines a expresión regular, anclada al principio de la ruta
    cache.set(u.origin, rules.map(toRegex))
  }
  const target = u.pathname + u.search
  return !cache.get(u.origin).some(re => re.test(target))
}

module.exports = { allowedByRobots }
