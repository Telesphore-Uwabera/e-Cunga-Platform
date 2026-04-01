import { Router } from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRoles('admin'));

router.get('/', async (req, res) => {
  const companyId = String(req.user.companyId);
  const logs = await ActivityLog.find({ companyId })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('userId', 'fullName email role');
  res.json({ logs });
});

export default router;
