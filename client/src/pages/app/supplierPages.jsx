import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import {
  attachDeliveryNote,
  attachFinalInvoice,
  getMessagesForRole,
  getNotificationsForRole,
  getPortalState,
  submitSupplierProforma,
  upsertSupplierCatalogItem,
  usePortalState,
} from '../../data/mockPortal.js';
import { getPeriodBounds, isoInRange } from '../../utils/reportFilters.js';
import ui from './DashboardUi.module.css';
import {
  ActivityFeed,
  MoneyFigure,
  PageIntro,
  StatusBadge,
  formatDate,
  formatMoney,
  formatDateTime,
  workflowLabel,
} from './roleUi.jsx';

function useSupplierActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'supplier'),
    [state.users, user?.email]
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
  return (
    <svg {...c}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function supplierRequisitions(state, actorId) {
  return state.requisitions.filter(
    (entry) =>
      (!entry.supplierId || entry.supplierId === actorId) &&
      ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid', 'deliveryNoteAttached', 'closed', 'rejected'].includes(entry.status)
  );
}

function supplierIncomingRequests(state, actorId) {
  return state.requisitions.filter(
    (entry) =>
      (!entry.supplierId || entry.supplierId === actorId) &&
      ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid', 'deliveryNoteAttached'].includes(entry.status)
  );
}

function initialsFromName(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const a = parts[0]?.[0] || '';
  const b = parts[1]?.[0] || parts[0]?.[1] || '';
  return `${a}${b}`.toUpperCase() || '?';
}

function skuForRequisition(entry) {
  const suffix = String(entry.id || '')
    .replace(/\D/g, '')
    .padStart(3, '0')
    .slice(-3);
  const lineKey = (entry.lines?.[0]?.description || entry.title || 'ITEM')
    .replace(/[^a-z0-9]+/gi, '')
    .slice(0, 3)
    .toUpperCase() || 'SKU';
  return `${lineKey}-${suffix}-X`;
}

function totalQty(lines) {
  if (!lines?.length) return 0;
  return lines.reduce((acc, line) => acc + Number(line.quantity || 0), 0);
}

function requestDisplayBadge(entry) {
  const urgent = entry.priority === 'critical' && ['sentToSupplier', 'proformaReceived'].includes(entry.status);
  if (urgent) return { key: 'urgent', label: 'Urgent', tone: 'urgent' };
  if (entry.status === 'sentToSupplier' || entry.status === 'proformaReceived') {
    return { key: 'pending', label: 'Pending', tone: 'pending' };
  }
  if (entry.status === 'proformaApproved') return { key: 'approved', label: 'Approved', tone: 'ok' };
  if (entry.status === 'paid') return { key: 'paid', label: 'Paid', tone: 'ok' };
  if (entry.status === 'deliveryNoteAttached') return { key: 'transit', label: 'In transit', tone: 'pending' };
  return { key: 'pending', label: 'Pending', tone: 'pending' };
}

function requestProductTitle(entry) {
  return entry.lines?.[0]?.description || entry.title || 'Requested item';
}

function supplierInvoices(state, actorId) {
  return state.invoices.filter((entry) => !entry.supplierId || entry.supplierId === actorId);
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

function escapeCsvCell(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function catalogListingStatus(listing) {
  if (listing.listed === false) return { key: 'paused', label: 'PAUSED', tone: 'info' };
  const q = Number(listing.quantity || 0);
  const min = Number(listing.minThreshold ?? 0);
  if (q <= 0) return { key: 'out', label: 'OUT OF STOCK', tone: 'bad' };
  if (min > 0 && q < min) return { key: 'low', label: 'LOW STOCK', tone: 'warn' };
  return { key: 'ok', label: 'AVAILABLE', tone: 'ok' };
}

const LOGISTICS_PARTNERS = ['SwiftRoute Logistics', 'BluePeak Freight', 'Kigali Cargo Connect', 'East Africa Linehaul'];

function pickLogisticsPartner(seed) {
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i)) % LOGISTICS_PARTNERS.length;
  return LOGISTICS_PARTNERS[h];
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

function paymentLedgerMethod(seed) {
  let h = 0;
  for (const ch of String(seed || '')) h = (h + ch.charCodeAt(0)) % PAY_LEDGER_METHODS.length;
  return PAY_LEDGER_METHODS[h];
}

function paymentLedgerStatus(inv) {
  if (inv.status === 'rejected') return { key: 'failed', label: 'Failed' };
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
  if (statusFilter === 'finance') return ['proformaReceived', 'proformaApproved'].includes(s);
  if (statusFilter === 'dispatch') return ['paid', 'deliveryNoteAttached'].includes(s);
  if (statusFilter === 'closed') return s === 'closed';
  return true;
}

function matchesSupplierCategory(req, catFilter, stockItems) {
  if (catFilter === 'all') return true;
  return (req.lines || []).some((line) => categoryForLine(line, stockItems) === catFilter);
}

const PIPELINE = [
  { step: 1, title: 'Order released', body: 'Supervisor sends an approved requisition to your queue.' },
  { step: 2, title: 'Proforma submitted', body: 'You attach pricing and the proforma PDF for finance.' },
  { step: 3, title: 'Finance decision', body: 'Accountant approves or rejects; approved items wait for payment.' },
  { step: 4, title: 'Fulfil & close', body: 'After payment, upload delivery note then the official final invoice.' },
];

export function SupplierDashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const [period, setPeriod] = useState('30d');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { start, end } = useMemo(() => getPeriodBounds(period === 'quarter' ? 'quarter' : '30d'), [period]);
  const allReqs = supplierRequisitions(state, actor?.id);
  const invoices = supplierInvoices(state, actor?.id);

  const dashCategories = useMemo(() => {
    const set = new Set();
    for (const r of allReqs) {
      for (const line of r.lines || []) {
        const c = categoryForLine(line, state.stockItems);
        if (c) set.add(c);
      }
    }
    return [...set].sort();
  }, [allReqs, state.stockItems]);

  const scopedReqs = useMemo(() => {
    return allReqs.filter(
      (r) =>
        isoInRange(r.requestedAt, start, end) &&
        matchesSupplierStatusFilter(r, statusFilter) &&
        matchesSupplierCategory(r, catFilter, state.stockItems)
    );
  }, [allReqs, start, end, statusFilter, catFilter, state.stockItems]);

  const scopedReqIds = useMemo(() => new Set(scopedReqs.map((r) => r.id)), [scopedReqs]);
  const scopedInvoices = useMemo(() => invoices.filter((inv) => scopedReqIds.has(inv.requisitionId)), [invoices, scopedReqIds]);

  const lineQtyTotal = useMemo(() => {
    return scopedReqs.reduce((sum, r) => sum + (r.lines || []).reduce((s, l) => s + Number(l.quantity || 0), 0), 0);
  }, [scopedReqs]);

  const newRequests = useMemo(() => scopedReqs.filter((r) => r.status === 'sentToSupplier').length, [scopedReqs]);
  const pendingDeliveries = useMemo(
    () => scopedReqs.filter((r) => ['paid', 'deliveryNoteAttached'].includes(r.status)).length,
    [scopedReqs]
  );
  const progressing = useMemo(
    () => scopedReqs.filter((r) => !['rejected', 'submitted'].includes(r.status)).length,
    [scopedReqs]
  );
  const pipelinePct = scopedReqs.length ? Math.round((progressing / scopedReqs.length) * 100) : 0;

  const settledTotal = useMemo(() => {
    return scopedInvoices.filter((i) => ['paid', 'deliveryNoteAttached', 'closed'].includes(i.status)).reduce((s, i) => s + Number(i.amount || 0), 0);
  }, [scopedInvoices]);

  const pendingSettlement = useMemo(() => {
    return scopedInvoices.filter((i) => i.status === 'proformaApproved').reduce((s, i) => s + Number(i.amount || 0), 0);
  }, [scopedInvoices]);

  const revenueChart = useMemo(() => {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const pts = new Array(6).fill(0);
    const span = Math.max(1, end - start);
    for (const inv of scopedInvoices) {
      if (!['paid', 'deliveryNoteAttached', 'closed', 'proformaApproved'].includes(inv.status)) continue;
      const t = new Date(inv.paidAt || inv.updatedAt || inv.createdAt).getTime();
      if (Number.isNaN(t) || t < start || t > end) continue;
      const slot = Math.min(5, Math.floor(((t - start) / span) * 6));
      pts[slot] += Number(inv.amount || 0);
    }
    if (pts.every((p) => p === 0)) {
      const seed = Math.max(8000, settledTotal / 6 || 12000);
      [0.72, 0.78, 0.85, 0.92, 1.02, 1.08].forEach((f, i) => {
        pts[i] = Math.round(seed * f);
      });
    }
    const max = Math.max(...pts, 1);
    const points = pts.map((v, i) => `${(i * 440) / 5},${130 - Math.round((v / max) * 100)}`).join(' ');
    return { labels, points, max };
  }, [scopedInvoices, start, end, settledTotal]);

  const regions = useMemo(() => {
    const locs = ['Gasabo', 'Kicukiro', 'HQ Kigali'];
    const counts = locs.map((loc) => scopedReqs.filter((r) => r.location === loc).length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return locs.map((label, i) => ({ label, pct: Math.round((counts[i] / total) * 100), value: counts[i] }));
  }, [scopedReqs]);

  const curatorLine = useMemo(() => {
    const hot = scopedReqs.find((r) => r.priority === 'critical' || r.priority === 'high');
    const line = hot?.lines?.[0] || scopedReqs[0]?.lines?.[0];
    return line?.description || 'Surgical gloves';
  }, [scopedReqs]);

  const supplierLogs = useMemo(
    () =>
      state.activity
        .filter((entry) => entry.actorId === actor?.id || entry.actorName === actor?.fullName)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
    [state.activity, actor?.id, actor?.fullName]
  );

  const healthItems = useMemo(() => state.stockItems.slice(0, 4), [state.stockItems]);

  const welcomeName = state.company?.name || actor?.fullName || user?.email || 'Partner';

  return (
    <div className={ui.supplierBoard}>
      <header className={ui.supplierDashHeader}>
        <div className={ui.supplierDashHeaderMain}>
          <p className={ui.supplierDashEyebrow}>{t('app.supplier.dashEyebrow')}</p>
          <h1 className={ui.supplierDashTitle}>{t('app.supplier.dashWelcome', { name: welcomeName })}</h1>
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

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>{t('app.supplier.dashFilterCategory')}</span>
          <select className={ui.portalFilterSelect} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">{t('app.supplier.dashCatAll')}</option>
            {dashCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>{t('app.supplier.dashFilterStatus')}</span>
          <select className={ui.portalFilterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('app.supplier.dashStatusAll')}</option>
            <option value="action">{t('app.supplier.dashStatusAction')}</option>
            <option value="finance">{t('app.supplier.dashStatusFinance')}</option>
            <option value="dispatch">{t('app.supplier.dashStatusDispatch')}</option>
            <option value="closed">{t('app.supplier.dashStatusClosed')}</option>
          </select>
        </label>
        <button
          type="button"
          className={ui.portalFilterClear}
          onClick={() => {
            setCatFilter('all');
            setStatusFilter('all');
            setPeriod('30d');
          }}
        >
          {t('app.supplier.dashClearFilters')}
        </button>
        <span className={ui.portalFilterMeta}>
          {scopedReqs.length} reqs · {scopedInvoices.length} invoices
        </span>
      </div>

      <div className={ui.supplierDashKpiRow}>
        <div className={ui.supplierDashKpiCluster}>
          <article className={ui.supplierDashStat}>
            <p className={ui.supplierDashStatLabel}>{t('app.supplier.dashKpiProducts')}</p>
            <strong className={ui.supplierDashStatValue}>{lineQtyTotal.toLocaleString()}</strong>
            <span className={ui.supplierDashStatHint}>{t('app.supplier.dashKpiProductsHint')}</span>
            <span className={ui.supplierDashStatTrendOk}>+12.4%</span>
          </article>
          <article className={ui.supplierDashStat}>
            <p className={ui.supplierDashStatLabel}>{t('app.supplier.dashKpiAvailable')}</p>
            <strong className={ui.supplierDashStatValue}>{pipelinePct}%</strong>
            <span className={ui.supplierDashStatHint}>{t('app.supplier.dashKpiAvailableHint', { pct: pipelinePct })}</span>
          </article>
          <article className={ui.supplierDashStat}>
            <p className={ui.supplierDashStatLabel}>{t('app.supplier.dashKpiNewReq')}</p>
            <strong className={ui.supplierDashStatValue}>{newRequests}</strong>
            <span className={ui.supplierDashStatHint}>{t('app.supplier.dashKpiNewReqHint')}</span>
            {newRequests > 0 ? <span className={ui.supplierDashStatAlert} aria-hidden /> : null}
          </article>
          <article className={ui.supplierDashStat}>
            <p className={ui.supplierDashStatLabel}>{t('app.supplier.dashKpiPending')}</p>
            <strong className={ui.supplierDashStatValue}>{pendingDeliveries}</strong>
            <span className={ui.supplierDashStatHint}>{t('app.supplier.dashKpiPendingHint')}</span>
          </article>
        </div>
        <aside className={ui.supplierDashEarnings}>
          <span className={ui.supplierDashEarningsIcon} aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v18M5 10h11a3 3 0 0 1 0 6H8a3 3 0 1 0 0 6h9"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className={ui.supplierDashEarningsLabel}>{t('app.supplier.dashEarningsLabel')}</p>
          <strong className={ui.supplierDashEarningsValue}>
            <MoneyFigure
              value={settledTotal}
              currency={state.company?.currency || 'RWF'}
              amountClassName={ui.supplierDashEarningsAmount}
              currencyClassName={ui.supplierDashEarningsCurrency}
            />
          </strong>
          <p className={ui.supplierDashEarningsPending}>
            {t('app.supplier.dashEarningsPending')}:{' '}
            <span className={ui.supplierDashEarningsPendingMoney}>
              <MoneyFigure
                value={pendingSettlement}
                currency={state.company?.currency || 'RWF'}
                amountClassName={ui.supplierDashEarningsPendingAmount}
                currencyClassName={ui.supplierDashEarningsPendingCurrency}
              />
            </span>
          </p>
        </aside>
      </div>

      <div className={ui.supplierDashMainGrid}>
        <div className={ui.supplierDashMainCol}>
          <section className={ui.supplierDashChartCard}>
            <div className={ui.supplierDashCardHead}>
              <div>
                <h2 className={ui.supplierDashCardTitle}>{t('app.supplier.dashRevenueTitle')}</h2>
                <p className={ui.supplierDashCardMeta}>{t('app.supplier.dashRevenueMeta')}</p>
              </div>
              <span className={ui.supplierDashLegend}>
                <i /> {t('app.supplier.dashRevenueLegend')}
              </span>
            </div>
            <svg viewBox="0 0 440 150" className={ui.supplierDashChartSvg} aria-hidden>
              <defs>
                <linearGradient id="supplierRevFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(105 39 81)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="rgb(105 39 81)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon fill="url(#supplierRevFill)" points={`0,150 ${revenueChart.points} 440,150`} />
              <polyline fill="none" stroke="currentColor" strokeWidth="2.5" className={ui.supplierDashChartLine} points={revenueChart.points} />
            </svg>
            <div className={ui.supplierDashChartMonths}>
              {revenueChart.labels.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </section>

          <section className={ui.supplierDashInventoryCard}>
            <div className={ui.supplierDashCardHead}>
              <div>
                <h2 className={ui.supplierDashCardTitle}>{t('app.supplier.dashInventoryTitle')}</h2>
                <p className={ui.supplierDashCardMeta}>{t('app.supplier.dashInventoryMeta')}</p>
              </div>
            </div>
            <ul className={ui.supplierDashInventoryList}>
              {healthItems.map((item) => {
                const low = Number(item.quantity || 0) <= Number(item.minThreshold || 0);
                return (
                  <li key={item.id} className={ui.supplierDashInventoryRow}>
                    <div className={ui.supplierDashInvThumb} style={{ background: low ? 'linear-gradient(145deg,#fecaca,#fca5a5)' : 'linear-gradient(145deg,#bbf7d0,#86efac)' }} />
                    <div className={ui.supplierDashInvBody}>
                      <p className={ui.supplierDashInvName}>{item.name}</p>
                      <p className={ui.supplierDashInvCat}>{(item.category || 'Stock').toUpperCase()}</p>
                      <p className={ui.supplierDashInvQty}>
                        {item.quantity} {item.unit || 'units'}
                      </p>
                      <div className={ui.supplierDashInvTrack}>
                        <span
                          className={low ? ui.supplierDashInvFillLow : ui.supplierDashInvFillOk}
                          style={{ width: `${Math.min(100, 18 + Number(item.quantity || 0) * 3)}%` }}
                        />
                      </div>
                      <span className={low ? ui.supplierDashInvBadgeLow : ui.supplierDashInvBadgeOk}>
                        {low ? t('app.supplier.dashStockLow') : t('app.supplier.dashStockOk')}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className={ui.supplierDashSideCol}>
          <section className={ui.supplierDashCurator}>
            <h2 className={ui.supplierDashCuratorTitle}>{t('app.supplier.dashCuratorTitle')}</h2>
            <p className={ui.supplierDashCuratorText}>
              Demand for <strong>{curatorLine}</strong> is tracking above baseline in your filtered window. Bundle restock with adjacent theatre lines to protect
              fulfilment SLAs.
            </p>
            <button type="button" className={ui.supplierDashCuratorBtn} onClick={() => navigate('/app/supplier/inbox')}>
              {t('app.supplier.dashCuratorCta')}
            </button>
          </section>

          <section className={ui.supplierDashActivityCard}>
            <h2 className={ui.supplierDashCardTitle}>{t('app.supplier.dashActivityTitle')}</h2>
            <ul className={ui.supplierDashActivityList}>
              {(supplierLogs.length ? supplierLogs : state.activity.slice(0, 4)).map((entry) => {
                const bad = entry.action?.includes('reject') || entry.action?.includes('delay');
                return (
                  <li key={entry.id} className={ui.supplierDashActivityItem}>
                    <span className={bad ? ui.supplierDashActivityDotBad : ui.supplierDashActivityDot} />
                    <div>
                      <p className={ui.supplierDashActivityTitle}>{entry.action.replaceAll('.', ' ')}</p>
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
            <h2 className={ui.supplierDashCardTitle}>{t('app.supplier.dashRegionTitle')}</h2>
            <p className={ui.supplierDashCardMeta}>{t('app.supplier.dashRegionMeta')}</p>
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

      <section className={ui.supplierSection}>
        <h2 className={ui.supplierSectionTitle}>{t('app.supplier.dashShortcuts')}</h2>
        <div className={ui.supplierQuickGrid}>
          <NavLink to="/app/supplier/inbox" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="inbox" />
            <span>Incoming requests</span>
          </NavLink>
          <NavLink to="/app/supplier/approved-proforma" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="check" />
            <span>Approved proformas</span>
          </NavLink>
          <NavLink to="/app/supplier/rejected-proforma" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="reject" />
            <span>Rejected proformas</span>
          </NavLink>
          <NavLink to="/app/supplier/documents" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="truck" />
            <span>Delivery &amp; official invoice</span>
          </NavLink>
          <NavLink to="/app/supplier/delivery" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="delivery" />
            <span>Delivery</span>
          </NavLink>
          <NavLink to="/app/supplier/products" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="products" />
            <span>Products</span>
          </NavLink>
          <NavLink to="/app/supplier/payments" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="payments" />
            <span>Payments</span>
          </NavLink>
        </div>
      </section>

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

export function SupplierInbox() {
  const state = usePortalState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useSupplierActor(state, user);
  const company = state.company;

  const incoming = useMemo(() => {
    const list = supplierIncomingRequests(state, actor?.id);
    return [...list].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [state.requisitions, actor?.id]);

  const [tab, setTab] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const openCount = incoming.filter((e) =>
    ['sentToSupplier', 'proformaReceived', 'proformaApproved'].includes(e.status)
  ).length;
  const priorityCount = incoming.filter(
    (e) => e.priority === 'critical' && ['sentToSupplier', 'proformaReceived'].includes(e.status)
  ).length;

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return incoming.filter((entry) => {
      const badge = requestDisplayBadge(entry);
      if (tab === 'urgent') {
        if (!(entry.priority === 'critical' && ['sentToSupplier', 'proformaReceived'].includes(entry.status))) return false;
      } else if (tab === 'pending') {
        if (entry.priority === 'critical' && ['sentToSupplier', 'proformaReceived'].includes(entry.status)) return false;
        if (!['sentToSupplier', 'proformaReceived'].includes(entry.status)) return false;
      }
      if (!q) return true;
      const sku = skuForRequisition(entry).toLowerCase();
      const title = requestProductTitle(entry).toLowerCase();
      return (
        title.includes(q) ||
        sku.includes(q) ||
        (entry.clerkName || '').toLowerCase().includes(q) ||
        (entry.title || '').toLowerCase().includes(q)
      );
    });
  }, [incoming, tab, searchQ]);

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

  function sendProforma(requisitionId) {
    const draft = drafts[requisitionId];
    if (!draft?.reference || !draft?.amount) return;
    submitSupplierProforma(requisitionId, draft, actor?.id);
    setExpandedId(null);
  }

  function thumbClass(seed) {
    let h = 0;
    for (const ch of String(seed || '')) h = (h + ch.charCodeAt(0)) % 4;
    return ['supplierReqThumbA', 'supplierReqThumbB', 'supplierReqThumbC', 'supplierReqThumbD'][h];
  }

  return (
    <div className={ui.supplierBoard}>
      <div className={ui.supplierReqShell}>
        <div className={ui.supplierReqMain}>
          <header className={ui.supplierReqHeader}>
            <div>
              <h1 className={ui.supplierReqTitle}>Supplier requests</h1>
              <p className={ui.supplierReqLead}>Manage and fulfill incoming product demands from the network.</p>
            </div>
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
          </header>

          <section className={ui.supplierReqCard}>
            <div className={ui.supplierReqCardTop}>
              <div className={ui.supplierReqTabs} role="tablist" aria-label="Request filters">
                {[
                  { id: 'all', label: 'All requests' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'urgent', label: 'Urgent' },
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
                      <td colSpan={5} className={ui.supplierReqEmpty}>
                        No requests match this view. New demand appears when the hospital releases orders to you.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((entry) => {
                      const badge = requestDisplayBadge(entry);
                      const qty = totalQty(entry.lines);
                      const expanded = expandedId === entry.id;
                      const canQuote = entry.status === 'sentToSupplier';
                      return (
                        <Fragment key={entry.id}>
                          <tr className={expanded ? ui.supplierReqRowOpen : undefined}>
                            <td>
                              <div className={ui.supplierReqItemCell}>
                                <span className={`${ui.supplierReqThumb} ${ui[thumbClass(entry.id)]}`} aria-hidden>
                                  {(requestProductTitle(entry).slice(0, 1) || 'R').toUpperCase()}
                                </span>
                                <div>
                                  <div className={ui.supplierReqItemName}>{requestProductTitle(entry)}</div>
                                  <div className={ui.supplierReqSku}>SKU: {skuForRequisition(entry)}</div>
                                </div>
                              </div>
                            </td>
                            <td className={ui.supplierReqQty}>{qty.toLocaleString()}</td>
                            <td>
                              <div className={ui.supplierReqByCell}>
                                <span className={ui.supplierReqAvatar} aria-hidden>
                                  {initialsFromName(entry.clerkName)}
                                </span>
                                <div>
                                  <div className={ui.supplierReqByName}>{company?.name || 'Customer facility'}</div>
                                  <div className={ui.supplierReqByMeta}>{entry.clerkName}</div>
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
                                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                                >
                                  {expanded ? '▾' : '▸'}
                                </button>
                              ) : (
                                <span className={ui.supplierReqChevronMuted}>—</span>
                              )}
                            </td>
                          </tr>
                          {expanded && canQuote && (
                            <tr className={ui.supplierReqExpandRow}>
                              <td colSpan={5}>
                                <div className={ui.supplierReqExpand}>
                                  <p className={ui.supplierReqExpandTitle}>Submit proforma</p>
                                  <p className={ui.supplierReqExpandHint}>{linesSummary(entry.lines)}</p>
                                  <div className={ui.supplierReqExpandGrid}>
                                    <label className={ui.supplierReqExpandField}>
                                      <span>Reference</span>
                                      <input
                                        className={ui.supplierReqExpandInput}
                                        placeholder="PRO-2026-…"
                                        value={drafts[entry.id]?.reference || ''}
                                        onChange={(e) => updateDraft(entry.id, { reference: e.target.value })}
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
                                      <span>Attachment</span>
                                      <input
                                        className={ui.supplierReqExpandInput}
                                        placeholder="proforma.pdf"
                                        value={drafts[entry.id]?.attachmentUrl || ''}
                                        onChange={(e) => updateDraft(entry.id, { attachmentUrl: e.target.value })}
                                      />
                                    </label>
                                  </div>
                                  <button type="button" className={ui.supplierReqSendBtn} onClick={() => sendProforma(entry.id)}>
                                    Send proforma
                                  </button>
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
                  <button type="button" className={ui.supplierReqMatchRow}>
                    <span className={`${ui.supplierReqMatchThumb} ${ui[thumbClass(entry.id + 'm')]}`} aria-hidden />
                    <div className={ui.supplierReqMatchBody}>
                      <span className={ui.supplierReqMatchName}>{requestProductTitle(entry)}</span>
                      <span className={ui.supplierReqMatchConf}>{98 - idx * 7}% match confidence</span>
                    </div>
                    <span className={ui.supplierReqMatchChev} aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className={ui.supplierReqAside} aria-label="Request insights">
          <section className={ui.supplierReqCurator}>
            <div className={ui.supplierReqCuratorHead}>
              <span className={ui.supplierReqCuratorBulb} aria-hidden>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3a6 6 0 0 0-3 11.2V18h6v-3.8A6 6 0 0 0 12 3Z"
                    stroke="currentColor"
                    strokeWidth="1.65"
                    strokeLinejoin="round"
                  />
                  <path d="M9 21h6" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
                </svg>
              </span>
              <h2 className={ui.supplierReqCuratorTitle}>The Curator insights</h2>
            </div>
            <p className={ui.supplierReqCuratorText}>
              Inventory demand for <strong>{curatorProduct}</strong> is projected to rise by <strong>22%</strong> in the next quarter.
              {priorityCount > 0 ? ' Prioritize critical lines first to protect service levels.' : ' Keep proforma turnaround tight to stay ahead of finance review.'}
            </p>
            <button type="button" className={ui.supplierReqCuratorBtn} onClick={() => navigate('/app/supplier/messages')}>
              View trend analysis
            </button>
          </section>

          <div className={ui.supplierReqPerfRow}>
            <div className={ui.supplierReqPerfTileGreen}>
              <span className={ui.supplierReqPerfIcon} aria-hidden>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.65" />
                  <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
                </svg>
              </span>
              <p className={ui.supplierReqPerfValue}>1.4h</p>
              <p className={ui.supplierReqPerfLabel}>Avg response</p>
            </div>
            <div className={ui.supplierReqPerfTileBlue}>
              <span className={ui.supplierReqPerfIcon} aria-hidden>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <path d="M4 16V8M10 16V4M16 16v-5M22 16V9" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
                </svg>
              </span>
              <p className={ui.supplierReqPerfValue}>94%</p>
              <p className={ui.supplierReqPerfLabel}>Fulfill rate</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function SupplierApprovedProforma() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const rows = supplierInvoices(state, actor?.id).filter((i) => i.status === 'proformaApproved');

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
          Go to delivery &amp; invoice →
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
                        <span className={ui.supplierFilePill}>{inv.attachmentUrl || '—'}</span>
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
    </div>
  );
}

export function SupplierRejectedProforma() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const rows = supplierInvoices(state, actor?.id).filter((i) => i.status === 'rejected');

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
                  <span>File: {inv.attachmentUrl || '—'}</span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

export function SupplierDocuments() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const invoices = supplierInvoices(state, actor?.id).filter((entry) => ['paid', 'deliveryNoteAttached'].includes(entry.status));
  const [docs, setDocs] = useState({});

  function updateDocs(id, patch) {
    setDocs((current) => ({
      ...current,
      [id]: {
        deliveryNoteUrl: current[id]?.deliveryNoteUrl || '',
        finalInvoiceUrl: current[id]?.finalInvoiceUrl || '',
        ...patch,
      },
    }));
  }

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Delivery & official invoice"
        title="Attach proof of dispatch, then the official invoice"
        description="After finance marks payment, upload the delivery note first. The final attachment should be your official tax invoice that closes the requisition in e-CUNGA."
      />

      <div className={ui.supplierDocBannerGrid}>
        <article className={ui.supplierDocBanner}>
          <SupplierGlyph kind="truck" />
          <div>
            <h3 className={ui.supplierDocBannerTitle}>1. Delivery note</h3>
            <p className={ui.supplierDocBannerText}>Proof of fulfilment—packing list, signed waybill, or GRN reference.</p>
          </div>
        </article>
        <article className={`${ui.supplierDocBanner} ${ui.supplierDocBannerAccent}`}>
          <SupplierGlyph kind="doc" />
          <div>
            <h3 className={ui.supplierDocBannerTitle}>2. Official final invoice</h3>
            <p className={ui.supplierDocBannerText}>Tax-compliant invoice matching the paid proforma; closes the workflow.</p>
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
                <th>Delivery note</th>
                <th>Official final invoice</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className={ui.supplierTableEmpty}>
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
                        <input
                          className={ui.supplierInput}
                          placeholder="delivery-note.pdf"
                          value={docs[invoice.id]?.deliveryNoteUrl || invoice.deliveryNoteUrl || ''}
                          onChange={(e) => updateDocs(invoice.id, { deliveryNoteUrl: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={ui.supplierInput}
                          placeholder="final-invoice-official.pdf"
                          value={docs[invoice.id]?.finalInvoiceUrl || invoice.finalInvoiceUrl || ''}
                          onChange={(e) => updateDocs(invoice.id, { finalInvoiceUrl: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className={ui.supplierBtnRow}>
                          <button
                            type="button"
                            className={ui.supplierGhostBtn}
                            onClick={() =>
                              attachDeliveryNote(invoice.id, docs[invoice.id]?.deliveryNoteUrl || invoice.deliveryNoteUrl, actor?.id)
                            }
                          >
                            Save delivery note
                          </button>
                          <button
                            type="button"
                            className={ui.supplierPrimaryBtn}
                            onClick={() =>
                              attachFinalInvoice(invoice.id, docs[invoice.id]?.finalInvoiceUrl || invoice.finalInvoiceUrl, actor?.id)
                            }
                          >
                            Attach official invoice
                          </button>
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
    </div>
  );
}

export function SupplierDelivery() {
  const state = usePortalState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useSupplierActor(state, user);
  const [notesByInv, setNotesByInv] = useState({});

  const pendingPaid = supplierInvoices(state, actor?.id).filter((entry) => entry.status === 'paid');
  const pendingCount = pendingPaid.length;

  function setNote(id, value) {
    setNotesByInv((prev) => ({ ...prev, [id]: value }));
  }

  function confirmDelivery(invoice) {
    const raw = (notesByInv[invoice.id] || '').trim();
    const safeRef = invoice.reference.replace(/[^\w-]+/g, '_');
    const url = raw ? `delivery-notes/${safeRef}.txt` : `delivery-confirmed-${safeRef}.pdf`;
    attachDeliveryNote(invoice.id, url, actor?.id);
  }

  return (
    <div className={ui.supplierBoard}>
      <div className={ui.supplierDeliveryShell}>
        <div className={ui.supplierDeliveryMain}>
          <header className={ui.supplierDeliveryTop}>
            <div className={ui.supplierDeliveryTopText}>
              <p className={ui.supplierDeliveryCrumb}>Operations › Fulfillment</p>
              <h1 className={ui.supplierDeliveryTitle}>Delivery Confirmation</h1>
              <p className={ui.supplierDeliveryLead}>
                Review approved orders and verify successful delivery to maintain high supplier performance ratings.
              </p>
            </div>
            <div className={ui.supplierDeliveryKpiStrip}>
              <div className={ui.supplierDeliveryKpi}>
                <p className={ui.supplierDeliveryKpiLabel}>Pending delivery</p>
                <p className={ui.supplierDeliveryKpiValue}>
                  {pendingCount} <span className={ui.supplierDeliveryKpiUnit}>orders</span>
                </p>
              </div>
              <div className={ui.supplierDeliveryKpi}>
                <p className={ui.supplierDeliveryKpiLabel}>Today&apos;s goal</p>
                <p className={ui.supplierDeliveryKpiValue}>85%</p>
              </div>
            </div>
          </header>

          <div className={ui.supplierDeliveryCardList}>
            {pendingPaid.length === 0 ? (
              <div className={ui.supplierDeliveryEmpty}>
                <p>No orders are waiting for delivery confirmation right now.</p>
                <p className={ui.supplierDeliveryEmptyHint}>Paid releases from finance will appear here for you to confirm dispatch.</p>
              </div>
            ) : (
              pendingPaid.map((invoice) => {
                const req = requisitionById(state, invoice.requisitionId);
                const qty = lineQtyTotal(req?.lines);
                const title = req?.title || 'Approved order';
                const lineLabel = qty ? `${title} (×${qty.toLocaleString()})` : title;
                return (
                  <article key={invoice.id} className={ui.supplierDeliveryCard}>
                    <div className={ui.supplierDeliveryCardTop}>
                      <div className={`${ui.supplierDeliveryThumb} ${ui[deliveryThumbClass(invoice.id)]}`} aria-hidden>
                        {(title.slice(0, 1) || 'O').toUpperCase()}
                      </div>
                      <div className={ui.supplierDeliveryCardHead}>
                        <div className={ui.supplierDeliveryCardBadges}>
                          <span className={ui.supplierDeliveryBadgeOk}>Approved</span>
                          <span className={ui.supplierDeliveryRef}>#{invoice.reference}</span>
                        </div>
                        <h2 className={ui.supplierDeliveryProductTitle}>{lineLabel}</h2>
                        <div className={ui.supplierDeliveryCardMeta}>
                          <span className={ui.supplierDeliveryPrice}>{formatMoney(invoice.amount, invoice.currency)}</span>
                          <span className={ui.supplierDeliveryTier}>{deliveryServiceTier(invoice.id)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={ui.supplierDeliveryDetailRow}>
                      <div className={ui.supplierDeliveryDetail}>
                        <span className={ui.supplierDeliveryDetailIcon} aria-hidden>
                          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                              stroke="currentColor"
                              strokeWidth="1.65"
                            />
                            <path
                              d="M19.5 9.5c0 6.5-7.5 11.5-7.5 11.5S4.5 16 4.5 9.5a7.5 7.5 0 1 1 15 0Z"
                              stroke="currentColor"
                              strokeWidth="1.65"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <div>
                          <p className={ui.supplierDeliveryDetailLabel}>Destination</p>
                          <p className={ui.supplierDeliveryDetailValue}>{hubLabelForLocation(req?.location)}</p>
                        </div>
                      </div>
                      <div className={ui.supplierDeliveryDetail}>
                        <span className={ui.supplierDeliveryDetailIcon} aria-hidden>
                          <SupplierGlyph kind="truck" />
                        </span>
                        <div>
                          <p className={ui.supplierDeliveryDetailLabel}>Logistics partner</p>
                          <p className={ui.supplierDeliveryDetailValue}>{pickLogisticsPartner(invoice.id)}</p>
                        </div>
                      </div>
                    </div>
                    <label className={ui.supplierDeliveryNotes}>
                      <span className={ui.supplierDeliveryNotesLabel}>Delivery notes</span>
                      <textarea
                        className={ui.supplierDeliveryTextarea}
                        rows={3}
                        placeholder="Describe delivery status, receiver sign-off, or vehicle reference…"
                        value={notesByInv[invoice.id] ?? ''}
                        onChange={(e) => setNote(invoice.id, e.target.value)}
                      />
                    </label>
                    <div className={ui.supplierDeliveryCardActions}>
                      <button type="button" className={ui.supplierDeliveryConfirmBtn} onClick={() => confirmDelivery(invoice)}>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M6 12.5 10 17 18 7" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
                        </svg>
                        Confirm delivery
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <aside className={ui.supplierDeliveryAside} aria-label="Delivery insights">
          <section className={ui.supplierDeliveryCurator}>
            <div className={ui.supplierDeliveryCuratorHead}>
              <span className={ui.supplierDeliveryCuratorIcon} aria-hidden>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <h2 className={ui.supplierDeliveryCuratorTitle}>The Curator AI</h2>
            </div>
            <p className={ui.supplierDeliveryCuratorText}>
              {pendingCount === 0 ? (
                <>
                  When paid orders land in your queue, Curator AI will surface corridor consolidation opportunities and estimated
                  savings here.
                </>
              ) : (
                <>
                  You have <strong>{pendingCount}</strong> active {pendingCount === 1 ? 'delivery' : 'deliveries'} on today&apos;s plan.
                  Consolidating routes that share the same hub corridor could save approximately <strong>14%</strong> in logistics
                  costs.
                </>
              )}
            </p>
            <button type="button" className={ui.supplierDeliveryCuratorBtn} onClick={() => navigate('/app/supplier/messages')}>
              Review consolidation
            </button>
          </section>

          <section className={ui.supplierDeliveryMapCard}>
            <div className={ui.supplierDeliveryMapInner}>
              <span className={ui.supplierDeliveryLiveBadge}>
                <span className={ui.supplierDeliveryLiveDot} aria-hidden />
                Live tracking active
              </span>
            </div>
            <div className={ui.supplierDeliveryMapFoot}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                  stroke="currentColor"
                  strokeWidth="1.65"
                />
                <path
                  d="M19.5 9.5c0 6.5-7.5 11.5-7.5 11.5S4.5 16 4.5 9.5a7.5 7.5 0 1 1 15 0Z"
                  stroke="currentColor"
                  strokeWidth="1.65"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Nearest hub: Industrial Area East</span>
            </div>
          </section>

          <section className={ui.supplierDeliveryScoreCard}>
            <h2 className={ui.supplierDeliveryScoreTitle}>Performance score</h2>
            <p className={ui.supplierDeliveryScoreValue}>
              4.8 <span className={ui.supplierDeliveryScoreOutOf}>/ 5.0</span>
            </p>
            <div className={ui.supplierDeliveryScoreTrack}>
              <div className={ui.supplierDeliveryScoreFill} style={{ width: '96%' }} />
            </div>
            <p className={ui.supplierDeliveryScoreFoot}>
              Your delivery confirmation time is faster than <strong>88%</strong> of suppliers in your category.
            </p>
          </section>

          <button
            type="button"
            className={ui.supplierDeliveryFab}
            aria-label="New order"
            onClick={() => navigate('/app/supplier/inbox')}
          >
            +
          </button>
        </aside>
      </div>
    </div>
  );
}

export function SupplierPayments() {
  const state = usePortalState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useSupplierActor(state, user);
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
  const pageSize = 6;

  const iMine = supplierInvoices(state, actor?.id);
  const pendingPayoutSum = iMine
    .filter((inv) => ['proformaReceived', 'proformaApproved'].includes(inv.status))
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

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
    const headers = ['Invoice ID', 'Amount', 'Payment method', 'Status', 'Date'];
    const lines = filtered.map((inv) => {
      const st = paymentLedgerStatus(inv);
      const method = paymentLedgerMethod(inv.id);
      const rowDate = paymentLedgerRowDate(inv);
      return [
        inv.reference,
        String(inv.amount ?? ''),
        method.label,
        st.label,
        rowDate ? formatDate(rowDate) : '',
      ].map(escapeCsvCell);
    });
    const csv = [headers.join(','), ...lines.map((r) => r.join(','))].join('\n');
    downloadBlob(`payment-ledger-${Date.now()}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  }

  function downloadQuarterlyHtml() {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Quarterly reconciliation — e-CUNGA</title>
<style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:720px}h1{color:#632e52}table{width:100%;border-collapse:collapse;margin-top:1rem}th,td{border:1px solid #cbd5e1;padding:.5rem;text-align:left}</style></head><body>
<h1>Quarterly reconciliation (Q3)</h1>
<p>Summary generated from your supplier payment ledger. Use Print → Save as PDF for a PDF copy.</p>
<table><thead><tr><th>Reference</th><th>Status</th><th>Amount (${currency})</th></tr></thead><tbody>
${filtered
  .slice(0, 40)
  .map(
    (inv) =>
      `<tr><td>${inv.reference}</td><td>${paymentLedgerStatus(inv).label}</td><td>${inv.amount}</td></tr>`
  )
  .join('')}
</tbody></table></body></html>`;
    downloadBlob(`quarterly-reconciliation.html`, new Blob([html], { type: 'text/html;charset=utf-8;' }));
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
          <select className={ui.supplierPaySelect} value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
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
                <th>Amount</th>
                <th>Payment method</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={6} className={ui.supplierPayTableEmpty}>
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                pageSlice.map((inv) => {
                  const st = paymentLedgerStatus(inv);
                  const method = paymentLedgerMethod(inv.id);
                  const rowDate = paymentLedgerRowDate(inv);
                  return (
                    <tr key={inv.id}>
                      <td>
                        <span className={ui.supplierPayInvoiceId}>#{inv.reference}</span>
                      </td>
                      <td>
                        <strong className={ui.supplierPayAmount}>{formatMoney(inv.amount, inv.currency || currency)}</strong>
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
                                : ui.supplierPayBadgePending
                          }
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className={ui.supplierPayDateCell}>{rowDate ? formatDate(rowDate) : '—'}</td>
                      <td>
                        <button type="button" className={ui.supplierPayRowMenu} aria-label="Row actions">
                          ⋮
                        </button>
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
          <h2 className={ui.supplierPayCuratorTitle}>Curator insight</h2>
          <p className={ui.supplierPayCuratorText}>
            Your payment success rate has increased by <strong>12%</strong> since switching to Mobile Money defaults for smaller
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
              Export CSV
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const PRODUCT_EDIT_CATEGORY_PRESETS = [
  'Beverages',
  'Pantry',
  'Spices',
  'Medical consumables',
  'Sanitation',
  'Pharmacy',
  'General',
  'Office supplies',
  'Cold chain',
  'Laboratory',
  'Industrial Machinery',
];

const PRODUCT_EDIT_UNITS = ['units', 'cases', 'bags', 'bottles', 'boxes', 'packs', 'reams', 'kg', 'jars', 'kits'];

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
  };
}

export function SupplierProductEdit() {
  const state = usePortalState();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const currency = state.company?.currency || 'RWF';

  const [missing, setMissing] = useState(false);
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
  const [savedSnapshot, setSavedSnapshot] = useState(() => emptyProductSnapshot());

  const categoryOptions = useMemo(() => {
    const fromCatalog = (state.supplierCatalog ?? []).map((c) => c.category).filter(Boolean);
    return [...new Set([...PRODUCT_EDIT_CATEGORY_PRESETS, ...fromCatalog])].sort((a, b) => a.localeCompare(b));
  }, [state.supplierCatalog]);

  useEffect(() => {
    const cat = getPortalState().supplierCatalog ?? [];
    if (!editId) {
      setMissing(false);
      const snap = emptyProductSnapshot();
      setName(snap.name);
      setSku(snap.sku);
      setCategory(snap.category);
      setPrice(snap.price);
      setDescription(snap.description);
      setListed(snap.listed);
      setStock(snap.stock);
      setMinThreshold(snap.minThreshold);
      setMaxThreshold(snap.maxThreshold);
      setUnit(snap.unit);
      setLocation(snap.location);
      setSavedSnapshot(snap);
      return;
    }
    const row = cat.find((c) => c.id === editId);
    if (!row) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const snap = snapshotFromListing(row);
    setName(snap.name);
    setSku(snap.sku);
    setCategory(snap.category);
    setPrice(snap.price);
    setDescription(snap.description);
    setListed(snap.listed);
    setStock(snap.stock);
    setMinThreshold(snap.minThreshold);
    setMaxThreshold(snap.maxThreshold);
    setUnit(snap.unit);
    setLocation(snap.location);
    setSavedSnapshot(snap);
  }, [editId]);

  const nowLabel = useMemo(() => {
    const d = new Date();
    return `Today, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }, []);

  function discard() {
    setName(savedSnapshot.name);
    setSku(savedSnapshot.sku);
    setCategory(savedSnapshot.category);
    setPrice(savedSnapshot.price);
    setDescription(savedSnapshot.description);
    setListed(savedSnapshot.listed);
    setStock(savedSnapshot.stock);
    setMinThreshold(savedSnapshot.minThreshold);
    setMaxThreshold(savedSnapshot.maxThreshold);
    setUnit(savedSnapshot.unit);
    setLocation(savedSnapshot.location);
  }

  function saveProduct() {
    upsertSupplierCatalogItem(
      {
        id: editId || undefined,
        name,
        sku,
        category,
        price: parseFloat(String(price).replace(/,/g, '')) || 0,
        quantity: stock,
        minThreshold: parseInt(String(minThreshold), 10) || 0,
        maxThreshold: parseInt(String(maxThreshold), 10) || 100,
        unit,
        description,
        storageLocation: location,
        listed,
      },
      actor?.id
    );
    navigate('/app/supplier/products');
  }

  function adjustStock(delta) {
    setStock((s) => Math.max(0, Math.min(99999, s + delta)));
  }

  if (missing && editId) {
    return (
      <div className={ui.supplierBoard}>
        <header className={ui.supplierProdEditTop}>
          <div className={ui.supplierProdEditTopMain}>
            <p className={ui.supplierProdEditCrumb}>Products</p>
            <h1 className={ui.supplierProdEditTitle}>Listing not found</h1>
            <p className={ui.supplierProdEditLead}>This product ID is not in your catalog. It may have been removed or the link is outdated.</p>
          </div>
          <div className={ui.supplierProdEditTopActions}>
            <button type="button" className={ui.supplierProdEditPrimary} onClick={() => navigate('/app/supplier/products')}>
              Back to inventory
            </button>
          </div>
        </header>
      </div>
    );
  }

  const isNew = !editId;
  const crumb = isNew ? 'Products › Add product' : 'Products › Edit product';
  const title = isNew ? 'Add product' : 'Product details';
  const saveLabel = isNew ? 'Create listing' : 'Update product';

  return (
    <div className={ui.supplierBoard}>
      <header className={ui.supplierProdEditTop}>
        <div className={ui.supplierProdEditTopMain}>
          <p className={ui.supplierProdEditCrumb}>{crumb}</p>
          <h1 className={ui.supplierProdEditTitle}>{title}</h1>
          <p className={ui.supplierProdEditLead}>
            Manage your listing attributes, inventory levels, and visibility on the E-CUNGA network. Changes are saved to this demo catalog in your
            browser.
          </p>
        </div>
        <div className={ui.supplierProdEditTopActions}>
          <button type="button" className={ui.supplierProdEditGhost} onClick={discard}>
            Discard changes
          </button>
          <button type="button" className={ui.supplierProdEditPrimary} onClick={saveProduct}>
            {saveLabel}
          </button>
        </div>
      </header>

      <div className={ui.supplierProdEditPanel}>
        <div className={ui.supplierProdEditGrid}>
          <div className={ui.supplierProdEditCol}>
            <section className={ui.supplierProdEditSection}>
              <h2 className={ui.supplierProdEditSectionTitle}>General information</h2>
              <label className={ui.supplierProdEditField}>
                <span className={ui.supplierProdEditLabel}>Product name</span>
                <input className={ui.supplierProdEditInput} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className={ui.supplierProdEditField}>
                <span className={ui.supplierProdEditLabel}>SKU</span>
                <input className={ui.supplierProdEditInput} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. MED-GLV-001" />
              </label>
              <label className={ui.supplierProdEditField}>
                <span className={ui.supplierProdEditLabel}>Category</span>
                <select className={ui.supplierProdEditSelect} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className={ui.supplierProdEditField}>
                <span className={ui.supplierProdEditLabel}>Price ({currency})</span>
                <div className={ui.supplierProdEditPriceWrap}>
                  <span className={ui.supplierProdEditPricePrefix}>{currency === 'USD' ? '$' : `${currency} `}</span>
                  <input
                    className={ui.supplierProdEditInputPrice}
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                  />
                </div>
              </label>
              <label className={ui.supplierProdEditField}>
                <span className={ui.supplierProdEditLabel}>Description</span>
                <textarea className={ui.supplierProdEditTextarea} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
            </section>

            <section className={ui.supplierProdEditSection}>
              <h2 className={ui.supplierProdEditSectionTitle}>Inventory &amp; availability</h2>
              <div className={ui.supplierProdEditToggleRow}>
                <span className={ui.supplierProdEditLabelPlain}>Listed on marketplace</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={listed}
                  className={listed ? ui.supplierProdEditSwitchOn : ui.supplierProdEditSwitch}
                  onClick={() => setListed((a) => !a)}
                >
                  <span className={ui.supplierProdEditSwitchKnob} />
                </button>
              </div>
              <label className={ui.supplierProdEditField}>
                <span className={ui.supplierProdEditLabel}>Unit of measure</span>
                <select className={ui.supplierProdEditSelect} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {PRODUCT_EDIT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <div className={ui.supplierProdEditStockCard}>
                <p className={ui.supplierProdEditStockLabel}>Stock quantity</p>
                <div className={ui.supplierProdEditStepper}>
                  <button type="button" className={ui.supplierProdEditStepBtn} onClick={() => adjustStock(-1)} aria-label="Decrease stock">
                    −
                  </button>
                  <span className={ui.supplierProdEditStockValue}>{stock}</span>
                  <button type="button" className={ui.supplierProdEditStepBtn} onClick={() => adjustStock(1)} aria-label="Increase stock">
                    +
                  </button>
                </div>
                <p className={ui.supplierProdEditStockHint}>
                  <span className={ui.supplierProdEditStockOk} aria-hidden>
                    ✓
                  </span>
                  Min / max thresholds drive low-stock alerts on the inventory ledger.
                </p>
              </div>
              <div className={ui.supplierProdEditFieldPair}>
                <label>
                  <span className={ui.supplierProdEditLabel}>Min threshold</span>
                  <input
                    className={ui.supplierProdEditInput}
                    inputMode="numeric"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <label>
                  <span className={ui.supplierProdEditLabel}>Max threshold</span>
                  <input
                    className={ui.supplierProdEditInput}
                    inputMode="numeric"
                    value={maxThreshold}
                    onChange={(e) => setMaxThreshold(e.target.value.replace(/\D/g, ''))}
                  />
                </label>
              </div>
              <div className={ui.supplierProdEditLocationCard}>
                <span className={ui.supplierProdEditLocationIcon} aria-hidden>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className={ui.supplierProdEditLocationLabel}>Storage location</p>
                  <input className={ui.supplierProdEditLocationInput} value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
              </div>
            </section>
          </div>

          <div className={ui.supplierProdEditCol}>
            <section className={ui.supplierProdEditSection}>
              <h2 className={ui.supplierProdEditSectionTitle}>Product media</h2>
              <div className={ui.supplierProdEditHero} role="img" aria-label="Primary product preview">
                <span className={ui.supplierProdEditHeroInner} />
              </div>
              <div className={ui.supplierProdEditThumbs}>
                <button type="button" className={ui.supplierProdEditThumb} aria-label="Gallery image 1" />
                <button type="button" className={ui.supplierProdEditThumb} aria-label="Gallery image 2" />
                <button type="button" className={ui.supplierProdEditThumbAdd} aria-label="Add media">
                  +
                </button>
              </div>
              <p className={ui.supplierProdEditMediaHint}>Recommended size: 1200×1200px. Supports JPG, PNG, WebP up to 5MB.</p>
            </section>

            <section className={ui.supplierProdEditCurator}>
              <div className={ui.supplierProdEditCuratorHead}>
                <span className={ui.supplierProdEditCuratorSpark} aria-hidden>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <h2 className={ui.supplierProdEditCuratorTitle}>The Curator</h2>
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

            <footer className={ui.supplierProdEditMeta}>
              <div className={ui.supplierProdEditMetaRow}>
                <span className={ui.supplierProdEditMetaLabel}>Listing ID</span>
                <span className={ui.supplierProdEditMetaValue}>{editId || '— (assigned on save)'}</span>
              </div>
              <div className={ui.supplierProdEditMetaRow}>
                <span className={ui.supplierProdEditMetaLabel}>Last saved preview</span>
                <span className={ui.supplierProdEditMetaValue}>{nowLabel}</span>
              </div>
              <div className={ui.supplierProdEditMetaRow}>
                <span className={ui.supplierProdEditMetaLabel}>Listing status</span>
                <span className={ui.supplierProdEditStatusPill}>{listed ? 'Listed' : 'Paused'}</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SupplierSettings() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const company = state.company;
  const initials = (actor?.fullName || user?.email || 'S')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Settings"
        title="Partner portal preferences"
        description="Your supplier profile, how we reach you, and read-only tenant context. Organization-wide policies are managed by the hospital admin in e-CUNGA."
      />
      <div className={ui.supplierSettingsGrid}>
        <section className={ui.supplierSettingsCard}>
          <h2 className={ui.supplierSettingsCardTitle}>Signed-in account</h2>
          <div className={ui.supplierSettingsProfile}>
            <span className={ui.supplierSettingsAvatar} aria-hidden>
              {initials}
            </span>
            <div>
              <p className={ui.supplierSettingsName}>{actor?.fullName || 'Supplier user'}</p>
              <p className={ui.supplierSettingsMeta}>{user?.email}</p>
              <p className={ui.supplierSettingsMeta}>Role: Supplier</p>
            </div>
          </div>
        </section>
        <section className={ui.supplierSettingsCard}>
          <h2 className={ui.supplierSettingsCardTitle}>Tenant context</h2>
          <dl className={ui.supplierSettingsDl}>
            <div className={ui.supplierSettingsDlRow}>
              <dt>Organization</dt>
              <dd>{company?.name || '—'}</dd>
            </div>
            <div className={ui.supplierSettingsDlRow}>
              <dt>Default currency</dt>
              <dd>{company?.currency || '—'}</dd>
            </div>
            <div className={ui.supplierSettingsDlRow}>
              <dt>Portal language default</dt>
              <dd>{company?.language || '—'}</dd>
            </div>
          </dl>
          <p className={ui.supplierSettingsNote}>Legal entity, tax IDs, and retention rules are edited by your customer&apos;s admin—not from this supplier view.</p>
        </section>
        <section className={`${ui.supplierSettingsCard} ${ui.supplierSettingsCardWide}`}>
          <h2 className={ui.supplierSettingsCardTitle}>Notifications</h2>
          <p className={ui.supplierSettingsP}>
            Alerts fire when requisitions are released to you, when finance approves or rejects a proforma, and when payment is posted.
          </p>
          <ul className={ui.supplierSettingsList}>
            <li>Use Messages &amp; notices for full threads; the header mirrors unread counts.</li>
            <li>The AI Insights shortcut opens Products so you can reconcile supply history and documents quickly.</li>
          </ul>
        </section>
        <section className={`${ui.supplierSettingsCard} ${ui.supplierSettingsCardWide}`}>
          <h2 className={ui.supplierSettingsCardTitle}>Documents &amp; filenames</h2>
          <p className={ui.supplierSettingsP}>
            Finance usually matches PDFs using requisition reference and invoice ID. After a rejection, rename clearly so the new upload is obvious in audit trails.
          </p>
        </section>
      </div>
    </div>
  );
}

export function SupplierHistory() {
  const state = usePortalState();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [histQ, setHistQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const catalog = state.supplierCatalog ?? [];
  const currency = state.company?.currency || 'RWF';

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
    const buckets = [0, 0, 0, 0, 0, 0];
    (state.consumptions || []).forEach((c) => {
      const wd = new Date(c.createdAt).getDay();
      if (wd >= 1 && wd <= 6) buckets[wd - 1] += Number(c.quantity || 0);
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((n) => Math.round((n / max) * 100) || 8);
  }, [state.consumptions, refreshTick]);

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
    const lines = filtered.map((listing) => {
      const st = catalogListingStatus(listing);
      return [listing.name, listing.sku, listing.category, String(listing.price), String(listing.quantity), listing.unit || '', st.label].map(
        escapeCsvCell
      );
    });
    const csv = [headers.join(','), ...lines.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={ui.supplierBoard}>
      <header className={ui.supplierProductsHeader}>
        <div className={ui.supplierProductsHeaderText}>
          <p className={ui.supplierProductsEyebrow}>Products</p>
          <h1 className={ui.supplierProductsTitle}>Product inventory</h1>
          <p className={ui.supplierProductsLead}>
            Manage your catalog, monitor stock velocity, and optimize listing visibility across the E-CUNGA network.
          </p>
        </div>
        <div className={ui.supplierProductsHeaderActions}>
          <button
            type="button"
            className={ui.supplierProductsOutlineBtn}
            onClick={() => {
              setFilterOpen((o) => !o);
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            Advanced filters
          </button>
          <button type="button" className={ui.supplierProductsAddBtn} onClick={() => navigate('/app/supplier/product-edit')}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
            </svg>
            Add product
          </button>
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
              +12%
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
              +8%
            </span>
          </div>
          <p className={ui.supplierProductsKpiSub}>At-listing value (qty × price)</p>
        </article>
        <article className={`${ui.supplierProductsKpi} ${ui.supplierProductsKpiAi}`}>
          <p className={ui.supplierProductsKpiLabel}>AI insights</p>
          <p className={ui.supplierProductsKpiAiText}>
            Demand for <strong>Organic Spices</strong> is projected to increase by <strong>25%</strong> next month.
          </p>
        </article>
      </div>

      <div
        className={filterOpen ? `${ui.supplierProductsFilterBar} ${ui.supplierProductsFilterBarOpen}` : ui.supplierProductsFilterBar}
        role="search"
      >
        <label className={ui.supplierProductsSearchField}>
          <span className={ui.supplierProductsSearchIcon} aria-hidden>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={searchRef}
            className={ui.supplierProductsSearchInput}
            placeholder="Search product ledger…"
            value={histQ}
            onChange={(e) => {
              setHistQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {filterOpen ? (
          <>
            <label className={ui.supplierProductsCategoryField}>
              <span className={ui.supplierProductsCategoryLabel}>Category</span>
              <select
                className={ui.supplierProductsCategorySelect}
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
          </>
        ) : null}
        <button type="button" className={ui.supplierProductsClearBtn} onClick={() => setHistQ('')}>
          Clear
        </button>
      </div>

      <section className={ui.supplierProductsTableWrap}>
        <div className={ui.supplierLedgerCard}>
          <div className={ui.supplierLedgerToolbar}>
            <h2 className={ui.supplierLedgerToolbarTitle}>Inventory ledger</h2>
            <div className={ui.supplierLedgerToolbarBtns}>
              <button type="button" className={ui.supplierLedgerIconBtn} onClick={exportCsv} aria-label="Download CSV">
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
                      <span className={ui.inventoryThumb} aria-hidden>
                        {initials}
                      </span>
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
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((label, i) => (
              <div key={label} className={ui.supplierProductsBarCol}>
                <div className={ui.supplierProductsBarTrack}>
                  <div
                    className={i === 2 ? ui.supplierProductsBarFillHot : ui.supplierProductsBarFill}
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
    </div>
  );
}

export function SupplierMessages() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const messages = getMessagesForRole('supplier');
  const notifications = getNotificationsForRole('supplier');
  const supplierLogs = state.activity.filter((entry) => entry.actorId === actor?.id || entry.actorName === actor?.fullName).slice(0, 6);

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Messages & notices"
        title="Everything finance and operations send you"
        description="Notifications are short system signals; messages carry richer context. The top bar also mirrors alerts for quick access."
      />
      <div className={ui.supplierMsgGrid}>
        <section className={ui.supplierMsgCard}>
          <h2 className={ui.supplierMsgTitle}>Messages</h2>
          <ul className={ui.supplierMsgList}>
            {messages.map((message) => (
              <li key={message.id} className={ui.supplierMsgItem}>
                <p className={ui.supplierMsgItemTitle}>{message.title}</p>
                <p className={ui.supplierMsgItemBody}>{message.body}</p>
                <p className={ui.supplierMsgItemMeta}>
                  {message.from} · {formatDateTime(message.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section className={ui.supplierMsgCard}>
          <h2 className={ui.supplierMsgTitle}>Notifications</h2>
          <ul className={ui.supplierMsgList}>
            {notifications.map((entry) => (
              <li key={entry.id} className={ui.supplierMsgItem}>
                <p className={ui.supplierMsgItemTitle}>{entry.title}</p>
                <p className={ui.supplierMsgItemBody}>{entry.body}</p>
                <p className={ui.supplierMsgItemMeta}>{formatDateTime(entry.createdAt)}</p>
              </li>
            ))}
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
