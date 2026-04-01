import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { buildPortalState } from '../services/portalState.js';

const router = Router();

router.use(requireAuth);

router.get('/state', async (req, res) => {
  try {
    const state = await buildPortalState(req.user.companyId);
    res.json(state);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load portal state.' });
  }
});

export default router;
