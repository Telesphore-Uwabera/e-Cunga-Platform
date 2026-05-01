import mongoose from 'mongoose';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { notifyRole } from '../services/notify.js';
import { isSmtpConfigured } from '../services/mail.js';
import { createAndEmailInviteOtp } from '../lib/inviteCredentials.js';
import { emailWorkspaceInviteTemporaryPassword } from '../services/registrationNotifications.js';
import { nextUserIncrementalId } from '../lib/sequence.js';

const router = Router();

/** Workspace membership is always scoped to the signed-in user’s company (JWT → DB); clients must not send companyId. */
function rejectClientSuppliedCompany(req, res, next) {
  if (req.query?.companyId != null) {
    return res.status(400).json({ error: 'companyId must not be supplied by the client.' });
  }
  const b = req.body;
  if (b && typeof b === 'object' && b.companyId != null) {
    return res.status(400).json({ error: 'companyId must not be supplied by the client.' });
  }
  next();
}

/**
 * Customer companies: only supervisors manage clerks, accountants, and suppliers for their registration (companyId).
 * Platform-tenant admins (isPlatformTenant) keep full workspace user APIs for operations/demo.
 */
function requireSupervisorOrPlatformTenantAdmin(req, res, next) {
  (async () => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (req.user.role === 'supervisor') {
      next();
      return;
    }
    if (req.user.role === 'admin') {
      const company = await Company.findById(req.user.companyId).select('isPlatformTenant').lean();
      if (company?.isPlatformTenant) {
        next();
        return;
      }
      res.status(403).json({
        error:
          'Operational users (clerks, accountants, suppliers) are managed by your company’s supervisors. Admins here are independent of that roster.',
      });
      return;
    }
    res.status(403).json({ error: 'Forbidden.' });
  })().catch(next);
}

router.use(requireAuth, requireRoles('admin', 'supervisor'), rejectClientSuppliedCompany, requireSupervisorOrPlatformTenantAdmin);

function companyId(req) {
  return req.user.companyId;
}

