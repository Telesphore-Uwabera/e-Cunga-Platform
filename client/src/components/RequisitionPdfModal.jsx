import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { DownloadIcon } from './Icons.jsx';
import ui from '../pages/app/DashboardUi.module.css';

export const REQUISITION_PDF_CONTENT_ID = 'requisition-pdf-content';

export function downloadRequisitionPdf(req) {
  const source = document.getElementById(REQUISITION_PDF_CONTENT_ID);
  if (!source) {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Requisition', 20, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`ID: ${req.id}`, 20, 32);
    doc.save(`Requisition_${req.id}.pdf`);
    return;
  }

  const run = async () => {
    const canvas = await html2canvas(source, {
      backgroundColor: '#ffffff',
      scale: Math.min(2, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false,
    });

    const opaqueCanvas = document.createElement('canvas');
    opaqueCanvas.width = canvas.width;
    opaqueCanvas.height = canvas.height;
    const opaqueCtx = opaqueCanvas.getContext('2d');
    if (opaqueCtx) {
      opaqueCtx.fillStyle = '#ffffff';
      opaqueCtx.fillRect(0, 0, opaqueCanvas.width, opaqueCanvas.height);
      opaqueCtx.drawImage(canvas, 0, 0);
    }

    const imgData = (opaqueCtx ? opaqueCanvas : canvas).toDataURL('image/png', 1.0);
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const srcCanvas = opaqueCtx ? opaqueCanvas : canvas;
    const imgHeight = (srcCanvas.height * imgWidth) / srcCanvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Requisition_${req.id}.pdf`);
      return;
    }

    const pageCanvas = document.createElement('canvas');
    const pageCtx = pageCanvas.getContext('2d');
    if (!pageCtx) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Requisition_${req.id}.pdf`);
      return;
    }

    const pageCanvasWidth = srcCanvas.width;
    const pageCanvasHeight = Math.floor((srcCanvas.width * pageHeight) / pageWidth);
    pageCanvas.width = pageCanvasWidth;
    pageCanvas.height = pageCanvasHeight;

    const totalPages = Math.ceil(srcCanvas.height / pageCanvasHeight);
    for (let page = 0; page < totalPages; page += 1) {
      const sy = page * pageCanvasHeight;
      pageCtx.fillStyle = '#ffffff';
      pageCtx.fillRect(0, 0, pageCanvasWidth, pageCanvasHeight);
      pageCtx.drawImage(srcCanvas, 0, sy, pageCanvasWidth, pageCanvasHeight, 0, 0, pageCanvasWidth, pageCanvasHeight);

      const pageImg = pageCanvas.toDataURL('image/png', 1.0);
      if (page > 0) pdf.addPage();
      pdf.addImage(pageImg, 'PNG', 0, 0, pageWidth, pageHeight);
    }

    pdf.save(`Requisition_${req.id}.pdf`);
  };

  run().catch(() => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Requisition', 20, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`ID: ${req.id}`, 20, 32);
    doc.save(`Requisition_${req.id}.pdf`);
  });
}

export function RequisitionPdfModal({ isOpen, req, onClose, onDownload, users = [], company = null }) {
  if (!isOpen || !req) return null;

  const clerkUser = users.find((u) => String(u.id) === String(req.clerkId));
  const clerk = {
    name: clerkUser?.fullName || clerkUser?.name || req.clerkName || 'Inventory Clerk',
    department: clerkUser?.team || clerkUser?.location || req.requestingDepartment || 'General Stores',
  };
  const supervisorUser = users.find((u) => u.role === 'supervisor');
  const supervisor = {
    name: supervisorUser?.fullName || supervisorUser?.name || 'Regional Supervisor',
  };

  const companyName = company?.name || company?.companyName || req.buyerCompanyName || '—';
  const companyLogo = company?.logoUrl || company?.logo || company?.logoURI || req.buyerLogoUrl || '';

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
              minHeight: '100%',
              fontFamily: 'Inter, system-ui, sans-serif',
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
                  <img
                    src={companyLogo || '/e-Cunga.webp'}
                    alt={companyLogo ? companyName : 'e-Cunga'}
                    style={{ width: '60px', height: 'auto', borderRadius: '4px' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      background: 'var(--ec-primary)',
                      borderRadius: '8px',
                      display: 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 900,
                      fontSize: '1.8rem',
                    }}
                  >
                    E
                  </div>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{companyName}</h1>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ec-muted)', letterSpacing: '0.1em' }}>
                      {clerk.department || req.requestingDepartment || 'General Stores'}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--ec-primary-dark)' }}>REQUISITION FORM</h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>Ref: {req.id}</p>
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
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--ec-primary)', fontWeight: 700 }}>Status: {displayStatus}</p>
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
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700 }}>{line.quantity}</td>
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
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#374151' }}>Requester / Inventory Clerk</p>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ borderBottom: '1px solid #9ca3af', marginBottom: '0.5rem', height: '40px' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{supervisor.name}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#374151' }}>Authorizing Supervisor</p>
                </div>
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
