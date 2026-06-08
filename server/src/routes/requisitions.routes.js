import crypto from 'node:crypto';
import { Router } from 'express';
import Requisition from '../models/Requisition.js';
import { allocateRequisitionId } from '../lib/requisitionIds.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { requireAuth, requireRoles, requirePermission } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { messageRole, messageUser, notifyRole, notifyUser } from '../services/notify.js';
import { compactNotifyScope, requisitionNotifyScope, requisitionScopeQuery } from '../services/orgScope.js';
import {
  emailNewRequisitionToSupervisors,
  emailRequisitionAssignedToSupplier,
  emailRequisitionApprovedToClerk,
  emailRequisitionRejectedToClerk,
  emailProformaReceivedToAccountants,
  emailProformaSubmittedToClerk,
  emailProformaSubmittedConfirmationToSupplier,
  emailProformaDeclinedByClerk,
} from '../services/workflowNotifications.js';

const router = Router();

router.use(requireAuth);

function companyId(req) {
  return req.user.companyId;
}

/** Requisition.supplierId is the supplier user id; legacy rows may use supplier company id. */
function assignedSupplierMatches(doc, reqUser) {
  const sid = doc.supplierId != null ? String(doc.supplierId).trim() : '';
  if (!sid) return false;
  const uid = reqUser.id != null ? String(reqUser.id).trim() : '';
  const co = reqUser.companyId != null ? String(reqUser.companyId).trim() : '';
  return (uid && sid === uid) || (co && sid === co);
}

async function hospitalDisplayName(cid) {
  const c = await Company.findById(cid).select('name').lean();
  return c?.name || 'Your organization';
}

router.get('/', async (req, res) => {
  const filter = requisitionScopeQuery(req.user);
  const requisitions = await Requisition.find(filter).sort({ updatedAt: -1 }).limit(500).lean();
  res.json({ requisitions });
});

router.post('/', requireRoles('clerk', 'admin'), requirePermission('requisitions:manual'), async (req, res) => {
  try {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) {
      return res.status(400).json({ error: 'At least one line item is required.' });
    }

    const actor = await User.findById(req.user.id).lean();
    const id = await allocateRequisitionId(companyId(req), 'manu');
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
      requestingDepartment: String(b.requestingDepartment || '').trim(),
      deliveryNote: String(b.deliveryNote || '').trim(),
      clerkJustification: String(b.clerkJustification || '').trim(),
      lines: lines.map((line) => ({
        description: String(line.description || '').trim() || 'Item',
        quantity: Math.max(0, Number(line.quantity) || 0),
        unit: String(line.unit || 'units'),
        estimatedCost: Math.max(0, Number(line.estimatedCost) || 0),
        dateValue: String(line.dateValue || '').trim(),
      })),
    });

    await logActivity(companyId(req), req.user.id, 'stock.request.created', {
      meta: { requisitionId: doc._id, location: doc.location },
    });
    const reqScope = compactNotifyScope(requisitionNotifyScope(doc, actor));
    await notifyRole(
      companyId(req),
      'supervisor',
      'New requisition submitted',
      `${doc.clerkName} submitted ${doc.title}.`,
      'neutral',
      { ...reqScope, skipEmail: true }
    );
    await messageRole(
      companyId(req),
      'supervisor',
      'Approval needed',
      `${doc.title} is waiting in the approval queue.`,
      doc.clerkName,
      { ...reqScope, skipEmail: true }
    );

    const orgName = await hospitalDisplayName(companyId(req));
    emailNewRequisitionToSupervisors(doc, orgName).catch((err) => console.error('[requisition] email notify failed:', err));

    res.status(201).json({ requisition: doc });
  } catch (error) {
    console.error('[requisitions] Create error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      companyId: req.user?.companyId,
      body: req.body,
    });
    res.status(400).json({ 
      error: 'Unable to create requisition.',
      details: error.message 
    });
  }
});

