import { sendMail } from './mail.js';
import User from '../models/User.js';

/** Respect user opt-out for order / proforma / payment emails (default on). */
async function workflowEmailsEnabled(userId) {
  if (!userId) return false;
  const user = await User.findById(userId).select('notifyWorkflowEmails').lean();
  if (!user) return false;
  return user.notifyWorkflowEmails !== false;
}
import {
  MAIL_PRODUCT_NAME,
  buildEmailDocument,
  clientBaseUrl,
  emailDetailCard,
  emailParagraph,
  escapeHtml,
  mailSubjectPrefix,
} from './emailLayout.js';

/**
 * Notify Supervisors that a clerk has submitted a new requisition
 */
export async function emailNewRequisitionToSupervisors(requisition, companyName) {
  const supervisors = await User.find({
    companyId: requisition.companyId,
    role: 'supervisor',
    isActive: true,
  })
    .select('email fullName')
    .lean();

  const subject = `${mailSubjectPrefix()} New requisition — ${requisition.title}`;
  const base = clientBaseUrl();

  const card = emailDetailCard([
    ['Title', escapeHtml(requisition.title)],
    ['Submitted by', escapeHtml(requisition.clerkName)],
    ['Location', escapeHtml(requisition.location)],
    ['Priority', escapeHtml(String(requisition.priority || '').toUpperCase())],
    ['Line items', escapeHtml(String(requisition.lines?.length ?? 0))],
  ]);

  for (const s of supervisors) {
    const html = buildEmailDocument({
      preheader: subject,
      headline: 'New procurement request',
      accent: 'neutral',
      bodyHtml: `${emailParagraph(`Hello ${escapeHtml(s.fullName)},`)}
        ${emailParagraph(
          `A new requisition has been submitted for <strong>${escapeHtml(requisition.location)}</strong>. Please review and assign or approve in ${MAIL_PRODUCT_NAME}.`
        )}${card}`,
      ctaLabel: 'Review requisition',
      ctaPath: '/login',
      secondaryCtaLabel: 'Reset password',
      secondaryCtaPath: '/forgot-password',
      footerLine: `${escapeHtml(companyName)} · ${MAIL_PRODUCT_NAME}`,
    });

    await sendMail({
      to: s.email,
      subject,
      html,
      text: `New requisition: ${requisition.title} by ${requisition.clerkName}. Review at ${base}/login`,
    });
  }
}

/**
 * Notify Supplier that they have been selected to provide a proforma
 */
export async function emailRequisitionAssignedToSupplier(requisition, hospitalName) {
  if (!(await workflowEmailsEnabled(requisition.supplierId))) return;
  const supplier = await User.findById(requisition.supplierId).select('email fullName').lean();
  if (!supplier) return;

  const subject = `${mailSubjectPrefix()} Proforma requested — ${hospitalName}`;
  const base = clientBaseUrl();

  const card = emailDetailCard([
    ['Buyer organization', escapeHtml(hospitalName)],
    ['Request', escapeHtml(requisition.title)],
    ['Items', escapeHtml(String(requisition.lines?.length ?? 0))],
  ]);

  const html = buildEmailDocument({
    preheader: subject,
    headline: 'Supply chain request',
    accent: 'brand',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(supplier.fullName || 'Partner')},`)}
      ${emailParagraph(
        `<strong>${escapeHtml(hospitalName)}</strong> has selected you to provide a proforma for their procurement request. Sign in to review line items and upload your quotation.`
      )}${card}`,
    ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · supplier network`,
  });

  await sendMail({
    to: supplier.email,
    subject,
    html,
    text: `New proforma request from ${hospitalName}. Login at ${base}/login`,
  });
}

/**
 * Notify the requesting clerk that their requisition was approved and sent to a supplier.
 */
export async function emailRequisitionApprovedToClerk(requisition, hospitalName, supplierLabel) {
  const clerk = await User.findById(requisition.clerkId).select('email fullName').lean();
  if (!clerk?.email) return;

  const subject = `${mailSubjectPrefix()} Approved — ${requisition.title}`;
  const base = clientBaseUrl();
  const name = clerk.fullName || 'there';

  const html = buildEmailDocument({
    preheader: subject,
    headline: 'Requisition approved',
    accent: 'success',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(name)},`)}
      ${emailParagraph(
        `Your supervisor has approved <strong>${escapeHtml(requisition.title)}</strong> and assigned it to <strong>${escapeHtml(supplierLabel || 'a supplier')}</strong> for a proforma.`
      )}
      ${emailParagraph(`Reference: <strong>${escapeHtml(String(requisition._id || requisition.id))}</strong>`)}`,
    ctaLabel: 'Track in portal',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${escapeHtml(hospitalName)} · ${MAIL_PRODUCT_NAME}`,
  });

  await sendMail({
    to: clerk.email,
    subject,
    html,
    text: `Requisition "${requisition.title}" approved. ${base}/login`,
  });
}

