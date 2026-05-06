import crypto from 'node:crypto';
import { Router } from 'express';
import StockItem from '../models/StockItem.js';
import Consumption from '../models/Consumption.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { notifyRole } from '../services/notify.js';
import { ensureAutoRestockRequisition } from '../services/autoRequisition.js';
import { notifyExpiryApproachingIfNeeded } from '../services/expiryNotify.js';
import { sendLowStockAlert } from '../services/mailer.js';
import User from '../models/User.js';

const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId;
}

function normalizeSharedScope(value) {
  return String(value || '').trim().toLowerCase();
}

function sharedStockScopeKey(user) {
  const location = normalizeSharedScope(user?.location);
  const department = normalizeSharedScope(user?.department || user?.team);
  if (!location || !department) return '';
  return `${location}::${department}`;
}

async function dispatchLowStockEmail(companyId, item) {
  try {
    const targets = await User.find({
      companyId,
      role: { $in: ['clerk', 'supervisor'] },
      isActive: true,
    }).select('email').lean();
    
    for (const t of targets) {
      await sendLowStockAlert(t.email, [item]).catch(e => console.error('[stock] email alert failed:', e));
    }
  } catch (err) {
    console.error('[stock] dispatch error:', err);
  }
}

router.get('/', async (req, res) => {
  const stockItems = await StockItem.find({ companyId: companyId(req) }).sort({ updatedAt: -1 }).lean();
  res.json({ stockItems });
});

