import crypto from 'node:crypto';
import { Router } from 'express';
import StockItem from '../models/StockItem.js';
import Consumption from '../models/Consumption.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { notifyRole } from '../services/notify.js';

const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId;
}

router.get('/', async (req, res) => {
  const stockItems = await StockItem.find({ companyId: companyId(req) }).sort({ updatedAt: -1 }).lean();
  res.json({ stockItems });
});

router.post('/', requireRoles('clerk', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const id = `stk_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const doc = await StockItem.create({
      _id: id,
      companyId: companyId(req),
      name: String(b.name || '').trim() || 'Untitled item',
      sku: String(b.sku || ''),
      category: String(b.category || 'Uncategorized'),
      unit: String(b.unit || 'units'),
      quantity: Math.max(0, Number(b.quantity) || 0),
      minThreshold: Math.max(0, Number(b.minThreshold) || 0),
      maxThreshold: Math.max(0, Number(b.maxThreshold) || 0),
      expiryDate: String(b.expiryDate || ''),
      location: String(b.location || 'Warehouse A'),
      ownerId: String(b.ownerId || req.user.id),
    });
    await logActivity(companyId(req), req.user.id, 'stock.item.added', {
      meta: { stockId: doc._id, name: doc.name },
    });
    await notifyRole(
      companyId(req),
      'supervisor',
      'New stock item registered',
      `${doc.name} was added to the stock register.`,
      'neutral'
    );
    res.status(201).json({ stockItem: doc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to create stock item.' });
  }
});

router.post('/:id/consume', requireRoles('clerk', 'admin'), async (req, res) => {
  try {
    const item = await StockItem.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!item) return res.status(404).json({ error: 'Stock item not found.' });

    if (req.user.role === 'clerk' && item.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You can only consume stock you own.' });
    }

    const qty = Math.max(0, Number(req.body?.quantity) || 0);
    if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive.' });

    item.quantity = Math.max(0, Number(item.quantity) - qty);
    await item.save();

    const conId = `con_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    await Consumption.create({
      _id: conId,
      companyId: companyId(req),
      itemId: item._id,
      itemName: item.name,
      quantity: qty,
      unit: item.unit,
      clerkId: req.user.id,
      purpose: String(req.body?.purpose || 'Consumption entry'),
    });

    await logActivity(companyId(req), req.user.id, 'stock.item.consumed', {
      meta: { itemId: item._id, quantity: qty },
    });

    if (item.quantity <= item.minThreshold) {
      await notifyRole(
        companyId(req),
        'clerk',
        'Low stock warning',
        `${item.name} dropped to ${item.quantity} ${item.unit}.`,
        'warn'
      );
      await notifyRole(
        companyId(req),
        'supervisor',
        'Stock threshold reached',
        `${item.name} is now at or below minimum level.`,
        'warn'
      );
    }

    res.json({ stockItem: item, consumptionId: conId });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to record consumption.' });
  }
});

export default router;
