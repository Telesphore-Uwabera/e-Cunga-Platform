import { sendMail } from './mail.js';
import { getPlatformAdminNotifyTargets } from '../lib/platformTenant.js';
import User from '../models/User.js';
import {
  MAIL_PRODUCT_NAME,
  buildEmailDocument,
  clientBaseUrl,
  emailBulletList,
  emailCredentialBox,
  emailDetailCard,
  emailParagraph,
  escapeHtml,
  mailSubjectPrefix,
} from './emailLayout.js';

function humanizeRole(role) {
  const r = String(role || '').toLowerCase();
  const labels = {
    supervisor: 'Supervisor',
    clerk: 'Inventory clerk',
    accountant: 'Accountant',
    supplier: 'Supplier',
    admin: 'Administrator',
  };
  return labels[r] || (r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Team member');
}

function indefiniteArticle(word) {
  const w = String(word || '').trim();
  if (!w) return 'a';
  return /^[aeiou]/i.test(w) ? 'an' : 'a';
}

function roleWelcomeBlurb(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'supervisor') {
    return `As a <strong>Supervisor</strong>, you can invite your team, approve requisitions, monitor stock and invoices, and keep procurement on track.`;
  }
  if (r === 'clerk') {
    return `As an <strong>Inventory clerk</strong>, you can record usage, request materials, track expiry, and keep day-to-day stock accurate.`;
  }
  if (r === 'accountant') {
    return `As an <strong>Accountant</strong>, you can work with proforma invoices, payments, and financial monitoring for your organization.`;
  }
  if (r === 'supplier') {
    return `As a <strong>Supplier</strong>, you can respond to buyer requests, share documents, and manage your side of delivery and billing.`;
  }
  return `Your role gives you access to the parts of ${escapeHtml(MAIL_PRODUCT_NAME)} that your organization enabled for you.`;
}

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
      `A new organization has submitted details on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> and is waiting for an administrator to review and activate it.`
    )}${emailParagraph('Open the portal with an administrator account to approve or decline the registration.')}${card}`,
    ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    footerLine: `${MAIL_PRODUCT_NAME} · administrator notification`,
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
      preheader: `Your access for ${companyName} is active`,
      headline: 'Your account is approved',
      accent: 'success',
      bodyHtml: `${emailParagraph(`Hi ${escapeHtml(user.fullName)},`)}
        ${emailParagraph(`Welcome to <strong>${cn}</strong> on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>.`)}
        ${emailParagraph(
          `Your application has been reviewed and approved. You can sign in with your existing credentials and start working in the portal.`
        )}
        ${emailParagraph(
          isSupplier
            ? `Next: complete your company profile and catalog so buyers can find you and send procurement requests.`
            : `Next: open <strong>Team</strong> to invite clerks and accountants, then review pending approvals and inventory from your dashboard.`
        )}`,
      ctaLabel: `Sign in to ${MAIL_PRODUCT_NAME}`,
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
  const subject = `${mailSubjectPrefix()} Complete your invitation — ${companyName}`;
  const cn = escapeHtml(companyName);
  const rl = escapeHtml(humanizeRole(role));
  const innerOtp = `<span style="font-size:34px;font-weight:800;color:#692751;letter-spacing:6px;font-family:Consolas,monospace;">${escapeHtml(otp)}</span>
    <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">This code expires in 30 minutes.</p>`;

  const html = buildEmailDocument({
    preheader: `Your verification code for ${companyName}`,
    headline: 'Welcome — one step left',
    accent: 'brand',
    bodyHtml: `${emailParagraph(`Hi ${escapeHtml(fullName || 'there')},`)}
      ${emailParagraph(`Welcome to <strong>${cn}</strong>.`)}
      ${emailParagraph(
        `The <strong>${escapeHtml(MAIL_PRODUCT_NAME)} Team</strong> has invited you to join <strong>${cn}</strong> as a <strong>${rl}</strong>.`
      )}
      ${emailParagraph(roleWelcomeBlurb(role))}
      ${emailCredentialBox('Verification code', innerOtp)}
      ${emailParagraph('Use the button below to confirm your email, activate your account, and choose a secure password.')}`,
    ctaLabel: 'Activate account',
    ctaPath: ctaPathFromActivateUrl(activateUrl),
    footerLine: `Invitation · ${cn}`,
    includeForgotPasswordLink: false,
  });

  return sendMail({
    to,
    subject,
    html,
    text: `Hi ${fullName || 'there'},\n\nThe ${MAIL_PRODUCT_NAME} Team invited you to ${companyName} as a ${humanizeRole(role)}.\nCode: ${otp}\nActivate: ${activateUrl}`,
  });
}

/**
 * Clerk / accountant / supervisor: temporary password; must change after first login.
 *
 * @param {object} opts
 * @param {string} [opts.companyLogoUrl] — HTTPS URL of the organization logo (Company.logoUrl).
 * @param {'organization'|'platform'} [opts.inviteSource] — `organization` when a supervisor/facility admin invites into their company; `platform` when ops creates a new tenant on e-Cunga Portal.
 */
