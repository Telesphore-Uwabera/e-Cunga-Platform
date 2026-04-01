import crypto from 'node:crypto';
import { Router } from 'express';
import Requisition from '../models/Requisition.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { messageRole, notifyRole } from '../services/notify.js';

const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId;
}

router.get('/', async (req, res) => {
  const requisitions = await Requisition.find({ companyId: companyId(req) }).sort({ updatedAt: -1 }).limit(500).lean();
  res.json({ requisitions });
});

router.post('/', requireRoles('clerk', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) {
      return res.status(400).json({ error: 'At least one line item is required.' });
    }

    const actor = await User.findById(req.user.id).lean();
    const id = `req_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const doc = await Requisition.create({
      _id: id,
      companyId: companyId(req),
      title: String(b.title || '').trim() || 'Requisition',
      clerkId: req.user.id,
      clerkName: actor?.fullName || req.user.fullName || 'Clerk',
      location: String(b.location || actor?.location || 'Warehouse'),
      status: 'submitted',
      priority: ['low', 'normal', 'high', 'critical'].includes(b.priority) ? b.priority : 'normal',
      supervisorNote: '',
      lines: lines.map((line) => ({
        description: String(line.description || '').trim() || 'Item',
        quantity: Math.max(0, Number(line.quantity) || 0),
        unit: String(line.unit || 'units'),
        estimatedCost: Math.max(0, Number(line.estimatedCost) || 0),
      })),
    });

    await logActivity(companyId(req), req.user.id, 'stock.request.created', {
      meta: { requisitionId: doc._id, location: doc.location },
    });
    await notifyRole(
      companyId(req),
      'supervisor',
      'New requisition submitted',
      `${doc.clerkName} submitted ${doc.title}.`,
      'neutral'
    );
    await messageRole(
      companyId(req),
      'supervisor',
      'Approval needed',
      `${doc.title} is waiting in the approval queue.`,
      doc.clerkName
    );

    res.status(201).json({ requisition: doc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to create requisition.' });
  }
});

router.patch('/:id/review', requireRoles('supervisor', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    if (doc.status !== 'submitted') {
      return res.status(400).json({ error: 'Only submitted requisitions can be reviewed.' });
    }

    const decision = req.body?.decision === 'rejected' ? 'rejected' : 'approved';
    const note = String(req.body?.note || '');

    if (decision === 'approved') {
      let supplierId = String(req.body?.supplierId || '');
      if (!supplierId) {
        const sup = await User.findOne({ companyId: companyId(req), role: 'supplier', isActive: true })
          .sort({ fullName: 1 })
          .lean();
        supplierId = sup?._id || '';
      }
      if (!supplierId) {
        return res.status(400).json({
          error: 'No supplier available. Invite an active supplier or pass supplierId when approving.',
        });
      }
      const supplier = await User.findById(supplierId).lean();
      doc.status = 'sentToSupplier';
      doc.supplierId = supplierId;
      doc.supplierName = supplier?.fullName || supplier?.email || '';
      doc.supervisorNote = note;
      await doc.save();

      await logActivity(companyId(req), req.user.id, 'stock.request.approved', { meta: { requisitionId: doc._id } });
      await notifyRole(
        companyId(req),
        'supplier',
        'Approved requisition available',
        `${doc.title} is ready for proforma creation.`,
        'neutral'
      );
      await notifyRole(
        companyId(req),
        'accountant',
        'Approved request entered workflow',
        `${doc.title} is expected to receive a proforma.`,
        'neutral'
      );
      await messageRole(
        companyId(req),
        'clerk',
        'Requisition approved',
        `${doc.title} moved to supplier processing.`,
        'Supervisor'
      );
    } else {
      doc.status = 'rejected';
      doc.supervisorNote = note;
      await doc.save();
      await logActivity(companyId(req), req.user.id, 'stock.request.rejected', { meta: { requisitionId: doc._id } });
      await notifyRole(companyId(req), 'clerk', 'Requisition rejected', `${doc.title} was rejected by the supervisor.`, 'bad');
    }

    res.json({ requisition: doc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to review requisition.' });
  }
});

router.post('/:id/supplier-proforma', requireRoles('supplier', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    if (req.user.role === 'supplier' && doc.supplierId && doc.supplierId !== req.user.id) {
      return res.status(403).json({ error: 'This requisition is not assigned to you.' });
    }
    if (doc.status !== 'sentToSupplier') {
      return res.status(400).json({ error: 'Requisition must be approved and sent to supplier first.' });
    }

    const b = req.body || {};
    const reference = String(b.reference || `PRO-${Date.now()}`);
    const amount = Math.max(0, Number(b.amount) || 0);
    const attachmentUrl = String(b.attachmentUrl || 'proforma-upload.pdf');
    const notes = String(b.notes || '');

    doc.status = 'proformaReceived';
    await doc.save();

    const supplier = await User.findById(req.user.id).lean();
    let invoice = await Invoice.findOne({
      companyId: companyId(req),
      requisitionId: doc._id,
      type: 'proforma',
    });

    if (invoice) {
      invoice.reference = reference;
      invoice.amount = amount;
      invoice.attachmentUrl = attachmentUrl;
      invoice.status = 'proformaReceived';
      invoice.notes = notes;
      invoice.supplierId = req.user.id;
      invoice.supplierName = supplier?.fullName || '';
      await invoice.save();
    } else {
      const invId = `inv_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      invoice = await Invoice.create({
        _id: invId,
        companyId: companyId(req),
        requisitionId: doc._id,
        stockRequestId: doc._id,
        supplierId: req.user.id,
        supplierName: supplier?.fullName || '',
        createdBy: req.user.id,
        type: 'proforma',
        status: 'proformaReceived',
        reference,
        amount,
        currency: String(b.currency || 'RWF'),
        notes,
        attachmentUrl,
      });
    }

    await logActivity(companyId(req), req.user.id, 'invoice.proforma.received', {
      meta: { requisitionId: doc._id, reference, invoiceId: invoice._id },
    });
    await notifyRole(
      companyId(req),
      'accountant',
      'Proforma received',
      `${doc.title} now has a supplier proforma ready for review.`,
      'warn'
    );
    await messageRole(
      companyId(req),
      'accountant',
      'Supplier submitted proforma',
      `${doc.title} is ready for finance approval.`,
      supplier?.fullName || 'Supplier'
    );

    res.status(201).json({ requisition: doc, invoice });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to submit proforma.' });
  }
});

export default router;
