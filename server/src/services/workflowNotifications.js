import { sendMail } from './mail.js';
import User from '../models/User.js';
import { buildEmailDocument, emailParagraph, emailDetailCard, escapeHtml } from './emailLayout.js';

function escapeHtmlSnippet(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clientBaseUrl() {
  return String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/**
 * Notify Supervisors that a clerk has submitted a new requisition
 */
export async function emailNewRequisitionToSupervisors(requisition, companyName) {
  const supervisors = await User.find({
    companyId: requisition.companyId,
    role: 'supervisor',
    isActive: true,
  }).select('email fullName').lean();

  const subject = `[New Requisition] ${requisition.title}`;
  const base = clientBaseUrl();

  for (const s of supervisors) {
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #1e293b; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">Procurement Request</h2>
        </div>
        <div style="padding: 40px 30px;">
          <p style="font-size: 16px;">Hello ${s.fullName},</p>
          <p style="font-size: 16px; line-height: 1.6;">
            A new requisition has been submitted by <strong>${requisition.clerkName}</strong> for the <strong>${requisition.location}</strong> location.
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: 700;">Requisition Details</p>
            <p style="margin: 10px 0 0; font-size: 17px; font-weight: 700; color: #780b23;">${requisition.title}</p>
            <p style="margin: 5px 0 0; font-size: 14px; color: #475569;">Priority: ${requisition.priority.toUpperCase()}</p>
            <p style="margin: 5px 0 0; font-size: 14px; color: #475569;">Items: ${requisition.lines.length}</p>
          </div>

          <div style="text-align: center; margin-top: 35px;">
            <a href="${base}/login" 
               style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
              Review Requisition
            </a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          e-Cunga Platform · Workflow Automation
        </div>
      </div>
    `;

    await sendMail({ to: s.email, subject, html: htmlContent, text: `New requisition: ${requisition.title} by ${requisition.clerkName}. Review at ${base}/login` });
  }
}

/**
 * Notify Supplier that they have been selected to provide a proforma
 */
export async function emailRequisitionAssignedToSupplier(requisition, hospitalName) {
  const supplier = await User.findById(requisition.supplierId).select('email fullName').lean();
  if (!supplier) return;

  const subject = `[New Request] Proforma Required for ${hospitalName}`;
  const base = clientBaseUrl();

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #780b23; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #780b23; padding: 25px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Supply Chain Request</h2>
      </div>
      <div style="padding: 40px 30px;">
        <p style="font-size: 16px;">Hello ${supplier.fullName || 'Partner'},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          <strong>${hospitalName}</strong> has selected you to provide a proforma invoice for their latest procurement request.
        </p>
        
        <div style="background-color: #fffaf0; border: 1px solid #fbd38d; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; font-size: 14px; color: #7b341e; text-transform: uppercase; font-weight: 700;">Request Reference</p>
          <p style="margin: 10px 0 0; font-size: 17px; font-weight: 700; color: #2d3748;">${requisition.title}</p>
          <p style="margin: 5px 0 0; font-size: 14px; color: #4a5568;">Items Requested: ${requisition.lines.length}</p>
        </div>

        <p style="font-size: 15px; color: #475569;">Please log in to your supplier portal to view the line items and upload your official proforma invoice.</p>

        <div style="text-align: center; margin-top: 35px;">
          <a href="${base}/login" 
             style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            Upload Proforma
          </a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
        e-Cunga Supplier Network
      </div>
    </div>
  `;

  await sendMail({ to: supplier.email, subject, html: htmlContent, text: `You have a new proforma request from ${hospitalName}. Login at ${base}/login` });
}

/**
 * Notify the requesting clerk that their requisition was approved and sent to a supplier.
 */
export async function emailRequisitionApprovedToClerk(requisition, hospitalName, supplierLabel) {
  const clerk = await User.findById(requisition.clerkId).select('email fullName').lean();
  if (!clerk?.email) return;

  const subject = `[Approved] ${requisition.title} — sent to ${supplierLabel || 'supplier'}`;
  const base = clientBaseUrl();
  const name = clerk.fullName || 'there';

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #059669; padding: 25px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Requisition approved</h2>
      </div>
      <div style="padding: 40px 30px;">
        <p style="font-size: 16px;">Hello ${name},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          Your supervisor has approved <strong>${requisition.title}</strong> and assigned it to
          <strong>${supplierLabel || 'a supplier'}</strong> for a proforma. You can track status in the portal.
        </p>
        <p style="font-size: 14px; color: #64748b;">Reference: <strong>${requisition._id || requisition.id}</strong></p>
        <div style="text-align: center; margin-top: 35px;">
          <a href="${base}/login"
             style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            Open portal
          </a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
        ${hospitalName} · e-Cunga
      </div>
    </div>
  `;

  await sendMail({
    to: clerk.email,
    subject,
    html: htmlContent,
    text: `Your requisition "${requisition.title}" was approved and sent to ${supplierLabel || 'supplier'}. ${base}/login`,
  });
}

/**
 * Notify the requesting clerk that the supervisor rejected the requisition (includes reason when provided).
 */
export async function emailRequisitionRejectedToClerk(requisition, hospitalName, supervisorNote) {
  const clerk = await User.findById(requisition.clerkId).select('email fullName').lean();
  if (!clerk?.email) return;

  const ref = requisition._id || requisition.id;
  const reasonBlock =
    supervisorNote && String(supervisorNote).trim()
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
           <p style="margin:0;font-size:13px;color:#991b1b;font-weight:700;text-transform:uppercase;">Supervisor reason</p>
           <p style="margin:8px 0 0;font-size:15px;color:#1e293b;white-space:pre-wrap;">${escapeHtmlSnippet(String(supervisorNote).trim())}</p>
         </div>`
      : `<p style="font-size:14px;color:#64748b;">No additional note was provided. Open the portal for details.</p>`;

  const subject = `[Rejected] ${requisition.title}`;
  const base = clientBaseUrl();
  const name = clerk.fullName || 'there';

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #991b1b; padding: 25px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Requisition not approved</h2>
      </div>
      <div style="padding: 40px 30px;">
        <p style="font-size: 16px;">Hello ${name},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          Your requisition <strong>${requisition.title}</strong> was <strong>rejected</strong> by a supervisor at <strong>${hospitalName}</strong>.
        </p>
        <p style="font-size: 14px; color: #64748b;">Reference: <strong>${ref}</strong></p>
        ${reasonBlock}
        <div style="text-align: center; margin-top: 35px;">
          <a href="${base}/login"
             style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            View in portal
          </a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
        ${hospitalName} · e-Cunga
      </div>
    </div>
  `;

  const textReason =
    supervisorNote && String(supervisorNote).trim()
      ? ` Reason from supervisor: ${String(supervisorNote).trim()}`
      : '';
  await sendMail({
    to: clerk.email,
    subject,
    html: htmlContent,
    text: `Requisition "${requisition.title}" was rejected.${textReason} Open ${base}/login`,
  });
}

/**
 * Clerk: supplier uploaded proforma — status is now proforma received (finance next).
 */
export async function emailProformaSubmittedToClerk(requisition, invoice, hospitalName, supplierLabel) {
  const clerk = await User.findById(requisition.clerkId).select('email fullName').lean();
  if (!clerk?.email) return;

  const ref = requisition._id || requisition.id;
  const subject = `[Update] Proforma received: ${requisition.title}`;
  const base = clientBaseUrl();
  const name = clerk.fullName || 'there';
  const sup = escapeHtmlSnippet(supplierLabel || invoice.supplierName || 'Supplier');
  const amt = `${invoice.currency || 'RWF'} ${Number(invoice.amount || 0).toLocaleString()}`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #692751; padding: 25px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Supplier submitted proforma</h2>
      </div>
      <div style="padding: 40px 30px;">
        <p style="font-size: 16px;">Hello ${escapeHtmlSnippet(name)},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          <strong>${sup}</strong> has uploaded a proforma for <strong>${escapeHtmlSnippet(requisition.title)}</strong>.
          The request is now with finance for review.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 700;">Requisition</p>
          <p style="margin: 8px 0 0; font-size: 15px; font-weight: 700;">${escapeHtmlSnippet(ref)}</p>
          <p style="margin: 15px 0 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 700;">Proforma reference</p>
          <p style="margin: 8px 0 0; font-size: 15px; font-weight: 700;">${escapeHtmlSnippet(invoice.reference)}</p>
          <p style="margin: 15px 0 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 700;">Amount</p>
          <p style="margin: 8px 0 0; font-size: 16px; font-weight: 700; color: #059669;">${escapeHtmlSnippet(amt)}</p>
        </div>
        <div style="text-align: center; margin-top: 35px;">
          <a href="${base}/login"
             style="background-color: #692751; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            Open portal
          </a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
        ${escapeHtmlSnippet(hospitalName)} · e-Cunga
      </div>
    </div>
  `;

  await sendMail({
    to: clerk.email,
    subject,
    html: htmlContent,
    text: `Proforma ${invoice.reference} submitted by ${supplierLabel || invoice.supplierName} for "${requisition.title}". Track status at ${base}/login`,
  });
}

/**
 * Supplier: confirmation that proforma was recorded and the workflow advanced.
 */
export async function emailProformaSubmittedConfirmationToSupplier(requisition, invoice, hospitalName, supplierUser) {
  if (!supplierUser?.email) return;

  const subject = `[Confirmed] Proforma submitted: ${invoice.reference}`;
  const base = clientBaseUrl();
  const name = supplierUser.fullName || 'there';
  const ref = requisition._id || requisition.id;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f766e; padding: 25px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Submission received</h2>
      </div>
      <div style="padding: 40px 30px;">
        <p style="font-size: 16px;">Hello ${escapeHtmlSnippet(name)},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          Your proforma <strong>${escapeHtmlSnippet(invoice.reference)}</strong> for
          <strong>${escapeHtmlSnippet(requisition.title)}</strong> at <strong>${escapeHtmlSnippet(hospitalName)}</strong>
          has been received. The requisition status has moved forward to finance review.
        </p>
        <p style="font-size: 14px; color: #64748b;">Request ID: <strong>${escapeHtmlSnippet(ref)}</strong></p>
        <div style="text-align: center; margin-top: 35px;">
          <a href="${base}/login"
             style="background-color: #692751; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            Open supplier portal
          </a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
        e-Cunga Supplier Network
      </div>
    </div>
  `;

  await sendMail({
    to: supplierUser.email,
    subject,
    html: htmlContent,
    text: `Your proforma ${invoice.reference} for ${requisition.title} was received by ${hospitalName}. ${base}/login`,
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
  }).select('email fullName').lean();

  const subject = `[Action Required] Proforma Received: ${invoice.reference}`;
  const base = clientBaseUrl();

  for (const a of accountants) {
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #475569; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">Finance Review</h2>
        </div>
        <div style="padding: 40px 30px;">
          <p style="font-size: 16px;">Hello ${a.fullName},</p>
          <p style="font-size: 16px; line-height: 1.6;">
            A proforma invoice has been received from <strong>${invoice.supplierName}</strong> for the requisition: <em>${requisitionTitle}</em>.
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; font-size: 13px; color: #64748b; text-transform: uppercase;">Invoice Reference</p>
            <p style="margin: 5px 0 0; font-size: 16px; font-weight: 700;">${invoice.reference}</p>
            <p style="margin: 15px 0 0; font-size: 13px; color: #64748b; text-transform: uppercase;">Total Amount</p>
            <p style="margin: 5px 0 0; font-size: 18px; font-weight: 700; color: #059669;">${invoice.currency} ${invoice.amount.toLocaleString()}</p>
          </div>

          <div style="text-align: center; margin-top: 35px;">
            <a href="${base}/login" 
               style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
              Review & Approve Payment
            </a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
          Finance Department · e-Cunga Workflow
        </div>
      </div>
    `;

    await sendMail({ to: a.email, subject, html: htmlContent, text: `Proforma received from ${invoice.supplierName} for ${requisitionTitle}. Review at ${base}/login` });
  }
}

/**
 * Notify Supplier that their proforma has been marked as PAID
 */
export async function emailPaymentConfirmedToSupplier(invoice, hospitalName) {
  const supplier = await User.findById(invoice.supplierId).select('email fullName').lean();
  if (!supplier) return;

  const subject = `Payment Confirmed: ${invoice.reference}`;
  const base = clientBaseUrl();

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #059669; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #059669; padding: 25px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Payment Confirmation</h2>
      </div>
      <div style="padding: 40px 30px;">
        <p style="font-size: 16px;">Hello ${supplier.fullName},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          Great news! <strong>${hospitalName}</strong> has confirmed payment for your proforma invoice <strong>${invoice.reference}</strong>.
        </p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; font-size: 14px; color: #166534; font-weight: 700; text-transform: uppercase;">Transaction Settled</p>
          <p style="margin: 5px 0 0; font-size: 18px; font-weight: 700; color: #0f172a;">${invoice.currency} ${invoice.amount.toLocaleString()}</p>
        </div>

        <p style="font-size: 15px; color: #475569;">
          You are now cleared to proceed with fulfillment. Please ensure the delivery note is uploaded to the portal once the items are dispatched.
        </p>

        <div style="text-align: center; margin-top: 35px;">
          <a href="${base}/login" 
             style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            Update Delivery Status
          </a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
        e-Cunga Financial Services
      </div>
    </div>
  `;

  await sendMail({ to: supplier.email, subject, html: htmlContent, text: `Payment confirmed for ${invoice.reference} by ${hospitalName}. Proceed with delivery.` });
}

/** Supplier: clerk declined the proforma (rich email; in-app notify may use skipEmail to avoid duplicates). */
export async function emailProformaDeclinedByClerk(requisition, invoice, hospitalName, clerkNote) {
  const supplier = await User.findById(requisition.supplierId).select('email fullName').lean();
  if (!supplier?.email) return;

  const subject = `[Update] Proforma not accepted: ${requisition.title}`;
  const note =
    clerkNote && String(clerkNote).trim()
      ? emailParagraph(`<strong>Clerk note:</strong> ${escapeHtml(String(clerkNote).trim())}`)
      : emailParagraph('The hospital clerk did not accept this proforma. Open the portal for next steps.');

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
    footerLine: `${escapeHtml(hospitalName)} · e-Cunga`,
  });

  await sendMail({
    to: supplier.email,
    subject,
    html,
    text: `Your proforma for "${requisition.title}" was not accepted by the hospital clerk. ${process.env.CLIENT_URL || ''}/login`,
  });
}

/** Targeted summary after finance approves or rejects a proforma (supplements in-app notifications). */
export async function emailFinanceProformaDecisionToParties({
  invoice,
  requisition,
  hospitalName,
  decision,
  financeNote,
}) {
  const base = clientBaseUrl();
  const isApp = decision === 'approved';
  const subject = isApp
    ? `[Approved] Finance: ${invoice.reference}`
    : `[Rejected] Finance: ${invoice.reference}`;

  const cardRows = [
    ['Requisition', escapeHtml(requisition?.title || '—')],
    ['Proforma', escapeHtml(invoice.reference || '—')],
    ['Amount', escapeHtml(`${invoice.currency || 'RWF'} ${Number(invoice.amount || 0).toLocaleString()}`)],
  ];
  if (financeNote && String(financeNote).trim()) {
    cardRows.push(['Finance note', escapeHtml(String(financeNote).trim())]);
  }
  const card = emailDetailCard(cardRows);

  async function sendTo(userLean, introHtml) {
    if (!userLean?.email) return;
    const html = buildEmailDocument({
      preheader: subject,
      headline: isApp ? 'Proforma approved by finance' : 'Proforma rejected by finance',
      accent: isApp ? 'success' : 'danger',
      bodyHtml: `<p style="margin:0 0 16px;">Hello ${escapeHtml(userLean.fullName || 'there')},</p><p style="margin:0 0 16px;line-height:1.65;">${introHtml}</p>${card}`,
      ctaLabel: 'Open workspace',
      ctaPath: '/login',
      footerLine: `${escapeHtml(hospitalName)} · e-Cunga`,
    });
    const plain = introHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    await sendMail({
      to: userLean.email,
      subject,
      html,
      text: `${plain} ${base}/login`,
    });
  }

  const supplier = await User.findById(invoice.supplierId).select('email fullName').lean();
  const clerk = requisition?.clerkId ? await User.findById(requisition.clerkId).select('email fullName').lean() : null;

  const supIntro = isApp
    ? `<strong>${escapeHtml(hospitalName)}</strong> approved proforma <strong>${escapeHtml(invoice.reference)}</strong>. Await payment confirmation in the portal.`
    : `Finance did not approve proforma <strong>${escapeHtml(invoice.reference)}</strong> for <strong>${escapeHtml(requisition?.title || '')}</strong>.`;

  const clerkIntro = isApp
    ? `Finance approved <strong>${escapeHtml(invoice.reference)}</strong> linked to <strong>${escapeHtml(requisition?.title || '')}</strong>.`
    : `Finance rejected <strong>${escapeHtml(invoice.reference)}</strong> for <strong>${escapeHtml(requisition?.title || '')}</strong>.`;

  await sendTo(supplier, supIntro);
  await sendTo(clerk, clerkIntro);
}
