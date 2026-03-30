import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/suppliers', requireRoles('accountant', 'admin', 'supervisor'), async (req, res) => {
  const companyId = req.user.companyId._id || req.user.companyId;
  const users = await User.find({ companyId, role: 'supplier', isActive: true }).select('email fullName role').sort({ fullName: 1 });
  res.json({ users });
});

export default router;
