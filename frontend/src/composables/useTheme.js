import { ref, onMounted } from 'vue'

const THEME_KEY = 'salamanca-theme'
const theme = ref('light')
// 'light' | 'dark' elegidos a mano, o 'system' (sigue al sistema: no hay nada guardado)
const mode = ref('system')

export function useTheme() {
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme()
    saveTheme()
    // Emitir evento cuando cambie el tema
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: theme.value } 
    }))
  }

  const setTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      theme.value = newTheme
      applyTheme()
      saveTheme()
      // Emitir evento cuando cambie el tema
      window.dispatchEvent(new CustomEvent('themeChanged', { 
        detail: { theme: theme.value } 
      }))
    }
  }

  const applyTheme = () => {
    const html = document.documentElement
    if (theme.value === 'dark') {
      html.setAttribute('data-theme', 'dark')
    } else {
      html.removeAttribute('data-theme')
    }
  }

  const saveTheme = () => {
    try { localStorage.setItem(THEME_KEY, theme.value) } catch { /* sin almacenamiento */ }
    mode.value = theme.value
  }

  // Volver a seguir al sistema: se olvida la elección
  const followSystem = () => {
    try { localStorage.removeItem(THEME_KEY) } catch { /* sin almacenamiento */ }
    mode.value = 'system'
    theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    applyTheme()
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: theme.value } }))
  }

  const loadTheme = () => {
    let savedTheme = null
    try { savedTheme = localStorage.getItem(THEME_KEY) } catch { /* sin almacenamiento */ }
    mode.value = savedTheme || 'system'
    if (savedTheme) {
      theme.value = savedTheme
    } else {
      // Detectar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme()
  }

  const isDark = () => theme.value === 'dark'
  const isLight = () => theme.value === 'light'

  // Escuchar cambios en la preferencia del sistema
  const setupSystemThemeListener = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // Solo cambiar si no hay tema guardado
      if (mode.value === 'system') {
        theme.value = e.matches ? 'dark' : 'light'
        applyTheme()
      }
    })
  }

  onMounted(() => {
    loadTheme()
    setupSystemThemeListener()
  })

  return {
    theme,
    mode,
    toggleTheme,
    followSystem,
    setTheme,
    isDark,
    isLight,
    loadTheme
  }
}
