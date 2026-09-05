/**
 * Shared branded PDF builder — wraps jsPDF with e-Cunga design tokens.
 * Produces fully designed documents: gradient header with logo, section
 * headings with colour rules, zebra-striped tables with styled headers,
 * KPI highlight cards, colour-coded status chips, and branded footers.
 *
 * Usage:
 *   const pdf = await createPdf({ title, companyName, logoUrl, subtitle, period });
 *   pdf.kpiRow([{ label, value, sub?, color? }, …]);  // highlight cards
 *   pdf.section('Section Title');
 *   pdf.table(headers, rows, { colWidths?, headerBg?, highlight? });
 *   pdf.kv('Label', 'Value');
 *   pdf.para('Free text paragraph.');
 *   pdf.spacer();
 *   pdf.save('filename');
 */

import jsPDF from 'jspdf';

// ─── Brand tokens ──────────────────────────────────────────────────────────
const C = {
  primary:     '#692751',
  primaryDark: '#4a1a39',
  accent:      '#8b3a62',
  primaryLight:'#f3e8ee',
  green:       '#16a34a',
  greenLight:  '#dcfce7',
  amber:       '#d97706',
  amberLight:  '#fef3c7',
  red:         '#dc2626',
  redLight:    '#fee2e2',
  blue:        '#2563eb',
  blueLight:   '#dbeafe',
  muted:       '#64748b',
  border:      '#e2e8f0',
  rowAlt:      '#f8fafc',
  rowHover:    '#f1f5f9',
  white:       '#ffffff',
  ink:         '#0f172a',
  ink2:        '#334155',
  ink3:        '#475569',
};

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Helpers ───────────────────────────────────────────────────────────────
function hex(h) {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
}

function darken(h, amt = 20) {
  return hex(h).map((v) => Math.max(0, v - amt));
}

// Fetch cross-origin image → base64 data URL
async function toDataUrl(src, ms = 7000) {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src || null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => { img.onload = img.onerror = null; resolve(null); }, ms);
    img.onload = () => {
      clearTimeout(t);
      try {
        const c = document.createElement('canvas');
        c.width  = img.naturalWidth  || img.width  || 1;
        c.height = img.naturalHeight || img.height || 1;
        const ctx = c.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch { resolve(null); }
    };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = src;
  });
}

/**
 * Create a fully branded PDF document.
 * Returns a rich helper object with layout methods.
 *
 * @param {{ title: string, companyName?: string, logoUrl?: string,
 *           subtitle?: string, period?: string }} opts
 * @returns {Promise<object>}
 */
