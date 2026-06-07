import PortalNotification from '../models/PortalNotification.js';
import User from '../models/User.js';
import { notifyUser, notifyRole } from './notify.js';
import { clerkCanAccessStockItem, compactNotifyScope, stockItemNotifyScope } from './orgScope.js';

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
 * When expiry is within 1–30 days: notify the owning clerk (email + inbox) and all company supervisors
 * (for clerk-owned stock only). Deduped ~48h per item title.
 */
export async function notifyExpiryApproachingIfNeeded({ companyId, item }) {
  const exp = parseExpiry(item.expiryDate);
  if (!exp) return;
  const days = daysUntilExpiry(exp);
  if (days <= 0 || days > 30) return;

  const ownerId = String(item.ownerId || '').trim();
  if (!ownerId) return;

  const title = `Expiry approaching: ${item.name}`;
  const since = new Date(Date.now() - 48 * 3600 * 1000);
  const recent = await PortalNotification.findOne({ companyId, title, createdAt: { $gte: since } }).lean();
  if (recent) return;

  const body = `${item.name} expires in ${days} day(s) (${item.expiryDate}).`;

  const owner = await User.findById(ownerId).select('role companyId').lean();
  if (!owner || String(owner.companyId) !== String(companyId)) return;

  if (owner.role === 'clerk') {
    await notifyUser(ownerId, title, body, 'warn');
  } else {
    const clerks = await User.find({ companyId, role: 'clerk', isActive: true })
      .select('_id location department team')
      .lean();
    for (const clerk of clerks) {
      if (!clerkCanAccessStockItem(clerk, item)) continue;
      await notifyUser(String(clerk._id), title, body, 'warn', { skipEmail: true });
    }
  }

  await notifyRole(companyId, 'supervisor', title, body, 'warn', compactNotifyScope(stockItemNotifyScope(item)));
}
