import Requisition from '../models/Requisition.js';
import User from '../models/User.js';
import { allocateRequisitionId } from '../lib/requisitionIds.js';
import { logActivity } from './activity.js';
import { messageRole, notifyRole } from './notify.js';

const AUTO_TITLE_PREFIX = 'Auto restock: ';

/**
 * When stock falls at or below minimum, create a submitted requisition for the item owner (deduped).
 */
export async function ensureAutoRestockRequisition({ companyId, ownerId, item, clerkName, location }) {
  if (!item || Number(item.quantity) > Number(item.minThreshold || 0)) return null;

  const title = `${AUTO_TITLE_PREFIX}${item.name}`;
  const existing = await Requisition.findOne({
    companyId,
    clerkId: ownerId,
    status: 'submitted',
    title,
  }).lean();
  if (existing) return existing;

  const maxT = Math.max(0, Number(item.maxThreshold) || 0);
  const minT = Math.max(0, Number(item.minThreshold) || 0);
  const qNow = Math.max(0, Number(item.quantity) || 0);
  let qty = maxT > 0 ? Math.max(0, maxT - qNow) : Math.max(minT || 1, 1);
  if (qty <= 0) qty = Math.max(minT || 1, 1);

  const owner = ownerId ? await User.findById(ownerId).lean() : null;
  const id = await allocateRequisitionId(companyId, 'auto');

  const doc = await Requisition.create({
    _id: id,
    companyId,
    title,
    clerkId: ownerId || String(item.ownerId),
    clerkName: clerkName || owner?.fullName || 'Clerk',
    location: location || item.location || owner?.location || 'Warehouse',
    status: 'submitted',
    priority: 'high',
    supervisorNote: 'Created automatically when stock fell to or below minimum.',
    lines: [
      {
        description: item.name,
        quantity: qty,
        unit: item.unit || 'units',
        estimatedCost: 0,
      },
    ],
  });

  await logActivity(companyId, ownerId || String(item.ownerId), 'stock.auto_requisition', {
    meta: { requisitionId: doc._id, itemId: item._id },
  });
  await notifyRole(companyId, 'supervisor', 'Auto requisition created', `${title} — please review.`, 'warn');
  await messageRole(companyId, 'supervisor', 'Auto restock pending', `${title} is in the approval queue.`, doc.clerkName);
  await notifyRole(
    companyId,
    'accountant',
    'Requisition pending',
    `${title} may need budget once supervisor approves.`,
    'neutral'
  );

  return doc;
}
