import { sendMail } from './mail.js';
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
 * Send welcome email to a new user
 */
export async function sendWelcomeEmail(user) {
  const isPending = ['supervisor', 'supplier'].includes(user.role);
  const subject = isPending
    ? `${mailSubjectPrefix()} Registration received`
    : `${mailSubjectPrefix()} Your account is ready`;

  const card = emailDetailCard([
    ['Name', escapeHtml(user.fullName || '—')],
    ['Email', escapeHtml(user.email)],
    ['Role', escapeHtml(String(user.role || '').toUpperCase())],
  ]);

  const pendingBlock = isPending
    ? emailParagraph(
        `As a <strong>${escapeHtml(user.role)}</strong>, your registration is being reviewed. You will receive another email when your workspace is fully activated.`
      )
    : emailParagraph(
        'Your account is active. Sign in to configure your workspace, team, and inventory workflows.'
      );

  const htmlContent = buildEmailDocument({
    preheader: subject,
    headline: isPending ? 'Registration received' : 'Welcome',
    accent: isPending ? 'warning' : 'success',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(user.fullName || 'there')},`)}
      ${emailParagraph(
        `Thank you for choosing <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> — procurement, inventory, and approvals in one workspace.`
      )}${card}${pendingBlock}`,
    ctaLabel: isPending ? 'Visit sign-in' : 'Open workspace',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · onboarding`,
  });

  return sendMail({
    to: user.email,
    subject,
    html: htmlContent,
    text: `Hello ${user.fullName}, ${MAIL_PRODUCT_NAME}: your account as ${user.role} ${isPending ? 'is pending approval.' : 'is ready.'} ${clientBaseUrl()}/login`,
  });
}

/**
 * Low stock alert
 */
export async function sendLowStockAlert(email, items) {
  const subject = `${mailSubjectPrefix()} Low stock — ${items.length} item(s)`;
  const rows = items
    .map(
      (item) =>
        `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 0;font-size:15px;"><strong>${escapeHtml(item.name)}</strong></td>
      <td style="padding:12px 0;font-size:15px;text-align:center;">${escapeHtml(String(item.quantity))} ${escapeHtml(item.unit)}</td>
      <td style="padding:12px 0;font-size:15px;text-align:right;color:#b91c1c;">${escapeHtml(String(item.minThreshold))}</td>
    </tr>`
    )
    .join('');

  const table = `<table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;">
    <thead><tr style="border-bottom:2px solid #e2e8f0;">
      <th style="text-align:left;padding:10px 0;color:#64748b;font-size:12px;text-transform:uppercase;">Item</th>
      <th style="text-align:center;padding:10px 0;color:#64748b;font-size:12px;text-transform:uppercase;">Current</th>
      <th style="text-align:right;padding:10px 0;color:#64748b;font-size:12px;text-transform:uppercase;">Minimum</th>
    </tr></thead><tbody>${rows}</tbody></table>`;

  const htmlContent = buildEmailDocument({
    preheader: subject,
    headline: 'Inventory below threshold',
    accent: 'danger',
    bodyHtml: `${emailParagraph(
      'The following stock lines are at or below their minimum thresholds. Please review replenishment or approvals in the portal.'
    )}${table}`,
    ctaLabel: 'Review inventory',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · automated alert`,
  });

  return sendMail({
    to: email,
    subject,
    html: htmlContent,
    text: `Low stock: ${items.length} items need attention. ${clientBaseUrl()}/login`,
  });
}
