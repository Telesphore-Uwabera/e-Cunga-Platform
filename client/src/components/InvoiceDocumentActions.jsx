import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import ui from '../pages/app/DashboardUi.module.css';

/**
 * Fetches a file and triggers a browser download without opening a new tab.
 * Falls back to an anchor click if fetch fails (same-origin files).
 */
async function triggerFileDownload(url, filename) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch {
    // Fallback: anchor with download attribute (works for same-origin)
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

/** Resolve stored attachment paths to a URL the browser can load (Cloudinary, /api paths, or /uploads). */
export function resolvePortalDocumentUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) {
    // If it is a Cloudinary raw asset missing an extension, append .pdf so browsers handle it correctly
    if (t.includes('cloudinary.com') && t.includes('/raw/upload/') && !/\.[a-z0-9]+$/i.test(t)) {
      return `${t}.pdf`;
    }
    return t;
  }
  if (t.startsWith('/')) return t;
  const clean = t.replace(/^\/+/, '');
  return `/uploads/${clean}`;
}

const DOC_SLOTS = [
  { key: 'proforma', label: 'Proforma', pick: (inv) => inv.attachmentUrl },
  { key: 'delivery', label: 'Delivery note', pick: (inv) => inv.deliveryNoteUrl },
  { key: 'final', label: 'Final invoice', pick: (inv) => inv.finalInvoiceUrl },
  { key: 'paymentProof', label: 'Payment Proof', pick: (inv) => inv.paymentProofUrl },
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
        <div className={ui.docViewerBody} style={{ flex: 1, padding: '1.5rem', background: '#f1f5f9', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
          {url.match(/\.(webp|jpg|jpeg|png|gif|bmp)(\?|$)/i) || url.includes('/image/upload/') ? (
            <img src={url} alt={title || 'Document'} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
          ) : url.includes('cloudinary.com') ? (
            /* Cloudinary raw assets are cross-origin — browsers block iframes.
               Show a prominent open-in-tab prompt instead. */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>📄</div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                {title || 'Document'} is ready
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', maxWidth: '320px' }}>
                This document is hosted on a secure external server. Click below to open it in a new tab or download it directly.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '0.7rem 2rem', borderRadius: '0.6rem', background: 'var(--ec-primary)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                ↗ Open document
              </a>
            </div>
          ) : (
            <iframe title={title || 'Document'} src={url} className={ui.docViewerFrame} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
          )}
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
          <button
            type="button"
            className={ui.modalPrimaryBtn}
            onClick={() => triggerFileDownload(url, `${(title || 'Document').replace(/\s+/g, '_')}.pdf`)}
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
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 4v9m0 0 3.5-3.5M12 13l-3.5-3.5M5 18h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download PDF
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
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: '#f1f5f9', borderRadius: '8px', padding: '1rem' }}>
                  {resolved.match(/\.(webp|jpg|jpeg|png|gif|bmp)(\?|$)/i) || resolved.includes('/image/upload/') ? (
                    <img src={resolved} alt={title || 'Document'} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
                  ) : (
                    <iframe title={title || 'Document'} src={resolved} className={ui.docHoverFrame} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }} />
                  )}
                </div>
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
                    <button
                      type="button"
                      className={ui.modalPrimaryBtn}
                      onClick={() => triggerFileDownload(resolved, `${(title || 'Document').replace(/\s+/g, '_')}.pdf`)}
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
                        textTransform: 'uppercase',
                      }}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <path d="M12 4v9m0 0 3.5-3.5M12 13l-3.5-3.5M5 18h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Download PDF
                    </button>
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