/**
 * Notify the requesting clerk that the supervisor rejected the requisition
 */
export async function emailRequisitionRejectedToClerk(requisition, hospitalName, supervisorNote) {
  const clerk = await User.findById(requisition.clerkId).select('email fullName').lean();
  if (!clerk?.email) return;

  const ref = requisition._id || requisition.id;
  const reasonBlock =
    supervisorNote && String(supervisorNote).trim()
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin:18px 0;">
           <p style="margin:0;font-size:12px;color:#991b1b;font-weight:700;text-transform:uppercase;">Supervisor note</p>
           <p style="margin:8px 0 0;font-size:15px;color:#1e293b;white-space:pre-wrap;">${escapeHtml(String(supervisorNote).trim())}</p>
         </div>`
      : emailParagraph('<span style="color:#64748b;">No additional note was provided. Open the portal for details.</span>');

  const subject = `${mailSubjectPrefix()} Not approved — ${requisition.title}`;
  const base = clientBaseUrl();
  const name = clerk.fullName || 'there';

  const html = buildEmailDocument({
    preheader: subject,
    headline: 'Requisition not approved',
    accent: 'danger',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(name)},`)}
      ${emailParagraph(
        `Your requisition <strong>${escapeHtml(requisition.title)}</strong> was not approved by a supervisor at <strong>${escapeHtml(hospitalName)}</strong>.`
      )}
      ${emailParagraph(`Reference: <strong>${escapeHtml(String(ref))}</strong>`)}
      ${reasonBlock}`,
    ctaLabel: 'View in portal',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${escapeHtml(hospitalName)} · ${MAIL_PRODUCT_NAME}`,
  });

  const textReason =
    supervisorNote && String(supervisorNote).trim()
      ? ` Reason: ${String(supervisorNote).trim()}`
      : '';
  await sendMail({
    to: clerk.email,
    subject,
    html,
    text: `Requisition "${requisition.title}" was rejected.${textReason} ${base}/login`,
  });
}

/**
 * Clerk: supplier uploaded proforma
 */
