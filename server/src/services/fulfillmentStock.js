import StockItem from '../models/StockItem.js';
import User from '../models/User.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Increase on-hand stock from requisition lines when a workflow closes.
 * Matches by item name within the same location/department scope as the clerk.
 */
export async function applyRequisitionLinesToStock(companyId, reqDoc) {
  if (!reqDoc?.lines?.length) return { updated: [] };
  
  const clerkId = reqDoc.clerkId;
  const clerk = await User.findById(clerkId).lean();
  const loc = String(clerk?.location || '').trim();
  const dept = String(clerk?.department || '').trim();
  const updated = [];

  for (const line of reqDoc.lines) {
    const desc = String(line.description || '').trim();
    const addQty = Math.max(0, Number(line.quantity) || 0);
    if (!desc || addQty <= 0) continue;

    const rx = new RegExp(`^${escapeRegex(desc)}$`, 'i');
    
    // Search for a matching item in the same location/department first
    let stockDoc = await StockItem.findOne({ 
      companyId, 
      name: rx,
      location: loc,
      department: dept
    });

    if (!stockDoc) {
      // Create new stock item if it doesn't exist anywhere in company
      stockDoc = await StockItem.create({
        _id: `stock_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        companyId,
        ownerId: clerkId,
        name: desc,
        quantity: addQty,
        unit: String(line.unit || 'units'),
        category: 'General',
        location: loc || reqDoc.location || 'Warehouse',
        department: dept || reqDoc.requestingDepartment || '',
        minThreshold: 5,
      });
    } else {
      // Update existing item
      stockDoc.quantity = Math.max(0, Number(stockDoc.quantity || 0) + addQty);
      // If the item was "Check stock" (meaning it might have been in a different location), 
      // we might want to keep its original location, but here we just increase its qty.
      await stockDoc.save();
    }
    updated.push({ itemId: stockDoc._id, name: stockDoc.name, added: addQty });
  }

  return { updated };
}
