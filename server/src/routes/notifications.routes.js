import { Router } from 'express';
import PortalNotification from '../models/PortalNotification.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const role = req.user.role;
  const userId = req.user.id;
  // Also include notifications targeted directly to this user (for independent suppliers)
  const notifications = await PortalNotification.find({
    $or: [{ companyId: req.user.companyId, role }, { userId }],
  })
    .sort({ createdAt: -1 })
    .limit(150)
    .lean();

  res.json({
    notifications: notifications.map((n) => ({
      id: n._id,
      role: n.role,
      severity: n.severity,
      title: n.title,
      body: n.body,
      isRead: Boolean(n.isRead),
      createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
    })),
  });
});

router.patch('/:id/read', async (req, res) => {
  try {
    const n = await PortalNotification.findById(req.params.id);
    if (!n) return res.status(404).json({ error: 'Not found' });
    n.isRead = true;
    await n.save();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
