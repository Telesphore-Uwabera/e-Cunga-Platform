import { Router } from 'express';
import Invoice from '../models/Invoice.js';
import Requisition from '../models/Requisition.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { messageRole, notifyRole } from '../services/notify.js';

const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId;
}

router.get('/', async (req, res) => {
  const role = req.user.role;
  const q = { companyId: companyId(req) };
  if (role === 'supplier') {
    q.supplierId = req.user.id;
  }
  const rows = await Invoice.find(q).sort({ updatedAt: -1 }).limit(500).lean();
  const invoices = rows.map((i) => ({
    ...i,
    id: i._id,
    requisitionId: i.requisitionId || i.stockRequestId || '',
  }));
  res.json({ invoices });
});

router.post('/', requireRoles('accountant', 'admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const doc = await Invoice.create({
      _id: id,
      companyId: companyId(req),
      requisitionId: String(b.requisitionId || b.stockRequestId || ''),
      stockRequestId: String(b.requisitionId || b.stockRequestId || ''),
      supplierId: String(b.supplierId || ''),
      createdBy: req.user.id,
      type: b.type === 'final' ? 'final' : 'proforma',
      status: ['draft', 'sent'].includes(b.status) ? b.status : 'draft',
      reference: String(b.reference || ''),
      amount: b.amount != null ? Number(b.amount) : 0,
      currency: String(b.currency || 'RWF'),
      notes: String(b.notes || ''),
    });
    await logActivity(companyId(req), req.user.id, 'invoice.created', {
      meta: { entityId: doc._id, type: doc.type },
    });
    res.status(201).json({ invoice: doc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid invoice payload.' });
  }
});

router.patch('/:id', async (req, res) => {
  const doc = await Invoice.findOne({ _id: req.params.id, companyId: companyId(req) });
  if (!doc) return res.status(404).json({ error: 'Not found.' });

  const role = req.user.role;
  const b = req.body || {};
  const supplierMatches = !doc.supplierId || String(doc.supplierId) === String(req.user.id);

  if (role === 'supplier' && !supplierMatches) {
    return res.status(403).json({ error: 'Not your invoice.' });
  }

  if (role === 'supplier') {
    if (b.attachmentUrl !== undefined) doc.attachmentUrl = String(b.attachmentUrl);
    if (b.status === 'sent') doc.status = 'sent';
    await doc.save();
    await logActivity(companyId(req), req.user.id, 'invoice.supplier_update', { meta: { entityId: doc._id } });
    return res.json({ invoice: doc });
  }

  if (role === 'accountant' || role === 'admin') {
    const allowed = [
      'draft',
      'sent',
      'proformaReceived',
      'proformaApproved',
      'rejected',
      'paid',
      'deliveryNoteAttached',
      'closed',
    ];
    let nextStatus = b.status;
    if (nextStatus === 'approved') nextStatus = 'proformaApproved';
    if (nextStatus && allowed.includes(nextStatus)) {
      doc.status = nextStatus;
    }
    if (b.amount !== undefined) doc.amount = Number(b.amount);
    if (b.notes !== undefined) doc.notes = String(b.notes);
    if (nextStatus === 'paid' || b.status === 'paid') {
      doc.paidAt = new Date();
      doc.paidBy = req.user.id;
    }
    await doc.save();
    await logActivity(companyId(req), req.user.id, 'invoice.accountant_update', {
      meta: { entityId: doc._id, status: doc.status },
    });
    return res.json({ invoice: doc });
  }

  return res.status(403).json({ error: 'Forbidden.' });
});

