import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ecunga-dev-secret';

function tokenUserId(user) {
  if (!user || typeof user !== 'object') return '';
  const raw = user.id != null ? user.id : user._id;
  return raw != null ? String(raw) : '';
}

export function signAuthToken(user) {
  const sub = tokenUserId(user);
  if (!sub) {
    throw new Error('Cannot issue auth token: missing user id.');
  }
  const companyId = user.companyId != null ? String(user.companyId) : '';
  return jwt.sign(
    {
      sub,
      role: user.role,
      companyId,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
