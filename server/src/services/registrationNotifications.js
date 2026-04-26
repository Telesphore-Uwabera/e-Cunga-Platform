import { sendMail } from './mail.js';
import { getPlatformAdminNotifyTargets } from '../lib/platformTenant.js';
import User from '../models/User.js';

function clientBaseUrl() {
  return String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/**
 * Notify Platform Admins about a new company registration
 */
export async function emailNewCompanyRegistrationToAdmins(payload) {
  const {
    companyId,
    companyName,
    industry,
    supervisorName,
    supervisorEmail,
    registeredAt,
  } = payload;
  
  const targets = await getPlatformAdminNotifyTargets();
  const subject = `[Action Required] New Registration: ${companyName}`;
  
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #1e293b; padding: 20px; color: #ffffff; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">Platform Administration</h2>
      </div>
      <div style="padding: 30px;">
        <p style="font-size: 16px; margin-top: 0;">A new organization has registered on the <strong>e-Cunga Platform</strong> and requires your review.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 15px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Organization:</td>
            <td style="padding: 8px 0; font-weight: 700;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Industry:</td>
            <td style="padding: 8px 0;">${industry || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Primary Contact:</td>
            <td style="padding: 8px 0;">${supervisorName} (${supervisorEmail})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Submission Time:</td>
            <td style="padding: 8px 0;">${registeredAt || new Date().toLocaleString()}</td>
          </tr>
        </table>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${clientBaseUrl()}/login" 
             style="background-color: #780b23; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: 700; display: inline-block;">
            Review Application
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
        This is an internal administrative alert.
      </div>
    </div>
  `;

  for (const t of targets) {
    await sendMail({ to: t.email, subject, html: htmlContent, text: `New registration: ${companyName}. Review at ${clientBaseUrl()}/login` });
  }
}

/**
 * Notify Supervisors/Suppliers that their company has been approved
 */
export async function emailUserAccountApproved({ companyId, companyName }) {
  const users = await User.find({
    companyId,
    role: { $in: ['supervisor', 'supplier'] },
  }).select('email fullName role').lean();

  const subject = `Account Approved: ${companyName}`;
  const base = clientBaseUrl();

  for (const user of users) {
    const isSupplier = user.role === 'supplier';
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #780b23; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #780b23; padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to e-Cunga</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #0f172a; margin-top: 0;">Congratulations, ${user.fullName}!</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            Your application for <strong>${companyName}</strong> has been reviewed and approved. Your account is now fully active.
          </p>
          
          <p style="font-size: 15px; background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; color: #166534;">
            You can now access all features of the ${isSupplier ? 'Supplier' : 'Supervisor'} Dashboard.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${base}/login" 
               style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
              Sign In to Your Account
            </a>
          </div>

          ${!isSupplier ? `
            <p style="font-size: 14px; color: #64748b;">
              <strong>Next Steps:</strong> Start by adding your team members (Clerks and Accountants) in the <em>Team</em> section of your dashboard.
            </p>
          ` : `
            <p style="font-size: 14px; color: #64748b;">
              <strong>Next Steps:</strong> Complete your profile and upload your product catalog to start receiving procurement requests.
            </p>
          `}
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Regards,<br/>The e-Cunga Administration Team
        </div>
      </div>
    `;

    await sendMail({ to: user.email, subject, html: htmlContent, text: `Your account for ${companyName} has been approved. Login at ${base}/login` });
  }
}

/**
 * Send Invitation OTP with professional design
 */
export async function emailInviteOtp({ to, fullName, companyName, role, otp, activateUrl }) {
  const subject = `Invitation to join ${companyName}`;
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #780b23; padding: 30px 20px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 22px;">You're Invited</h2>
      </div>
      <div style="padding: 40px 30px;">
        <p style="font-size: 16px;">Hello ${fullName || 'there'},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          You have been invited to join <strong>${companyName}</strong> on the e-Cunga Platform as a <strong>${role}</strong>.
        </p>
        
        <div style="text-align: center; margin: 30px 0; background-color: #f8fafc; padding: 20px; border-radius: 10px; border: 2px dashed #cbd5e1;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: 700;">Your Verification Code</p>
          <span style="font-size: 36px; font-weight: 800; color: #780b23; letter-spacing: 5px;">${otp}</span>
          <p style="margin: 10px 0 0; font-size: 12px; color: #94a3b8;">This code will expire in 30 minutes.</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${activateUrl}" 
             style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
            Activate My Account
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        If you did not expect this invitation, you can safely ignore this email.
      </div>
    </div>
  `;

  return sendMail({
    to,
    subject,
    html: htmlContent,
    text: `You're invited to join ${companyName} as a ${role}. Your code is ${otp}. Activate here: ${activateUrl}`,
  });
}
