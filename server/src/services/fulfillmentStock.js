import StockItem from '../models/StockItem.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Increase on-hand stock from requisition lines when a workflow closes (match by item name).
 */
export async function applyRequisitionLinesToStock(companyId, reqDoc) {
  if (!reqDoc?.lines?.length) return { updated: [] };
  const clerkId = reqDoc.clerkId;
  const updated = [];

  for (const line of reqDoc.lines) {
    const desc = String(line.description || '').trim();
    const addQty = Math.max(0, Number(line.quantity) || 0);
    if (!desc || addQty <= 0) continue;

    const rx = new RegExp(`^${escapeRegex(desc)}$`, 'i');
    let stockDoc = await StockItem.findOne({ companyId, ownerId: clerkId, name: rx });
    if (!stockDoc) {
      stockDoc = await StockItem.findOne({ companyId, name: rx });
    }
    if (!stockDoc) continue;

    stockDoc.quantity = Math.max(0, Number(stockDoc.quantity || 0) + addQty);
    await stockDoc.save();
    updated.push({ itemId: stockDoc._id, name: stockDoc.name, added: addQty });
  }

  return { updated };
}
