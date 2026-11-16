// Lista de productores Tierra de Sabor (/api/gastro), pedida una sola vez y compartida.
import { ref } from 'vue'
import { apiService } from '@/services/apiService'
import { foodTypesOf } from '@/utils/tierraSabor'

// Tipos de comida elegidos en la lista de productores (vacío = todos). Lo comparten la lista y el mapa.
export const foodTypeFilter = ref([])
// ¿El productor tiene alguno de los tipos elegidos?
export const matchesFoodTypes = (producer, types = foodTypeFilter.value) =>
  !types.length || foodTypesOf(producer).some(t => types.includes(t))

let pending = null

export function loadProducers() {
  if (!pending) {
    pending = apiService.getTierraSaborIds().then(list => {
      if (!Array.isArray(list) || !list.length) pending = null // reintentar la próxima vez
      return Array.isArray(list) ? list : []
    })
  }
  return pending
}

// Productores de un municipio. El id del mapa puede llevar sufijo ("37085_2")
export async function producersIn(townId) {
  const ine = String(townId || '').split('_')[0]
  if (!ine) return []
  return (await loadProducers()).filter(p => String(p.cod_ine) === ine)
}
