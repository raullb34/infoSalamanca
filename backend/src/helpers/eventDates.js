// Fechas de eventos: JCyL usa "2026-11-09", la Diputación "07/11/2026" o "7 Nov 2026".

const MESES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };

// Devuelve un Date a medianoche (hora local) o null si no se entiende.
function parseEventDate(value) {
  if (!value || typeof value !== 'string') return null;
  const s = value.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]{3})[a-záéíóú]*\.?\s+(?:de\s+)?(\d{4})/i);
  if (m && MESES[m[2].toLowerCase()] !== undefined) return new Date(+m[3], MESES[m[2].toLowerCase()], +m[1]);
  return null;
}

function startDate(ev) {
  return parseEventDate(ev.fecha_inicio || ev.date || ev.fecha || ev.fecha_texto);
}

function endDate(ev) {
  return parseEventDate(ev.fecha_fin) || startDate(ev);
}

// Quita los eventos ya terminados y ordena por fecha de inicio.
// Los eventos sin fecha legible se conservan al final.
function upcomingSorted(events, today = new Date()) {
  const hoy = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return events
    .filter(ev => {
      const fin = endDate(ev);
      return !fin || fin >= hoy;
    })
    .sort((a, b) => {
      const da = startDate(a);
      const db = startDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
}

module.exports = { parseEventDate, upcomingSorted };
