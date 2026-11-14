// Límite de peticiones por IP en memoria (mismo criterio que el asistente: la IP real es la penúltima de
// X-Forwarded-For, la que añade nuestro nginx; la que mande el cliente no cuenta).
const clientIp = (req) => {
  const chain = String(req.get('x-forwarded-for') || '').split(',').map(s => s.trim()).filter(Boolean);
  return chain.length >= 2 ? chain[chain.length - 2] : chain[0] || req.socket.remoteAddress;
};

function rateLimit({ perMinute = 60, perDay = 5000 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = clientIp(req);
    const now = Date.now();
    const h = hits.get(ip) || { minute: [], day: 0, dayStart: now };
    if (now - h.dayStart > 86400000) { h.day = 0; h.dayStart = now; }
    h.minute = h.minute.filter(t => now - t < 60000);
    if (h.minute.length >= perMinute || h.day >= perDay) {
      res.set('Retry-After', '60');
      return res.status(429).json({ error: 'Demasiadas peticiones. Prueba dentro de un minuto.' });
    }
    h.minute.push(now);
    h.day++;
    hits.set(ip, h);
    if (hits.size > 10000) hits.clear(); // que no crezca sin fin
    next();
  };
}

module.exports = { rateLimit, clientIp };
