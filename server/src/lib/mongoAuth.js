import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import Company from '../models/Company.js';
import User from '../models/User.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function toAuthUser(doc) {
  if (!doc) return null;
  const u = doc.toObject ? doc.toObject() : doc;
  return {
    id: u._id,
    _id: u._id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    companyName: u.companyName,
    industry: u.industry,
    team: u.team,
    location: u.location,
    isActive: u.isActive,
  };
}

export async function authenticateMongoUser(email, password) {
  const row = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');
  if (!row || !row.isActive) return null;
  const ok = await bcrypt.compare(String(password || ''), row.passwordHash);
  if (!ok) return null;
  return toAuthUser(row);
}

export async function createMongoWorkspaceUser({ companyName, fullName, email, password, industry }) {
  const normalizedEmail = normalizeEmail(email);
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    throw new Error('An account with that email already exists.');
  }

  const companyId = `company_${crypto.randomUUID()}`;
  const userId = crypto.randomUUID();

  await Company.create({
    _id: companyId,
    name: String(companyName).trim(),
    industry: String(industry || 'Other').trim(),
    type: 'Healthcare / enterprise',
    language: 'EN',
    currency: 'RWF',
    usersLimit: 10,
  });

  const passwordHash = await bcrypt.hash(String(password), 10);
  await User.create({
    _id: userId,
    companyId,
    companyName: String(companyName).trim(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'admin',
    industry: String(industry || 'Other').trim(),
    team: 'Executive',
    location: 'HQ Kigali',
    isActive: true,
  });

  const created = await User.findById(userId).lean();
  return toAuthUser(created);
}

export async function getMongoUserById(id) {
  const row = await User.findById(id).lean();
  return row ? toAuthUser(row) : null;
}
