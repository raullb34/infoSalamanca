// Rutas que escriben datos: exigen la clave de administración en la cabecera
//   Authorization: Bearer <ADMIN_TOKEN>
// ADMIN_TOKEN vive en el .env del servidor. Si no está definido, la escritura queda desactivada.
const crypto = require('crypto');

const sameText = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

module.exports = function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 24) {
    return res.status(503).json({ success: false, error: 'Administración desactivada (falta ADMIN_TOKEN)' });
  }
  const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!given || !sameText(given, token)) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }
  next();
};
