import { sendMail } from './mail.js';

const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'e-Cunga Platform';

/**
 * Send welcome email to a new user with professional branding
 */
export async function sendWelcomeEmail(user) {
  const isPending = ['supervisor', 'supplier'].includes(user.role);
  const subject = isPending 
    ? `Welcome to ${SENDER_NAME} - Registration Received` 
    : `Your ${SENDER_NAME} Account is Ready`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background-color: #780b23; padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.025em;">e-Cunga Platform</h1>
        <p style="color: #fecdd3; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Professional Procurement & Workspace Management</p>
      </div>
      
      <div style="padding: 40px 30px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 22px;">Hello ${user.fullName || 'there'},</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #475569;">
          Thank you for joining the <strong>e-Cunga Platform</strong>. We are excited to help you streamline your operations and manage your workspace more effectively.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Account Details</p>
          <p style="margin: 10px 0 0; font-size: 16px;"><strong>Role:</strong> ${user.role.toUpperCase()}</p>
          <p style="margin: 5px 0 0; font-size: 16px;"><strong>Email:</strong> ${user.email}</p>
        </div>

        ${isPending ? `
          <div style="border-left: 4px solid #f59e0b; background-color: #fffbeb; padding: 15px 20px; margin-bottom: 25px;">
            <p style="margin: 0; font-size: 15px; color: #92400e; font-weight: 600;">Account Pending Approval</p>
            <p style="margin: 5px 0 0; font-size: 14px; color: #b45309; line-height: 1.5;">
              As a ${user.role}, your registration is currently being reviewed by our administrative team. You will receive a separate notification once your account is fully activated.
            </p>
          </div>
        ` : `
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            Your account is active and ready for use. You can sign in to your dashboard to begin setting up your workspace.
          </p>
          <div style="text-align: center; margin: 35px 0;">
            <a href="${process.env.CLIENT_URL || 'https://ecunga.netlify.app'}/login" 
               style="background-color: #780b23; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">
              Access My Dashboard
            </a>
          </div>
        `}

        <p style="font-size: 15px; line-height: 1.6; color: #475569;">
          If you have any immediate questions, our support team is available to assist you.
        </p>
      </div>

      <div style="background-color: #f1f5f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">&copy; 2026 e-Cunga Platform. All rights reserved.</p>
        <div style="margin-top: 15px;">
          <a href="#" style="color: #780b23; text-decoration: none; font-size: 13px; margin: 0 10px;">Terms of Service</a>
          <a href="#" style="color: #780b23; text-decoration: none; font-size: 13px; margin: 0 10px;">Privacy Policy</a>
        </div>
      </div>
    </div>
  `;
  
  return sendMail({ 
    to: user.email, 
    subject, 
    html: htmlContent,
    text: `Hello ${user.fullName}, Welcome to e-Cunga Platform. Your account has been created successfully as a ${user.role}. ${isPending ? 'Your account is pending approval.' : ''}`
  });
}

/**
 * Send low stock alert email with professional design
 */
export async function sendLowStockAlert(email, items) {
  const subject = `Urgent: Low Stock Alert - ${items.length} Items Requiring Attention`;
  const itemsHtml = items.map(item => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 0; font-size: 15px;"><strong>${item.name}</strong></td>
      <td style="padding: 12px 0; font-size: 15px; text-align: center;">${item.quantity} ${item.unit}</td>
      <td style="padding: 12px 0; font-size: 15px; text-align: right; color: #ef4444;">${item.minThreshold}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #991b1b; padding: 30px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Inventory Status Alert</h1>
      </div>
      
      <div style="padding: 40px 30px; background-color: #ffffff;">
        <p style="font-size: 16px; line-height: 1.6; color: #475569;">
          Our system has detected that the following items in your inventory have fallen below their established minimum thresholds.
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #f1f5f9;">
              <th style="text-align: left; padding: 10px 0; color: #64748b; font-size: 13px; text-transform: uppercase;">Item Description</th>
              <th style="text-align: center; padding: 10px 0; color: #64748b; font-size: 13px; text-transform: uppercase;">Current</th>
              <th style="text-align: right; padding: 10px 0; color: #64748b; font-size: 13px; text-transform: uppercase;">Threshold</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: center; margin: 35px 0;">
          <a href="${process.env.CLIENT_URL || 'https://ecunga.netlify.app'}/login" 
             style="background-color: #991b1b; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">
            Manage Inventory
          </a>
        </div>
      </div>
      
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 13px; color: #64748b;">
        This is an automated notification from your e-Cunga workspace.
      </div>
    </div>
  `;

  return sendMail({ 
    to: email, 
    subject, 
    html: htmlContent,
    text: `Inventory Alert: ${items.length} items are low on stock. Please check the dashboard.`
  });
}