router.patch('/:id/review', requireRoles('supervisor', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (doc.status !== 'submitted') {
      return res.status(400).json({ error: 'Only submitted requisitions can be reviewed.' });
    }

    const reviewer = await User.findById(req.user.id).lean();
    const reviewerName = String(reviewer?.fullName || req.user.fullName || '').trim();
    const reviewerRole = String(reviewer?.role || req.user.role || '').trim();

    const decision = req.body?.decision === 'rejected' ? 'rejected' : 'approved';
    const note = String(req.body?.note || '');

    if (decision === 'approved') {
      const supplierId = String(req.body?.supplierId || '').trim();
      if (supplierId) {
        const supplier = await User.findById(supplierId).lean();
        if (!supplier) return res.status(404).json({ error: 'Selected supplier not found.' });

        doc.status = 'sentToSupplier';
        doc.supplierId = supplierId;
        doc.supplierName = supplier.companyName || supplier.fullName || '';
        doc.supervisorNote = note;
        doc.reviewedById = String(req.user.id);
        doc.reviewedByName = reviewerName;
        doc.reviewedByRole = reviewerRole;
        doc.reviewedAt = new Date();
        await doc.save();

        const orgName = await hospitalDisplayName(companyId(req));
        const supplierLabel = doc.supplierName || supplier.fullName || 'Supplier';

        await logActivity(companyId(req), req.user.id, 'stock.request.approved', { meta: { requisitionId: doc._id } });
        await notifyUser(
          doc.supplierId,
          'Proforma requested',
          `${doc.title} is ready for your proforma.`,
          'neutral',
          { skipEmail: true }
        );
        await messageRole(
          companyId(req),
          'clerk',
          'Requisition approved',
          `${doc.title} moved to supplier processing (${supplierLabel}).`,
          'Supervisor',
          { ...compactNotifyScope(requisitionNotifyScope(doc, null)), skipEmail: true }
        );

        emailRequisitionAssignedToSupplier(doc, orgName).catch((err) => console.error('[requisition] supplier email failed:', err));
        emailRequisitionApprovedToClerk(doc, orgName, supplierLabel).catch((err) =>
          console.error('[requisition] clerk email failed:', err)
        );
      } else {
        doc.status = 'approvedExternal';
        doc.supplierId = '';
        doc.supplierName = '';
        doc.supervisorNote = note;
        doc.reviewedById = String(req.user.id);
        doc.reviewedByName = reviewerName;
        doc.reviewedByRole = reviewerRole;
        doc.reviewedAt = new Date();
        await doc.save();

        await logActivity(companyId(req), req.user.id, 'stock.request.approved_external', { meta: { requisitionId: doc._id } });
        await notifyUser(
          doc.clerkId,
          'Requisition approved (External Supplier)',
          `Your requisition "${doc.title}" was approved without a portal supplier. Please upload the proforma manually.`,
          'neutral'
        );
        await messageRole(
          companyId(req),
          'clerk',
          'Requisition approved (External Supplier)',
          `${doc.title} was approved. Please upload the proforma and supporting documents manually.`,
          'Supervisor',
          { ...compactNotifyScope(requisitionNotifyScope(doc, null)), skipEmail: true }
        );
      }
    } else {
      doc.status = 'rejected';
      doc.supervisorNote = note;
      doc.reviewedById = String(req.user.id);
      doc.reviewedByName = reviewerName;
      doc.reviewedByRole = reviewerRole;
      doc.reviewedAt = new Date();
      await doc.save();
      const orgName = await hospitalDisplayName(companyId(req));
      const reasonText = note?.trim()
        ? `${doc.title} was rejected. Supervisor note: ${note.trim()}`
        : `${doc.title} was rejected by the supervisor.`;

      await logActivity(companyId(req), req.user.id, 'stock.request.rejected', { meta: { requisitionId: doc._id } });
      await notifyUser(doc.clerkId, 'Requisition rejected', reasonText, 'bad', { skipEmail: true });
      await messageUser(
        doc.clerkId,
        'Requisition rejected',
        note?.trim() || 'No reason was provided. You can view the request and PDF in Request materials.',
        'Supervisor',
        { skipEmail: true }
      );
      emailRequisitionRejectedToClerk(doc, orgName, note).catch((err) =>
        console.error('[requisition] clerk rejection email failed:', err)
      );
    }

    res.json({ requisition: doc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to review requisition.' });
  }
});

router.post('/:id/supplier-proforma', requireRoles('supplier', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    
    // Cross-company check for supplier
    const isOwner = doc.companyId === companyId(req);
    const isAssignedSupplier = assignedSupplierMatches(doc, req.user);

    if (!isOwner && !isAssignedSupplier) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (req.user.role === 'supplier' && doc.supplierId && !assignedSupplierMatches(doc, req.user)) {
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

    // Update supplied quantities
    if (Array.isArray(b.lines) && b.lines.length > 0) {
      b.lines.forEach((suppliedLine, index) => {
        if (doc.lines[index]) {
          doc.lines[index].suppliedQuantity = Math.max(0, Number(suppliedLine.suppliedQuantity) || 0);
        }
      });
    }

    doc.status = 'proformaAwaitingClerk';
    await doc.save();

    /** Payee is the supervisor-assigned supplier; keep aligned for accountant payments and reporting. */
    const payeeId = String(doc.supplierId || req.user.id || '').trim() || String(req.user.id);
    const payee = await User.findById(payeeId).lean();
    const actor = await User.findById(req.user.id).lean();
    const supplierNameForInvoice =
      (doc.supplierName && String(doc.supplierName).trim()) ||
      payee?.companyName ||
      payee?.fullName ||
      actor?.companyName ||
      actor?.fullName ||
      '';

    let invoice = await Invoice.findOne({
      requisitionId: doc._id,
      type: 'proforma',
    });

    if (invoice) {
      invoice.reference = reference;
      invoice.amount = amount;
      invoice.attachmentUrl = attachmentUrl;
      invoice.status = 'proformaReceived';
      invoice.notes = notes;
      invoice.supplierId = payeeId;
      invoice.supplierName = supplierNameForInvoice;
      await invoice.save();
    } else {
      const invId = `inv_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      invoice = await Invoice.create({
        _id: invId,
        companyId: doc.companyId, // The hospital's companyId
        requisitionId: doc._id,
        stockRequestId: doc._id,
        supplierId: payeeId,
        supplierName: supplierNameForInvoice,
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
    const orgName = await hospitalDisplayName(doc.companyId);
    const supplierLabel = supplierNameForInvoice || 'Supplier';

    await notifyUser(
      doc.clerkId,
      'Proforma submitted',
      `${doc.title}: ${supplierLabel} uploaded proforma ${reference}. Please review and accept or decline before finance is notified.`,
      'neutral',
      { skipEmail: true }
    );
    await notifyUser(
      req.user.id,
      'Proforma submitted',
      `${reference} for ${doc.title} was received at ${orgName}. The clerk will confirm before finance reviews.`,
      'ok',
      { skipEmail: true }
    );
    await notifyRole(
      doc.companyId,
      'supervisor',
      'Supplier uploaded proforma',
      `${doc.title} — awaiting clerk confirmation for ${reference} before finance review.`,
      'neutral',
      compactNotifyScope(requisitionNotifyScope(doc, null))
    );
    
    // REDUCED EMAIL NOTIFICATIONS: Only send essential emails to supplier
    // Email 1: New order assigned - already sent above by emailRequisitionAssignedToSupplier
    
    // Note: Removed proforma submission confirmation email to supplier (redundant)
    // They know they submitted, no need for confirmation email
    
    emailProformaSubmittedToClerk(doc, invoice, orgName, supplierLabel).catch((err) =>
      console.error('[requisition] clerk proforma email failed:', err)
    );
    
    // Note: This email goes to accountants, not supplier, so it's kept for internal workflow

    res.status(201).json({ requisition: doc, invoice });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to submit proforma.' });
  }
});

router.post('/:id/clerk-proforma-review', requireRoles('clerk', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (req.user.role === 'clerk' && doc.clerkId !== req.user.id) {
      return res.status(403).json({ error: 'This requisition is not assigned to you.' });
    }
    if (doc.status !== 'proformaAwaitingClerk') {
      return res.status(400).json({ error: 'No supplier proforma is awaiting clerk review.' });
    }

    const decision = req.body?.decision === 'rejected' ? 'rejected' : 'accepted';
    const note = String(req.body?.note || '');

    const invoice = await Invoice.findOne({ requisitionId: doc._id, type: 'proforma' });

    if (decision === 'rejected') {
      doc.status = 'rejected';
      doc.supervisorNote = note || 'Clerk declined the supplier proforma.';
      await doc.save();
      if (invoice) {
        invoice.status = 'rejected';
        if (note) invoice.notes = note;
        await invoice.save();
      }
      await logActivity(companyId(req), req.user.id, 'requisition.clerk_proforma.rejected', {
        meta: { requisitionId: doc._id, invoiceId: invoice?._id },
      });
      const orgName = await hospitalDisplayName(doc.companyId);
      if (doc.supplierId) {
        await notifyUser(
          doc.supplierId,
          'Proforma declined by hospital',
          `${doc.title}: the clerk declined the proforma.${note ? ` Note: ${note}` : ''}`,
          'bad',
          { skipEmail: true }
        );
        emailProformaDeclinedByClerk(doc, invoice || {}, orgName, note).catch((err) =>
          console.error('[requisition] supplier decline email failed:', err)
        );
      }
      return res.json({ requisition: doc, invoice });
    }

    doc.status = 'proformaReceived';
    await doc.save();

    await logActivity(companyId(req), req.user.id, 'requisition.clerk_proforma.accepted', {
      meta: { requisitionId: doc._id, invoiceId: invoice?._id },
    });

    const orgName = await hospitalDisplayName(doc.companyId);
    const acceptScope = compactNotifyScope(requisitionNotifyScope(doc, null));
    await notifyRole(
      doc.companyId,
      'accountant',
      'Proforma ready for finance',
      `${doc.title} was accepted by the clerk — you can review ${invoice?.reference || 'the proforma'}.`,
      'warn',
      { ...acceptScope, skipEmail: true }
    );
    await messageRole(
      doc.companyId,
      'accountant',
      'Clerk accepted supplier proforma',
      `${doc.title} is ready for finance approval.`,
      doc.clerkName || 'Clerk',
      { ...acceptScope, skipEmail: true }
    );
    await notifyRole(
      doc.companyId,
      'supervisor',
      'Clerk accepted proforma',
      `${doc.title} — finance can review ${invoice?.reference || 'the supplier proforma'}.`,
      'neutral',
      acceptScope
    );
    if (invoice) {
      emailProformaReceivedToAccountants(invoice, orgName, doc.title).catch((err) =>
        console.error('[requisition] accountant notify failed:', err)
      );
    }

    res.json({ requisition: doc, invoice });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to record clerk decision.' });
  }
});


/** Clerk submits an auto-draft to the supervisor queue */
router.post('/:id/submit-draft', requireRoles('clerk', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (doc.status !== 'draft') return res.status(400).json({ error: 'Only drafts can be submitted this way.' });

    doc.status = 'submitted';
    await doc.save();

    const actor = await User.findById(req.user.id).lean();
    const reqScope = compactNotifyScope(requisitionNotifyScope(doc, actor));
    await notifyRole(companyId(req), 'supervisor', 'New requisition submitted', `${doc.clerkName} submitted ${doc.title}.`, 'neutral', { ...reqScope, skipEmail: true });
    await messageRole(companyId(req), 'supervisor', 'Approval needed', `${doc.title} is waiting in the approval queue.`, doc.clerkName, { ...reqScope, skipEmail: true });

    const orgName = await hospitalDisplayName(companyId(req));
    emailNewRequisitionToSupervisors(doc, orgName).catch((err) => console.error('[requisition] email notify failed:', err));

    res.json({ requisition: doc });
  } catch (error) {
    console.error('[requisitions] Submit draft error:', error);
    res.status(400).json({ error: 'Unable to submit draft.' });
  }
});

/** Clerk updates lines/priority of an auto-draft before submission */
router.patch('/:id/draft', requireRoles('clerk', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (doc.status !== 'draft') return res.status(400).json({ error: 'Only drafts can be edited this way.' });

    const b = req.body || {};
    if (Array.isArray(b.lines) && b.lines.length > 0) {
      doc.lines = b.lines.map((line) => ({
        description: String(line.description || '').trim() || 'Item',
        quantity: Math.max(0, Number(line.quantity) || 0),
        unit: String(line.unit || 'units'),
        estimatedCost: Math.max(0, Number(line.estimatedCost) || 0),
        dateValue: String(line.dateValue || '').trim(),
      }));
    }
    if (b.priority && ['low', 'normal', 'high', 'critical'].includes(b.priority)) {
      doc.priority = b.priority;
    }
    if (typeof b.supervisorNote === 'string') doc.supervisorNote = b.supervisorNote.trim();
    if (typeof b.clerkJustification === 'string') doc.clerkJustification = b.clerkJustification.trim();
    if (typeof b.requestingDepartment === 'string') doc.requestingDepartment = b.requestingDepartment.trim();
    await doc.save();

    res.json({ requisition: doc });
  } catch (error) {
    console.error('[requisitions] Edit draft error:', error);
    res.status(400).json({ error: 'Unable to update draft.' });
  }
});

/** Clerk cancels/deletes an auto-draft */
router.delete('/:id/draft', requireRoles('clerk', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (doc.status !== 'draft') return res.status(400).json({ error: 'Only drafts can be deleted.' });

    doc.status = 'cancelled';
    await doc.save();

    res.json({ ok: true });
  } catch (error) {
    console.error('[requisitions] Delete draft error:', error);
    res.status(400).json({ error: 'Unable to delete draft.' });
  }
});

/** Clerk uploads external proforma/supporting document */
router.patch('/:id/clerk-upload-external', requireRoles('clerk', 'admin'), async (req, res) => {
  try {
    const doc = await Requisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Requisition not found.' });
    if (doc.companyId !== companyId(req)) return res.status(403).json({ error: 'Forbidden.' });
    if (doc.status !== 'approvedExternal') {
      return res.status(400).json({ error: 'Only requisitions approved for external suppliers can have documents uploaded this way.' });
    }

    const b = req.body || {};
    const reference = String(b.reference || `EXT-${Date.now()}`).trim();
    const amount = Math.max(0, Number(b.amount) || 0);
    const attachmentUrl = String(b.attachmentUrl || '').trim();
    if (!attachmentUrl) {
      return res.status(400).json({ error: 'Attachment URL is required.' });
    }
    const notes = String(b.notes || '').trim();
    const currency = String(b.currency || 'RWF').trim();

    doc.status = 'proformaReceived';
    await doc.save();

    const invId = `inv_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const invoice = await Invoice.create({
      _id: invId,
      companyId: doc.companyId,
      requisitionId: doc._id,
      stockRequestId: doc._id,
      supplierId: '',
      supplierName: 'External Supplier',
      createdBy: req.user.id,
      type: 'proforma',
      status: 'proformaReceived',
      reference,
      amount,
      currency,
      notes,
      attachmentUrl,
    });

    await logActivity(companyId(req), req.user.id, 'invoice.proforma.received_external', {
      meta: { requisitionId: doc._id, reference, invoiceId: invoice._id },
    });

    const orgName = await hospitalDisplayName(doc.companyId);
    const acceptScope = compactNotifyScope(requisitionNotifyScope(doc, null));

    await notifyRole(
      doc.companyId,
      'accountant',
      'Proforma ready for finance (External)',
      `${doc.title} — clerk uploaded proforma ${reference} for external supplier.`,
      'warn',
      { ...acceptScope, skipEmail: true }
    );
    await messageRole(
      doc.companyId,
      'accountant',
      'Clerk uploaded external proforma',
      `${doc.title} is ready for finance approval.`,
      doc.clerkName || 'Clerk',
      { ...acceptScope, skipEmail: true }
    );
    await notifyRole(
      doc.companyId,
      'supervisor',
      'Clerk uploaded external proforma',
      `${doc.title} — finance can review ${reference}.`,
      'neutral',
      acceptScope
    );

    emailProformaReceivedToAccountants(invoice, orgName, doc.title).catch((err) =>
      console.error('[requisition] external proforma email failed:', err)
    );

    res.json({ requisition: doc, invoice });
  } catch (error) {
    console.error('[requisitions] Clerk upload external proforma error:', error);
    res.status(400).json({ error: 'Unable to upload external proforma.' });
  }
});

export default router;
