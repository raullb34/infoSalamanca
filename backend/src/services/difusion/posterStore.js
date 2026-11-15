// Carteles de la newsletter guardados en disco para que el correo los enlace (los clientes de correo no
// muestran imágenes incrustadas en base64; Gmail las descarga de su dirección pública y las guarda en su caché).
// En el servidor van al volumen de carteles (/app/uploads/posters/difusion), así sobreviven a los despliegues.
// Se sirven en GET /api/newsletter/cartel/<nombre>.png
const fs = require('fs')
const path = require('path')
const { publicUrl } = require('./digest')

const DIR = process.env.DIFUSION_POSTER_DIR || path.resolve(__dirname, '../../../uploads/posters/difusion')
const NAME_RE = /^[a-z0-9-]{1,80}\.png$/

async function savePoster(png, name) {
  const file = `${String(name).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 76)}.png`
  await fs.promises.mkdir(DIR, { recursive: true })
  await fs.promises.writeFile(path.join(DIR, file), png)
  return { file, url: `${publicUrl()}/api/newsletter/cartel/${file}` }
}

// Ruta del archivo pedido, solo si el nombre es de los nuestros (nada de "../")
const posterPath = (file) => (NAME_RE.test(String(file || '')) ? path.join(DIR, file) : null)

module.exports = { savePoster, posterPath, DIR }
