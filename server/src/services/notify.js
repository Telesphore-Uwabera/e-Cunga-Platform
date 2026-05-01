import crypto from 'node:crypto';
import PortalNotification from '../models/PortalNotification.js';
import PortalMessage from '../models/PortalMessage.js';
import User from '../models/User.js';
import { sendMail } from './mail.js';
import {
  MAIL_PRODUCT_NAME,
  buildEmailDocument,
  emailParagraph,
  escapeHtml,
  mailSubjectPrefix,
} from './emailLayout.js';

function severityAccent(sev) {
  if (sev === 'bad') return 'danger';
  if (sev === 'warn') return 'warning';
  return 'neutral';
}

export async function notifyRole(companyId, role, title, body, severity = 'neutral', options = {}) {
  const id = `ntf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalNotification.create({ _id: id, companyId, role, title, body, severity });

  try {
    const exclude = new Set(
      (options.excludeEmails || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)
    );
    const users = await User.find({ companyId, role, isActive: true }).select('email fullName').lean();
    for (const u of users) {
      if (exclude.has(String(u.email || '').toLowerCase())) continue;
      const html = buildEmailDocument({
        preheader: title,
        headline: title,
        accent: severityAccent(severity),
        bodyHtml: emailParagraph(escapeHtml(body)),
        ctaLabel: 'Open workspace',
        ctaPath: '/login',
        secondaryCtaLabel: 'Reset password',
        secondaryCtaPath: '/forgot-password',
        footerLine: `${MAIL_PRODUCT_NAME} · ${escapeHtml(role)} · team notification`,
      });
      sendMail({
        to: u.email,
        subject: `${mailSubjectPrefix()} ${title}`,
        text: body,
        html,
      }).catch((err) => console.error(`[notify] email failed for ${u.email}:`, err));
    }
  } catch (err) {
    console.error('[notify] failed to fetch users for email:', err);
  }
}

export async function messageRole(companyId, role, title, body, from = 'System') {
  const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalMessage.create({ _id: id, companyId, role, title, body, from });

  try {
    const users = await User.find({ companyId, role, isActive: true }).select('email fullName').lean();
    for (const u of users) {
      const html = buildEmailDocument({
        preheader: title,
        headline: 'New message',
        accent: 'brand',
        bodyHtml:
          `${emailParagraph(`<strong>From:</strong> ${escapeHtml(from)}`)}
           ${emailParagraph(escapeHtml(body))}`,
        ctaLabel: 'Open inbox',
        ctaPath: '/login',
        secondaryCtaLabel: 'Reset password',
        secondaryCtaPath: '/forgot-password',
        footerLine: `${MAIL_PRODUCT_NAME} · message to ${escapeHtml(role)}`,
      });
      sendMail({
        to: u.email,
        subject: `${mailSubjectPrefix()} ${title}`,
        text: `${from}: ${body}`,
        html,
      }).catch((err) => console.error(`[message] email failed for ${u.email}:`, err));
    }
  } catch (err) {
    console.error('[message] failed to fetch users for email:', err);
  }
}

export async function notifyUser(userId, title, body, severity = 'neutral', options = {}) {
  const user = await User.findById(userId).lean();
  if (!user) return;

  const id = `ntf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalNotification.create({ _id: id, companyId: user.companyId, userId, role: user.role, title, body, severity });

  if (options.skipEmail) return;

  const html = buildEmailDocument({
    preheader: title,
    headline: title,
    accent: severityAccent(severity),
    bodyHtml: emailParagraph(escapeHtml(body)),
    ctaLabel: 'Open workspace',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} — personal notification`,
  });
  sendMail({
    to: user.email,
    subject: `${mailSubjectPrefix()} ${title}`,
    text: body,
    html,
  }).catch((err) => console.error(`[notifyUser] email failed for ${user.email}:`, err));
}

export async function messageUser(userId, title, body, from = 'System') {
  const user = await User.findById(userId).lean();
  if (!user) return;

  const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalMessage.create({ _id: id, companyId: user.companyId, userId, role: user.role, title, body, from });

  const html = buildEmailDocument({
    preheader: title,
    headline: 'New message',
    accent: 'brand',
    bodyHtml:
      `${emailParagraph(`<strong>From:</strong> ${escapeHtml(from)}`)}
       ${emailParagraph(escapeHtml(body))}`,
    ctaLabel: 'Open inbox',
    ctaPath: '/login',
    secondaryCtaLabel: 'Reset password',
    secondaryCtaPath: '/forgot-password',
    footerLine: `${MAIL_PRODUCT_NAME} — direct message`,
  });
  sendMail({
    to: user.email,
    subject: `${mailSubjectPrefix()} ${title}`,
    text: `${from}: ${body}`,
    html,
  }).catch((err) => console.error(`[messageUser] email failed for ${user.email}:`, err));
}
