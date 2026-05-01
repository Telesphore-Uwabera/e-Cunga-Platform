import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
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

/**
 * Click the child to open a full-screen blurred backdrop and document preview (iframe),
 * or an awaiting message when `awaiting` is true. Close: ×, backdrop click, or Escape.
 */
export function DocumentHoverPreview({
  url,
  title,
  resolveUrl = resolvePortalDocumentUrl,
  children,
  awaiting = false,
  awaitingMessage = 'The document is not yet available...',
}) {
  const titleId = useId();
  const resolved = awaiting ? '' : url ? resolveUrl(String(url).trim()) : '';
  const [open, setOpen] = useState(false);

  const closeNow = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!awaiting && !resolved) return children;

  return (
    <>
      <span className={ui.docHoverTriggerWrap} onClick={() => setOpen(true)}>
        {children}
      </span>
      {open &&
        createPortal(
          <div
            className={ui.docHoverOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={closeNow}
          >
            <div className={ui.docHoverBackdrop} aria-hidden />
            <div className={ui.docHoverPanel} onClick={(e) => e.stopPropagation()}>
              <header className={ui.docHoverHead}>
                <h2 id={titleId} className={ui.docHoverTitle}>
                  {title || 'Document'}
                </h2>
                <button type="button" className={ui.docHoverClose} onClick={closeNow} aria-label="Close preview">
                  ×
                </button>
              </header>
              {awaiting ? (
                <div className={ui.docHoverAwaitingBody}>{awaitingMessage}</div>
              ) : (
                <>
                  <iframe title={title || 'Document'} src={resolved} className={ui.docHoverFrame} />
                  <footer className={ui.docHoverFoot}>
                    <a href={resolved} target="_blank" rel="noopener noreferrer" className={ui.docHoverLink}>
                      Open in new tab
                    </a>
                  </footer>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
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
