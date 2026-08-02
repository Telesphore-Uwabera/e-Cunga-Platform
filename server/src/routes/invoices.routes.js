import { Router } from 'express';
import Invoice from '../models/Invoice.js';
import Requisition from '../models/Requisition.js';
import Company from '../models/Company.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { messageRole, notifyRole, notifyUser, messageUser } from '../services/notify.js';
import { compactNotifyScope, requisitionNotifyScope } from '../services/orgScope.js';
import { applyRequisitionLinesToStock } from '../services/fulfillmentStock.js';
import {
  emailPaymentConfirmedToSupplier,
  emailFinanceProformaDecisionToSupplier,
  emailFinanceProformaDecisionToClerk,
  emailInstallmentPaymentToParties,
} from '../services/workflowNotifications.js';


const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId;
}

function scopeFromReq(reqDoc) {
  if (!reqDoc) return {};
  return compactNotifyScope(requisitionNotifyScope(reqDoc, null));
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
      'partiallyPaid',
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

    // Prevent accountant review for external supplier requisitions (clerk uploads all documents)
    if (!doc.supplierId || String(doc.supplierId).trim() === '') {
      return res.status(403).json({ error: 'Accountant review is not required for external supplier requisitions. Clerk manages all document uploads.' });
    }

    const reqDoc = doc.requisitionId ? await Requisition.findById(doc.requisitionId) : null;
    if (reqDoc?.status === 'proformaAwaitingClerk') {
      return res.status(400).json({
        error: 'The clerk must accept the supplier proforma before finance can review.',
      });
    }

    const decision = req.body?.decision === 'rejected' ? 'rejected' : 'approved';
    const finNote = req.body?.notes ? String(req.body.notes).trim() : '';

    if (decision === 'rejected' && !finNote) {
      return res.status(400).json({ error: 'Rejection reason (notes) is required.' });
    }

    doc.status = decision === 'approved' ? 'proformaApproved' : 'rejected';
    if (req.body?.notes !== undefined) doc.notes = String(req.body.notes);

    if (reqDoc) {
      reqDoc.status = doc.status === 'proformaApproved' ? 'proformaApproved' : 'rejected';
      if (decision === 'rejected' && finNote) {
        reqDoc.supervisorNote = finNote;
      }
      await reqDoc.save();
    }

    await doc.save();
    await logActivity(doc.companyId, req.user.id, `invoice.${decision}`, { meta: { invoiceId: doc._id } });

    const supplierBody =
      decision === 'approved'
        ? `${doc.reference} was approved by finance.`
        : `${doc.reference} was rejected by finance.${finNote ? ` Reason: ${finNote}` : ''}`;

    await notifyUser(
      doc.supplierId,
      decision === 'approved' ? 'Proforma approved' : 'Proforma rejected',
      supplierBody,
      decision === 'approved' ? 'ok' : 'bad'
    );

    if (reqDoc) {
      const clerkBody =
        decision === 'approved'
          ? `${doc.reference}: finance approved the proforma for "${reqDoc.title}".`
          : `${doc.reference}: finance rejected the proforma for "${reqDoc.title}".${finNote ? ` Reason: ${finNote}` : ''}`;
      await notifyUser(
        reqDoc.clerkId,
        decision === 'approved' ? 'Proforma approved by finance' : 'Proforma rejected by finance',
        clerkBody,
        decision === 'approved' ? 'ok' : 'bad'
      );

      const supervisorBody =
        decision === 'approved'
          ? `${reqDoc.title} — ${doc.reference}.`
          : `${reqDoc.title} — ${doc.reference}.${finNote ? ` Reason: ${finNote}` : ''}`;
      await notifyRole(
        doc.companyId,
        'supervisor',
        decision === 'approved' ? 'Finance approved proforma' : 'Finance rejected proforma',
        supervisorBody,
        decision === 'approved' ? 'neutral' : 'warn',
        { ...scopeFromReq(reqDoc), forceSupervisorEmail: true }
      );

      const orgName = await hospitalDisplayName(doc.companyId);
      emailFinanceProformaDecisionToSupplier({
        invoice: doc,
        requisition: reqDoc,
        hospitalName: orgName,
        decision,
        financeNote: finNote,
      }).catch((err) => console.error('[invoice] finance decision email to supplier failed:', err));
      
      emailFinanceProformaDecisionToClerk({
        invoice: doc,
        requisition: reqDoc,
        hospitalName: orgName,
        decision,
        financeNote: finNote,
      }).catch((err) => console.error('[invoice] finance decision email to clerk failed:', err));
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

    // Prevent payment processing for external supplier requisitions (clerk uploads all documents)
    if (!doc.supplierId || String(doc.supplierId).trim() === '') {
      return res.status(403).json({ error: 'Payment processing is not required for external supplier requisitions. Clerk manages all document uploads.' });
    }

    doc.status = 'paid';
    doc.paidAt = new Date();
    doc.paidBy = req.user.id;
    
    // Add payment tracking fields
    if (req.body?.paymentChannel) doc.paymentChannel = String(req.body.paymentChannel);
    if (req.body?.dueDate) doc.dueDate = new Date(req.body.dueDate);
    if (req.body?.paymentDeadline) doc.paymentDeadline = new Date(req.body.paymentDeadline);
    if (req.body?.paymentProofUrl) doc.paymentProofUrl = String(req.body.paymentProofUrl);
    
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
      'Payment confirmed',
      `${doc.reference} is marked as paid. Upload delivery documents next.`,
      'ok'
    );
    await messageUser(
      doc.supplierId,
      'Payment confirmed',
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
        'neutral',
        scopeFromReq(reqDoc)
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

/** Record a partial payment. When cumulative amountPaid >= amount the invoice is auto-upgraded to 'paid'. */
router.post('/:id/partial-payment', requireRoles('accountant', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (!['proformaApproved', 'partiallyPaid', 'creditPurchase'].includes(doc.status)) {
      return res.status(400).json({ error: 'Invoice must be approved before recording a payment.' });
    }

    // Prevent payment processing for external supplier requisitions (clerk uploads all documents)
    if (!doc.supplierId || String(doc.supplierId).trim() === '') {
      return res.status(403).json({ error: 'Payment processing is not required for external supplier requisitions. Clerk manages all document uploads.' });
    }

    const incoming = Number(req.body?.amountPaid);
    if (!incoming || incoming <= 0) {
      return res.status(400).json({ error: 'amountPaid must be a positive number.' });
    }

    doc.amountPaid = Math.min(Number(doc.amountPaid || 0) + incoming, Number(doc.amount || 0));
    const isFullyPaid = doc.amountPaid >= Number(doc.amount || 0);

    if (isFullyPaid) {
      doc.status = 'paid';
      doc.paidAt = new Date();
      doc.paidBy = req.user.id;
    } else {
      doc.status = 'partiallyPaid';
    }

    // Add payment tracking fields
    if (req.body?.paymentChannel) doc.paymentChannel = String(req.body.paymentChannel);
    if (req.body?.dueDate) doc.dueDate = new Date(req.body.dueDate);
    if (req.body?.paymentDeadline) doc.paymentDeadline = new Date(req.body.paymentDeadline);
    if (req.body?.paymentProofUrl) doc.paymentProofUrl = String(req.body.paymentProofUrl);

    // Handle installment tracking if provided
    if (req.body?.installment) {
      const installment = {
        amount: Number(req.body.installment.amount),
        paid: true,
        paidAt: new Date(),
        paymentProofUrl: req.body.installment.paymentProofUrl || '',
        dueDate: req.body.installment.dueDate ? new Date(req.body.installment.dueDate) : null,
      };
      doc.installments = doc.installments || [];
      doc.installments.push(installment);
    }

    await doc.save();

    const reqDoc = doc.requisitionId ? await Requisition.findById(doc.requisitionId) : null;
    if (reqDoc) {
      reqDoc.status = isFullyPaid ? 'paid' : 'partiallyPaid';
      await reqDoc.save();
    }

    const balanceRemaining = Math.max(0, Number(doc.amount || 0) - doc.amountPaid);
    await logActivity(doc.companyId, req.user.id, isFullyPaid ? 'invoice.paid' : 'invoice.partial_payment', {
      meta: { invoiceId: doc._id, amountPaid: incoming, balanceRemaining },
    });

    const paymentMsg = isFullyPaid
      ? `${doc.reference} has been fully paid.`
      : `${doc.reference}: partial payment of ${doc.currency || 'RWF'} ${incoming.toLocaleString()} recorded. Remaining balance: ${doc.currency || 'RWF'} ${balanceRemaining.toLocaleString()}.`;

    await notifyUser(doc.supplierId, isFullyPaid ? 'Payment confirmed' : 'Partial payment recorded', paymentMsg, isFullyPaid ? 'ok' : 'neutral');

    if (reqDoc) {
      await notifyUser(reqDoc.clerkId, isFullyPaid ? 'Payment released' : 'Partial payment recorded', paymentMsg, 'neutral', { skipEmail: true });
      await notifyRole(doc.companyId, 'supervisor', isFullyPaid ? 'Payment marked' : 'Partial payment recorded', paymentMsg, 'neutral', scopeFromReq(reqDoc));
    }
    await notifyRole(doc.companyId, 'accountant', isFullyPaid ? 'Payment marked' : 'Partial payment recorded', paymentMsg, 'neutral');

    const payHospital = await hospitalDisplayName(doc.companyId);
    if (isFullyPaid) {
      emailPaymentConfirmedToSupplier(doc, payHospital).catch((err) => console.error('[invoice] payment notify failed:', err));
    } else {
      emailInstallmentPaymentToParties({
        invoice: doc,
        requisition: reqDoc,
        hospitalName: payHospital,
        amountPaid: incoming,
        balanceRemaining
      }).catch((err) => console.error('[invoice] installment email notify failed:', err));
    }

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to record partial payment.' });
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

    // Prevent credit purchase processing for external supplier requisitions (clerk uploads all documents)
    if (!doc.supplierId || String(doc.supplierId).trim() === '') {
      return res.status(403).json({ error: 'Credit purchase processing is not required for external supplier requisitions. Clerk manages all document uploads.' });
    }

    doc.status = 'creditPurchase';
    
    // Add payment tracking fields for credit purchase
    if (req.body?.paymentChannel) doc.paymentChannel = String(req.body.paymentChannel);
    if (req.body?.dueDate) doc.dueDate = new Date(req.body.dueDate);
    if (req.body?.paymentDeadline) doc.paymentDeadline = new Date(req.body.paymentDeadline);
    
    // Set up installment plan if provided
    if (req.body?.installments && Array.isArray(req.body.installments)) {
      doc.installments = req.body.installments.map((inst) => ({
        amount: Number(inst.amount),
        paid: false,
        paidAt: null,
        paymentProofUrl: '',
        dueDate: inst.dueDate ? new Date(inst.dueDate) : null,
      }));
    }
    
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
        'neutral',
        scopeFromReq(reqDoc)
      );
    }

    const creditHospital = await hospitalDisplayName(doc.companyId);
    emailPaymentConfirmedToSupplier(doc, creditHospital).catch((err) =>
      console.error('[invoice] credit purchase notify failed:', err)
    );

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to mark credit purchase.' });
  }
});

