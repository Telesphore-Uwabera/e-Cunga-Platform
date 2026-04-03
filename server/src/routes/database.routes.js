import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { listDatabaseCollectionsMeta, syncDatabaseCollections } from '../services/databaseCollections.js';

const router = Router();

/**
 * Allow sync with X-Database-Setup-Key when DATABASE_SETUP_KEY is set (bootstrap),
 * otherwise require an authenticated admin.
 */
function requireSetupOrAdmin(req, res, next) {
  const secret = process.env.DATABASE_SETUP_KEY?.trim();
  if (secret && req.get('x-database-setup-key') === secret) {
    return next();
  }
  requireAuth(req, res, () => requireRoles('admin')(req, res, next));
}

/** Create/update collections and sync indexes from Mongoose schemas */
router.post('/sync', requireSetupOrAdmin, async (_req, res) => {
  try {
    const summary = await syncDatabaseCollections();
    res.json({
      ok: true,
      message: 'Collections ensured and indexes synchronized.',
      ...summary,
    });
  } catch (error) {
    console.error('[database/sync]', error);
    res.status(500).json({ error: error.message || 'Database sync failed.' });
  }
});

/** Inspect database and model-backed collection names */
router.get('/status', requireSetupOrAdmin, async (_req, res) => {
  try {
    const meta = await listDatabaseCollectionsMeta();
    res.json({ ok: true, ...meta });
  } catch (error) {
    console.error('[database/status]', error);
    res.status(500).json({ error: error.message || 'Failed to read database status.' });
  }
});

export default router;
