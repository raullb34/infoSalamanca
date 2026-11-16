// Temas de una noticia de la prensa local:
//  - fuera: sucesos y tráfico, política y esquelas (no se usan para nada)
//  - anuncia: puede anunciar algo que va a pasar (fiestas, conciertos, ferias, jornadas…): se le pasa a la IA para
//    sacar los eventos. Es un filtro amplio: la IA decide al final si de verdad hay un evento con fecha.
// (\b no entiende de tildes —"acogerá", "exposición"—: los límites de palabra van con \p{L} y la bandera u)
const words = (src) => new RegExp(`(?<![\\p{L}\\d])(?:${src})(?![\\p{L}\\d])`, 'iu')

// Sucesos y tráfico
// ("se vuelca con", "el misterio de la muerte", "fuegos artificiales" no son sucesos)
const SUCESOS = words([
  'accidente', 'herid[oa]s?', 'fallec(?:e|i[oó]|id[oa]s?)', 'muere', 'muert[oa]s? (?:en|tras|al)', 'atropell[a-z]*', 'colisi[oó]n', 'choque', 'volc[oó]', 'vuelco',
  'salida de (?:la )?v[ií]a', 'incendios?', 'bomberos', 'detenid[oa]s?', 'detenci[oó]n', 'arrest[a-z]*', 'robo', 'hurto', 'estafa', 'agresi[oó]n',
  'apuñal[a-z]*', 'reyerta', 'juicio', 'condenad[oa]', 'tribunal', 'sucesos?', 'desaparecid[oa]', 'rescat[a-z]*', 'corte de (?:la )?carretera',
  'carretera cortada', 'atasco', 'tr[aá]fico', 'radar', 'multa', 'guardia civil', 'polic[ií]a (?:local|nacional)', 'desmantel[a-z]*',
  'droga', 'narcotr[aá]fico', 'okupa[a-z]*', 'sustracci[oó]n', 'investigad[oa] por'
].join('|'))
// Política
// ("en pleno centro" no es política: el pleno, con su ayuntamiento o su tipo)
const POLITICA = words([
  'pleno (?:municipal|ordinario|extraordinario|del ayuntamiento|de la diputaci[oó]n)', 'el pleno', 'psoe', 'pp', 'partido popular', 'vox', 'podemos', 'izquierda unida', 'ucl', 'xav', 'oposici[oó]n', 'moci[oó]n', 'enmiendas?',
  'presupuestos?', 'elecciones', 'candidat[oa]s?', 'campaña electoral', 'procurador(?:es)?', 'diputad[oa]s?', 'senador(?:es)?',
  'cortes de castilla', 'junta de gobierno local'
].join('|'))
// Esquelas y necrológicas
const ESQUELAS = words([
  'esquelas?', 'necrol[oó]gicas?', 'obituario', 'in memoriam', 'descanse en paz', 'fallecimiento', 'funeral', 'sepelio', 'tanatorio',
  'velatorio', 'homenaje p[oó]stumo', 'ha fallecido', 'nos ha dejado'
].join('|'))

// Puede anunciar algo (verbo en futuro, programa, cartel, o un tipo de evento)
const ANUNCIA = words([
  'acoger[aá]', 'celebrar[aá]n?', 'organiza', 'organizar[aá]n?', 'ofrecer[aá]n?', 'presentar[aá]n?', 'programa', 'programaci[oó]n', 'cartel',
  'agenda', 'fiestas?', 'feria', 'mercad(?:o|illo)', 'romer[ií]a', 'procesi[oó]n', 'matanza', 'verbena', 'charanga', 'orquesta', 'conciertos?',
  'actuaci[oó]n', 'festival', 'certamen', 'concurso', 'jornadas?', 'semana cultural', 'teatro', 't[ií]teres', 'cine', 'proyecci[oó]n',
  'exposici[oó]n', 'muestra', 'talleres?', 'charlas?', 'conferencias?', 'presentaci[oó]n', 'ruta', 'marcha', 'senderismo', 'carrera',
  'torneo', 'encuentro', 'convivencia', 'degustaci[oó]n', 'celebraci[oó]n', 'actividades', 'inscripci[oó]n', 'abre el plazo',
  'este (?:s[aá]bado|domingo|viernes|fin de semana)', 'pr[oó]xim[oa]', 'mañana'
].join('|'))

// Crónicas y resultados (deporte de competición, reportajes de lo ya pasado): no anuncian nada
const CRONICA = words([
  'fotos', 'v[ií]deo', 'galer[ií]a', 'se proclama', 'campe[oó]n(?:a|es)?', 'gana', 'logra', 'conquista', 'vence', 'derrota', 'empate',
  'goles?', 'jornada \\d+', 'clasificaci[oó]n', 'arranca ovaciones', 'tras su paso', 'balance', 'reconocimiento', 'premiad[oa]s?'
].join('|'))

function topicsOf(item) {
  const head = `${item.titulo}. ${(item.categorias || []).join(' · ')}`
  const fuera = SUCESOS.test(item.titulo) ? 'sucesos'
    : ESQUELAS.test(head) ? 'esquelas'
      : POLITICA.test(head) ? 'politica'
        : null
  // Para la IA: lo que anuncia algo en el título o al principio del resumen y no es una crónica
  const anuncia = !fuera && !CRONICA.test(item.titulo) && ANUNCIA.test(`${item.titulo}. ${String(item.resumen || '').slice(0, 200)}`)
  return { fuera, anuncia }
}

module.exports = { topicsOf }
