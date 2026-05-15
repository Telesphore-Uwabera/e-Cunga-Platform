import Requisition from '../models/Requisition.js';
import User from '../models/User.js';
import { allocateRequisitionId } from '../lib/requisitionIds.js';
import { logActivity } from './activity.js';
import { messageRole, notifyRole } from './notify.js';
import { compactNotifyScope, requisitionNotifyScope } from './orgScope.js';

const AUTO_TITLE_PREFIX = 'Auto restock: ';

/**
 * Periodic check: find ALL items at or below minimum threshold across ALL companies
 * and ensure an auto-requisition exists for each.
 * Grouped by companyId + ownerId into a single batch requisition.
 */
export async function runBatchAutoRequisitions() {
  const StockItem = (await import('../models/StockItem.js')).default;
  const items = await StockItem.find({
    $expr: { $lte: ['$quantity', '$minThreshold'] }
  }).lean();

  if (!items.length) {
    console.log('[cron] No low stock items found.');
    return;
  }

  console.log(`[cron] Batch auto-requisition check started for ${items.length} items...`);

  // Group by companyId + ownerId
  const groups = new Map();
  for (const item of items) {
    const key = `${item.companyId}:${item.ownerId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  let requisitionsCreated = 0;

  for (const [key, groupItems] of groups.entries()) {
    const [companyId, ownerId] = key.split(':');
    
    try {
      // Find ALL pending requisitions for this company to check for duplicates
      const pendingReqs = await Requisition.find({
        companyId,
        status: { $in: ['submitted', 'approved'] }
      }).lean();

      // Collect all item descriptions already requested
      const alreadyRequestedNames = new Set();
      for (const pr of pendingReqs) {
        for (const line of pr.lines || []) {
          if (line.description) alreadyRequestedNames.add(line.description.trim().toLowerCase());
        }
      }

      // Filter groupItems to only those not already requested
      const itemsToRequest = groupItems.filter(item => 
        !alreadyRequestedNames.has(item.name.trim().toLowerCase())
      );

      if (itemsToRequest.length === 0) continue;

      const date = new Date();
      const monthStr = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const title = `${AUTO_TITLE_PREFIX}Batch ${monthStr}`;
      
      const owner = ownerId !== 'undefined' ? await User.findById(ownerId).lean() : null;
      const id = await allocateRequisitionId(companyId, 'auto');

      const lines = itemsToRequest.map(item => {
        const maxT = Math.max(0, Number(item.maxThreshold) || 0);
        const minT = Math.max(0, Number(item.minThreshold) || 0);
        const qNow = Math.max(0, Number(item.quantity) || 0);
        let qty = maxT > 0 ? Math.max(0, maxT - qNow) : Math.max(minT || 1, 1);
        if (qty <= 0) qty = Math.max(minT || 1, 1);
        
        return {
          description: item.name,
          quantity: qty,
          unit: item.unit || 'units',
          estimatedCost: 0
        };
      });

      const doc = await Requisition.create({
        _id: id,
        companyId,
        title,
        clerkId: ownerId !== 'undefined' ? ownerId : (itemsToRequest[0].ownerId || 'system'),
        clerkName: owner?.fullName || 'Inventory System',
        location: itemsToRequest[0].location || owner?.location || 'Warehouse',
        requestingDepartment: String(itemsToRequest[0].department || owner?.department || owner?.team || '').trim(),
        status: 'submitted',
        priority: 'high',
        supervisorNote: `Automated batch requisition for ${itemsToRequest.length} low-stock items.`,
        lines
      });

      requisitionsCreated++;

      // Notifications
      const autoScope = compactNotifyScope(requisitionNotifyScope(doc, owner));
      await notifyRole(companyId, 'supervisor', 'Auto batch requisition', `${title} — ${itemsToRequest.length} items need review.`, 'warn', autoScope);
      await messageRole(companyId, 'supervisor', 'Auto restock batch pending', `${title} is in the approval queue.`, doc.clerkName, autoScope);

    } catch (err) {
      console.error(`[cron] Failed grouped auto-requisition for ${key}:`, err.message);
    }
  }

  console.log(`[cron] Batch auto-requisition check finished. Requisitions created: ${requisitionsCreated}`);
}
