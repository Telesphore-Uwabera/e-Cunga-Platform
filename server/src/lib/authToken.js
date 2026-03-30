import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ecunga-dev-secret';

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      companyId: user.companyId,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
