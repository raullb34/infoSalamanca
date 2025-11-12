// backend/src/services/cacheService.js
const Redis = require('ioredis');

// In-memory cache fallback
const memoryCache = new Map();
const cacheTTLs = new Map();

// Try to connect to Redis, fallback to memory cache if not available
let redis = null;
let useRedis = false;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      retryStrategy: () => null, // Don't retry on connection failure
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });
    
    redis.connect()
      .then(() => {
        console.log('✅ Redis connected successfully');
        useRedis = true;
      })
      .catch(() => {
        console.log('⚠️  Redis not available, using in-memory cache');
        redis = null;
        useRedis = false;
      });
  } catch (err) {
    console.log('⚠️  Redis not available, using in-memory cache');
    redis = null;
    useRedis = false;
  }
} else {
  console.log('ℹ️  REDIS_URL not configured, using in-memory cache');
}

class CacheService {
  async get(key) {
    if (useRedis && redis) {
      try {
        const cached = await redis.get(key);
        return cached ? JSON.parse(cached) : null;
      } catch (err) {
        console.error('Redis get error:', err.message);
        // Fallback to memory cache
        return this._getFromMemory(key);
      }
    }
    return this._getFromMemory(key);
  }

  async set(key, data, ttl = 3600) {
    if (useRedis && redis) {
      try {
        await redis.setex(key, ttl, JSON.stringify(data));
        return;
      } catch (err) {
        console.error('Redis set error:', err.message);
        // Fallback to memory cache
      }
    }
    this._setInMemory(key, data, ttl);
  }

  _getFromMemory(key) {
    const expiry = cacheTTLs.get(key);
    if (expiry && Date.now() > expiry) {
      memoryCache.delete(key);
      cacheTTLs.delete(key);
      return null;
    }
    return memoryCache.get(key) || null;
  }

  _setInMemory(key, data, ttl) {
    memoryCache.set(key, data);
    cacheTTLs.set(key, Date.now() + (ttl * 1000));
  }

  // Clear all cache (useful for testing)
  async clear() {
    if (useRedis && redis) {
      try {
        await redis.flushdb();
      } catch (err) {
        console.error('Redis clear error:', err.message);
      }
    }
    memoryCache.clear();
    cacheTTLs.clear();
  }
}

module.exports = new CacheService();