import { Router } from 'express';
import Invoice from '../models/Invoice.js';
import Requisition from '../models/Requisition.js';
import Company from '../models/Company.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { messageRole, notifyRole, notifyUser, messageUser } from '../services/notify.js';
import { applyRequisitionLinesToStock } from '../services/fulfillmentStock.js';
import {
  emailPaymentConfirmedToSupplier,
  emailFinanceProformaDecisionToParties,
  emailFinalInvoiceToParties,
} from '../services/workflowNotifications.js';

const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId;
}

async function hospitalDisplayName(cid) {
  const c = await Company.findById(cid).select('name').lean();
  return c?.name || 'Your organization';
}

router.get('/', async (req, res) => {
  const role = req.user.role;
  let q;
  if (role === 'supplier') {
    const uid = req.user.id != null ? String(req.user.id).trim() : '';
    const co = req.user.companyId != null ? String(req.user.companyId).trim() : '';
    const keys = [...new Set([uid, co].filter(Boolean))];
    q = keys.length ? { supplierId: { $in: keys } } : { _id: '__none__' };
  } else {
    q = { companyId: companyId(req) };
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
  const doc = await Invoice.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found.' });
  
  if (doc.companyId !== companyId(req) && String(doc.supplierId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

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
    await logActivity(doc.companyId, req.user.id, 'invoice.supplier_update', { meta: { entityId: doc._id } });
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
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (!['proformaReceived', 'sent', 'draft'].includes(doc.status)) {
      return res.status(400).json({ error: 'Invoice is not awaiting accountant review.' });
    }

    const reqDoc = doc.requisitionId ? await Requisition.findById(doc.requisitionId) : null;
    if (reqDoc?.status === 'proformaAwaitingClerk') {
      return res.status(400).json({
        error: 'The clerk must accept the supplier proforma before finance can review.',
      });
    }

    const decision = req.body?.decision === 'rejected' ? 'rejected' : 'approved';
    doc.status = decision === 'approved' ? 'proformaApproved' : 'rejected';
    if (req.body?.notes !== undefined) doc.notes = String(req.body.notes);

    if (reqDoc) {
      reqDoc.status = doc.status === 'proformaApproved' ? 'proformaApproved' : 'rejected';
      await reqDoc.save();
    }

    await doc.save();
    await logActivity(doc.companyId, req.user.id, `invoice.${decision}`, { meta: { invoiceId: doc._id } });
    await notifyUser(
      doc.supplierId,
      decision === 'approved' ? 'Proforma approved' : 'Proforma rejected',
      `${doc.reference} was ${decision} by finance.`,
      decision === 'approved' ? 'ok' : 'bad',
      { skipEmail: true }
    );

    if (reqDoc) {
      const finNote = req.body?.notes ? String(req.body.notes).trim() : '';
      const clerkBody =
        decision === 'approved'
          ? `${doc.reference}: finance approved the proforma for "${reqDoc.title}".`
          : `${doc.reference}: finance rejected the proforma for "${reqDoc.title}".${finNote ? ` Note: ${finNote}` : ''}`;
      await notifyUser(
        reqDoc.clerkId,
        decision === 'approved' ? 'Proforma approved by finance' : 'Proforma rejected by finance',
        clerkBody,
        decision === 'approved' ? 'ok' : 'bad',
        { skipEmail: true }
      );
      await notifyRole(
        doc.companyId,
        'supervisor',
        decision === 'approved' ? 'Finance approved proforma' : 'Finance rejected proforma',
        `${reqDoc.title} — ${doc.reference}.`,
        decision === 'approved' ? 'neutral' : 'warn'
      );
      const orgName = await hospitalDisplayName(doc.companyId);
      emailFinanceProformaDecisionToParties({
        invoice: doc,
        requisition: reqDoc,
        hospitalName: orgName,
        decision,
        financeNote: finNote,
      }).catch((err) => console.error('[invoice] finance decision email failed:', err));
    }

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to review invoice.' });
  }
});

router.post('/:id/mark-paid', requireRoles('accountant', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (doc.status !== 'proformaApproved') {
      return res.status(400).json({ error: 'Only approved proformas can be marked paid.' });
    }

    doc.status = 'paid';
    doc.paidAt = new Date();
    doc.paidBy = req.user.id;
    await doc.save();

    const reqDoc = doc.requisitionId
      ? await Requisition.findById(doc.requisitionId)
      : null;
    if (reqDoc) {
      reqDoc.status = 'paid';
      await reqDoc.save();
    }

    await logActivity(doc.companyId, req.user.id, 'invoice.paid', {
      meta: { invoiceId: doc._id, amount: doc.amount },
    });
    await notifyUser(
      doc.supplierId,
      'Payment received',
      `${doc.reference} is marked as paid. Upload delivery documents next.`,
      'ok'
    );
    await messageUser(
      doc.supplierId,
      'Finance released payment',
      `${doc.reference} is cleared for fulfilment.`,
      'Finance'
    );

    if (reqDoc) {
      await notifyUser(
        reqDoc.clerkId,
        'Payment released',
        `${reqDoc.title}: payment was sent to the supplier for ${doc.reference}.`,
        'neutral'
      );
      await notifyRole(
        doc.companyId,
        'supervisor',
        'Payment marked',
        `${reqDoc.title} (${doc.reference}) — supplier can fulfil.`,
        'neutral'
      );
    }

    const payHospital = await hospitalDisplayName(doc.companyId);
    emailPaymentConfirmedToSupplier(doc, payHospital).catch((err) => console.error('[invoice] payment notify failed:', err));

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to mark invoice paid.' });
  }
});

/** Supplier fulfils on credit: same downstream steps as paid (delivery docs), without a payment record. */
router.post('/:id/mark-credit-purchase', requireRoles('accountant', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (doc.status !== 'proformaApproved') {
      return res.status(400).json({ error: 'Only approved proformas can be marked as credit purchase.' });
    }

    doc.status = 'creditPurchase';
    await doc.save();

    const reqDoc = doc.requisitionId ? await Requisition.findById(doc.requisitionId) : null;
    if (reqDoc) {
      reqDoc.status = 'creditPurchase';
      await reqDoc.save();
    }

    await logActivity(doc.companyId, req.user.id, 'invoice.credit_purchase', {
      meta: { invoiceId: doc._id, amount: doc.amount },
    });
    await notifyUser(
      doc.supplierId,
      'Credit purchase approved',
      `${doc.reference}: finance approved fulfilment on credit. Upload delivery proof and your official final invoice when you ship.`,
      'ok'
    );
    await messageUser(
      doc.supplierId,
      'Credit purchase — ship and invoice',
      `${doc.reference} is cleared for dispatch on credit terms.`,
      'Finance'
    );

    if (reqDoc) {
      await notifyUser(
        reqDoc.clerkId,
        'Order on credit',
        `${reqDoc.title}: supplier may ship on credit for ${doc.reference}. You will attach the delivery note when goods arrive.`,
        'neutral'
      );
      await notifyRole(
        doc.companyId,
        'supervisor',
        'Credit purchase released',
        `${reqDoc.title} (${doc.reference}) — supplier notified on credit.`,
        'neutral'
      );
    }

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to mark credit purchase.' });
  }
});