router.get('/:id', async (req, res) => {
  try {
    const item = await StockItem.findOne({ _id: req.params.id, companyId: companyId(req) }).lean();
    if (!item) return res.status(404).json({ error: 'Stock item not found.' });
    res.json({
      stockItem: {
        id: item._id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        subcategory: item.subcategory || '',
        unit: item.unit,
        quantity: item.quantity,
        minThreshold: item.minThreshold,
        maxThreshold: item.maxThreshold,
        expiryDate: item.expiryDate || '',
        batchNumber: item.batchNumber || '',
        location: item.location,
        department: item.department || '',
        ownerId: item.ownerId,
        companyId: item.companyId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to load stock item.' });
  }
});

router.post('/', requireRoles('clerk', 'supervisor', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const id = `stk_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const doc = await StockItem.create({
      _id: id,
      companyId: companyId(req),
      name: String(b.name || '').trim() || 'Untitled item',
      sku: String(b.sku || ''),
      category: String(b.category || 'Uncategorized'),
      subcategory: String(b.subcategory || '').trim(),
      unit: String(b.unit || 'units'),
      quantity: Math.max(0, Number(b.quantity) || 0),
      minThreshold: Math.max(0, Number(b.minThreshold) || 0),
      maxThreshold: Math.max(0, Number(b.maxThreshold) || 0),
      expiryDate: String(b.expiryDate || ''),
      batchNumber: String(b.batchNumber || '').trim(),
      location: String(b.location || 'Warehouse A'),
      department: String(b.department || '').trim(),
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
    await notifyExpiryApproachingIfNeeded({ companyId: companyId(req), item: doc.toObject?.() ? doc.toObject() : doc });
    if (doc.quantity <= doc.minThreshold) {
      await ensureAutoRestockRequisition({
        companyId: companyId(req),
        ownerId: doc.ownerId,
        item: doc.toObject?.() ? doc.toObject() : doc,
        clerkName: req.user.fullName,
        location: doc.location,
      });
    }
    // Email alert
    if (doc.quantity <= doc.minThreshold) {
      dispatchLowStockEmail(companyId(req), doc).catch(() => {});
    }
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
      const owner = await User.findById(item.ownerId).select('role companyId location department team').lean();
      const actorScope = sharedStockScopeKey(req.user);
      const ownerScope = sharedStockScopeKey(owner);
      const canConsumeSharedStock =
        owner &&
        owner.role === 'clerk' &&
        String(owner.companyId || '').trim() === String(companyId(req) || '').trim() &&
        actorScope &&
        actorScope === ownerScope;
      if (!canConsumeSharedStock) {
        return res.status(403).json({ error: 'You can only consume stock from your shared clerk pool.' });
      }
    }

    const qty = Math.max(0, Number(req.body?.quantity) || 0);
    if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive.' });

    item.quantity = Math.max(0, Number(item.quantity) - qty);
    await item.save();

    const conId = `con_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const kindRaw = String(req.body?.consumptionKind || '').toLowerCase();
    const consumptionKind = ['usage', 'bill'].includes(kindRaw) ? kindRaw : 'general';
    await Consumption.create({
      _id: conId,
      companyId: companyId(req),
      itemId: item._id,
      itemName: item.name,
      quantity: qty,
      unit: item.unit,
      clerkId: req.user.id,
      purpose: String(req.body?.purpose || 'Consumption entry'),
      consumptionKind,
      relatedRequisitionId: String(req.body?.relatedRequisitionId || '').trim(),
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
      await ensureAutoRestockRequisition({
        companyId: companyId(req),
        ownerId: item.ownerId,
        item: item.toObject?.() ? item.toObject() : item,
        clerkName: req.user.fullName,
        location: item.location,
      });
    }

    // Email alert
    if (item.quantity <= item.minThreshold) {
      dispatchLowStockEmail(companyId(req), item).catch(() => {});
    }

    await notifyExpiryApproachingIfNeeded({ companyId: companyId(req), item: item.toObject?.() ? item.toObject() : item });

    res.json({ stockItem: item, consumptionId: conId });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to record consumption.' });
  }
});

router.patch('/:id', requireRoles('clerk', 'supervisor', 'admin'), async (req, res) => {
  try {
    const item = await StockItem.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!item) return res.status(404).json({ error: 'Stock item not found.' });

    const b = req.body || {};
    if (b.name !== undefined) item.name = String(b.name).trim();
    if (b.sku !== undefined) item.sku = String(b.sku);
    if (b.category !== undefined) item.category = String(b.category);
    if (b.subcategory !== undefined) item.subcategory = String(b.subcategory).trim();
    if (b.unit !== undefined) item.unit = String(b.unit);
    if (b.quantity !== undefined) item.quantity = Math.max(0, Number(b.quantity) || 0);
    if (b.minThreshold !== undefined) item.minThreshold = Math.max(0, Number(b.minThreshold) || 0);
    if (b.maxThreshold !== undefined) item.maxThreshold = Math.max(0, Number(b.maxThreshold) || 0);
    if (b.expiryDate !== undefined) item.expiryDate = String(b.expiryDate || '');
    if (b.location !== undefined) item.location = String(b.location);
    if (b.batchNumber !== undefined) item.batchNumber = String(b.batchNumber);
    if (b.department !== undefined) item.department = String(b.department || '').trim();

    await item.save();

    await logActivity(companyId(req), req.user.id, 'stock.item.updated', {
      meta: { stockId: item._id, name: item.name },
    });

    if (item.quantity <= item.minThreshold) {
      dispatchLowStockEmail(companyId(req), item).catch(() => {});
    }

    res.json({ stockItem: item });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to update stock item.' });
  }
});

router.delete('/:id', requireRoles('supervisor', 'admin'), async (req, res) => {
  try {
    const item = await StockItem.findOneAndDelete({ _id: req.params.id, companyId: companyId(req) });
    if (!item) return res.status(404).json({ error: 'Stock item not found.' });

    await logActivity(companyId(req), req.user.id, 'stock.item.deleted', {
      meta: { stockId: item._id, name: item.name },
    });

    await notifyRole(
      companyId(req),
      'supervisor',
      'Stock item removed',
      `${item.name} (SKU: ${item.sku || 'N/A'}) was permanently deleted from inventory.`,
      'warn'
    );

    res.json({ deleted: true, id: item._id });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to delete stock item.' });
  }
});

export default router;