router.post('/:id/accountant-review', requireRoles('accountant', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (!['proformaReceived', 'sent', 'draft'].includes(doc.status)) {
      return res.status(400).json({ error: 'Invoice is not awaiting accountant review.' });
    }

    const decision = req.body?.decision === 'rejected' ? 'rejected' : 'approved';
    doc.status = decision === 'approved' ? 'proformaApproved' : 'rejected';
    if (req.body?.notes !== undefined) doc.notes = String(req.body.notes);

    const reqDoc = doc.requisitionId
      ? await Requisition.findOne({ _id: doc.requisitionId, companyId: companyId(req) })
      : null;
    if (reqDoc) {
      reqDoc.status = doc.status === 'proformaApproved' ? 'proformaApproved' : 'rejected';
      await reqDoc.save();
    }

    await doc.save();
    await logActivity(companyId(req), req.user.id, `invoice.${decision}`, { meta: { invoiceId: doc._id } });
    await notifyRole(
      companyId(req),
      'supplier',
      decision === 'approved' ? 'Proforma approved' : 'Proforma rejected',
      `${doc.reference} was ${decision} by finance.`,
      decision === 'approved' ? 'ok' : 'bad'
    );

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to review invoice.' });
  }
});

router.post('/:id/mark-paid', requireRoles('accountant', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (doc.status !== 'proformaApproved') {
      return res.status(400).json({ error: 'Only approved proformas can be marked paid.' });
    }

    doc.status = 'paid';
    doc.paidAt = new Date();
    doc.paidBy = req.user.id;
    await doc.save();

    const reqDoc = doc.requisitionId
      ? await Requisition.findOne({ _id: doc.requisitionId, companyId: companyId(req) })
      : null;
    if (reqDoc) {
      reqDoc.status = 'paid';
      await reqDoc.save();
    }

    await logActivity(companyId(req), req.user.id, 'invoice.paid', {
      meta: { invoiceId: doc._id, amount: doc.amount },
    });
    await notifyRole(
      companyId(req),
      'supplier',
      'Payment received',
      `${doc.reference} is marked as paid. Upload delivery documents next.`,
      'ok'
    );
    await messageRole(
      companyId(req),
      'supplier',
      'Finance released payment',
      `${doc.reference} is cleared for fulfilment.`,
      'Finance'
    );

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to mark invoice paid.' });
  }
});

router.post('/:id/delivery-note', requireRoles('supplier', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (req.user.role === 'supplier' && String(doc.supplierId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not your invoice.' });
    }
    if (doc.status !== 'paid') {
      return res.status(400).json({ error: 'Delivery note can only be attached after payment.' });
    }

    doc.deliveryNoteUrl = String(req.body?.deliveryNoteUrl || 'delivery-note.pdf');
    doc.status = 'deliveryNoteAttached';
    await doc.save();

    const reqDoc = doc.requisitionId
      ? await Requisition.findOne({ _id: doc.requisitionId, companyId: companyId(req) })
      : null;
    if (reqDoc) {
      reqDoc.status = 'deliveryNoteAttached';
      await reqDoc.save();
    }

    await logActivity(companyId(req), req.user.id, 'delivery.note.attached', { meta: { invoiceId: doc._id } });
    await notifyRole(
      companyId(req),
      'accountant',
      'Delivery note uploaded',
      `${doc.reference} now has a delivery note attached.`,
      'neutral'
    );

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to attach delivery note.' });
  }
});

router.post('/:id/final-invoice', requireRoles('supplier', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findOne({ _id: req.params.id, companyId: companyId(req) });
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (req.user.role === 'supplier' && String(doc.supplierId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not your invoice.' });
    }
    if (!['paid', 'deliveryNoteAttached'].includes(doc.status)) {
      return res.status(400).json({ error: 'Workflow state does not allow final invoice yet.' });
    }

    doc.finalInvoiceUrl = String(req.body?.finalInvoiceUrl || 'final-invoice.pdf');
    doc.type = 'final';
    doc.status = 'closed';
    await doc.save();

    const reqDoc = doc.requisitionId
      ? await Requisition.findOne({ _id: doc.requisitionId, companyId: companyId(req) })
      : null;
    if (reqDoc) {
      reqDoc.status = 'closed';
      await reqDoc.save();
    }

    await logActivity(companyId(req), req.user.id, 'workflow.closed', {
      meta: { invoiceId: doc._id, requisitionId: doc.requisitionId },
    });
    await notifyRole(
      companyId(req),
      'admin',
      'Workflow closed',
      `${doc.reference} completed the full requisition-to-invoice cycle.`,
      'ok'
    );

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to attach final invoice.' });
  }
});

export default router;
