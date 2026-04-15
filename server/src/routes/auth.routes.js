import { Router } from 'express';
import {
  authenticateUser,
  changeDemoUserPassword,
  consumePasswordReset,
  createPasswordReset,
  createWorkspaceUser,
  updateDemoUserProfile,
  createDemoSupplierUser,
} from '../lib/demoAuthStore.js';
import { getDemoCredentialsPayload } from '../config/demoEnv.js';
import { signAuthToken } from '../lib/authToken.js';
import { requireAuth } from '../middleware/auth.js';
import { isDatabaseReady } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import { authenticateMongoUser, createMongoWorkspaceUser, createMongoSupplierUser, toAuthUser } from '../lib/mongoAuth.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import InviteCredentialSetup from '../models/InviteCredentialSetup.js';
import { createAndEmailInviteOtp } from '../lib/inviteCredentials.js';
import { logActivity } from '../services/activity.js';
import { handleGoogleCallback, handleMicrosoftCallback } from '../lib/oauthHandlers.js';
import { getOAuthConfig, generateOAuthState, isOAuthConfigured } from '../config/oauth.js';

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
    phone: user.phone ?? '',
    jobTitle: user.jobTitle ?? '',
    timeZone: user.timeZone ?? 'Africa/Kigali',
    notifyEmailDigest: user.notifyEmailDigest !== false,
    notifySecurityAlerts: user.notifySecurityAlerts !== false,
    notifyProductUpdates: Boolean(user.notifyProductUpdates),
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
    const { companyName, fullName, email, password, industry, role, phone, location } = req.body || {};
    if (!companyName || !fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required registration fields.' });
    }

    if (isDatabaseReady()) {
      let created;
      if (role === 'supplier') {
        created = await createMongoSupplierUser({ companyName, fullName, email, password, industry, phone, location });
      } else {
        created = await createMongoWorkspaceUser({ companyName, fullName, email, password, industry });
      }
      return res.status(201).json({
        pendingApproval: role !== 'supplier', // Suppliers don't need approval
        message: created.message,
        companyName: created.companyName,
        email: created.email,
        role: role,
      });
    }

    let user;
    if (role === 'supplier') {
      user = await createDemoSupplierUser({ companyName, fullName, email, password, industry, phone, location });
    } else {
      user = await createWorkspaceUser({ companyName, fullName, email, password, industry });
    }

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

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    if (!isDatabaseReady()) {
      const updated = updateDemoUserProfile(req.user.id, b);
      if (!updated) return res.status(404).json({ error: 'User not found.' });
      const profile = await publicUserProfile(updated);
      return res.json({ user: profile });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (b.fullName !== undefined) {
      const v = String(b.fullName).trim();
      if (v) user.fullName = v;
    }
    if (b.team !== undefined) user.team = String(b.team).trim();
    if (b.location !== undefined) user.location = String(b.location).trim();
    if (b.phone !== undefined) user.phone = String(b.phone).trim().slice(0, 40);
    if (b.jobTitle !== undefined) user.jobTitle = String(b.jobTitle).trim().slice(0, 120);
    if (b.timeZone !== undefined) {
      user.timeZone = String(b.timeZone).trim().slice(0, 80) || 'Africa/Kigali';
    }
    if (b.notifyEmailDigest !== undefined) user.notifyEmailDigest = Boolean(b.notifyEmailDigest);
    if (b.notifySecurityAlerts !== undefined) user.notifySecurityAlerts = Boolean(b.notifySecurityAlerts);
    if (b.notifyProductUpdates !== undefined) user.notifyProductUpdates = Boolean(b.notifyProductUpdates);

    await user.save();
    await logActivity(user.companyId, user._id, 'user.profile.updated', {
      meta: { keys: Object.keys(b).filter((k) => b[k] !== undefined) },
    });

    const lean = await User.findById(user._id).lean();
    const profile = await publicUserProfile(toAuthUser(lean));
    res.json({ user: profile });
  } catch (e) {
    console.error('[auth] PATCH /me:', e);
    res.status(500).json({ error: 'Unable to update profile.' });
  }
});

router.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    if (!isDatabaseReady()) {
      const result = await changeDemoUserPassword(req.user.id, currentPassword, newPassword);
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.json({ message: 'Password updated.' });
    }

    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect.' });
    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    await logActivity(user.companyId, user._id, 'user.password.changed', { meta: {} });
    res.json({ message: 'Password updated.' });
  } catch (e) {
    console.error('[auth] PATCH /me/password:', e);
    res.status(500).json({ error: 'Unable to change password.' });
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

router.get('/google', (req, res) => {
  if (!isOAuthConfigured('google')) {
    return res.status(400).json({ error: 'Google OAuth is not configured' });
  }
  
  const state = generateOAuthState();
  const config = getOAuthConfig();
  
  // Store state in session or cookie (simplified here)
  res.cookie('oauth_state', state, { httpOnly: true, secure: false, maxAge: 600000 }); // 10 minutes
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.google.clientID);
  authUrl.searchParams.set('redirect_uri', config.google.callbackURL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.google.scope.join(' '));
  authUrl.searchParams.set('state', state);
  
  res.redirect(authUrl.toString());
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;
    
    if (!state || state !== storedState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    res.clearCookie('oauth_state');
    
    const result = await handleGoogleCallback(code, state);
    
    // Redirect to frontend with token
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/auth/callback?token=${result.token}`);
  } catch (error) {
    console.error('[auth] Google OAuth error:', error);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/login?error=${encodeURIComponent(error.message)}`);
  }
});

// Microsoft OAuth routes
router.get('/microsoft', (req, res) => {
  if (!isOAuthConfigured('microsoft')) {
    return res.status(400).json({ error: 'Microsoft OAuth is not configured' });
  }
  
  const state = generateOAuthState();
  const config = getOAuthConfig();
  
  // Store state in session or cookie (simplified here)
  res.cookie('oauth_state', state, { httpOnly: true, secure: false, maxAge: 600000 }); // 10 minutes
  
  const authUrl = new URL(config.microsoft.authorizationURL);
  authUrl.searchParams.set('client_id', config.microsoft.clientID);
  authUrl.searchParams.set('redirect_uri', config.microsoft.callbackURL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.microsoft.scope.join(' '));
  authUrl.searchParams.set('state', state);
  
  res.redirect(authUrl.toString());
});

router.get('/microsoft/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;
    
    if (!state || state !== storedState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    res.clearCookie('oauth_state');
    
    const result = await handleMicrosoftCallback(code, state);
    
    // Redirect to frontend with token
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/auth/callback?token=${result.token}`);
  } catch (error) {
    console.error('[auth] Microsoft OAuth error:', error);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/login?error=${encodeURIComponent(error.message)}`);
  }
});

export default router;
