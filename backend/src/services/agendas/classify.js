// Ámbito de un evento de las agendas generales: "ciencia" (congresos científicos, divulgación, tecnología),
// "cultura" (escena, música, exposiciones…) o null (deporte y lo que no es ni lo uno ni lo otro: se descarta).
// Se decide por el título y el principio de la descripción, que es donde estas webs dicen qué es.

const SPORT = /\b(campeonato|atletismo|p[aá]del|san silvestre|marat[oó]n|media marat[oó]n|carrera popular|triatl[oó]n|f[uú]tbol|baloncesto|balonmano|voleibol|ciclismo|duatl[oó]n|torneo de (tenis|golf))\b/i
const SCIENCE = /\b(congreso|jornadas?|workshop|simposio|symposium|reuni[oó]n cient[ií]fica|cient[ií]fic[ao]s?|ciencia|science|investigaci[oó]n|investigador[ae]s?|divulgaci[oó]n|tecnolog[ií]a|innovaci[oó]n|astronom[ií]a|f[ií]sica|qu[ií]mica|matem[aá]ticas?|biolog[ií]a|neurociencia|medicina|m[eé]dic[ao]s?|sanitari[ao]s?|cl[ií]nic[ao]|ingenier[ií]a|inteligencia artificial|rob[oó]tica|seminario)\b/i
const CULTURE = [
  [/\b(teatro|comedia|mon[oó]logo|tragedia|esc[eé]nic)/i, 'Espectáculos', 'Teatro'],
  [/\b(danza|ballet|flamenco)\b/i, 'Espectáculos', 'Danza'],
  [/\b(concierto|m[uú]sica|orquesta|coro|recital|[oó]pera|jazz|zarzuela)\b/i, 'Música', 'Música'],
  [/\b(exposici[oó]n|muestra|colecci[oó]n|pintura|escultura|fotograf[ií]a|artes visuales)\b/i, 'Exposiciones', 'Exposición'],
  [/\b(cine|pel[ií]cula|proyecci[oó]n|documental|cortometraje)\b/i, 'Cine', 'Cine'],
  [/\b(libro|poes[ií]a|literatura|lectura|presentaci[oó]n de)\b/i, 'Literatura', 'Literatura'],
  [/\b(visita guiada|ruta|llaves de la ciudad)\b/i, 'Visitas', 'Visita guiada'],
  [/\b(ajedrez|juego|taller)\b/i, 'Actividades', null]
]

// Lugares que ya dicen qué es: en un teatro o una sala de exposiciones, cultura (salvo que el título sea científico)
const STAGES = /\b(teatro|caem|centro de artes esc[eé]nicas|auditorio|sala de conciertos)\b/i
const GALLERIES = /\b(sala de exposiciones|domus artium|da2|museo|galer[ií]a)\b/i

// { titulo, descripcion, lugar_celebracion } → { ambito, categoria, tematica }. `congresses`: agenda de congresos (Convention Bureau),
// donde lo que no es científico ni deporte suele ser una reunión profesional: va como "Congresos y reuniones".
function classify(ev, { congresses = false } = {}) {
  const head = `${ev.titulo || ''}. ${String(ev.descripcion || '').slice(0, 300)}`
  if (SPORT.test(ev.titulo || '') || (congresses && SPORT.test(head))) return { ambito: null, categoria: 'Deporte', tematica: null }
  const titleScience = SCIENCE.test(ev.titulo || '') || (congresses && /reuni[oó]n/i.test(ev.titulo || ''))
  if (!titleScience && GALLERIES.test(ev.lugar_celebracion || '')) return { ambito: 'cultura', categoria: 'Exposiciones', tematica: 'Exposición' }
  const culture = CULTURE.find(([re]) => re.test(ev.titulo || ''))
  if (!titleScience && !culture && STAGES.test(ev.lugar_celebracion || '')) {
    const byText = CULTURE.find(([re]) => re.test(head))
    return { ambito: 'cultura', categoria: byText?.[1] || 'Espectáculos', tematica: byText?.[2] || null }
  }
  // El título manda: "Concierto de la Orquesta de la Universidad" es cultura aunque la descripción hable de ciencia
  if (culture && !titleScience) return { ambito: 'cultura', categoria: culture[1], tematica: culture[2] }
  if (titleScience || SCIENCE.test(head)) return { ambito: 'ciencia', categoria: congresses || /congreso|jornada|reuni[oó]n|simposio|workshop/i.test(ev.titulo || '') ? 'Congresos y jornadas' : 'Divulgación', tematica: null }
  const byText = CULTURE.find(([re]) => re.test(head))
  if (byText) return { ambito: 'cultura', categoria: byText[1], tematica: byText[2] }
  return congresses ? { ambito: null, categoria: 'Congresos y reuniones', tematica: null } : { ambito: 'cultura', categoria: 'Cultura', tematica: null }
}

module.exports = { classify }
