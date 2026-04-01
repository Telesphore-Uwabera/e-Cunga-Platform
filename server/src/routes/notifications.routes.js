import { Router } from 'express';
import PortalNotification from '../models/PortalNotification.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const role = req.user.role;
  const notifications = await PortalNotification.find({ companyId: req.user.companyId, role })
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
      createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
    })),
  });
});

export default router;