export async function emailWorkspaceInviteTemporaryPassword({
  to,
  fullName,
  companyName,
  role,
  temporaryPassword,
  companyLogoUrl = '',
  inviteSource = 'platform',
}) {
  const base = clientBaseUrl();
  const fn = escapeHtml(fullName || 'there');
  const cn = escapeHtml(companyName);
  const rolePlain = humanizeRole(role);
  const roleA = indefiniteArticle(rolePlain);
  const rl = escapeHtml(rolePlain);
  const tp = escapeHtml(temporaryPassword);
  const subject = `${mailSubjectPrefix()} Welcome — your sign-in details · ${companyName}`;

  const orgNameRaw = String(companyName || '').trim();
  const orgNamedLikeProduct = orgNameRaw.toLowerCase() === MAIL_PRODUCT_NAME.toLowerCase();
  /** Header / mark always use the registered company name (supervisor’s org), never a generic placeholder. */
  const headerOrgDisplayName = orgNameRaw || MAIL_PRODUCT_NAME;

  const logoTrim = String(companyLogoUrl || '').trim();
  const orgHeaderLogoHttps =
    inviteSource === 'organization' && logoTrim && /^https?:\/\//i.test(logoTrim) ? logoTrim : undefined;

  const welcomeLine =
    inviteSource === 'organization'
      ? orgNamedLikeProduct
        ? `Welcome — you are joining your organization on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>.`
        : `Welcome — you are joining <strong>${cn}</strong> on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>.`
      : `Welcome to <strong>${cn}</strong>.`;

  const inviteIntro =
    inviteSource === 'organization'
      ? orgNamedLikeProduct
        ? `Your organization’s administrators have invited you to use <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> ${roleA} <strong>${rl}</strong>. You will use the same system as your colleagues for inventory, procurement, and approvals.`
        : `<strong>${cn}</strong> has invited you to use <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> ${roleA} <strong>${rl}</strong>. You will use the same system as your colleagues for inventory, procurement, and approvals.`
      : `The <strong>${escapeHtml(MAIL_PRODUCT_NAME)} Team</strong> has added you to <strong>${cn}</strong> as ${roleA} <strong>${rl}</strong>.`;

  const innerPwd = `<code style="font-size:17px;font-weight:800;color:#0f172a;letter-spacing:0.04em;word-break:break-all;font-family:Consolas,monospace;">${tp}</code>
    <p style="margin:14px 0 0;font-size:13px;color:#64748b;line-height:1.5;">Use this password <strong>once</strong> to sign in, then set your own password under <strong>Profile</strong> or <strong>Account settings</strong>.</p>`;

  const html = buildEmailDocument({
    preheader: `Sign-in details for ${companyName} on ${MAIL_PRODUCT_NAME}`,
    headline: inviteSource === 'organization' ? "You're invited" : 'Welcome to the portal',
    accent: 'brand',
    headerInviteContext: inviteSource === 'organization' ? 'organization' : 'portal',
    headerLogoUrl: orgHeaderLogoHttps,
    headerOrganizationName: inviteSource === 'organization' ? headerOrgDisplayName : undefined,
    headerBrandLine: inviteSource === 'organization' ? headerOrgDisplayName : MAIL_PRODUCT_NAME,
    headerSubline: 'Inventory · procurement · approvals',
    bodyHtml: `${emailParagraph(`Hi ${fn},`)}
      ${emailParagraph(welcomeLine)}
      ${emailParagraph(inviteIntro)}
      ${emailParagraph(
        `${escapeHtml(MAIL_PRODUCT_NAME)} brings inventory, procurement, and approvals together so your organization can work with a clear audit trail and fewer manual handoffs.`
      )}
      ${emailParagraph(roleWelcomeBlurb(role))}
      ${emailCredentialBox('Temporary password', innerPwd)}
      ${emailParagraph(
        `<strong>Security tip:</strong> Do not share this password. If you did not expect this invitation, contact your administrator or use the help links at the bottom of this email.`
      )}
      ${emailParagraph('<strong>What to do next</strong>')}
      ${emailBulletList([
        `Open <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> with the button below.`,
        `Sign in using your email address and the temporary password above.`,
        `Change your password immediately after your first successful sign-in.`,
      ])}`,
    ctaLabel: `Sign in to ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    secondaryCtaLabel: 'Forgot password?',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${cn} · ${MAIL_PRODUCT_NAME}`,
  });

  const textOrg =
    inviteSource === 'organization'
      ? orgNamedLikeProduct
        ? `Your organization's administrators invited you to use ${MAIL_PRODUCT_NAME} as ${roleA} ${rolePlain}.`
        : `${companyName} invited you to use ${MAIL_PRODUCT_NAME} as ${roleA} ${rolePlain}.`
      : `The ${MAIL_PRODUCT_NAME} Team has added you to ${companyName} as ${roleA} ${rolePlain}.`;

  const text = [
    `Hi ${fullName || 'there'},`,
    ``,
    `Welcome to ${companyName}.`,
    ``,
    textOrg,
    ``,
    `${MAIL_PRODUCT_NAME} helps teams manage inventory, procurement, and approvals in one place.`,
    ``,
    `Temporary password: ${temporaryPassword}`,
    ``,
    `Sign in: ${base}/login`,
    `Forgot / reset password: ${base}/forgot-password`,
    ``,
    `Please change your password after signing in.`,
  ].join('\n');

  return sendMail({ to, subject, html, text });
}
