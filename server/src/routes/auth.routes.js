import { Router } from 'express';
import {
  authenticateUser,
  consumePasswordReset,
  createPasswordReset,
  createWorkspaceUser,
} from '../lib/demoAuthStore.js';
import { getDemoCredentialsPayload } from '../config/demoEnv.js';
import { signAuthToken } from '../lib/authToken.js';
import { requireAuth } from '../middleware/auth.js';
import { isDatabaseReady } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import { authenticateMongoUser, createMongoWorkspaceUser } from '../lib/mongoAuth.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import InviteCredentialSetup from '../models/InviteCredentialSetup.js';
import { createAndEmailInviteOtp } from '../lib/inviteCredentials.js';

const router = Router();

function safeUser(user) {
  return {
    id: user.id,
    _id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.companyName,
    industry: user.industry,
    team: user.team,
    location: user.location,
    isActive: user.isActive,
  };
}

async function publicUserProfile(user) {
  const base = safeUser(user);
  if (!isDatabaseReady() || user.role !== 'admin') {
    return { ...base, canApproveRegistrations: false };
  }
  const c = await Company.findById(user.companyId).select('isPlatformTenant').lean();
  return { ...base, canApproveRegistrations: Boolean(c?.isPlatformTenant) };
}

router.get('/demo-credentials', (_req, res) => {
  try {
    res.json(getDemoCredentialsPayload());
  } catch (error) {
    console.error('[auth] demo-credentials:', error);
    res.status(500).json({ error: 'Unable to load demo credential metadata.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (isDatabaseReady()) {
    const result = await authenticateMongoUser(email, password);
    if (result.pendingCompany) {
      return res.status(403).json({
        error: result.message,
        code: 'PENDING_COMPANY_APPROVAL',
      });
    }
    if (result.invitePending) {
      return res.status(403).json({
        error: result.message,
        code: 'INVITE_ACTIVATION_REQUIRED',
      });
    }
    if (result.inactive) {
      return res.status(403).json({
        error: result.message || 'This account is not active.',
        code: 'ACCOUNT_INACTIVE',
      });
    }
    if (!result.ok || !result.user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const profile = await publicUserProfile(result.user);
    return res.json({
      token: signAuthToken({
        id: result.user.id,
        role: result.user.role,
        companyId: result.user.companyId,
        email: result.user.email,
      }),
      user: profile,
    });
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json({
    token: signAuthToken({
      id: user.id,
      role: user.role,
      companyId: user.companyId,
      email: user.email,
    }),
    user: { ...safeUser(user), canApproveRegistrations: false },
  });
});

router.post('/register', async (req, res) => {
  try {
    const { companyName, fullName, email, password, industry } = req.body || {};
    if (!companyName || !fullName || !email || !password) {
      return res.status(400).json({ error: 'Missing required registration fields.' });
    }

    if (isDatabaseReady()) {
      const created = await createMongoWorkspaceUser({ companyName, fullName, email, password, industry });
      return res.status(201).json({
        pendingApproval: true,
        message: created.message,
        companyName: created.companyName,
        email: created.email,
      });
    }

    const user = await createWorkspaceUser({ companyName, fullName, email, password, industry });

    return res.status(201).json({
      token: signAuthToken({
        id: user.id,
        role: user.role,
        companyId: user.companyId,
        email: user.email,
      }),
      user: { ...safeUser(user), canApproveRegistrations: false },
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to create account.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await publicUserProfile(req.user);
    res.json({ user: profile });
  } catch (e) {
    console.error('[auth] /me:', e);
    res.status(500).json({ error: 'Unable to load profile.' });
  }
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  const { user, token } = createPasswordReset(email);

  if (user && token) {
    console.log(`Password reset token for ${user.email}: ${token}`);
  }

  res.json({
    message: user
      ? 'Reset instructions created. In development, check the server console for the token.'
      : 'If an account exists for that email, reset instructions have been prepared.',
  });
});

function normalizeEmailAuth(email) {
  return String(email || '').trim().toLowerCase();
}

/** Invited clerk / accountant / supplier: set password with email + OTP from invite mail. */
router.post('/complete-invite', async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ error: 'Database mode required.' });
    }
    const { email, otp, password } = req.body || {};
    const normalized = normalizeEmailAuth(email);
    if (!normalized || !otp || !password) {
      return res.status(400).json({ error: 'Enter email, code, and password.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const user = await User.findOne({ email: normalized }).select('+passwordHash');
    if (!user || !user.invitePending) {
      return res.status(400).json({ error: 'No open invitation for this email.' });
    }

    const row = await InviteCredentialSetup.findOne({ userId: user._id, used: false }).sort({ createdAt: -1 });
    if (!row || row.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Ask for a new code on the activation page.' });
    }
    if (row.attempts >= 5) {
      return res.status(400).json({ error: 'Too many wrong codes. Ask your admin to invite you again.' });
    }

    const otpOk = await bcrypt.compare(String(otp).trim(), row.otpHash);
    if (!otpOk) {
      row.attempts += 1;
      await row.save();
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    row.used = true;
    await row.save();

    user.passwordHash = await bcrypt.hash(String(password), 10);
    user.invitePending = false;
    user.isActive = true;
    await user.save();

    return res.json({ message: 'Your password is saved. You can sign in.' });
  } catch (e) {
    console.error('[auth] complete-invite:', e);
    return res.status(500).json({ error: 'Unable to complete activation.' });
  }
});

router.post('/resend-invite-otp', async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ error: 'Database mode required.' });
    }
    const normalized = normalizeEmailAuth(req.body?.email);
    if (!normalized) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ email: normalized });
    if (!user || !user.invitePending) {
      return res.json({
        message: 'If we found an open invitation, we sent a new code.',
      });
    }

    const recent = await InviteCredentialSetup.findOne({ userId: user._id, used: false }).sort({ createdAt: -1 });
    if (recent && recent.createdAt && Date.now() - new Date(recent.createdAt).getTime() < 60_000) {
      return res.status(429).json({ error: 'Wait one minute before you ask for another code.' });
    }

    await createAndEmailInviteOtp({
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      companyName: user.companyName,
      role: user.role,
    });

    return res.json({ message: 'If we found an open invitation, we sent a new code.' });
  } catch (e) {
    console.error('[auth] resend-invite-otp:', e);
    return res.status(500).json({ error: 'Unable to resend code.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const user = await consumePasswordReset(String(token).trim(), String(password));
  if (!user) {
    return res.status(400).json({ error: 'Reset token is invalid or expired.' });
  }

  return res.json({
    message: `Password updated for ${user.email}.`,
  });
});

export default router;
