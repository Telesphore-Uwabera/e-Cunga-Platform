import NodeCache from 'node-cache';

// Initialize cache with default TTL of 5 minutes (300 seconds)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Cache utility functions
 */
const cacheUtil = {
  get: (key) => cache.get(key),
  set: (key, value, ttl) => cache.set(key, value, ttl),
  del: (key) => cache.del(key),
  flush: () => cache.flushAll(),
  
  /**
   * Helper to wrap async functions with caching
   * @param {string} key 
   * @param {Function} fn 
   * @param {number} ttl 
   */
  async wrap(key, fn, ttl) {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    
    const result = await fn();
    cache.set(key, result, ttl);
    return result;
  }
};

export default cacheUtil;
export { cache };
