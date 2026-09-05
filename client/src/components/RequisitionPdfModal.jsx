import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { DownloadIcon } from './Icons.jsx';
import ui from '../pages/app/DashboardUi.module.css';

export const REQUISITION_PDF_CONTENT_ID = 'requisition-pdf-content';

/** Letter is always on white — use fixed light tokens so PDF matches preview in any app theme. */
const PDF_FONT_STACK = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
const PDF_MUTED = '#83737a';
const PDF_PRIMARY = '#692751';
const PDF_PRIMARY_DARK = '#121c2a';

function requisitionLineQuantity(line) {
  const raw = line?.quantity ?? line?.quantityRequested;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function scrollPdfAncestorsToTop(el) {
  let n = el;
  while (n && n !== document.body) {
    if (n.scrollTop) n.scrollTop = 0;
    n = n.parentElement;
  }
}

function localFallbackLogoHref() {
  try {
    return new URL('/e-Cunga.webp', window.location.href).href;
  } catch {
    return '/e-Cunga.webp';
  }
}

function shouldSwapLogoForExport(src) {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false;
  try {
    const u = new URL(src, window.location.href);
    return u.origin !== window.location.origin;
  } catch {
    return true;
  }
}

/** Vector-safe “E” mark for PDF when images are stripped or fail — always rasterises. */
function injectLetterLogoMarkIntoSlot(slot, doc) {
  if (!slot || !doc) return;
  slot.replaceChildren();
  const mark = doc.createElement('div');
  mark.setAttribute('data-requisition-pdf-logo-mark', '1');
  mark.textContent = 'E';
  mark.style.cssText = [
    'box-sizing:border-box',
    'width:60px',
    'height:60px',
    `background:${PDF_PRIMARY}`,
    'border-radius:8px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'color:#ffffff',
    'font-weight:900',
    'font-size:1.8rem',
    `font-family:${PDF_FONT_STACK}`,
    'flex-shrink:0',
    'line-height:1',
  ].join(';');
  slot.appendChild(mark);
}

async function waitForImages(root) {
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve();
          else {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }
        })
    )
  );
  await Promise.all(imgs.map((img) => img.decode?.().catch?.(() => {}) || Promise.resolve()));
}

function canvasToPdfPages(canvas, pdf, reqId) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/png', 1.0);

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Requisition_${reqId}.pdf`);
    return;
  }

  const pageCanvas = document.createElement('canvas');
  const pageCtx = pageCanvas.getContext('2d');
  if (!pageCtx) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Requisition_${reqId}.pdf`);
    return;
  }

  const pageCanvasWidth = canvas.width;
  const pageCanvasHeight = Math.floor((canvas.width * pageHeight) / pageWidth);
  pageCanvas.width = pageCanvasWidth;
  pageCanvas.height = pageCanvasHeight;

  const totalPages = Math.ceil(canvas.height / pageCanvasHeight);
  for (let page = 0; page < totalPages; page += 1) {
    const sy = page * pageCanvasHeight;
    pageCtx.fillStyle = '#ffffff';
    pageCtx.fillRect(0, 0, pageCanvasWidth, pageCanvasHeight);
    pageCtx.drawImage(canvas, 0, sy, pageCanvasWidth, pageCanvasHeight, 0, 0, pageCanvasWidth, pageCanvasHeight);
    const pageImg = pageCanvas.toDataURL('image/png', 1.0);
    if (page > 0) pdf.addPage();
    pdf.addImage(pageImg, 'PNG', 0, 0, pageWidth, pageHeight);
  }
  pdf.save(`Requisition_${reqId}.pdf`);
}

