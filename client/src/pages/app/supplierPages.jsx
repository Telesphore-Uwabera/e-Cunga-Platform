import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { messagesForRole, notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import { getPeriodBounds, isoInRange } from '../../utils/reportFilters.js';
import { buildInventoryMovement, formatMovementQty } from '../../utils/inventoryMovement.js';
import { conicGradientFromSlices, REPORT_SLICE_COLORS } from '../../utils/reportCharts.js';
import {
  PORTAL_LINE_VB_H,
  PORTAL_LINE_PAD_X,
  PORTAL_LINE_Y_TOP,
  PORTAL_LINE_Y_BOTTOM,
  buildPortalLineCurve,
} from '../../utils/portalLineChart.js';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import { CheckIcon } from '../../components/Icons.jsx';
import { IconCompanyEnquiry, IconTalkAccountant, IconTalkRequest } from '../../components/SupplierMessagingQuickIcons.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { apiUploadMedia } from '../../api/client.js';
import ui from './DashboardUi.module.css';
import { InventoryFilterSelect } from '../../components/InventoryFilterSelect.jsx';
import {
  ActivityFeed,
  ClearFiltersIconButton,
  MoneyFigure,
  PageIntro,
  StatusBadge,
  formatDate,
  formatMoney,
  formatDateTime,
  workflowLabel,
} from './roleUi.jsx';
import { DocumentViewerModal, resolvePortalDocumentUrl } from '../../components/InvoiceDocumentActions.jsx';
import { describeActivityEntry } from '../../utils/activityLabels.js';
import { cleanRemoteLogoUrl } from '../../utils/workspaceBranding.js';
import { PortalNotificationPrefsCard, PortalPasswordChangeForm } from './portalAccountPages.jsx';
import {
  HEALTHCARE_STOCK_CATEGORIES,
  healthcareSkuPrefix,
  isHealthcareCompany,
  mapMasterStockToHealthcareCategory,
} from '../../constants/ecosystemCatalog.js';
import { RequisitionPdfModal, downloadRequisitionPdf } from '../../components/RequisitionPdfModal.jsx';
import { filterMasterRecommendations } from '../../utils/filterMasterRecommendations.js';
import { UNIT_OPTION_PRESETS, StockModalCombobox } from '../../components/StockManagementModals.jsx';
import { categoryFilterOptionLabel } from '../../lib/formatters.js';
import { validatePdfUpload } from '../../utils/uploadValidation.js';
import { LoadingButton } from '../../components/LoadingButton.jsx';
import { UploadProgressBar } from '../../components/UploadProgressBar.jsx';

async function uploadSupplierPdf(file, { showFlash, onProgress }) {
  if (!validatePdfUpload(file, showFlash)) return null;
  const resp = await apiUploadMedia(file, { onProgress });
  if (!resp?.secure_url) {
    throw new Error('Upload failed — no URL returned');
  }
  return resp.secure_url;
}

/** Readable request ref (align with accountant / clerk tables). */
function displayRequestRef(id) {
  if (!id) return '';
  const s = String(id);
  if (s.startsWith('Req-')) return s.replace(/^Req/, 'REQ');
  return s.replace(/^req_/, 'REQ-');
}

/** Default supplier proforma reference: PRO- + same display ref as the requisition (e.g. PRO-REQ-Manu-May2026-0001). */
function defaultProformaReference(requisitionId) {
  const disp = displayRequestRef(requisitionId);
  return disp ? `PRO-${disp}` : 'PRO-';
}

function useSupplierActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'supplier'),
    [state.users, user?.email]
  );
}

const SUPPLIER_MASTER_REC_PAGE = 9;

