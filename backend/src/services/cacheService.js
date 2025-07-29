// backend/src/services/cacheService.js
const Redis = require('ioredis');
const redis = new Redis();

class CacheService {
  async get(key) {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key, data, ttl = 3600) {
    await redis.setex(key, ttl, JSON.stringify(data));
  }
}

module.exports = new CacheService();