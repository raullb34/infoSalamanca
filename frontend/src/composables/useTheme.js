import { ref, onMounted } from 'vue'

const THEME_KEY = 'salamanca-theme'
const theme = ref('light')

export function useTheme() {
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme()
    saveTheme()
  }

  const setTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      theme.value = newTheme
      applyTheme()
      saveTheme()
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
    localStorage.setItem(THEME_KEY, theme.value)
  }

  const loadTheme = () => {
    const savedTheme = localStorage.getItem(THEME_KEY)
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
      if (!localStorage.getItem(THEME_KEY)) {
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
    toggleTheme,
    setTheme,
    isDark,
    isLight,
    loadTheme
  }
}