export async function createPdf({ title, companyName = '', logoUrl = '', subtitle = '', period = '' }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let y = 0;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HEADER BAND
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const BAND_H = 38;

  // Main background
  doc.setFillColor(...hex(C.primary));
  doc.rect(0, 0, PAGE_W, BAND_H, 'F');

  // Accent stripe — rightmost 40%
  doc.setFillColor(...hex(C.accent));
  doc.rect(PAGE_W * 0.6, 0, PAGE_W * 0.4, BAND_H, 'F');

  // Subtle decorative circle (top-right)
  doc.setFillColor(...hex(C.primaryDark));
  doc.circle(PAGE_W - 8, -4, 22, 'F');

  // Small white diagonal rule accent
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.setGState && doc.setGState(doc.GState({ opacity: 0.15 }));
  doc.line(PAGE_W * 0.55, 0, PAGE_W * 0.62, BAND_H);
  doc.line(PAGE_W * 0.58, 0, PAGE_W * 0.65, BAND_H);
  // Reset opacity
  doc.setGState && doc.setGState(doc.GState({ opacity: 1 }));
  doc.setLineWidth(0.2);

  // Logo
  const LOGO_SIZE = 22;
  const LOGO_Y    = (BAND_H - LOGO_SIZE) / 2;
  let textX       = MARGIN;

  const dataUrl = await toDataUrl(logoUrl);
  if (dataUrl) {
    try {
      // White background pill behind logo for contrast
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(MARGIN - 1, LOGO_Y - 1, LOGO_SIZE + 2, LOGO_SIZE + 2, 3, 3, 'F');
      doc.addImage(dataUrl, 'PNG', MARGIN, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
    } catch { /* skip */ }
    textX = MARGIN + LOGO_SIZE + 6;
  } else {
    // Styled "E" badge
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, LOGO_Y, LOGO_SIZE, LOGO_SIZE, 4, 4, 'F');
    doc.setTextColor(...hex(C.primary));
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('E', MARGIN + LOGO_SIZE / 2, LOGO_Y + LOGO_SIZE / 2 + 3, { align: 'center' });
    textX = MARGIN + LOGO_SIZE + 6;
  }

  // Company name (small, uppercase)
  doc.setTextColor(255, 255, 255);
  if (companyName) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    // Slightly transparent look via color tint
    doc.setTextColor(220, 200, 215);
    doc.text(companyName.toUpperCase(), textX, LOGO_Y + 6);
    doc.setTextColor(255, 255, 255);
  }

  // Report title — large and bold
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, textX, LOGO_Y + (companyName ? 16 : 13));

  // Date & period — top right
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 200, 215);
  doc.text(dateStr, PAGE_W - MARGIN, LOGO_Y + 6, { align: 'right' });
  if (period) {
    doc.setTextColor(255, 255, 255);
    doc.text(period, PAGE_W - MARGIN, LOGO_Y + 14, { align: 'right' });
  }

  // "e-Cunga Portal" badge bottom-right of band
  doc.setFontSize(6.5);
  doc.setTextColor(200, 180, 210);
  doc.text('e-Cunga Portal', PAGE_W - MARGIN, BAND_H - 3, { align: 'right' });

  y = BAND_H + 4;

  // ── Subtitle strip ─────────────────────────────────────────────────────
  if (subtitle) {
    doc.setFillColor(...hex(C.primaryLight));
    doc.rect(0, y, PAGE_W, 8, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...hex(C.primary));
    doc.text(subtitle, MARGIN, y + 5.5);
    y += 11;
  }

  // Separator rule
  doc.setDrawColor(...hex(C.border));
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // Reset defaults
  doc.setTextColor(...hex(C.ink));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setDrawColor(...hex(C.border));
  doc.setLineWidth(0.2);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LAYOUT HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function guard(needed = 8) {
    if (y + needed > PAGE_H - 16) {
      doc.addPage();
      y = MARGIN;
      // Continuation page mini-header
      doc.setFillColor(...hex(C.primary));
      doc.rect(0, 0, PAGE_W, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`${title} (cont.)`, MARGIN, 5.5);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(companyName || 'e-Cunga', PAGE_W - MARGIN, 5.5, { align: 'right' });
      y = 14;
      doc.setTextColor(...hex(C.ink));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setDrawColor(...hex(C.border));
      doc.setLineWidth(0.2);
    }
  }

  // ── Section heading with left accent bar ────────────────────────────────
  function section(text, opts = {}) {
    spacer(opts.topSpace ?? 4);
    guard(14);
    // Left accent bar
    doc.setFillColor(...hex(C.primary));
    doc.rect(MARGIN, y, 2.5, 9, 'F');
    // Heading text
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hex(C.ink));
    doc.text(text.toUpperCase(), MARGIN + 5, y + 6.5);
    // Right count/badge if provided
    if (opts.count != null) {
      doc.setFillColor(...hex(C.primaryLight));
      const badge = `${opts.count}`;
      const bw = badge.length * 3 + 6;
      doc.roundedRect(PAGE_W - MARGIN - bw, y + 1, bw, 7, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...hex(C.primary));
      doc.text(badge, PAGE_W - MARGIN - bw / 2, y + 6, { align: 'center' });
    }
    y += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hex(C.ink));
  }

  // ── KPI highlight card row (up to 4 per row) ────────────────────────────
  // Each card: { label, value, sub?, color? }
  function kpiRow(cards) {
    guard(22);
    const n    = Math.min(cards.length, 4);
    const gap  = 3;
    const cw   = (CONTENT_W - gap * (n - 1)) / n;
    let cx     = MARGIN;

    cards.slice(0, 4).forEach((card) => {
      const bg  = card.bg || C.primaryLight;
      const col = card.color || C.primary;
      doc.setFillColor(...hex(bg));
      doc.roundedRect(cx, y, cw, 18, 2, 2, 'F');
      // Left accent line
      doc.setFillColor(...hex(col));
      doc.rect(cx, y, 2, 18, 'F');
      // Value — large
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...hex(col));
      doc.text(String(card.value ?? '—'), cx + cw / 2, y + 10, { align: 'center' });
      // Label — small below
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...hex(C.ink3));
      doc.text(String(card.label), cx + cw / 2, y + 15, { align: 'center' });
      // Sub badge if given
      if (card.sub) {
        doc.setFontSize(5.5);
        doc.setTextColor(...hex(C.muted));
        doc.text(String(card.sub), cx + cw / 2, y + 17.5, { align: 'center' });
      }
      cx += cw + gap;
    });

    y += 22;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hex(C.ink));
    doc.setFontSize(9);
  }

  // ── Full grid table ──────────────────────────────────────────────────────
  function table(headers, rows, opts = {}) {
    if (!headers.length && !rows.length) return;
    guard(16);

    const widths    = opts.colWidths || headers.map(() => CONTENT_W / headers.length);
    const totalW    = widths.reduce((s, w) => s + w, 0);
    const headerBg  = opts.headerBg || C.primary;
    const HEADER_H  = 7.5;
    const ROW_H     = 6.5;

    // Table header
    doc.setFillColor(...hex(headerBg));
    doc.rect(MARGIN, y, totalW, HEADER_H, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    let x = MARGIN + 2;
    headers.forEach((h, i) => {
      const maxW = widths[i] - 3;
      const txt  = doc.splitTextToSize(String(h), maxW)[0] || '';
      doc.text(txt, x, y + 5.2);
      x += widths[i];
    });
    y += HEADER_H;

    // Data rows
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');

    rows.forEach((row, ri) => {
      guard(ROW_H + 2);

      // Alternating row bg
      if (ri % 2 === 1) {
        doc.setFillColor(...hex(C.rowAlt));
        doc.rect(MARGIN, y, totalW, ROW_H, 'F');
      }

      // Highlight row option (e.g. critical items)
      if (opts.highlight && opts.highlight(row, ri)) {
        doc.setFillColor(...hex(C.amberLight));
        doc.rect(MARGIN, y, totalW, ROW_H, 'F');
      }

      doc.setTextColor(...hex(C.ink2));
      x = MARGIN + 2;

      row.forEach((cell, ci) => {
        const maxW = widths[ci] - 3;
        const raw  = String(cell ?? '—');

        // Colour-coded status chips for common status strings
        const lower = raw.toLowerCase();
        let chipColor = null;
        if (['critical','rejected','expired','out of stock','overdue'].includes(lower))
          chipColor = C.red;
        else if (['warning','pending','low stock','partial','draft'].includes(lower))
          chipColor = C.amber;
        else if (['approved','paid','active','closed','delivered','ok','stable'].includes(lower))
          chipColor = C.green;
        else if (['submitted','in progress','proforma','sent'].includes(lower))
          chipColor = C.blue;

        if (chipColor) {
          const chipBg = chipColor === C.red   ? C.redLight
                       : chipColor === C.amber ? C.amberLight
                       : chipColor === C.green ? C.greenLight
                       : C.blueLight;
          const chipW = Math.min(widths[ci] - 4, raw.length * 1.8 + 4);
          doc.setFillColor(...hex(chipBg));
          doc.roundedRect(x - 1, y + 0.8, chipW, 4.8, 1, 1, 'F');
          doc.setTextColor(...hex(chipColor));
          doc.text(raw, x, y + 4.5);
          doc.setTextColor(...hex(C.ink2));
        } else {
          const txt = doc.splitTextToSize(raw, maxW)[0] || '';
          doc.text(txt, x, y + 4.5);
        }

        x += widths[ci];
      });

      y += ROW_H;
    });

    // Bottom border
    doc.setDrawColor(...hex(C.border));
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y, MARGIN + totalW, y);
    y += 4;

    // Reset
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hex(C.ink));
    doc.setFontSize(9);
  }

  // ── Key / Value line ─────────────────────────────────────────────────────
  function kv(label, value, opts = {}) {
    guard(7);
    // Light row bg
    if (opts.shaded) {
      doc.setFillColor(...hex(C.rowAlt));
      doc.rect(MARGIN, y - 1, CONTENT_W, 7, 'F');
    }
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hex(C.muted));
    doc.text(String(label), MARGIN, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hex(opts.valueColor || C.ink));
    doc.text(String(value ?? '—'), PAGE_W - MARGIN, y + 4, { align: 'right' });
    y += 7;
  }

  // ── Alert / callout box ──────────────────────────────────────────────────
  function callout(text, type = 'info') {
    guard(14);
    const colors = {
      info:    { bg: C.blueLight,  border: C.blue,  text: C.blue  },
      warn:    { bg: C.amberLight, border: C.amber, text: C.amber },
      danger:  { bg: C.redLight,   border: C.red,   text: C.red   },
      success: { bg: C.greenLight, border: C.green, text: C.green },
    };
    const col = colors[type] || colors.info;
    const h   = 10;
    doc.setFillColor(...hex(col.bg));
    doc.roundedRect(MARGIN, y, CONTENT_W, h, 2, 2, 'F');
    doc.setFillColor(...hex(col.border));
    doc.rect(MARGIN, y, 2.5, h, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hex(col.text));
    const lines = doc.splitTextToSize(text, CONTENT_W - 12);
    doc.text(lines[0] || '', MARGIN + 6, y + 6.5);
    y += h + 3;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hex(C.ink));
    doc.setFontSize(9);
  }

  // ── Plain paragraph ──────────────────────────────────────────────────────
  function para(text, opts = {}) {
    guard(8);
    doc.setFontSize(opts.size || 8.5);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(...hex(opts.color || C.ink2));
    const lines = doc.splitTextToSize(String(text), CONTENT_W);
    lines.forEach((line) => {
      guard(6);
      doc.text(line, MARGIN, y);
      y += 5;
    });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hex(C.ink));
    doc.setFontSize(9);
  }

  // ── Horizontal divider ───────────────────────────────────────────────────
  function divider() {
    guard(6);
    doc.setDrawColor(...hex(C.border));
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
    y += 6;
  }

  // ── Spacer ───────────────────────────────────────────────────────────────
  function spacer(mm = 4) { y += mm; }

  // ── Footer (called by save) ──────────────────────────────────────────────
  function applyFooter() {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      // Footer band
      doc.setFillColor(...hex(C.primaryDark));
      doc.rect(0, PAGE_H - 11, PAGE_W, 11, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 185, 210);
      doc.text('e-Cunga Portal — Empowering digital procurement and inventory solutions', MARGIN, PAGE_H - 4);
      doc.setTextColor(255, 255, 255);
      doc.text(`Page ${p} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' });
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function save(filename) {
    applyFooter();
    const out = /\.pdf$/i.test(filename) ? filename : `${filename}.pdf`;
    doc.save(out);
  }

  return {
    doc,
    section,
    kpiRow,
    table,
    kv,
    callout,
    para,
    divider,
    spacer,
    save,
    footer: applyFooter,
    get y() { return y; },
    set y(v) { y = v; },
  };
}

export { toDataUrl as fetchLogoDataUrl };