export async function emailProformaSubmittedToClerk(requisition, invoice, hospitalName, supplierLabel) {
  const clerk = await User.findById(requisition.clerkId).select('email fullName').lean();
  if (!clerk?.email) return;

  const ref = requisition._id || requisition.id;
  const subject = `${mailSubjectPrefix()} Proforma received — ${requisition.title}`;
  const base = clientBaseUrl();
  const name = clerk.fullName || 'there';
  const sup = escapeHtml(supplierLabel || invoice.supplierName || 'Supplier');
  const amt = `${invoice.currency || 'RWF'} ${Number(invoice.amount || 0).toLocaleString()}`;

  const card = emailDetailCard([
    ['Requisition', escapeHtml(requisition.title)],
    ['Request ID', escapeHtml(String(ref))],
    ['Proforma reference', escapeHtml(invoice.reference)],
    ['Amount', escapeHtml(amt)],
    ['Supplier', sup],
  ]);

  const html = buildEmailDocument({
    preheader: subject,
    headline: 'Supplier submitted proforma',
    accent: 'brand',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(name)},`)}
      ${emailParagraph(
        `<strong>${sup}</strong> has uploaded a proforma for <strong>${escapeHtml(requisition.title)}</strong>. Finance will review next.`
      )}${card}`,
    ctaLabel: 'Open portal',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${escapeHtml(hospitalName)} · ${MAIL_PRODUCT_NAME}`,
  });

  await sendMail({
    to: clerk.email,
    subject,
    html,
    text: `Proforma ${invoice.reference} for "${requisition.title}". ${base}/login`,
  });
}

/**
 * Supplier: confirmation that proforma was recorded
 */
export async function emailProformaSubmittedConfirmationToSupplier(requisition, invoice, hospitalName, supplierUser) {
  if (!supplierUser?.email) return;

  const subject = `${mailSubjectPrefix()} Proforma received — ${invoice.reference}`;
  const base = clientBaseUrl();
  const name = supplierUser.fullName || 'there';
  const ref = requisition._id || requisition.id;

  const html = buildEmailDocument({
    preheader: subject,
    headline: 'Submission received',
    accent: 'success',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(name)},`)}
      ${emailParagraph(
        `Your proforma <strong>${escapeHtml(invoice.reference)}</strong> for <strong>${escapeHtml(requisition.title)}</strong> at <strong>${escapeHtml(hospitalName)}</strong> has been received.`
      )}
      ${emailParagraph(`Request ID: <strong>${escapeHtml(String(ref))}</strong>`)}`,
    ctaLabel: 'Open supplier portal',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · supplier network`,
  });

  await sendMail({
    to: supplierUser.email,
    subject,
    html,
    text: `Proforma ${invoice.reference} received by ${hospitalName}. ${base}/login`,
  });
}

/**
 * Notify Accountants that a supplier has uploaded a proforma
 */
export async function emailProformaReceivedToAccountants(invoice, companyName, requisitionTitle) {
  const accountants = await User.find({
    companyId: invoice.companyId,
    role: 'accountant',
    isActive: true,
  })
    .select('email fullName')
    .lean();

  const subject = `${mailSubjectPrefix()} Finance review — ${invoice.reference}`;
  const base = clientBaseUrl();

  const card = emailDetailCard([
    ['Supplier', escapeHtml(invoice.supplierName || '—')],
    ['Requisition', escapeHtml(requisitionTitle)],
    ['Invoice reference', escapeHtml(invoice.reference)],
    ['Amount', escapeHtml(`${invoice.currency} ${invoice.amount.toLocaleString()}`)],
  ]);

  for (const a of accountants) {
    const html = buildEmailDocument({
      preheader: subject,
      headline: 'Proforma ready for finance',
      accent: 'neutral',
      bodyHtml: `${emailParagraph(`Hello ${escapeHtml(a.fullName)},`)}
        ${emailParagraph(
          `A proforma has been received from <strong>${escapeHtml(invoice.supplierName)}</strong> for <em>${escapeHtml(requisitionTitle)}</em>.`
        )}${card}`,
      ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
      ctaPath: '/login',
      secondaryCtaLabel: 'Reset password',
      secondaryCtaPath: '/forgot-password',
      footerLine: `${escapeHtml(companyName)} · ${MAIL_PRODUCT_NAME}`,
    });

    await sendMail({
      to: a.email,
      subject,
      html,
      text: `Proforma from ${invoice.supplierName} for ${requisitionTitle}. ${base}/login`,
    });
  }
}

/**
 * Email 3: Notify Supplier that proforma has been marked PAID or CREDIT PURCHASE
 * This is the final essential email - supplier can now upload delivery note and final invoice
 */
