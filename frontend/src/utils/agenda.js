// Estado compartido de los filtros de agenda de Cultura (Espectáculos, Exposiciones y Charlas, talleres y
// lecturas): "Con niños" filtra la lista y los pueblos del mapa a la vez.
import { ref } from 'vue'

export const kidsOnly = ref(false)
// ¿Entra el evento con el filtro "Con niños"? (el backend marca `infantil`: público infantil o familiar)
export const matchesKids = (ev, only = kidsOnly.value) => !only || Boolean(ev.infantil)
