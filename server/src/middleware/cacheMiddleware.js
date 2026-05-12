import cacheUtil from '../lib/cache.js';

/**
 * Express middleware to cache responses based on URL and optional query parameters.
 * @param {number} durationInSeconds - How long to cache the response.
 */
export const cacheMiddleware = (durationInSeconds) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Build cache key from originalUrl (includes query params)
    const key = `__express__${req.originalUrl || req.url}`;
    const cachedResponse = cacheUtil.get(key);

    if (cachedResponse) {
      res.setHeader('Content-Type', 'application/json');
      return res.send(cachedResponse);
    } else {
      // Intercept res.send to store the response in cache
      const originalSend = res.send;
      res.send = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheUtil.set(key, body, durationInSeconds);
        }
        return originalSend.call(res, body);
      };
      next();
    }
  };
};

/**
 * Clear cache middleware helper - can be used after POST/PUT/DELETE to invalidate specific keys
 */
export const clearCache = (pattern) => {
  if (!pattern) {
    cacheUtil.flush();
  } else {
    // Implementation for clearing by pattern if needed
    // node-cache doesn't support wildcard deletion easily without iterating keys
    const keys = cacheUtil.getStats().keys || [];
    keys.forEach(key => {
      if (key.includes(pattern)) {
        cacheUtil.del(key);
      }
    });
  }
};
