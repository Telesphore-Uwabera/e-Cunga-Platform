import { verifyAuthToken } from '../lib/authToken.js';
import { isDatabaseReady } from '../lib/db.js';
import { getMongoUserById } from '../lib/mongoAuth.js';
import { resolveEffectivePermissions } from '../lib/permissions.js';
import Company from '../models/Company.js';
import User from '../models/User.js';

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
      const sub = payload?.sub != null ? String(payload.sub) : '';
      if (!sub) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
      }
      if (!isDatabaseReady()) {
        return res.status(503).json({ error: 'Database is unavailable. Try again shortly.' });
      }

      const user = await getMongoUserById(sub, payload.email);

      if (!user || user.isActive === false) {
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

export function requirePermission(...perms) {
  return (req, res, next) => {
    (async () => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required.' });
        }
        
        // Suppliers are external partners and bypass buyer subscription limits
        if (req.user.role === 'supplier') {
          return next();
        }
        
        let userPerms = [];
        if (['supervisor', 'admin'].includes(req.user.role)) {
          const co = req.user.companyId
            ? await Company.findById(req.user.companyId).select('plan').lean()
            : null;
          userPerms = resolveEffectivePermissions(req.user, co?.plan);
        } else if (req.user.companyId) {
          const supervisor = await User.findOne({ companyId: req.user.companyId, role: 'supervisor' }).lean();
          const co = await Company.findById(req.user.companyId).select('plan').lean();
          userPerms = supervisor
            ? resolveEffectivePermissions(supervisor, co?.plan)
            : [];
        }
        
        // If at least one of the required perms is present in userPerms, we pass!
        const hasAccess = perms.some(p => userPerms.includes(p));
        
        if (!hasAccess) {
          return res.status(403).json({ 
            error: `Access Denied: This operation requires one of [${perms.join(', ')}] permissions, which are currently inactive or not ticked for your workspace.` 
          });
        }
        
        return next();
      } catch (err) {
        console.error('[authMiddleware] requirePermission error:', err);
        return res.status(500).json({ error: 'Failed to verify custom permissions.' });
      }
    })().catch(next);
  };
}
