import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { notifyRole } from '../services/notify.js';

const router = Router();

router.use(requireAuth, requireRoles('admin'));

function companyId(req) {
  return req.user.companyId;
}

function safeMember(u) {
  return {
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    team: u.team,
    location: u.location,
  };
}

router.get('/users', async (req, res) => {
  const users = await User.find({ companyId: companyId(req) }).select('-passwordHash').sort({ fullName: 1 }).lean();
  res.json({ users: users.map(safeMember) });
});

router.post('/users/invite', async (req, res) => {
  try {
    const company = await Company.findById(companyId(req));
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    const count = await User.countDocuments({ companyId: companyId(req) });
    if (count >= company.usersLimit) {
      return res.status(400).json({ error: 'User seat limit reached.' });
    }

    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const role = b.role;
    if (!email || !['clerk', 'supervisor', 'accountant', 'supplier'].includes(role)) {
      return res.status(400).json({ error: 'Valid email and operational role are required.' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const tempPassword = b.password ? String(b.password) : `Invite-${crypto.randomBytes(6).toString('hex')}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const userId = crypto.randomUUID();

    await User.create({
      _id: userId,
      companyId: companyId(req),
      companyName: company.name,
      fullName: String(b.fullName || email).trim(),
      email,
      passwordHash,
      role,
      team: String(b.team || 'Operations'),
      location: String(b.location || 'HQ Kigali'),
      isActive: true,
      industry: company.industry,
    });

    await logActivity(companyId(req), req.user.id, 'user.invited', { meta: { email, role } });
    await notifyRole(companyId(req), 'admin', 'Team updated', `${email} was added as ${role}.`, 'neutral');

    const created = await User.findById(userId).select('-passwordHash').lean();
    res.status(201).json({
      user: safeMember(created),
      temporaryPassword: b.password ? undefined : tempPassword,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to invite user.' });
  }
});

router.patch('/users/:id/toggle-active', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot deactivate the admin role from this endpoint.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    await logActivity(companyId(req), req.user.id, 'user.toggled', {
      meta: { userId: user._id, isActive: user.isActive },
    });

    const updated = await User.findById(user._id).select('-passwordHash').lean();
    res.json({ user: safeMember(updated) });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to update user.' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'admin' && req.body?.role && req.body.role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change primary admin role here.' });
    }

    const b = req.body || {};
    if (b.fullName !== undefined) user.fullName = String(b.fullName).trim();
    if (b.team !== undefined) user.team = String(b.team);
    if (b.location !== undefined) user.location = String(b.location);
    if (b.role !== undefined && ['clerk', 'supervisor', 'accountant', 'supplier', 'admin'].includes(b.role)) {
      user.role = b.role;
    }

    await user.save();
    const updated = await User.findById(user._id).select('-passwordHash').lean();
    res.json({ user: safeMember(updated) });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to update user.' });
  }
});

export default router;