router.post('/:id/delivery-note', requireRoles('clerk', 'admin', 'supplier'), async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });

    const isSupplierActor = req.user.role === 'supplier';
    if (isSupplierActor) {
      if (String(doc.supplierId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Only the assigned supplier can attach a delivery note for this order.' });
      }
    } else if (doc.companyId !== companyId(req)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (!['paid', 'creditPurchase', 'proformaReceived', 'finalInvoiceReceived'].includes(doc.status)) {
      return res.status(400).json({ error: 'Delivery note can only be attached after payment, credit release, proforma approval, or final invoice for external suppliers.' });
    }

    doc.deliveryNoteUrl = String(req.body?.deliveryNoteUrl || 'delivery-note.pdf');
    // For external supplier workflow: close after delivery note when final invoice is received or when proforma is received (approvedExternal workflow)
    const isApprovedExternalWorkflow = doc.status === 'proformaReceived';
    const isFinalInvoiceReceived = doc.status === 'finalInvoiceReceived';
    doc.status = (String(doc.finalInvoiceUrl || '').trim() || isApprovedExternalWorkflow || isFinalInvoiceReceived) ? 'closed' : 'deliveryNoteAttached';
    await doc.save();

    const reqDoc = doc.requisitionId
      ? await Requisition.findById(doc.requisitionId)
      : null;
    if (reqDoc) {
      reqDoc.status = doc.status;
      await reqDoc.save();
      if (doc.status === 'closed') {
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
            'ok',
            scopeFromReq(reqDoc)
          );
        }
      }
    }

    await logActivity(doc.companyId, req.user.id, 'delivery.note.attached', {
      meta: { invoiceId: doc._id, actorRole: req.user.role },
    });
    const dnActorLabel = isSupplierActor ? 'supplier' : 'clerk';
    await notifyRole(
      doc.companyId,
      'accountant',
      'Delivery note uploaded',
      `${doc.reference} now has a ${dnActorLabel} delivery note attached.`,
      'neutral',
      scopeFromReq(reqDoc)
    );

    if (reqDoc) {
      if (!isSupplierActor) {
        await notifyUser(
          doc.supplierId,
          'Delivery note attached',
          `${reqDoc.title}: clerk attached delivery documentation for ${doc.reference}.`,
          'neutral'
        );
      } else {
        await notifyUser(
          reqDoc.clerkId,
          'Supplier dispatched order',
          `${reqDoc.title}: supplier uploaded delivery documentation for ${doc.reference}.`,
          'neutral',
          { skipEmail: true }
        );
      }
      await notifyRole(
        doc.companyId,
        'supervisor',
        doc.status === 'closed' ? 'Requisition closed' : 'Delivery note on file',
        doc.status === 'closed' ? `${reqDoc.title} completed (${doc.reference}).` : `${reqDoc.title} - ${doc.reference}.`,
        doc.status === 'closed' ? 'ok' : 'neutral',
        { ...scopeFromReq(reqDoc), forceSupervisorEmail: true }
      );
    }

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to attach delivery note.' });
  }
});

