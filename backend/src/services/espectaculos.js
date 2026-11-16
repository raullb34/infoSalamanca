// Espectáculos de la provincia (teatro, títeres, danza, circo, música y conciertos) de las tres agendas: Junta de
// Castilla y León, Diputación de Salamanca (La Salina) y Turismo de Salamanca, sin repetir la misma función.
// Sale de la agenda cultural completa (services/agendaCultural.js), que además da exposiciones y actividades.
// Lo usan el filtro "Espectáculos" (/api/towns/teatro), el resumen semanal (difusión) y el asistente.
const agendaCultural = require('./agendaCultural')

module.exports = { getShows: agendaCultural.getShows }