async function fetchImageAsDataUrl(src, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      img.onload = img.onerror = null;
      resolve(null);
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

async function captureLetterToCanvas(source, { stripAllImages, logoDataUrl }) {
  return html2canvas(source, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    imageTimeout: 20000,
    foreignObjectRendering: false,
    scrollX: 0,
    scrollY: 0,
    onclone: (_doc, cloned) => {
      if (!(cloned instanceof HTMLElement)) return;
      cloned.style.minHeight = 'auto';
      cloned.style.height = 'auto';
      cloned.style.maxHeight = 'none';
      cloned.style.boxSizing = 'border-box';
      cloned.style.fontFamily = PDF_FONT_STACK;

      const logoSlot = cloned.querySelector('[data-requisition-logo-slot]');

      if (stripAllImages) {
        cloned.querySelectorAll('img').forEach((img) => {
          img.src =
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          img.width = 0;
          img.height = 0;
          img.style.opacity = '0';
        });
        if (logoSlot) injectLetterLogoMarkIntoSlot(logoSlot, cloned.ownerDocument);
        return;
      }

      // Replace every external image src with pre-fetched data URLs or local fallback
      cloned.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || img.currentSrc || img.src || '';
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;

        // If we pre-fetched a data URL for the logo, use it
        if (
          logoDataUrl &&
          img.hasAttribute('data-requisition-letter-logo-img')
        ) {
          img.src = logoDataUrl;
          img.removeAttribute('crossorigin');
          return;
        }

        // Any remaining cross-origin image — swap to local fallback
        if (shouldSwapLogoForExport(src)) {
          img.removeAttribute('crossorigin');
          img.src = localFallbackLogoHref();
        }
      });

      if (logoSlot) {
        const hasMark = logoSlot.querySelector(
          '[data-requisition-letter-logo-fallback],[data-requisition-pdf-logo-mark]'
        );
        if (!hasMark) {
          const headerImg = logoSlot.querySelector('img');
          // If logo data url was set, the img is now valid — don't replace it
          const imgUnusable =
            !headerImg ||
            headerImg.style.display === 'none' ||
            (headerImg.complete && headerImg.naturalWidth === 0 && !logoDataUrl);
          if (imgUnusable) injectLetterLogoMarkIntoSlot(logoSlot, cloned.ownerDocument);
        }
      }
    },
  });
}

function fallbackTextOnlyPdf(req) {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Requisition', 20, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`ID: ${req?.id || ''}`, 20, 32);
  doc.text('PDF export failed — open preview and use Print to PDF.', 20, 44);
  doc.save(`Requisition_${req?.id || 'export'}.pdf`);
}

/**
 * Rasterises the same DOM as the modal preview (##requisition-pdf-content) so the download matches WYSIWYG.
 */
export function downloadRequisitionPdf(req) {
  const run = async () => {
    await document.fonts?.ready?.catch?.(() => {});
    const source = document.getElementById(REQUISITION_PDF_CONTENT_ID);
    if (!source) {
      fallbackTextOnlyPdf(req);
      return;
    }

    // Pre-fetch the logo as a base64 data URL so html2canvas never hits a cross-origin request
    let logoDataUrl = null;
    const logoImg = source.querySelector('[data-requisition-letter-logo-img]');
    const logoSrc = logoImg?.getAttribute('src') || logoImg?.currentSrc || logoImg?.src || '';
    if (logoSrc && shouldSwapLogoForExport(logoSrc)) {
      logoDataUrl = await fetchImageAsDataUrl(logoSrc);
      // If Cloudinary CORS blocks it, try via a proxy-style cache-bust
      if (!logoDataUrl) {
        const busted = logoSrc.includes('?') ? `${logoSrc}&_cb=${Date.now()}` : `${logoSrc}?_cb=${Date.now()}`;
        logoDataUrl = await fetchImageAsDataUrl(busted);
      }
    }

    const exportOnce = async (stripAllImages) => {
      scrollPdfAncestorsToTop(source);
      await waitForImages(source);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await captureLetterToCanvas(source, { stripAllImages, logoDataUrl });
      const opaqueCanvas = document.createElement('canvas');
      opaqueCanvas.width = canvas.width;
      opaqueCanvas.height = canvas.height;
      const opaqueCtx = opaqueCanvas.getContext('2d');
      if (opaqueCtx) {
        opaqueCtx.fillStyle = '#ffffff';
        opaqueCtx.fillRect(0, 0, opaqueCanvas.width, opaqueCanvas.height);
        opaqueCtx.drawImage(canvas, 0, 0);
      }
      const finalCanvas = opaqueCtx ? opaqueCanvas : canvas;
      finalCanvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      canvasToPdfPages(finalCanvas, pdf, req.id);
    };

    try {
      await exportOnce(false);
    } catch (e) {
      console.warn('[requisition-pdf] retrying without images (cross-origin or raster error)', e);
      await exportOnce(true);
    }
  };

  run().catch((e) => {
    console.error('[requisition-pdf]', e);
    fallbackTextOnlyPdf(req);
  });
}

