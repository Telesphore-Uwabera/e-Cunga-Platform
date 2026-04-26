import { sendMail } from './mail.js';
import User from '../models/User.js';

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
