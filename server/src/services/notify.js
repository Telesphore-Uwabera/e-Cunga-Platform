import crypto from 'node:crypto';
import PortalNotification from '../models/PortalNotification.js';
import PortalMessage from '../models/PortalMessage.js';
import User from '../models/User.js';
import { compactNotifyScope, portalBroadcastMatchesUser } from './orgScope.js';
import { sendMail } from './mail.js';
import {
  MAIL_PRODUCT_NAME,
  buildEmailDocument,
  emailBulletList,
  emailDetailCard,
  emailParagraph,
  emailSectionHeading,
  emailTipBox,
  escapeHtml,
  mailSubjectPrefix,
  clientBaseUrl,
} from './emailLayout.js';

function severityAccent(sev) {
  if (sev === 'bad') return 'danger';
  if (sev === 'warn') return 'warning';
  return 'neutral';
}

function greetingFirstName(fullName) {
  const s = String(fullName || '').trim();
  if (!s) return 'there';
  return s.split(/\s+/)[0];
}

function humanizeRole(role) {
  const r = String(role || '').toLowerCase();
  const map = {
    supervisor: 'Supervisor',
    clerk: 'Inventory clerk',
    accountant: 'Accountant',
    supplier: 'Supplier',
    admin: 'Administrator',
  };
  return map[r] || (r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Team member');
}

function buildTeamMemberAddedEmail(recipient, options) {
  const { newMemberEmail, newMemberRole, organizationName, newMemberName, newMemberLocation } = options.guideMeta || {};
  const first = greetingFirstName(recipient.fullName);
  const org = escapeHtml(organizationName || 'your organization');
  const em = escapeHtml(newMemberEmail);
  const nm = escapeHtml(String(newMemberName || '').trim() || newMemberEmail || '—');
  const loc = escapeHtml(String(newMemberLocation || '').trim() || '—');
  const rl = escapeHtml(humanizeRole(newMemberRole));
  const plainOrg = String(organizationName || 'your organization');

  const card = emailDetailCard([
    ['Organization', org],
    ['Name', nm],
    ['Email', em],
    ['Location', loc],
    ['Role', rl],
  ]);

  const html = buildEmailDocument({
    preheader: `A colleague joined ${plainOrg} — here is what to do next.`,
    headline: 'Your team has a new member',
    accent: 'success',
    bodyHtml: `${emailParagraph(`Hi ${escapeHtml(first)},`)}
      ${emailParagraph(
        `The <strong>${escapeHtml(MAIL_PRODUCT_NAME)} Team</strong> is letting you know that someone new was added to your roster in <strong>${org}</strong>.`
      )}
      ${card}
      ${emailParagraph(
        `They will receive their own email with secure sign-in steps. <strong>Do not share passwords</strong> by email or chat.`
      )}
      ${emailSectionHeading('What you can do next')}
      ${emailBulletList([
        `Sign in to <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> and open <strong>Team</strong> (or <strong>User management</strong>) to confirm roles.`,
        `New clerks and accountants usually show up automatically in inventory and approval workflows; supervisors can fine-tune access from the dashboard.`,
        `If this person should not have access, an administrator can deactivate or remove them from the same screens.`,
      ])}
      ${emailTipBox(
        `<strong style="color:#0f172a;">Tip:</strong> Use the <strong>Notifications</strong> bell after sign-in to stay on top of requisitions, stock alerts, and messages.`
      )}`,
    ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    secondaryCtaLabel: 'Forgot password?',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · roster update`,
  });

  const text = [
    `Hi ${first},`,
    ``,
    `The ${MAIL_PRODUCT_NAME} Team is letting you know someone new joined ${plainOrg}.`,
    ``,
    `Name: ${String(newMemberName || '').trim() || '—'}`,
    `Email: ${newMemberEmail}`,
    `Location: ${String(newMemberLocation || '').trim() || '—'}`,
    `Role: ${humanizeRole(newMemberRole)}`,
    ``,
    `They get their own sign-in email. Do not share passwords.`,
    ``,
    `Next steps: sign in, open Team or User management, and use Notifications for ongoing activity.`,
    ``,
    `Sign in: ${clientBaseUrl()}/login`,
  ].join('\n');

  return { html, text };
}

function buildGenericRoleNotifyEmail(recipient, title, body, severity, role) {
  const first = greetingFirstName(recipient.fullName);
  const accent = severityAccent(severity);
  const roleLabel = escapeHtml(role);

  const html = buildEmailDocument({
    preheader: title,
    headline: title,
    accent,
    bodyHtml: `${emailParagraph(`Hi ${escapeHtml(first)},`)}
      ${emailParagraph(
        `Here is an update from <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> for your <strong>${roleLabel}</strong> role.`
      )}
      ${emailTipBox(escapeHtml(body))}
      ${emailSectionHeading('What you can do next')}
      ${emailBulletList([
        `Open <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> to review the full context in the app.`,
        `Check the <strong>Notifications</strong> area for related tasks or messages.`,
        `If something looks unexpected, contact your organization administrator or use the help links below.`,
      ])}`,
    ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    secondaryCtaLabel: 'Forgot password?',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · ${roleLabel} notification`,
  });

  const text = [`Hi ${first},`, ``, `${MAIL_PRODUCT_NAME} (${role}):`, ``, body, ``, `Sign in for details.`].join('\n');
  return { html, text };
}

export async function notifyRole(companyId, role, title, body, severity = 'neutral', options = {}) {
  const scopeOpts = compactNotifyScope({
    scopeDepartment: options.scopeDepartment,
    scopeLocation: options.scopeLocation,
  });
  const id = `ntf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalNotification.create({ _id: id, companyId, role, title, body, severity, ...scopeOpts });

  if (options.skipEmail) return;
  if (role === 'supervisor' && !options.forceSupervisorEmail) return;

  try {
    const exclude = new Set(
      (options.excludeEmails || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)
    );
    const users = await User.find({ companyId, role, isActive: true })
      .select('email fullName location department team')
      .lean();
    for (const u of users) {
      if (Object.keys(scopeOpts).length && !portalBroadcastMatchesUser(scopeOpts, u)) continue;
      if (exclude.has(String(u.email || '').toLowerCase())) continue;

      let html;
      let text;
      if (options.guideType === 'team_member_added' && options.guideMeta) {
        ({ html, text } = buildTeamMemberAddedEmail(u, options));
      } else {
        ({ html, text } = buildGenericRoleNotifyEmail(u, title, body, severity, role));
      }

      sendMail({
        to: u.email,
        subject: `${mailSubjectPrefix()} ${title}`,
        text,
        html,
      }).catch((err) => console.error(`[notify] email failed for ${u.email}:`, err));
    }
  } catch (err) {
    console.error('[notify] failed to fetch users for email:', err);
  }
}

export async function messageRole(companyId, role, title, body, from = 'System', options = {}) {
  const scopeOpts = compactNotifyScope({
    scopeDepartment: options.scopeDepartment,
    scopeLocation: options.scopeLocation,
  });
  const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalMessage.create({ _id: id, companyId, role, title, body, from, ...scopeOpts });

  if (options.skipEmail) return;
  if (role === 'supervisor' && !options.forceSupervisorEmail) return;

  try {
    const users = await User.find({ companyId, role, isActive: true })
      .select('email fullName location department team')
      .lean();
    for (const u of users) {
      if (Object.keys(scopeOpts).length && !portalBroadcastMatchesUser(scopeOpts, u)) continue;
      const first = greetingFirstName(u.fullName);
      const html = buildEmailDocument({
        preheader: title,
        headline: 'New message in your inbox',
        accent: 'brand',
        bodyHtml: `${emailParagraph(`Hi ${escapeHtml(first)},`)}
          ${emailParagraph(`Someone sent a message to your <strong>${escapeHtml(role)}</strong> channel in <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>.`)}
          ${emailTipBox(
            `${emailParagraph(`<strong>From:</strong> ${escapeHtml(from)}`)}
             ${emailParagraph(escapeHtml(body))}`
          )}
          ${emailSectionHeading('What you can do next')}
          ${emailBulletList([
            `Open <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> and go to <strong>Messages</strong> (or your role home) to read and reply.`,
            `Keep notifications enabled so you do not miss approvals or supplier updates.`,
          ])}`,
        ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
        ctaPath: '/login',
        secondaryCtaLabel: 'Forgot password?',
        secondaryCtaPath: '/forgot-password',
        footerLine: `${MAIL_PRODUCT_NAME} · message to ${escapeHtml(role)}`,
      });
      sendMail({
        to: u.email,
        subject: `${mailSubjectPrefix()} ${title}`,
        text: `Hi ${first},\n\nFrom ${from}:\n${body}\n\nOpen ${MAIL_PRODUCT_NAME} to reply.`,
        html,
      }).catch((err) => console.error(`[message] email failed for ${u.email}:`, err));
    }
  } catch (err) {
    console.error('[message] failed to fetch users for email:', err);
  }
}

function buildPersonalNotifyEmail(user, title, body, severity) {
  const first = greetingFirstName(user.fullName);
  const accent = severityAccent(severity);
  const html = buildEmailDocument({
    preheader: title,
    headline: title,
    accent,
    bodyHtml: `${emailParagraph(`Hi ${escapeHtml(first)},`)}
      ${emailParagraph(`You have a personal notification in <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>.`)}
      ${emailTipBox(escapeHtml(body))}
      ${emailSectionHeading('What you can do next')}
      ${emailBulletList([
        `Sign in to read the full details and take any required action.`,
        `Use <strong>Account settings</strong> if you need to update your profile or password.`,
      ])}`,
    ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    secondaryCtaLabel: 'Forgot password?',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · personal notification`,
  });
  const text = [`Hi ${first},`, ``, body, ``, `Open ${MAIL_PRODUCT_NAME} for details.`].join('\n');
  return { html, text };
}

