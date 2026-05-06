import crypto from 'node:crypto';
import { Router } from 'express';
import Requisition from '../models/Requisition.js';
import { allocateRequisitionId } from '../lib/requisitionIds.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { messageRole, messageUser, notifyRole, notifyUser } from '../services/notify.js';
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
  const userId = req.user.id != null ? String(req.user.id).trim() : '';
  const myCompanyId = String(companyId(req) || '').trim();
  let filter;
  if (req.user.role === 'supplier') {
    const co = String(req.user.companyId || '').trim();
    const keys = [...new Set([userId, co].filter(Boolean))];
    filter = keys.length ? { supplierId: { $in: keys } } : { _id: '__none__' };
  } else {
    filter = { $or: [{ companyId: myCompanyId }, { supplierId: userId }] };
  }
  const requisitions = await Requisition.find(filter).sort({ updatedAt: -1 }).limit(500).lean();
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
    
    const orgName = await hospitalDisplayName(companyId(req));
    emailNewRequisitionToSupervisors(doc, orgName).catch((err) => console.error('[requisition] email notify failed:', err));

    res.status(201).json({ requisition: doc });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to create requisition.' });
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
      const supplierId = String(req.body?.supplierId || '');
      if (!supplierId) {
        return res.status(400).json({
          error: 'Please select a supplier for this requisition.',
        });
      }
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
        'Approved requisition available',
        `${doc.title} is ready for proforma creation.`,
        'neutral'
      );
      await messageRole(
        companyId(req),
        'clerk',
        'Requisition approved',
        `${doc.title} moved to supplier processing (${supplierLabel}).`,
        'Supervisor'
      );

      emailRequisitionAssignedToSupplier(doc, orgName).catch((err) => console.error('[requisition] supplier email failed:', err));
      emailRequisitionApprovedToClerk(doc, orgName, supplierLabel).catch((err) =>
        console.error('[requisition] clerk email failed:', err)
      );
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
      await notifyUser(doc.clerkId, 'Requisition rejected', reasonText, 'bad');
      await messageUser(
        doc.clerkId,
        'Requisition rejected',
        note?.trim() || 'No reason was provided. You can view the request and PDF in Request materials.',
        'Supervisor'
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
      'neutral'
    );

    emailProformaSubmittedToClerk(doc, invoice, orgName, supplierLabel).catch((err) =>
      console.error('[requisition] clerk proforma email failed:', err)
    );
    emailProformaSubmittedConfirmationToSupplier(doc, invoice, orgName, actor).catch((err) =>
      console.error('[requisition] supplier proforma confirm email failed:', err)
    );

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
    await notifyRole(
      doc.companyId,
      'accountant',
      'Proforma ready for finance',
      `${doc.title} was accepted by the clerk — you can review ${invoice?.reference || 'the proforma'}.`,
      'warn'
    );
    await messageRole(
      doc.companyId,
      'accountant',
      'Clerk accepted supplier proforma',
      `${doc.title} is ready for finance approval.`,
      doc.clerkName || 'Clerk'
    );
    await notifyRole(
      doc.companyId,
      'supervisor',
      'Clerk accepted proforma',
      `${doc.title} — finance can review ${invoice?.reference || 'the supplier proforma'}.`,
      'neutral'
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

export default router;