router.post('/:id/final-invoice', requireRoles('supplier', 'admin', 'clerk'), async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    
    if (doc.companyId !== companyId(req) && String(doc.supplierId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (req.user.role === 'supplier' && String(doc.supplierId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not your invoice.' });
    }
    if (req.user.role === 'clerk') {
      if (doc.supplierId && String(doc.supplierId).trim() !== '') {
        return res.status(403).json({ error: 'Only the assigned supplier can upload the final invoice for this requisition.' });
      }
    }
    if (!['paid', 'creditPurchase', 'deliveryNoteAttached'].includes(doc.status)) {
      return res.status(400).json({ error: 'Workflow state does not allow final invoice yet.' });
    }

    doc.finalInvoiceUrl = String(req.body?.finalInvoiceUrl || 'final-invoice.pdf');
    doc.type = 'final';
    doc.status = String(doc.deliveryNoteUrl || '').trim() ? 'closed' : doc.status;
    await doc.save();

    const reqDoc = doc.requisitionId
      ? await Requisition.findById(doc.requisitionId)
      : null;
    if (reqDoc) {
      reqDoc.status = doc.status === 'closed' ? 'closed' : reqDoc.status;
      await reqDoc.save();
      if (doc.status === 'closed') {
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
            'ok',
            scopeFromReq(reqDoc)
          );
        }
      }
    }

    await logActivity(doc.companyId, req.user.id, doc.status === 'closed' ? 'workflow.closed' : 'invoice.final_attached', {
      meta: { invoiceId: doc._id, requisitionId: doc.requisitionId },
    });
    if (doc.status === 'closed') {
      await notifyRole(
        doc.companyId,
        'admin',
        'Workflow closed',
        `${doc.reference} completed the full requisition-to-invoice cycle.`,
        'ok'
      );
    }

    if (reqDoc) {
      await notifyUser(
        reqDoc.clerkId,
        doc.status === 'closed' ? 'Requisition completed' : 'Final invoice uploaded',
        doc.status === 'closed'
          ? `${reqDoc.title}: this request is closed and stock was updated where applicable.`
          : `${reqDoc.title}: supplier uploaded the final invoice. Attach the delivery note when goods arrive to close the request.`,
        doc.status === 'closed' ? 'ok' : 'neutral'
      );
      if (doc.status === 'closed') {
        await notifyRole(
          doc.companyId,
          'supervisor',
          'Requisition closed',
          `${reqDoc.title} completed (${doc.reference}).`,
          'ok',
          scopeFromReq(reqDoc)
        );
      }
    }

    res.json({ invoice: doc, requisition: reqDoc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to attach final invoice.' });
  }
});

/** Accountant attaches or replaces a payment proof URL on a paid/closed invoice. */
router.patch('/:id/attach-payment-proof', requireRoles('accountant', 'admin'), async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });

    const allowedStatuses = ['paid', 'partiallyPaid', 'closed', 'creditPurchase', 'deliveryNoteAttached', 'creditAndPaid'];
    if (!allowedStatuses.includes(doc.status)) {
      return res.status(400).json({ error: 'Payment proof can only be attached after payment has been processed.' });
    }

    const proofUrl = String(req.body?.paymentProofUrl || '').trim();
    if (!proofUrl) {
      return res.status(400).json({ error: 'paymentProofUrl is required.' });
    }

    doc.paymentProofUrl = proofUrl;
    await doc.save();

    await logActivity(doc.companyId, req.user.id, 'invoice.payment_proof_attached', {
      meta: { invoiceId: doc._id },
    });

    const reqDoc = doc.requisitionId ? await Requisition.findById(doc.requisitionId) : null;
    if (doc.supplierId) {
      await notifyUser(
        doc.supplierId,
        'Payment proof uploaded',
        `${doc.reference}: the accountant attached payment proof documentation.`,
        'ok',
        { skipEmail: true }
      );
    }
    if (reqDoc?.clerkId) {
      await notifyUser(
        reqDoc.clerkId,
        'Payment proof uploaded',
        `${reqDoc.title}: payment proof for ${doc.reference} is now on file.`,
        'neutral',
        { skipEmail: true }
      );
    }

    res.json({ invoice: doc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to attach payment proof.' });
  }
});

export default router;
