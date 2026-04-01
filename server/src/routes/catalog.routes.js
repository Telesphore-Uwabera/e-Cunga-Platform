import crypto from 'node:crypto';
import { Router } from 'express';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId;
}

router.get('/', async (req, res) => {
  const q = { companyId: companyId(req) };
  if (req.user.role === 'supplier') {
    q.supplierId = req.user.id;
  }
  const items = await SupplierCatalogItem.find(q).sort({ updatedAt: -1 }).lean();
  res.json({
    supplierCatalog: items.map((row) => ({
      id: row._id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      price: row.price,
      quantity: row.quantity,
      minThreshold: row.minThreshold,
      maxThreshold: row.maxThreshold,
      unit: row.unit,
      description: row.description,
      storageLocation: row.storageLocation,
      listed: row.listed !== false,
    })),
  });
});

router.post('/', requireRoles('supplier', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const supplierId = req.user.role === 'supplier' ? req.user.id : String(b.supplierId || '');
    if (!supplierId) {
      return res.status(400).json({ error: 'supplierId is required when saving catalog as admin.' });
    }

    const id = b.id ? String(b.id) : `sl_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const existing = await SupplierCatalogItem.findOne({ _id: id, companyId: companyId(req) });

    if (existing && req.user.role === 'supplier' && existing.supplierId !== req.user.id) {
      return res.status(403).json({ error: 'Cannot edit another supplier listing.' });
    }

    const maxT = Math.max(1, Math.floor(Number(b.maxThreshold) || 100));
    let minT = Math.max(0, Math.floor(Number(b.minThreshold) || 0));
    if (minT > maxT) minT = maxT;

    const fields = {
      name: String(b.name || '').trim() || 'Untitled listing',
      sku: String(b.sku || '').trim() || `SKU-${id.replace(/\D/g, '').slice(-6) || 'NEW'}`,
      category: String(b.category || 'General').trim() || 'General',
      price: Math.max(0, Number(b.price) || 0),
      quantity: Math.max(0, Math.floor(Number(b.quantity) || 0)),
      minThreshold: minT,
      maxThreshold: maxT,
      unit: String(b.unit || 'units').trim() || 'units',
      description: String(b.description || ''),
      storageLocation: String(b.storageLocation || ''),
      listed: b.listed !== false,
    };

    let row;
    if (existing) {
      Object.assign(existing, fields);
      await existing.save();
      row = existing;
    } else {
      row = await SupplierCatalogItem.create({
        _id: id,
        companyId: companyId(req),
        supplierId,
        ...fields,
      });
    }

    await logActivity(companyId(req), req.user.id, existing ? 'supplier.catalog.updated' : 'supplier.catalog.created', {
      meta: { listingId: row._id, name: row.name },
    });

    res.status(201).json({ item: row });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to save catalog item.' });
  }
});

export default router;
