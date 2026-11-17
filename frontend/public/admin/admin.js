// Panel de administración: lo común a todas las páginas (pantalla de entrada, barra de secciones, peticiones y
// avisos). Hasta que el servidor da la clave por buena no se ve nada de la página, solo la pantalla de entrada
// (cada página lleva class="admin-locked" en <html> para que no asome nada mientras carga).
// La clave se guarda en sessionStorage ("adminToken") y se borra al cerrar el navegador.
(() => {
  const KEY = 'adminToken'
  const SECTIONS = [
    { href: '/admin/index.html', label: 'Inicio', id: 'inicio' },
    { href: '/admin/difusion.html', label: 'Difusión', id: 'difusion' },
    { href: '/admin/carteles.html', label: 'Carteles', id: 'carteles' },
    { href: '/admin/aportaciones.html', label: 'Aportaciones', id: 'aportaciones' }
  ]
  // En desarrollo (Vite en :3000) la API está en :4000; en producción, en el mismo sitio
  const API = location.port === '3000' ? `http://${location.hostname}:4000/api` : '/api'

  const token = {
    get() { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } },
    set(v) { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY) } catch { /* sin almacenamiento */ } }
  }

  // el('button', { class: 'x', onclick: fn }, 'texto', otroNodo)
  function el(tag, attrs = {}, ...children) {
    const n = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue
      if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v)
      else if (k === 'html') n.innerHTML = v
      else n.setAttribute(k, v === true ? '' : v)
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)))
    return n
  }

  let msgTimer = null
  function say(text, isError = false) {
    let m = document.getElementById('admin-msg')
    if (!m) { m = el('div', { id: 'admin-msg', class: 'msg', role: 'status', 'aria-live': 'polite' }); document.body.append(m) }
    m.textContent = text
    m.classList.toggle('error', isError)
    m.hidden = !text
    clearTimeout(msgTimer)
    if (text) msgTimer = setTimeout(() => { m.hidden = true }, isError ? 8000 : 3500)
  }

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.get()}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) { lock(true); throw new Error('Clave incorrecta') }
    if (!res.ok) throw new Error(data.error || data.mensaje || `Error ${res.status}`)
    return data
  }

  // Igual que api() pero devuelve un Blob (imágenes)
  async function apiBlob(path, body) {
    const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.get()}` }, body: JSON.stringify(body || {}) })
    if (res.status === 401) { lock(true); throw new Error('Clave incorrecta') }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`)
    return res.blob()
  }

  // ---------- Pantalla de entrada ----------
  const GATE_CSS = `html.admin-locked body>:not(.admin-gate){display:none!important}
.admin-gate{min-height:100vh;display:grid;place-items:center;padding:16px;box-sizing:border-box;background:#f5f6f8;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d2228}
.admin-gate[hidden]{display:none}
.admin-gate form{width:min(100%,340px);box-sizing:border-box;display:flex;flex-direction:column;gap:12px;background:#fff;border:1px solid #dde1e6;border-radius:14px;padding:24px;box-shadow:0 6px 24px rgb(0 0 0/.06)}
.admin-gate h1{margin:0;font-size:20px}.admin-gate h1 b{color:#2e7d32}.admin-gate p{margin:0;color:#5f6b77;font-size:14px}
.admin-gate input{font:inherit;padding:10px 12px;border:1px solid #c5ccd3;border-radius:8px}
.admin-gate button{font:inherit;font-weight:600;padding:10px 12px;border:0;border-radius:8px;background:#1d2228;color:#fff;cursor:pointer}
.admin-gate button:disabled{opacity:.6;cursor:wait}.admin-gate .err{color:#b91c1c;min-height:1.5em}
@media (prefers-color-scheme:dark){.admin-gate{background:#14171a;color:#e8eaed}.admin-gate form{background:#1d2126;border-color:#343a40}.admin-gate p{color:#9aa4ae}.admin-gate input{background:#14171a;color:inherit;border-color:#454c54}.admin-gate button{background:#e8eaed;color:#14171a}.admin-gate .err{color:#f28b82}}`
  document.head.append(el('style', {}, GATE_CSS))

  const ready = [] // lo que cada página carga al entrar
  let unlocked = false
  let gate = null

  // ¿El servidor da la clave por buena? true / false / null (sin conexión)
  async function check() {
    if (!token.get()) return false
    try {
      const res = await fetch(`${API}/admin/sesion`, { headers: { Authorization: `Bearer ${token.get()}` } })
      return res.ok ? true : res.status === 401 || res.status === 503 ? false : null
    } catch { return null }
  }

  // Enseña la pantalla de entrada y tapa la página
  function lock(wrong = false) {
    unlocked = false
    document.documentElement.classList.add('admin-locked')
    if (wrong) token.set('')
    if (!gate) {
      const input = el('input', { type: 'password', name: 'clave', placeholder: 'Clave de administración', autocomplete: 'current-password', 'aria-label': 'Clave de administración', required: true })
      const err = el('p', { class: 'err', role: 'alert' })
      const btn = el('button', { type: 'submit' }, 'Entrar')
      gate = el('div', { class: 'admin-gate' }, el('form', {
        onsubmit: async (e) => {
          e.preventDefault()
          btn.disabled = true
          err.textContent = ''
          token.set(input.value.trim())
          const ok = await check()
          btn.disabled = false
          if (ok) { input.value = ''; unlock() } else {
            if (ok === false) token.set('')
            err.textContent = ok === null ? 'No se puede conectar con el servidor' : 'La clave no es correcta'
            input.select()
          }
        }
      },
      el('h1', {}, 'info', el('b', {}, 'Salamanca'), ' · admin'),
      el('p', {}, 'Escribe la clave de administración para entrar.'),
      input, err, btn))
      document.body.prepend(gate)
    }
    gate.hidden = false
    gate.querySelector('.err').textContent = wrong ? 'La clave no es correcta' : ''
    gate.querySelector('input').focus()
  }

  function unlock() {
    if (gate) gate.hidden = true
    document.documentElement.classList.remove('admin-locked')
    const first = !unlocked && !ready.done
    unlocked = true
    // Lo de la página se carga una sola vez (si la clave caduca y se vuelve a entrar, ya está cargado)
    if (first) { ready.done = true; ready.forEach(fn => fn()) }
  }

  function logout() {
    token.set('')
    location.reload()
  }

  // Al cargar: con una clave guardada que vale se entra directo; si no, la pantalla de entrada
  document.documentElement.classList.add('admin-locked')
  check().then(ok => (ok ? unlock() : lock(ok === false && Boolean(token.get()))))

  // Estilos de la barra para páginas que no cargan admin.css (Carteles tiene los suyos)
  const NAV_CSS = `[hidden]{display:none!important}.admin-nav{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:10px 16px;background:var(--card,#fff);border-bottom:1px solid var(--line,#dde1e6);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.admin-nav .brand b{color:#2e7d32}.admin-nav nav{display:flex;gap:4px;flex-wrap:wrap}.admin-nav nav a{padding:6px 12px;border-radius:999px;color:var(--text,#1d2228);text-decoration:none}
.admin-nav nav a:hover{background:var(--chip,#eef1f4)}.admin-nav nav a[aria-current=page]{background:var(--text,#1d2228);color:var(--card,#fff);font-weight:600}.admin-nav .spacer{flex:1}`

  // Barra de arriba: marca, secciones y salir
  function nav(active) {
    if (!document.querySelector('link[href*="admin.css"]')) document.head.append(el('style', {}, NAV_CSS))
    const bar = el('header', { class: 'admin-nav' },
      el('span', { class: 'brand' }, 'info', el('b', {}, 'Salamanca'), ' · admin'),
      el('nav', { 'aria-label': 'Secciones' }, SECTIONS.map(s => el('a', { href: s.href, 'aria-current': s.id === active ? 'page' : null }, s.label))),
      el('span', { class: 'spacer' }),
      el('button', { class: 'small', type: 'button', onclick: logout }, 'Salir'))
    // Delante de todo, salvo la pantalla de entrada
    if (gate) gate.after(bar)
    else document.body.prepend(bar)
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '—')
  function ago(d) {
    if (!d) return ''
    const min = Math.round((Date.now() - new Date(d)) / 60000)
    if (min < 1) return 'ahora'
    if (min < 60) return `hace ${min} min`
    const h = Math.round(min / 60)
    return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`
  }

  // onLogin(fn): lo que carga la página, cuando el servidor ha dado la clave por buena (al momento si ya lo hizo)
  const onLogin = (fn) => { ready.push(fn); if (ready.done) fn() }
  window.Admin = { el, say, api, apiBlob, nav, token, fmtDate, ago, onLogin, lock, API }
})()
