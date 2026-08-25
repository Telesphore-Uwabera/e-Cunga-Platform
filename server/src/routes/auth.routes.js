import crypto from 'node:crypto';
import { Router } from 'express';
import { signAuthToken } from '../lib/authToken.js';
import { requireAuth } from '../middleware/auth.js';
import { isDatabaseReady } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import { authenticateMongoUser, createMongoWorkspaceUser, createMongoSupplierUser, toAuthUser } from '../lib/mongoAuth.js';
import { resolveEffectivePermissions } from '../lib/permissions.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import InviteCredentialSetup from '../models/InviteCredentialSetup.js';
import { createAndEmailInviteOtp, generateInviteOtp6 } from '../lib/inviteCredentials.js';
import { logActivity } from '../services/activity.js';
import { handleGoogleCallback, handleMicrosoftCallback } from '../lib/oauthHandlers.js';
import { getOAuthConfig, generateOAuthState, isOAuthConfigured } from '../config/oauth.js';
import multer from 'multer';
import { configureCloudinary, isCloudinaryConfigured, uploadBufferToCloudinary } from '../lib/cloudinaryClient.js';
import { sendWelcomeEmail } from '../services/mailer.js';
import { emailNewCompanyRegistrationToAdmins } from '../services/registrationNotifications.js';
import { sendMail } from '../services/mail.js';
import { MAIL_PRODUCT_NAME, buildEmailDocument, emailCredentialBox, emailParagraph, mailSubjectPrefix, escapeHtml } from '../services/emailLayout.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = Router();

function normalizeEmailAuth(email) {
  return String(email || '').trim().toLowerCase();
}

async function passwordMatchesExisting(user, candidatePassword) {
  if (!user?.passwordHash) return false;
  return bcrypt.compare(String(candidatePassword), user.passwordHash);
}

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
    department: user.department || '',
    location: user.location,
    phone: user.phone ?? '',
    jobTitle: user.jobTitle ?? '',
    timeZone: user.timeZone ?? 'Africa/Kigali',
    notifyEmailDigest: user.notifyEmailDigest !== false,
    notifySecurityAlerts: user.notifySecurityAlerts !== false,
    notifyProductUpdates: Boolean(user.notifyProductUpdates),
    notifyWorkflowEmails: user.notifyWorkflowEmails !== false,
    isActive: user.isActive,
    logoUrl: user.logoUrl || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function publicUserProfile(user) {
  const base = safeUser(user);
  
  let perms = [];
  const co = user?.companyId ? await Company.findById(user.companyId).select('plan isPlatformTenant').lean() : null;
  if (user && ['supervisor', 'admin'].includes(user.role)) {
    perms = resolveEffectivePermissions(user, co?.plan);
  } else if (user && user.companyId) {
    const supervisor = await User.findOne({ companyId: user.companyId, role: 'supervisor' }).lean();
    perms = supervisor ? resolveEffectivePermissions(supervisor, co?.plan) : [];
  }

  if (!isDatabaseReady() || user.role !== 'admin') {
    return { ...base, permissions: perms, canApproveRegistrations: false };
  }
  return { ...base, permissions: perms, canApproveRegistrations: Boolean(co?.isPlatformTenant) };
}

