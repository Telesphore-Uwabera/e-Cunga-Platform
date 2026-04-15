import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getDemoPassword, getDemoUserDefinitions } from '../config/demoEnv.js';

function buildDemoUsers() {
  const pwd = getDemoPassword();
  return getDemoUserDefinitions().map((d) => ({
    ...d,
    passwordHash: bcrypt.hashSync(pwd, 10),
  }));
}

let users = buildDemoUsers();

let resetTokens = [];

function cloneUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return { ...safeUser };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getUserById(id) {
  return cloneUser(users.find((user) => user.id === id));
}

const PROFILE_PATCH_KEYS = [
  'fullName',
  'team',
  'location',
  'phone',
  'jobTitle',
  'timeZone',
  'notifyEmailDigest',
  'notifySecurityAlerts',
  'notifyProductUpdates',
];

export function updateDemoUserProfile(userId, patch) {
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;
  const cur = users[idx];
  const next = { ...cur };
  for (const key of PROFILE_PATCH_KEYS) {
    if (patch[key] === undefined) continue;
    if (key.startsWith('notify')) {
      next[key] = Boolean(patch[key]);
    } else if (key === 'fullName') {
      const v = String(patch[key] || '').trim();
      if (v) next.fullName = v;
    } else {
      next[key] = String(patch[key] ?? '').trim();
    }
  }
  users[idx] = next;
  return cloneUser(next);
}

export async function changeDemoUserPassword(userId, currentPassword, newPassword) {
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return { ok: false, error: 'User not found.' };
  const row = users[idx];
  const ok = await bcrypt.compare(String(currentPassword || ''), row.passwordHash);
  if (!ok) return { ok: false, error: 'Current password is incorrect.' };
  if (String(newPassword || '').length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  users[idx] = { ...row, passwordHash };
  return { ok: true };
}

export function findUserByEmail(email) {
  return users.find((user) => user.email === normalizeEmail(email));
}

export async function authenticateUser(email, password) {
  const user = findUserByEmail(email);
  if (!user || !user.isActive) return null;
  const matches = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!matches) return null;
  return cloneUser(user);
}

export async function createWorkspaceUser({ companyName, fullName, email, password, industry }) {
  const normalizedEmail = normalizeEmail(email);
  if (findUserByEmail(normalizedEmail)) {
    throw new Error('An account with that email already exists.');
  }

  const id = crypto.randomUUID();
  const companyId = `company_${id}`;
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = {
    id,
    companyId,
    companyName: String(companyName).trim(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    industry: String(industry || 'Other').trim(),
    role: 'admin',
    isActive: true,
    passwordHash,
  };
  users = [...users, user];
  return cloneUser(user);
}

export function createPasswordReset(email) {
  const user = findUserByEmail(email);
  if (!user) {
    return { user: null, token: null };
  }

  const token = crypto.randomBytes(24).toString('hex');
  resetTokens = [
    ...resetTokens.filter((entry) => entry.userId !== user.id),
    {
      token,
      userId: user.id,
      expiresAt: Date.now() + 1000 * 60 * 30,
      used: false,
    },
  ];

  return { user: cloneUser(user), token };
}

export async function consumePasswordReset(token, nextPassword) {
  const resetEntry = resetTokens.find((entry) => entry.token === token);
  if (!resetEntry || resetEntry.used || resetEntry.expiresAt < Date.now()) {
    return null;
  }

  const userIndex = users.findIndex((user) => user.id === resetEntry.userId);
  if (userIndex === -1) return null;

  const passwordHash = await bcrypt.hash(String(nextPassword), 10);
  users[userIndex] = {
    ...users[userIndex],
    passwordHash,
  };

  resetTokens = resetTokens.map((entry) =>
    entry.token === token
      ? {
          ...entry,
          used: true,
        }
      : entry
  );

  return cloneUser(users[userIndex]);
}

export function createDemoSupplierUser({ fullName, email, password, companyName, industry, phone, location }) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = users.find((u) => u.email === normalizedEmail);
  if (existingUser) {
    throw new Error('An account with that email already exists.');
  }

  const companyId = `supplier_company_${crypto.randomUUID()}`;
  const userId = crypto.randomUUID();

  const newSupplier = {
    id: userId,
    companyId,
    companyName: String(companyName).trim(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(String(password), 10),
    role: 'supplier',
    industry: String(industry || 'Supplier').trim(),
    team: 'Supplier',
    location: String(location || 'Rwanda').trim(),
    phone: String(phone || '').trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newSupplier);

  return cloneUser(newSupplier);
}
