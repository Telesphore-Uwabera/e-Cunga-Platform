import axios from 'axios';
import nodemailer from 'nodemailer';

function trimEnv(key) {
  return String(process.env[key] || '').trim();
}

/** True when either Brevo or standard SMTP is configured. */
export function isMailConfigured() {
  return Boolean(trimEnv('BREVO_API_KEY') || trimEnv('SMTP_HOST') || trimEnv('SMTP_URL'));
}

/** Alias for backward compatibility */
export function isSmtpConfigured() {
  return isMailConfigured();
}

let transporterPromise;

async function getTransporter() {
  const url = trimEnv('SMTP_URL');
  const host = trimEnv('SMTP_HOST');
  if (url) {
    return nodemailer.createTransport(url);
  }
  if (!host) return null;
  const port = Number(trimEnv('SMTP_PORT') || '587');
  const user = trimEnv('SMTP_USER');
  const pass = trimEnv('SMTP_PASS');
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * Normalize attachments to nodemailer/Brevo format.
 * @param {Array<{ filename: string; content: Buffer|string; contentType?: string }>} [attachments]
 */
function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return [];
  return attachments
    .filter((a) => a?.filename && a?.content)
    .map((a) => {
      const content =
        Buffer.isBuffer(a.content) ? a.content
        : typeof a.content === 'string' ? Buffer.from(a.content, 'base64')
        : null;
      if (!content) return null;
      return {
        filename: a.filename,
        content,
        contentType: a.contentType || 'application/octet-stream',
      };
    })
    .filter(Boolean);
}

/**
 * Send an email using Brevo (Sendinblue) API
 */
async function sendViaBrevo({ to, subject, text, html, attachments }) {
  const apiKey = trimEnv('BREVO_API_KEY');
  const senderEmail = trimEnv('BREVO_SENDER_EMAIL') || 'noreply@ecunga.com';
  const senderName = trimEnv('BREVO_SENDER_NAME') || 'e-Cunga Portal Team';

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: html || `<pre style="font-family:sans-serif">${escapeHtml(text)}</pre>`,
    textContent: text || '',
  };

  const normalized = normalizeAttachments(attachments);
  if (normalized.length) {
    payload.attachment = normalized.map((a) => ({
      name: a.filename,
      content: a.content.toString('base64'),
    }));
  }

  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    return { ok: true, data: response.data };
  } catch (error) {
    console.error('[mail] Brevo send failed:', error.response?.data || error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   to: string;
 *   subject: string;
 *   text: string;
 *   html?: string;
 *   attachments?: Array<{ filename: string; content: Buffer|string; contentType?: string }>;
 * }} opts
 * @returns {Promise<{ ok: boolean; skipped?: boolean; error?: string }>}
 */
export async function sendMail({ to, subject, text, html, attachments }) {
  if (!isMailConfigured()) {
    console.log('\n[mail] Mail not configured — message not sent (set BREVO_API_KEY or SMTP_HOST)');
    console.log('[mail] To:', to);
    console.log('[mail] Subject:', subject);
    console.log('[mail] Body:\n', text);
    if (attachments?.length) {
      console.log('[mail] Attachments:', attachments.map((a) => a.filename).join(', '));
    }
    console.log('');
    return { ok: true, skipped: true };
  }

  const normalized = normalizeAttachments(attachments);

  // Prefer Brevo if API key is present
  if (trimEnv('BREVO_API_KEY')) {
    return sendViaBrevo({ to, subject, text, html, attachments: normalized });
  }

  // Fallback to SMTP
  try {
    const from = trimEnv('MAIL_FROM') || trimEnv('SMTP_FROM') || 'no-reply@ecunga.local';
    if (!transporterPromise) transporterPromise = getTransporter();
    const tx = await transporterPromise;
    if (!tx) {
      console.warn('[mail] No transporter');
      return { ok: false, error: 'Mail not configured' };
    }
    const mailOpts = {
      from,
      to,
      subject,
      text,
      html: html || `<pre style="font-family:sans-serif">${escapeHtml(text)}</pre>`,
    };
    if (normalized.length) {
      mailOpts.attachments = normalized.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));
    }
    await tx.sendMail(mailOpts);
    return { ok: true };
  } catch (e) {
    console.error('[mail] SMTP send failed:', e.message);
    return { ok: false, error: e.message };
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