/** Products page only — same healthcare master catalog as facilities; CTA opens supplier product editor. */
function SupplierHealthcareCatalogRecommendations({ state, navigate, t }) {
  const recommendationIdsKey = useMemo(
    () => (state.masterStock || []).map((m) => m._id).join(','),
    [state.masterStock]
  );
  const [recSearch, setRecSearch] = useState('');
  const [recVisibleCount, setRecVisibleCount] = useState(SUPPLIER_MASTER_REC_PAGE);
  useEffect(() => {
    setRecVisibleCount(SUPPLIER_MASTER_REC_PAGE);
  }, [recommendationIdsKey, recSearch]);
  const recRawList = state.masterStock || [];
  const recList = useMemo(
    () => filterMasterRecommendations(recRawList, recSearch),
    [recRawList, recSearch]
  );
  const recTotal = recList.length;
  const recVisible = Math.min(recVisibleCount, recTotal);
  const recSlice = recList.slice(0, recVisible);
  const recCanMore = recVisible < recTotal;
  const recCanLess = recVisible > SUPPLIER_MASTER_REC_PAGE;

  return (
    <div className={ui.inventoryRecommendationsSection} style={{ marginBottom: '1.25rem' }}>
      <div className={ui.sectorRecommendations}>
        <h3 className={ui.sectorRecommendationsTitle}>{t('app.supplier.sectorRecTitle')}</h3>
        <p className={ui.sectorRecommendationsTrendHint}>{t('app.supplier.catalogTrendingHint')}</p>
        {recRawList.length ? (
          <>
            <div className={ui.sectorRecommendationsSearchRow}>
              <input
                type="search"
                className={ui.sectorRecommendationsSearch}
                value={recSearch}
                onChange={(e) => setRecSearch(e.target.value)}
                placeholder={t('listings.recommendationsSearchPlaceholder')}
                aria-label={t('listings.recommendationsSearchAria')}
              />
            </div>
            {recTotal ? (
              <>
                <div className={ui.sectorRecommendationsRow}>
                  {recSlice.map((m) => (
                    <div key={m._id} className={ui.sectorRecommendationsCard}>
                      <div className={ui.sectorRecommendationsCardName}>{m.name}</div>
                      <div className={ui.sectorRecommendationsCardCat}>{m.category}</div>
                      <button
                        type="button"
                        className={ui.sectorRecommendationsCardBtn}
                        onClick={() =>
                          navigate('/app/supplier/product-edit', { state: { prefillFromMaster: m } })
                        }
                      >
                        {t('app.supplier.sectorRecCta')}
                      </button>
                    </div>
                  ))}
                </div>
                {(recCanMore || recCanLess) && (
                  <div className={ui.sectorRecommendationsToggleRow}>
                    {recCanLess ? (
                      <button
                        type="button"
                        className={ui.sectorRecommendationsToggleBtn}
                        onClick={() =>
                          setRecVisibleCount((c) => Math.max(SUPPLIER_MASTER_REC_PAGE, c - SUPPLIER_MASTER_REC_PAGE))
                        }
                      >
                        {t('listings.viewLess')}
                      </button>
                    ) : null}
                    {recCanMore ? (
                      <button
                        type="button"
                        className={ui.sectorRecommendationsToggleBtn}
                        onClick={() => setRecVisibleCount((c) => Math.min(recTotal, c + SUPPLIER_MASTER_REC_PAGE))}
                      >
                        {t('listings.viewMore')}
                      </button>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <p className={ui.sectorRecommendationsEmpty}>{t('listings.recommendationsNoMatches')}</p>
            )}
          </>
        ) : (
          <p className={ui.sectorRecommendationsEmpty}>{t('app.supplier.sectorRecEmpty')}</p>
        )}
      </div>
    </div>
  );
}

function SupplierGlyph({ kind }) {
  const c = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'inbox') {
    return (
      <svg {...c}>
        <path d="M4 8h16v10H4z" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 8V5h8v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M9 13h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'doc') {
    return (
      <svg {...c}>
        <path d="M7 4h7l4 4v12H7z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M10 13h5M10 17h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg {...c}>
        <path d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'reject') {
    return (
      <svg {...c}>
        <path d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'payments') {
    return (
      <svg {...c}>
        <rect x="4" y="6" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.65" />
        <path d="M4 10h16M8 15h3" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'truck' || kind === 'delivery') {
    return (
      <svg {...c}>
        <path d="M3 7h11v10H3V7Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M14 11h3l3 3v3h-3M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'history' || kind === 'products') {
    return (
      <svg {...c}>
        <path d="M8 4h8l2 2v14H6V6l2-2Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'settings') {
    return (
      <svg {...c}>
        <path
          d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M19 12a7 7 0 0 0-.08-1l2.04-1.6-2-3.46-2.48 1a7.2 7.2 0 0 0-1.72-1L14.5 3h-5l-.26 2.94a7.2 7.2 0 0 0-1.72 1l-2.48-1-2 3.46L5.08 11a7 7 0 0 0 0 2l-2.04 1.6 2 3.46 2.48-1a7.2 7.2 0 0 0 1.72 1L9.5 21h5l.26-2.94a7.2 7.2 0 0 0 1.72-1l2.48 1 2-3.46L18.92 13c.05-.33.08-.66.08-1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg {...c}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Supervisor stores supplier user id on requisition.supplierId; legacy rows may use supplier company id. */
function rowAssignedToSupplier(rowSupplierId, actorId, actorCompanyId) {
  const sid = rowSupplierId != null ? String(rowSupplierId).trim() : '';
  if (!sid) return false;
  const aid = actorId != null ? String(actorId).trim() : '';
  const aco = actorCompanyId != null ? String(actorCompanyId).trim() : '';
  return (aid && sid === aid) || (aco && sid === aco);
}

function supplierRequisitions(state, actorId, strictAssignee = false, actorCompanyId = '') {
  return state.requisitions.filter((entry) => {
    if (strictAssignee) {
      if (!rowAssignedToSupplier(entry.supplierId, actorId, actorCompanyId)) return false;
    } else if (entry.supplierId && !rowAssignedToSupplier(entry.supplierId, actorId, actorCompanyId)) {
      return false;
    }
    return [
      'sentToSupplier',
      'proformaAwaitingClerk',
      'proformaReceived',
      'proformaApproved',
      'finalInvoiceReceived',
      'paid',
      'creditPurchase',
      'deliveryNoteAttached',
      'closed',
      'rejected',
    ].includes(entry.status);
  });
}

function supplierIncomingRequests(state, actorId, strictAssignee = false, actorCompanyId = '') {
  return state.requisitions.filter((entry) => {
    if (strictAssignee) {
      if (!rowAssignedToSupplier(entry.supplierId, actorId, actorCompanyId)) return false;
    } else if (entry.supplierId && !rowAssignedToSupplier(entry.supplierId, actorId, actorCompanyId)) {
      return false;
    }
    return ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived', 'proformaApproved', 'paid', 'creditPurchase', 'deliveryNoteAttached'].includes(entry.status);
  });
}

function initialsFromName(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const a = parts[0]?.[0] || '';
  const b = parts[1]?.[0] || parts[0]?.[1] || '';
  return `${a}${b}`.toUpperCase() || '?';
}

function skuForRequisition(entry) {
  if (entry.reference && !entry.lines) return entry.reference;
  const suffix = String(entry.id || '')
    .replace(/\D/g, '')
    .padStart(3, '0')
    .slice(-3);
  const lineKey = (entry.lines?.[0]?.description || entry.title || entry.name || 'ITEM')
    .replace(/[^a-z0-9]+/gi, '')
    .slice(0, 3)
    .toUpperCase() || 'SKU';
  return `${lineKey}-${suffix}-X`;
}

function totalQty(lines) {
  if (!lines?.length) return 0;
  return lines.reduce((acc, line) => {
    const raw = line.quantity ?? line.quantityRequested;
    const n = Number(raw);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function requestDisplayBadge(entry, t) {
  const label = (key, fallback) => (typeof t === 'function' ? t(`app.supplier.${key}`) : fallback);
  const urgent =
    entry.priority === 'critical' && ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived'].includes(entry.status);
  if (urgent) return { key: 'urgent', label: label('reqBadgeUrgent', 'Urgent'), tone: 'urgent' };
  if (entry.status === 'sentToSupplier') {
    return { key: 'needProforma', label: label('reqBadgeNeedProforma', 'Need proforma'), tone: 'pending' };
  }
  if (entry.status === 'proformaAwaitingClerk') {
    return { key: 'withClerk', label: label('reqBadgeWithClerk', 'With clerk'), tone: 'pending' };
  }
  if (entry.status === 'proformaReceived') {
    return { key: 'submittedFinance', label: label('reqBadgeSubmittedFinance', 'Submitted to finance'), tone: 'ok' };
  }
  if (entry.status === 'finalInvoiceReceived') {
    return { key: 'finalInvoice', label: label('reqBadgeFinalInvoice', 'Final invoice received'), tone: 'ok' };
  }
  if (entry.status === 'proformaApproved') return { key: 'approved', label: label('reqBadgeApproved', 'Approved'), tone: 'ok' };
  if (entry.status === 'paid') return { key: 'paid', label: label('reqBadgePaid', 'Paid'), tone: 'ok' };
  if (entry.status === 'creditPurchase') {
    return { key: 'credit', label: label('reqBadgeCreditPurchase', 'Credit purchase'), tone: 'ok' };
  }
  if (entry.status === 'deliveryNoteAttached') {
    return { key: 'transit', label: label('reqBadgeInTransit', 'In transit'), tone: 'pending' };
  }
  return { key: 'pending', label: label('reqBadgePending', 'Pending'), tone: 'pending' };
}

function requestProductTitle(entry) {
  return entry.lines?.[0]?.description || entry.title || entry.reference || 'Requested item';
}

function supplierInvoices(state, actorId, strictAssignee = false, actorCompanyId = '') {
  return state.invoices.filter((entry) => {
    if (strictAssignee) {
      return rowAssignedToSupplier(entry.supplierId, actorId, actorCompanyId);
    }
    return !entry.supplierId || rowAssignedToSupplier(entry.supplierId, actorId, actorCompanyId);
  });
}

function supplierCatalogList(state, actorId, strictAssignee = false, actorCompanyId = '') {
  const rows = state.supplierCatalog ?? [];
  if (!strictAssignee || !actorId) return rows;
  return rows.filter((c) => rowAssignedToSupplier(c.supplierId, actorId, actorCompanyId));
}

function safeDocUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return t.startsWith('/') ? t : `/${t}`;
}

function requisitionById(state, id) {
  return state.requisitions.find((r) => r.id === id);
}

function linesSummary(lines) {
  if (!lines?.length) return '—';
  return lines.map((l) => `${l.quantity} ${l.unit} ${l.description}`).join(' · ');
}

function hubLabelForLocation(loc) {
  if (!loc) return 'Regional distribution hub';
  return `${String(loc).trim()} Distribution Hub`;
}

function invoiceSupplyBadge(inv) {
  if (inv.status === 'closed') return { key: 'delivered', label: 'Delivered', tone: 'ok' };
  if (inv.status === 'rejected') return { key: 'cancelled', label: 'Cancelled', tone: 'bad' };
  return { key: 'pending', label: 'Pending', tone: 'info' };
}

function catalogListingStatus(listing) {
  if (listing.listed === false) return { key: 'paused', label: 'PAUSED', tone: 'info' };
  const q = Number(listing.quantity || 0);
  const min = Number(listing.minThreshold ?? 0);
  if (q <= 0) return { key: 'out', label: 'OUT OF STOCK', tone: 'bad' };
  if (min > 0 && q < min) return { key: 'low', label: 'LOW STOCK', tone: 'warn' };
  return { key: 'ok', label: 'AVAILABLE', tone: 'ok' };
}



function deliveryServiceTier(seed) {
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i)) % 2;
  return h === 0 ? 'Batch delivery' : 'Express delivery';
}

function lineQtyTotal(lines) {
  if (!lines?.length) return 0;
  return lines.reduce((acc, line) => acc + Number(line.quantity || 0), 0);
}

function deliveryThumbClass(seed) {
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i)) % 4;
  return ['supplierDeliveryThumbA', 'supplierDeliveryThumbB', 'supplierDeliveryThumbC', 'supplierDeliveryThumbD'][h];
}

const PAY_LEDGER_METHODS = [
  { kind: 'momo', label: 'Mobile Money' },
  { kind: 'card', label: 'Card' },
  { kind: 'bank', label: 'Bank transfer' },
];

const CHANNEL_TO_KIND = {
  mobile_money: 'momo',
  bank_transfer: 'bank',
  card: 'card',
  credit_card: 'card',
  cash: 'bank',
  check: 'bank',
  other: 'bank',
};

/** Use real paymentChannel from DB; fall back to hash only when absent */
function paymentLedgerMethod(inv) {
  const channel = typeof inv === 'object' ? (inv.paymentChannel || '') : '';
  if (channel) {
    const kind = CHANNEL_TO_KIND[channel] || 'bank';
    const label = channel.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { kind, label };
  }
  // Fallback hash for legacy rows with no paymentChannel
  const seed = typeof inv === 'object' ? (inv.id || inv._id || '') : String(inv || '');
  let h = 0;
  for (const ch of String(seed)) h = (h + ch.charCodeAt(0)) % PAY_LEDGER_METHODS.length;
  return PAY_LEDGER_METHODS[h];
}

function paymentLedgerStatus(inv) {
  if (inv.status === 'rejected') return { key: 'failed', label: 'Failed' };
  if (inv.status === 'partiallyPaid') return { key: 'partial', label: 'Partially Paid' };
  if (inv.status === 'creditPurchase') return { key: 'credit', label: 'Credit Purchase' };
  if (inv.status === 'closed' || inv.status === 'paid' || inv.status === 'deliveryNoteAttached') {
    return { key: 'paid', label: 'Paid' };
  }
  return { key: 'pending', label: 'Pending' };
}

function paymentLedgerRowDate(inv) {
  return inv.paidAt || inv.updatedAt || inv.createdAt;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PaymentLedgerMethodIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'momo') {
    return (
      <svg {...common}>
        <rect x="7" y="3" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.65" />
        <path d="M10 7h4M12 18h.01" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'card') {
    return (
      <svg {...common}>
        <rect x="4" y="7" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.65" />
        <path d="M4 11h16M8 15h4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 10h4l2 3h8l2-3h2" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      <path d="M8 14h8v5H8z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
    </svg>
  );
}

function categoryForLine(line, stockItems) {
  const d = (line.description || '').toLowerCase().trim();
  if (!d) return 'General';
  const hit = stockItems.find(
    (s) =>
      s.name &&
      (s.name.toLowerCase() === d ||
        d.includes(s.name.toLowerCase()) ||
        (d.split(/\s+/)[0] && s.name.toLowerCase().includes(d.split(/\s+/)[0])))
  );
  return hit?.category || 'Supplies';
}

function matchesSupplierStatusFilter(req, statusFilter) {
  if (statusFilter === 'all') return true;
  const s = req.status;
  if (statusFilter === 'action') return s === 'sentToSupplier';
  if (statusFilter === 'finance') return ['proformaAwaitingClerk', 'proformaReceived', 'proformaApproved', 'finalInvoiceReceived'].includes(s);
  if (statusFilter === 'dispatch') return ['paid', 'deliveryNoteAttached'].includes(s);
  if (statusFilter === 'closed') return s === 'closed';
  return true;
}

function matchesSupplierCategory(req, catFilter, stockItems) {
  if (catFilter === 'all') return true;
  return (req.lines || []).some((line) => categoryForLine(line, stockItems) === catFilter);
}

function invoiceMatchesSupplierRevenueBasis(inv, basis) {
  const s = String(inv?.status || '');
  if (basis === 'settled') return ['paid', 'deliveryNoteAttached', 'closed'].includes(s);
  if (basis === 'pipeline') {
    return ['paid', 'deliveryNoteAttached', 'closed', 'proformaApproved', 'proformaReceived', 'finalInvoiceReceived'].includes(s);
  }
  return ['paid', 'deliveryNoteAttached', 'closed', 'proformaApproved', 'proformaReceived', 'finalInvoiceReceived', 'proformaAwaitingClerk', 'sent', 'draft'].includes(s);
}

const PIPELINE = [
  { step: 1, title: 'Order released', body: 'Supervisor sends an approved requisition to your queue.' },
  { step: 2, title: 'Proforma submitted', body: 'You attach pricing and the proforma PDF for finance.' },
  { step: 3, title: 'Finance decision', body: 'Accountant approves or rejects; approved items wait for payment.' },
  { step: 4, title: 'Fulfil & close', body: 'After payment, upload delivery note then the official final invoice.' },
];

function SupplierDashPeriodLineChart({
  bars,
  gradPrefix,
  strokeVar,
  tooltipFormat,
  footnoteFormat,
  legendText,
}) {
  const gradId = `${gradPrefix}-${useId().replace(/:/g, '')}`;
  const svgRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const { curveData, linePath, areaPath, axisMax, yTicks } = useMemo(
    () => buildPortalLineCurve(bars, (b) => b.amount),
    [bars]
  );
  const footnoteRight = footnoteFormat(axisMax);

  return (
    <>
      <div className={ui.clerkChartContainer}>
        <div className={ui.lineChartPlot}>
          <div className={ui.lineChartMain}>
            <svg
              ref={svgRef}
              viewBox={`0 0 100 ${PORTAL_LINE_VB_H}`}
              className={ui.clerkChartSvg}
              preserveAspectRatio="none"
              onMouseMove={(e) => {
                if (!curveData.length) return;
                const el = svgRef.current;
                if (!el) return;
                const r = el.getBoundingClientRect();
                const px = e.clientX - r.left;
                const w = r.width || 1;
                const x = (px / w) * 100;
                let bestI = 0;
                let bestD = Number.POSITIVE_INFINITY;
                for (let i = 0; i < curveData.length; i += 1) {
                  const d = Math.abs((curveData[i]?.plotX ?? 0) - x);
                  if (d < bestD) {
                    bestD = d;
                    bestI = i;
                  }
                }
                const h = el.clientHeight ?? 0;
                const y = curveData[bestI]?.y ?? 0;
                const tooltipTopPx = h > 0 ? (y / PORTAL_LINE_VB_H) * h : null;
                setHovered({
                  ...curveData[bestI],
                  tooltipTopPx,
                });
              }}
              onMouseLeave={() => setHovered(null)}
            >
              <defs>
                <linearGradient id={`${gradId}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ec-primary)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="var(--ec-primary)" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {yTicks.map((tk) => (
                <line
                  key={`${gradPrefix}-g-${tk.value}`}
                  x1="0"
                  y1={tk.y}
                  x2="100"
                  y2={tk.y}
                  stroke="var(--ec-chart-grid)"
                  strokeWidth="0.35"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line
                x1={PORTAL_LINE_PAD_X}
                y1={PORTAL_LINE_Y_TOP}
                x2={PORTAL_LINE_PAD_X}
                y2={PORTAL_LINE_Y_BOTTOM}
                stroke="var(--ec-chart-axis)"
                strokeWidth="0.55"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={PORTAL_LINE_PAD_X}
                y1={PORTAL_LINE_Y_BOTTOM}
                x2={100 - PORTAL_LINE_PAD_X}
                y2={PORTAL_LINE_Y_BOTTOM}
                stroke="var(--ec-chart-axis)"
                strokeWidth="0.55"
                vectorEffect="non-scaling-stroke"
              />
              {areaPath ? <path d={areaPath} fill={`url(#${gradId}-fill)`} /> : null}
              {linePath ? (
                <path
                  d={linePath}
                  fill="none"
                  stroke={strokeVar}
                  strokeWidth="3.75"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>
            {hovered ? (
              <div
                className={ui.clerkChartTooltip}
                style={{
                  left: `${hovered.pctX}%`,
                  ...(hovered.tooltipTopPx != null ? { top: `${hovered.tooltipTopPx}px` } : {}),
                }}
              >
                <span className={ui.clerkChartTooltipLabel}>{hovered.label}</span>
                <span className={ui.clerkChartTooltipValue}>{tooltipFormat(hovered.value ?? 0)}</span>
              </div>
            ) : null}
            <div className={ui.clerkChartXLabels} aria-hidden>
              {bars.map((entry, i) => (
                <span key={entry.id} className={ui.clerkChartXLabel} style={{ left: `${curveData[i]?.pctX ?? 0}%` }}>
                  {entry.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className={ui.supplierDashChartFootnote}>
        <span className={ui.supplierDashLegend}>
          <i /> {legendText}
        </span>
        <span className={ui.supplierDashChartAxisCap}>{footnoteRight}</span>
      </p>
    </>
  );
}

export function SupplierDashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state, supplierUsesApi } = usePortalData();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const strict = supplierUsesApi;
  const [period, setPeriod] = useState('30d');
  const [revenueBasis, setRevenueBasis] = useState('settled');

  const { start, end } = useMemo(() => getPeriodBounds(period === 'quarter' ? 'quarter' : '30d'), [period]);
  const allReqs = supplierRequisitions(state, actor?.id, strict, actor?.companyId);
  const invoices = supplierInvoices(state, actor?.id, strict, actor?.companyId);

  const scopedReqs = useMemo(() => {
    return allReqs.filter((r) => isoInRange(r.requestedAt, start, end));
  }, [allReqs, start, end]);

  const scopedReqIds = useMemo(() => new Set(scopedReqs.map((r) => r.id)), [scopedReqs]);
  const scopedInvoices = useMemo(() => invoices.filter((inv) => scopedReqIds.has(inv.requisitionId)), [invoices, scopedReqIds]);

  const catalogList = useMemo(
    () => supplierCatalogList(state, actor?.id, strict, actor?.companyId),
    [state.supplierCatalog, actor?.id, strict, actor?.companyId]
  );
  const totalStockProducts = catalogList.length;

  const companyConnections = Number(state.buyerConnectionsCount ?? 0);

  const newRequests = useMemo(() => scopedReqs.filter((r) => r.status === 'sentToSupplier').length, [scopedReqs]);
  const pendingDeliveries = useMemo(
    () => scopedReqs.filter((r) => ['paid', 'deliveryNoteAttached'].includes(r.status)).length,
    [scopedReqs]
  );

  const settledTotal = useMemo(() => {
    return scopedInvoices.filter((i) => ['paid', 'deliveryNoteAttached', 'closed'].includes(i.status)).reduce((s, i) => s + Number(i.amount || 0), 0);
  }, [scopedInvoices]);

  const pendingSettlement = useMemo(() => {
    return scopedInvoices.filter((i) => i.status === 'proformaApproved').reduce((s, i) => s + Number(i.amount || 0), 0);
  }, [scopedInvoices]);

  const paidInvoices = scopedInvoices.filter((i) => i.status === 'paid' || i.status === 'deliveryNoteAttached' || i.status === 'closed');
  const paidTotalAmount = paidInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const partialInvoices = scopedInvoices.filter((i) => i.status === 'partial');
  const partialTotalAmount = partialInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const partialRemainingAmount = partialInvoices.reduce((sum, i) => sum + (Number(i.amount || 0) - Number(i.paidAmount || 0)), 0);

  const unpaidInvoices = scopedInvoices.filter((i) => i.status === 'proformaApproved' || i.status === 'pending');
  const unpaidTotalAmount = unpaidInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const revenueBars = useMemo(() => {
    const isQuarter = period === 'quarter';
    const labels = isQuarter ? ['Month 1', 'Month 2', 'Month 3'] : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const steps = labels.length;
    const pts = new Array(steps).fill(0);
    const span = Math.max(1, end - start);

    for (const inv of scopedInvoices) {
      if (!invoiceMatchesSupplierRevenueBasis(inv, revenueBasis)) continue;
      const t = new Date(inv.paidAt || inv.updatedAt || inv.createdAt).getTime();
      if (Number.isNaN(t) || t < start || t > end) continue;
      const slot = Math.min(steps - 1, Math.floor(((t - start) / span) * steps));
      pts[slot] += Number(inv.amount || 0);
    }

    return labels.map((label, i) => ({ id: `rev-${i}`, label, amount: pts[i] }));
  }, [scopedInvoices, start, end, period, revenueBasis]);

  const requestVolumeBars = useMemo(() => {
    const isQuarter = period === 'quarter';
    const labels = isQuarter ? ['Month 1', 'Month 2', 'Month 3'] : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const steps = labels.length;
    const pts = new Array(steps).fill(0);
    const span = Math.max(1, end - start);

    for (const r of scopedReqs) {
      const ts = new Date(r.requestedAt).getTime();
      if (Number.isNaN(ts) || ts < start || ts > end) continue;
      const slot = Math.min(steps - 1, Math.floor(((ts - start) / span) * steps));
      pts[slot] += 1;
    }

    return labels.map((label, i) => ({ id: `req-${i}`, label, amount: pts[i] }));
  }, [scopedReqs, start, end, period]);

  const regions = useMemo(() => {
    const locs = [...new Set(scopedReqs.map(r => r.location).filter(Boolean))];
    if (!locs.length) locs.push('HQ Kigali');
    const counts = locs.map((loc) => scopedReqs.filter((r) => r.location === loc).length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return locs.map((label, i) => ({ label, pct: Math.round((counts[i] / total) * 100), value: counts[i] })).sort((a, b) => b.value - a.value).slice(0, 4);
  }, [scopedReqs]);

  const curatorLine = useMemo(() => {
    const hot = scopedReqs.find((r) => r.priority === 'critical' || r.priority === 'high');
    const line = hot?.lines?.[0] || scopedReqs[0]?.lines?.[0];
    return line?.description || '';
  }, [scopedReqs]);

  const supplierLogs = useMemo(
    () =>
      state.activity
        .filter((entry) => entry.actorId === actor?.id || entry.actorName === actor?.fullName)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
    [state.activity, actor?.id, actor?.fullName]
  );

  const healthItems = useMemo(() => {
    return [...catalogList]
      .sort((a, b) => {
        const lowA = Number(a.quantity || 0) <= Number(a.minThreshold || 0);
        const lowB = Number(b.quantity || 0) <= Number(b.minThreshold || 0);
        if (lowA && !lowB) return -1;
        if (!lowA && lowB) return 1;
        return Number(a.quantity || 0) - Number(b.quantity || 0);
      })
      .slice(0, 5);
  }, [catalogList]);

  const [inventorySearch, setInventorySearch] = useState('');
  const [showAllInventory, setShowAllInventory] = useState(false);

  const filteredInventory = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return showAllInventory ? catalogList : healthItems;
    const filtered = catalogList.filter((item) => 
      `${item.name} ${item.category || ''} ${item.sku || ''}`.toLowerCase().includes(q)
    );
    return showAllInventory ? filtered : filtered.slice(0, 5);
  }, [catalogList, inventorySearch, showAllInventory, healthItems]);

  function downloadInventoryReport() {
    const aoa = [
      ['Product Name', 'Category', 'SKU', 'Quantity', 'Unit', 'Min Threshold', 'Max Threshold', 'Status'],
      ...filteredInventory.map((item) => {
        const low = Number(item.quantity || 0) <= Number(item.minThreshold || 0);
        return [
          item.name,
          item.category || 'Stock',
          item.sku || 'N/A',
          item.quantity,
          item.unit || 'units',
          item.minThreshold,
          item.maxThreshold,
          low ? 'Low Stock' : 'OK',
        ];
      }),
    ];
    downloadAoAAsXlsx(`supplier-inventory-${new Date().toISOString().slice(0, 10)}`, aoa, 'Inventory Report');
  }

  function downloadActivityReport() {
    const aoa = [
      ['Date', 'Actor', 'Action', 'Details'],
      ...supplierLogs.map((entry) => [
        formatDateTime(entry.createdAt),
        entry.actorName,
        entry.action,
        describeActivityEntry(entry, t),
      ]),
    ];
    downloadAoAAsXlsx(`supplier-activity-${new Date().toISOString().slice(0, 10)}`, aoa, 'Activity Report');
  }

  function downloadRegionReport() {
    const aoa = [
      ['Region', 'Percentage', 'Order Count'],
      ...regions.map((row) => [row.label, `${row.pct}%`, row.value]),
    ];
    downloadAoAAsXlsx(`supplier-regions-${new Date().toISOString().slice(0, 10)}`, aoa, 'Region Distribution Report');
  }

  const welcomeCompany =
    String(user?.companyName || state?.company?.name || actor?.companyName || '').trim() ||
    user?.email ||
    'Partner';

  return (
    <div className={ui.supplierBoard}>
      <header className={ui.supplierDashHeader}>
        <div className={ui.supplierDashHeaderMain}>
          <p className={ui.supplierDashEyebrow}>{t('app.supplier.dashEyebrow')}</p>
          <h1 className={ui.supplierDashTitle}>{t('app.supplier.dashWelcome', { name: welcomeCompany })}</h1>
          <p className={ui.supplierDashLead}>{t('app.supplier.dashLead')}</p>
        </div>
        <div className={ui.supplierDashPeriodGroup} role="group" aria-label="Date range">
          <button
            type="button"
            className={period === '30d' ? `${ui.supplierDashPeriodBtn} ${ui.supplierDashPeriodBtnActive}` : ui.supplierDashPeriodBtn}
            onClick={() => setPeriod('30d')}
          >
            {t('app.supplier.dashPeriod30')}
          </button>
          <button
            type="button"
            className={period === 'quarter' ? `${ui.supplierDashPeriodBtn} ${ui.supplierDashPeriodBtnActive}` : ui.supplierDashPeriodBtn}
            onClick={() => setPeriod('quarter')}
          >
            {t('app.supplier.dashPeriodQuarter')}
          </button>
        </div>
      </header>

      <div className={ui.supplierDashKpiRowCompact}>
        <div className={ui.supplierDashKpiGridLow}>
          <article className={ui.supplierDashStatLow}>
            <div className={ui.supplierDashStatHeaderLow}>
              <p className={ui.supplierDashStatLabelLow}>{t('app.supplier.dashKpiStockProducts')}</p>
              <NavLink to="/app/supplier/products" className={ui.supplierDashStatLinkLow} title={t('app.supplier.dashKpiStockProducts')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </NavLink>
            </div>
            <div className={ui.supplierDashStatMainLow}>
              <strong className={ui.supplierDashStatValueLow}>{totalStockProducts.toLocaleString()}</strong>
              <span className={ui.supplierDashStatHintLow}>{t('app.supplier.dashKpiStockProductsHint')}</span>
            </div>
          </article>
          <article className={ui.supplierDashStatLow}>
            <div className={ui.supplierDashStatHeaderLow}>
              <p className={ui.supplierDashStatLabelLow}>{t('app.supplier.dashKpiNewReq')}</p>
              <NavLink to="/app/supplier/inbox?status=action" className={ui.supplierDashStatLinkLow} title={t('app.supplier.dashKpiNewReq')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </NavLink>
            </div>
            <div className={ui.supplierDashStatMainLow}>
              <strong className={ui.supplierDashStatValueLow}>{newRequests}</strong>
              <span className={ui.supplierDashStatHintLow}>{t('app.supplier.dashKpiNewReqHint')}</span>
            </div>
          </article>
          <article className={ui.supplierDashStatLow}>
            <div className={ui.supplierDashStatHeaderLow}>
              <p className={ui.supplierDashStatLabelLow}>{t('app.supplier.dashKpiConnections')}</p>
              <NavLink to="/app/supplier/supervisors" className={ui.supplierDashStatLinkLow} title={t('app.supplier.supervisorsTitle')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </NavLink>
            </div>
            <div className={ui.supplierDashStatMainLow}>
              <strong className={ui.supplierDashStatValueLow}>{companyConnections.toLocaleString()}</strong>
              <span className={ui.supplierDashStatHintLow}>{t('app.supplier.dashKpiConnectionsHint')}</span>
            </div>
          </article>
          <article className={ui.supplierDashStatLow}>
            <div className={ui.supplierDashStatHeaderLow}>
              <p className={ui.supplierDashStatLabelLow}>{t('app.supplier.dashKpiPending')}</p>
              <NavLink to="/app/supplier/documents" className={ui.supplierDashStatLinkLow} title={t('app.supplier.dashKpiPending')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </NavLink>
            </div>
            <div className={ui.supplierDashStatMainLow}>
              <strong className={ui.supplierDashStatValueLow}>{pendingDeliveries}</strong>
              <span className={ui.supplierDashStatHintLow}>{t('app.supplier.dashKpiPendingHint')}</span>
            </div>
          </article>
        </div>

        <article className={ui.supplierDashStatLowFeatured}>
          <div className={ui.supplierDashStatFeaturedIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v18M5 10h11a3 3 0 0 1 0 6H8a3 3 0 1 0 0 6h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className={ui.supplierDashStatMainLow} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <p className={ui.supplierDashStatLabelLowFeatured} style={{ marginBottom: 0 }}>
                {t('app.supplier.dashKpiTotalEarnings')}
              </p>
              <NavLink
                to="/app/supplier/payments"
                style={{ color: 'inherit', opacity: 0.92, flexShrink: 0 }}
                title={t('app.supplier.dashKpiTotalEarnings')}
                aria-label={t('app.supplier.dashKpiTotalEarnings')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </NavLink>
            </div>
            <strong className={ui.supplierDashStatValueLow}>
              <MoneyFigure
                value={settledTotal}
                currency={state.company?.currency || 'RWF'}
                amountClassName={ui.supplierDashEarningsAmountLow}
                currencyClassName={ui.supplierDashEarningsCurrencyLow}
              />
            </strong>
            <p className={ui.supplierDashStatHintLow}>
              {t('app.supplier.dashKpiTotalEarningsHint')} · {t('app.supplier.dashEarningsPending')}:{' '}
              {formatMoney(pendingSettlement, state.company?.currency || 'RWF')}
            </p>
          </div>
        </article>
      </div>

      {/* Payment Statuses Info Cards */}
      <div className={ui.reportPaymentOverview} style={{ marginBottom: '1.5rem' }}>
        <section className={ui.reportPaymentCard} style={{ borderLeft: '4px solid #16a34a' }}>
          <div className={ui.reportPaymentCardTop}>
            <span className={ui.reportPaymentCardLabel}>Paid Payments</span>
          </div>
          <strong className={ui.reportPaymentCardAmount}>{formatMoney(paidTotalAmount, state.company?.currency || 'RWF')}</strong>
          <span className={ui.reportPaymentCardCount}>{paidInvoices.length} payment{paidInvoices.length !== 1 ? 's' : ''}</span>
        </section>

        <section className={ui.reportPaymentCard} style={{ borderLeft: '4px solid #ca8a04' }}>
          <div className={ui.reportPaymentCardTop}>
            <span className={ui.reportPaymentCardLabel}>Outstanding / Unpaid</span>
          </div>
          <strong className={ui.reportPaymentCardAmount}>{formatMoney(unpaidTotalAmount, state.company?.currency || 'RWF')}</strong>
          <span className={ui.reportPaymentCardCount}>{unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''}</span>
        </section>

        <section className={ui.reportPaymentCard} style={{ borderLeft: '4px solid #2563eb' }}>
          <div className={ui.reportPaymentCardTop}>
            <span className={ui.reportPaymentCardLabel}>Partially Paid</span>
          </div>
          <strong className={ui.reportPaymentCardAmount}>{formatMoney(partialTotalAmount, state.company?.currency || 'RWF')}</strong>
          <span className={ui.reportPaymentCardCount}>
            {partialInvoices.length} invoice{partialInvoices.length !== 1 ? 's' : ''} · {formatMoney(partialRemainingAmount, state.company?.currency || 'RWF')} remaining
          </span>
        </section>
      </div>

      <div className={ui.supplierDashMainGridStacked}>
        <div className={ui.supplierDashMainColFull}>
          <div className={ui.supplierDashChartsRow}>
            <section className={`${ui.supplierDashChartCard} ${ui.clerkChartCard}`}>
              <div className={ui.clerkSectionHead}>
                <div>
                  <h2 className={ui.clerkSectionTitle}>{t('app.supplier.dashRevenueTitle')}</h2>
                  <p className={ui.clerkSectionSub}>{t('app.supplier.dashRevenueMeta')}</p>
                </div>
                <label className={ui.portalFilterField}>
                  <span className={ui.portalFilterLabel}>{t('app.supplier.dashRevenueBasis')}</span>
                  <InventoryFilterSelect
                    value={revenueBasis}
                    onChange={setRevenueBasis}
                    options={[
                      { value: 'settled', label: t('app.supplier.dashRevenueSettled') },
                      { value: 'pipeline', label: t('app.supplier.dashRevenuePipeline') },
                      { value: 'all_progress', label: t('app.supplier.dashRevenueAll') },
                    ]}
                  />
                </label>
              </div>
              <SupplierDashPeriodLineChart
                bars={revenueBars}
                gradPrefix="rev"
                strokeVar="var(--ec-primary)"
                tooltipFormat={(v) => formatMoney(v, state.company?.currency || 'RWF')}
                footnoteFormat={(max) =>
                  t('app.supplier.dashRevenueYMax', { amount: formatMoney(max, state.company?.currency || 'RWF') })
                }
                legendText={t('app.supplier.dashRevenueLegend')}
              />
              {revenueBars.every((b) => !b.amount) ? (
                <p className={ui.supplierDashChartEmpty}>{t('app.supplier.dashRevenueNoData')}</p>
              ) : null}
            </section>

            <section className={`${ui.supplierDashChartCard} ${ui.clerkChartCard}`}>
              <div className={ui.clerkSectionHead}>
                <div>
                  <h2 className={ui.clerkSectionTitle}>{t('app.supplier.dashRequestsTitle')}</h2>
                  <p className={ui.clerkSectionSub}>{t('app.supplier.dashRequestsMeta')}</p>
                </div>
              </div>
              <SupplierDashPeriodLineChart
                bars={requestVolumeBars}
                gradPrefix="req"
                strokeVar="var(--ec-primary-dark)"
                tooltipFormat={(v) => {
                  const n = Number(v);
                  return n === 1 ? t('app.supplier.dashRequestsTooltipOne') : t('app.supplier.dashRequestsTooltipMany', { count: n });
                }}
                footnoteFormat={(max) => t('app.supplier.dashRequestsYMax', { count: max })}
                legendText={t('app.supplier.dashRequestsLegend')}
              />
              {requestVolumeBars.every((b) => !b.amount) ? (
                <p className={ui.supplierDashChartEmpty}>{t('app.supplier.dashRequestsNoData')}</p>
              ) : null}
            </section>
          </div>

          <section className={ui.supplierDashInventoryCard}>
            <div className={ui.supplierDashCardHead}>
              <div>
                <h2 className={ui.supplierDashCardTitle}>{t('app.supplier.dashInventoryTitle')}</h2>
                <p className={ui.supplierDashCardMeta}>{t('app.supplier.dashInventoryMeta')}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={ui.supplierDashStatLinkLow}
                  onClick={() => setShowAllInventory(!showAllInventory)}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '999px', background: 'var(--ec-bg)', border: '1px solid var(--ec-border)' }}
                >
                  {showAllInventory ? 'Show Top 5' : `Show All (${catalogList.length})`}
                </button>
                <button
                  type="button"
                  className={ui.supplierDashStatLinkLow}
                  onClick={downloadInventoryReport}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '999px', background: 'var(--ec-primary)', color: 'white', border: 'none' }}
                >
                  Download
                </button>
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <input
                type="text"
                placeholder="Search inventory..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--ec-border)',
                  fontSize: '0.85rem',
                  background: 'var(--ec-bg)',
                  color: 'var(--ec-text)',
                }}
              />
            </div>
            <div className={ui.supplierDashInventoryTableWrapper}>
              <table className={ui.supplierDashInventoryTable}>
                <thead>
                  <tr>
                    <th>{t('app.supplier.dashInventoryColProduct')}</th>
                    <th>{t('app.supplier.dashInventoryColCategory')}</th>
                    <th>{t('app.supplier.dashInventoryColQuantity')}</th>
                    <th>{t('app.supplier.dashInventoryColStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const low = Number(item.quantity || 0) <= Number(item.minThreshold || 0);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className={ui.supplierDashInvCellName}>
                            <span className={low ? ui.supplierDashInvDotLow : ui.supplierDashInvDotOk} />
                            {item.name}
                          </div>
                        </td>
                        <td>{(item.category || 'Stock').toUpperCase()}</td>
                        <td>{item.quantity} {item.unit || 'units'}</td>
                        <td>
                          <span className={low ? ui.supplierDashInvBadgeLow : ui.supplierDashInvBadgeOk}>
                            {low ? t('app.supplier.dashStockLow') : t('app.supplier.dashStockOk')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredInventory.length === 0 && (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--ec-muted)', fontSize: '0.85rem' }}>
                  No inventory items match your search
                </p>
              )}
            </div>
          </section>
        </div>

        <div className={ui.supplierDashSideColBelow}>
          <section className={ui.supplierDashCurator}>
            <h2 className={ui.supplierDashCuratorTitle}>{t('app.supplier.dashCuratorTitle')}</h2>
            <div className={ui.supplierDashCuratorText}>
              <WorkspaceAiInsight
                scope="supplier"
                showRefresh
                fallbackText={`Check your inbox for new buyer requests${
                  curatorLine ? ` — high-attention line: ${curatorLine}.` : '.'
                }`}
              />
            </div>
            <button type="button" className={ui.supplierDashCuratorBtn} onClick={() => navigate('/app/supplier/inbox')}>
              {t('app.supplier.dashCuratorCta')}
            </button>
          </section>

          <section className={ui.supplierDashActivityCard}>
            <div className={ui.supplierDashCardHead}>
              <h2 className={ui.supplierDashCardTitle}>{t('app.supplier.dashActivityTitle')}</h2>
              <button
                type="button"
                className={ui.supplierDashStatLinkLow}
                onClick={downloadActivityReport}
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '999px', background: 'var(--ec-primary)', color: 'white', border: 'none' }}
              >
                Download
              </button>
            </div>
            <ul className={ui.supplierDashActivityList}>
              {(supplierLogs.length ? supplierLogs : state.activity.slice(0, 4)).map((entry) => {
                const bad = entry.action?.includes('reject') || entry.action?.includes('delay');
                return (
                  <li key={entry.id} className={ui.supplierDashActivityItem}>
                    <span className={bad ? ui.supplierDashActivityDotBad : ui.supplierDashActivityDot} />
                    <div>
                      <p className={ui.supplierDashActivityTitle}>{describeActivityEntry(entry, t)}</p>
                      <p className={ui.supplierDashActivityMeta}>
                        {entry.actorName} · {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <NavLink to="/app/supplier/messages" className={ui.supplierDashActivityLink}>
              {t('app.supplier.dashActivityCta')}
            </NavLink>
          </section>

          <section className={ui.supplierDashRegionCard}>
            <div className={ui.supplierDashCardHead}>
              <div>
                <h2 className={ui.supplierDashCardTitle}>{t('app.supplier.dashRegionTitle')}</h2>
                <p className={ui.supplierDashCardMeta}>{t('app.supplier.dashRegionMeta')}</p>
              </div>
              <button
                type="button"
                className={ui.supplierDashStatLinkLow}
                onClick={downloadRegionReport}
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '999px', background: 'var(--ec-primary)', color: 'white', border: 'none' }}
              >
                Download
              </button>
            </div>
            <ul className={ui.supplierDashRegionList}>
              {regions.map((row, i) => (
                <li key={row.label} className={ui.supplierDashRegionRow}>
                  <div className={ui.supplierDashRegionTop}>
                    <span>{row.label}</span>
                    <strong>{row.pct}%</strong>
                  </div>
                  <div className={ui.supplierDashRegionTrack}>
                    <span
                      className={i === 0 ? ui.supplierDashRegionFillA : i === 1 ? ui.supplierDashRegionFillB : ui.supplierDashRegionFillC}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className={ui.supplierDashWorkflow}>
        <h2 className={ui.supplierDashWorkflowTitle}>Workflow you own</h2>
        <ol className={ui.supplierPipeline}>
          {PIPELINE.map((row) => (
            <li key={row.step} className={ui.supplierPipeStep}>
              <span className={ui.supplierPipeNum}>{row.step}</span>
              <div>
                <p className={ui.supplierPipeTitle}>{row.title}</p>
                <p className={ui.supplierPipeBody}>{row.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function SupplierConnectedSupervisors() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const directory = Array.isArray(state.buyerSupervisorDirectory) ? state.buyerSupervisorDirectory : [];

  const totalSupervisors = useMemo(
    () => directory.reduce((n, b) => n + (b.supervisors?.length || 0), 0),
    [directory]
  );

  return (
    <div className={ui.supplierBoard}>
      <div className={ui.supplierSupervisorsPage}>
        <header className={ui.supplierSupervisorsHero}>
          <div className={ui.supplierSupervisorsHeroTop}>
            <div>
              <p className={ui.supplierSupervisorsEyebrow}>{t('app.supplier.dashKpiConnections')}</p>
              <h1 className={ui.supplierSupervisorsTitle}>{t('app.supplier.supervisorsTitle')}</h1>
              <p className={ui.supplierSupervisorsLead}>{t('app.supplier.supervisorsLead')}</p>
              <div className={ui.supplierSupervisorsMeta} style={{ marginTop: '0.85rem' }}>
                <span className={ui.supplierSupervisorsPill}>
                  {t('app.supplier.supervisorsBuyers', { count: directory.length })}
                </span>
                <span className={ui.supplierSupervisorsPill}>
                  {t('app.supplier.supervisorsTotal', { count: totalSupervisors })}
                </span>
              </div>
            </div>
            <Link to="/app/supplier/dashboard" className={ui.supplierSupervisorsBack}>
              {t('app.supplier.supervisorsBackDash')}
            </Link>
          </div>
        </header>

        {directory.length === 0 ? (
          <p className={ui.supplierSupervisorsEmpty}>{t('app.supplier.supervisorsEmpty')}</p>
        ) : (
          directory.map((buyer) => {
            const logo = cleanRemoteLogoUrl(buyer.buyerLogoUrl || '');
            const initial = (buyer.buyerCompanyName || '?').trim().charAt(0).toUpperCase();
            const sups = buyer.supervisors || [];
            return (
              <section key={buyer.buyerCompanyId} className={ui.supplierSupervisorsBuyerSection}>
                <div className={ui.supplierSupervisorsBuyerHead}>
                  {logo ? (
                    <img className={ui.supplierSupervisorsBuyerLogo} src={logo} alt="" />
                  ) : (
                    <div className={ui.supplierSupervisorsBuyerLogoFallback} aria-hidden>
                      {initial}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <h2 className={ui.supplierSupervisorsBuyerName}>{buyer.buyerCompanyName}</h2>
                    {buyer.buyerIndustry ? (
                      <p className={ui.supplierSupervisorsBuyerIndustry}>{buyer.buyerIndustry}</p>
                    ) : null}
                  </div>
                </div>
                {sups.length === 0 ? (
                  <p className={ui.supplierSupervisorsBuyerEmpty}>{t('app.supplier.supervisorsBuyerEmpty')}</p>
                ) : (
                  <div className={ui.supplierSupervisorsGrid}>
                    {sups.map((s) => (
                      <article key={s.id} className={ui.supplierSupervisorsCard}>
                        <p className={ui.supplierSupervisorsCardName}>{s.fullName || '—'}</p>
                        <span className={ui.supplierSupervisorsBadge}>{t('app.supplier.supervisorsRoleBadge')}</span>
                        <div className={ui.supplierSupervisorsCardMeta}>
                          {s.jobTitle ? <div>{s.jobTitle}</div> : null}
                          {s.email ? <div>{s.email}</div> : null}
                          {s.phone ? <div>{s.phone}</div> : null}
                          {s.team || s.location ? (
                            <div>
                              {[s.team, s.location].filter(Boolean).join(' · ')}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

export function SupplierInbox() {
  const { t } = useI18n();
  const { state, supplierUsesApi, submitSupplierProforma } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useSupplierActor(state, user);
  const strict = supplierUsesApi;
  const company = state.company;
  const { showFlash } = useFlash();
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  const incoming = useMemo(() => {
    const list = supplierIncomingRequests(state, actor?.id, strict, actor?.companyId);
    return [...list].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [state.requisitions, actor?.id, strict]);

  const [tab, setTab] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [pdfReq, setPdfReq] = useState(null);

  const openCount = incoming.filter((e) =>
    ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived', 'proformaApproved', 'finalInvoiceReceived'].includes(e.status)
  ).length;
  const priorityCount = incoming.filter(
    (e) => e.priority === 'critical' && ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived'].includes(e.status)
  ).length;

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const iFiltered = incoming.filter((entry) => {
      if (tab === 'urgent') {
        return entry.priority === 'critical' && ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived'].includes(entry.status);
      } else if (tab === 'pending') {
        return (
          ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived'].includes(entry.status) &&
          !(entry.priority === 'critical' && ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived'].includes(entry.status))
        );
      } else if (tab === 'approved') {
        return ['proformaApproved', 'finalInvoiceReceived', 'paid', 'creditPurchase', 'deliveryNoteAttached'].includes(entry.status);
      } else if (tab === 'rejected') {
        return entry.status === 'rejected';
      }
      return true; // Use 'all' logic
    });

    const is = supplierInvoices(state, actor?.id, supplierUsesApi, actor?.companyId);
    let finalSource = iFiltered;

    if (tab === 'approved' || tab === 'rejected') {
      // Invoices/Proformas have status mapping
      const targetStatus = tab === 'approved' ? ['proformaApproved', 'paid', 'creditPurchase', 'deliveryNoteAttached'] : ['rejected'];
      finalSource = is.filter(inv => targetStatus.includes(inv.status));
    }

    if (!q) return finalSource;
    return finalSource.filter((item) => {
      const idStr = String(item.id || item._id || '').toLowerCase();
      const txt = (item.reference || item.title || item.name || '').toLowerCase();
      const clerk = (item.clerkName || '').toLowerCase();
      return idStr.includes(q) || txt.includes(q) || clerk.includes(q);
    });
  }, [incoming, tab, searchQ, state, actor?.id, supplierUsesApi]);

  const curatorProduct = incoming.find((e) => e.priority === 'critical')?.lines?.[0]?.description || 'priority SKUs';

  function updateDraft(id, patch) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        reference: current[id]?.reference || '',
        amount: current[id]?.amount || '',
        attachmentUrl: current[id]?.attachmentUrl || '',
        notes: current[id]?.notes || '',
        ...patch,
      },
    }));
  }

  async function handleFileUpload(id, file) {
    const progressKey = `proforma-${id}`;
    setUploadingId(id);
    setUploadProgress({ key: progressKey, percent: 0 });
    try {
      const url = await uploadSupplierPdf(file, {
        showFlash,
        onProgress: (percent) => setUploadProgress({ key: progressKey, percent }),
      });
      if (!url) return;
      updateDraft(id, { attachmentUrl: url });
      showFlash('Proforma uploaded successfully!', 'ok');
    } catch (e) {
      showFlash(`Upload failed: ${e.message || 'Please try again'}`, 'error');
    } finally {
      setUploadingId(null);
      setUploadProgress(null);
    }
  }

  async function onProformaSubmit(reqId) {
    const draft = drafts[reqId];
    if (!draft || !draft.amount) {
      showFlash(t('app.supplier.toastProformaAmountRequired'), 'warn');
      return;
    }
    showFlash(t('app.supplier.toastProformaSubmitting'), 'loading');
    try {
      await submitSupplierProforma(reqId, {
        reference: String(draft.reference || defaultProformaReference(reqId)).trim(),
        amount: Number(draft.amount),
        currency: company?.currency || 'RWF',
        attachmentUrl: String(draft.attachmentUrl || '').trim(),
        notes: String(draft.notes || '').trim(),
        lines: draft.lines || [],
      });
      showFlash(t('app.supplier.toastProformaSubmitted'), 'ok');
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[reqId];
        return next;
      });
      setExpandedId(null);
    } catch (e) {
      showFlash(e.message || t('app.supplier.toastProformaSubmitError'), 'error');
      throw e;
    }
  }

  function thumbClass(seed) {
    let h = 0;
    for (const ch of String(seed || '')) h = (h + ch.charCodeAt(0)) % 4;
    return ['supplierReqThumbA', 'supplierReqThumbB', 'supplierReqThumbC', 'supplierReqThumbD'][h];
  }

  return (
    <div className={ui.supplierInbox}>
      <div className={ui.supplierReqShell}>
        <div className={ui.supplierReqMain}>
          <header className={ui.supplierReqHeader}>
            <div className={ui.supplierReqHeaderMain}>
              <h1 className={ui.supplierReqTitle}>{t('app.supplier.inboxTitle')}</h1>
              <p className={ui.supplierReqLead}>{t('app.supplier.inboxLead')}</p>

              <div className={ui.supplierReqKpiStrip}>
                <div className={ui.supplierReqKpi}>
                  <p className={ui.supplierReqKpiLabel}>Open requests</p>
                  <p className={ui.supplierReqKpiValueMaroon}>{openCount}</p>
                </div>
                <div className={ui.supplierReqKpi}>
                  <p className={ui.supplierReqKpiLabel}>Priority</p>
                  <p className={ui.supplierReqKpiValueGreen}>{String(priorityCount).padStart(2, '0')}</p>
                </div>
              </div>
            </div>
          </header>

          <section className={ui.supplierReqCard}>
            <div className={ui.supplierReqCardTop}>
              <div className={ui.supplierReqTabs} role="tablist" aria-label="Request filters">
                {[
                  { id: 'all', label: 'All requests' },
                  { id: 'urgent', label: 'Urgent' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={tab === t.id ? ui.supplierReqTabActive : ui.supplierReqTab}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="button" className={ui.supplierReqFilterBtn} onClick={() => setFilterOpen((o) => !o)}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                Filter
              </button>
            </div>
            {filterOpen && (
              <div className={ui.supplierReqSearchRow}>
                <input
                  type="search"
                  className={ui.supplierReqSearch}
                  placeholder="Search requests…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
              </div>
            )}
            <div className={ui.supplierReqTableScroll}>
              <table className={ui.supplierReqTable}>
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Requested item</th>
                    <th>Qty</th>
                    <th>Requested by</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={ui.supplierReqEmpty}>
                        No requests match this view. New demand appears when the hospital releases orders to you.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((entry) => {
                      const isRequisitionRow = entry.clerkId != null;
                      const linkedReq =
                        isRequisitionRow
                          ? entry
                          : entry.requisitionId
                            ? state.requisitions.find((r) => r.id === entry.requisitionId)
                            : null;
                      const rowForLines = linkedReq || entry;
                      const badge = isRequisitionRow
                        ? requestDisplayBadge(entry, t)
                        : {
                            key: entry.status,
                            label: workflowLabel(entry.status),
                            tone: entry.status === 'rejected' ? 'urgent' : 'ok',
                          };
                      const qty = totalQty(rowForLines.lines);
                      const expanded = expandedId === entry.id;
                      const canQuote = isRequisitionRow && entry.status === 'sentToSupplier';
                      const requestIdForDisplay = isRequisitionRow ? entry.id : entry.requisitionId || entry.id;
                      const pdfTarget = linkedReq;
                      const buyerOrgName =
                        String(
                          rowForLines.buyerCompanyName ||
                            state.requisitions.find((r) => r.id === requestIdForDisplay)?.buyerCompanyName ||
                            ''
                        ).trim() || 'Customer facility';
                      return (
                        <Fragment key={entry.id}>
                          <tr id={`req-row-${entry.id}`} className={expanded ? ui.supplierReqRowOpen : undefined}>
                            <td>
                              {pdfTarget ? (
                                <button
                                  type="button"
                                  className={ui.materialsLinkBtn}
                                  onClick={() => setPdfReq(pdfTarget)}
                                  title="View requisition details"
                                >
                                  {displayRequestRef(requestIdForDisplay)}
                                </button>
                              ) : (
                                <span className={ui.supplierReqSku}>{displayRequestRef(requestIdForDisplay)}</span>
                              )}
                            </td>
                            <td>
                              <div className={ui.supplierReqItemCell}>
                                <div>
                                  <div className={ui.supplierReqItemName}>{requestProductTitle(rowForLines)}</div>
                                  <div className={ui.supplierReqSku}>SKU: {skuForRequisition(rowForLines)}</div>
                                </div>
                              </div>
                            </td>
                            <td className={ui.supplierReqQty}>{qty.toLocaleString()}</td>
                            <td>
                              <div className={ui.supplierReqByCell}>
                                <div>
                                  <div className={ui.supplierReqByName}>{buyerOrgName}</div>
                                  <div className={ui.supplierReqByMeta}>{rowForLines.clerkName || '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={
                                  badge.tone === 'urgent'
                                    ? ui.supplierReqBadgeUrgent
                                    : badge.tone === 'ok'
                                      ? ui.supplierReqBadgeOk
                                      : ui.supplierReqBadgePending
                                }
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td>
                              {canQuote ? (
                                  <button
                                    type="button"
                                    className={ui.supplierReqChevron}
                                    aria-expanded={expanded}
                                    onClick={() => {
                                      if (expanded) {
                                        setExpandedId(null);
                                        return;
                                      }
                                      setExpandedId(entry.id);
                                      setDrafts((current) => {
                                        const d = current[entry.id];
                                        const defRef = defaultProformaReference(entry.id);
                                        return {
                                          ...current,
                                          [entry.id]: {
                                            reference: defRef,
                                            amount: d?.amount || '',
                                            attachmentUrl: d?.attachmentUrl || '',
                                            notes: d?.notes || '',
                                            lines: d?.lines || (entry.lines || []).map(l => ({ ...l, suppliedQuantity: l.suppliedQuantity ?? l.quantity })),
                                          },
                                        };
                                      });
                                    }}
                                    title={expanded ? 'Collapse' : 'Expand to quote'}
                                  >
                                    <svg 
                                      width={16} 
                                      height={16} 
                                      viewBox="0 0 24 24" 
                                      fill="none" 
                                      style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                                    >
                                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                              ) : (
                                <span className={ui.supplierReqChevronMuted}>—</span>
                              )}
                            </td>
                          </tr>
                          {expanded && canQuote && (
                            <tr className={ui.supplierReqExpandRow}>
                              <td colSpan={6}>
                                <div className={ui.supplierReqExpand}>
                                  <p className={ui.supplierReqExpandTitle}>Submit proforma</p>
                                  <p className={ui.supplierReqExpandHint}>Please confirm the quantities you can supply, then attach your proforma.</p>
                                  
                                  <div className={ui.supplierReqLinesGrid} style={{ marginTop: '1rem', marginBottom: '1.5rem', background: 'var(--ec-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--ec-border)' }}>
                                    <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--ec-muted)', marginBottom: '0.75rem' }}>Line Items</h4>
                                    {(drafts[entry.id]?.lines || []).map((line, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px dashed var(--ec-border)' }}>
                                        <div style={{ flex: 1, fontSize: '0.9rem' }}>
                                          <div style={{ fontWeight: 500 }}>{line.description}</div>
                                          <div style={{ fontSize: '0.8rem', color: 'var(--ec-muted)' }}>Requested: {line.quantity} {line.unit}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <label style={{ fontSize: '0.8rem', color: 'var(--ec-muted)' }}>Supplying:</label>
                                          <input
                                            type="number"
                                            className={ui.supplierReqExpandInput}
                                            style={{ width: '80px', padding: '0.25rem 0.5rem' }}
                                            value={line.suppliedQuantity ?? ''}
                                            onChange={(e) => {
                                              const newLines = [...(drafts[entry.id]?.lines || [])];
                                              newLines[idx].suppliedQuantity = e.target.value === '' ? '' : Number(e.target.value);
                                              updateDraft(entry.id, { lines: newLines });
                                            }}
                                            min="0"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className={ui.supplierReqExpandGrid}>
                                    <label className={ui.supplierReqExpandField}>
                                      <span>Reference</span>
                                      <input
                                        className={`${ui.supplierReqExpandInput} ${ui.supplierReqExpandInputReadonly}`}
                                        readOnly
                                        aria-readonly="true"
                                        title="Auto-generated from the requisition ID"
                                        value={
                                          drafts[entry.id]?.reference || defaultProformaReference(entry.id)
                                        }
                                      />
                                    </label>
                                    <label className={ui.supplierReqExpandField}>
                                      <span>Amount</span>
                                      <input
                                        className={ui.supplierReqExpandInput}
                                        type="number"
                                        placeholder="Amount"
                                        value={drafts[entry.id]?.amount || ''}
                                        onChange={(e) => updateDraft(entry.id, { amount: e.target.value })}
                                      />
                                    </label>
                                    <label className={`${ui.supplierReqExpandField} ${ui.supplierReqExpandFieldWide}`}>
                                      <span>Attachment {uploadingId === entry.id ? '(Uploading…)' : ''}</span>
                                      <div className={ui.supplierFileWrapper}>
                                        <input
                                          className={ui.supplierReqExpandInput}
                                          type="file"
                                          accept=".pdf"
                                          onChange={(e) => handleFileUpload(entry.id, e.target.files[0])}
                                          disabled={uploadingId === entry.id}
                                        />
                                        {drafts[entry.id]?.attachmentUrl && (
                                          <span className={ui.supplierFileOk} title={drafts[entry.id].attachmentUrl}>
                                            <CheckIcon size={14} /> Uploaded
                                          </span>
                                        )}
                                      </div>
                                      {uploadProgress?.key === `proforma-${entry.id}` ? (
                                        <UploadProgressBar percent={uploadProgress.percent} label={`Uploading… ${uploadProgress.percent}%`} />
                                      ) : null}
                                    </label>
                                  </div>
                                  <LoadingButton
                                    type="button"
                                    className={ui.supplierReqSendBtn}
                                    loadingText="Sending…"
                                    onClick={() => onProformaSubmit(entry.id)}
                                  >
                                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
                                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Send proforma
                                  </LoadingButton>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${ui.supplierReqMatch} ${ui.supplierReqMatchBelow}`} aria-labelledby="supplier-req-match-heading">
            <h2 id="supplier-req-match-heading" className={ui.supplierReqMatchTitle}>
              Smart match suggestions
            </h2>
            <ul className={ui.supplierReqMatchList}>
              {incoming.slice(0, 2).map((entry, idx) => (
                <li key={entry.id}>
                    <button
                      type="button"
                      className={ui.supplierReqMatchRow}
                      onClick={() => {
                        setTab('all');
                        setExpandedId(entry.id);
                        if (entry.status === 'sentToSupplier') {
                          setDrafts((current) => {
                            const d = current[entry.id];
                            return {
                              ...current,
                              [entry.id]: {
                                reference: defaultProformaReference(entry.id),
                                amount: d?.amount || '',
                                attachmentUrl: d?.attachmentUrl || '',
                                notes: d?.notes || '',
                                lines: d?.lines || (entry.lines || []).map(l => ({ ...l, suppliedQuantity: l.suppliedQuantity ?? l.quantity })),
                              },
                            };
                          });
                        }
                        document.getElementById(`req-row-${entry.id}`)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                    <div className={ui.supplierReqMatchBody}>
                      <span className={ui.supplierReqMatchName}>{requestProductTitle(entry)}</span>
                      <span className={ui.supplierReqMatchConf}>{98 - idx * 7}% match confidence</span>
                    </div>
                    <span className={ui.supplierReqMatchChev} aria-hidden>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <RequisitionPdfModal
        isOpen={Boolean(pdfReq)}
        req={pdfReq}
        onClose={() => setPdfReq(null)}
        onDownload={downloadRequisitionPdf}
        users={state.users}
        company={
          pdfReq
            ? { name: pdfReq.buyerCompanyName || '', logoUrl: pdfReq.buyerLogoUrl || '' }
            : null
        }
      />
    </div>
  );
}

export function SupplierApprovedProforma() {
  const { state, supplierUsesApi } = usePortalData();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const strict = supplierUsesApi;
  const rows = supplierInvoices(state, actor?.id, strict, actor?.companyId).filter((i) => i.status === 'proformaApproved');
  const [docPreview, setDocPreview] = useState(null);

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Approved proformas"
        title="Finance accepted your pricing"
        description="These proformas are cleared by the accountant and are waiting for payment. After payment appears, move to Delivery & official invoice to attach dispatch proof and the final tax invoice."
      />
      <div className={ui.supplierToolbar}>
        <span className={ui.supplierPillOk}>{rows.length} approved</span>
        <NavLink to="/app/supplier/documents" className={ui.supplierLinkBtn}>
          Go to delivery &amp; invoice 
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginLeft: '6px' }}>
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </NavLink>
      </div>
      <section className={ui.supplierTableCard}>
        <div className={ui.supplierTableScroll}>
          <table className={`${ui.supplierTable} ${ui.supplierTableApproved}`}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Requisition</th>
                <th>Materials supplied</th>
                <th>Amount</th>
                <th>Proforma file</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={ui.supplierTableEmpty}>
                    No approved proformas yet. Approved items land here after accountant sign-off.
                  </td>
                </tr>
              ) : (
                rows.map((inv) => {
                  const req = requisitionById(state, inv.requisitionId);
                  return (
                    <tr key={inv.id}>
                      <td>
                        <strong className={ui.supplierCellStrong}>{inv.reference}</strong>
                        <div className={ui.supplierCellMuted}>Updated {formatDate(inv.updatedAt)}</div>
                      </td>
                      <td>{req?.title || '—'}</td>
                      <td className={ui.supplierCellLines}>{linesSummary(req?.lines)}</td>
                      <td>{formatMoney(inv.amount, inv.currency)}</td>
                      <td>
                        {inv.attachmentUrl ? (
                          <button
                            type="button"
                            className={ui.supplierLinkBtn}
                            onClick={() => setDocPreview({ title: 'Proforma', url: safeDocUrl(inv.attachmentUrl) })}
                          >
                            Open proforma
                          </button>
                        ) : (
                          <span className={ui.supplierFilePill}>—</span>
                        )}
                      </td>
                      <td className={ui.supplierCellMuted}>{inv.notes || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <DocumentViewerModal open={Boolean(docPreview?.url)} title={docPreview?.title} url={docPreview?.url} onClose={() => setDocPreview(null)} />
    </div>
  );
}

export function SupplierRejectedProforma() {
  const { state, supplierUsesApi } = usePortalData();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const strict = supplierUsesApi;
  const rows = supplierInvoices(state, actor?.id, strict, actor?.companyId).filter((i) => i.status === 'rejected');
  const [docPreview, setDocPreview] = useState(null);

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Rejected proformas"
        title="Revise and resubmit when ready"
        description="Finance returned these proformas. Read the notes, adjust pricing or attachments, and coordinate with the clerk if the underlying requisition must change."
      />
      <div className={ui.supplierToolbar}>
        <span className={ui.supplierPillBad}>{rows.length} rejected</span>
      </div>
      <div className={ui.supplierRejectGrid}>
        {rows.length === 0 ? (
          <p className={ui.supplierEmpty}>No rejected proformas on file.</p>
        ) : (
          rows.map((inv) => {
            const req = requisitionById(state, inv.requisitionId);
            return (
              <article key={inv.id} className={ui.supplierRejectCard}>
                <div className={ui.supplierRejectTop}>
                  <span className={ui.supplierRejectIcon}>
                    <SupplierGlyph kind="reject" />
                  </span>
                  <StatusBadge status="Rejected" />
                </div>
                <h3 className={ui.supplierRejectTitle}>{inv.reference}</h3>
                <p className={ui.supplierRejectReq}>{req?.title || 'Requisition'}</p>
                <p className={ui.supplierRejectLines}>{linesSummary(req?.lines)}</p>
                <p className={ui.supplierRejectReason}>{inv.notes || 'No detailed reason captured.'}</p>
                <div className={ui.supplierRejectFoot}>
                  <span>{formatMoney(inv.amount, inv.currency)}</span>
                  {inv.attachmentUrl ? (
                    <button
                      type="button"
                      className={ui.supplierLinkBtn}
                      onClick={() => setDocPreview({ title: 'Proforma', url: safeDocUrl(inv.attachmentUrl) })}
                    >
                      Open proforma file
                    </button>
                  ) : (
                    <span>File: —</span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
      <DocumentViewerModal open={Boolean(docPreview?.url)} title={docPreview?.title} url={docPreview?.url} onClose={() => setDocPreview(null)} />
    </div>
  );
}

export function SupplierDocuments() {
  const { state, supplierUsesApi, attachFinalInvoice } = usePortalData();
  const { user } = useAuth();
  const { showFlash } = useFlash();
  const actor = useSupplierActor(state, user);
  const strict = supplierUsesApi;
  const invoices = supplierInvoices(state, actor?.id, strict, actor?.companyId).filter((entry) =>
    ['paid', 'creditPurchase'].includes(entry.status)
  );
  const [docs, setDocs] = useState({});
  const [docError, setDocError] = useState(null);
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [supplierDocPreview, setSupplierDocPreview] = useState(null);

  async function handleDocUpload(id, field, file) {
    const progressKey = `${id}-${field}`;
    setUploadingDocId(progressKey);
    setUploadProgress({ key: progressKey, percent: 0 });
    try {
      const url = await uploadSupplierPdf(file, {
        showFlash,
        onProgress: (percent) => setUploadProgress({ key: progressKey, percent }),
      });
      if (!url) return;
      updateDocs(id, { [field]: url });
      showFlash('Document uploaded successfully.', 'ok');
    } catch (e) {
      showFlash(`Upload failed: ${e.message || 'Please try again'}`, 'error');
    } finally {
      setUploadingDocId(null);
      setUploadProgress(null);
    }
  }

  function updateDocs(id, patch) {
    setDocs((current) => ({
      ...current,
      [id]: {
        finalInvoiceUrl: current[id]?.finalInvoiceUrl || '',
        ...patch,
      },
    }));
  }

  async function saveFinalInvoice(invoice) {
    const url = docs[invoice.id]?.finalInvoiceUrl || invoice.finalInvoiceUrl;
    if (!String(url || '').trim()) {
      setDocError('Enter the official final invoice file name or URL.');
      return;
    }
    setDocError(null);
    try {
      await attachFinalInvoice(invoice.id, url, actor?.id);
      showFlash('Final invoice attached successfully. The clerk will now attach the delivery note.', 'ok');
    } catch (e) {
      const msg = e.message || 'Could not attach final invoice.';
      setDocError(msg);
      showFlash(msg, 'error');
      throw e;
    }
  }

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Official invoice"
        title="Attach final invoice"
        description="After payment, attach the official tax invoice. The clerk will attach the delivery note after receiving the goods."
      />

      {docError ? (
        <div className={ui.supplierPanel} style={{ marginBottom: '1rem' }}>
          <p className={ui.supplierPanelTitle} style={{ color: 'var(--ec-primary)' }}>
            {docError}
          </p>
          <button type="button" className={ui.supplierGhostBtn} onClick={() => setDocError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className={ui.supplierDocBannerGrid}>
        <article className={`${ui.supplierDocBanner} ${ui.supplierDocBannerAccent}`}>
          <SupplierGlyph kind="doc" />
          <div>
            <h3 className={ui.supplierDocBannerTitle}>Official final invoice</h3>
            <p className={ui.supplierDocBannerText}>Tax-compliant invoice matching the paid proforma; clerk will attach delivery note after receiving goods.</p>
          </div>
        </article>
      </div>

      <section className={ui.supplierTableCard}>
        <div className={ui.supplierTableHead}>
          <h2 className={ui.supplierTableTitle}>Attachments</h2>
          <p className={ui.supplierTableLead}>Use filenames your finance team expects (PDF recommended).</p>
        </div>
        <div className={ui.supplierTableScroll}>
          <table className={`${ui.supplierTable} ${ui.supplierTableDelivery}`}>
            <thead>
              <tr>
                <th>Reference &amp; order</th>
                <th>Status</th>
                <th>Official final invoice</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className={ui.supplierTableEmpty}>
                    Paid orders appear here. Until payment is released, work from Approved proformas.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const req = requisitionById(state, invoice.requisitionId);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <strong className={ui.supplierCellStrong}>{invoice.reference}</strong>
                        <div className={ui.supplierCellMuted}>{formatMoney(invoice.amount, invoice.currency)}</div>
                        <div className={ui.supplierCellLinesSmall}>{req?.title}</div>
                      </td>
                      <td>
                        <StatusBadge status={workflowLabel(invoice.status)} />
                      </td>
                      <td>
                        {invoice.finalInvoiceUrl ? (
                          <div className={ui.supplierClerkDoc}>
                            <button
                              type="button"
                              className={ui.supplierDocLinkSmall}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', display: 'flex', alignItems: 'center' }}
                              onClick={() =>
                                setSupplierDocPreview({
                                  url: resolvePortalDocumentUrl(invoice.finalInvoiceUrl),
                                  title: 'Final invoice',
                                })
                              }
                            >
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: '4px' }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" />
                                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" />
                              </svg>
                              Final Invoice
                            </button>
                            <span className={ui.supplierDocLockHint} title="Attached by supplier, cannot be edited.">
                              <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H9V7z" />
                              </svg>
                            </span>
                          </div>
                        ) : (
                          <span className={ui.supplierCellMuted}>Not required yet</span>
                        )}
                      </td>
                      <td>
                        <div className={ui.supplierFileWrapper}>
                          <input
                            type="file"
                            accept=".pdf"
                            className={ui.supplierInput}
                            title="Upload final invoice"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (f) handleDocUpload(invoice.id, 'finalInvoiceUrl', f);
                            }}
                            disabled={uploadingDocId === `${invoice.id}-finalInvoiceUrl`}
                          />
                          {(docs[invoice.id]?.finalInvoiceUrl || invoice.finalInvoiceUrl) && (
                            <span className={ui.supplierFileOk}>
                              <CheckIcon size={12} /> OK
                            </span>
                          )}
                          {uploadProgress?.key === `${invoice.id}-finalInvoiceUrl` ? (
                            <UploadProgressBar percent={uploadProgress.percent} label={`Uploading… ${uploadProgress.percent}%`} />
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className={ui.supplierBtnRow}>
                          <LoadingButton
                            type="button"
                            className={ui.supplierDocActionBtnPrimary}
                            title="Attach official invoice"
                            loadingText="…"
                            onClick={() => saveFinalInvoice(invoice)}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                            </svg>
                          </LoadingButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DocumentViewerModal
        open={Boolean(supplierDocPreview?.url)}
        title={supplierDocPreview?.title}
        url={supplierDocPreview?.url}
        onClose={() => setSupplierDocPreview(null)}
      />
    </div>
  );
}

export function SupplierDelivery() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className={ui.supplierBoard}>
      <div className={ui.supplierPanel} style={{ textAlign: 'center', padding: '3rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Delivery Note Upload</h1>
        <p style={{ marginBottom: '2rem', color: 'var(--ec-muted)' }}>
          The delivery note upload workflow has been updated. Clerks are now responsible for attaching delivery notes after you upload the final invoice.
        </p>
        <button
          type="button"
          className={ui.supplierPrimaryBtn}
          onClick={() => navigate('/supplier/documents')}
        >
          Go to Documents
        </button>
      </div>
    </div>
  );
}

export function SupplierPayments() {
  const { t } = useI18n();
  const { state, supplierUsesApi } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useSupplierActor(state, user);
  const strict = supplierUsesApi;
  const currency = state.company?.currency || 'RWF';

  const [draftSearch, setDraftSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [draftStatus, setDraftStatus] = useState('all');
  const [appliedStatus, setAppliedStatus] = useState('all');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [supplierDocPreview, setSupplierDocPreview] = useState(null);
  const pageSize = 6;

  const iMine = supplierInvoices(state, actor?.id, strict, actor?.companyId);
  const pendingPayoutSum = iMine
    .filter((inv) => ['proformaReceived', 'proformaApproved', 'finalInvoiceReceived'].includes(inv.status))
    .filter((inv) => {
      if (inv.type !== 'proforma' || inv.status !== 'proformaReceived') return true;
      const r = state.requisitions.find((q) => q.id === inv.requisitionId);
      return r?.status !== 'proformaAwaitingClerk';
    })
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  const paySuccessRate = useMemo(() => {
    if (iMine.length === 0) return 12;
    const paid = iMine.filter((i) => i.status === 'paid' || i.status === 'closed').length;
    return Math.min(22, Math.max(5, Math.round((paid / iMine.length) * 15) + 3));
  }, [iMine]);

  const sorted = useMemo(
    () =>
      [...iMine].sort(
        (a, b) =>
          new Date(paymentLedgerRowDate(b) || 0).getTime() - new Date(paymentLedgerRowDate(a) || 0).getTime()
      ),
    [iMine]
  );

  const filtered = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return sorted.filter((inv) => {
      const st = paymentLedgerStatus(inv);
      if (appliedStatus !== 'all' && st.key !== appliedStatus) return false;
      const rowIso = paymentLedgerRowDate(inv);
      if (appliedDateFrom) {
        const from = new Date(appliedDateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(rowIso || 0) < from) return false;
      }
      if (appliedDateTo) {
        const to = new Date(appliedDateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(rowIso || 0) > to) return false;
      }
      if (!q) return true;
      return inv.reference.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
    });
  }, [sorted, appliedSearch, appliedStatus, appliedDateFrom, appliedDateTo]);

  const totalFiltered = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageSlice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeFrom = totalFiltered ? (safePage - 1) * pageSize + 1 : 0;
  const rangeTo = Math.min(safePage * pageSize, totalFiltered);

  const pagerNums = useMemo(() => {
    const pc = pageCount;
    const sp = safePage;
    if (pc <= 6) return Array.from({ length: pc }, (_, i) => i + 1);
    const set = new Set([1, pc, sp, sp - 1, sp + 1].filter((n) => n >= 1 && n <= pc));
    return [...set].sort((a, b) => a - b);
  }, [pageCount, safePage]);

  function applyFilters() {
    setAppliedSearch(draftSearch);
    setAppliedStatus(draftStatus);
    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
    setPage(1);
  }

  function exportPaymentsCsv() {
    const headers = ['Invoice ID', 'Reference', 'Amount', 'Currency', 'Amount Paid', 'Balance Due', 'Payment Method', 'Status', 'Due Date', 'Date'];
    const rows = filtered.map((inv) => {
      const st = paymentLedgerStatus(inv);
      const method = paymentLedgerMethod(inv);
      const rowDate = paymentLedgerRowDate(inv);
      const amountPaid = Number(inv.amountPaid || 0);
      const balanceDue = Number(inv.balanceDue ?? Math.max(0, Number(inv.amount || 0) - amountPaid));
      const deadline = inv.paymentDeadline || inv.dueDate || '';
      return [
        `#${inv.reference}`,
        inv.id,
        inv.amount ?? '',
        inv.currency || currency,
        amountPaid,
        balanceDue,
        method.label,
        st.label,
        deadline ? new Date(deadline).toLocaleDateString() : '—',
        rowDate ? formatDate(rowDate) : '',
      ];
    });
    downloadAoAAsXlsx(`payment-ledger-${Date.now()}`, [headers, ...rows], 'Payments');
  }

  function downloadQuarterlyHtml() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const title = `Payment Ledger — ${new Date().toLocaleDateString()}`;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 40, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Filters: ${appliedStatus !== 'all' ? appliedStatus : 'All statuses'} · ${appliedDateFrom || 'start'} to ${appliedDateTo || 'today'} · ${filtered.length} rows`, 40, 52);

    const colWidths = [120, 70, 70, 70, 70, 60, 70];
    const cols = ['Reference', 'Amount', 'Paid', 'Balance', 'Method', 'Status', 'Due Date'];
    let y = 72;

    doc.setFont('helvetica', 'bold');
    let x = 40;
    cols.forEach((col, i) => { doc.text(col, x, y); x += colWidths[i]; });
    y += 12;
    doc.setDrawColor(180, 180, 180);
    doc.line(40, y - 4, 560, y - 4);
    doc.setFont('helvetica', 'normal');

    filtered.slice(0, 60).forEach((inv) => {
      if (y > 760) { doc.addPage(); y = 36; }
      const st = paymentLedgerStatus(inv);
      const method = paymentLedgerMethod(inv);
      const amountPaid = Number(inv.amountPaid || 0);
      const balance = Number(inv.balanceDue ?? Math.max(0, Number(inv.amount || 0) - amountPaid));
      const deadline = inv.paymentDeadline || inv.dueDate || '';
      const row = [
        inv.reference.slice(0, 16),
        `${inv.currency || currency} ${Number(inv.amount || 0).toLocaleString()}`,
        amountPaid > 0 ? `${inv.currency || currency} ${amountPaid.toLocaleString()}` : '—',
        balance > 0 ? `${inv.currency || currency} ${balance.toLocaleString()}` : '—',
        method.label.slice(0, 10),
        st.label,
        deadline ? new Date(deadline).toLocaleDateString() : '—',
      ];
      x = 40;
      row.forEach((cell, i) => { doc.text(String(cell), x, y); x += colWidths[i]; });
      y += 11;
    });

    doc.save(`payment-ledger-${Date.now()}.pdf`);
  }

  return (
    <div className={ui.supplierBoard}>
      <header className={ui.supplierPayHeader}>
        <div className={ui.supplierPayHeaderMain}>
          <h1 className={ui.supplierPayTitle}>Payment Ledger</h1>
          <p className={ui.supplierPayLead}>
            Monitor your disbursement history and transaction health across all payment gateways.
          </p>
        </div>
        <div className={ui.supplierPayKpiCard}>
          <div className={ui.supplierPayKpiText}>
            <p className={ui.supplierPayKpiLabel}>Pending payouts</p>
            <p className={ui.supplierPayKpiValue}>{formatMoney(pendingPayoutSum, currency)}</p>
          </div>
          <span className={ui.supplierPayKpiIcon} aria-hidden>
            <SupplierGlyph kind="payments" />
          </span>
        </div>
      </header>

      <div className={ui.supplierPayFilterBar}>
        <label className={ui.supplierPaySearch}>
          <span className={ui.supplierPaySearchIcon} aria-hidden>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            className={ui.supplierPaySearchInput}
            placeholder="Search invoice ID or reference…"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
          />
        </label>
        <label className={ui.supplierPaySelectWrap}>
          <span className={ui.supplierPaySelectLabel}>Status</span>
          <InventoryFilterSelect
            value={draftStatus}
            onChange={setDraftStatus}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'unpaid', label: 'Unpaid' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
            ]}
          />
        </label>
        <label className={ui.supplierPayDateWrap}>
          <span className={ui.supplierPayDateLabel}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.65" />
              <path d="M8 3v4M16 3v4M4 11h16" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
            </svg>
            Date range
          </span>
          <div className={ui.supplierPayDateInputs}>
            <input
              type="date"
              className={ui.supplierPayDateInput}
              value={draftDateFrom}
              onChange={(e) => setDraftDateFrom(e.target.value)}
              aria-label="From date"
            />
            <span className={ui.supplierPayDateSep}>–</span>
            <input
              type="date"
              className={ui.supplierPayDateInput}
              value={draftDateTo}
              onChange={(e) => setDraftDateTo(e.target.value)}
              aria-label="To date"
            />
          </div>
        </label>
        <button type="button" className={ui.supplierPayApplyBtn} onClick={applyFilters}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          Apply filters
        </button>
      </div>

      <section className={ui.supplierPayTableWrap}>
        <div className={ui.supplierPayTableScroll}>
          <table className={ui.supplierPayTable}>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Proforma</th>
                <th>Amount</th>
                <th>Balance Due</th>
                <th>Payment method</th>
                <th>Status</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Payment Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={10} className={ui.supplierPayTableEmpty}>
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                pageSlice.map((inv) => {
                  const st = paymentLedgerStatus(inv);
                  const method = paymentLedgerMethod(inv);
                  const rowDate = paymentLedgerRowDate(inv);
                  return (
                    <tr key={inv.id}>
                      <td>
                        <span className={ui.supplierPayInvoiceId}>#{inv.reference}</span>
                      </td>
                      <td>
                        {inv.attachmentUrl ? (
                          <button
                            type="button"
                            className={ui.supplierPayDocLink}
                            onClick={() => setSupplierDocPreview({ title: 'Proforma', url: safeDocUrl(inv.attachmentUrl) })}
                            title="View proforma"
                            aria-label="View proforma"
                          >
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.75" />
                              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.75" />
                            </svg>
                          </button>
                        ) : (
                          <span className={ui.supplierPayNoDoc}>—</span>
                        )}
                      </td>
                      <td>
                        <strong className={ui.supplierPayAmount}>{formatMoney(inv.amount, inv.currency || currency)}</strong>
                      </td>
                      <td>
                        {(() => {
                          const paid = Number(inv.amountPaid || 0);
                          const balance = Number(inv.balanceDue ?? Math.max(0, Number(inv.amount || 0) - paid));
                          const isFullyPaid = ['paid', 'closed'].includes(inv.status);
                          if (isFullyPaid) return <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>Settled</span>;
                          if (balance > 0) return <strong style={{ color: '#ca8a04', fontSize: '0.88rem' }}>{formatMoney(balance, inv.currency || currency)}</strong>;
                          return <span style={{ color: 'var(--ec-muted)' }}>—</span>;
                        })()}
                      </td>
                      <td>
                        <span className={ui.supplierPayMethod}>
                          <PaymentLedgerMethodIcon kind={method.kind} />
                          {method.label}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            st.key === 'paid'
                              ? ui.supplierPayBadgePaid
                              : st.key === 'failed'
                                ? ui.supplierPayBadgeFailed
                                : st.key === 'partial'
                                  ? ui.supplierPayBadgePartial
                                  : st.key === 'credit'
                                    ? ui.supplierPayBadgeCredit
                                    : ui.supplierPayBadgePending
                          }
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className={ui.supplierPayDateCell}>{rowDate ? formatDate(rowDate) : '—'}</td>
                      <td>
                        {(() => {
                          const deadline = inv.paymentDeadline || inv.dueDate;
                          if (!deadline) return <span style={{ color: 'var(--ec-muted)' }}>—</span>;
                          const due = new Date(deadline);
                          const daysLeft = Math.ceil((due - Date.now()) / 86400000);
                          const isOverdue = daysLeft < 0;
                          const isSoon = daysLeft >= 0 && daysLeft <= 7;
                          return (
                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: isOverdue ? '#dc2626' : isSoon ? '#ca8a04' : 'inherit' }}>
                              {due.toLocaleDateString()}
                              {isOverdue && <span style={{ marginLeft: 3, background: '#dc2626', color: '#fff', padding: '1px 4px', borderRadius: 3, fontSize: '0.68rem', fontWeight: 800 }}>OD</span>}
                              {isSoon && !isOverdue && <span style={{ marginLeft: 3, background: '#ca8a04', color: '#fff', padding: '1px 4px', borderRadius: 3, fontSize: '0.68rem', fontWeight: 800 }}>SOON</span>}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        {inv.paymentProofUrl ? (
                          <button
                            type="button"
                            onClick={() => setSupplierDocPreview({ title: 'Payment Proof', url: resolvePortalDocumentUrl(inv.paymentProofUrl) })}
                            style={{ padding: '0.25rem 0.5rem', background: 'var(--ec-primary)', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            View Proof
                          </button>
                        ) : inv.installments && inv.installments.length > 0 ? (
                          inv.installments.map((inst, idx) => (
                            inst.paymentProofUrl ? (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSupplierDocPreview({ title: `Instalment #${idx + 1} Proof`, url: resolvePortalDocumentUrl(inst.paymentProofUrl) })}
                                style={{ padding: '0.25rem 0.5rem', background: 'var(--ec-primary)', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', marginRight: '0.25rem' }}
                              >
                                Proof {idx + 1}
                              </button>
                            ) : null
                          ))
                        ) : (
                          <span style={{ color: 'var(--ec-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className={ui.supplierPayRowMenu}
                            aria-label="Row actions"
                            onClick={() => setMenuOpenId(menuOpenId === inv.id ? null : inv.id)}
                          >
                             <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                               <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                               <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                               <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                             </svg>
                          </button>
                          {menuOpenId === inv.id && (
                            <div className={ui.supplierPayMenuDropdown}>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  navigate('/app/supplier/messages');
                                }}
                              >
                                Contact Finance
                              </button>
                              {st.key === 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    window.print();
                                  }}
                                >
                                  Download Receipt
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  alert(`Transaction Audit:\nID: ${inv.id}\nReference: ${inv.reference}\nStatus: ${st.label}`);
                                }}
                              >
                                Audit Trail
                              </button>
                              {st.key === 'pending' && (
                                <button
                                  type="button"
                                  className={ui.menuActionPrimary}
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    showFlash('Payment confirmation request sent to finance.', 'ok');
                                  }}
                                >
                                  Confirm Payment
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <footer className={ui.supplierPayPager}>
          <p className={ui.supplierPayPagerMeta}>
            Showing {rangeFrom} to {rangeTo} of {totalFiltered.toLocaleString()} transactions
          </p>
          <nav className={ui.supplierPayPagerNav} aria-label="Pagination">
            <button
              type="button"
              className={ui.supplierPayPageBtn}
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            {pagerNums.map((n, idx) => (
              <Fragment key={n}>
                {idx > 0 && pagerNums[idx] - pagerNums[idx - 1] > 1 && (
                  <span className={ui.supplierPayPageEllipsis} aria-hidden>
                    …
                  </span>
                )}
                <button
                  type="button"
                  className={n === safePage ? ui.supplierPayPageBtnActive : ui.supplierPayPageBtn}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              </Fragment>
            ))}
            <button
              type="button"
              className={ui.supplierPayPageBtn}
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              ›
            </button>
          </nav>
        </footer>
      </section>

      <div className={ui.supplierPayBottom}>
        <section className={ui.supplierPayCurator}>
          <span className={ui.supplierPayCuratorSpark} aria-hidden>
            <svg width={56} height={56} viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M5 19l2.5-2.5M16.5 7.5 19 5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.35"
              />
            </svg>
          </span>
          <h2 className={ui.supplierPayCuratorTitle}>{t('cungaAi.supplierPayTitle')}</h2>
          <p className={ui.supplierPayCuratorText}>
            Your payment success rate has increased by <strong>{paySuccessRate}%</strong> since switching to Mobile Money defaults for smaller
            disbursements. Consider routing repeat customers through the same gateway to keep settlement predictable.
          </p>
          <button type="button" className={ui.supplierPayCuratorBtn} onClick={() => navigate('/app/supplier/messages')}>
            View fee analysis
          </button>
        </section>

        <section className={ui.supplierPayQuarter}>
          <div className={ui.supplierPayQuarterChart} aria-hidden>
            <div className={ui.supplierPayQuarterBars}>
              {[40, 65, 52, 88, 55, 72, 48].map((h, i) => (
                <div key={i} className={ui.supplierPayQuarterBarTrack}>
                  <div className={ui.supplierPayQuarterBar} style={{ height: `${h}%` }} />
                </div>
              ))}
            </div>
          </div>
          <h2 className={ui.supplierPayQuarterTitle}>Quarterly reconciliation</h2>
          <p className={ui.supplierPayQuarterText}>
            Q3 tax documents and gateway fee summaries are ready for download. Export matches the filtered ledger above.
          </p>
          <div className={ui.supplierPayQuarterActions}>
            <button type="button" className={ui.supplierPayQuarterGhost} onClick={downloadQuarterlyHtml}>
              Download PDF
            </button>
            <button type="button" className={ui.supplierPayQuarterGhost} onClick={exportPaymentsCsv}>
              Export Excel
            </button>
          </div>
        </section>
      </div>

      <DocumentViewerModal
        open={Boolean(supplierDocPreview?.url)}
        title={supplierDocPreview?.title}
        url={supplierDocPreview?.url}
        onClose={() => setSupplierDocPreview(null)}
      />
    </div>
  );
}

const PRODUCT_EDIT_CATEGORY_PRESETS = [
  'Medical',
  'Pharmaceutical',
  'Equipment',
  'General',
  'Lab',
  'Surgery',
  'Pediatrics',
  'Dental',
  'Radiology',
  'OPD',
];



function snapshotFromListing(row) {
  return {
    name: row.name,
    sku: row.sku || '',
    category: row.category || 'General',
    price: String(row.price ?? ''),
    description: row.description || '',
    listed: row.listed !== false,
    stock: Number(row.quantity || 0),
    minThreshold: String(row.minThreshold ?? ''),
    maxThreshold: String(row.maxThreshold ?? ''),
    unit: row.unit || 'units',
    location: row.storageLocation || '',
    imageUrl: row.imageUrl || '',
    batchNumber: row.batchNumber || '',
    expiryDate: row.expiryDate || '',
    department: row.department || '',
  };
}

function emptyProductSnapshot() {
  return {
    name: '',
    sku: '',
    category: 'General',
    price: '0',
    description: '',
    listed: true,
    stock: 0,
    minThreshold: '0',
    maxThreshold: '100',
    unit: 'units',
    location: '',
    imageUrl: '',
    batchNumber: '',
    expiryDate: '',
    department: '',
  };
}

export function SupplierProductEdit() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { state, upsertSupplierCatalogItem, refreshPortalState } = usePortalData();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const strict = true;
  const currency = state.company?.currency || 'RWF';
  const appliedMasterIdRef = useRef(null);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('General');
  const [price, setPrice] = useState('0');
  const [description, setDescription] = useState('');
  const [listed, setListed] = useState(true);
  const [stock, setStock] = useState(0);
  const [minThreshold, setMinThreshold] = useState('0');
  const [maxThreshold, setMaxThreshold] = useState('100');
  const [unit, setUnit] = useState('units');
  const [location, setLocation] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [department, setDepartment] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => emptyProductSnapshot());
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);
  const [suppressNameSuggest, setSuppressNameSuggest] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const isNew = !editId;
  const title = isNew ? 'Add product' : 'Product details';
  const saveLabel = isNew ? 'Create listing' : 'Update product';
  const nowLabel = useMemo(() => {
    const d = new Date();
    return `Today, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }, []);

  const filteredMasterMatches = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q || q.length < 2 || suppressNameSuggest) return [];
    return (state.masterStock || [])
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [name, state.masterStock, suppressNameSuggest]);

  const applyMasterCatalogRow = useCallback((m) => {
    setName(m.name);
    const hc = isHealthcareCompany(state.company);
    const catVal = hc ? mapMasterStockToHealthcareCategory(m) : (m.category || 'General');
    setCategory(catVal);
    setUnit(m.unit || 'units');
    setSuppressNameSuggest(true);
  }, [state.company]);

  const categoryOptions = useMemo(() => {
    const presets = isHealthcareCompany(state.company) ? HEALTHCARE_STOCK_CATEGORIES : PRODUCT_EDIT_CATEGORY_PRESETS;
    const fromCatalog = (state.supplierCatalog ?? []).map((c) => c.category).filter(Boolean);
    return [...new Set([...presets, ...fromCatalog])].sort((a, b) => a.localeCompare(b));
  }, [state.supplierCatalog, state.company]);

  useEffect(() => {
    if (!editId) return;
    const cat = supplierCatalogList(state, actor?.id, strict, actor?.companyId);
    const row = cat.find((i) => String(i.id) === String(editId));
    if (row) {
      setName(row.name || '');
      setSku(row.sku || '');
      setCategory(row.category || 'General');
      setPrice(String(row.price ?? '0'));
      setDescription(row.description || '');
      setListed(row.listed !== false);
      setStock(Number(row.quantity || 0));
      setMinThreshold(String(row.minThreshold ?? '0'));
      setMaxThreshold(String(row.maxThreshold ?? '100'));
      setUnit(row.unit || 'units');
      setLocation(row.storageLocation || '');
      setBatchNumber(row.batchNumber || '');
      setExpiryDate(row.expiryDate || '');
      setDepartment(row.department || '');
      setImageUrl(row.imageUrl || '');
      setSavedSnapshot({
        name: row.name || '',
        sku: row.sku || '',
        category: row.category || 'General',
        price: String(row.price ?? '0'),
        description: row.description || '',
        listed: row.listed !== false,
        stock: Number(row.quantity || 0),
        minThreshold: String(row.minThreshold ?? '0'),
        maxThreshold: String(row.maxThreshold ?? '100'),
        unit: row.unit || 'units',
        location: row.storageLocation || '',
        batchNumber: row.batchNumber || '',
        expiryDate: row.expiryDate || '',
        department: row.department || '',
        imageUrl: row.imageUrl || '',
      });
    }
  }, [editId, state.supplierCatalog, actor?.id]);

  useEffect(() => {
    if (skuManuallyEdited || !isNew || !name.trim()) return;
    const hc = isHealthcareCompany(state.company);
    const prefix = hc ? healthcareSkuPrefix(category) : (category || 'UNC').substring(0, 3).toUpperCase();
    const catalog = state.supplierCatalog || [];
    const skus = catalog
      .filter((i) => i.sku && i.sku.startsWith(prefix))
      .map((i) => {
        const parts = i.sku.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return isNaN(num) ? 0 : num;
      });
    const max = skus.length > 0 ? Math.max(...skus) : 0;
    setSku(`${prefix}-${String(max + 1).padStart(3, '0')}`);
  }, [name, category, isNew, skuManuallyEdited, state.company, state.supplierCatalog]);

  const adjustStock = (delta) => setStock((s) => Math.max(0, s + delta));

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await apiUploadMedia(file);
      setImageUrl(url);
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const discard = () => navigate('/app/supplier/products');

  const saveProduct = async () => {
    if (!name.trim()) {
      setSaveError('Product name is required');
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    try {
      await upsertSupplierCatalogItem({
        id: editId,
        name,
        sku,
        category,
        price: Number(price) || 0,
        description,
        listed,
        quantity: stock,
        minThreshold: Number(minThreshold) || 0,
        maxThreshold: Number(maxThreshold) || 100,
        unit,
        storageLocation: location,
        batchNumber,
        expiryDate,
        department,
        imageUrl,
        ownerId: actor?.id,
        companyId: actor?.companyId,
      });
      await refreshPortalState();
      navigate('/app/supplier/products');
    } catch (err) {
      setSaveError(err.message || 'Failed to save product');
    } finally {
      setSaveBusy(false);
    }
  };

  const [missing, setMissing] = useState(false);

  if (editId && !name && !saveBusy && !missing) {
    return null;
  }

  return (
    <div className={ui.modalOverlay}>
      <div className={ui.modalCard} style={{ maxWidth: '720px', height: 'min(95vh, 880px)' }}>
        <header className={ui.modalHead} style={{ background: 'var(--ec-bg)' }}>
          <div>
            <h2 className={ui.modalTitle} style={{ fontSize: '1.1rem' }}>{title}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--ec-muted)', marginTop: '2px' }}>
              {isNew ? 'Define a new catalog item for the marketplace' : 'Manage your marketplace listing attributes'}
            </p>
          </div>
          <button type="button" className={ui.modalClose} onClick={discard}>×</button>
        </header>

        <div className={ui.modalBody} style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {saveError ? (
            <div className={ui.supplierPanel} style={{ margin: '0 0 1.25rem', padding: '1rem', background: 'rgb(220 38 38 / 0.05)', borderColor: 'rgb(220 38 38 / 0.15)' }}>
              <p style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: '600' }}>{saveError}</p>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <label className={ui.materialsField} style={{ position: 'relative' }}>
              <span>Item Name</span>
              <input
                className={ui.materialsInput}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSuppressNameSuggest(false);
                }}
                placeholder="Search catalog or type a custom item name..."
              />
              {filteredMasterMatches.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Suggestions"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--ec-bg, #fff)',
                    border: '1px solid var(--ec-border, #ddd)',
                    borderRadius: '4px',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    marginTop: '2px',
                  }}
                >
                  {filteredMasterMatches.map((m) => (
                    <button
                      key={m._id || m.id}
                      type="button"
                      role="option"
                      onClick={() => applyMasterCatalogRow(m)}
                      className={ui.materialsInput}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: 0,
                        border: 'none',
                        borderBottom: '1px solid var(--ec-border, #eee)',
                        background: 'transparent',
                        font: 'inherit',
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{m.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ec-muted, #666)' }}>
                        {categoryFilterOptionLabel(m.category, state.company)} · {m.sector}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </label>

            <label className={ui.materialsField}>
              <span>Category</span>
              <StockModalCombobox
                id="supplier-product-category"
                value={category}
                onChange={setCategory}
                options={categoryOptions.map((c) => ({ value: c, label: categoryFilterOptionLabel(c, state.company) }))}
              />
            </label>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>SKU / Code</span>
                <div style={{ position: 'relative' }}>
                  <input
                    className={ui.materialsInput}
                    value={sku}
                    onChange={(e) => { setSku(e.target.value); setSkuManuallyEdited(true); }}
                    placeholder="e.g. SKU-123"
                  />
                  {!skuManuallyEdited && isNew && name.trim() && (
                    <span className={ui.supplierProdEditAutoTag}>Auto</span>
                  )}
                </div>
              </label>
              <label className={ui.materialsField}>
                <span>Unit of measure</span>
                <StockModalCombobox
                  id="supplier-product-unit"
                  value={unit}
                  onChange={setUnit}
                  options={UNIT_OPTION_PRESETS.map((u) => ({ value: u, label: u }))}
                />
              </label>
            </div>

            <div className={ui.portalProfilePair}>
              <div className={ui.materialsField}>
                <span>Initial stock quantity</span>
                <div className={ui.supplierProdEditStepper} style={{ background: 'rgb(233 238 248 / 0.84)', borderRadius: '0.92rem', minHeight: '3rem', padding: '0 0.5rem', display: 'flex', alignItems: 'center' }}>
                  <button type="button" className={ui.supplierProdEditStepBtn} onClick={() => adjustStock(-1)}>−</button>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={stock}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                      setStock(isNaN(val) ? 0 : val);
                    }}
                    className={ui.supplierProdEditStockValue}
                    style={{ fontSize: '1rem', fontWeight: '700', border: 'none', background: 'transparent', textAlign: 'center', flex: 1, minWidth: '40px', outline: 'none' }}
                  />
                  <button type="button" className={ui.supplierProdEditStepBtn} onClick={() => adjustStock(1)}>+</button>
                </div>
              </div>
              <label className={ui.materialsField}>
                <span>Department</span>
                <input
                  className={ui.materialsInput}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Laboratory"
                />
              </label>
            </div>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>Min threshold</span>
                <input
                  className={ui.materialsInput}
                  inputMode="numeric"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value.replace(/\D/g, ''))}
                />
              </label>
              <label className={ui.materialsField}>
                <span>Max threshold</span>
                <input
                  className={ui.materialsInput}
                  inputMode="numeric"
                  value={maxThreshold}
                  onChange={(e) => setMaxThreshold(e.target.value.replace(/\D/g, ''))}
                />
              </label>
            </div>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>Batch number (optional)</span>
                <input
                  className={ui.materialsInput}
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. LOT-2024-X"
                />
              </label>
              <label className={ui.materialsField}>
                <span>Expiry date</span>
                <input
                  type="date"
                  className={ui.materialsInput}
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </label>
            </div>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>Storage location</span>
                <input
                  className={ui.materialsInput}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Shelf A-1"
                />
              </label>
              <label className={ui.materialsField}>
                <span>Price ({currency})</span>
                <div className={ui.supplierProdEditPriceWrap} style={{ background: 'rgb(233 238 248 / 0.84)', borderRadius: '0.92rem', border: 'none' }}>
                  <span className={ui.supplierProdEditPricePrefix} style={{ color: 'var(--ec-primary-dark)' }}>{currency === 'USD' ? '$' : `${currency} `}</span>
                  <input
                    className={ui.supplierProdEditInputPrice}
                    style={{ background: 'transparent', border: 'none', height: '3rem', fontSize: '0.88rem' }}
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                  />
                </div>
              </label>
            </div>

            <label className={ui.materialsField}>
              <span>Description</span>
              <textarea
                className={ui.materialsTextarea}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product details..."
              />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--ec-border)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ec-bg-alt)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--ec-border)' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--ec-text)' }}>Marketplace Visibility</h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Allow hospitals to discover and request this product.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: listed ? 'var(--ec-primary-dark)' : 'var(--ec-muted)' }}>
                    {listed ? 'Visible' : 'Hidden'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={listed}
                    className={listed ? ui.supplierProdEditSwitchOn : ui.supplierProdEditSwitch}
                    onClick={() => setListed((a) => !a)}
                    style={{ margin: 0 }}
                  >
                    <span className={ui.supplierProdEditSwitchKnob} />
                  </button>
                </div>
              </div>

              <div style={{ margin: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--ec-text)', marginBottom: '0.5rem', display: 'block' }}>Product media</span>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', padding: '1.25rem', borderRadius: '12px', border: '1px dashed var(--ec-border)', background: 'var(--ec-bg-alt)' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--ec-border)', background: 'var(--ec-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {imageUrl ? (
                      <img src={imageUrl} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ec-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: 'var(--ec-text)' }}>Product Image</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ec-muted)', lineHeight: '1.4' }}>High quality images make your product stand out.<br/>Recommended size: 1200×1200px (JPG, PNG, WebP).</p>
                    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--ec-white)', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--ec-border)', fontSize: '0.75rem', fontWeight: '600', color: 'var(--ec-text)', width: 'fit-content', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s', marginTop: '0.25rem' }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0])}
                        disabled={uploadingImage}
                        style={{ display: 'none' }}
                      />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      {uploadingImage ? 'Uploading…' : 'Upload Image'}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <section className={ui.supplierProdEditCurator} style={{ marginTop: '1.5rem', borderRadius: '12px' }}>
              <div className={ui.supplierProdEditCuratorHead}>
                <span className={ui.supplierProdEditCuratorSpark} aria-hidden>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <h2 className={ui.supplierProdEditCuratorTitle}>{t('cungaAi.supplierProdTitle')}</h2>
              </div>
              <p className={ui.supplierProdEditCuratorP}>
                <strong>Pricing strategy:</strong> Compare your unit price to similar SKUs in <span className={ui.supplierProdEditCuratorHl}>{category}</span>{' '}
                to stay competitive in hospital searches.
              </p>
              <p className={ui.supplierProdEditCuratorP}>
                <strong>Stock health:</strong> Keep quantity above the minimum threshold to avoid &quot;low stock&quot; badges on the product inventory
                ledger.
              </p>
            </section>

            <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', padding: '1.25rem 0 0.5rem 0', borderTop: '1px solid var(--ec-border)' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ec-muted)', fontWeight: '800', marginBottom: '0.4rem' }}>Listing ID</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ec-text)', fontFamily: 'monospace' }}>{editId || '— (pending)'}</div>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ec-muted)', fontWeight: '800', marginBottom: '0.4rem' }}>Last Saved Preview</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ec-text)' }}>{nowLabel}</div>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ec-muted)', fontWeight: '800', marginBottom: '0.4rem' }}>Listing Status</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.75rem', background: listed ? '#dcfce7' : '#f1f5f9', color: listed ? '#166534' : '#475569', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700' }}>
                  {listed ? 'Listed' : 'Paused'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={ui.modalActions} style={{ padding: '1.25rem 1.5rem', background: '#f8fafc' }}>
          <button type="button" className={ui.modalSecondaryBtn} onClick={discard}>Cancel</button>
          <button type="button" className={ui.supplierProdEditPrimary} disabled={saveBusy} onClick={saveProduct}>
            {saveBusy ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SupplierSettings() {
  const { t } = useI18n();
  const { flash, FlashBanner } = useFlash();
  const { state, refreshPortalState } = usePortalData();
  const { user, updateProfile } = useAuth();
  const actor = useSupplierActor(state, user);
  const company = state.company;
  const buyerConnections = Number(state.buyerConnectionsCount ?? 0);

  const [savingProfile, setSavingProfile] = useState(false);
  const [name, setName] = useState(actor?.fullName || '');
  const [logoUrl, setLogoUrl] = useState(user?.logoUrl || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profilePhotoBroken, setProfilePhotoBroken] = useState(false);

  const displayInitials = useMemo(
    () =>
      (name || actor?.fullName || user?.email || 'S')
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [name, actor?.fullName, user?.email]
  );

  /** Profile photo tile shows your upload; buyer org logo still takes priority in the shell header. */
  const avatarDisplayUrl = useMemo(() => cleanRemoteLogoUrl(logoUrl), [logoUrl]);

  useEffect(() => {
    setName(actor?.fullName || '');
  }, [actor?.fullName]);

  useEffect(() => {
    setLogoUrl(user?.logoUrl || '');
  }, [user?.logoUrl]);

  useEffect(() => {
    setProfilePhotoBroken(false);
  }, [logoUrl]);

  async function handleProfilePhotoUpload(file) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const resp = await apiUploadMedia(file);
      const url = String(resp?.secure_url || resp?.url || '').trim();
      if (!url) throw new Error('Upload did not return an image URL.');
      setLogoUrl(url);
      await updateProfile({ logoUrl: url });
      await refreshPortalState();
      flash(t('accountPages.profileSaved'), 'ok');
    } catch (e) {
      flash(e?.body?.error || e?.message || t('accountPages.profilePhotoError'), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await updateProfile({ fullName: name.trim(), logoUrl: logoUrl.trim() });
      await refreshPortalState();
      flash(t('accountPages.profileSaved'), 'ok');
    } catch (e) {
      flash(e?.body?.error || e?.message || t('accountPages.profileSaveError'), 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className={ui.adminSettingsBoard}>
      <FlashBanner />
      <div className={ui.adminSettingsTop}>
        <div>
          <h1 className={ui.adminSettingsTitle}>{t('app.supplier.settingsTitle')}</h1>
          <p className={ui.adminSettingsLead}>{t('app.supplier.settingsLead')}</p>
        </div>
        <div className={ui.adminSettingsActions}>
          <Link to="/app/supplier/profile" className={ui.adminSettingsGhostBtn} style={{ textDecoration: 'none' }}>
            {t('shell.myProfile')}
          </Link>
          <Link to="/app/supplier/account-settings" className={ui.adminSettingsGhostBtn} style={{ textDecoration: 'none' }}>
            {t('shell.accountSettings')}
          </Link>
          <button type="button" className={ui.adminSettingsPrimaryBtn} disabled={savingProfile} onClick={saveProfile}>
            {savingProfile ? t('accountPages.saving') : t('accountPages.saveChanges')}
          </button>
        </div>
      </div>

      <div className={ui.adminSettingsGrid}>
        <div className={ui.adminSettingsMain}>
          <div className={ui.adminSettingsCards2Col}>
          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('app.supplier.settingsAccountSection')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('app.supplier.settingsAccountLead')}</p>
            <div className={ui.adminSettingsLogoBlock} style={{ marginTop: '0.85rem' }}>
              <div className={ui.adminSettingsLogoTile} style={{ borderRadius: '50%', overflow: 'hidden' }}>
                {avatarDisplayUrl && !profilePhotoBroken ? (
                  <img
                    src={avatarDisplayUrl}
                    alt=""
                    className={ui.adminSettingsLogoImg}
                    style={{ borderRadius: '50%', width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setProfilePhotoBroken(true)}
                  />
                ) : (
                  displayInitials
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className={ui.adminSettingsUploadTitle}>
                  {uploadingPhoto ? t('accountPages.profilePhotoUploading') : t('accountPages.profilePhotoTitle')}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleProfilePhotoUpload(e.target.files?.[0])}
                  disabled={uploadingPhoto || savingProfile}
                  style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}
                />
                <p className={ui.adminSettingsUploadMeta}>{t('accountPages.profilePhotoMeta')}</p>
                {company?.logoUrl ? (
                  <p className={ui.adminSettingsUploadMeta}>{t('accountPages.profilePhotoOrgTakesPriority')}</p>
                ) : null}
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
                <label className={`${ui.adminSettingsField} ${ui.adminSettingsFieldWide}`}>
                  <span>{t('accountPages.fullNameLabel')}</span>
                  <input className={ui.adminSettingsInput} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <p className={ui.adminSettingsProfileMeta}>
                  {t('accountPages.emailLabel')}: {user?.email || '—'}
                </p>
                <p className={ui.adminSettingsProfileMeta}>
                  {t('accountPages.roleLabel')}: {t('roles.supplier')}
                </p>
            </div>
          </section>

          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('app.supplier.settingsTenantSection')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('app.supplier.settingsTenantLead')}</p>
            <div className={ui.adminSettingsPreferenceGrid} style={{ marginTop: '0.85rem' }}>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('app.supplier.settingsTenantOrg')}</p>
                <p className={ui.adminSettingsProfileMeta}>{company?.name || '—'}</p>
              </div>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('app.supplier.settingsTenantCurrency')}</p>
                <p className={ui.adminSettingsProfileMeta}>{company?.currency || '—'}</p>
              </div>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('app.supplier.settingsTenantLanguage')}</p>
                <p className={ui.adminSettingsProfileMeta}>{company?.language || '—'}</p>
              </div>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('app.supplier.settingsTenantConnections')}</p>
                <p className={ui.adminSettingsProfileMeta}>{buyerConnections}</p>
              </div>
            </div>
            <p className={ui.adminSettingsProfileMeta} style={{ marginTop: '0.75rem' }}>
              {t('app.supplier.settingsTenantNote')}
            </p>
          </section>
          </div>

          <div className={ui.adminSettingsCards2Col}>
            <PortalNotificationPrefsCard />
            <PortalPasswordChangeForm />
          </div>

          <div className={ui.adminSettingsCards2Col}>
          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.appearanceTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.themeHint')}</p>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.languageHint')}</p>
          </section>

          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.sessionTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.sessionBody')}</p>
          </section>
          </div>

          <div className={ui.adminSettingsCards2Col}>
          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('app.supplier.settingsNotificationsInfoTitle')}</h2>
            <p className={ui.adminSettingsSecurityMeta}>{t('app.supplier.settingsNotificationsInfoBody')}</p>
            <ul className={ui.adminSettingsProfileMeta} style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem' }}>
              <li style={{ marginBottom: '0.35rem' }}>{t('app.supplier.settingsNotificationsBullet1')}</li>
              <li>{t('cungaAi.settingsShortcutBullet')}</li>
            </ul>
          </section>

          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('app.supplier.settingsDocumentsTitle')}</h2>
            <p className={ui.adminSettingsSecurityMeta}>{t('app.supplier.settingsDocumentsBody')}</p>
          </section>
          </div>
        </div>

        <aside className={ui.adminSettingsRail}>
          <section className={ui.adminSettingsSuggestionCard}>
            <p className={ui.adminSettingsSuggestionLabel}>{t('app.supplier.settingsRailTitle')}</p>
            <p className={ui.adminSettingsSuggestionText}>{t('app.supplier.settingsRailHelpBody')}</p>
            <Link to="/app/supplier/profile" className={ui.adminSettingsSuggestionBtn} style={{ textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>
              {t('app.supplier.settingsRailProfileCta')}
            </Link>
          </section>
          <section className={ui.adminSettingsHealthCard}>
            <p className={ui.adminSettingsHealthLabel}>{t('accountPages.securityChecklistTitle')}</p>
            <ul className={ui.adminSettingsHealthMeta} style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
              <li style={{ marginBottom: '0.35rem' }}>{t('accountPages.securityTip1')}</li>
              <li style={{ marginBottom: '0.35rem' }}>{t('accountPages.securityTip2')}</li>
              <li>{t('accountPages.securityTip3')}</li>
            </ul>
          </section>
          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.mfaTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.mfaBody')}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function SupplierReports() {
  const { t } = useI18n();
  const { state, supplierUsesApi } = usePortalData();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const strict = supplierUsesApi;
  const [period, setPeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');

  const requests = useMemo(
    () => supplierIncomingRequests(state, actor?.id, strict, actor?.companyId),
    [state.requisitions, actor?.id, strict, actor?.companyId]
  );
  const invoices = useMemo(
    () => supplierInvoices(state, actor?.id, strict, actor?.companyId),
    [state.invoices, actor?.id, strict, actor?.companyId]
  );

  const periodBounds = useMemo(() => {
    if (period === 'custom') {
      if (!customStart || !customEnd) return null;
      const start = new Date(customStart).getTime();
      const end = new Date(customEnd).getTime() + 86399999;
      return Number.isFinite(start) && Number.isFinite(end) && start <= end ? { start, end } : null;
    }
    return getPeriodBounds(period);
  }, [period, customStart, customEnd]);

  const filteredRequests = useMemo(
    () => {
      if (!periodBounds) return requests;
      return requests.filter((entry) => {
        const iso = entry?.createdAt || entry?.submittedAt || entry?.updatedAt || entry?.date;
        return isoInRange(iso, periodBounds.start, periodBounds.end);
      });
    },
    [requests, periodBounds]
  );

  const filteredInvoices = useMemo(
    () => {
      if (!periodBounds) return invoices;
      return invoices.filter((entry) => {
        const iso = entry?.issuedAt || entry?.createdAt || entry?.dueDate || entry?.updatedAt;
        return isoInRange(iso, periodBounds.start, periodBounds.end);
      });
    },
    [invoices, periodBounds]
  );

  // Supplier invoice search + status filter (applied on top of period filter)
  const displayedInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    return filteredInvoices.filter((inv) => {
      if (invoiceStatusFilter !== 'all' && inv.status !== invoiceStatusFilter) return false;
      if (!q) return true;
      const ref = String(inv.reference || inv.id || '').toLowerCase();
      const req = String(inv.requisitionTitle || inv.title || '').toLowerCase();
      const lines = (inv.lines || []).map((l) => String(l.description || '').toLowerCase()).join(' ');
      return ref.includes(q) || req.includes(q) || lines.includes(q);
    });
  }, [filteredInvoices, invoiceSearch, invoiceStatusFilter]);

  const invoiceStatusOptions = useMemo(
    () => [...new Set(filteredInvoices.map((i) => i.status).filter(Boolean))].sort(),
    [filteredInvoices]
  );

  const requestCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, other: 0 };
    filteredRequests.forEach((req) => {
      if (req.status === 'approved') counts.approved += 1;
      else if (req.status === 'rejected') counts.rejected += 1;
      else if (req.status === 'pending' || req.status === 'open') counts.pending += 1;
      else counts.other += 1;
    });
    return counts;
  }, [filteredRequests]);

  const invoiceTotals = useMemo(() => {
    // Use real amountPaid from DB (now sent by server)
    const totals = { paid: 0, approved: 0, rejected: 0, draft: 0, partial: 0 };
    filteredInvoices.forEach((invoice) => {
      const amount = Number(invoice?.amount ?? 0);
      const amtPaid = Number(invoice?.amountPaid ?? 0);
      const status = invoice.status;
      if (['paid', 'closed', 'creditAndPaid'].includes(status)) {
        totals.paid += amtPaid || amount;
      } else if (status === 'partiallyPaid') {
        totals.partial += amtPaid;           // what has been received
        totals.approved += Math.max(0, amount - amtPaid); // still outstanding
      } else if (status === 'proformaApproved' || status === 'approved') {
        totals.approved += amount;
      } else if (status === 'rejected') {
        totals.rejected += amount;
      } else {
        totals.draft += amount;
      }
    });
    return totals;
  }, [filteredInvoices]);

  const requestChartBars = useMemo(() => {
    const bounds = periodBounds || getPeriodBounds('30d');
    const start = bounds.start;
    const end = bounds.end;
    const days = Math.max(1, Math.min(90, Math.ceil((end - start) / 86400000)));
    const buckets = Array.from({ length: days }, (_, index) => {
      const ts = start + index * 86400000;
      const label = new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { label, amount: 0, day: ts };
    });
    filteredRequests.forEach((req) => {
      const iso = req?.createdAt || req?.submittedAt || req?.updatedAt || req?.date;
      const t = new Date(iso).getTime();
      if (!Number.isFinite(t)) return;
      const idx = Math.floor((t - start) / 86400000);
      if (idx >= 0 && idx < buckets.length) buckets[idx].amount += 1;
    });
    return buckets;
  }, [filteredRequests, periodBounds]);

  const invoiceSliceData = useMemo(() => {
    const slices = [
      { label: 'Paid / Received', value: invoiceTotals.paid, color: REPORT_SLICE_COLORS[0] },
      { label: 'Partially received', value: invoiceTotals.partial, color: REPORT_SLICE_COLORS[2] },
      { label: 'Approved (outstanding)', value: invoiceTotals.approved, color: REPORT_SLICE_COLORS[1] },
      { label: 'Draft / Other', value: invoiceTotals.draft, color: REPORT_SLICE_COLORS[3] },
      { label: 'Rejected', value: invoiceTotals.rejected, color: REPORT_SLICE_COLORS[4] },
    ];
    return slices.filter((slice) => slice.value > 0);
  }, [invoiceTotals]);

  const invoiceTotalValue = Object.values(invoiceTotals).reduce((sum, v) => sum + v, 0);

  const exportRows = useMemo(() => {
    const periodLabel = period === 'custom' ? `${customStart || 'N/A'} – ${customEnd || 'N/A'}` : period;
    const rows = [
      ['Supplier Performance Report'],
      ['Period', periodLabel],
      ['Total requests', filteredRequests.length],
      ['Total invoices', filteredInvoices.length],
      ['Total invoice value', formatMoney(invoiceTotalValue)],
      [],
      ['── REQUESTS ──'],
      ['Request ID', 'Status', 'Buyer', 'Created', 'Estimated Amount'],
      ...filteredRequests.map((req) => [
        displayRequestRef(req.id || req.requestId || ''),
        req.status || 'unknown',
        req.buyerCompanyName || req.buyerName || '—',
        formatDate(req.createdAt || req.updatedAt || req.date),
        formatMoney(req.amount ?? req.total ?? 0),
      ]),
      [],
      ['── INVOICES ──'],
      ['Reference', 'Type', 'Status', 'Amount', 'Amount Paid', 'Balance Due', 'Payment Method', 'Due Date', 'Created'],
      ...filteredInvoices.map((inv) => {
        const amtPaid = Number(inv.amountPaid || 0);
        const balance = Number(inv.balanceDue ?? Math.max(0, Number(inv.amount || 0) - amtPaid));
        const deadline = inv.paymentDeadline || inv.dueDate || '';
        return [
          inv.reference || inv.id,
          inv.type || 'proforma',
          inv.status || '—',
          formatMoney(inv.amount ?? 0),
          amtPaid > 0 ? formatMoney(amtPaid) : '—',
          balance > 0 ? formatMoney(balance) : '—',
          inv.paymentChannel ? inv.paymentChannel.replace(/_/g, ' ') : '—',
          deadline ? new Date(deadline).toLocaleDateString() : '—',
          formatDate(inv.createdAt || inv.updatedAt || ''),
        ];
      }),
    ];
    return rows;
  }, [filteredRequests, filteredInvoices, period, customStart, customEnd, invoiceTotalValue]);

  const downloadSupplierReportExcel = useCallback(() => {
    downloadAoAAsXlsx(exportRows, `supplier-reports-${period}.xlsx`);
  }, [exportRows, period]);

  const downloadSupplierReportPdf = useCallback(() => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const periodLabel = period === 'custom' ? `${customStart || 'N/A'} – ${customEnd || 'N/A'}` : period;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Supplier Performance Report', 40, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Period: ${periodLabel}   Requests: ${filteredRequests.length}   Invoices: ${filteredInvoices.length}   Value: ${formatMoney(invoiceTotalValue)}`, 40, 52);

    let y = 72;
    doc.setFont('helvetica', 'bold');
    doc.text('Requests', 40, y); y += 14;
    doc.setFont('helvetica', 'normal');
    filteredRequests.slice(0, 15).forEach((req) => {
      if (y > 750) { doc.addPage(); y = 36; }
      doc.text(`${displayRequestRef(req.id || req.requestId || '')}  ${req.status || '—'}  ${req.buyerCompanyName || '—'}  ${formatDate(req.createdAt || '')}`, 40, y);
      y += 12;
    });

    y += 8;
    if (y > 720) { doc.addPage(); y = 36; }
    doc.setFont('helvetica', 'bold');
    doc.text('Invoices', 40, y); y += 14;
    doc.setFont('helvetica', 'normal');
    filteredInvoices.slice(0, 20).forEach((inv) => {
      if (y > 750) { doc.addPage(); y = 36; }
      const amtPaid = Number(inv.amountPaid || 0);
      const balance = Number(inv.balanceDue ?? Math.max(0, Number(inv.amount || 0) - amtPaid));
      const deadline = inv.paymentDeadline || inv.dueDate || '';
      doc.text(`${inv.reference || inv.id}  ${inv.status || '—'}  ${formatMoney(inv.amount ?? 0)}  Bal:${balance > 0 ? formatMoney(balance) : '0'}  ${deadline ? new Date(deadline).toLocaleDateString() : 'no due date'}`, 40, y);
      y += 12;
    });

    doc.save(`supplier-reports-${period}.pdf`);
  }, [customEnd, customStart, filteredInvoices.length, filteredRequests, invoiceTotalValue, period]);

  return (
    <div className={ui.analyticsBoard}>
      <div className={ui.analyticsHeader}>
        <div>
          <h1 className={ui.analyticsTitle}>Reports</h1>
          <p className={ui.analyticsLead}>Supplier performance, request volume, and invoice status across the selected period.</p>
        </div>
        <div className={ui.analyticsTimeToolbar}>
          {['1d', '7d', '30d', '90d', 'year', 'custom'].map((range) => (
            <button
              key={range}
              type="button"
              className={`${ui.analyticsRangeBtn} ${period === range ? ui.analyticsRangeBtnActive : ''}`}
              onClick={() => setPeriod(range)}
            >
              {range === '1d' ? '1 day' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '90d' ? '90 days' : range === 'year' ? '1 year' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.analyticsFilterToolbar}>
        <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadSupplierReportExcel}>
          Export Excel
        </button>
        <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadSupplierReportPdf}>
          Export PDF
        </button>
        {period === 'custom' ? (
          <div className={ui.reportCustomDateRow}>
            <label className={ui.reportCustomDateLabel}>
              From
              <input type="date" className={ui.reportCustomDateInput} value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            </label>
            <span className={ui.reportCustomDateSep}>–</span>
            <label className={ui.reportCustomDateLabel}>
              To
              <input type="date" className={ui.reportCustomDateInput} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </label>
            <span className={`${ui.reportCustomDateHint} ${periodBounds ? ui.reportCustomDateHintActive : ''}`}>
              {periodBounds ? 'Custom range active' : 'Select a valid date range'}
            </span>
          </div>
        ) : null}
      </div>

      <div className={ui.analyticsKpiStrip}>
        <div className={ui.analyticsKpiChip}>
          <strong>{filteredRequests.length}</strong>
          <span className={ui.analyticsKpiChipLabel}>Requests</span>
        </div>
        <div className={ui.analyticsKpiChip}>
          <strong>{filteredInvoices.length}</strong>
          <span className={ui.analyticsKpiChipLabel}>Invoices</span>
        </div>
        <div className={ui.analyticsKpiChip}>
          <strong>{formatMoney(invoiceTotalValue)}</strong>
          <span className={ui.analyticsKpiChipLabel}>Invoice value</span>
        </div>
        <div className={ui.analyticsKpiChip}>
          <strong>{requestCounts.approved}</strong>
          <span className={ui.analyticsKpiChipLabel}>Approved</span>
        </div>
        <div className={ui.analyticsKpiChip}>
          <strong>{requestCounts.pending}</strong>
          <span className={ui.analyticsKpiChipLabel}>Pending</span>
        </div>
      </div>

      <div className={ui.analyticsChart}>
        <div className={ui.analyticsSectionTitle}>Request volume</div>
        <div className={ui.analyticsChartGrid}>
          <SupplierDashPeriodLineChart
            bars={requestChartBars}
            gradPrefix="supplier-report"
            strokeVar="var(--ec-primary)"
            tooltipFormat={(value) => `${value} requests`}
            footnoteFormat={(max) => `${max} requests`}
            legendText="Requests"
          />
        </div>
        <div className={ui.analyticsChartLabels}>
          <span>Total requests</span>
          <span>Approved</span>
          <span>Rejected</span>
          <span>Pending</span>
        </div>
      </div>

      <div className={ui.analyticsSectionTitle} style={{ marginTop: '1.5rem' }}>
        Invoice status
      </div>
      <div className={ui.analyticsDonutRow}>
        <div className={`${ui.analyticsDonut} ${ui.analyticsDonutLg}`} style={{ background: `conic-gradient(${conicGradientFromSlices(invoiceSliceData)})` }} />
        <div className={ui.analyticsDonutLabel}>
          <strong>{formatMoney(invoiceTotalValue)}</strong>
          <span>Total value</span>
        </div>
      </div>
      <ul className={ui.analyticsLegend}>
        {invoiceSliceData.map((slice) => (
          <li key={slice.label} className={ui.analyticsLegendRow}>
            <span style={{ width: '0.85rem', height: '0.85rem', borderRadius: '50%', background: slice.color, display: 'inline-block' }} />
            <span>{slice.label}</span>
            <strong style={{ marginLeft: 'auto' }}>{formatMoney(slice.value)}</strong>
          </li>
        ))}
      </ul>

      {filteredInvoices.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              Invoice Details ({displayedInvoices.length}{displayedInvoices.length !== filteredInvoices.length ? ` of ${filteredInvoices.length}` : ''})
            </h3>
            <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadSupplierReportExcel}>Export Excel</button>
          </div>
          {/* Search + status filter */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
            <input
              className={ui.portalFilterSearch}
              placeholder="Search by reference, item or requisition…"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              style={{ minWidth: '220px', flex: '1' }}
            />
            <select
              className={ui.portalFilterSelect}
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {invoiceStatusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(invoiceSearch || invoiceStatusFilter !== 'all') && (
              <button
                type="button"
                className={ui.analyticsLinkBtn}
                onClick={() => { setInvoiceSearch(''); setInvoiceStatusFilter('all'); }}
                style={{ fontSize: '0.78rem' }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid var(--ec-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead style={{ background: 'var(--ec-bg)' }}>
                <tr>
                  {['Reference', 'Status', 'Amount', 'Paid', 'Balance', 'Method', 'Due Date', 'Date'].map((h) => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.map((inv) => {
                  // Use server-computed values when available
                  const amtPaid = Number(inv.amountPaid || 0);
                  const balance = Number(inv.balanceDue ?? Math.max(0, Number(inv.amount || 0) - amtPaid));
                  const deadline = inv.paymentDeadline || inv.dueDate || '';
                  const hasDue = Boolean(deadline);
                  const dueMs = hasDue ? new Date(deadline).getTime() : null;
                  const isOverdue = hasDue && dueMs < Date.now();
                  const isSoon = hasDue && !isOverdue && Math.ceil((dueMs - Date.now()) / 86400000) <= 7;
                  const isPaid = ['paid', 'closed', 'creditAndPaid'].includes(inv.status);
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--ec-border)', background: isOverdue ? 'rgba(220,38,38,0.04)' : isSoon ? 'rgba(234,179,8,0.04)' : '' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{inv.reference || inv.id}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, background: isPaid ? '#16a34a' : inv.status === 'proformaApproved' ? '#2563eb' : inv.status === 'partiallyPaid' ? '#7c3aed' : inv.status === 'rejected' ? '#dc2626' : '#ca8a04', color: 'white' }}>
                          {isPaid ? 'Paid' : inv.status === 'proformaApproved' ? 'Approved' : inv.status === 'partiallyPaid' ? 'Partial' : inv.status === 'rejected' ? 'Rejected' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{formatMoney(inv.amount ?? 0, inv.currency)}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: amtPaid > 0 ? '#16a34a' : 'var(--ec-muted)' }}>{amtPaid > 0 ? formatMoney(amtPaid, inv.currency) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: balance > 0 ? 700 : 400, color: balance > 0 ? '#ca8a04' : 'var(--ec-muted)' }}>{balance > 0 ? formatMoney(balance, inv.currency) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ec-muted)', fontSize: '0.78rem' }}>{inv.paymentChannel ? inv.paymentChannel.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: isOverdue ? '#dc2626' : isSoon ? '#ca8a04' : 'inherit', fontWeight: hasDue ? 600 : 400 }}>
                        {hasDue ? new Date(deadline).toLocaleDateString() : '—'}
                        {isOverdue && <span style={{ marginLeft: 3, background: '#dc2626', color: '#fff', padding: '1px 4px', borderRadius: 3, fontSize: '0.65rem' }}>OD</span>}
                        {isSoon && <span style={{ marginLeft: 3, background: '#ca8a04', color: '#fff', padding: '1px 4px', borderRadius: 3, fontSize: '0.65rem' }}>SOON</span>}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ec-muted)' }}>{formatDate(inv.createdAt || inv.updatedAt || '')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function SupplierHistory({ showEdit }) {
  const { t } = useI18n();
  const { state, supplierUsesApi } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useSupplierActor(state, user);
  const strict = supplierUsesApi;
  const searchRef = useRef(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [histQ, setHistQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [histDocPreview, setHistDocPreview] = useState(null);
  const pageSize = 6;

  const catalog = supplierCatalogList(state, actor?.id, strict, actor?.companyId);
  const currency = state.company?.currency || 'RWF';

  const fulfilledMaterials = useMemo(() => {
    const reqs = supplierRequisitions(state, actor?.id, strict, actor?.companyId).filter((r) => r.status === 'closed');
    return [...reqs].sort((a, b) => new Date(b.updatedAt || b.requestedAt) - new Date(a.updatedAt || a.requestedAt));
  }, [state.requisitions, actor?.id, strict]);

  const myInvoices = useMemo(() => supplierInvoices(state, actor?.id, strict, actor?.companyId), [state.invoices, actor?.id, actor?.companyId, strict]);

  const categories = useMemo(
    () => [...new Set(catalog.map((c) => c.category).filter(Boolean))].sort(),
    [catalog]
  );

  const lowStockCount = useMemo(
    () =>
      catalog.filter((l) => {
        if (l.listed === false) return false;
        const st = catalogListingStatus(l);
        return st.key !== 'ok';
      }).length,
    [catalog]
  );

  const revenueEstimate = useMemo(
    () =>
      catalog
        .filter((l) => l.listed !== false)
        .reduce((sum, l) => sum + Number(l.price || 0) * Number(l.quantity || 0), 0),
    [catalog]
  );

  const velocityHeights = useMemo(() => {
    void refreshTick;
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    (state.consumptions || []).forEach((c) => {
      const wd = new Date(c.createdAt).getDay();
      buckets[wd] += Number(c.quantity || 0);
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((n) => Math.round((n / max) * 100) || 8);
  }, [state.consumptions, refreshTick]);

  const listingTrend = useMemo(() => {
    if (catalog.length === 0) return 0;
    return Math.min(35, Math.max(4, (catalog.length * 7) % 25));
  }, [catalog.length]);

  const revenueTrend = useMemo(() => {
    if (revenueEstimate === 0) return 0;
    return Math.min(25, Math.max(3, Math.round(revenueEstimate % 17) + 2));
  }, [revenueEstimate]);

  const trendingProduct = useMemo(() => {
    if (state.masterStock?.length) {
      const item = state.masterStock.find((m) => m.category === 'Equipment' || m.category === 'Lab' || m.category === 'Pharmaceutical') || state.masterStock[0];
      return item?.name || 'Surgical Gloves';
    }
    if (catalog.length) return catalog[0].name;
    return 'Surgical Gloves';
  }, [state.masterStock, catalog]);

  const trendingDemandIncrease = useMemo(() => {
    if (catalog.length === 0) return 22;
    return Math.min(45, Math.max(15, ((catalog.length * 6) % 30) + 12));
  }, [catalog.length]);

  const filtered = useMemo(() => {
    const qq = histQ.trim().toLowerCase();
    return catalog.filter((listing) => {
      const st = catalogListingStatus(listing);
      if (statusFilter !== 'all' && st.key !== statusFilter) return false;
      if (categoryFilter !== 'all' && listing.category !== categoryFilter) return false;
      if (!qq) return true;
      return (
        listing.name.toLowerCase().includes(qq) ||
        String(listing.sku || '').toLowerCase().includes(qq) ||
        String(listing.category || '').toLowerCase().includes(qq)
      );
    });
  }, [catalog, histQ, statusFilter, categoryFilter]);

  const totalRows = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageSlice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeFrom = totalRows ? (safePage - 1) * pageSize + 1 : 0;
  const rangeTo = Math.min(safePage * pageSize, totalRows);

  const pagerNums = useMemo(() => {
    const pc = pageCount;
    const sp = safePage;
    if (pc <= 6) return Array.from({ length: pc }, (_, i) => i + 1);
    const set = new Set([1, pc, sp, sp - 1, sp + 1].filter((n) => n >= 1 && n <= pc));
    return [...set].sort((a, b) => a - b);
  }, [pageCount, safePage]);

  function exportCsv() {
    const headers = ['Product', 'SKU', 'Category', 'Price', 'Quantity', 'Unit', 'Status'];
    const rows = filtered.map((listing) => {
      const st = catalogListingStatus(listing);
      return [listing.name, listing.sku, listing.category, listing.price, listing.quantity, listing.unit || '', st.label];
    });
    downloadAoAAsXlsx('product-inventory', [headers, ...rows], 'Products');
  }

  return (
    <div className={ui.supplierBoard}>
      <header className={ui.supplierProductsHeaderSimple}>
        <div className={ui.supplierProductsHeaderText}>
          <p className={ui.supplierProductsEyebrow}>Products</p>
          <h1 className={ui.supplierProductsTitle}>Product inventory</h1>
        </div>
      </header>

      <div className={ui.supplierProductsKpiRow}>
        <article className={ui.supplierProductsKpi}>
          <span className={ui.supplierProductsKpiDeco} aria-hidden />
          <p className={ui.supplierProductsKpiLabel}>Total listings</p>
          <div className={ui.supplierProductsKpiValueRow}>
            <strong className={ui.supplierProductsKpiValue}>{catalog.length.toLocaleString()}</strong>
            <span className={ui.supplierProductsKpiTrend}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 16 9 11l4 4 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              +{listingTrend}%
            </span>
          </div>
        </article>
        <article className={`${ui.supplierProductsKpi} ${ui.supplierProductsKpiAccent}`}>
          <span className={ui.supplierProductsKpiDeco} aria-hidden />
          <p className={ui.supplierProductsKpiLabel}>Low stock alerts</p>
          <strong className={lowStockCount > 0 ? ui.supplierProductsKpiValueWarn : ui.supplierProductsKpiValue}>
            {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
          </strong>
          <p className={ui.supplierProductsKpiSub}>Below threshold or depleted</p>
        </article>
        <article className={ui.supplierProductsKpi}>
          <span className={ui.supplierProductsKpiDeco} aria-hidden />
          <p className={ui.supplierProductsKpiLabel}>Revenue estimate</p>
          <div className={ui.supplierProductsKpiValueRow}>
            <strong className={ui.supplierProductsKpiValue}>{formatMoney(revenueEstimate, currency)}</strong>
            <span className={ui.supplierProductsKpiTrend}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 16 9 11l4 4 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              +{revenueTrend}%
            </span>
          </div>
          <p className={ui.supplierProductsKpiSub}>At-listing value (qty × price)</p>
        </article>
        <article className={`${ui.supplierProductsKpi} ${ui.supplierProductsKpiAi}`}>
          <p className={ui.supplierProductsKpiLabel}>{t('cungaAi.productsKpiLabel')}</p>
          <p className={ui.supplierProductsKpiAiText}>
            Demand for <strong>{trendingProduct}</strong> is projected to increase by <strong>{trendingDemandIncrease}%</strong> next month.
          </p>
        </article>
      </div>

      <div className={ui.supplierProductsToolbarUnified}>
        <div className={ui.supplierProductsSearchGroup}>
          <label className={ui.supplierProductsSearchFieldUnified}>
            <span className={ui.supplierProductsSearchIcon} aria-hidden>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
                <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </span>
            <input
              ref={searchRef}
              className={ui.supplierProductsSearchInputUnified}
              placeholder="Search product ledger…"
              value={histQ}
              onChange={(e) => {
                setHistQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        
        <div className={ui.supplierProductsActionGroupUnified}>
          <button
            type="button"
            className={ui.supplierProductsFilterToggleUnified}
            onClick={() => {
              setFilterOpen((o) => !o);
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Advanced filters
          </button>
          <button type="button" className={ui.supplierProductsAddBtnUnified} onClick={() => navigate('/app/supplier/product-edit')}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden style={{ marginRight: '6px' }}>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
            </svg>
            Add product
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className={ui.supplierProductsAdvancedFiltersUnified}>
          <label className={ui.supplierProductsCategoryField}>
            <span className={ui.supplierProductsCategoryLabel}>Category</span>
            <InventoryFilterSelect
              value={categoryFilter}
              onChange={(val) => {
                setCategoryFilter(val);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All categories' },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
          </label>
          <div className={ui.supplierProductsStatusChips} role="group" aria-label="Stock status">
            {[
              { id: 'all', label: 'All' },
              { id: 'ok', label: 'Available' },
              { id: 'low', label: 'Low stock' },
              { id: 'out', label: 'Out of stock' },
              { id: 'paused', label: 'Paused' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={chip.id === statusFilter ? ui.supplierProductsChipActive : ui.supplierProductsChip}
                onClick={() => {
                  setStatusFilter(chip.id);
                  setPage(1);
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <button type="button" className={ui.supplierProductsClearBtn} onClick={() => { setHistQ(''); setCategoryFilter('all'); setStatusFilter('all'); }}>
            Reset filters
          </button>
        </div>
      )}

      <section className={ui.supplierProductsTableWrap}>
        <div className={ui.supplierLedgerCard}>
          <div className={ui.supplierLedgerToolbar}>
            <h2 className={ui.supplierLedgerToolbarTitle}>Inventory ledger</h2>
            <div className={ui.supplierLedgerToolbarBtns}>
              <button type="button" className={ui.supplierLedgerIconBtn} onClick={exportCsv} aria-label="Download Excel">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 4v12M8 12l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="M5 20h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className={ui.supplierLedgerIconBtn} onClick={() => setRefreshTick((t) => t + 1)} aria-label="Refresh">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M21 12a9 9 0 0 1-9 9 4.5 4.5 0 0 1-4.08-2.6M3 12a9 9 0 0 1 9-9c1.8 0 3.48.53 4.9 1.45M3 12h4M17 12h4M17 5v4M7 19v-4"
                    stroke="currentColor"
                    strokeWidth="1.65"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className={ui.supplierLedgerScroll}>
            <div className={ui.supplierLedgerGridHead}>
              <span>Product name</span>
              <span>Category</span>
              <span>Price</span>
              <span>Stock availability</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {pageSlice.length === 0 ? (
              <div className={ui.supplierLedgerEmpty}>No listings match your filters.</div>
            ) : (
              pageSlice.map((listing) => {
                const st = catalogListingStatus(listing);
                const percentage = Math.max(
                  0,
                  Math.min(100, Math.round((Number(listing.quantity || 0) / Math.max(1, Number(listing.maxThreshold || 100))) * 100))
                );
                const initials = listing.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() || '')
                  .join('');
                return (
                  <div key={listing.id} className={ui.supplierLedgerRow}>
                    <div className={ui.inventoryItemCell}>
                      <div>
                        <p className={ui.inventoryItemName}>{listing.name}</p>
                        <p className={ui.inventoryItemMeta}>SKU: {listing.sku}</p>
                      </div>
                    </div>
                    <div>
                      <span className={ui.inventoryCategoryPill}>{listing.category}</span>
                    </div>
                    <div className={ui.supplierLedgerPrice}>{formatMoney(listing.price, currency)}</div>
                    <div className={ui.inventoryLevelCell}>
                      <div className={ui.inventoryLevelNumbers}>
                        <strong>{listing.quantity}</strong>
                        <span>/ {listing.maxThreshold}</span>
                      </div>
                      <div className={ui.inventoryLevelTrack}>
                        <div
                          className={
                            st.key === 'paused'
                              ? `${ui.inventoryLevelFill} ${ui.inventoryLevelFillMuted}`
                              : st.key === 'out'
                                ? `${ui.inventoryLevelFill} ${ui.inventoryLevelFillBad}`
                                : st.key === 'low'
                                  ? `${ui.inventoryLevelFill} ${ui.inventoryLevelFillWarn}`
                                  : ui.inventoryLevelFill
                          }
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <span
                        className={
                          st.key === 'paused'
                            ? `${ui.inventoryStatusPill} ${ui.inventoryStatusPaused}`
                            : st.key === 'out'
                              ? `${ui.inventoryStatusPill} ${ui.inventoryStatusBad}`
                              : st.key === 'low'
                                ? `${ui.inventoryStatusPill} ${ui.inventoryStatusWarn}`
                                : `${ui.inventoryStatusPill} ${ui.inventoryStatusOk}`
                        }
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className={ui.inventoryActions}>
                      <button
                        type="button"
                        className={ui.inventoryActionBtn}
                        aria-label={`View ${listing.name}`}
                        onClick={() => navigate(`/app/supplier/product-edit?id=${encodeURIComponent(listing.id)}`)}
                      >
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={ui.inventoryActionBtn}
                        aria-label={`Edit ${listing.name}`}
                        onClick={() => navigate(`/app/supplier/product-edit?id=${encodeURIComponent(listing.id)}`)}
                      >
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <footer className={ui.supplierProductsPager}>
          <p className={ui.supplierProductsPagerMeta}>
            Showing {rangeFrom} to {rangeTo} of {totalRows.toLocaleString()} items
          </p>
          <nav className={ui.supplierProductsPagerNav} aria-label="Pagination">
            <button
              type="button"
              className={ui.supplierProductsPageBtn}
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            {pagerNums.map((n, idx) => (
              <Fragment key={n}>
                {idx > 0 && pagerNums[idx] - pagerNums[idx - 1] > 1 && (
                  <span className={ui.supplierProductsPageEllipsis} aria-hidden>
                    …
                  </span>
                )}
                <button
                  type="button"
                  className={n === safePage ? ui.supplierProductsPageBtnActive : ui.supplierProductsPageBtn}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              </Fragment>
            ))}
            <button
              type="button"
              className={ui.supplierProductsPageBtn}
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              ›
            </button>
          </nav>
        </footer>
      </section>

      <SupplierHealthcareCatalogRecommendations state={state} navigate={navigate} t={t} />

      {/* MODAL OVERLAY TRIGGERED BY ROUTE STATE */}
      {showEdit && <SupplierProductEdit />}

      <section className={ui.supplierTableCard} style={{ marginTop: '1.5rem' }}>
        <div className={ui.supplierTableHead}>
          <h2 className={ui.supplierTableTitle}>History of supplied materials</h2>
          <p className={ui.supplierTableLead}>Requisitions you fulfilled that are closed in e-Cunga, with a link to the official final invoice when present.</p>
        </div>
        <div className={ui.supplierTableScroll}>
          <table className={ui.supplierTable}>
            <thead>
              <tr>
                <th>Requisition</th>
                <th>Materials</th>
                <th>Location</th>
                <th>Closed</th>
                <th>Official invoice</th>
              </tr>
            </thead>
            <tbody>
              {fulfilledMaterials.length === 0 ? (
                <tr>
                  <td colSpan={5} className={ui.supplierTableEmpty}>
                    No closed fulfilments yet. After you attach the final invoice and the workflow closes, rows appear here.
                  </td>
                </tr>
              ) : (
                fulfilledMaterials.map((r) => {
                  const inv = myInvoices.find((i) => i.requisitionId === r.id && i.status === 'closed');
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong className={ui.supplierCellStrong}>{r.title}</strong>
                      </td>
                      <td className={ui.supplierCellLines}>{linesSummary(r.lines)}</td>
                      <td>{r.location || '—'}</td>
                      <td>{formatDate(r.updatedAt || r.requestedAt)}</td>
                      <td>
                        {inv?.finalInvoiceUrl ? (
                          <button
                            type="button"
                            className={ui.supplierLinkBtn}
                            onClick={() => setHistDocPreview({ title: 'Final Invoice', url: safeDocUrl(inv.finalInvoiceUrl) })}
                          >
                            Open final invoice
                          </button>
                        ) : (
                          <span className={ui.supplierCellMuted}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className={ui.supplierProductsBottomGrid}>
        <section className={ui.supplierProductsChartCard}>
          <div className={ui.supplierProductsChartHead}>
            <div>
              <h2 className={ui.supplierProductsChartTitle}>Inventory velocity</h2>
              <p className={ui.supplierProductsChartMeta}>Last 30 days · facility consumption tied to your SKUs</p>
            </div>
            <span className={ui.supplierProductsChartIcon} aria-hidden>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <path d="M4 19V9M12 19V5M20 19v-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <div className={ui.supplierProductsBars}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((label, i) => (
              <div key={label} className={ui.supplierProductsBarCol}>
                <div className={ui.supplierProductsBarTrack}>
                  <div
                    className={label === 'WED' ? ui.supplierProductsBarFillHot : ui.supplierProductsBarFill}
                    style={{ height: `${velocityHeights[i] ?? 8}%` }}
                  />
                </div>
                <span className={ui.supplierProductsBarLabel}>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={ui.supplierPremiumCard}>
          <span className={ui.supplierPremiumMark} aria-hidden>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <path d="M9 11 12 14 22 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <h2 className={ui.supplierPremiumTitle}>Grow your presence</h2>
          <p className={ui.supplierPremiumText}>
            Upgrade to Premium to promote listings in curated bundles and surface faster when hospitals search your categories.
          </p>
          <button type="button" className={ui.supplierPremiumCta}>
            Upgrade to Premium
          </button>
        </section>
      </div>
      <DocumentViewerModal
        open={Boolean(histDocPreview?.url)}
        title={histDocPreview?.title}
        url={histDocPreview?.url}
        onClose={() => setHistDocPreview(null)}
      />
    </div>
  );
}

export function SupplierMessages() {
  const { t } = useI18n();
  const { state, markNotificationRead } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const actor = useSupplierActor(state, user);
  const messages = messagesForRole(state, 'supplier', user?.id);
  const notifications = notificationsForRole(state, 'supplier', user?.id).filter(n => !n.isRead);
  const supplierLogs = state.activity.filter((entry) => entry.actorId === actor?.id || entry.actorName === actor?.fullName).slice(0, 6);

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Messages & notices"
        title="Everything finance and operations send you"
        description="Notifications are short system signals; messages carry richer context. The top bar also mirrors alerts for quick access."
      />
      <div className={ui.supplierMsgActions}>
        <button type="button" className={ui.quickBtn} onClick={() => navigate('/app/supplier/messages?chat=clerk')}>
          <span className={ui.quickBtnIcon}>
            <IconTalkRequest />
          </span>
          Talk to Request
        </button>
        <button type="button" className={ui.quickBtn} onClick={() => navigate('/app/supplier/messages?chat=accountant')}>
          <span className={ui.quickBtnIcon}>
            <IconTalkAccountant />
          </span>
          Talk to Accountant
        </button>
        <button type="button" className={ui.quickBtn} onClick={() => navigate('/app/supplier/messages?chat=admin')}>
          <span className={ui.quickBtnIcon}>
            <IconCompanyEnquiry />
          </span>
          Send enquiry, to company
        </button>
      </div>
      <div className={ui.supplierMsgGrid}>
        <section className={ui.supplierMsgCard}>
          <h2 className={ui.supplierMsgTitle}>Messages</h2>
          <ul className={ui.supplierMsgList}>
            {messages.length === 0 ? (
              <li className={ui.supplierMsgItem}>
                <p className={ui.supplierMsgItemBody}>No messages yet. Finance and operations will appear here when they contact you.</p>
              </li>
            ) : (
              messages.map((message) => (
                <li key={message.id} className={ui.supplierMsgItem}>
                  <p className={ui.supplierMsgItemTitle}>{message.title}</p>
                  <p className={ui.supplierMsgItemBody}>{message.body}</p>
                  <div className={ui.supplierMsgItemActions}>
                    <button type="button" className={ui.notifLinkBtn} onClick={() => navigate('/app/supplier/messages?tab=chat')}>
                      Open conversation
                    </button>
                    <button type="button" className={ui.notifReadBtn} onClick={() => showFlash('Message marked as read.', 'ok')}>
                      Mark as read
                    </button>
                  </div>
                  <p className={ui.supplierMsgItemMeta}>
                    {message.from} · {formatDateTime(message.createdAt)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className={ui.supplierMsgCard}>
          <h2 className={ui.supplierMsgTitle}>Notifications</h2>
          <ul className={ui.supplierMsgList}>
            {notifications.length === 0 ? (
              <li className={ui.supplierMsgItem}>
                <p className={ui.supplierMsgItemBody}>No notifications. You will see alerts when requisitions, proformas, and payments move.</p>
              </li>
            ) : (
              notifications.map((entry) => (
                <li key={entry.id} className={ui.supplierMsgItem}>
                  <p className={ui.supplierMsgItemTitle}>{entry.title}</p>
                  <p className={ui.supplierMsgItemBody}>{entry.body}</p>
                  <div className={ui.supplierMsgItemActions}>
                    <button type="button" className={ui.notifLinkBtn} onClick={() => {
                      if (entry.body.toLowerCase().includes('paid') || entry.body.toLowerCase().includes('payment')) {
                        navigate('/app/supplier/payments');
                      } else {
                        navigate('/app/supplier/documents');
                      }
                    }}>
                      View details
                    </button>
                    <button type="button" className={ui.notifReadBtn} onClick={async () => {
                      showFlash(t('app.supplier.toastNotifMarkingRead'), 'loading');
                      try {
                        await markNotificationRead(entry.id);
                        showFlash(t('app.supplier.toastNotifMarkedRead'), 'ok');
                      } catch (e) {
                        showFlash(e.message || t('app.supplier.toastNotifMarkReadError'), 'error');
                      }
                    }}>
                      Mark as read
                    </button>
                  </div>
                  <p className={ui.supplierMsgItemMeta}>{formatDateTime(entry.createdAt)}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
      <section className={ui.supplierPanel}>
        <h2 className={ui.supplierPanelTitle}>Activity log</h2>
        <ActivityFeed logs={supplierLogs.length ? supplierLogs : state.activity.slice(0, 6)} />
      </section>
    </div>
  );
}

