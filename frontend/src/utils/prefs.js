// Ajustes de la persona (pestaña Ajustes) guardados en este navegador. Si el navegador no deja guardar
// (modo privado, almacenamiento bloqueado), se usa el valor por defecto y no pasa nada.
const KEY = 'salamanca-prefs'

const readAll = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}

export const readPref = (name, fallback) => {
  const v = readAll()[name]
  return v === undefined ? fallback : v
}

export const savePref = (name, value) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [name]: value })) } catch { /* sin almacenamiento */ }
}
