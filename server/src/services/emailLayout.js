/**
 * Shared HTML email shell for e-Cunga (table-based, client-safe styles).
 * Brand: deep maroon #780b23, neutrals from slate palette.
 */

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clientBaseUrl() {
  return String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

const BRAND = '#780b23';
const BRAND_DARK = '#4a0715';
const MUTED = '#64748b';
const FOOTER = '#94a3b8';

/**
 * @param {{
 *   preheader?: string;
 *   headline: string;
 *   accent?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
 *   bodyHtml: string;
 *   ctaLabel?: string;
 *   ctaPath?: string;
 *   footerLine?: string;
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
  const ctaBlock =
    opts.ctaLabel ?
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;"><tr>
        <td style="border-radius:10px;background:${accent};">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(opts.ctaLabel)}</a>
        </td>
      </tr></table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
      <tr><td style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_DARK} 100%);padding:28px 32px;text-align:center;">
        <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">e-Cunga</p>
        <h1 style="margin:10px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">${escapeHtml(opts.headline)}</h1>
      </td></tr>
      <tr><td style="padding:32px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#1e293b;">
        ${opts.bodyHtml}
        ${ctaBlock}
      </td></tr>
      <tr><td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${FOOTER};line-height:1.5;">
          ${escapeHtml(opts.footerLine || 'e-Cunga — procurement & inventory workflow')}
        </p>
        <p style="margin:12px 0 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:${MUTED};">
          You are receiving this because of your role or assignment in the workspace.
        </p>
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
