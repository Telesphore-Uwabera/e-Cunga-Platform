import nodemailer from 'nodemailer';

function trimEnv(key) {
  return String(process.env[key] || '').trim();
}

/** True when SMTP is configured — otherwise invite OTPs are logged to the console only. */
export function isSmtpConfigured() {
  return Boolean(trimEnv('SMTP_HOST') || trimEnv('SMTP_URL'));
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
 * @param {{ to: string; subject: string; text: string; html?: string }} opts
 * @returns {{ ok: boolean; skipped?: boolean; dev?: boolean; error?: string }}
 */
export async function sendMail({ to, subject, text, html }) {
  const from = trimEnv('MAIL_FROM') || trimEnv('SMTP_FROM') || 'no-reply@ecunga.local';
  if (!isSmtpConfigured()) {
    console.log('\n[mail] SMTP not configured — message not sent (set SMTP_HOST or SMTP_URL)');
    console.log('[mail] To:', to);
    console.log('[mail] Subject:', subject);
    console.log('[mail] Body:\n', text);
    console.log('');
    return { ok: true, skipped: true };
  }

  try {
    if (!transporterPromise) transporterPromise = getTransporter();
    const tx = await transporterPromise;
    if (!tx) {
      console.warn('[mail] No transporter');
      return { ok: false, error: 'Mail not configured' };
    }
    await tx.sendMail({
      from,
      to,
      subject,
      text,
      html: html || `<pre style="font-family:sans-serif">${escapeHtml(text)}</pre>`,
    });
    return { ok: true };
  } catch (e) {
    console.error('[mail] send failed:', e.message);
    return { ok: false, error: e.message };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
