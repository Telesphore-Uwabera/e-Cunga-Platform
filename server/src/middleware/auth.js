import { verifyAuthToken } from '../lib/authToken.js';
import { getUserById } from '../lib/demoAuthStore.js';
import { isDatabaseReady } from '../lib/db.js';
import { getMongoUserById } from '../lib/mongoAuth.js';

function parseToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export function requireAuth(req, res, next) {
  (async () => {
    try {
      const token = parseToken(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const payload = verifyAuthToken(token);
      let user;

      if (isDatabaseReady()) {
        user = await getMongoUserById(payload.sub);
      } else {
        user = getUserById(payload.sub);
      }

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Session is no longer valid.' });
      }

      req.user = {
        ...user,
        _id: user.id,
      };
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  })().catch((err) => {
    console.error(err);
    return res.status(500).json({ error: 'Authentication failed.' });
  });
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    return next();
  };
}