export function RequisitionPdfModal({ isOpen, req, onClose, onDownload, users = [], company = null }) {
  const rawLetterLogo = String(
    company?.logoUrl || company?.logo || company?.logoURI || req?.buyerLogoUrl || ''
  ).trim();
  const letterSrc = rawLetterLogo || '/e-Cunga.webp';

  const [letterLogoBroken, setLetterLogoBroken] = useState(false);
  useEffect(() => {
    if (!isOpen || !req) return;
    setLetterLogoBroken(false);
  }, [isOpen, req?.id, letterSrc]);

  if (!isOpen || !req) return null;

  const clerkUser = users.find((u) => String(u.id) === String(req.clerkId));
  const clerkNameStored = String(req.clerkName || '').trim();
  const clerk = {
    name: clerkNameStored || clerkUser?.fullName || clerkUser?.name || '—',
    department: clerkUser?.team || clerkUser?.location || req.requestingDepartment || 'General Stores',
  };
  const requesterRoleLabel = clerkUser?.jobTitle?.trim()
    ? clerkUser.jobTitle.trim()
    : clerkUser?.role === 'admin'
      ? 'Administrator'
      : clerkUser?.role === 'supervisor'
        ? 'Supervisor'
        : 'Requester / Inventory Clerk';

  const reviewerUser = req.reviewedById
    ? users.find((u) => String(u.id) === String(req.reviewedById))
    : null;
  const reviewedNameStored = String(req.reviewedByName || '').trim();
  const fallbackSupervisor = users.find((u) => u.role === 'supervisor');
  const awaitingSupervisor = req.status === 'submitted';
  const authorizerName =
    reviewedNameStored ||
    reviewerUser?.fullName ||
    reviewerUser?.name ||
    (!awaitingSupervisor ? fallbackSupervisor?.fullName || fallbackSupervisor?.name || '' : '');
  const authorizerNameDisplay = authorizerName || (awaitingSupervisor ? 'Pending approval' : '—');

  const reviewedRole = String(req.reviewedByRole || reviewerUser?.role || '').toLowerCase();
  const authorizerRoleLabel = awaitingSupervisor && !reviewedNameStored && !req.reviewedById
    ? 'Awaiting supervisor sign-off'
    : reviewedRole === 'admin'
      ? 'Authorizing administrator'
      : reviewedRole === 'supervisor'
        ? 'Authorizing supervisor'
        : reviewerUser?.role === 'admin'
          ? 'Authorizing administrator'
          : reviewerUser?.role === 'supervisor'
            ? 'Authorizing supervisor'
            : 'Authorizing approver';

  const companyName = company?.name || company?.companyName || req.buyerCompanyName || '—';

  const statusLabels = {
    submitted: 'Pending supervisor approval',
    pending: 'Pending supervisor approval',
    approved: 'Approved by Supervisor',
    sentToSupplier: 'Sent to supplier',
    proformaAwaitingClerk: 'Proforma — awaiting clerk',
    proformaReceived: 'Proforma received',
    proformaApproved: 'Proforma approved',
    paid: 'Payment completed',
    creditPurchase: 'Credit purchase',
    creditAndPaid: 'Credit settled',
    deliveryNoteAttached: 'Delivery note attached',
    closed: 'Completed',
    rejected: 'Rejected',
  };
  const displayStatus = statusLabels[req.status] || req.status;

  return (
    <div className={ui.modalOverlay} role="dialog" aria-modal="true" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className={ui.modalCard}
        style={{ maxWidth: '850px', height: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '1.2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={ui.modalHead} style={{ padding: '1.5rem 2rem' }}>
          <div>
            <h2 className={ui.modalTitle} style={{ fontSize: '1.4rem' }}>
              Requisition Preview
            </h2>
            <p className={ui.modalSubtitle} style={{ fontSize: '0.9rem', color: 'var(--ec-muted)' }}>
              {req.id} • Professional PDF Format
            </p>
          </div>
          <button type="button" className={ui.modalClose} onClick={onClose} style={{ fontSize: '1.8rem' }}>
            ×
          </button>
        </div>

        <div className={ui.modalBody} style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', background: '#f1f5f9' }}>
          <div
            id={REQUISITION_PDF_CONTENT_ID}
            style={{
              background: 'white',
              padding: '4rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              minHeight: 'auto',
              fontFamily: PDF_FONT_STACK,
              color: '#0f172a',
              borderRadius: '2px',
              position: 'relative',
            }}
          >
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '3rem',
                  borderBottom: '1px solid #e5e7eb',
                  paddingBottom: '2rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    data-requisition-logo-slot
                    style={{
                      width: '60px',
                      minHeight: '60px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                    }}
                  >
                    {letterLogoBroken ? (
                      <div
                        data-requisition-letter-logo-fallback
                        style={{
                          width: '60px',
                          height: '60px',
                          background: PDF_PRIMARY,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '1.8rem',
                          lineHeight: 1,
                          fontFamily: PDF_FONT_STACK,
                        }}
                      >
                        E
                      </div>
                    ) : (
                      <img
                        data-requisition-letter-logo-img
                        src={letterSrc}
                        alt={rawLetterLogo ? companyName : 'e-Cunga'}
                        style={{
                          width: '60px',
                          height: 'auto',
                          maxHeight: '60px',
                          objectFit: 'contain',
                          borderRadius: '4px',
                          display: 'block',
                        }}
                        onError={() => setLetterLogoBroken(true)}
                      />
                    )}
                  </div>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{companyName}</h1>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: PDF_MUTED, letterSpacing: '0.1em' }}>
                      {clerk.department || req.requestingDepartment || 'General Stores'}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: PDF_PRIMARY_DARK }}>REQUISITION FORM</h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: PDF_MUTED }}>Ref: {req.id}</p>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '2rem',
                  marginBottom: '3rem',
                  fontSize: '0.9rem',
                }}
              >
                <div>
                  <p style={{ margin: '0 0 0.5rem', color: '#111827', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Requesting Entity
                  </p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{clerk.department || 'General Stores'}</p>
                  <p style={{ margin: '0.25rem 0 0', color: '#374151' }}>Clerk: {clerk.name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 0.5rem', color: '#111827', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Fulfillment Details
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Date:</strong> {new Date(req.requestedAt || req.createdAt).toLocaleDateString()}
                  </p>
                  <p style={{ margin: '0.25rem 0 0', color: PDF_PRIMARY, fontWeight: 700 }}>Status: {displayStatus}</p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '3rem' }}>
                <thead>
                  <tr style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', width: '50px' }}>No.</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Description & Specifications</th>
                    <th style={{ padding: '1rem', textAlign: 'center', width: '80px' }}>Qty</th>
                    <th style={{ padding: '1rem', textAlign: 'center', width: '80px' }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {(req.lines || []).map((line, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '1rem', color: '#111827', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{line.description}</td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700 }}>
                        {requisitionLineQuantity(line)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', color: '#111827', fontWeight: 700 }}>{line.unit || 'Units'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', fontSize: '0.85rem', color: '#475569', marginBottom: '5rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Justification & Purpose</p>
                  <p
                    style={{
                      margin: 0,
                      fontStyle: 'italic',
                      background: '#ffffff',
                      padding: '1rem',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    &ldquo;{req.clerkJustification || 'No justification provided.'}&rdquo;
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '4rem',
                  gap: '4rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ borderBottom: '1px solid #9ca3af', marginBottom: '0.5rem', height: '40px' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{clerk.name}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#374151' }}>{requesterRoleLabel}</p>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ borderBottom: '1px solid #9ca3af', marginBottom: '0.5rem', height: '40px' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{authorizerNameDisplay}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#374151' }}>{authorizerRoleLabel}</p>
                </div>
              </div>

              <div
                style={{
                  marginTop: '3rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid #e5e7eb',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: PDF_MUTED,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                eCunga Portal-Empowering digital procurement and inventory solutions
              </div>
            </div>
          </div>
        </div>

        <div
          className={ui.modalActions}
          style={{
            padding: '2rem',
            background: 'white',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'center',
            gap: '1.25rem',
            marginTop: 0,
          }}
        >
          <button
            type="button"
            className={ui.modalSecondaryBtn}
            onClick={onClose}
            style={{
              width: '210px',
              height: '48px',
              padding: '0',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#475569',
              border: '2px solid #e2e8f0',
              background: '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
          >
            Close Preview
          </button>
          <button
            type="button"
            className={ui.modalPrimaryBtn}
            style={{
              width: '210px',
              height: '48px',
              padding: '0',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.55rem',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
            onClick={() => onDownload(req)}
          >
            <DownloadIcon size={16} />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
