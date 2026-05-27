import { sendMail } from './mail.js';
import {
  MAIL_PRODUCT_NAME,
  buildEmailDocument,
  clientBaseUrl,
  clientPathUrl,
  emailBulletList,
  emailDetailCard,
  emailParagraph,
  escapeHtml,
  mailSubjectPrefix,
  portalOnboardingPaths,
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

  const { companySettings, accountSettings } = portalOnboardingPaths(user.role);
  const loginUrl = clientPathUrl('/login');
  const companyUrl = clientPathUrl(companySettings);
  const accountUrl = clientPathUrl(accountSettings);
  const em = escapeHtml(user.email);

  const signInHowTo = emailParagraph(
    `<strong>How you will sign in:</strong> use <strong>${em}</strong> and the <strong>password you chose when you registered</strong>. If an administrator later invites teammates with a <strong>temporary password</strong>, they should use that email and password first, then set their own under Account settings.`
  );

  const finishSetupLinks = `${emailParagraph('<strong>After you can access the portal</strong>, use these links to finalize your organization and account:')}
    ${emailBulletList([
      `<a href="${escapeHtml(loginUrl)}" style="color:#692751;font-weight:600;">Sign in</a> — email and password (or invitation password).`,
      `<a href="${escapeHtml(companyUrl)}" style="color:#692751;font-weight:600;">Company settings</a> — complete your organization profile and defaults${
        user.role === 'supplier' ? '; add catalog and contact details for buyers' : ''
      }.`,
      `<a href="${escapeHtml(accountUrl)}" style="color:#692751;font-weight:600;">Account settings</a> — update your password and personal details.`,
    ])}`;

  const pendingBlock = isPending
    ? `${emailParagraph(
        `As a <strong>${escapeHtml(user.role)}</strong>, your registration is being reviewed. You will receive another email as soon as your organization is activated in ${escapeHtml(MAIL_PRODUCT_NAME)}.`
      )}${emailParagraph(
        `Until then you cannot sign in. When you receive the approval message, open <strong>Sign in</strong> below, then complete <strong>Company settings</strong> and <strong>Account settings</strong> so your profile is ready for your team and partners.`
      )}${signInHowTo}${finishSetupLinks}`
    : `${emailParagraph(
        `Your account is active. Sign in to ${escapeHtml(MAIL_PRODUCT_NAME)} with <strong>${em}</strong> and your password to finish setup, invite your team if you are an administrator, and start using inventory and procurement workflows.`
      )}${signInHowTo}${finishSetupLinks}`;

  const htmlContent = buildEmailDocument({
    preheader: subject,
    headline: isPending ? 'Registration received' : 'Welcome',
    accent: isPending ? 'warning' : 'success',
    bodyHtml: `${emailParagraph(`Hi ${escapeHtml(user.fullName || 'there')},`)}
      ${emailParagraph(
        `Thank you for choosing <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> — inventory, procurement, and approvals in one place.`
      )}${card}${pendingBlock}`,
    ctaLabel: isPending ? 'Sign in (after approval)' : `Open ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    secondaryCtaLabel: 'Forgot password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · onboarding`,
  });

  const base = clientBaseUrl();
  const textLines = [
    `Hello ${user.fullName || 'there'},`,
    `${MAIL_PRODUCT_NAME}: your account as ${user.role} ${isPending ? 'is pending approval.' : 'is ready.'}`,
    ``,
    `Sign in (when active): ${loginUrl}`,
    `Company settings: ${companyUrl}`,
    `Account settings: ${accountUrl}`,
    `Forgot password: ${base}/forgot-password`,
  ];

  return sendMail({
    to: user.email,
    subject,
    html: htmlContent,
    text: textLines.join('\n'),
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
        `<tr style="border-bottom:1px solid #e2e8f0;" class="ec-email-border">
      <td style="padding:12px 0;font-size:15px;color:#1e293b;" class="ec-email-text"><strong>${escapeHtml(item.name)}</strong></td>
      <td style="padding:12px 0;font-size:15px;text-align:center;color:#1e293b;" class="ec-email-text">${escapeHtml(String(item.quantity))} ${escapeHtml(item.unit)}</td>
      <td style="padding:12px 0;font-size:15px;text-align:right;color:#dc2626;" class="ec-email-accent-text">${escapeHtml(String(item.minThreshold))}</td>
    </tr>`
    )
    .join('');

  const table = `<table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;" class="ec-email-border">
    <thead><tr style="border-bottom:2px solid #e2e8f0;" class="ec-email-border">
      <th style="text-align:left;padding:10px 0;color:#64748b;font-size:12px;text-transform:uppercase;" class="ec-email-header-text">Item</th>
      <th style="text-align:center;padding:10px 0;color:#64748b;font-size:12px;text-transform:uppercase;" class="ec-email-header-text">Current</th>
      <th style="text-align:right;padding:10px 0;color:#64748b;font-size:12px;text-transform:uppercase;" class="ec-email-header-text">Minimum</th>
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