router.post('/:id/delivery-note', requireRoles('supplier', 'admin', 'clerk', 'supervisor'), async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    
    const internalHospitalRole = ['clerk', 'supervisor', 'accountant', 'admin'].includes(req.user.role);
    if (internalHospitalRole) {
      if (doc.companyId !== companyId(req)) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    } else if (doc.companyId !== companyId(req) && String(doc.supplierId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (req.user.role === 'supplier' && String(doc.supplierId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not your invoice.' });
    }
    if (!['paid', 'creditPurchase', 'closed'].includes(doc.status)) {
      return res.status(400).json({ error: 'Delivery note can only be attached after payment, credit release, or final invoice.' });
    }

    const wasAlreadyClosed = doc.status === 'closed';
    const isNewDeliveryNote = !doc.deliveryNoteUrl;
    doc.deliveryNoteUrl = String(req.body?.deliveryNoteUrl || 'delivery-note.pdf');
    if (!wasAlreadyClosed) {
      doc.status = 'deliveryNoteAttached';
    }
    await doc.save();

    const reqDoc = doc.requisitionId
      ? await Requisition.findById(doc.requisitionId)
      : null;
    if (reqDoc) {
      const originalReqStatus = reqDoc.status;
      if (!wasAlreadyClosed) {
        reqDoc.status = 'deliveryNoteAttached';
      }
      await reqDoc.save();

      // Only update stock if this is the FIRST time a delivery note is attached for this workflow
      if (isNewDeliveryNote && originalReqStatus !== 'deliveryNoteAttached' && originalReqStatus !== 'closed') {
        const stockResult = await applyRequisitionLinesToStock(doc.companyId, reqDoc.toObject?.() ? reqDoc.toObject() : reqDoc);
        if (stockResult.updated.length) {
          await logActivity(doc.companyId, req.user.id, 'stock.fulfilled_from_requisition', {
            meta: { requisitionId: reqDoc._id, lines: stockResult.updated },
          });
          await notifyRole(
            doc.companyId,
            'clerk',
            'Stock received',
            `${reqDoc.title}: added quantities to inventory from delivery.`,
            'ok'
          );
        }
      } else if (isNewDeliveryNote && originalReqStatus === 'closed') {
        // If it was already closed (final invoice uploaded first), we still need to update stock now that the delivery note is finally here
        const stockResult = await applyRequisitionLinesToStock(doc.companyId, reqDoc.toObject?.() ? reqDoc.toObject() : reqDoc);
        if (stockResult.updated.length) {
          await logActivity(doc.companyId, req.user.id, 'stock.fulfilled_from_requisition', {
            meta: { requisitionId: reqDoc._id, lines: stockResult.updated },
          });
        }
      }
    }

    await logActivity(doc.companyId, req.user.id, 'delivery.note.attached', { meta: { invoiceId: doc._id } });
    await notifyRole(
      doc.companyId,
      'accountant',
      'Delivery note uploaded',
      `${doc.reference} now has a delivery note attached.`,
      'neutral'
    );

    if (reqDoc) {
      await notifyUser(
        reqDoc.clerkId,
        'Delivery note attached',
        `${reqDoc.title}: supplier uploaded delivery documentation for ${doc.reference}.`,
        'neutral'
      );
      await notifyRole(
        doc.companyId,
        'supervisor',
        'Delivery note on file',
        `${reqDoc.title} — ${doc.reference}.`,
        'neutral'
      );
    }

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to attach delivery note.' });
  }
});

router.post('/:id/final-invoice', requireRoles('supplier', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    
    if (doc.companyId !== companyId(req) && String(doc.supplierId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (req.user.role === 'supplier' && String(doc.supplierId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not your invoice.' });
    }
    if (!['paid', 'creditPurchase', 'deliveryNoteAttached'].includes(doc.status)) {
      return res.status(400).json({ error: 'Workflow state does not allow final invoice yet.' });
    }

    doc.finalInvoiceUrl = String(req.body?.finalInvoiceUrl || 'final-invoice.pdf');
    doc.type = 'final';
    doc.status = 'closed';
    await doc.save();

    const reqDoc = doc.requisitionId
      ? await Requisition.findById(doc.requisitionId)
      : null;
    if (reqDoc) {
      reqDoc.status = 'closed';
      await reqDoc.save();
    }

    await logActivity(doc.companyId, req.user.id, 'workflow.closed', {
      meta: { invoiceId: doc._id, requisitionId: doc.requisitionId },
    });
    await notifyRole(
      doc.companyId,
      'admin',
      'Workflow closed',
      `${doc.reference} completed the full requisition-to-invoice cycle.`,
      'ok'
    );

    if (reqDoc) {
      await notifyUser(
        reqDoc.clerkId,
        'Requisition completed',
        `${reqDoc.title}: this request is closed and stock was updated where applicable.`,
        'ok'
      );
      await notifyRole(
        doc.companyId,
        'supervisor',
        'Requisition closed',
        `${reqDoc.title} completed (${doc.reference}).`,
        'ok'
      );
      const hospitalName = await hospitalDisplayName(doc.companyId);
      emailFinalInvoiceToParties({
        invoice: doc,
        requisition: reqDoc,
        hospitalName,
      }).catch((err) => console.error('[invoice] final invoice email failed:', err));
    }

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to attach final invoice.' });
  }
});

export default router;
