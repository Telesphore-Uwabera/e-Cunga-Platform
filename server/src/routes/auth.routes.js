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
import { authenticateMongoUser, createMongoWorkspaceUser } from '../lib/mongoAuth.js';

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
  let user;
  if (isDatabaseReady()) {
    user = await authenticateMongoUser(email, password);
  } else {
    user = await authenticateUser(email, password);
  }
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
    user: safeUser(user),
  });
});

router.post('/register', async (req, res) => {
  try {
    const { companyName, fullName, email, password, industry } = req.body || {};
    if (!companyName || !fullName || !email || !password) {
      return res.status(400).json({ error: 'Missing required registration fields.' });
    }

    let user;
    if (isDatabaseReady()) {
      user = await createMongoWorkspaceUser({ companyName, fullName, email, password, industry });
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
      user: safeUser(user),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to create account.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
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
