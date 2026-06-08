import axios from 'axios';
import NewsletterSubscription from '../models/NewsletterSubscription.js';
import User from '../models/User.js';
import NewsCampaign from '../models/NewsCampaign.js';
import { sendMail, isMailConfigured } from './mail.js';
import {
  MAIL_PRODUCT_NAME,
  MAIL_FONT_STACK,
  buildEmailDocument,
  clientBaseUrl,
  escapeHtml,
  emailParagraph,
} from './emailLayout.js';

const SEND_DELAY_MS = 150;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidEmail(email) {
  const t = String(email || '').trim().toLowerCase();
  return t.length > 0 && t.length <= 254 && EMAIL_RE.test(t);
}

/**
 * Merge active newsletter subscribers and active portal users, deduplicated by email.
 */
export async function getBulkAudience() {
  const [subs, users] = await Promise.all([
    NewsletterSubscription.find({ status: 'active' }).select('email').lean(),
    User.find({ isActive: true }).select('email').lean(),
  ]);

  const map = new Map();

  for (const sub of subs) {
    const email = String(sub.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) continue;
    map.set(email, { email, newsletter: true, portal: false });
  }

  for (const user of users) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) continue;
    const existing = map.get(email);
    if (existing) {
      existing.portal = true;
    } else {
      map.set(email, { email, newsletter: false, portal: true });
    }
  }

  const audience = [...map.values()].map((entry) => ({
    email: entry.email,
    source: entry.newsletter && entry.portal ? 'both' : entry.newsletter ? 'newsletter' : 'portal',
  }));

  const newsletterOnly = audience.filter((a) => a.source === 'newsletter').length;
  const portalOnly = audience.filter((a) => a.source === 'portal').length;
  const both = audience.filter((a) => a.source === 'both').length;

  return {
    audience,
    stats: {
      total: audience.length,
      newsletterOnly,
      portalOnly,
      both,
      newsletterTotal: newsletterOnly + both,
      portalTotal: portalOnly + both,
    },
  };
}

function formatBodyHtml(bodyHtml) {
  const raw = String(bodyHtml || '').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return escapeHtml(raw).replace(/\n/g, '<br/>');
}

function buildUnsubscribeFooter(recipientEmail) {
  const support = process.env.MAIL_SUPPORT_EMAIL?.trim() || 'hello.ecunga@gmail.com';
  const base = clientBaseUrl();
  return `<p style="margin:24px 0 0;font-family:${MAIL_FONT_STACK};font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;" class="ec-email-muted">
    You are receiving this because you subscribed to ${escapeHtml(MAIL_PRODUCT_NAME)} or have a portal account.
    <br/>
  <a href="mailto:${escapeHtml(support)}?subject=${encodeURIComponent(`Unsubscribe ${recipientEmail}`)}" style="color:#64748b;text-decoration:underline;">Unsubscribe from newsletter</a>
  &nbsp;·&nbsp;
  <a href="${escapeHtml(`${base}/contact`)}" style="color:#64748b;text-decoration:underline;">Contact us</a>
  </p>`;
}

/**
 * Build branded HTML for a news campaign.
 */
export function buildNewsEmailHtml(campaign, recipientEmail) {
  const heroBlock = campaign.heroImageUrl
    ? `<div style="margin:0 0 20px;text-align:center;">
        <img src="${escapeHtml(campaign.heroImageUrl)}" alt="" width="528" style="max-width:100%;height:auto;border-radius:12px;display:block;margin:0 auto;" />
      </div>`
    : '';

  const bodyContent = formatBodyHtml(campaign.bodyHtml);

  const html = buildEmailDocument({
    preheader: campaign.subject,
    headline: campaign.headline,
    accent: 'brand',
    bodyHtml: `${heroBlock}${emailParagraph(bodyContent)}${buildUnsubscribeFooter(recipientEmail)}`,
    footerLine: `${MAIL_PRODUCT_NAME} · news update`,
    includeForgotPasswordLink: false,
  });

  return html;
}

function buildPlainText(campaign) {
  const text = campaign.bodyText || String(campaign.bodyHtml || '').replace(/<[^>]+>/g, ' ');
  return `${campaign.headline}\n\n${text}\n\n---\n${MAIL_PRODUCT_NAME}`;
}

/**
 * Download attachment URLs once for reuse across sends.
 */
async function resolveAttachmentBuffers(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return [];
  const resolved = [];
  for (const att of attachments) {
    if (!att?.url) continue;
    try {
      const res = await axios.get(att.url, { responseType: 'arraybuffer', timeout: 30000 });
      resolved.push({
        filename: att.filename || 'attachment',
        content: Buffer.from(res.data),
        contentType: att.contentType || 'application/octet-stream',
      });
    } catch (err) {
      console.error(`[bulkNewsEmail] Failed to fetch attachment ${att.filename}:`, err.message);
    }
  }
  return resolved;
}

/**
 * Send a single campaign email (preview or bulk item).
 */
export async function sendSingleCampaignEmail(campaign, to) {
  const html = buildNewsEmailHtml(campaign, to);
  const text = buildPlainText(campaign);
  const attachmentBuffers = await resolveAttachmentBuffers(campaign.attachments);
  return sendMail({
    to,
    subject: campaign.subject,
    text,
    html,
    attachments: attachmentBuffers,
  });
}

/**
 * Send campaign to all audience members. Runs async after initial status update.
 */
export async function sendNewsCampaign(campaignId) {
  if (!isMailConfigured()) {
    throw new Error('Mail is not configured. Set BREVO_API_KEY or SMTP_HOST.');
  }

  const campaign = await NewsCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found.');
  if (campaign.status === 'sending') throw new Error('Campaign is already sending.');
  if (campaign.status === 'sent') throw new Error('Campaign was already sent.');

  const { audience } = await getBulkAudience();

  campaign.status = 'sending';
  campaign.recipientCount = audience.length;
  campaign.successCount = 0;
  campaign.failureCount = 0;
  campaign.errorMessage = '';
  await campaign.save();

  const attachmentBuffers = await resolveAttachmentBuffers(campaign.attachments);
  const campaignPlain = campaign.toObject();

  let successCount = 0;
  let failureCount = 0;

  for (const recipient of audience) {
    try {
      const html = buildNewsEmailHtml(campaignPlain, recipient.email);
      const text = buildPlainText(campaignPlain);
      const result = await sendMail({
        to: recipient.email,
        subject: campaign.subject,
        text,
        html,
        attachments: attachmentBuffers,
      });
      if (result.ok && !result.skipped) {
        successCount += 1;
      } else if (result.skipped) {
        failureCount += 1;
      } else {
        failureCount += 1;
      }
    } catch (err) {
      console.error(`[bulkNewsEmail] Failed to send to ${recipient.email}:`, err.message);
      failureCount += 1;
    }
    await sleep(SEND_DELAY_MS);
  }

  campaign.successCount = successCount;
  campaign.failureCount = failureCount;
  campaign.status = failureCount === audience.length && audience.length > 0 ? 'failed' : 'sent';
  campaign.sentAt = new Date();
  await campaign.save();

  return {
    recipientCount: audience.length,
    successCount,
    failureCount,
    status: campaign.status,
  };
}
