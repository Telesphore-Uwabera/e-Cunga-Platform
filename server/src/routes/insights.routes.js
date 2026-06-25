import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { buildWorkspaceSnapshot, generateWorkspaceInsight } from '../services/aiInsights.js';

const router = Router();

const ALLOWED_SCOPES = new Set(['clerk', 'supervisor', 'accountant', 'admin', 'supplier']);
const CACHE_TTL_MS = 3 * 60 * 1000;
/** After a Gemini 429/503, avoid retrying the model for longer to protect quota and the client UX. */
const RATE_LIMIT_CACHE_TTL_MS = 10 * 60 * 1000;
const insightCache = new Map();

function cacheEntryTtlMs(entry) {
  return entry?.cacheTtlMs ?? CACHE_TTL_MS;
}

function resolvedScope(req) {
  const role = req.user?.role;
  const q = String(req.query.scope || '').trim();
  if (role === 'admin' && ALLOWED_SCOPES.has(q)) return q;
  if (ALLOWED_SCOPES.has(role)) return role;
  if (ALLOWED_SCOPES.has(q) && q === role) return q;
  return ALLOWED_SCOPES.has(role) ? role : 'clerk';
}

/** GET /api/insights/workspace?scope=&language=eng|kiny&refresh=1 */
router.get('/workspace', requireAuth, requirePermission('reports:weekly'), async (req, res) => {
  const companyId = req.user.companyId;
  if (!companyId) {
    return res.status(400).json({ error: 'No company on session.' });
  }

  const scope = resolvedScope(req);
  const language = String(req.query.language || 'eng').toLowerCase() === 'kiny' ? 'kiny' : 'eng';
  const cacheKey = `${companyId}|${scope}|${language}`;
  if (String(req.query.refresh || '') === '1') {
    insightCache.delete(cacheKey);
  }
  const now = Date.now();
  const cached = insightCache.get(cacheKey);
  if (cached && now - cached.at < cacheEntryTtlMs(cached)) {
    return res.json({
      ok: true,
      source: cached.source,
      body: cached.body,
      model: cached.model,
      metrics: cached.metrics,
      refreshedAt: new Date(cached.at).toISOString(),
      scope,
      cached: true,
    });
  }

  let metrics = null;
  try {
    const snapshot = await buildWorkspaceSnapshot(companyId, scope, req.user.id);
    metrics = snapshot.metrics;
    const hasKey = Boolean(process.env.GEMINI_API_KEY?.trim());

    if (!hasKey) {
      const payload = {
        ok: true,
        source: 'disabled',
        body: null,
        metrics,
        refreshedAt: new Date().toISOString(),
        scope,
      };
      insightCache.set(cacheKey, {
        at: now,
        source: 'disabled',
        body: null,
        metrics,
      });
      return res.json(payload);
    }

    const result = await generateWorkspaceInsight({
      snapshot,
      role: req.user.role,
      language,
    });

    const payload = {
      ok: true,
      source: result.source,
      body: result.body,
      model: result.model,
      metrics,
      refreshedAt: new Date().toISOString(),
      scope,
    };

    if (result.source === 'gemini' && result.body) {
      insightCache.set(cacheKey, {
        at: now,
        source: result.source,
        body: result.body,
        model: result.model,
        metrics,
      });
    }

    return res.json(payload);
  } catch (error) {
    console.error('[insights/workspace]', error.message || error);
    const statusCode = Number(error.status);
    const isCapacityError =
      statusCode === 429 || statusCode === 503 || statusCode === 529;

    let metricsOut = metrics;
    if (!metricsOut) {
      try {
        const snap = await buildWorkspaceSnapshot(companyId, scope, req.user.id);
        metricsOut = snap.metrics;
      } catch {
        /* ignore */
      }
    }

    if (isCapacityError && metricsOut) {
      const at = Date.now();
      const soft = {
        ok: true,
        source: 'rate_limited',
        body: null,
        metrics: metricsOut,
        refreshedAt: new Date(at).toISOString(),
        scope,
      };
      insightCache.set(cacheKey, {
        at,
        source: 'rate_limited',
        body: null,
        metrics: metricsOut,
        cacheTtlMs: RATE_LIMIT_CACHE_TTL_MS,
      });
      return res.json(soft);
    }

    const status = statusCode >= 400 && statusCode < 600 ? statusCode : 502;
    return res.status(status).json({
      ok: false,
      source: 'error',
      body: null,
      metrics: metricsOut,
      error: 'Unable to generate insight right now.',
    });
  }
});

export default router;
