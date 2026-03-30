import { Router } from 'express';
import Invoice from '../models/Invoice.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId._id || req.user.companyId;
}

router.get('/', async (req, res) => {
  const cid = companyId(req);
  const role = req.user.role;
  let q = { companyId: cid };
  if (role === 'supplier') {
    q.supplierId = req.user._id;
  }
  const invoices = await Invoice.find(q).sort({ updatedAt: -1 });
  res.json({ invoices });
});

router.post('/', requireRoles('accountant', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const doc = await Invoice.create({
      companyId: companyId(req),
      stockRequestId: b.stockRequestId || undefined,
      supplierId: b.supplierId || undefined,
      createdBy: req.user._id,
      type: b.type === 'final' ? 'final' : 'proforma',
      status: b.status && ['draft', 'sent'].includes(b.status) ? b.status : 'draft',
      reference: b.reference,
      amount: b.amount != null ? Number(b.amount) : undefined,
      currency: b.currency || 'RWF',
      notes: b.notes,
    });
    await logActivity(companyId(req), req.user._id, 'invoice.created', { entityId: doc._id, meta: { type: doc.type } });
    res.status(201).json({ invoice: doc });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Invalid invoice' });
  }
});

router.patch('/:id', async (req, res) => {
  const doc = await Invoice.findOne({ _id: req.params.id, companyId: companyId(req) });
  if (!doc) return res.status(404).json({ error: 'Not found' });

  const role = req.user.role;
  const b = req.body || {};
  const supplierMatches = !doc.supplierId || String(doc.supplierId) === String(req.user._id);

  if (role === 'supplier' && !supplierMatches) {
    return res.status(403).json({ error: 'Not your invoice' });
  }

  if (role === 'supplier') {
    if (b.attachmentUrl !== undefined) doc.attachmentUrl = String(b.attachmentUrl);
    if (b.status === 'sent') doc.status = 'sent';
    await doc.save();
    await logActivity(companyId(req), req.user._id, 'invoice.supplier_update', { entityId: doc._id });
    return res.json({ invoice: doc });
  }

  if (role === 'accountant' || role === 'admin') {
    if (b.status && ['approved', 'rejected', 'paid', 'sent', 'draft'].includes(b.status)) {
      doc.status = b.status;
    }
    if (b.amount !== undefined) doc.amount = Number(b.amount);
    if (b.notes !== undefined) doc.notes = String(b.notes);
    if (b.status === 'paid') {
      doc.paidAt = new Date();
      doc.paidBy = req.user._id;
    }
    await doc.save();
    await logActivity(companyId(req), req.user._id, 'invoice.accountant_update', { entityId: doc._id, meta: { status: doc.status } });
    return res.json({ invoice: doc });
  }

  return res.status(403).json({ error: 'Forbidden' });
});

export default router;
