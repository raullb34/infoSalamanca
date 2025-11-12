import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Composable para detectar si el viewport es móvil (< 768px)
 * @returns {Object} { isMobile: Ref<boolean> }
 */
export function useIsMobile() {
  const isMobile = ref(false)

  const checkIsMobile = () => {
    isMobile.value = window.innerWidth < 768
  }

  onMounted(() => {
    // Chequear al montar
    checkIsMobile()
    
    // Agregar listener para cambios de tamaño
    window.addEventListener('resize', checkIsMobile)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkIsMobile)
  })

  return {
    isMobile
  }
}