export async function notifyUser(userId, title, body, severity = 'neutral', options = {}) {
  const user = await User.findById(userId).lean();
  if (!user) return;

  const id = `ntf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalNotification.create({ _id: id, companyId: user.companyId, userId, role: user.role, title, body, severity });

  if (options.skipEmail) return;

  const { html, text } = buildPersonalNotifyEmail(user, title, body, severity);
  sendMail({
    to: user.email,
    subject: `${mailSubjectPrefix()} ${title}`,
    text,
    html,
  }).catch((err) => console.error(`[notifyUser] email failed for ${user.email}:`, err));
}

export async function messageUser(userId, title, body, from = 'System', options = {}) {
  const user = await User.findById(userId).lean();
  if (!user) return;

  const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalMessage.create({ _id: id, companyId: user.companyId, userId, role: user.role, title, body, from });

  if (options.skipEmail) return;

  const first = greetingFirstName(user.fullName);
  const html = buildEmailDocument({
    preheader: title,
    headline: 'New direct message',
    accent: 'brand',
    bodyHtml: `${emailParagraph(`Hi ${escapeHtml(first)},`)}
      ${emailParagraph(`You have a new direct message in <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>.`)}
      ${emailTipBox(
        `${emailParagraph(`<strong>From:</strong> ${escapeHtml(from)}`)}
         ${emailParagraph(escapeHtml(body))}`
      )}
      ${emailSectionHeading('What you can do next')}
      ${emailBulletList([`Sign in and open <strong>Messages</strong> to read the full thread and respond.`])}`,
    ctaLabel: `Open ${MAIL_PRODUCT_NAME}`,
    ctaPath: '/login',
    secondaryCtaLabel: 'Forgot password?',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} · direct message`,
  });
  sendMail({
    to: user.email,
    subject: `${mailSubjectPrefix()} ${title}`,
    text: `Hi ${first},\n\nFrom ${from}:\n${body}`,
    html,
  }).catch((err) => console.error(`[messageUser] email failed for ${user.email}:`, err));
}
