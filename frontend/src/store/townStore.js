import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTownStore = defineStore('town', () => {
  // Estado
  const selectedTown = ref(null)
  const selectedTerritories = ref(new Set())
  const townInfo = ref(null)
  const townEvents = ref([])
  const townPointsOfInterest = ref([])
  const isLoading = ref(false)

  // Getters
  const hasSelectedTown = computed(() => selectedTown.value !== null)
  const formattedTownName = computed(() => {
    if (!selectedTown.value) return ''
    return formatPuebloName(selectedTown.value.name)
  })

  // Actions
  const setSelectedTown = (town) => {
    selectedTown.value = town
  }

  const clearSelectedTown = () => {
    selectedTown.value = null
    selectedTerritories.value.clear()
    townInfo.value = null
    townEvents.value = []
    townPointsOfInterest.value = []
  }

  const addTerritory = (territory) => {
    selectedTerritories.value.add(territory)
  }

  const removeTerritory = (territory) => {
    selectedTerritories.value.delete(territory)
  }

  const clearTerritories = () => {
    selectedTerritories.value.clear()
  }

  const setTownInfo = (info) => {
    townInfo.value = info
  }

  const setTownEvents = (events) => {
    townEvents.value = events
  }

  const setTownPointsOfInterest = (pois) => {
    townPointsOfInterest.value = pois
  }

  const setLoading = (loading) => {
    isLoading.value = loading
  }

  return {
    // Estado
    selectedTown,
    selectedTerritories,
    townInfo,
    townEvents,
    townPointsOfInterest,
    isLoading,
    
    // Getters
    hasSelectedTown,
    formattedTownName,
    
    // Actions
    setSelectedTown,
    clearSelectedTown,
    addTerritory,
    removeTerritory,
    clearTerritories,
    setTownInfo,
    setTownEvents,
    setTownPointsOfInterest,
    setLoading
  }
})

// Función auxiliar para formatear nombres de pueblos
function formatPuebloName(name) {
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
