import { sendMail } from './mail.js';
import { getPlatformAdminNotifyTargets } from '../lib/platformTenant.js';
import User from '../models/User.js';
import {
  MAIL_PRODUCT_NAME,
  buildEmailDocument,
  clientBaseUrl,
  emailCredentialBox,
  emailDetailCard,
  emailParagraph,
  escapeHtml,
  mailSubjectPrefix,
} from './emailLayout.js';

/**
 * Notify Platform Admins about a new company registration
 */
export async function emailNewCompanyRegistrationToAdmins(payload) {
  const { companyName, industry, supervisorName, supervisorEmail, registeredAt } = payload;

  const targets = await getPlatformAdminNotifyTargets();
  const subject = `${mailSubjectPrefix()} New registration — ${companyName}`;

  const card = emailDetailCard([
    ['Organization', escapeHtml(companyName)],
    ['Industry', escapeHtml(industry || 'Not specified')],
    ['Primary contact', escapeHtml(`${supervisorName} (${supervisorEmail})`)],
    ['Submitted', escapeHtml(registeredAt || new Date().toLocaleString())],
  ]);

  const html = buildEmailDocument({
    preheader: `Review registration: ${companyName}`,
    headline: 'New organization pending review',
    accent: 'neutral',
    bodyHtml: `${emailParagraph(
      `A new organization has registered on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> and requires platform review.`
    )}${card}`,
    ctaLabel: 'Review in workspace',
    ctaPath: '/login',
    footerLine: 'Internal · platform administration',
    includeForgotPasswordLink: false,
  });

  const base = clientBaseUrl();
  for (const t of targets) {
    await sendMail({ to: t.email, subject, html, text: `New registration: ${companyName}. Review at ${base}/login` });
  }
}

/**
 * Notify Supervisors/Suppliers that their company has been approved
 */
export async function emailUserAccountApproved({ companyId, companyName }) {
  const users = await User.find({
    companyId,
    role: { $in: ['supervisor', 'supplier'] },
  })
    .select('email fullName role')
    .lean();

  const subject = `${mailSubjectPrefix()} Account approved — ${companyName}`;
  const cn = escapeHtml(companyName);

  for (const user of users) {
    const isSupplier = user.role === 'supplier';
    const html = buildEmailDocument({
      preheader: `Your workspace for ${companyName} is active`,
      headline: 'Your account is approved',
      accent: 'success',
      bodyHtml: `${emailParagraph(`Hello ${escapeHtml(user.fullName)},`)}
        ${emailParagraph(
          `Your application for <strong>${cn}</strong> has been reviewed and approved. Your account is now fully active.`
        )}
        ${emailParagraph(
          isSupplier
            ? `You can access the supplier workspace, complete your profile, and publish your catalog to receive procurement requests.`
            : `You can access the supervisor workspace and invite clerks and accountants from the <strong>Team</strong> section.`
        )}`,
      ctaLabel: 'Sign in to workspace',
      ctaPath: '/login',
      secondaryCtaLabel: 'Reset password',
      secondaryCtaPath: '/forgot-password',
      footerLine: `${cn} · ${MAIL_PRODUCT_NAME}`,
    });

    const base = clientBaseUrl();
    await sendMail({
      to: user.email,
      subject,
      html,
      text: `Your account for ${companyName} has been approved. Sign in: ${base}/login`,
    });
  }
}

function ctaPathFromActivateUrl(activateUrl) {
  try {
    const u = new URL(activateUrl);
    return `${u.pathname}${u.search}`;
  } catch {
    const s = String(activateUrl || '').trim();
    return s.startsWith('/') ? s : '/login';
  }
}

/**
 * Invitation: OTP activation (supplier flow)
 */
export async function emailInviteOtp({ to, fullName, companyName, role, otp, activateUrl }) {
  const subject = `${mailSubjectPrefix()} Invitation — ${companyName}`;
  const cn = escapeHtml(companyName);
  const innerOtp = `<span style="font-size:34px;font-weight:800;color:#780b23;letter-spacing:6px;font-family:Consolas,monospace;">${escapeHtml(otp)}</span>
    <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">This code expires in 30 minutes.</p>`;

  const html = buildEmailDocument({
    preheader: `Your verification code for ${companyName}`,
    headline: "You're invited",
    accent: 'brand',
    bodyHtml: `${emailParagraph(`Hello ${escapeHtml(fullName || 'there')},`)}
      ${emailParagraph(
        `You have been invited to join <strong>${cn}</strong> on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> as a <strong>${escapeHtml(role)}</strong>.`
      )}
      ${emailCredentialBox('Verification code', innerOtp)}
      ${emailParagraph('Use the button below to activate your account and set your password.')}`,
    ctaLabel: 'Activate account',
    ctaPath: ctaPathFromActivateUrl(activateUrl),
    footerLine: `Invitation · ${cn}`,
    includeForgotPasswordLink: false,
  });

  return sendMail({
    to,
    subject,
    html,
    text: `You're invited to join ${companyName} as a ${role}. Code: ${otp}. Activate: ${activateUrl}`,
  });
}

/**
 * Clerk / accountant / supervisor: temporary password; must change after first login.
 */
export async function emailWorkspaceInviteTemporaryPassword({
  to,
  fullName,
  companyName,
  role,
  temporaryPassword,
}) {
  const base = clientBaseUrl();
  const fn = escapeHtml(fullName || 'there');
  const cn = escapeHtml(companyName);
  const rl = escapeHtml(role);
  const tp = escapeHtml(temporaryPassword);
  const subject = `${mailSubjectPrefix()} Your access — ${companyName}`;

  const innerPwd = `<code style="font-size:17px;font-weight:800;color:#0f172a;letter-spacing:0.04em;word-break:break-all;font-family:Consolas,monospace;">${tp}</code>
    <p style="margin:14px 0 0;font-size:13px;color:#64748b;line-height:1.5;">Sign in with this password once, then change it under <strong>Profile</strong> or <strong>Account settings</strong>.</p>`;

  const html = buildEmailDocument({
    preheader: `Temporary password for ${companyName}`,
    headline: 'Welcome to your workspace',
    accent: 'brand',
    bodyHtml: `${emailParagraph(`Hello ${fn},`)}
      ${emailParagraph(
        `<strong>${cn}</strong> has added you to <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> as a <strong>${rl}</strong>.`
      )}
      ${emailCredentialBox('Temporary password', innerPwd)}
      ${emailParagraph('For your security, choose a new password after your first successful sign-in.')}`,
    ctaLabel: 'Sign in to workspace',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${cn} · ${MAIL_PRODUCT_NAME}`,
  });

  const text = [
    `Hello ${fullName || 'there'},`,
    ``,
    `${companyName} invited you to ${MAIL_PRODUCT_NAME} as a ${role}.`,
    ``,
    `Temporary password: ${temporaryPassword}`,
    ``,
    `Sign in: ${base}/login`,
    `Forgot / reset password: ${base}/forgot-password`,
    ``,
    `Change your password after signing in.`,
  ].join('\n');

  return sendMail({ to, subject, html, text });
}
