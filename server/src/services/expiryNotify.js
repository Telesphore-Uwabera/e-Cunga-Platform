import PortalNotification from '../models/PortalNotification.js';
import { notifyRole } from './notify.js';

function parseExpiry(str) {
  if (!str || !String(str).trim()) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntilExpiry(date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const e = new Date(date);
  e.setHours(0, 0, 0, 0);
  return Math.ceil((e.getTime() - now.getTime()) / 86400000);
}

/**
 * Notify clerk + supervisor when expiry is within 1–30 days (deduped ~48h per item title).
 */
export async function notifyExpiryApproachingIfNeeded({ companyId, item }) {
  const exp = parseExpiry(item.expiryDate);
  if (!exp) return;
  const days = daysUntilExpiry(exp);
  if (days <= 0 || days > 30) return;

  const title = `Expiry approaching: ${item.name}`;
  const since = new Date(Date.now() - 48 * 3600 * 1000);
  const recent = await PortalNotification.findOne({ companyId, title, createdAt: { $gte: since } }).lean();
  if (recent) return;

  const body = `${item.name} expires in ${days} day(s) (${item.expiryDate}).`;
  await notifyRole(companyId, 'clerk', title, body, 'warn');
  await notifyRole(companyId, 'supervisor', title, body, 'warn');
}
