// Conector Meteoclimatic: DESACTIVADO.
// La red publica feeds RSS/XML por estación, pero no hemos encontrado condiciones de reutilización
// publicadas (noviembre de 2026). Según sources.js no se consulta, guarda, muestra ni redistribuye hasta
// tener autorización por escrito. Para activarlo: obtener permiso, cambiar `rights` en sources.js y
// completar fetchStations/fetchLatest con el formato real del feed (y su prueba con una respuesta guardada).
const { can } = require('../sources');

module.exports = {
  id: 'meteoclimatic',
  capabilities: [],
  enabled: () => can('meteoclimatic', 'consult'),
  fetchStations: async () => { throw new Error('Meteoclimatic: pendiente de autorización'); },
  fetchLatest: async () => { throw new Error('Meteoclimatic: pendiente de autorización'); }
};
