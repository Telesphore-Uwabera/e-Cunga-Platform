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
      // 1. Verify that 'requisitions:auto' (AI Auto-Requisitioning) is active/ticked for this company
      const supervisor = await User.findOne({ companyId, role: 'supervisor' }).lean();
      const perms = supervisor && Array.isArray(supervisor.permissions) ? supervisor.permissions : [];
      if (!perms.includes('requisitions:auto')) {
        continue;
      }
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
        status: 'draft',
        priority: 'high',
        supervisorNote: `Automated batch requisition for ${itemsToRequest.length} low-stock items.`,
        lines
      });

      requisitionsCreated++;

      // Notifications - Notify the clerk about the draft
      const clerkIdNotify = ownerId !== 'undefined' ? ownerId : (itemsToRequest[0].ownerId || 'system');
      if (clerkIdNotify !== 'system') {
        const autoScope = compactNotifyScope(requisitionNotifyScope(doc, owner));
        await messageRole(companyId, 'clerk', 'Auto-Requisition Draft Ready', `An auto-requisition draft for ${itemsToRequest.length} items has been generated. Please review, edit, or submit it. If left alone, it will auto-submit tomorrow.`, 'System', autoScope);
      }

    } catch (err) {
      console.error(`[cron] Failed grouped auto-requisition for ${key}:`, err.message);
    }
  }

  console.log(`[cron] Batch auto-requisition check finished. Requisitions created: ${requisitionsCreated}`);
}

/**
 * Runs on the 15th and last day of the month.
 * Submits auto-drafts created the previous day.
 * Cancels the draft if the clerk created a manual requisition in the past 48 hours.
 */
export async function autoSubmitDrafts() {
  console.log(`[cron] Auto-submit drafts check started...`);

  // Find all draft requisitions that are auto-generated
  const drafts = await Requisition.find({
    status: 'draft',
    title: { $regex: '^Auto restock:' }
  }).lean();

  if (!drafts.length) {
    console.log('[cron] No auto-requisition drafts found to submit.');
    return;
  }

  let submittedCount = 0;
  let cancelledCount = 0;

  for (const draft of drafts) {
    try {
      // Check if a manual requisition was created recently (within last 48 hours) by this company
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const manualReqs = await Requisition.find({
        companyId: draft.companyId,
        status: { $in: ['submitted', 'approved'] },
        title: { $not: { $regex: '^Auto restock:' } }, // Ignore auto-requisitions
        createdAt: { $gte: fortyEightHoursAgo }
      }).lean();

      if (manualReqs.length > 0) {
        // Clerk made a manual requisition recently, so cancel this draft
        await Requisition.updateOne({ _id: draft._id }, { status: 'cancelled' });
        cancelledCount++;
        console.log(`[cron] Cancelled auto-draft ${draft._id} due to recent manual requisition.`);
        
        const autoScope = compactNotifyScope(requisitionNotifyScope(draft, null));
        await messageRole(draft.companyId, 'clerk', 'Auto-Draft Cancelled', `Your auto-requisition draft was cancelled because you recently submitted a manual request.`, 'System', autoScope);
        continue;
      }

      // No manual requisition, so submit the draft
      await Requisition.updateOne({ _id: draft._id }, { status: 'submitted' });
      submittedCount++;
      console.log(`[cron] Submitted auto-draft ${draft._id}.`);

      // Notify the supervisor
      const autoScope = compactNotifyScope(requisitionNotifyScope(draft, null));
      await notifyRole(draft.companyId, 'supervisor', 'Auto batch requisition', `${draft.title} — needs your review.`, 'warn', autoScope);
      await messageRole(draft.companyId, 'supervisor', 'Auto restock batch pending', `${draft.title} is in the approval queue.`, draft.clerkName || 'System', autoScope);

    } catch (err) {
      console.error(`[cron] Failed to process auto-draft ${draft._id}:`, err.message);
    }
  }

  console.log(`[cron] Auto-submit check finished. Submitted: ${submittedCount}, Cancelled: ${cancelledCount}`);
}