router.get('/demo-credentials', (_req, res) => {
  res.json({
    password: '',
    accounts: [],
    message: 'Use your organization account. Demo credential hints are disabled.',
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isDatabaseReady()) {
    return res.status(503).json({
      error: 'Sign-in requires a configured database (MONGODB_URI).',
      code: 'DATABASE_UNAVAILABLE',
    });
  }
  const result = await authenticateMongoUser(email, password);
  if (result.rejectedCompany) {
    return res.status(403).json({
      error: result.message,
      code: 'REGISTRATION_REJECTED',
    });
  }
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
});

router.post('/register', upload.single('logo'), async (req, res) => {
  try {
    const { companyName, fullName, email, password, industry, role, phone, location, position } = req.body || {};
    let { logoUrl } = req.body || {};
    if (!companyName || !fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required registration fields.' });
    }

    // Handle file upload if present
    if (req.file && isCloudinaryConfigured()) {
      try {
        configureCloudinary();
        const folder = `ecunga/registrations/${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const result = await uploadBufferToCloudinary(req.file.buffer, { folder });
        logoUrl = result.secure_url;
      } catch (uploadErr) {
        console.error('[auth] logo upload failed:', uploadErr);
        // We continue registration without logo if upload fails, or we could error out.
        // For premium feel, let's error if they intentionally tried to upload one.
        return res.status(400).json({ error: 'Logo upload failed. Please try again without a logo or with a smaller image.' });
      }
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ error: 'Registration requires a configured database.' });
    }
    let created;
    if (role === 'supplier') {
      created = await createMongoSupplierUser({ companyName, fullName, email, password, industry, phone, location, logoUrl });
    } else {
      created = await createMongoWorkspaceUser({
        companyName,
        fullName,
        email,
        password,
        industry,
        logoUrl,
        phone,
        jobTitle: position,
      });
    }
    sendWelcomeEmail({ fullName, email, role }).catch((err) => console.error('[auth] welcome email failed:', err));

    emailNewCompanyRegistrationToAdmins({
      companyId: created.companyId,
      companyName: created.companyName,
      industry,
      supervisorName: fullName,
      supervisorEmail: email,
      registeredAt: new Date().toISOString(),
    }).catch((err) => console.error('[auth] admin notification failed:', err));

    return res.status(201).json({
      pendingApproval: true,
      message: created.message,
      companyName: created.companyName,
      email: created.email,
      role: role,
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
      return res.status(503).json({ error: 'Profile updates require a configured database.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (b.fullName !== undefined) {
      const v = String(b.fullName).trim();
      if (v) user.fullName = v;
    }
    if (b.team !== undefined) user.team = String(b.team).trim();
    if (b.department !== undefined) user.department = String(b.department).trim();
    if (b.location !== undefined) user.location = String(b.location).trim();
    if (b.phone !== undefined) user.phone = String(b.phone).trim().slice(0, 40);
    if (b.jobTitle !== undefined) user.jobTitle = String(b.jobTitle).trim().slice(0, 120);
    if (b.timeZone !== undefined) {
      user.timeZone = String(b.timeZone).trim().slice(0, 80) || 'Africa/Kigali';
    }
    if (b.logoUrl !== undefined) user.logoUrl = String(b.logoUrl).trim();
    if (b.notifyEmailDigest !== undefined) user.notifyEmailDigest = Boolean(b.notifyEmailDigest);
    if (b.notifySecurityAlerts !== undefined) user.notifySecurityAlerts = Boolean(b.notifySecurityAlerts);
    if (b.notifyProductUpdates !== undefined) user.notifyProductUpdates = Boolean(b.notifyProductUpdates);
    if (b.notifyWorkflowEmails !== undefined) user.notifyWorkflowEmails = Boolean(b.notifyWorkflowEmails);

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
    const { currentPassword, newPassword, otp } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!otp || String(otp).trim().length !== 6) {
      return res.status(400).json({ error: 'A 6-digit verification code is required.' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ error: 'Password changes require a configured database.' });
    }

    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Verify current password
    const pwOk = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!pwOk) return res.status(400).json({ error: 'Current password is incorrect.' });

    if (await passwordMatchesExisting(user, newPassword)) {
      return res.status(400).json({ error: 'New password must be different from your current password.' });
    }

    // Verify OTP
    const otpRecord = await InviteCredentialSetup.findOne({
      userId: String(req.user.id),
      email: user.email,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Verification code expired or not found. Please request a new code.' });
    }
    if (otpRecord.attempts >= 5) {
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }

    const otpMatch = await bcrypt.compare(String(otp).trim(), otpRecord.otpHash);
    if (!otpMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = 5 - otpRecord.attempts;
      return res.status(400).json({
        error: `Incorrect verification code.${remaining > 0 ? ` ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` : ' Please request a new code.'}`,
      });
    }

    // Mark OTP used
    otpRecord.used = true;
    await otpRecord.save();

    // Update password
    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await user.save();

    await logActivity(user.companyId, user._id, 'user.password.changed', { meta: {} });

    // Send security notification email
    if (user.notifySecurityAlerts !== false) {
      const html = buildEmailDocument({
        headline: 'Password changed',
        preheader: 'Your e-Cunga Portal password was just updated.',
        bodyHtml: [
          emailParagraph(`Hi ${escapeHtml(user.fullName || user.email)},`),
          emailParagraph(`Your password was successfully changed on <strong>${new Date().toLocaleString('en-US', { timeZone: 'Africa/Kigali' })}</strong> (Kigali time).`),
          emailParagraph(`If you did not make this change, please reset your password immediately using the link below and contact your administrator.`),
        ].join(''),
        ctaPath: '/forgot-password',
        ctaLabel: 'Reset password now',
        footerLine: `${MAIL_PRODUCT_NAME} — security alert`,
      });
      sendMail({ to: user.email, subject: `${mailSubjectPrefix()} Your password was changed`, html, text: `Your e-Cunga Portal password was changed. If this wasn't you, go to ${process.env.CLIENT_URL}/forgot-password` }).catch(() => {});
    }

    res.json({ message: 'Password updated.' });
  } catch (e) {
    console.error('[auth] PATCH /me/password:', e);
    res.status(500).json({ error: 'Unable to change password.' });
  }
});

/** Request a 6-digit OTP to the user's email before changing their password. */
router.post('/me/password-otp', requireAuth, async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ error: 'Database not available.' });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required.' });
    }
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Enter a valid new password (at least 8 characters) before requesting a code.' });
    }

    const user = await User.findById(req.user.id).select('+passwordHash email fullName companyName notifySecurityAlerts');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const pwOk = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!pwOk) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    if (await passwordMatchesExisting(user, newPassword)) {
      return res.status(400).json({ error: 'New password must be different from your current password.' });
    }

    const otp = generateInviteOtp6();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Replace any existing unused OTPs for this user
    await InviteCredentialSetup.deleteMany({ userId: String(req.user.id), used: false });
    await InviteCredentialSetup.create({
      userId: String(req.user.id),
      email: user.email,
      otpHash,
      expiresAt,
      used: false,
      attempts: 0,
    });

    const innerOtp = `<span style="font-size:34px;font-weight:800;color:#692751;letter-spacing:6px;font-family:Consolas,monospace;">${escapeHtml(otp)}</span>
      <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">This code expires in 15 minutes.</p>`;

    // Send OTP email
    const html = buildEmailDocument({
      headline: 'Your password change code',
      preheader: 'Use this code to confirm your password change.',
      bodyHtml: [
        emailParagraph(`Hi ${escapeHtml(user.fullName || user.email)},`),
        emailParagraph(`You requested to change your password on <strong>${escapeHtml(user.companyName || 'e-Cunga Portal')}</strong>. Use the 6-digit code below to confirm. This code expires in <strong>15 minutes</strong>.`),
        emailCredentialBox('Verification code', innerOtp),
        emailParagraph(`If you did not request a password change, you can safely ignore this email. Your password will not be changed.`),
      ].join(''),
      footerLine: `${MAIL_PRODUCT_NAME} — security verification`,
    });

    const mailResult = await sendMail({
      to: user.email,
      subject: `${mailSubjectPrefix()} Password change verification code`,
      html,
      text: `Your e-Cunga Portal password change verification code is: ${otp}\n\nExpires in 15 minutes. If you did not request this, ignore this email.`,
    });

    // Always return success — don't reveal if email delivery failed
    if (!mailResult?.ok) {
      console.warn(`[auth] OTP email not delivered to ${user.email} — code logged for dev:`, otp);
    }

    console.log(`[auth] Password OTP sent to ${user.email}${!mailResult?.ok ? ` (mail not configured — dev OTP: ${otp})` : ''}`);

    res.json({ message: `A 6-digit verification code has been sent to ${user.email.replace(/(.{2}).*@/, '$1***@')}.`, sent: true });
  } catch (e) {
    console.error('[auth] POST /me/password-otp:', e);
    res.status(500).json({ error: 'Unable to send verification code.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const rawEmail = req.body?.email;
  const email = normalizeEmailAuth(rawEmail);

  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Password reset requires a configured database.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const user = await User.findOne({ email }).lean();
  if (!user) {
    return res.json({ sent: false });
  }

  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  await PasswordReset.updateMany({ userId: user._id, used: false }, { $set: { used: true } });
  await PasswordReset.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(raw)}`;
  const html = buildEmailDocument({
    preheader: `Reset your ${MAIL_PRODUCT_NAME} password`,
    headline: 'Password reset',
    accent: 'brand',
    bodyHtml:
      `${emailParagraph('We received a request to reset your password. Use the secure link below — it expires in one hour.')}
           ${emailParagraph(`If you did not request this, you may ignore this email. Your password will remain unchanged.`)}`,
    ctaLabel: 'Choose a new password',
    ctaPath: `/reset-password?token=${encodeURIComponent(raw)}`,
    footerLine: `${MAIL_PRODUCT_NAME} · security`,
  });
  await sendMail({
    to: user.email,
    subject: `${mailSubjectPrefix()} Password reset`,
    text: `Reset your password: ${resetUrl}`,
    html,
  }).catch((err) => console.error('[auth] forgot-password email failed:', err));

  return res.json({ sent: true });
});

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
    if (await passwordMatchesExisting(user, password)) {
      return res.status(400).json({ error: 'Choose a password that is different from your temporary password.' });
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

  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Password reset requires a configured database.' });
  }

  const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
  const row = await PasswordReset.findOne({
    tokenHash,
    used: false,
    expiresAt: { $gt: new Date() },
  });
  if (!row) {
    return res.status(400).json({ error: 'Reset token is invalid or expired.' });
  }

  const user = await User.findById(row.userId).select('+passwordHash email fullName notifySecurityAlerts');
  if (!user) {
    return res.status(400).json({ error: 'User no longer exists.' });
  }

  if (await passwordMatchesExisting(user, password)) {
    return res.status(400).json({ error: 'New password must be different from your previous password.' });
  }

  row.used = true;
  await row.save();
  user.passwordHash = await bcrypt.hash(String(password), 10);
  await user.save();

  await logActivity(user.companyId, user._id, 'user.password.reset', { meta: {} });

  if (user.notifySecurityAlerts !== false) {
    const html = buildEmailDocument({
      headline: 'Password reset complete',
      preheader: 'Your e-Cunga Portal password was reset.',
      bodyHtml: [
        emailParagraph(`Hi ${escapeHtml(user.fullName || user.email)},`),
        emailParagraph(`Your password was successfully reset on <strong>${new Date().toLocaleString('en-US', { timeZone: 'Africa/Kigali' })}</strong> (Kigali time).`),
        emailParagraph(`If you did not reset your password, contact support immediately.`),
      ].join(''),
      ctaPath: '/forgot-password',
      ctaLabel: 'Request another reset',
      footerLine: `${MAIL_PRODUCT_NAME} — security alert`,
    });
    sendMail({
      to: user.email,
      subject: `${mailSubjectPrefix()} Your password was reset`,
      html,
      text: `Your e-Cunga Portal password was reset. If this wasn't you, go to ${process.env.CLIENT_URL || 'http://localhost:5173'}/forgot-password`,
    }).catch(() => {});
  }

  return res.json({
    message: `Password updated for ${user.email}.`,
  });
});

router.get('/google', (req, res) => {
  const clientUrl = String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  if (!isOAuthConfigured('google')) {
    return res.redirect(
      `${clientUrl}/login?error=${encodeURIComponent('Google sign-in is not configured. Use email and password, or ask your administrator.')}`
    );
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
  const clientUrl = String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  if (!isOAuthConfigured('microsoft')) {
    return res.redirect(
      `${clientUrl}/login?error=${encodeURIComponent('Microsoft sign-in is not configured. Use email and password, or ask your administrator.')}`
    );
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