export async function emailPaymentConfirmedToSupplier(invoice, hospitalName) {
  if (!(await workflowEmailsEnabled(invoice.supplierId))) return;
  const supplier = await User.findById(invoice.supplierId).select('email fullName').lean();
  if (!supplier) return;

  const isCreditPurchase = invoice.status === 'creditPurchase';
  const subject = isCreditPurchase
    ? `${mailSubjectPrefix()} Credit Purchase Approved — ${invoice.reference}`
    : `${mailSubjectPrefix()} Payment Confirmed — ${invoice.reference}`;
  const base = clientBaseUrl();

  const card = emailDetailCard([
    ['Invoice', escapeHtml(invoice.reference)],
    ['Amount', escapeHtml(`${invoice.currency} ${invoice.amount.toLocaleString()}`)],
    ['Buyer', escapeHtml(hospitalName)],
    ['Payment Type', isCreditPurchase ? 'Credit Purchase' : 'Paid'],
  ]);

  const bodyMessage = isCreditPurchase
    ? `<strong>${escapeHtml(hospitalName)}</strong> has approved a credit purchase for proforma <strong>${escapeHtml(invoice.reference)}</strong>. You may now proceed with fulfillment.`
    : `<strong>${escapeHtml(hospitalName)}</strong> has confirmed payment for proforma <strong>${escapeHtml(invoice.reference)}</strong>. You may now proceed with fulfillment.`;

  const html = buildEmailDocument({
    preheader: subject,
    headline: isCreditPurchase ? 'Credit Purchase Approved' : 'Payment Confirmed',
    accent: 'success',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(supplier.fullName)},`)}
      ${emailParagraph(bodyMessage)}
      ${emailParagraph(`<strong>Next Steps:</strong>`)}
      <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.7;">
        <li>Prepare and deliver the materials</li>
        <li>Upload the delivery note in the portal</li>
        <li>Upload the final invoice to close the order</li>
      </ul>
      ${card}`,
    ctaLabel: 'Upload Delivery Documents',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · supplier network`,
  });

  await sendMail({
    to: supplier.email,
    subject,
    html,
    text: `${isCreditPurchase ? 'Credit purchase approved' : 'Payment confirmed'} for ${invoice.reference} by ${hospitalName}. Upload delivery documents at ${base}/login`,
  });
}

/** Supplier: clerk declined the proforma */
export async function emailProformaDeclinedByClerk(requisition, invoice, hospitalName, clerkNote) {
  if (!(await workflowEmailsEnabled(requisition.supplierId))) return;
  const supplier = await User.findById(requisition.supplierId).select('email fullName').lean();
  if (!supplier?.email) return;

  const subject = `${mailSubjectPrefix()} Proforma not accepted — ${requisition.title}`;
  const note =
    clerkNote && String(clerkNote).trim()
      ? emailParagraph(`<strong>Clerk note:</strong> ${escapeHtml(String(clerkNote).trim())}`)
      : emailParagraph('The buyer did not accept this proforma. Open the portal for next steps.');

  const ref = requisition._id || requisition.id;
  const card = emailDetailCard([
    ['Requisition', escapeHtml(requisition.title)],
    ['Request ID', escapeHtml(String(ref))],
    ['Proforma', escapeHtml(invoice?.reference || '—')],
    ['Organization', escapeHtml(hospitalName)],
  ]);

  const html = buildEmailDocument({
    preheader: subject,
    headline: 'Proforma not accepted',
    accent: 'warning',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(supplier.fullName || 'there')},`)}${note}${card}`,
    ctaLabel: 'Open supplier portal',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${escapeHtml(hospitalName)} · ${MAIL_PRODUCT_NAME}`,
  });

  await sendMail({
    to: supplier.email,
    subject,
    html,
    text: `Proforma for "${requisition.title}" was not accepted. ${clientBaseUrl()}/login`,
  });
}

/**
 * Send only essential email to supplier about finance decision
 * Email 2: Proforma approved (waiting for payment) OR Proforma rejected
 */
