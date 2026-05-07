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
    <div className={ui.docViewerOverlay} onClick={onClose} role="presentation" style={{ zIndex: 15000 }}>
      <div
        className={ui.docViewerModal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-viewer-title"
        style={{ height: '95vh', borderRadius: '1.2rem', display: 'flex', flexDirection: 'column' }}
      >
        <header className={ui.docViewerHead} style={{ padding: '1.5rem 2rem' }}>
          <div>
            <h2 id="doc-viewer-title" className={ui.docViewerTitle} style={{ fontSize: '1.4rem' }}>
              {title || 'Document Preview'}
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>
              Professional Document Viewer
            </p>
          </div>
          <button type="button" className={ui.docViewerClose} onClick={onClose} aria-label="Close" style={{ fontSize: '1.8rem' }}>
            ×
          </button>
        </header>
        <div className={ui.docViewerBody} style={{ flex: 1, padding: '1.5rem', background: '#f1f5f9', overflow: 'hidden' }}>
          <iframe title={title || 'Document'} src={url} className={ui.docViewerFrame} style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
        </div>
        <footer className={ui.modalActions} style={{ padding: '2rem', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', gap: '1.25rem' }}>
          <button
            type="button"
            className={ui.modalSecondaryBtn}
            onClick={onClose}
            style={{
              width: '210px',
              height: '48px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#475569',
              border: '2px solid #e2e8f0',
              background: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Close Preview
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={ui.modalPrimaryBtn}
            style={{
              width: '210px',
              height: '48px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.55rem',
              textDecoration: 'none',
              color: 'white',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 4v9m0 0 3.5-3.5M12 13l-3.5-3.5M5 18h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download PDF
          </a>
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
                  <iframe title={title || 'Document'} src={resolved} className={ui.docHoverFrame} style={{ borderRadius: '8px' }} />
                  <footer className={ui.modalActions} style={{ padding: '1.25rem', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <button
                      type="button"
                      className={ui.modalSecondaryBtn}
                      onClick={closeNow}
                      style={{
                        width: '180px',
                        height: '42px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: '#475569',
                        border: '2px solid #e2e8f0',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Close
                    </button>
                    <a
                      href={resolved}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ui.modalPrimaryBtn}
                      style={{
                        width: '180px',
                        height: '42px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        textDecoration: 'none',
                        color: 'white',
                        textTransform: 'uppercase',
                      }}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <path d="M12 4v9m0 0 3.5-3.5M12 13l-3.5-3.5M5 18h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Download PDF
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
          <div key={slot.key}>
            <button
              type="button"
              className={ui.invoiceDocBtn}
              onClick={() => onPreview(resolved, slot.label)}
              title={`View ${slot.label}`}
            >
              {slot.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