function safeMember(u) {
  return {
    id: u._id,
    incrementalId: u.incrementalId ?? null,
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

    const b = req.body || {};
    const role = b.role;
    
    let targetCompanyId = companyId(req);
    let targetCompanyName = company.name;
    let targetIndustry = company.industry;
    let targetLimit = company.usersLimit;

    // Admin creating a new tenant entity directly:
    if (req.user.role === 'admin' && company.isPlatformTenant && b.companyName && ['supervisor', 'supplier'].includes(role)) {
      const logoUrl = String(b.logoUrl || '').trim();
      const newCompanyId = role === 'supplier' ? `supplier_company_${crypto.randomUUID()}` : `company_${crypto.randomUUID()}`;
      const newComp = await Company.create({
        _id: newCompanyId,
        name: String(b.companyName).trim(),
        type: role === 'supplier' ? 'Supplier' : 'Client',
        registrationStatus: 'active',
        language: 'EN',
        currency: 'RWF',
        usersLimit: role === 'supplier' ? 5 : 10,
        industry: 'Other',
        logoUrl,
      });
      targetCompanyId = newComp._id;
      targetCompanyName = newComp.name;
      targetIndustry = newComp.industry;
      targetLimit = newComp.usersLimit;
    }

    const count = await User.countDocuments({ companyId: targetCompanyId });
    if (count >= targetLimit) {
      return res.status(400).json({ error: 'User seat limit reached for this company.' });
    }

    const email = String(b.email || '').trim().toLowerCase();
    const adminRoles = ['clerk', 'supervisor', 'accountant', 'supplier'];
    const supervisorRoles = ['clerk', 'accountant', 'supplier'];
    const allowed = req.user.role === 'supervisor' ? supervisorRoles : adminRoles;
    if (!email || !allowed.includes(role)) {
      return res.status(400).json({ error: 'Valid email and role are required.' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const userId = crypto.randomUUID();
    const incrementalId = await nextUserIncrementalId();
    const fullName = String(b.fullName || email).trim();
    /** Supplier: OTP + Activate flow. Clerk / accountant / supervisor: temporary password emailed when mail is configured. */
    const useEmailOtp = role === 'supplier' && !b.password && isSmtpConfigured();
    const useTemporaryPasswordInviteEmail =
      ['clerk', 'accountant', 'supervisor'].includes(role) && !b.password && isSmtpConfigured();

    const tempPassword = b.password ? String(b.password) : `Invite-${crypto.randomBytes(6).toString('hex')}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const inviteLogoUrl =
      req.user.role === 'admin' && company.isPlatformTenant && b.companyName && ['supervisor', 'supplier'].includes(role)
        ? String(b.logoUrl || '').trim()
        : '';

    await User.create({
      _id: userId,
      incrementalId,
      companyId: targetCompanyId,
      companyName: targetCompanyName,
      fullName,
      email,
      passwordHash,
      role,
      team: String(b.team || 'Operations'),
      location: String(b.location || 'HQ Kigali'),
      isActive: useEmailOtp ? false : true,
      industry: targetIndustry,
      invitePending: Boolean(useEmailOtp),
      logoUrl: inviteLogoUrl,
    });

    let inviteEmailSent = false;
    let inviteEmailKind = null;
    if (useEmailOtp) {
      await createAndEmailInviteOtp({
        userId,
        email,
        fullName,
        companyName: targetCompanyName,
        role,
      });
      inviteEmailSent = true;
      inviteEmailKind = 'otp';
    } else if (useTemporaryPasswordInviteEmail) {
      const mailResult = await emailWorkspaceInviteTemporaryPassword({
        to: email,
        fullName,
        companyName: targetCompanyName,
        role,
        temporaryPassword: tempPassword,
      });
      inviteEmailSent = Boolean(mailResult.ok && !mailResult.skipped);
      if (inviteEmailSent) inviteEmailKind = 'temporary_password';
    }

    await logActivity(targetCompanyId, req.user.id, 'user.invited', { meta: { email, role } });
    await notifyRole(targetCompanyId, 'supervisor', 'Team updated', `${email} was added as ${role}.`, 'neutral', {
      excludeEmails: [email],
    });
    if (targetCompanyId === companyId(req)) {
      await notifyRole(companyId(req), 'admin', 'Team updated', `${email} was added as ${role}.`, 'neutral', {
        excludeEmails: [email],
      });
    }

    const created = await User.findById(userId).select('-passwordHash').lean();
    res.status(201).json({
      user: safeMember(created),
      temporaryPassword:
        useEmailOtp || b.password || (useTemporaryPasswordInviteEmail && inviteEmailSent) ? undefined : tempPassword,
      inviteEmailSent,
      inviteEmailKind,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to invite user.' });
  }
});

router.patch('/users/:id/toggle-active', async (req, res) => {
  try {
    const query = {
      $or: [
        { _id: req.params.id },
        ...(mongoose.Types.ObjectId.isValid(req.params.id) ? [{ _id: new mongoose.Types.ObjectId(req.params.id) }] : [])
      ]
    };
    if (req.user.role !== 'admin') {
      query.companyId = companyId(req);
    }
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot deactivate the admin role from this endpoint.' });
    }
    if (req.user.role === 'supervisor' && ['admin', 'supervisor'].includes(user.role)) {
      return res.status(403).json({ error: 'Supervisors can only toggle clerk, accountant, and supplier accounts.' });
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
    const query = {
      $or: [
        { _id: req.params.id },
        ...(mongoose.Types.ObjectId.isValid(req.params.id) ? [{ _id: new mongoose.Types.ObjectId(req.params.id) }] : [])
      ]
    };
    if (req.user.role !== 'admin') {
      query.companyId = companyId(req);
    }
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'admin' && req.body?.role && req.body.role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change primary admin role here.' });
    }
    if (req.user.role === 'supervisor' && ['admin', 'supervisor'].includes(user.role)) {
      return res.status(403).json({ error: 'Supervisors cannot edit admin or supervisor accounts here.' });
    }

    const b = req.body || {};
    if (b.fullName !== undefined) user.fullName = String(b.fullName).trim();
    if (b.team !== undefined) user.team = String(b.team);
    if (b.location !== undefined) user.location = String(b.location);
    if (b.role !== undefined) {
      const allowedPatch =
        req.user.role === 'supervisor'
          ? ['clerk', 'accountant', 'supplier']
          : ['clerk', 'supervisor', 'accountant', 'supplier', 'admin'];
      if (!allowedPatch.includes(b.role)) {
        return res.status(403).json({ error: 'Invalid role for this action.' });
      }
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
router.delete('/users/:id', async (req, res) => {
  try {
    const query = {
      $or: [
        { _id: req.params.id },
        ...(mongoose.Types.ObjectId.isValid(req.params.id) ? [{ _id: new mongoose.Types.ObjectId(req.params.id) }] : [])
      ]
    };
    if (req.user.role !== 'admin') {
      query.companyId = companyId(req);
    }
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the admin role account.' });
    }
    if (req.user.role === 'supervisor' && user.role === 'supervisor') {
      return res.status(403).json({ error: 'Supervisors cannot delete other supervisors.' });
    }

    await User.deleteOne({ _id: user._id });

    await logActivity(companyId(req), req.user.id, 'user.deleted', {
      meta: { deletedUserId: user._id, deletedUserEmail: user.email },
    });

    res.json({ ok: true, deletedId: user._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete user.' });
  }
});

export default router;