export async function emailFinanceProformaDecisionToSupplier({
  invoice,
  requisition,
  hospitalName,
  decision,
  financeNote,
}) {
  if (!(await workflowEmailsEnabled(invoice.supplierId))) return;
  const base = clientBaseUrl();
  const isApp = decision === 'approved';
  const subject = isApp
    ? `${mailSubjectPrefix()} Proforma Approved - Awaiting Payment — ${invoice.reference}`
    : `${mailSubjectPrefix()} Finance declined — ${invoice.reference}`;

  const cardRows = [
    ['Requisition', escapeHtml(requisition?.title || '—')],
    ['Proforma', escapeHtml(invoice.reference || '—')],
    ['Amount', escapeHtml(`${invoice.currency || 'RWF'} ${Number(invoice.amount || 0).toLocaleString()}`)],
  ];
  if (financeNote && String(financeNote).trim()) {
    cardRows.push(['Finance note', escapeHtml(String(financeNote).trim())]);
  }
  const card = emailDetailCard(cardRows);

  const supplier = await User.findById(invoice.supplierId).select('email fullName').lean();
  if (!supplier?.email) return;

  const supIntro = isApp
    ? `<strong>${escapeHtml(hospitalName)}</strong> approved your proforma <strong>${escapeHtml(invoice.reference)}</strong>. You will receive a payment confirmation email once payment is processed. Then you can upload the delivery note and final invoice.`
    : `Finance did not approve proforma <strong>${escapeHtml(invoice.reference)}</strong> for <strong>${escapeHtml(requisition?.title || '')}</strong>. Please review the note and contact the buyer if needed.`;

  const html = buildEmailDocument({
    preheader: subject,
    headline: isApp ? 'Proforma approved - Awaiting payment' : 'Proforma not approved by finance',
    accent: isApp ? 'success' : 'danger',
    bodyHtml: `<p style="margin:0 0 16px;">Hello ${escapeHtml(supplier.fullName || 'there')},</p><p style="margin:0 0 16px;line-height:1.65;">${supIntro}</p>${card}`,
    ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${escapeHtml(hospitalName)} · ${MAIL_PRODUCT_NAME}`,
  });
  
  const plain = supIntro.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  await sendMail({
    to: supplier.email,
    subject,
    html,
    text: `${plain} ${base}/login`,
  });
}

/** @deprecated Use emailFinanceProformaDecisionToSupplier — clerk email removed per workflow policy. */
export async function emailFinanceProformaDecisionToParties(args) {
  return emailFinanceProformaDecisionToSupplier(args);
}

/**
 * Notify all parties (Clerk, Supervisor, Accountants) that the workflow is closed and the final invoice is on file.
 */
export async function emailFinalInvoiceToParties({ invoice, requisition, hospitalName }) {
  const accountants = await User.find({
    companyId: invoice.companyId,
    role: 'accountant',
    isActive: true,
  })
    .select('email fullName')
    .lean();

  const clerk = await User.findById(requisition.clerkId).select('email fullName').lean();
  const supervisors = await User.find({
    companyId: invoice.companyId,
    role: 'supervisor',
    isActive: true,
  })
    .select('email fullName')
    .lean();

  const subject = `${mailSubjectPrefix()} Requisition closed — ${invoice.reference}`;
  const base = clientBaseUrl();

  const card = emailDetailCard([
    ['Requisition', escapeHtml(requisition.title)],
    ['Reference', escapeHtml(invoice.reference)],
    ['Amount', escapeHtml(`${invoice.currency} ${invoice.amount.toLocaleString()}`)],
    ['Status', 'Completed'],
  ]);

  const recipients = [...accountants, ...supervisors];
  if (clerk) recipients.push(clerk);

  for (const r of recipients) {
    if (!r.email) continue;
    const html = buildEmailDocument({
      preheader: subject,
      headline: 'Procurement cycle completed',
      accent: 'success',
      bodyHtml: `${emailParagraph(`Hello ${escapeHtml(r.fullName)},`)}
        ${emailParagraph(
          `The supplier has uploaded the final invoice for <strong>${escapeHtml(requisition.title)}</strong>. The procurement cycle for <strong>${escapeHtml(invoice.reference)}</strong> is now closed and stock has been updated.`
        )}${card}`,
      ctaLabel: 'View details',
      ctaPath: '/login',
      secondaryCtaLabel: 'Reset password',
      secondaryCtaPath: '/forgot-password',
      footerLine: `${escapeHtml(hospitalName)} · ${MAIL_PRODUCT_NAME}`,
    });

    await sendMail({
      to: r.email,
      subject,
      html,
      text: `Workflow closed for ${requisition.title}. Final invoice ${invoice.reference} is on file. ${base}/login`,
    });
  }
}
