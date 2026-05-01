/**
 * Shared HTML email shell for e-Cunga Portal (table-based, client-safe styles).
 * Brand: burgundy #780b23, neutrals, optional logo from CLIENT_URL/e-Cunga.webp.
 */

export const MAIL_PRODUCT_NAME = 'e-Cunga Portal';

export function clientBaseUrl() {
  return String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/** Prefix for transactional subjects, e.g. [e-Cunga Portal] */
export function mailSubjectPrefix() {
  return `[${MAIL_PRODUCT_NAME}]`;
}

export function brandLogoUrl() {
  const explicit = process.env.MAIL_BRAND_LOGO_URL?.trim();
  if (explicit) return explicit;
  return `${clientBaseUrl()}/e-Cunga.webp`;
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BRAND = '#780b23';
const BRAND_DARK = '#4a0715';
const MUTED = '#64748b';
const FOOTER = '#94a3b8';

function formalContactFooterHtml() {
  const support = process.env.MAIL_SUPPORT_EMAIL?.trim() || process.env.BREVO_SENDER_EMAIL?.trim() || '';
  const phone = process.env.MAIL_SUPPORT_PHONE?.trim() || '';
  const address = process.env.MAIL_COMPANY_ADDRESS?.trim() || '';
  const base = clientBaseUrl();

  const parts = [];
  parts.push(
    `<p style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;color:#334155;letter-spacing:0.06em;">${escapeHtml(MAIL_PRODUCT_NAME)}</p>`
  );
  if (address) {
    parts.push(
      `<p style="margin:0 0 10px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${MUTED};line-height:1.55;">${escapeHtml(address).replace(/\n/g, '<br/>')}</p>`
    );
  }
  const line = [];
  if (support) {
    line.push(
      `<a href="mailto:${escapeHtml(support)}" style="color:${BRAND};text-decoration:none;font-weight:600;">${escapeHtml(support)}</a>`
    );
  }
  if (phone) {
    line.push(`<span style="color:#475569;">${escapeHtml(phone)}</span>`);
  }
  if (line.length) {
    parts.push(
      `<p style="margin:0 0 12px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${MUTED};">${line.join(' · ')}</p>`
    );
  }
  parts.push(
    `<p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:${FOOTER};">
      <a href="${escapeHtml(`${base}/terms`)}" style="color:${MUTED};">Terms</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(`${base}/privacy`)}" style="color:${MUTED};">Privacy</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(`${base}/contact`)}" style="color:${MUTED};">Help &amp; contact</a>
    </p>`
  );
  return parts.join('');
}

/**
 * @param {{
 *   preheader?: string;
 *   headline: string;
 *   accent?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
 *   bodyHtml: string;
 *   ctaLabel?: string;
 *   ctaPath?: string;
 *   secondaryCtaLabel?: string;
 *   secondaryCtaPath?: string;
 *   footerLine?: string;
 *   includeForgotPasswordLink?: boolean;
 * }} opts
 */
export function buildEmailDocument(opts) {
  const base = clientBaseUrl();
  const ctaUrl = opts.ctaPath ? `${base}${opts.ctaPath.startsWith('/') ? opts.ctaPath : `/${opts.ctaPath}`}` : `${base}/login`;
  const accents = {
    brand: BRAND,
    success: '#059669',
    warning: '#d97706',
    danger: '#991b1b',
    neutral: '#475569',
  };
  const accent = accents[opts.accent || 'brand'] || BRAND;
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>` : '';
  const logoUrl = brandLogoUrl();

  const primaryCta =
    opts.ctaLabel ?
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;"><tr>
        <td style="border-radius:10px;background:${accent};">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(opts.ctaLabel)}</a>
        </td>
      </tr></table>`
    : '';

  let secondaryBlock = '';
  if (opts.secondaryCtaLabel && opts.secondaryCtaPath) {
    const secUrl = `${base}${opts.secondaryCtaPath.startsWith('/') ? opts.secondaryCtaPath : `/${opts.secondaryCtaPath}`}`;
    secondaryBlock = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px auto 0;"><tr>
      <td style="border-radius:10px;border:2px solid ${accent};">
        <a href="${escapeHtml(secUrl)}" style="display:inline-block;padding:12px 24px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:${accent};text-decoration:none;">${escapeHtml(opts.secondaryCtaLabel)}</a>
      </td>
    </tr></table>`;
  } else if (opts.includeForgotPasswordLink) {
    const forgotUrl = `${base}/forgot-password`;
    secondaryBlock = `<p style="margin:20px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;text-align:center;">
      <a href="${escapeHtml(forgotUrl)}" style="color:${BRAND};font-weight:600;text-decoration:underline;">Reset password</a>
      <span style="color:${MUTED};"> — use this email address if you cannot sign in.</span>
    </p>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:28px 14px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(15,23,42,0.07);border:1px solid #e2e8f0;">
      <tr><td style="background:linear-gradient(145deg,${BRAND} 0%,${BRAND_DARK} 100%);padding:32px 32px 28px;text-align:center;">
        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(MAIL_PRODUCT_NAME)}" width="132" height="auto" style="display:block;margin:0 auto 14px;max-width:132px;height:auto;border:0;outline:none;" />
        <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.88);">${escapeHtml(MAIL_PRODUCT_NAME)}</p>
        <p style="margin:6px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.75);">Inventory · procurement · approvals</p>
        <h1 style="margin:18px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#ffffff;line-height:1.35;letter-spacing:-0.02em;">${escapeHtml(opts.headline)}</h1>
      </td></tr>
      <tr><td style="padding:32px 36px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#1e293b;">
        ${opts.bodyHtml}
        ${primaryCta}
        ${secondaryBlock}
      </td></tr>
      <tr><td style="padding:22px 36px 26px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${FOOTER};line-height:1.55;text-align:center;">
          ${escapeHtml(opts.footerLine || `${MAIL_PRODUCT_NAME} — workspace notification`)}
        </p>
        <p style="margin:14px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.5;text-align:center;">
          You are receiving this email because of your role or activity in ${escapeHtml(MAIL_PRODUCT_NAME)}.
        </p>
        <div style="margin:22px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;">
          ${formalContactFooterHtml()}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Short body paragraph helper */
export function emailParagraph(text) {
  return `<p style="margin:0 0 16px;">${text}</p>`;
}

/** Detail card */
export function emailDetailCard(rows) {
  const inner = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.04em;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:600;color:#0f172a;vertical-align:top;">${value}</td></tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:20px 0;">
    <tr><td style="padding:20px 20px 8px;"><table width="100%">${inner}</table></td></tr>
  </table>`;
}

/** Highlight box for OTP / temporary password */
export function emailCredentialBox(title, innerHtml) {
  return `<div style="text-align:center;margin:26px 0;background:#faf8f9;border:1px solid #e7d5d9;border-radius:12px;padding:22px 18px;">
    <p style="margin:0 0 10px;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">${escapeHtml(title)}</p>
    ${innerHtml}
  </div>`;
}
