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
import {
  emailWorkspaceInviteTemporaryPassword,
  emailWorkspaceUserDeleted,
} from '../services/registrationNotifications.js';
import { nextUserIncrementalId } from '../lib/sequence.js';
import InviteCredentialSetup from '../models/InviteCredentialSetup.js';
import PasswordReset from '../models/PasswordReset.js';
import { purgeTenantCompanyData } from '../services/companyPurge.js';
import { getPlanAllowedPermissions, getDefaultPermissions } from '../lib/permissions.js';

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

function isBlank(value) {
  return !String(value || '').trim();
}

function safeMember(u, opts = {}) {
  return {
    id: u._id,
    incrementalId: u.incrementalId ?? null,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    team: u.team,
    jobTitle: u.jobTitle,
    location: u.location,
    department: u.department || '',
    phone: u.phone,
    companyId: u.companyId,
    companyName: opts.companyName ?? u.companyName ?? '',
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
  };
}

router.get('/users', async (req, res) => {
  try {
    const actorCompany = await Company.findById(companyId(req)).select('isPlatformTenant').lean();
    const scopeAll = req.user.role === 'admin' && actorCompany?.isPlatformTenant;
    const q = scopeAll ? {} : { companyId: companyId(req) };
    const rows = await User.find(q).select('-passwordHash').sort({ fullName: 1 }).lean();
    const cIds = [...new Set(rows.map((u) => u.companyId).filter(Boolean))];
    const comps = cIds.length ? await Company.find({ _id: { $in: cIds } }).select('_id name').lean() : [];
    const nm = Object.fromEntries(comps.map((c) => [c._id, c.name]));
    res.json({
      users: rows.map((u) => safeMember(u, { companyName: nm[u.companyId] || u.companyName || '' })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Unable to list users.' });
  }
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

    const isPlatformNewTenant =
      req.user.role === 'admin' && company.isPlatformTenant && b.companyName && ['supervisor', 'supplier'].includes(role);

    // Admin creating a new tenant entity directly:
    if (isPlatformNewTenant) {
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

    // Supervisors stay bound to workspace seat limits; admins can invite without cap.
    if (req.user.role !== 'admin') {
      const count = await User.countDocuments({ companyId: targetCompanyId });
      if (count >= targetLimit) {
        return res.status(400).json({ error: 'User seat limit reached for this company.' });
      }
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
    const inviteJobTitle = String(b.jobTitle ?? b.team ?? '').trim();
    const invitePhone = String(b.phone ?? '').trim();
    const inviteLocation = String(b.location ?? '').trim();
    const inviteDepartment = String(b.department ?? '').trim();
    if (
      req.user.role === 'supervisor' &&
      ['clerk', 'accountant'].includes(role) &&
      (isBlank(fullName) || isBlank(inviteJobTitle) || isBlank(invitePhone) || isBlank(inviteLocation) || isBlank(inviteDepartment))
    ) {
      return res
        .status(400)
        .json({ error: 'Full name, job title, phone, location, and department are required for clerk/accountant invites.' });
    }
    const newTeamMemberNoticeBody = `${fullName} — ${email}${inviteLocation ? ` — ${inviteLocation}` : ''}. Added as ${role}.`;
    /** Supplier: OTP + Activate flow. Clerk / accountant / supervisor: temporary password emailed when mail is configured. */
    const useEmailOtp = role === 'supplier' && !b.password && isSmtpConfigured();
    const useTemporaryPasswordInviteEmail =
      ['clerk', 'accountant', 'supervisor'].includes(role) && !b.password && isSmtpConfigured();

    const tempPassword = b.password ? String(b.password) : `Invite-${crypto.randomBytes(6).toString('hex')}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const orgForInviteEmail = await Company.findById(targetCompanyId).select('name logoUrl').lean();
    const inviteEmailCompanyName = String(orgForInviteEmail?.name || targetCompanyName || '').trim() || targetCompanyName;
    const inviteEmailLogoUrl = isPlatformNewTenant
      ? String(b.logoUrl || '').trim()
      : String(orgForInviteEmail?.logoUrl ?? company.logoUrl ?? '').trim();
    const inviteEmailSource = isPlatformNewTenant ? 'platform' : 'organization';

    await User.create({
      _id: userId,
      incrementalId,
      companyId: targetCompanyId,
      companyName: inviteEmailCompanyName,
      fullName,
      email,
      passwordHash,
      role,
      team: '',
      jobTitle: inviteJobTitle,
      phone: invitePhone,
      location: inviteLocation,
      department: inviteDepartment,
      isActive: useEmailOtp ? false : true,
      industry: targetIndustry,
      invitePending: Boolean(useEmailOtp),
      logoUrl: inviteEmailLogoUrl,
      permissions: getDefaultPermissions(role, company.plan || 'essential'),
    });

    let inviteEmailSent = false;
    let inviteEmailKind = null;
    if (useEmailOtp) {
      await createAndEmailInviteOtp({
        userId,
        email,
        fullName,
        companyName: inviteEmailCompanyName,
        role,
      });
      inviteEmailSent = true;
      inviteEmailKind = 'otp';
    } else if (useTemporaryPasswordInviteEmail) {
      const mailResult = await emailWorkspaceInviteTemporaryPassword({
        to: email,
        fullName,
        companyName: inviteEmailCompanyName,
        role,
        temporaryPassword: tempPassword,
        companyLogoUrl: inviteEmailLogoUrl,
        inviteSource: inviteEmailSource,
      });
      inviteEmailSent = Boolean(mailResult.ok && !mailResult.skipped);
      if (inviteEmailSent) inviteEmailKind = 'temporary_password';
    }

    await logActivity(targetCompanyId, req.user.id, 'user.invited', {
      meta: { email, role, fullName, location: inviteLocation },
    });
    const teamAddedGuideMeta = {
      newMemberEmail: email,
      newMemberRole: role,
      organizationName: inviteEmailCompanyName,
      newMemberName: fullName,
      newMemberLocation: inviteLocation,
      newMemberDepartment: inviteDepartment,
    };
    await notifyRole(targetCompanyId, 'supervisor', 'New team member', newTeamMemberNoticeBody, 'neutral', {
      excludeEmails: [email],
      guideType: 'team_member_added',
      guideMeta: teamAddedGuideMeta,
    });
    if (targetCompanyId === companyId(req)) {
      await notifyRole(companyId(req), 'admin', 'New team member', newTeamMemberNoticeBody, 'neutral', {
        excludeEmails: [email],
        guideType: 'team_member_added',
        guideMeta: teamAddedGuideMeta,
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
    const cnToggle =
      (await Company.findById(updated.companyId).select('name').lean())?.name || updated.companyName || '';
    res.json({ user: safeMember(updated, { companyName: cnToggle }) });
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
    if (b.jobTitle !== undefined) user.jobTitle = String(b.jobTitle).trim();
    if (b.phone !== undefined) user.phone = String(b.phone).trim();
    if (b.location !== undefined) user.location = String(b.location);
    if (b.department !== undefined) user.department = String(b.department).trim();
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
    const nextRole = String(b.role || user.role || '').trim();
    if (
      req.user.role === 'supervisor' &&
      ['clerk', 'accountant'].includes(nextRole) &&
      (isBlank(user.fullName) || isBlank(user.jobTitle || user.team) || isBlank(user.phone) || isBlank(user.location) || isBlank(user.department))
    ) {
      return res
        .status(400)
        .json({ error: 'Clerk/accountant profiles must include full name, job title, phone, location, and department.' });
    }

    const targetCompany = await Company.findById(user.companyId).lean();
    if (!targetCompany) return res.status(404).json({ error: 'User company not found.' });

    if (b.permissions !== undefined) {
      if (!Array.isArray(b.permissions)) {
        return res.status(400).json({ error: 'Permissions must be an array.' });
      }
      const isSuperOrAdmin = ['supervisor', 'admin'].includes(user.role) || ['supervisor', 'admin'].includes(b.role || '');
      const allowedList = isSuperOrAdmin 
        ? getPlanAllowedPermissions('custom') 
        : getPlanAllowedPermissions(targetCompany.plan || 'essential');
      const invalid = b.permissions.filter(p => !allowedList.includes(p));
      if (invalid.length > 0) {
        return res.status(400).json({
          error: `Permissions [${invalid.join(', ')}] are not allowed under your company's active plan (${targetCompany.plan || 'essential'}). Please upgrade your plan to unlock these premium features.`
        });
      }
      user.permissions = b.permissions;
    } else if (b.role !== undefined) {
      // If role is updated but no permissions specified, auto-initialize default permissions for the new role
      user.permissions = getDefaultPermissions(b.role, targetCompany.plan || 'essential');
    }

    await user.save();
    const updated = await User.findById(user._id).select('-passwordHash').lean();
    const cn =
      (await Company.findById(updated.companyId).select('name').lean())?.name || updated.companyName || '';
    res.json({ user: safeMember(updated, { companyName: cn }) });
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

    const deletedEmail = user.email;
    const deletedName = user.fullName || '';
    const deletedCompanyId = user.companyId;
    const companyRow =
      (await Company.findById(deletedCompanyId).select('name isPlatformTenant').lean()) || null;
    const deletedCompanyName = companyRow?.name || user.companyName || '';

    await emailWorkspaceUserDeleted({
      to: deletedEmail,
      fullName: deletedName,
      companyName: deletedCompanyName,
    }).catch((e) => console.error('[workspace] delete notify email:', e));

    await InviteCredentialSetup.deleteMany({ userId: user._id });
    await PasswordReset.deleteMany({ userId: user._id });

    await User.deleteOne({ _id: user._id });

    await logActivity(companyId(req), req.user.id, 'user.deleted', {
      meta: {
        deletedUserId: user._id,
        deletedUserEmail: deletedEmail,
        deletedUserFullName: deletedName,
        deletedUserLocation: user.location || '',
        deletedCompanyId,
      },
    });

    let purgedCompanyId = null;
    const remaining = await User.countDocuments({ companyId: deletedCompanyId });
    if (remaining === 0 && companyRow && !companyRow.isPlatformTenant) {
      const purge = await purgeTenantCompanyData(deletedCompanyId);
      if (purge.ok) purgedCompanyId = deletedCompanyId;
      else if (purge.reason !== 'company_not_found') {
        console.error('[workspace] company purge after last user:', purge.reason, deletedCompanyId);
      }
    }

    res.json({ ok: true, deletedId: user._id, purgedCompanyId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete user.' });
  }
});

export default router;
