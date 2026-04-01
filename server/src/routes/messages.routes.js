import { Router } from 'express';
import PortalMessage from '../models/PortalMessage.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const role = req.user.role;
  const messages = await PortalMessage.find({ companyId: req.user.companyId, role })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({
    messages: messages.map((m) => ({
      id: m._id,
      role: m.role,
      title: m.title,
      body: m.body,
      from: m.from,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    })),
  });
});

export default router;
