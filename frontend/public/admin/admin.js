// Panel de administración: lo común a todas las páginas (barra de secciones, clave, peticiones y avisos).
// La clave se guarda en sessionStorage ("adminToken", la misma que usa Carteles) y se borra al cerrar el navegador.
(() => {
  const KEY = 'adminToken'
  const SECTIONS = [
    { href: '/admin/index.html', label: 'Inicio', id: 'inicio' },
    { href: '/admin/difusion.html', label: 'Difusión', id: 'difusion' },
    { href: '/admin/carteles.html', label: 'Carteles', id: 'carteles' }
  ]
  // En desarrollo (Vite en :3000) la API está en :4000; en producción, en el mismo sitio
  const API = location.port === '3000' ? `http://${location.hostname}:4000/api` : '/api'

  const token = {
    get() { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } },
    set(v) { try { sessionStorage.setItem(KEY, v) } catch { /* sin almacenamiento */ } }
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
    if (res.status === 401) { showLogin(true); throw new Error('Clave incorrecta') }
    if (!res.ok) throw new Error(data.error || data.mensaje || `Error ${res.status}`)
    return data
  }

  let onLogin = () => {}
  function showLogin(wrong = false) {
    const box = document.querySelector('.admin-nav .login')
    if (!box) return
    box.hidden = false
    if (wrong) say('La clave no es correcta', true)
    box.querySelector('input').focus()
  }

  // Estilos de la barra para páginas que no cargan admin.css (Carteles tiene los suyos)
  const NAV_CSS = `[hidden]{display:none!important}.admin-nav{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:10px 16px;background:var(--card,#fff);border-bottom:1px solid var(--line,#dde1e6);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.admin-nav .brand b{color:#2e7d32}.admin-nav nav{display:flex;gap:4px;flex-wrap:wrap}.admin-nav nav a{padding:6px 12px;border-radius:999px;color:var(--text,#1d2228);text-decoration:none}
.admin-nav nav a:hover{background:var(--chip,#eef1f4)}.admin-nav nav a[aria-current=page]{background:var(--text,#1d2228);color:var(--card,#fff);font-weight:600}.admin-nav .spacer{flex:1}`

  // Barra de arriba: marca, secciones y (si hace falta) la clave
  function nav(active, { login = true } = {}) {
    if (!document.querySelector('link[href*="admin.css"]')) document.head.append(el('style', {}, NAV_CSS))
    const box = el('form', { class: 'login', hidden: Boolean(token.get()) || !login, onsubmit: (e) => {
      e.preventDefault()
      token.set(box.querySelector('input').value.trim())
      box.hidden = true
      onLogin()
    } },
    el('input', { type: 'password', placeholder: 'Clave de administración', autocomplete: 'current-password', 'aria-label': 'Clave de administración' }),
    el('button', { class: 'primary', type: 'submit' }, 'Entrar'))
    const bar = el('header', { class: 'admin-nav' },
      el('span', { class: 'brand' }, 'info', el('b', {}, 'Salamanca'), ' · admin'),
      el('nav', { 'aria-label': 'Secciones' }, SECTIONS.map(s => el('a', { href: s.href, 'aria-current': s.id === active ? 'page' : null }, s.label))),
      el('span', { class: 'spacer' }),
      box)
    document.body.prepend(bar)
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

  window.Admin = { el, say, api, nav, token, fmtDate, ago, onLogin: (fn) => { onLogin = fn }, API }
})()
