import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/suppliers', requireRoles('accountant', 'admin', 'supervisor'), async (req, res) => {
  const cid = String(req.user.companyId);
  const users = await User.find({ companyId: cid, role: 'supplier', isActive: true })
    .select('email fullName role')
    .sort({ fullName: 1 })
    .lean();
  res.json({ users });
});

export default router;
