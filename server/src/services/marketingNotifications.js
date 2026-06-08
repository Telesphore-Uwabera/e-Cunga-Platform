import { sendMail } from './mail.js';
import { getPlatformAdminNotifyTargets } from '../lib/platformTenant.js';
import {
  MAIL_PRODUCT_NAME,
  buildEmailDocument,
  clientPathUrl,
  emailDetailCard,
  emailParagraph,
  escapeHtml,
  mailSubjectPrefix,
} from './emailLayout.js';

/**
 * Merge platform admin emails with MAIL_SUPPORT_EMAIL fallback (deduplicated).
 */
export async function resolveAdminNotifyEmails() {
  const targets = await getPlatformAdminNotifyTargets();
  const emails = new Set(
    targets.map((t) => String(t.email || '').trim().toLowerCase()).filter(Boolean)
  );

  const support = String(process.env.MAIL_SUPPORT_EMAIL || '').trim().toLowerCase();
  if (support) emails.add(support);

  return [...emails];
}

async function notifyAdmins({ subject, html, text }) {
  const recipients = await resolveAdminNotifyEmails();
  if (!recipients.length) {
    console.warn('[marketingNotifications] No admin notify targets configured.');
    return;
  }
  for (const email of recipients) {
    await sendMail({ to: email, subject, html, text });
  }
}

/**
 * Notify admins when someone submits the contact form.
 */
export async function emailContactInquiryToAdmins(inquiry) {
  const { firstName, lastName, email, industry, message, createdAt } = inquiry;
  const fullName = `${firstName} ${lastName}`.trim();
  const subject = `${mailSubjectPrefix()} New contact inquiry — ${fullName}`;

  const card = emailDetailCard([
    ['Name', escapeHtml(fullName)],
    ['Email', escapeHtml(email)],
    ['Industry', escapeHtml(industry || 'Not specified')],
    ['Submitted', escapeHtml(createdAt ? new Date(createdAt).toLocaleString() : new Date().toLocaleString())],
    ['Message', escapeHtml(message || '').replace(/\n/g, '<br/>')],
  ]);

  const html = buildEmailDocument({
    preheader: `Contact from ${fullName}`,
    headline: 'New contact inquiry',
    accent: 'neutral',
    bodyHtml: `${emailParagraph(
      `Someone submitted the public contact form on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>.`
    )}${card}`,
    ctaLabel: 'View inquiries',
    ctaPath: '/app/admin/contact-inquiries',
    footerLine: `${MAIL_PRODUCT_NAME} · administrator notification`,
    includeForgotPasswordLink: false,
  });

  const text = `New contact inquiry from ${fullName} (${email}).\nIndustry: ${industry || 'Not specified'}\n\n${message}\n\nReview: ${clientPathUrl('/app/admin/contact-inquiries')}`;

  await notifyAdmins({ subject, html, text });
}

/**
 * Notify admins when someone subscribes to the newsletter.
 */
export async function emailNewNewsletterSubscriberToAdmins({ email, source, subscribedAt }) {
  const subject = `${mailSubjectPrefix()} New newsletter subscriber — ${email}`;

  const card = emailDetailCard([
    ['Email', escapeHtml(email)],
    ['Source', escapeHtml(source || 'website_footer')],
    ['Subscribed', escapeHtml(subscribedAt ? new Date(subscribedAt).toLocaleString() : new Date().toLocaleString())],
  ]);

  const html = buildEmailDocument({
    preheader: `New subscriber: ${email}`,
    headline: 'New newsletter subscriber',
    accent: 'neutral',
    bodyHtml: `${emailParagraph(
      `A visitor subscribed to the newsletter on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>.`
    )}${card}`,
    ctaLabel: 'View subscribers',
    ctaPath: '/app/admin/newsletter-subscriptions',
    footerLine: `${MAIL_PRODUCT_NAME} · administrator notification`,
    includeForgotPasswordLink: false,
  });

  const text = `New newsletter subscriber: ${email}\nSource: ${source || 'website_footer'}\n\nReview: ${clientPathUrl('/app/admin/newsletter-subscriptions')}`;

  await notifyAdmins({ subject, html, text });
}
