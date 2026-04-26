import { sendMail } from './mail.js';

const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'e-Cunga Platform';

/**
 * Send welcome email to a new user
 */
export async function sendWelcomeEmail(user) {
  const subject = `Welcome to ${SENDER_NAME}`;
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #121c2a;">
      <h1 style="color: #692751;">Hello, ${user.fullName || 'there'}!</h1>
      <p>Welcome to <strong>e-Cunga Platform</strong>. Your account has been created successfully.</p>
      <p>Role: <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${user.role}</span></p>
      <p>You can now log in and start managing your workspace once your company is approved.</p>
      <div style="margin-top: 2rem; border-top: 1px solid #e4e4e7; padding-top: 1rem; font-size: 0.85rem; color: #83737a;">
        <p>Best regards,<br/>The e-Cunga Team</p>
      </div>
    </div>
  `;
  
  return sendMail({ 
    to: user.email, 
    subject, 
    html: htmlContent,
    text: `Hello ${user.fullName}, Welcome to e-Cunga Platform. Your account has been created successfully as a ${user.role}.`
  });
}

/**
 * Send low stock alert email
 */
export async function sendLowStockAlert(email, items) {
  const subject = `Low Stock Alert - ${items.length} items need attention`;
  const itemsHtml = items.map(item => `
    <li style="margin-bottom: 0.5rem;">
      <strong>${item.name}</strong>: ${item.quantity} ${item.unit} remaining 
      <span style="color: #991b1b;">(Min: ${item.minThreshold})</span>
    </li>
  `).join('');

  const htmlContent = `
    <div style="font-family: sans-serif; color: #121c2a;">
      <h2 style="color: #991b1b;">Inventory Alert</h2>
      <p>The following items have reached or fallen below their minimum stock levels:</p>
      <ul style="list-style: none; padding: 0;">
        ${itemsHtml}
      </ul>
      <p>Please check your dashboard to restock these items.</p>
    </div>
  `;

  return sendMail({ 
    to: email, 
    subject, 
    html: htmlContent,
    text: `Inventory Alert: ${items.length} items are low on stock. Please check the dashboard.`
  });
}
