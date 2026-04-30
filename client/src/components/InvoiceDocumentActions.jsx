import ui from '../pages/app/DashboardUi.module.css';

/** Resolve stored attachment paths to a URL the browser can load (Cloudinary, /api paths, or /uploads). */
export function resolvePortalDocumentUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('/')) return t;
  const clean = t.replace(/^\/+/, '');
  return `/uploads/${clean}`;
}

const DOC_SLOTS = [
  { key: 'proforma', label: 'Proforma', pick: (inv) => inv.attachmentUrl },
  { key: 'delivery', label: 'Delivery note', pick: (inv) => inv.deliveryNoteUrl },
  { key: 'final', label: 'Final invoice', pick: (inv) => inv.finalInvoiceUrl },
];

export function DocumentViewerModal({ open, title, url, onClose }) {
  if (!open || !url) return null;
  return (
    <div className={ui.docViewerOverlay} onClick={onClose} role="presentation">
      <div
        className={ui.docViewerModal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-viewer-title"
      >
        <header className={ui.docViewerHead}>
          <h2 id="doc-viewer-title" className={ui.docViewerTitle}>
            {title || 'Document'}
          </h2>
          <button type="button" className={ui.docViewerClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={ui.docViewerBody}>
          <iframe title={title || 'Document'} src={url} className={ui.docViewerFrame} />
        </div>
        <footer className={ui.docViewerFoot}>
          <a href={url} target="_blank" rel="noopener noreferrer" className={ui.btnSecondary}>
            Open in new tab
          </a>
          <button type="button" className={ui.btnPrimary} onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Green pill buttons for proforma / delivery / final; opens preview via onPreview(resolvedUrl, label). */
export function InvoiceDocumentButtonGroup({ invoice, onPreview, className }) {
  return (
    <div className={`${ui.invoiceDocBtnRow} ${className || ''}`.trim()}>
      {DOC_SLOTS.map((slot) => {
        const raw = slot.pick(invoice);
        const resolved = resolvePortalDocumentUrl(raw);
        if (!resolved) {
          return (
            <span key={slot.key} className={ui.invoiceDocBtnDisabled} title="No file uploaded">
              {slot.label}
            </span>
          );
        }
        return (
          <button
            key={slot.key}
            type="button"
            className={ui.invoiceDocBtn}
            onClick={() => onPreview(resolved, slot.label)}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
