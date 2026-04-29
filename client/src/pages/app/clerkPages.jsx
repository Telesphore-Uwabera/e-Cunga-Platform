import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../context/AuthContext.jsx';
import { AddItemModal } from '../../components/StockManagementModals.jsx';
import { categoryFilterOptionLabel } from '../../lib/formatters.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useShellSearchQuery } from '../../hooks/useShellSearchQuery.js';
import { getClerkRangeBounds, isoInRange } from '../../utils/reportFilters.js';
import { SearchIcon, TrashIcon, CheckIcon, CloseIcon, DownloadIcon } from '../../components/Icons.jsx';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import { useFlash } from '../../components/FlashMessage.jsx';
import ui from './DashboardUi.module.css';
import {
  ActivityFeed,
  ClearFiltersIconButton,
  PageIntro,
  StatusBadge,
  formatCompactDateTime,
  formatDate,
  formatDateTime,
  formatIsoDateOnly,
  formatMoney,
  stockStatus,
  workflowLabel,
} from './roleUi.jsx';

function useClerkActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'clerk'),
    [state.users, user?.email]
  );
}

/** Chargeable billing entries use this prefix in `purpose` (legacy) or `consumptionKind === 'bill'`. */
const BILL_PURPOSE_PREFIX = 'Bill:';

function isBillConsumption(c) {
  if (c?.consumptionKind === 'bill') return true;
  return String(c?.purpose || '').startsWith(BILL_PURPOSE_PREFIX);
}

function parseBillPurpose(purpose) {
  const p = String(purpose || '');
  if (!p.startsWith(BILL_PURPOSE_PREFIX)) {
    return { recipient: '—', detail: p || '—' };
  }
  const rest = p.slice(BILL_PURPOSE_PREFIX.length).trim();
  const sep = rest.indexOf(' — ');
  if (sep === -1) return { recipient: rest || '—', detail: '—' };
  return { recipient: rest.slice(0, sep).trim() || '—', detail: rest.slice(sep + 3).trim() || '—' };
}

function categoryForLineDescription(description, stockItems) {
  const d = String(description || '').trim().toLowerCase();
  if (!d) return '';
  const lowerItems = stockItems.map((i) => ({
    name: String(i.name || '').trim().toLowerCase(),
    category: i.category,
  }));
  const exact = lowerItems.find((i) => i.name === d);
  if (exact?.category) return exact.category;
  const hit = lowerItems.find((i) => i.name && (d.includes(i.name) || i.name.includes(d)));
  return hit?.category || '';
}

function requisitionRequestedInMonth(req, monthKey) {
  if (!monthKey) return true;
  const raw = req.requestedAt || req.createdAt;
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return key === monthKey;
}

function ClerkMaterialsRailExport({
  t,
  stockItems,
  requisitions,
  clerkId,
  exportMonth,
  setExportMonth,
  exportCategory,
  setExportCategory,
}) {
  const categories = useMemo(
    () => [...new Set(stockItems.map((i) => i.category).filter(Boolean))].sort(),
    [stockItems]
  );
  const monthChoices = useMemo(() => {
    const out = [{ value: '', label: t('app.clerk.materialsExportAllMonths') }];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      out.push({ value, label });
    }
    return out;
  }, [t]);

  function downloadHistoryExcel() {
    const mine = (requisitions || []).filter((r) => r.clerkId === clerkId);
    const aoa = [
      [
        t('app.clerk.materialsExportColReqId'),
        t('app.clerk.materialsExportColReqDate'),
        t('app.clerk.requisitionColDateValue'),
        t('app.clerk.materialsExportColTitle'),
        t('app.clerk.requisitionDepartmentLabel'),
        t('app.clerk.materialsExportColStatus'),
        t('app.clerk.requisitionColDescription'),
        t('app.clerk.requisitionColQtyRequested'),
        t('app.clerk.requisitionColUnit'),
        t('app.clerk.materialsExportColCategory'),
      ],
    ];
    for (const req of mine) {
      if (!requisitionRequestedInMonth(req, exportMonth)) continue;
      for (const line of req.lines || []) {
        const cat = categoryForLineDescription(line.description, stockItems);
        if (exportCategory !== 'all' && cat !== exportCategory) continue;
        aoa.push([
          req.id,
          req.requestedAt ? formatDate(req.requestedAt) : '—',
          line.dateValue || '—',
          req.title || '—',
          req.requestingDepartment || '—',
          req.status || '—',
          line.description || '—',
          line.quantity,
          line.unit || 'units',
          cat || '—',
        ]);
      }
    }
    if (aoa.length < 2) {
      aoa.push([t('app.clerk.materialsExportEmpty')]);
    }
    downloadAoAAsXlsx(
      `my-requisition-lines-${exportMonth || 'all'}-${new Date().toISOString().slice(0, 10)}`,
      aoa,
      'Requests'
    );
  }

  return (
    <div className={ui.clerkMaterialsRailExport}>
      <p className={ui.clerkMaterialsRailExportEyebrow}>{t('app.clerk.materialsExportEyebrow')}</p>
      <p className={ui.clerkMaterialsRailExportTitle}>{t('app.clerk.materialsExportTitle')}</p>
      <label className={ui.clerkMaterialsRailExportField}>
        <span>{t('app.clerk.materialsExportMonth')}</span>
        <select
          value={exportMonth}
          onChange={(e) => setExportMonth(e.target.value)}
          className={ui.clerkMaterialsRailExportSelect}
        >
          {monthChoices.map((m) => (
            <option key={m.value || 'all'} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className={ui.clerkMaterialsRailExportField}>
        <span>{t('app.clerk.materialsExportCategory')}</span>
        <select
          value={exportCategory}
          onChange={(e) => setExportCategory(e.target.value)}
          className={ui.clerkMaterialsRailExportSelect}
        >
          <option value="all">{t('app.clerk.materialsExportAllCategories')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={ui.clerkMaterialsRailExportBtn} onClick={downloadHistoryExcel}>
        {t('app.clerk.materialsExportDownload')}
      </button>
    </div>
  );
}

function ClerkIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'inventory') {
    return (
      <svg {...common}>
        <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M18 15v4m-2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'request') {
    return (
      <svg {...common}>
        <path d="M6 4h9l3 3v13H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 19V9M12 19V5M19 19v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const diff = new Date(dateValue).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function shortMonthDay(dateValue) {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function usageRows(consumptions) {
  const grouped = consumptions.reduce((map, entry) => {
    map.set(entry.itemName, (map.get(entry.itemName) || 0) + Number(entry.quantity || 0));
    return map;
  }, new Map());
  return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

const ANALYTICS_SLICE_COLORS = ['#692751', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#64748b'];

function analyticsConicStops(slices) {
  const total = slices.reduce((s, x) => s + Number(x.value || 0), 0) || 1;
  let acc = 0;
  return slices
    .map((sl) => {
      const v = Number(sl.value || 0);
      const start = (acc / total) * 100;
      acc += v;
      const end = (acc / total) * 100;
      return `${sl.color} ${start}% ${end}%`;
    })
    .join(', ');
}

function overviewName(actor) {
  if (actor?.team === 'Warehouse A') return 'Warehouse Alpha';
  if (actor?.team === 'Warehouse B') return 'Warehouse Beta';
  return actor?.team || actor?.location || 'Warehouse Alpha';
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Last `days` calendar days: total units consumed per day (clerk-scoped consumptions). */
function chartSeriesFromConsumptions(consumptions, days = 12) {
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = startOfLocalDay(d);
    buckets.push({ key, date: new Date(key), total: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  consumptions.forEach((c) => {
    const key = startOfLocalDay(new Date(c.createdAt));
    const b = byKey.get(key);
    if (b) b.total += Number(c.quantity || 0);
  });
  const totals = buckets.map((b) => b.total);
  const max = Math.max(0, ...totals);
  const peak = max > 0 ? Math.max(...totals) : 0;
  return buckets.map((b) => ({
    id: `bar_${b.key}`,
    value: max === 0 ? 0 : Math.max(6, Math.round((b.total / max) * 100)),
    label: b.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    emphasis: peak > 0 && b.total === peak,
    amount: b.total % 1 === 0 ? String(b.total) : b.total.toFixed(1),
  }));
}

/** Compare units consumed last 7 days vs the previous 7 days. */
function consumptionWeekOverWeekDelta(consumptions) {
  const now = Date.now();
  const ms7 = 7 * 86400000;
  let recent = 0;
  let prior = 0;
  consumptions.forEach((c) => {
    const t = new Date(c.createdAt).getTime();
    const q = Number(c.quantity || 0);
    if (t >= now - ms7) recent += q;
    else if (t >= now - 2 * ms7 && t < now - ms7) prior += q;
  });
  if (prior <= 0 && recent <= 0) return { label: '—', className: 'info' };
  if (prior <= 0) return { label: `+${Math.round(recent)}`, className: 'info' };
  const pct = ((recent - prior) / prior) * 100;
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  return {
    label: `${pct >= 0 ? '+' : ''}${rounded}%`,
    className: pct > 0 ? 'up' : pct < 0 ? 'down' : 'info',
  };
}

function movementFeed({ requisitions, consumptions, nearExpiryItems, alerts }) {
  const events = [];

  requisitions.forEach((entry) => {
    events.push({
      sortTime: new Date(entry.updatedAt || entry.requestedAt).getTime(),
    id: `req_${entry.id}`,
    kind: 'request',
    time: formatDate(entry.updatedAt || entry.requestedAt),
    title: entry.title,
    meta: `${entry.location} · ${workflowLabel(entry.status)}`,
    tag: entry.priority === 'critical' ? 'Urgent' : 'Workflow',
    tone: entry.priority === 'critical' ? 'bad' : 'ok',
    });
  });

  consumptions.forEach((entry) => {
    const bill = isBillConsumption(entry);
    const { recipient: billTo } = bill ? parseBillPurpose(entry.purpose) : { recipient: '' };
    events.push({
      sortTime: new Date(entry.createdAt).getTime(),
    id: `use_${entry.id}`,
      kind: bill ? 'bill' : 'usage',
    time: formatDate(entry.createdAt),
      title: bill ? `${entry.itemName} billed` : `${entry.itemName} used`,
      meta: bill
        ? `${entry.quantity} ${entry.unit} · ${billTo}${entry.relatedRequisitionId ? ` · Req ${entry.relatedRequisitionId}` : ''}`
        : `${entry.quantity} ${entry.unit} · ${entry.purpose}${entry.relatedRequisitionId ? ` · Req ${entry.relatedRequisitionId}` : ''}`,
      tag: bill ? 'Billed' : 'Consumed',
    tone: 'neutral',
    });
  });

  nearExpiryItems.forEach((entry) => {
    const dl = entry.daysLeft != null ? entry.daysLeft : 999;
    events.push({
      sortTime: Date.now() - dl * 86400000,
    id: `exp_${entry.id}`,
    kind: 'alert',
    time: `${entry.daysLeft} days left`,
    title: `${entry.name} nearing expiry`,
    meta: `${entry.quantity} ${entry.unit} remaining`,
    tag: 'Restock',
    tone: 'warn',
    });
  });

  alerts.forEach((entry) => {
    events.push({
      sortTime: new Date(entry.createdAt).getTime(),
    id: `ntf_${entry.id}`,
    kind: 'alert',
    time: formatDate(entry.createdAt),
    title: entry.title,
    meta: entry.body,
    tag: 'Monitor',
    tone: 'warn',
    });
  });

  events.sort((a, b) => b.sortTime - a.sortTime);
  const seen = new Set();
  return events.filter((e) => (seen.has(e.id) ? false : seen.add(e.id))).slice(0, 4);
}

function StatCardIcon({ kind }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'stock') {
    return (
      <svg {...common}>
        <path d="M7 8h10M7 12h7m-7 4h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === 'warning') {
    return (
      <svg {...common}>
        <path d="M12 4 20 19H4L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="5" y="5" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 9.5h7M8.5 12h7M8.5 14.5h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MovementIcon({ kind }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'request') {
    return (
      <svg {...common}>
        <path d="M6 4h9l3 3v13H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'usage') {
    return (
      <svg {...common}>
        <path d="M12 5v14M7 10l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 4 20 19H4L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function EyeLineIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path d="m4 16.5 9.8-9.8 3.5 3.5L7.5 20H4v-3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m12.8 7.7 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}


function getSmoothCurve(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function ClerkDashboard() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [timeRange, setTimeRange] = useState(30);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const actor = useClerkActor(state, user);

  const dashboardMetrics = useMemo(() => {
    const clerkId = actor?.id;
    const items = state.stockItems.filter((item) => item.ownerId === clerkId);
    const requisitions = state.requisitions.filter((entry) => entry.clerkId === clerkId);
    const alerts = notificationsForRole(state, 'clerk');
    const consumptions = state.consumptions.filter((entry) => entry.clerkId === clerkId);
    const usageForTrends = consumptions.filter((c) => !isBillConsumption(c));

    const skuCount = items.length;
    const low = items.filter((item) => Number(item.quantity) <= Number(item.minThreshold || 0) && Number(item.quantity) > 0).length;
    const out = items.filter((item) => Number(item.quantity) <= 0).length;
    const nearExpiryItems = items
      .filter((item) => item.expiryDate)
      .map((item) => ({ ...item, daysLeft: daysUntil(item.expiryDate) }))
      .filter((item) => item.daysLeft != null && item.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
    const activeRequests = requisitions.filter((entry) => entry.status !== 'closed');
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const monthlyRequests = requisitions.filter(
      (entry) => new Date(entry.requestedAt || entry.updatedAt || Date.now()).getTime() >= monthStart
    );
    const monthlyRequestedMaterials = monthlyRequests.reduce(
      (sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + Number(line.quantity || 0), 0),
      0
    );
    const monthLabel = new Date().toLocaleDateString([], { month: 'long' });
    const totalUnitsOnHand = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const lowStockOrOutCount = low + out;
    const usageWow = consumptionWeekOverWeekDelta(usageForTrends);
    
    // Adjust chart density based on range
    const chartBars = chartSeriesFromConsumptions(usageForTrends, timeRange === 90 ? 12 : 10);
    
    const recentMovement = movementFeed({ requisitions, consumptions, nearExpiryItems, alerts });
    const firstExpiry = nearExpiryItems[0];
    return {
      skuCount,
      low,
      out,
      nearExpiryItems,
      activeRequests,
      monthlyRequests,
      monthlyRequestedMaterials,
      monthLabel,
      totalUnitsOnHand,
      lowStockOrOutCount,
      usageWow,
      chartBars,
      recentMovement,
      firstExpiry,
    };
  }, [actor?.id, state.stockItems, state.requisitions, state.consumptions, state.notifications, state.users, timeRange]);

  const {
    skuCount,
    low,
    out,
    nearExpiryItems,
    activeRequests,
    monthlyRequests,
    monthlyRequestedMaterials,
    monthLabel,
    totalUnitsOnHand,
    lowStockOrOutCount,
    usageWow,
    chartBars,
    recentMovement,
    firstExpiry,
  } = dashboardMetrics;

  const stockDeltaClass =
    usageWow.className === 'up' ? ui.clerkDeltaWarn : usageWow.className === 'down' ? ui.clerkDeltaOk : ui.clerkDeltaInfo;

  const overviewTitle = overviewName(actor);

  const curveData = useMemo(() => {
    return chartBars.map((b, i) => ({
      x: (i / (chartBars.length - 1)) * 100,
      y: 28 - (b.value / 100) * 24
    }));
  }, [chartBars]);

  const smoothPath = useMemo(() => getSmoothCurve(curveData), [curveData]);

  return (
    <div className={ui.clerkBoard}>
      <div className={ui.clerkBoardHeader}>
        <div>
          <h1 className={ui.clerkBoardTitle}>
            {overviewTitle} <span>{t('app.clerk.overviewSpan')}</span>
          </h1>
          <p className={ui.clerkBoardMeta}>
            {t('app.clerk.dashboardMeta', {
              total: skuCount,
              location: actor?.location || t('common.yourWarehouse'),
            })}
          </p>
        </div>
      </div>

      <div className={ui.clerkBoardGrid}>
        <div className={ui.clerkBoardMain}>
          <div className={ui.clerkStatRow}>
            <article className={`${ui.clerkStatCard} ${ui.clerkStatCardPurple}`}>
              <div className={ui.summaryCardHead}>
                <p className={ui.clerkStatLabel}>Total stock balance</p>
                <button
                  type="button"
                  className={ui.summaryCardPlus}
                  onClick={() => navigate('/app/clerk/inventory')}
                  title="View Inventory"
                >
                  <EyeLineIcon size={16} />
                </button>
              </div>
              <div className={ui.clerkStatMain}>
                <p className={ui.clerkStatValue}>{Math.round(totalUnitsOnHand).toLocaleString()}</p>
                <span className={stockDeltaClass} title="Change in units consumed vs the previous 7 days">
                  {usageWow.label}
                </span>
              </div>
              <p className={ui.clerkStatMeta}>
                Units on hand across {skuCount.toLocaleString()} {skuCount === 1 ? 'SKU' : 'SKUs'}
              </p>
            </article>

            <article className={`${ui.clerkStatCard} ${ui.clerkStatCardOrange}`}>
              <div className={ui.clerkStatHead}>
                <p className={ui.clerkStatLabel}>Low / out of stock</p>
                <button
                  type="button"
                  className={`${ui.clerkStatAction} ${ui.clerkStatIconPeach}`}
                  onClick={() => navigate('/app/clerk/inventory?status=low')}
                  title="View Low Stock"
                >
                  <StatCardIcon kind="warning" />
                </button>
              </div>
              <div className={ui.clerkStatMain}>
                <p className={ui.clerkStatValue}>{lowStockOrOutCount.toLocaleString()}</p>
                <span className={out > 0 ? ui.clerkDeltaWarn : low > 0 ? ui.clerkDeltaInfo : ui.clerkDeltaOk}>
                  {out > 0 ? `${out} out` : low > 0 ? `${low} low` : 'OK'}
                </span>
              </div>
              <p className={ui.clerkStatMeta}>
                {nearExpiryItems.length} SKU{nearExpiryItems.length === 1 ? '' : 's'} expiring within 30 days
              </p>
            </article>

            <article className={`${ui.clerkStatCard} ${ui.clerkStatCardBlue}`}>
              <div className={ui.clerkStatHead}>
                <p className={ui.clerkStatLabel}>Active requests</p>
                <button
                  type="button"
                  className={`${ui.clerkStatAction} ${ui.clerkStatIconPurple}`}
                  onClick={() => navigate('/app/clerk/materials')}
                  title="View Requests"
                >
                  <StatCardIcon kind="pending" />
                </button>
              </div>
              <div className={ui.clerkStatMain}>
                <p className={ui.clerkStatValue}>{activeRequests.length}</p>
                <span className={ui.clerkDeltaInfo}>
                  {activeRequests.length} in queue
                </span>
              </div>
              <p className={ui.clerkStatMeta}>
                Orders awaiting fulfillment or supplier action
              </p>
            </article>

            <article className={`${ui.clerkStatCard} ${ui.clerkStatCardRed}`}>
              <div className={ui.clerkStatHead}>
                <p className={ui.clerkStatLabel}>Expiring soon</p>
                <button
                  type="button"
                  className={`${ui.clerkStatAction} ${ui.clerkStatIconYellow}`}
                  onClick={() => navigate('/app/clerk/expiry')}
                  title="View Expiry Tracking"
                >
                  <StatCardIcon kind="time" />
                </button>
              </div>
              <div className={ui.clerkStatMain}>
                <p className={ui.clerkStatValue}>{nearExpiryItems.length}</p>
                <span className={nearExpiryItems.length > 0 ? ui.clerkDeltaWarn : ui.clerkDeltaOk}>
                  {nearExpiryItems.length > 0 ? 'Review dates' : 'Dates optimal'}
                </span>
              </div>
              <p className={ui.clerkStatMeta}>
                Items reaching expiry in the next 30 days
              </p>
            </article>
          </div>

          <section className={ui.clerkChartCard}>
            <div className={ui.clerkSectionHead}>
              <div>
                <h2 className={ui.clerkSectionTitle}>Stock Usage Velocity</h2>
                <p className={ui.clerkSectionSub}>Units consumed per day (last {timeRange} days).</p>
              </div>
              <div className={ui.clerkRangePills}>
                <button 
                  type="button" 
                  className={timeRange === 30 ? ui.clerkRangePillBtnActive : ui.clerkRangePillBtn}
                  onClick={() => setTimeRange(30)}
                >
                  30 D
                </button>
                <button 
                  type="button" 
                  className={timeRange === 90 ? ui.clerkRangePillBtnActive : ui.clerkRangePillBtn}
                  onClick={() => setTimeRange(90)}
                >
                  90 D
                </button>
              </div>
            </div>
            
            <div className={ui.clerkChartContainer}>
              <svg viewBox="0 0 100 32" className={ui.clerkChartSvg} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="clerkTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ec-primary)" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="var(--ec-primary)" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                {/* Analytics-style baselines */}
                <line x1="0" y1="6" x2="100" y2="6" stroke="var(--ec-text)" strokeWidth="0.12" strokeDasharray="1.2 1.2" opacity="0.22" />
                <line x1="0" y1="11.5" x2="100" y2="11.5" stroke="var(--ec-text)" strokeWidth="0.08" strokeDasharray="0.8 0.8" opacity="0.12" />
                <line x1="0" y1="17" x2="100" y2="17" stroke="var(--ec-text)" strokeWidth="0.12" strokeDasharray="1.2 1.2" opacity="0.22" />
                <line x1="0" y1="22.5" x2="100" y2="22.5" stroke="var(--ec-text)" strokeWidth="0.08" strokeDasharray="0.8 0.8" opacity="0.12" />
                <line x1="0" y1="28" x2="100" y2="28" stroke="var(--ec-text)" strokeWidth="0.35" opacity="0.35" />
                
                {/* Smooth Curve path */}
                <path
                  d={`${smoothPath} L 100 28 L 0 28 Z`}
                  fill="url(#clerkTrendFill)"
                />
                <path
                  d={smoothPath}
                  fill="none"
                  stroke="var(--ec-primary)"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                
                {/* Clean data points */}
                {curveData.map((pt, i) => (
                  <rect
                    key={chartBars[i].id}
                    x={pt.x - 0.8}
                    y={pt.y - 0.8}
                    width="1.6"
                    height="1.6"
                    fill="var(--ec-white)"
                    stroke="var(--ec-primary)"
                    strokeWidth="0.5"
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    onMouseEnter={() => setHoveredPoint({ ...pt, ...chartBars[i] })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </svg>

              {hoveredPoint && (
                <div 
                  className={ui.clerkChartTooltip}
                  style={{ left: `${hoveredPoint.x}%`, top: `${hoveredPoint.y + 10}px` }}
                >
                  <span className={ui.clerkChartTooltipLabel}>{hoveredPoint.label}</span>
                  <span className={ui.clerkChartTooltipValue}>{hoveredPoint.value} units</span>
                </div>
              )}

              <div className={ui.clerkBars}>
                {chartBars.map((entry) => (
                  <div key={entry.id} className={ui.clerkBarCol}>
                    <span className={ui.clerkTableHeadLabel}>Approved</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className={ui.clerkQuickRow}>
            <button
              type="button"
              className={`${ui.clerkQuickAction} ${ui.clerkQuickPink}`}
              onClick={() => window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal'))}
            >
              <span className={ui.clerkQuickIcon}>
                <ClerkIcon kind="inventory" />
              </span>
              <span>
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }}
                >
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>{' '}
                Add Item
              </span>
            </button>
            <button
              type="button"
              className={`${ui.clerkQuickAction} ${ui.clerkQuickBlue}`}
              onClick={() => window.dispatchEvent(new CustomEvent('ecunga-open-bill-item-modal'))}
            >
              <span className={ui.clerkQuickIcon}>
                <ClerkIcon kind="analytics" />
              </span>
              <span>Record Usage</span>
            </button>
            <button
              type="button"
              className={`${ui.clerkQuickAction} ${ui.clerkQuickGreen}`}
              onClick={() => navigate('/app/clerk/materials')}
            >
              <span className={ui.clerkQuickIcon}>
                <ClerkIcon kind="request" />
              </span>
              <span>
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }}
                >
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>{' '}
                Request Item
              </span>
            </button>
          </div>

          <section className={ui.clerkRecoBanner}>
            <div className={ui.clerkRecoCopy}>
              <span className={ui.clerkRecoIcon}>
                <ClerkIcon kind="analytics" />
              </span>
              <div>
                <h2 className={ui.clerkRecoTitle}>{t('cungaAi.recommendationTitle')}</h2>
                <p className={ui.clerkRecoText}>
                  {firstExpiry ? (
                    <>
                      <strong>{firstExpiry.name}</strong> expires in <strong>{firstExpiry.daysLeft}</strong> day
                      {firstExpiry.daysLeft === 1 ? '' : 's'} ({firstExpiry.quantity} {firstExpiry.unit} on hand). Consider
                      requesting replenishment before stock runs out.
                    </>
                  ) : (
                    <>No items in the 30-day expiry window. Keep logging usage so forecasts stay accurate.</>
                  )}
                </p>
              </div>
            </div>
            <div className={ui.clerkRecoActions}>
              <button type="button" className={ui.clerkRecoPrimary} onClick={() => navigate('/app/clerk/materials')}>
                {t('cungaAi.applyForecast')}
              </button>
              <button type="button" className={ui.clerkRecoSecondary}>
                {t('cungaAi.dismiss')}
              </button>
            </div>
          </section>
        </div>

        <aside className={ui.clerkSideRail}>
          <div className={ui.clerkSectionHead}>
            <h2 className={ui.clerkSideTitle}>Recent Movement</h2>
            <span className={ui.clerkSideDot} />
          </div>
          
          <div className={ui.clerkMovementTableWrap}>
            <table className={ui.clerkMovementTable}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Tag</th>
                  <th>Details</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentMovement.map((entry) => (
                  <tr key={entry.id}>
                    <td className={ui.clerkMovementTableTime}>{entry.time}</td>
                    <td>
                      <span className={ui.clerkMovementTableTag}>{entry.tag}</span>
                    </td>
                    <td>
                      <p className={ui.clerkMovementTableTitle}>{entry.title}</p>
                    </td>
                    <td>
                      <span className={`${ui.clerkMovementTableStatus} ${ui[`clerkMovementTableTone_${entry.tone}`]}`}>
                        {entry.meta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className={ui.clerkHistoryBtn} onClick={() => navigate('/app/clerk/documents')}>
            View full history log
          </button>
        </aside>
      </div>
    </div>
  );
}

/** Row + filter label: prefer subcategory; Pharmacy → Medications (data stays category Pharmacy). */
function inventoryCategoryLabel(item) {
  const sub = String(item.subcategory || '').trim();
  if (sub) return sub;
  const c = String(item.category || '').trim();
  if (!c) return 'Uncategorized';
  if (c === 'Pharmacy') return 'Medications';
  if (c === 'Laboratory') return 'Lab';
  return c;
}



export function ClerkBillItemModal({ isOpen, onClose }) {
  const { t } = useI18n();
  const { state, consumeStockItem } = usePortalData();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);

  const categories = [
    'All',
    'Laboratory',
    'Consumables',
    'Medications',
    'Sanitation',
    'Office materials',
    'Others',
  ];

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [basket, setBasket] = useState([]); // { itemId, quantity, name, unit, price, max }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const stockItems = useMemo(() => {
    return state.stockItems.filter((s) => s.ownerId === actor?.id);
  }, [state.stockItems, actor?.id]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return stockItems.filter((s) => {
      let matchesCat = true;
      if (activeCategory !== 'All') {
        if (activeCategory === 'Others') {
          // Check against all known categories (excluding All and Others)
          const mainCats = categories.slice(1, categories.length - 1).map((c) => c.toLowerCase());
          const categoryText = String(s.category || '').toLowerCase();
          matchesCat = !mainCats.some((c) => categoryText.includes(c));
        } else {
          const categoryText = String(s.category || '').toLowerCase();
          if (activeCategory === 'Medications') {
            matchesCat = ['medication', 'medications', 'medicament', 'pharmacy'].some((k) => categoryText.includes(k));
          } else {
            matchesCat = categoryText.includes(activeCategory.toLowerCase());
          }
        }
      }
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || (s.sku && s.sku.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [stockItems, activeCategory, searchQuery, categories]);

  function addToBasket(item) {
    setBasket((prev) => {
      const exists = prev.find((i) => i.itemId === item.id);
      if (exists) return prev;
      return [...prev, {
        itemId: item.id,
        name: item.name,
        unit: item.unit || 'units',
        quantity: 1,
        price: item.price || 0,
        max: Number(item.quantity) || 0,
      }];
    });
  }

  function updateQty(itemId, delta) {
    setBasket((prev) => prev.map((i) => {
      if (i.itemId === itemId) {
        const next = Math.max(1, Math.min(i.max, i.quantity + delta));
        return { ...i, quantity: next };
      }
      return i;
    }));
  }

  function removeFromBasket(itemId) {
    setBasket((prev) => prev.filter((i) => i.itemId !== itemId));
  }

  async function handleSave() {
    if (!basket.length) return;
    setSaving(true);
    setError('');
    try {
      for (const entry of basket) {
        await consumeStockItem({
          itemId: entry.itemId,
          quantity: entry.quantity,
          purpose: 'Billed to patient/procedure',
          consumptionKind: 'bill',
        }, actor.id);
      }
      setBasket([]);
      onClose();
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={ui.modalOverlay} role="dialog" aria-modal="true">
      <div className={`${ui.modalCard} ${ui.checkoutModal}`}>
        <div className={ui.modalHead}>
          <div className={ui.checkoutHeadLeft}>
            <h2 className={ui.modalTitle}>Record daily usage</h2>
            <div className={ui.checkoutItemsPill}>
              Selected Items: <span>{basket.length}</span>
            </div>
          </div>
          <div className={ui.checkoutHeadActions}>
            <button
              type="button"
              className={ui.checkoutSaveBtn}
              onClick={handleSave}
              disabled={saving || !basket.length}
            >
              {saving ? '...' : <><span style={{ fontSize: '1.1rem' }}>+</span> SAVE</>}
            </button>
            <button type="button" className={ui.modalClose} onClick={onClose}>×</button>
          </div>
        </div>

        <div className={ui.checkoutTabs}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={activeCategory === cat ? `${ui.checkoutTab} ${ui.checkoutTabActive}` : ui.checkoutTab}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className={ui.checkoutSearchWrap}>
          <SearchIcon size={16} className={ui.checkoutSearchIcon} />
          <input
            type="text"
            className={ui.checkoutSearchInput}
            placeholder="Search by Name Or ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={ui.checkoutBody}>
          <div className={ui.checkoutSourcePane}>
            {error && <p className={ui.err}>{error}</p>}
            {filteredItems.length ? filteredItems.map((item) => {
              const inBasket = basket.some((b) => b.itemId === item.id);
              return (
                <div
                  key={item.id}
                  className={inBasket ? `${ui.checkoutSourceItem} ${ui.checkoutSourceItemPicked}` : ui.checkoutSourceItem}
                  onClick={() => !inBasket && addToBasket(item)}
                >
                  <div className={ui.checkoutItemInfo}>
                    <p className={ui.checkoutItemName}>{item.name}</p>
                    <p className={ui.checkoutItemSub}>{item.category} · Stock: {item.quantity}</p>
                  </div>
                  <div className={ui.checkoutItemPrice}>
                    {item.price ? `${item.price.toLocaleString()} RWF` : '0.00'}
                  </div>
                  {inBasket && <CheckIcon size={14} className={ui.checkoutPickedCheck} />}
                </div>
              );
            }) : (
              <p className={ui.checkoutEmpty}>No items found in this category.</p>
            )}
          </div>

          <div className={ui.checkoutBasketPane}>
            {basket.length ? basket.map((item) => (
              <div key={item.itemId} className={ui.checkoutBasketRow}>
                <div className={ui.checkoutBasketLeft}>
                  <p className={ui.checkoutBasketName}>{item.name}</p>
                  <p className={ui.checkoutBasketMeta}>Unit Price: {item.price ? item.price.toLocaleString() : '0.00'}</p>
                </div>
                <div className={ui.checkoutQtyControl}>
                  <button type="button" onClick={() => updateQty(item.itemId, -1)}>−</button>
                  <span className={ui.checkoutQtyVal}>{item.quantity}</span>
                  <button type="button" onClick={() => updateQty(item.itemId, 1)}>+</button>
                </div>
                <button
                  type="button"
                  className={ui.checkoutRemoveBtn}
                  onClick={() => removeFromBasket(item.itemId)}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            )) : (
              <div className={ui.basketPlaceholder}>
                <p>Your basket is empty</p>
                <span>Select items from the left to start billing</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClerkInventory() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const items = state.stockItems.filter((item) => item.ownerId === actor?.id);
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('status') || 'all';
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const shellSearch = useShellSearchQuery();
  const selectAllRef = useRef(null);

  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();

  const filteredItems = items.filter((item) => {
    const tokens = [query, shellSearch]
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean);
    const hay = `${item.name} ${item.sku || ''} ${item.category || ''} ${item.subcategory || ''} ${inventoryCategoryLabel(item)}`.toLowerCase();
    const matchesQuery = tokens.length === 0 || tokens.every((tok) => hay.includes(tok));
    if (!matchesQuery) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (filter === 'low') return stockStatus(item) === 'Low stock';
    if (filter === 'out') return stockStatus(item) === 'Out of stock';
    if (filter === 'expiry') return Boolean(item.expiryDate);
    return true;
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter, categoryFilter, query, shellSearch]);

  const sortedFilteredItems = useMemo(
    () => [...filteredItems].sort((a, b) => String(b.id).localeCompare(String(a.id))),
    [filteredItems]
  );
  const inventoryPager = usePagedList(sortedFilteredItems, {
    resetKey: `${filter}|${categoryFilter}|${query}|${shellSearch}`,
  });

  const pageIds = useMemo(() => inventoryPager.pageSlice.map((row) => row.id), [inventoryPager.pageSlice]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = somePageSelected && !allPageSelected;
  }, [somePageSelected, allPageSelected]);

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function rowsToSheetObjects(list) {
    return list.map((item) => ({
      'Item name': item.name,
      Category: inventoryCategoryLabel(item),
      SKU: item.sku || '',
      Quantity: item.quantity,
      Unit: item.unit || '',
      Status: stockStatus(item),
      'Expiry date': item.expiryDate ? formatDate(item.expiryDate) : '',
      Location: item.location || '',
    }));
  }

  function downloadXlsx(list) {
    const sheetRows = rowsToSheetObjects(list);
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'clerk-inventory.xlsx');
  }

  const selectedItems = sortedFilteredItems.filter((row) => selectedIds.has(row.id));

  return (
    <div className={ui.inventoryBoard}>
      <div className={ui.inventoryHeader}>
        <div>
          <h1 className={ui.inventoryTitle}>{t('app.clerk.inventoryTitle')}</h1>
          <p className={ui.inventoryLead}>
            {t('app.clerk.inventoryLead')}{' '}
            <Link to="/terms" className={ui.inventoryLegalLink}>
              {t('shell.termsAndConditions')}
            </Link>
          </p>
        </div>
        <button type="button" className={ui.inventoryDownloadBtn} onClick={() => downloadXlsx(filteredItems)}>
          <DownloadIcon />
          <span>{t('app.clerk.downloadXlsx')}</span>
        </button>
      </div>

      <div className={ui.inventoryFilterRow}>
        <label className={ui.inventoryFilter}>
          <span>Category:</span>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={ui.inventorySelect}>
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryFilterOptionLabel(category)}
              </option>
            ))}
          </select>
        </label>

        <label className={ui.inventoryFilter}>
          <span>Status:</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={ui.inventorySelect}>
            <option value="all">Any Status</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
            <option value="expiry">With Expiry</option>
          </select>
        </label>

        <input
          className={ui.inventorySearch}
          placeholder="Search inventory ledger..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <span className={ui.inventoryCount}>
          {sortedFilteredItems.length
            ? `${inventoryPager.rangeFrom}–${inventoryPager.rangeTo} of ${sortedFilteredItems.length} items`
            : '0 items'}
        </span>
      </div>

      {selectedIds.size > 0 ? (
        <div className={ui.inventorySelectionBar} role="status">
          <span className={ui.inventorySelectionMeta}>
            {t('app.clerk.inventorySelectedCount', { count: selectedIds.size })}
          </span>
          <button type="button" className={ui.inventorySelectionBtn} onClick={() => downloadXlsx(selectedItems)}>
            {t('app.clerk.downloadSelectedXlsx')}
          </button>
          <button type="button" className={ui.inventorySelectionBtnGhost} onClick={() => setSelectedIds(new Set())}>
            {t('app.clerk.clearSelection')}
          </button>
        </div>
      ) : null}

      <div className={ui.inventoryTableCard}>
        <div className={ui.inventoryTableHead}>
          <span className={ui.inventorySelectCell}>
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allPageSelected}
              onChange={toggleSelectAllPage}
              aria-label={t('app.clerk.selectPageAria')}
            />
          </span>
          <span>Item name</span>
          <span>Category</span>
          <span>Stock level</span>
          <span>Status</span>
          <span>Expiry date</span>
          <span>Actions</span>
        </div>

        <div className={ui.inventoryRows}>
          {inventoryPager.pageSlice.map((item) => {
            const status = stockStatus(item);

            return (
              <article key={item.id} className={ui.inventoryRow}>
                <label className={ui.inventorySelectCell}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleRow(item.id)}
                    aria-label={t('app.clerk.selectRowAria', { name: item.name })}
                  />
                </label>
                <div className={ui.inventoryItemCell}>
                  <div>
                    <p className={ui.inventoryItemName}>{item.name}</p>
                    <p className={ui.inventoryItemMeta}>SKU: {item.sku || 'WL-0000-X'}</p>
                  </div>
                </div>

                <div className={ui.inventoryCategoryCell}>
                  <span className={ui.inventoryCategoryPill}>{inventoryCategoryLabel(item)}</span>
                </div>

                <div className={`${ui.inventoryLevelCell} ${ui.inventoryLevelCellSlim}`}>
                  <div className={ui.inventoryLevelNumbers}>
                    <strong>{item.quantity}</strong>
                    <span>/ {item.maxThreshold || 100}</span>
                  </div>
                </div>

                <div>
                  <span
                    className={
                      status === 'Out of stock'
                        ? `${ui.inventoryStatusPill} ${ui.inventoryStatusBad}`
                        : status === 'Low stock'
                          ? `${ui.inventoryStatusPill} ${ui.inventoryStatusWarn}`
                          : `${ui.inventoryStatusPill} ${ui.inventoryStatusOk}`
                    }
                  >
                    {status === 'Out of stock' ? 'Out of Stock' : status === 'Low stock' ? 'Low Stock' : 'In Stock'}
                  </span>
                </div>

                <div className={status === 'Out of stock' ? ui.inventoryExpiryBad : ui.inventoryExpiryText}>
                  {item.expiryDate ? formatDate(item.expiryDate) : '—'}
                </div>

                <div className={ui.inventoryActions}>
                  <button type="button" className={ui.inventoryActionBtn} title={`View ${item.name}`} onClick={() => setSelectedDetailItem(item)}>
                    <EyeLineIcon />
                  </button>
                  <button
                    type="button"
                    className={ui.inventoryActionBtn}
                    aria-label={`Edit ${item.name}`}
                    onClick={() => window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal', { detail: { item } }))}
                  >
                    <PencilIcon />
                  </button>
                  <button type="button" className={ui.inventoryActionBtn} aria-label={`Inspect ${item.name}`} onClick={() => navigate('/app/clerk/expiry')}>
                    <TrashIcon />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <StockItemDetailModal
          isOpen={Boolean(selectedDetailItem)}
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
        />


        <ListPageControls
          className={ui.inventoryPagination}
          variant="table"
          rangeFrom={inventoryPager.rangeFrom}
          rangeTo={inventoryPager.rangeTo}
          total={inventoryPager.total}
          page={inventoryPager.page}
          pageCount={inventoryPager.pageCount}
          pagerNums={inventoryPager.pagerNums}
          onPrev={inventoryPager.goPrev}
          onNext={inventoryPager.goNext}
          onSelectPage={inventoryPager.setPage}
          canPrev={inventoryPager.canPrev}
          canNext={inventoryPager.canNext}
        />
      </div>

      <div className={ui.inventoryInsightGrid}>
        {!insightDismissed ? (
        <section className={ui.inventoryAlertCard}>
            <p className={ui.inventoryAlertEyebrow}>{t('shell.cungaAi')}</p>
            <h2 className={ui.inventoryAlertTitle}>Stock guidance</h2>
            <WorkspaceAiInsight
              scope="clerk"
              fallbackText={`Review low-stock lines and raise requisitions when needed${
                filteredItems[0]?.name ? ` (e.g. ${filteredItems[0].name})` : ''
              }.`}
            >
          <div className={ui.inventoryAlertActions}>
            <button type="button" className={ui.inventoryAlertPrimary} onClick={() => navigate('/app/clerk/materials')}>
              Review Procurement
            </button>
                <button type="button" className={ui.inventoryAlertSecondary} onClick={() => setInsightDismissed(true)}>
              Dismiss Insight
            </button>
          </div>
            </WorkspaceAiInsight>
        </section>
        ) : (
          <section className={ui.inventoryAlertCard} aria-live="polite">
            <p className={ui.inventoryAlertText} style={{ margin: 0 }}>
              Insight dismissed for this session. You can still request materials from the Materials page.
            </p>
            <div className={ui.inventoryAlertActions}>
              <button type="button" className={ui.inventoryAlertPrimary} onClick={() => setInsightDismissed(false)}>
                Show insight again
              </button>
            </div>
          </section>
        )}

        <div className={ui.inventoryMetricStack}>
          <article className={`${ui.inventoryMetricCard} ${ui.inventoryMetricBlue}`}>
            <p className={ui.inventoryMetricLabel}>Stock turn rate</p>
            <p className={ui.inventoryMetricValue}>4.2x</p>
            <span className={ui.inventoryMetricMeta}>+2.4% vs last mo</span>
          </article>
          <article className={`${ui.inventoryMetricCard} ${ui.inventoryMetricGreen}`}>
            <p className={ui.inventoryMetricLabel}>Asset health score</p>
            <p className={ui.inventoryMetricValue}>A+</p>
            <span className={ui.inventoryMetricMeta}>99.8% accurate</span>
          </article>
        </div>
      </div>
    </div>
  );
}

function newMaterialReqLine() {
  return {
    id: `ln_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    description: '',
    dateValue: '',
    quantityRequested: 1,
    quantityReceived: '',
    unit: 'units',
  };
}

function requestStatusBucket(status) {
  if (status === 'rejected') return 'Rejected';
  if (['approved', 'proformaApproved', 'deliveryNoteAttached', 'closed'].includes(status)) return 'Approved';
  return 'Pending';
}

function requestStockState(requisition, stockItems) {
  const lines = Array.isArray(requisition?.lines) ? requisition.lines : [];
  if (!lines.length) return 'Check stock';
  let matched = 0;
  let fullyCovered = 0;
  let hasOut = false;
  lines.forEach((line) => {
    const text = String(line.description || '').trim().toLowerCase();
    if (!text) return;
    const item = stockItems.find((s) => String(s.name || '').trim().toLowerCase() === text);
    if (!item) return;
    matched += 1;
    const have = Number(item.quantity || 0);
    const need = Number(line.quantity || 0);
    if (have <= 0) hasOut = true;
    if (need > 0 && have >= need) fullyCovered += 1;
  });
  if (matched === 0) return 'Check stock';
  if (hasOut) return 'Out of stock';
  if (fullyCovered === matched) return 'In stock';
  return 'Partially in stock';
}

export function ClerkMaterials({ setRailSlot }) {
  const { t } = useI18n();
  const { state, createRequisition, reviewRequisition, attachDeliveryNote } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const items = useMemo(
    () => state.stockItems.filter((item) => item.ownerId === actor?.id),
    [state.stockItems, actor?.id]
  );
  const priorityMeta = [
    { id: 'low', label: 'Low', copy: 'Standard restocking, 3-5 business days.' },
    { id: 'medium', label: 'Medium', copy: 'Required for upcoming tasks, 1-2 business days.' },
    { id: 'high', label: 'High', copy: 'Production bottleneck potential, 24-hour fulfillment.' },
    { id: 'urgent', label: 'Urgent', copy: 'Critical line stoppage, immediate dispatch.' },
  ];
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [department, setDepartment] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [reqLines, setReqLines] = useState(() => [newMaterialReqLine()]);
  const [form, setForm] = useState({ priority: 'low', reason: '' });
  const [exportMonth, setExportMonth] = useState('');
  const [exportCategory, setExportCategory] = useState('all');
  const [reqFilter, setReqFilter] = useState('all');
  const [reqSearch, setReqSearch] = useState('');
  const [selectedReqForPdf, setSelectedReqForPdf] = useState(null);
  const defaultStock = items[0];
  const selectedItem = defaultStock;
  const stockPercent = Math.max(
    8,
    Math.min(
      100,
      Math.round((Number(selectedItem?.quantity || 0) / Math.max(1, Number(selectedItem?.maxThreshold || 1500))) * 100)
    )
  );
  const priorityMap = { low: 'low', medium: 'normal', high: 'high', urgent: 'critical' };
  const priorityCopy = priorityMeta.find((p) => p.id === form.priority)?.copy || '';
  const filteredMyRequisitions = useMemo(() => {
    let list = (state.requisitions || []).filter((req) => req.clerkId === actor?.id);
    if (reqFilter !== 'all') {
      list = list.filter((r) => requestStatusBucket(r.status).toLowerCase() === reqFilter.toLowerCase());
    }
    const q = reqSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.id).toLowerCase().includes(q) ||
          String(r.title || '').toLowerCase().includes(q) ||
          (r.lines || []).some((l) => String(l.description || '').toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.requestedAt || b.updatedAt || 0) - new Date(a.requestedAt || a.updatedAt || 0));
  }, [state.requisitions, actor?.id, reqFilter, reqSearch]);

  useEffect(() => {
    if (typeof setRailSlot !== 'function') return undefined;
    setRailSlot(
      <ClerkMaterialsRailExport
        t={t}
        stockItems={items}
        requisitions={state.requisitions}
        clerkId={actor?.id}
        exportMonth={exportMonth}
        setExportMonth={setExportMonth}
        exportCategory={exportCategory}
        setExportCategory={setExportCategory}
      />
    );
    return () => setRailSlot(null);
  }, [setRailSlot, t, items, state.requisitions, actor?.id, exportMonth, exportCategory]);

  function updateLine(id, patch) {
    setReqLines((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSubmitted(false);
  }

  function addLine() {
    setReqLines((rows) => [...rows, newMaterialReqLine()]);
    setSubmitted(false);
  }

  function downloadSpecificRequisitionExcel(req) {
    const header = [
      [t('app.clerk.requisitionFormTitle')],
      [t('app.clerk.requisitionFormSubtitle')],
      [''],
      ['Request ID', req.id],
      [t('app.clerk.requisitionDepartmentLabel'), req.requestingDepartment || '—'],
      [t('app.clerk.requisitionDeliveryNoteLabel'), req.deliveryNote || '—'],
      [t('app.clerk.requisitionDateLabel'), formatDateTime(req.requestedAt || req.createdAt)],
      [t('app.clerk.requisitionInternalNotesLabel'), req.clerkJustification || '—'],
      [''],
      [
        t('app.clerk.requisitionColNo'),
        t('app.clerk.requisitionColDescription'),
        t('app.clerk.requisitionColDateValue'),
        t('app.clerk.requisitionColQtyRequested'),
        t('app.clerk.requisitionColQtyReceived'),
        t('app.clerk.requisitionColUnit'),
      ],
      ...(req.lines || []).map((row, i) => [
        i + 1,
        row.description || '',
        row.dateValue || '',
        row.quantity || 0,
        0,
        row.unit || 'units',
      ]),
    ];
    downloadAoAAsXlsx(`requisition-${req.id}`, header, 'Requisition');
  }

  function removeLine(id) {
    setReqLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
    setSubmitted(false);
  }

  function downloadRequisitionPdf(req) {
    const doc = new jsPDF();
    const clerk = state.users.find(u => u.id === req.clerkId) || { fullName: 'Inventory Clerk', department: 'General Stores' };
    const supervisor = state.users.find(u => u.role === 'supervisor') || { fullName: 'Regional Supervisor' };
    
    const statusLabels = {
      submitted: 'Sent to Supervisor',
      pending: 'Sent to Supervisor',
      approved: 'Approved by Supervisor',
      sentToSupplier: 'Sent to Supplier',
      proformaReceived: 'Proforma Received',
      proformaApproved: 'Proforma Approved',
      paid: 'Payment Completed',
      deliveryNoteAttached: 'Delivery Attached',
      closed: 'Completed',
      rejected: 'Rejected'
    };
    const displayStatus = statusLabels[req.status] || req.status;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 11, 35); // #780b23
    doc.setFontSize(24);
    doc.text('e-Cunga', 20, 30);
    
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text('REQUISITION FORM', 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFont('helvetica', 'normal');
    doc.text('STOCK INVENTORY SYSTEM', 20, 36);
    
    doc.setDrawColor(120, 11, 35);
    doc.setLineWidth(1);
    doc.line(20, 45, 190, 45);
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(`Request ID: ${req.id}`, 20, 55);
    doc.text(`Date: ${new Date(req.requestedAt || req.createdAt).toLocaleString()}`, 190, 55, { align: 'right' });
    doc.text(`Department: ${clerk.department || req.requestingDepartment || 'General Stores'}`, 20, 62);
    doc.setTextColor(120, 11, 35);
    doc.text(`Status: ${displayStatus}`, 190, 62, { align: 'right' });
    
    let y = 80;
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(248, 250, 252);
    doc.rect(20, y, 170, 8, 'F');
    doc.setTextColor(30, 41, 59);
    doc.text('No.', 25, y + 5);
    doc.text('Description', 45, y + 5);
    doc.text('Qty', 150, y + 5);
    doc.text('Unit', 170, y + 5);
    
    doc.setFont('helvetica', 'normal');
    (req.lines || []).forEach((line, i) => {
      y += 8;
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, y, 170, 8);
      doc.text(String(i + 1), 25, y + 5);
      doc.text(String(line.description || ''), 45, y + 5);
      doc.text(String(line.quantity || 0), 150, y + 5);
      doc.text(String(line.unit || 'units'), 170, y + 5);
    });
    
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 11, 35);
    doc.text('Justification:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(String(req.clerkJustification || 'No justification provided.'), 20, y + 6);
    
    y += 40;
    doc.setDrawColor(30, 41, 59);
    doc.line(20, y, 80, y);
    doc.line(130, y, 190, y);
    doc.text(`Requested by: ${clerk.fullName || clerk.name || 'Clerk'}`, 20, y + 6);
    doc.text(`Reviewed by: ${supervisor.fullName || supervisor.name || 'Supervisor'}`, 130, y + 6);
    
    doc.save(`Requisition_${req.id}.pdf`);
  }

  function downloadRequisitionExcel() {
    const dept = department.trim() || '—';
    const dn = deliveryNote.trim() || '—';
    const dateStr = new Date().toLocaleString();
    const notes = form.reason.trim() || '—';
    const header = [
      [t('app.clerk.requisitionFormTitle')],
      [t('app.clerk.requisitionFormSubtitle')],
      [''],
      [t('app.clerk.requisitionDepartmentLabel'), dept],
      [t('app.clerk.requisitionDeliveryNoteLabel'), dn],
      [t('app.clerk.requisitionDateLabel'), dateStr],
      [t('app.clerk.requisitionInternalNotesLabel'), notes],
      [''],
      [
        t('app.clerk.requisitionColNo'),
        t('app.clerk.requisitionColDescription'),
        t('app.clerk.requisitionColDateValue'),
        t('app.clerk.requisitionColQtyRequested'),
        t('app.clerk.requisitionColQtyReceived'),
        t('app.clerk.requisitionColUnit'),
      ],
      ...reqLines.map((row, i) => [
        i + 1,
        row.description || '',
        row.dateValue || '',
        row.quantityRequested,
        row.quantityReceived === '' || row.quantityReceived == null ? '' : row.quantityReceived,
        row.unit || 'units',
      ]),
    ];
    downloadAoAAsXlsx(`requisition-form-${new Date().toISOString().slice(0, 10)}`, header, 'Requisition');
  }

  async function submitRequest(event) {
    event.preventDefault();
    const validLines = reqLines
      .map((row) => ({
        description: String(row.description || '').trim(),
        dateValue: String(row.dateValue || '').trim(),
        quantity: Math.max(0, Number(row.quantityRequested) || 0),
        unit: String(row.unit || 'units').trim() || 'units',
      }))
      .filter((line) => line.description && line.quantity >= 1);
    if (!validLines.length) {
      setErr(t('app.clerk.requisitionErrorLines'));
      setSubmitted(false);
      return;
    }
    const dept = department.trim() || actor?.team || actor?.location || 'General';
    const title = t('app.clerk.requisitionTitleSubmit', { department: dept });
    const linesPayload = validLines.map((line) => ({
      description: line.description,
      dateValue: line.dateValue,
      quantity: line.quantity,
      unit: line.unit,
    }));
    try {
      await createRequisition(
        {
          title,
          lines: linesPayload,
          priority: priorityMap[form.priority] || form.priority,
          location: selectedItem?.location || actor?.location || 'Warehouse-B / A14',
          requestingDepartment: department.trim(),
          deliveryNote: deliveryNote.trim(),
          clerkJustification: form.reason.trim(),
        },
        actor?.id
      );
      setReqLines([newMaterialReqLine()]);
      setDepartment('');
      setDeliveryNote('');
      setForm({ priority: 'low', reason: '' });
      setErr('');
      setSubmitted(true);
    } catch (ex) {
      setErr(ex.message);
      setSubmitted(false);
    }
  }

  return (
    <div className={ui.materialsBoard}>
      <div className={ui.materialsHeader}>
        <button type="button" className={ui.materialsBackBtn} onClick={() => navigate('/app/clerk/inventory')}>
          ← Return to Inventory
        </button>
        <h1 className={ui.materialsTitle}>{t('app.clerk.materialsTitle')}</h1>
        <p className={ui.materialsLead}>{t('app.clerk.materialsLeadRequisition')}</p>
      </div>

      {err ? <p className={ui.err}>{err}</p> : null}

      <div className={ui.materialsGrid}>
        <section className={ui.materialsFormCard}>
          <form className={ui.materialsForm} onSubmit={submitRequest}>
            <div className={ui.materialsRequisitionCard}>
              <h2 className={ui.materialsRequisitionH1}>{t('app.clerk.requisitionFormTitle')}</h2>
            <label className={ui.materialsField}>
                <span>{t('app.clerk.requisitionDepartmentField')}</span>
              <input
                className={ui.materialsInput}
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                  setSubmitted(false);
                }}
                  placeholder={t('app.clerk.requisitionDepartmentPlaceholder')}
                  autoComplete="organization"
              />
            </label>
              <label className={ui.materialsField}>
                <span>{t('app.clerk.requisitionDeliveryNoteField')} <span className={ui.optionalText}>(optional)</span></span>
                <textarea
                  className={ui.materialsTextarea}
                  rows={3}
                  value={deliveryNote}
                  onChange={(e) => {
                    setDeliveryNote(e.target.value);
                    setSubmitted(false);
                  }}
                  placeholder={t('app.clerk.requisitionDeliveryNotePlaceholder')}
                  maxLength={500}
                />
                <div className={ui.characterCount}>
                  {deliveryNote.length}/500 characters
                </div>
              </label>

              <div className={ui.materialsRequisitionTableWrap}>
                <table className={ui.materialsRequisitionTable}>
                  <thead>
                    <tr>
                      <th scope="col">{t('app.clerk.requisitionColNo')}</th>
                      <th scope="col">{t('app.clerk.requisitionColDescription')}</th>
                      <th scope="col">{t('app.clerk.requisitionColDateValue')}</th>
                      <th scope="col">{t('app.clerk.requisitionColQtyRequested')}</th>
                      <th scope="col">{t('app.clerk.requisitionColQtyReceived')}</th>
                      <th scope="col">{t('app.clerk.requisitionColUnit')}</th>
                      <th scope="col" className={ui.materialsRequisitionThActions}>
                        <span className={ui.visuallyHidden}>{t('app.clerk.requisitionRowActions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reqLines.map((row, index) => (
                      <tr key={row.id}>
                        <td className={ui.materialsRequisitionTdNum}>{index + 1}</td>
                        <td>
                          <input
                            className={ui.materialsRequisitionInput}
                            list="clerk-material-catalog"
                            value={row.description}
                            onChange={(e) => updateLine(row.id, { description: e.target.value })}
                            placeholder={t('app.clerk.requisitionDescriptionPlaceholder')}
                          />
                        </td>
                        <td>
                          <input
                            className={ui.materialsRequisitionInputDate}
                            type="date"
                            value={row.dateValue}
                            onChange={(e) => updateLine(row.id, { dateValue: e.target.value })}
                            aria-label={t('app.clerk.requisitionColDateValue')}
                          />
                        </td>
                        <td>
                          <input
                            className={ui.materialsRequisitionInputNum}
                            type="number"
                            min={1}
                            value={row.quantityRequested}
                            onChange={(e) => updateLine(row.id, { quantityRequested: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className={ui.materialsRequisitionInputNum}
                            type="number"
                            min={0}
                            value={row.quantityReceived}
                            onChange={(e) => updateLine(row.id, { quantityReceived: e.target.value })}
                            placeholder="—"
                            aria-label={t('app.clerk.requisitionColQtyReceived')}
                          />
                        </td>
                        <td>
                          <input
                            className={ui.materialsRequisitionInputUnit}
                            value={row.unit}
                            onChange={(e) => updateLine(row.id, { unit: e.target.value })}
                          />
                        </td>
                        <td className={ui.materialsRequisitionTdActions}>
                          <button
                            type="button"
                            className={ui.materialsRequisitionRemoveBtn}
                            onClick={() => removeLine(row.id)}
                            disabled={reqLines.length <= 1}
                          >
                            {t('app.clerk.requisitionRemoveRow')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <datalist id="clerk-material-catalog">
                {items.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
              <button type="button" className={ui.materialsRequisitionAddBtn} onClick={addLine}>
                {t('app.clerk.requisitionAddRow')}
              </button>
            </div>

            <div className={ui.portalProfileFormStack}>
              <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                  <span>{t('app.clerk.requisitionPriorityLabel')}</span>
                <select
                  className={ui.materialsInput}
                  value={form.priority}
                  onChange={(event) => {
                    setForm({ ...form, priority: event.target.value });
                    setSubmitted(false);
                  }}
                >
                  {priorityMeta.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
                <div className={ui.materialsPriorityHint} aria-live="polite">
                  {priorityCopy}
                </div>
            </div>

              <div className={ui.portalProfileRowFull}>
            <label className={ui.materialsField}>
                  <span>{t('app.clerk.requisitionJustificationLabel')}</span>
              <textarea
                className={ui.materialsTextarea}
                    rows={4}
                    placeholder={t('app.clerk.requisitionJustificationPlaceholder')}
                value={form.reason}
                onChange={(event) => {
                  setForm({ ...form, reason: event.target.value });
                  setSubmitted(false);
                }}
              />
            </label>
              </div>
            </div>

            <div className={ui.materialsFormActions}>
            <button type="submit" className={ui.materialsSubmitBtn}>
                {t('app.clerk.requisitionSubmit')}
            </button>
              <button type="button" className={ui.materialsExcelBtn} onClick={downloadRequisitionExcel}>
                {t('app.clerk.requisitionDownloadExcel')}
              </button>
            </div>

            <p className={ui.materialsFootnote}>
              {submitted ? t('app.clerk.requisitionSuccessFootnote') : t('app.clerk.requisitionDefaultFootnote')}
            </p>
          </form>
        </section>

        <section className={ui.materialsGuideCardWide}>
          <p className={ui.materialsGuideEyebrow}>Request status</p>
          <div className={ui.materialsRequestStatusHead}>
            <h2 className={ui.materialsRequestStatusTitle}>Approved, Pending, and Rejected requests</h2>
            <span className={ui.materialsRequestStatusMeta}>
              {filteredMyRequisitions.length} {filteredMyRequisitions.length === 1 ? 'request' : 'requests'}
            </span>
          </div>

          <div className={ui.materialsTableToolbar}>
            <div className={ui.materialsFilterGroup}>
              {['all', 'pending', 'approved', 'rejected'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={reqFilter === f ? `${ui.materialsFilterBtn} ${ui.materialsFilterBtnActive}` : ui.materialsFilterBtn}
                  onClick={() => setReqFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <input
              type="search"
              className={ui.materialsTableSearch}
              placeholder="Search request ID or items..."
              value={reqSearch}
              onChange={(e) => setReqSearch(e.target.value)}
            />
          </div>
          <div className={ui.materialsRequestStatusTableWrap}>
            <table className={ui.materialsRequestStatusTable}>
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Status</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Approved</th>
                  <th scope="col">Proforma</th>
                  <th scope="col">Final Invoice</th>
                  <th scope="col">Delivery note</th>
                </tr>
              </thead>
              <tbody>
                {filteredMyRequisitions.length ? (
                  filteredMyRequisitions.map((req) => {
                    const statusBucket = requestStatusBucket(req.status);
                    const isApproved = ['approved', 'proformaApproved', 'paid', 'creditPurchase', 'creditAndPaid', 'deliveryNoteAttached', 'closed'].includes(req.status);
                    const stockState = requestStockState(req, items);
                    const qtyRequested = (req.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0);
                    const proforma = (state.invoices || []).find((inv) => inv.requisitionId === req.id && inv.type === 'proforma');
                    const finalInvoice = (state.invoices || []).find((inv) => inv.requisitionId === req.id && inv.type === 'final');
                    const requestedAt = req.requestedAt || req.createdAt;
                    const reviewedAt = isApproved ? (req.updatedAt || req.requestedAt || req.createdAt) : null;
                    return (
                      <tr key={req.id}>
                        <td>
                          <button
                            type="button"
                            className={ui.materialsLinkBtn}
                            onClick={() => setSelectedReqForPdf(req)}
                            title="View Requisition PDF"
                          >
                            {req.id}
                          </button>
                        </td>
                        <td>{qtyRequested || '—'}</td>
                        <td>
                          <span
                            className={
                              statusBucket === 'Approved'
                                ? `${ui.badge} ${ui.badgeOk}`
                                : statusBucket === 'Rejected'
                                  ? `${ui.badge} ${ui.badgeBad}`
                                  : `${ui.badge} ${ui.badgeWarn}`
                            }
                          >
                            {statusBucket}
                          </span>
                        </td>
                        <td>{stockState}</td>
                        <td>{requestedAt ? (() => { const d = new Date(requestedAt); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; })() : '—'}</td>
                        <td>{reviewedAt ? (() => { const d = new Date(reviewedAt); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; })() : '—'}</td>
                        <td className={ui.materialsProformaCell}>
                          {proforma ? (
                            <div className={ui.materialsActionRow}>
                              <a
                                href={`/uploads/${proforma.attachmentUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={ui.materialsViewLink}
                              >
                                View
                              </a>
                              {req.status === 'proformaReceived' && (
                                <div className={ui.materialsMiniActions}>
                                  <button
                                    type="button"
                                    className={ui.materialsMiniActionBtnOk}
                                    onClick={() => reviewRequisition(req.id, 'approved', 'Clerk approved proforma')}
                                    title="Approve Proforma"
                                  >
                                    <CheckIcon size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className={ui.materialsMiniActionBtnBad}
                                    onClick={() => reviewRequisition(req.id, 'rejected', 'Clerk declined proforma')}
                                    title="Decline Proforma"
                                  >
                                    <CloseIcon size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {finalInvoice ? (
                            <a
                              href={`/uploads/${finalInvoice.attachmentUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={ui.materialsViewLink}
                            >
                              View
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {req.deliveryNoteUrl ? (
                            <a
                              href={`/uploads/${req.deliveryNoteUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={ui.materialsViewLink}
                            >
                              View
                            </a>
                          ) : (
                            <button
                              type="button"
                              className={ui.materialsUploadBtn}
                              onClick={() => {
                                const url = prompt('Enter delivery note URL (mock):');
                                if (url) attachDeliveryNote(req.id, url);
                              }}
                            >
                              Upload
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className={ui.materialsRequestStatusEmpty}>
                      No requests yet. Submit a requisition above to start tracking status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className={ui.materialsRequestStatusNote}>{t('app.clerk.requisitionFormSubtitle')}</p>
        </section>

        <RequisitionPdfModal
          isOpen={!!selectedReqForPdf}
          req={selectedReqForPdf}
          onClose={() => setSelectedReqForPdf(null)}
          onDownload={downloadRequisitionPdf}
          users={state.users}
        />

        <aside className={ui.materialsRail}>
          <section className={ui.materialsStockCard}>
            <p className={ui.materialsSideEyebrow}>Current available stock</p>
            <div className={ui.materialsStockValue}>
              <strong>{Number(selectedItem?.quantity || 1248).toLocaleString()}</strong>
              <span>Units</span>
            </div>
            <div className={ui.materialsStockTrack}>
              <div className={ui.materialsStockFill} style={{ width: `${stockPercent}%` }} />
            </div>
            <div className={ui.materialsStatList}>
              <div className={ui.materialsStatRow}>
                <span>Last Replenished</span>
                <strong>Oct 24, 2023</strong>
              </div>
              <div className={ui.materialsStatRow}>
                <span>Reorder Point</span>
                <strong className={ui.materialsStatWarn}>{selectedItem?.minThreshold || 250} Units</strong>
              </div>
              <div className={ui.materialsStatRow}>
                <span>Storage Location</span>
                <strong>{selectedItem?.location || actor?.location || 'Warehouse-B / A14'}</strong>
              </div>
            </div>
          </section>

          <section className={ui.materialsPromoCard}>
            <div>
              <strong>The Intelligent Ledger</strong>
              <span>Precision Inventory Management System</span>
            </div>
          </section>
        </aside>

        <section className={ui.materialsGuideCardWide}>
            <p className={ui.materialsGuideEyebrow}>Priority guidelines</p>
            <div className={ui.materialsGuideList}>
              {priorityMeta.map((entry) => (
                <article
                  key={entry.id}
                  className={
                    entry.id === 'low'
                      ? `${ui.materialsGuideItem} ${ui.materialsGuideLow}`
                      : entry.id === 'medium'
                        ? `${ui.materialsGuideItem} ${ui.materialsGuideMedium}`
                        : entry.id === 'high'
                          ? `${ui.materialsGuideItem} ${ui.materialsGuideHigh}`
                          : `${ui.materialsGuideItem} ${ui.materialsGuideUrgent}`
                  }
                >
                  <strong>{entry.label}</strong>
                  <span>{entry.copy}</span>
                </article>
              ))}
            </div>
          </section>

      </div>
    </div>
  );
}

export function ClerkExpiry() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const items = state.stockItems
    .filter((item) => item.ownerId === actor?.id && item.expiryDate)
    .map((item) => ({ ...item, daysLeft: daysUntil(item.expiryDate) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const [filter, setFilter] = useState('all');
  const [salvageMarked, setSalvageMarked] = useState([]);
  const [expCat, setExpCat] = useState('all');
  const [expQ, setExpQ] = useState('');

  const criticalItems = items.filter((item) => item.daysLeft <= 2);
  const upcomingItems = items.filter((item) => item.daysLeft > 2 && item.daysLeft <= 30);
  const stableItems = items.filter((item) => item.daysLeft > 30);
  const filteredItems =
    filter === 'critical' ? criticalItems : filter === 'upcoming' ? items.filter((item) => item.daysLeft <= 30) : items;
  const expCategories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const qExp = expQ.trim().toLowerCase();
  const queueItems = filteredItems.filter((item) => {
    if (expCat !== 'all' && item.category !== expCat) return false;
    if (qExp && !`${item.name} ${item.sku || ''}`.toLowerCase().includes(qExp)) return false;
    return true;
  });
  const expiryQueuePager = usePagedList(queueItems, { resetKey: `${filter}|${expCat}|${expQ}` });
  const roadmapCritical = criticalItems[0] || items[0];
  const roadmapNext = upcomingItems[0] || items.find((item) => item.daysLeft > 2) || items[1];
  const roadmapFuture = stableItems[0] || items[items.length - 1];
  const assistantFocus = criticalItems[0] || upcomingItems[0] || items[0];
  const wasteDrop = items.length ? Math.max(8, Math.min(21, Math.round((stableItems.length / items.length) * 18))) : 14;

  function exportLog() {
    const title = 'INTELLIGENT LEDGER - INVENTORY EXPIRY LOG';
    const metadata = [`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`];
    const filterDesc = [`Active Filters: Category: ${expCat}, Search: ${expQ || 'All'}, View: ${filter}`];
    
    const headers = [
      'Inventory Item', 
      'SKU Code', 
      'Classification', 
      'Expiry Status', 
      'Days Remaining', 
      'Expiration Date', 
      'Stored Qty', 
      'Unit of Measure',
      'Storage Location'
    ];
    
    const rows = items.map((item) => {
      let status = 'Stable';
      if (item.daysLeft <= 2) status = 'CRITICAL';
      else if (item.daysLeft <= 14) status = 'Warning';
      else if (item.daysLeft <= 30) status = 'Upcoming';
      
      return [
        item.name,
        item.sku || '—',
        item.category || '—',
        status,
        item.daysLeft,
        shortMonthDay(item.expiryDate),
        item.quantity,
        item.unit || 'Units',
        item.location || '—',
      ];
    });

    const aoa = [
      [title],
      metadata,
      filterDesc,
      [''], // spacer
      headers,
      ...rows
    ];

    downloadAoAAsXlsx('clerk-expiry-report', aoa, 'Expiry Status Log');
  }

  function toggleSalvage(itemId) {
    setSalvageMarked((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  }

  return (
    <div className={ui.expiryBoard}>
      <header className={ui.expiryHeader}>
        <div className={ui.expiryHeaderTop}>
          <div className={ui.expiryTitleBlock}>
          <h1 className={ui.expiryTitle}>{t('app.clerk.expiryTitle')}</h1>
          <p className={ui.expiryLead}>Prioritized oversight of assets nearing end-of-life status.</p>
        </div>
          <button type="button" className={ui.expiryExportBtn} onClick={exportLog}>
            {t('app.clerk.expiryDownloadExcel')}
          </button>
        </div>
        <div className={ui.expiryToolbar} role="search">
          <div className={ui.expiryFilterGroup}>
            <button
              type="button"
              className={filter === 'all' ? `${ui.expiryFilterBtn} ${ui.expiryFilterBtnActive}` : ui.expiryFilterBtn}
              onClick={() => setFilter('all')}
            >
              All Items
            </button>
            <button
              type="button"
              className={filter === 'critical' ? `${ui.expiryFilterBtn} ${ui.expiryFilterBtnActive}` : ui.expiryFilterBtn}
              onClick={() => setFilter('critical')}
            >
              Filter by Status
            </button>
            <button
              type="button"
              className={filter === 'upcoming' ? `${ui.expiryFilterBtn} ${ui.expiryFilterBtnActive}` : ui.expiryFilterBtn}
              onClick={() => setFilter('upcoming')}
            >
              30 Days
            </button>
          </div>
          <div className={ui.expiryToolbarField}>
            <select
              className={ui.portalFilterSelect}
              value={expCat}
              onChange={(e) => setExpCat(e.target.value)}
              aria-label={t('app.clerk.expiryFilterCategoryAria')}
            >
            <option value="all">All categories</option>
            {expCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          </div>
          <div className={`${ui.expiryToolbarField} ${ui.expiryToolbarSearch}`}>
          <input
            className={ui.portalFilterSearch}
              placeholder={t('app.clerk.expirySearchPlaceholder')}
            value={expQ}
            onChange={(e) => setExpQ(e.target.value)}
              aria-label={t('app.clerk.expirySearchAria')}
            />
          </div>
          <ClearFiltersIconButton
            title={t('common.clearFiltersAria')}
          onClick={() => {
            setExpCat('all');
            setExpQ('');
          }}
          />
      </div>
      </header>

      <div className={ui.expirySummaryRow}>
        <article className={`${ui.expirySummaryCard} ${ui.expirySummaryCritical}`}>
          <p className={ui.expirySummaryLabel}>Critical alert</p>
          <p className={ui.expirySummaryValue}>{criticalItems.length} Items</p>
          <span className={ui.expirySummaryMeta}>Expiring within the next 48 hours</span>
        </article>

        <article className={`${ui.expirySummaryCard} ${ui.expirySummaryUpcoming}`}>
          <p className={ui.expirySummaryLabel}>Upcoming expiry</p>
          <p className={ui.expirySummaryValue}>{items.filter((item) => item.daysLeft <= 30).length} Items</p>
          <span className={ui.expirySummaryMeta}>Nearing threshold (30 days left)</span>
        </article>

        <article className={ui.expirySummaryCard}>
          <p className={ui.expirySummaryLabel}>Total monitored</p>
          <p className={ui.expirySummaryValue}>{items.length} SKUs</p>
          <span className={ui.expirySummaryMeta}>Active items with shelf-life tracking</span>
        </article>

        <article className={ui.expiryAssistantCard}>
          <p className={ui.expirySummaryLabel}>Curation assistant</p>
          <p className={ui.expiryAssistantText}>
            AI suggests marking <strong>{assistantFocus?.name || 'critical reagents'}</strong> for salvage based on
            historical low demand periods.
          </p>
          <button type="button" className={ui.expiryAssistantLink} onClick={() => navigate('/app/clerk/documents')}>
            Review Suggestions →
          </button>
        </article>
      </div>

      <div className={ui.expiryContentGrid}>
        <section className={ui.expiryQueueSection}>
          <div className={ui.expirySectionHead}>
            <h2 className={ui.expirySectionTitle}>Urgent Queue</h2>
            <div className={ui.expiryLegend}>
              <span>
                <i className={ui.expiryLegendCritical} />
                Critical
              </span>
              <span>
                <i className={ui.expiryLegendWarn} />
                Warning
              </span>
            </div>
          </div>

          <div className={ui.expiryTableWrap}>
            {queueItems.length ? (
              <table className={ui.expiryTable}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th>Status</th>
                    <th>Produced</th>
                    <th>Expiry</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expiryQueuePager.pageSlice.map((item) => {
                    const critical = item.daysLeft <= 2;
                    const progress = Math.max(
                      10,
                      Math.min(100, Math.round((Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 100))) * 100))
                    );
                    return (
                      <tr key={item.id} className={critical ? ui.expiryTableRowCritical : ui.expiryTableRow}>
                        <td className={ui.expiryTableName}>{item.name}</td>
                        <td className={ui.expiryTableSku}>{item.sku || '—'}</td>
                        <td>
                          <span className={critical ? `${ui.expiryTag} ${ui.expiryTagCritical}` : `${ui.expiryTag} ${ui.expiryTagUpcoming}`}>
                            {critical ? '< 48 hrs' : `${item.daysLeft}d`}
                          </span>
                        </td>
                        <td className={ui.expiryTableDate}>{shortMonthDay(new Date(Date.now() - Math.max(30, item.daysLeft * 8) * 86400000))}</td>
                        <td className={ui.expiryTableDateExpiry}>{shortMonthDay(item.expiryDate)}</td>
                        <td className={ui.expiryTableStockCell}>
                          <div className={ui.expiryTableStockBar}>
                            <div
                              className={critical ? `${ui.expiryTableStockFill} ${ui.expiryTableStockFillCritical}` : ui.expiryTableStockFill}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className={ui.expiryTableStockPct}>{progress}%</span>
                        </td>
                        <td className={ui.expiryTableActions}>
                          <button type="button" className={ui.expiryPrimaryBtn} onClick={() => navigate('/app/clerk/usage')}>
                            Record Usage
                          </button>
                          <button type="button" className={ui.expirySecondaryBtn} onClick={() => toggleSalvage(item.id)}>
                            {salvageMarked.includes(item.id) ? <><CheckIcon size={14} /> Salvage</> : 'Mark Salvage'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className={ui.empty} style={{ padding: '1.5rem', textAlign: 'center' }}>No expiring inventory items match this filter.</p>
            )}
          </div>
          <ListPageControls
            variant="feed"
            rangeFrom={expiryQueuePager.rangeFrom}
            rangeTo={expiryQueuePager.rangeTo}
            total={expiryQueuePager.total}
            page={expiryQueuePager.page}
            pageCount={expiryQueuePager.pageCount}
            pagerNums={expiryQueuePager.pagerNums}
            onPrev={expiryQueuePager.goPrev}
            onNext={expiryQueuePager.goNext}
            onSelectPage={expiryQueuePager.setPage}
            canPrev={expiryQueuePager.canPrev}
            canNext={expiryQueuePager.canNext}
          />
        </section>

        <aside className={ui.expiryRail}>
          <section className={ui.expiryRoadmapCard}>
            <div className={ui.expirySectionHead}>
              <h2 className={ui.expirySectionTitle}>Expiry Roadmap</h2>
            </div>
            {/* Simple bar chart for days-left overview */}
            {(() => {
              const chartData = [
                { label: 'Critical', days: roadmapCritical?.daysLeft ?? 1, color: '#d14343', cap: 2 },
                { label: 'Upcoming', days: roadmapNext?.daysLeft ?? 14, color: 'var(--ec-primary-light)', cap: 30 },
                { label: 'Stable', days: roadmapFuture?.daysLeft ?? 60, color: '#c8d8ea', cap: 90 },
              ];
              const maxDays = Math.max(...chartData.map((d) => Math.min(d.days, d.cap)), 1);
              return (
                <div className={ui.expiryRoadmapChart}>
                  {chartData.map((bar) => {
                    const pct = Math.round((Math.min(bar.days, bar.cap) / maxDays) * 100);
                    return (
                      <div key={bar.label} className={ui.expiryRoadmapChartRow}>
                        <span className={ui.expiryRoadmapChartLabel}>{bar.label}</span>
                        <div className={ui.expiryRoadmapChartTrack}>
                          <div
                            className={ui.expiryRoadmapChartFill}
                            style={{ width: `${pct}%`, background: bar.color }}
                          />
                        </div>
                        <span className={ui.expiryRoadmapChartVal}>
                          {bar.days != null ? `${bar.days}d` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div className={ui.expiryTimeline}>
              <div className={ui.expiryTimelineItem}>
                <span className={`${ui.expiryTimelineDot} ${ui.expiryTimelineDotCritical}`} />
                <div>
                  <p className={ui.expiryTimelineLabel}>Critical (48H)</p>
                  <strong>{shortMonthDay(roadmapCritical?.expiryDate)}</strong>
                  <span>{roadmapCritical?.name || 'Critical stock batch'} requires immediate disposal protocol.</span>
                </div>
              </div>
              <div className={ui.expiryTimelineItem}>
                <span className={`${ui.expiryTimelineDot} ${ui.expiryTimelineDotUpcoming}`} />
                <div>
                  <p className={ui.expiryTimelineLabel}>Next Week</p>
                  <strong>{shortMonthDay(roadmapNext?.expiryDate)}</strong>
                  <span>Cluster of medical supplies nearing shelf-life limit. Total volume: {upcomingItems.length || 1} units.</span>
                </div>
              </div>
              <div className={ui.expiryTimelineItem}>
                <span className={ui.expiryTimelineDot} />
                <div>
                  <p className={ui.expiryTimelineLabel}>Future Threshold</p>
                  <strong>{shortMonthDay(roadmapFuture?.expiryDate)}</strong>
                  <span>Inventory levels remain stable for the next replenishment cycle.</span>
                </div>
              </div>
            </div>
          </section>

          <section className={ui.expiryEfficiencyCard}>
            <p className={ui.expiryEfficiencyTitle}>Efficiency Report</p>
            <div className={ui.expiryKpiGrid}>
              <div className={ui.expiryKpiItem}>
                <span className={ui.expiryKpiVal}>+{wasteDrop}%</span>
                <span className={ui.expiryKpiLabel}>Waste reduction</span>
              </div>
              <div className={ui.expiryKpiItem}>
                <span className={ui.expiryKpiVal}>{items.length}</span>
                <span className={ui.expiryKpiLabel}>Total tracked</span>
              </div>
              <div className={ui.expiryKpiItem}>
                <span className={`${ui.expiryKpiVal} ${ui.expiryKpiValCritical}`}>{criticalItems.length}</span>
                <span className={ui.expiryKpiLabel}>Critical</span>
              </div>
              <div className={ui.expiryKpiItem}>
                <span className={`${ui.expiryKpiVal} ${ui.expiryKpiValWarn}`}>{upcomingItems.length}</span>
                <span className={ui.expiryKpiLabel}>Upcoming</span>
              </div>
            </div>
            <div className={ui.expiryHealthBar}>
              <p className={ui.expiryHealthLabel}>Stock health</p>
              <div className={ui.expiryHealthTrack}>
                <div
                  className={ui.expiryHealthFill}
                  style={{ width: `${items.length ? Math.round((stableItems.length / items.length) * 100) : 0}%` }}
                />
              </div>
              <span className={ui.expiryHealthPct}>
                {items.length ? Math.round((stableItems.length / items.length) * 100) : 0}% stable
              </span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ClerkAlerts() {
  const { t } = useI18n();
  const chartGradId = useId().replace(/:/g, '');
  const navigate = useNavigate();
  const { state } = usePortalData();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const [range, setRange] = useState('30');
  const [granularity, setGranularity] = useState('day');
  const [analyticsCategory, setAnalyticsCategory] = useState('all');
  const [analyticsSubcategory, setAnalyticsSubcategory] = useState('all');
  const [anomTone, setAnomTone] = useState('all');
  const [consumedQ, setConsumedQ] = useState('');

  const bounds = useMemo(() => getClerkRangeBounds(range), [range]);
  const consumptionsMine = useMemo(
    () => state.consumptions.filter((entry) => entry.clerkId === actor?.id && !isBillConsumption(entry)),
    [state.consumptions, actor?.id]
  );
  const items = useMemo(
    () => state.stockItems.filter((item) => item.ownerId === actor?.id),
    [state.stockItems, actor?.id]
  );
  const itemById = useMemo(() => Object.fromEntries(state.stockItems.map((i) => [i.id, i])), [state.stockItems]);
  const analyticsCategories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );
  const analyticsSubcategories = useMemo(() => {
    if (analyticsCategory === 'all') return [];
    const subs = items
      .filter((i) => i.category === analyticsCategory)
      .map((i) => String(i.subcategory || '').trim())
      .filter(Boolean);
    return [...new Set(subs)].sort();
  }, [items, analyticsCategory]);

  useEffect(() => {
    setAnalyticsSubcategory('all');
  }, [analyticsCategory]);

  const consumptionsScoped = useMemo(() => {
    return consumptionsMine.filter((c) => {
      if (!isoInRange(c.createdAt, bounds.start, bounds.end)) return false;
      const item = itemById[c.itemId];
      if (analyticsCategory !== 'all' && item?.category !== analyticsCategory) return false;
      if (analyticsSubcategory !== 'all') {
        const sub = String(item?.subcategory || '').trim();
        if (sub !== analyticsSubcategory) return false;
      }
      return true;
    });
  }, [consumptionsMine, bounds, analyticsCategory, analyticsSubcategory, itemById]);
  const itemsScoped = useMemo(() => {
    let list = analyticsCategory === 'all' ? items : items.filter((i) => i.category === analyticsCategory);
    if (analyticsSubcategory !== 'all') {
      list = list.filter((i) => String(i.subcategory || '').trim() === analyticsSubcategory);
    }
    return list;
  }, [items, analyticsCategory, analyticsSubcategory]);

  const usageByItem = usageRows(consumptionsScoped);
  const totalUsage = consumptionsScoped.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const trendPoints = useMemo(() => {
    const b = Math.max(
      12,
      Math.min(92, Math.round(Math.sqrt(totalUsage + 1) * (range === '7' ? 5.2 : range === '90' ? 4.4 : 4.8)))
    );
    const g = granularity === 'day' ? 1 : 1.06;
    return [0.88, 1.05, 0.96, 1.1].map((f, i) => Math.min(95, Math.max(14, Math.round(f * b * g * 0.22 + i * 5))));
  }, [totalUsage, range, granularity]);
  const anomalyRows = [
    { id: 'an_1', time: 'Oct 24, 23:14', code: 'IND-ADH-092', location: 'Warehouse A, Bin 12', delta: '-240L', status: 'Investigating', tone: 'warn' },
    { id: 'an_2', time: 'Oct 24, 18:42', code: 'ST-ROD-G22', location: 'Zone 4 Loading', delta: '+150U', status: 'Resolved', tone: 'ok' },
    { id: 'an_3', time: 'Oct 24, 14:10', code: 'CON-MIX-HP', location: 'Mixing Bay 1', delta: '-1.2k U', status: 'Flagged', tone: 'bad' },
  ];
  const filteredAnomalies = anomalyRows.filter((row) => {
    if (anomTone !== 'all' && row.tone !== anomTone) return false;
    return true;
  });
  const anomalyPager = usePagedList(filteredAnomalies, { resetKey: String(anomTone) });
  const qCons = consumedQ.trim().toLowerCase();
  const consumedListFull = useMemo(
    () => (qCons ? usageByItem.filter(([name]) => name.toLowerCase().includes(qCons)) : usageByItem),
    [qCons, usageByItem]
  );
  const itemPieSlices = useMemo(() => {
    const rows = consumedListFull.slice(0, 5);
    const denom = totalUsage || rows.reduce((s, [, q]) => s + Number(q || 0), 0) || 1;
    return rows.map(([name, value], i) => ({
      name,
      value: Number(value) || 0,
      pct: Math.round(((Number(value) || 0) / denom) * 100),
      color: ANALYTICS_SLICE_COLORS[i % ANALYTICS_SLICE_COLORS.length],
    }));
  }, [consumedListFull, totalUsage]);

  const categoryPieSlices = useMemo(() => {
    const m = new Map();
    for (const c of consumptionsScoped) {
      const cat = itemById[c.itemId]?.category || 'Other';
      m.set(cat, (m.get(cat) || 0) + Number(c.quantity || 0));
    }
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!arr.length) return [];
    const tot = arr.reduce((s, [, v]) => s + v, 0) || 1;
    return arr.map(([name, value], i) => ({
      name,
      value,
      pct: Math.round((value / tot) * 100),
      color: ANALYTICS_SLICE_COLORS[i % ANALYTICS_SLICE_COLORS.length],
    }));
  }, [consumptionsScoped, itemById]);

  let anBad = 0;
  let anWarn = 0;
  let anOk = 0;
  for (const r of filteredAnomalies) {
    if (r.tone === 'bad') anBad += 1;
    else if (r.tone === 'ok') anOk += 1;
    else anWarn += 1;
  }
  const anTotal = anBad + anWarn + anOk || 1;
  const anomalySlices = [
    { name: 'Critical', value: anBad, pct: Math.round((anBad / anTotal) * 100), color: '#dc2626' },
    { name: 'Review', value: anWarn, pct: Math.round((anWarn / anTotal) * 100), color: '#ca8a04' },
    { name: 'Resolved', value: anOk, pct: Math.round((anOk / anTotal) * 100), color: '#16a34a' },
  ];

  const topShareSlices = useMemo(() => {
    const first = usageByItem[0];
    if (!first || !totalUsage) return [];
    const top = Number(first[1]) || 0;
    const rest = Math.max(0, totalUsage - top);
    return [
      {
        name: first[0],
        value: top,
        pct: Math.round((top / totalUsage) * 100),
        color: ANALYTICS_SLICE_COLORS[0],
      },
      {
        name: 'Other',
        value: rest,
        pct: Math.round((rest / totalUsage) * 100),
        color: 'rgb(148 163 184 / 0.95)',
      },
    ];
  }, [usageByItem, totalUsage]);

  const topItem = usageByItem[0]?.[0] || itemsScoped[0]?.name || '—';
  const totalWaste = `${Math.max(0, Math.min(12.5, (itemsScoped.filter((item) => item.expiryDate).length / Math.max(itemsScoped.length, 1)) * 14)).toFixed(1)}%`;
  const turnRate = `${Math.max(0, Math.min(24, totalUsage / Math.max(itemsScoped.length, 1))).toFixed(1)}x`;
  const chartLabels = granularity === 'day' ? ['D1', 'D2', 'D3', 'D4'] : ['W1', 'W2', 'W3', 'W4'];
  const maxTrend = Math.max(...trendPoints, 1);
  const trendPct = trendPoints.map((p) => Math.round((p / maxTrend) * 100));
  const tx = [6, 38, 62, 94];
  const baseY = 40;
  const ty = trendPoints.map((p) => baseY - (p / maxTrend) * 28);
  const trendLineD = tx.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ty[i]}`).join(' ');
  const trendAreaD = `${trendLineD} L ${tx[3]} ${baseY} L ${tx[0]} ${baseY} Z`;

  function downloadAnalyticsExcel() {
    const catLabel = analyticsCategory === 'all' ? t('app.clerk.analyticsAllCategories') : analyticsCategory;
    const subLabel =
      analyticsSubcategory === 'all' ? t('app.clerk.analyticsSubcategoryAll') : analyticsSubcategory;
    const periodFrom = formatDate(new Date(bounds.start).toISOString());
    const periodTo = formatDate(new Date(bounds.end).toISOString());
    const sorted = [...consumptionsScoped].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const aoa = [
      [t('app.clerk.analyticsTitle')],
      [''],
      [t('app.clerk.analyticsExportRange'), `${range} ${t('app.clerk.analyticsExportDaysSuffix')}`],
      [t('app.clerk.analyticsExportGranularity'), granularity],
      [t('app.clerk.analyticsFilterCategoryAria'), catLabel],
      [t('app.clerk.analyticsSubcategoryLabel'), subLabel],
      [t('app.clerk.analyticsExportPeriod'), `${periodFrom} – ${periodTo}`],
      [''],
      [t('app.clerk.analyticsExportSummaryUnits'), totalUsage],
      [''],
      [t('app.clerk.analyticsExportByItem')],
      [t('app.clerk.billingColItem'), t('app.clerk.analyticsExportQty')],
      ...usageByItem.map(([name, qty]) => [name, qty]),
      [''],
      [t('app.clerk.analyticsExportDetail')],
      [
        t('app.clerk.analyticsExportColDate'),
        t('app.clerk.billingColItem'),
        t('app.clerk.analyticsFilterCategoryAria'),
        t('app.clerk.analyticsSubcategoryLabel'),
        t('app.clerk.analyticsExportQty'),
        t('app.clerk.requisitionColUnit'),
        t('app.clerk.analyticsExportPurpose'),
      ],
      ...sorted.map((c) => {
        const it = itemById[c.itemId];
        return [
          formatDate(c.createdAt),
          c.itemName || '—',
          it?.category || '—',
          String(it?.subcategory || '').trim() || '—',
          c.quantity,
          c.unit || it?.unit || '—',
          String(c.purpose || '').slice(0, 500),
        ];
      }),
    ];
    downloadAoAAsXlsx(`usage-analytics-${range}d-${new Date().toISOString().slice(0, 10)}`, aoa, 'Analytics');
  }

  return (
    <div className={ui.analyticsBoard}>
      <div className={ui.analyticsHeader}>
        <div>
          <h1 className={ui.analyticsTitle}>{t('app.clerk.analyticsTitle')}</h1>
          <div className={ui.analyticsKpiStrip} role="group" aria-label="Usage summary">
            <span className={ui.analyticsKpiChip}>
              <strong>{totalUsage.toLocaleString()}</strong>
              <span className={ui.analyticsKpiChipLabel}>units</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{itemsScoped.length}</strong>
              <span className={ui.analyticsKpiChipLabel}>SKUs</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{consumptionsScoped.length}</strong>
              <span className={ui.analyticsKpiChipLabel}>events</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{totalWaste}</strong>
              <span className={ui.analyticsKpiChipLabel}>waste</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{turnRate}</strong>
              <span className={ui.analyticsKpiChipLabel}>turn</span>
            </span>
        </div>
        </div>
        <div className={ui.analyticsTimeToolbar} role="group" aria-label={t('app.clerk.analyticsTimeRangeAria')}>
            <button
              type="button"
              className={granularity === 'day' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
              onClick={() => setGranularity('day')}
            >
            {t('app.clerk.analyticsGranularityDay')}
            </button>
            <button
              type="button"
              className={granularity === 'week' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
              onClick={() => setGranularity('week')}
            >
            {t('app.clerk.analyticsGranularityWeek')}
            </button>
          <button
            type="button"
            className={range === '7' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
            onClick={() => setRange('7')}
          >
            {t('app.clerk.analyticsRange7')}
          </button>
          <button
            type="button"
            className={range === '30' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
            onClick={() => setRange('30')}
          >
            {t('app.clerk.analyticsRange30')}
          </button>
          <button
            type="button"
            className={range === '90' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
            onClick={() => setRange('90')}
          >
            {t('app.clerk.analyticsRange90')}
          </button>
        </div>
      </div>

      <div className={ui.analyticsFilterToolbar} role="search">
        <select
          className={ui.portalFilterSelect}
          value={analyticsCategory}
          onChange={(e) => setAnalyticsCategory(e.target.value)}
          aria-label={t('app.clerk.analyticsFilterCategoryAria')}
        >
          <option value="all">{t('app.clerk.analyticsAllCategories')}</option>
            {analyticsCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        {analyticsSubcategories.length ? (
          <select
            className={ui.portalFilterSelect}
            value={analyticsSubcategory}
            onChange={(e) => setAnalyticsSubcategory(e.target.value)}
            aria-label={t('app.clerk.analyticsSubcategoryLabel')}
          >
            <option value="all">{t('app.clerk.analyticsSubcategoryAll')}</option>
            {analyticsSubcategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
        <select
          className={ui.portalFilterSelect}
          value={anomTone}
          onChange={(e) => setAnomTone(e.target.value)}
          aria-label={t('app.clerk.analyticsFilterSeverityAria')}
        >
          <option value="all">{t('app.clerk.analyticsSeverityAll')}</option>
          <option value="bad">{t('app.clerk.analyticsSeverityCritical')}</option>
          <option value="warn">{t('app.clerk.analyticsSeverityWarning')}</option>
          <option value="ok">{t('app.clerk.analyticsSeverityResolved')}</option>
        </select>
          <input
            className={ui.portalFilterSearch}
          placeholder={t('app.clerk.analyticsConsumedPlaceholder')}
            value={consumedQ}
            onChange={(e) => setConsumedQ(e.target.value)}
          aria-label={t('app.clerk.analyticsFilterConsumedAria')}
        />
        <ClearFiltersIconButton
          title={t('app.clerk.analyticsClearFilters')}
          onClick={() => {
            setAnomTone('all');
            setConsumedQ('');
            setAnalyticsCategory('all');
            setAnalyticsSubcategory('all');
          }}
        />
        <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadAnalyticsExcel}>
          {t('app.clerk.analyticsDownloadExcel')}
        </button>
      </div>

      <div className={ui.analyticsTopGrid}>
        <section className={ui.analyticsTrendCard}>
          <div className={ui.analyticsSectionHead}>
            <h2 className={ui.analyticsSectionTitle}>Usage trend</h2>
            <div className={ui.analyticsTrendValue}>
              <strong>{totalUsage.toLocaleString()}</strong>
              <span>units · {range}d · {granularity}</span>
            </div>
          </div>

          <div className={ui.analyticsChart}>
            <div className={`${ui.analyticsChartGrid} ${ui.analyticsChartGridTall}`}>
                <svg
                viewBox="0 0 100 48"
                className={`${ui.analyticsChartSvg} ${ui.analyticsChartSvgTall}`}
                role="img"
                aria-label={`Relative usage shape across ${chartLabels.join(', ')}`}
              >
                <defs>
                  <linearGradient id={`${chartGradId}-trend`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(120 11 35 / 0.38)" />
                    <stop offset="100%" stopColor="rgb(120 11 35 / 0.04)" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="12" x2="100" y2="12" stroke="var(--ec-border)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
                <line x1="0" y1="26" x2="100" y2="26" stroke="var(--ec-border)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
                <line x1="0" y1={baseY} x2="100" y2={baseY} stroke="var(--ec-border)" strokeWidth="0.5" opacity="0.6" />
                <path d={trendAreaD} fill={`url(#${chartGradId}-trend)`} />
                <path d={trendLineD} fill="none" stroke="currentColor" strokeWidth="0.85" strokeLinejoin="round" />
                {tx.map((x, i) => (
                  <g key={chartLabels[i]}>
                    <rect x={x - 0.8} y={ty[i] - 0.8} width="1.6" height="1.6" fill="var(--ec-white)" stroke="var(--ec-primary)" strokeWidth="0.5" />
                    <text
                      x={x}
                      y={Math.max(6, ty[i] - 4)}
                      textAnchor="middle"
                      fontSize="3.8"
                      fontWeight="700"
                      fill="var(--ec-primary-dark)"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {trendPct[i]}%
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            <div className={ui.analyticsChartLabels}>
              {chartLabels.map((label, i) => (
                <span key={label}>
                  {label}
                  <strong className={ui.analyticsChartLabelPct}>{trendPct[i]}%</strong>
                </span>
              ))}
            </div>
          </div>
        </section>

        <aside className={ui.analyticsSideStack}>
          <section className={ui.analyticsPredictCard}>
            <p className={ui.analyticsPredictLabel}>Consumption by category</p>
            <div className={ui.analyticsDonutRow}>
              <div
                className={`${ui.analyticsDonut} ${ui.analyticsDonutOnDark}`}
                style={{
                  background: categoryPieSlices.length
                    ? `conic-gradient(${analyticsConicStops(categoryPieSlices)})`
                    : 'rgb(255 255 255 / 0.22)',
                }}
                role="img"
                aria-label="Category mix"
              >
                <div className={ui.analyticsDonutHole}>
                  <strong>{categoryPieSlices.length ? `${categoryPieSlices[0].pct}%` : '—'}</strong>
                  <span>top</span>
                </div>
              </div>
              <ul className={ui.analyticsLegend}>
                {categoryPieSlices.length ? (
                  categoryPieSlices.map((s) => (
                    <li key={s.name} className={ui.analyticsLegendRow}>
                      <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                      <span className={ui.analyticsLegendName}>{s.name}</span>
                      <span className={ui.analyticsLegendPct}>{s.pct}%</span>
                    </li>
                  ))
                ) : (
                  <li className={ui.analyticsLegendRowMuted}>No category data in this range.</li>
                )}
              </ul>
            </div>
            <button type="button" className={ui.analyticsPredictBtn} onClick={() => navigate('/app/clerk/materials')}>
              Automate Restock Order
            </button>
          </section>

          <section className={ui.analyticsNoteCard}>
            <p className={ui.analyticsNoteTitle}>Top item vs rest</p>
            <div className={ui.analyticsDonutRow}>
              <div
                className={ui.analyticsDonut}
                style={{
                  background: topShareSlices.length
                    ? `conic-gradient(${analyticsConicStops(topShareSlices)})`
                    : 'rgb(226 232 240)',
                }}
                role="img"
                aria-label={`Share of ${topItem}`}
              >
                <div className={ui.analyticsDonutHole}>
                  <strong>{topShareSlices[0]?.pct ?? 0}%</strong>
                  <span>{topItem}</span>
                </div>
              </div>
              <ul className={ui.analyticsLegend}>
                {topShareSlices.length ? (
                  topShareSlices.map((s) => (
                    <li key={s.name} className={ui.analyticsLegendRow}>
                      <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                      <span className={ui.analyticsLegendName}>{s.name}</span>
                      <span className={ui.analyticsLegendPct}>{s.pct}%</span>
                    </li>
                  ))
                ) : (
                  <li className={ui.analyticsLegendRowMuted}>No usage yet.</li>
                )}
              </ul>
            </div>
            <div className={ui.analyticsMicroBars} aria-hidden>
              {trendPct.map((p, i) => (
                <div key={chartLabels[i]} className={ui.analyticsMicroBar} style={{ height: `${Math.max(8, p)}%` }} />
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className={ui.analyticsMiddleGrid}>
        <section className={ui.analyticsConsumedCard}>
          <div className={ui.analyticsSectionHead}>
            <h2 className={ui.analyticsSectionTitle}>Most consumed</h2>
            <button type="button" className={ui.analyticsLinkBtn} onClick={() => navigate('/app/clerk/inventory')}>
              Inventory →
            </button>
          </div>

          <div className={ui.analyticsDonutRow}>
            <div
              className={`${ui.analyticsDonut} ${ui.analyticsDonutLg}`}
              style={{
                background: itemPieSlices.length
                  ? `conic-gradient(${analyticsConicStops(itemPieSlices)})`
                  : 'rgb(226 232 240)',
              }}
              role="img"
              aria-label="Top items by quantity"
            >
              <div className={ui.analyticsDonutHole}>
                <strong>{itemPieSlices[0]?.pct ?? 0}%</strong>
                <span>lead</span>
                  </div>
            </div>
            <ul className={ui.analyticsLegend}>
              {itemPieSlices.length ? (
                itemPieSlices.map((s) => (
                  <li key={s.name} className={ui.analyticsLegendRow}>
                    <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                    <span className={ui.analyticsLegendName}>{s.name}</span>
                    <span className={ui.analyticsLegendQty}>{s.value.toLocaleString()} u</span>
                    <span className={ui.analyticsLegendPct}>{s.pct}%</span>
                  </li>
              ))
            ) : (
                <li className={ui.analyticsLegendRowMuted}>No consumed lines match this search.</li>
            )}
            </ul>
          </div>
        </section>

        <div className={ui.analyticsMiniStack}>
          <article className={ui.analyticsMetricCard}>
            <p className={ui.analyticsMetricLabel}>Total waste</p>
            <div className={ui.analyticsMetricDonutRow}>
              <div
                className={`${ui.analyticsDonut} ${ui.analyticsDonutXs}`}
                style={{
                  background: `conic-gradient(rgb(220 38 38 / 0.9) 0% ${parseFloat(totalWaste)}%, rgb(34 197 94 / 0.35) ${parseFloat(totalWaste)}% 100%)`,
                }}
                role="presentation"
              >
                <div className={ui.analyticsDonutHole}>
                  <strong className={ui.analyticsDonutHoleSm}>{totalWaste}</strong>
                </div>
              </div>
              <div className={ui.analyticsMetricAside}>
            <strong className={ui.analyticsMetricValue}>{totalWaste}</strong>
                <span className={ui.analyticsMetricMeta}>of SKUs near expiry</span>
              </div>
            </div>
          </article>
          <article className={ui.analyticsMetricCard}>
            <p className={ui.analyticsMetricLabel}>Inventory turn</p>
            <div className={ui.analyticsMetricDonutRow}>
              <div
                className={`${ui.analyticsDonut} ${ui.analyticsDonutXs}`}
                style={{
                  background: `conic-gradient(var(--ec-primary) 0% ${Math.min(100, parseFloat(turnRate) * 12)}%, rgb(226 232 240) ${Math.min(100, parseFloat(turnRate) * 12)}% 100%)`,
                }}
                role="presentation"
              >
                <div className={ui.analyticsDonutHole}>
                  <strong className={ui.analyticsDonutHoleSm}>{turnRate}</strong>
                </div>
              </div>
              <div className={ui.analyticsMetricAside}>
            <strong className={ui.analyticsMetricValue}>{turnRate}</strong>
                <span className={ui.analyticsMetricMeta}>units / SKU</span>
              </div>
            </div>
          </article>
          <article className={`${ui.analyticsMetricCard} ${ui.analyticsSyncCard}`}>
            <p className={ui.analyticsSyncTitle}>Bucket mix</p>
            <div className={ui.analyticsStackBar} role="img" aria-label="Relative bucket heights">
              {trendPct.map((p, i) => (
                <div
                  key={chartLabels[i]}
                  className={ui.analyticsStackSeg}
                  style={{ flex: p, background: ANALYTICS_SLICE_COLORS[i % ANALYTICS_SLICE_COLORS.length] }}
                  title={`${chartLabels[i]} ${p}%`}
                />
              ))}
            </div>
          </article>
        </div>
      </div>

      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>Anomaly mix</h2>
          <span className={ui.analyticsFlagPill}>
            {filteredAnomalies.length} {filteredAnomalies.length === 1 ? 'flag' : 'flags'}
          </span>
        </div>

        <div className={ui.analyticsAnomalyVisual}>
          <div className={ui.analyticsStackBarWide} role="img" aria-label="Severity distribution">
            {anomalySlices.map((s) => (
              <div
                key={s.name}
                className={ui.analyticsStackSeg}
                style={{
                  flex: Math.max(1, s.value),
                  background: s.color,
                }}
                title={`${s.name} ${s.pct}%`}
              />
            ))}
          </div>
          <ul className={ui.analyticsLegendInline}>
            {anomalySlices.map((s) => (
              <li key={s.name} className={ui.analyticsLegendRow}>
                <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                <span className={ui.analyticsLegendName}>{s.name}</span>
                <span className={ui.analyticsLegendPct}>{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={ui.analyticsLogRowsCompact}>
          {anomalyPager.pageSlice.length ? (
            anomalyPager.pageSlice.map((row) => (
              <article key={row.id} className={ui.analyticsLogRowCompact}>
                <span
                  className={ui.analyticsToneDot}
                  style={{
                    background:
                      row.tone === 'bad' ? '#dc2626' : row.tone === 'ok' ? '#16a34a' : '#ca8a04',
                  }}
                  title={row.status}
                />
                <strong className={ui.analyticsLogCode}>{row.code}</strong>
                <span className={ui.analyticsLogTime}>{row.time}</span>
                <strong
                  className={
                    row.tone === 'bad' ? ui.analyticsDeltaBad : row.tone === 'ok' ? ui.analyticsDeltaOk : ui.analyticsDeltaWarn
                  }
                >
                  {row.delta}
                </strong>
              </article>
            ))
          ) : (
            <p className={ui.empty}>No anomalies match these filters.</p>
          )}
        </div>
        <ListPageControls
          variant="table"
          rangeFrom={anomalyPager.rangeFrom}
          rangeTo={anomalyPager.rangeTo}
          total={anomalyPager.total}
          page={anomalyPager.page}
          pageCount={anomalyPager.pageCount}
          pagerNums={anomalyPager.pagerNums}
          onPrev={anomalyPager.goPrev}
          onNext={anomalyPager.goNext}
          onSelectPage={anomalyPager.setPage}
          canPrev={anomalyPager.canPrev}
          canNext={anomalyPager.canNext}
        />
      </section>
    </div>
  );
}

export function ClerkUsage() {
  const { t } = useI18n();
  const { state, consumeStockItem } = usePortalData();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const items = state.stockItems.filter((item) => item.ownerId === actor?.id);
  const linkableRequisitions = useMemo(() => {
    return (state.requisitions || [])
      .filter((r) => r.clerkId === actor?.id && r.status !== 'rejected')
      .sort((a, b) => new Date(b.requestedAt || b.updatedAt) - new Date(a.requestedAt || a.updatedAt));
  }, [state.requisitions, actor?.id]);
  const alerts = notificationsForRole(state, 'clerk');
  const consumptions = state.consumptions.filter((entry) => entry.clerkId === actor?.id && !isBillConsumption(entry));
  const [err, setErr] = useState('');
  const departments = ['Surgery Unit A', 'Emergency Room', 'Surgery Unit B', 'General Floor', 'Pharmacy', 'Maternity'];
  const [form, setForm] = useState({
    itemId: items[0]?.id || '',
    quantity: '',
    department: departments[0],
    date: '',
    notes: '',
    relatedRequisitionId: '',
  });
  const [histSearch, setHistSearch] = useState('');
  const historyAll = [...consumptions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const historyTodayOnly = historyAll.filter((entry) => {
    const d = new Date(entry.createdAt);
    return d >= startOfToday && d < endOfToday;
  });
  const qHist = histSearch.trim().toLowerCase();
  const historyFiltered = historyTodayOnly.filter(
      (entry) =>
        !qHist ||
        (entry.itemName || '').toLowerCase().includes(qHist) ||
        String(entry.purpose || '')
          .toLowerCase()
          .includes(qHist)
  );
  const historyPager = usePagedList(historyFiltered, { resetKey: `${histSearch}|today` });
  const insightBody =
    alerts[0]?.body || 'Usage in Surgery Unit A is 145% higher than average this week. Ensure all logs include patient case IDs for audit compliance.';

  async function submitUsage(event) {
    event.preventDefault();
    const qty = Number(form.quantity);
    if (!form.itemId || !Number.isFinite(qty) || qty <= 0) {
      setErr('Choose an item and enter a quantity greater than zero.');
      return;
    }
    try {
      const datePart = form.date ? `Usage date ${form.date} · ` : '';
      await consumeStockItem(
        {
          itemId: form.itemId,
          quantity: qty,
          consumptionKind: 'usage',
          relatedRequisitionId: form.relatedRequisitionId,
          purpose: `${datePart}${form.department}${form.notes ? ` · ${form.notes}` : ''}`,
        },
        actor?.id
      );
      setForm({
        itemId: items[0]?.id || '',
        quantity: '',
        department: departments[0],
        date: '',
        notes: '',
        relatedRequisitionId: '',
      });
      setErr('');
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div className={ui.usageBoard}>
      <div className={ui.usageHeader}>
        <div>
          <h1 className={ui.usageTitle}>{t('app.clerk.usageTitle')}</h1>
          <p className={ui.usageLead}>{t('app.clerk.usageLeadExplain')}</p>
          <p className={ui.billingRelationshipNote}>
            {t('app.clerk.usageVsBillingExplain')}{' '}
            <Link to="/app/clerk/documents">{t('app.clerk.usageVsBillingLink')}</Link>
            {t('app.clerk.usageVsBillingAfterLink')}
          </p>
        </div>
      </div>

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField} style={{ flex: '1 1 16rem', maxWidth: '24rem' }}>
          <span className={ui.portalFilterLabel}>Filter today&apos;s usage</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="Item or department (today only)…"
            value={histSearch}
            onChange={(e) => setHistSearch(e.target.value)}
          />
        </label>
        <ClearFiltersIconButton title={t('common.clearSearchAria')} onClick={() => setHistSearch('')} />
        <span className={ui.portalFilterMeta}>
          {historyFiltered.length
            ? `${historyPager.rangeFrom}–${historyPager.rangeTo} of ${historyFiltered.length} entries`
            : '0 entries'}
        </span>
      </div>

      {err ? <p className={ui.err}>{err}</p> : null}

      <div className={ui.usageGrid}>
        <section className={ui.usageFormCard}>
          <form className={ui.usageForm} onSubmit={submitUsage}>
            <div className={ui.usageFormRow2}>
              <label className={ui.usageField}>
                <span>Search item</span>
                <select className={ui.usageInput} value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={ui.usageField}>
                <span>Quantity used</span>
                <input
                  className={ui.usageInput}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </label>
            </div>

            <div className={ui.usageFormRow2}>
              <label className={ui.usageField}>
                <span>Target department</span>
                <select className={ui.usageInput} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>

              <label className={ui.usageField}>
                <span>Date of usage</span>
                <input className={ui.usageInput} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
            </div>

            <label className={ui.usageField}>
              <span>Notes / reason for usage <span className={ui.requiredText}>*</span></span>
              <textarea
                className={ui.usageTextarea}
                rows={5}
                placeholder="Describe clinical context or specific case reference (e.g., patient case, procedure, emergency situation)..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                maxLength={1000}
                required
              />
              <div className={ui.characterCount}>
                {form.notes.length}/1000 characters
              </div>
            </label>

            <label className={ui.usageField}>
              <span>{t('app.clerk.relatedRequisitionLabel')}</span>
              <select
                className={ui.usageInput}
                value={form.relatedRequisitionId}
                onChange={(e) => setForm({ ...form, relatedRequisitionId: e.target.value })}
              >
                <option value="">{t('app.clerk.relatedRequisitionNone')}</option>
                {linkableRequisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.title}
                  </option>
                ))}
              </select>
            </label>

            <div className={ui.usageSubmitRow}>
              <button type="submit" className={ui.usageSubmitBtn}>
                Log Usage
              </button>
            </div>
          </form>
        </section>

        <aside className={ui.usageSideRail}>
          <div className={ui.usageHistoryHead}>
            <h2 className={ui.usageHistoryTitle}>Today&apos;s Usage History</h2>
            <span className={ui.usageLivePill}>Live</span>
          </div>

          <div className={ui.usageHistoryList}>
            {historyPager.pageSlice.length ? (
              historyPager.pageSlice.map((entry, index) => (
                <article
                  key={entry.id}
                  className={
                    index === 0
                      ? `${ui.usageHistoryCard} ${ui.usageHistoryCardPlum}`
                      : index === 1
                        ? `${ui.usageHistoryCard} ${ui.usageHistoryCardBlue}`
                        : index === 2
                          ? `${ui.usageHistoryCard} ${ui.usageHistoryCardGreen}`
                          : `${ui.usageHistoryCard} ${ui.usageHistoryCardPlum}`
                  }
                >
                  <div className={ui.usageHistoryTop}>
                    <p className={ui.usageHistoryItem}>{entry.itemName}</p>
                    <span className={ui.usageHistoryTime}>
                      {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={ui.usageHistoryMeta}>
                    <span className={ui.usageHistoryQty}>
                      {entry.quantity} {entry.unit}
                    </span>
                    <span>{entry.purpose?.split(' · ')[0] || 'General unit'}</span>
                  </div>
                  {entry.relatedRequisitionId ? (
                    <p className={ui.usageHistoryReq}>
                      {t('app.clerk.usageHistoryReq')}: {entry.relatedRequisitionId}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <article className={`${ui.usageHistoryCard} ${ui.usageHistoryCardPlum}`}>
                <div className={ui.usageHistoryTop}>
                  <p className={ui.usageHistoryItem}>No usage logs yet</p>
                  <span className={ui.usageHistoryTime}>Today</span>
                </div>
                <div className={ui.usageHistoryMeta}>
                  <span className={ui.usageHistoryQty}>0 Units</span>
                  <span>Start logging from the form</span>
                </div>
              </article>
            )}
          </div>
          {historyFiltered.length > 0 ? (
            <ListPageControls
              variant="feed"
              rangeFrom={historyPager.rangeFrom}
              rangeTo={historyPager.rangeTo}
              total={historyPager.total}
              page={historyPager.page}
              pageCount={historyPager.pageCount}
              pagerNums={historyPager.pagerNums}
              onPrev={historyPager.goPrev}
              onNext={historyPager.goNext}
              onSelectPage={historyPager.setPage}
              canPrev={historyPager.canPrev}
              canNext={historyPager.canNext}
            />
          ) : null}

          <div className={ui.usageInsightCard}>
            <p className={ui.usageInsightEyebrow}>{t('cungaAi.insightTitle')}</p>
            <p className={ui.usageInsightBody}>{insightBody}</p>
            <button type="button" className={ui.usageInsightLink}>
              View detailed report →
            </button>
          </div>
        </aside>
      </div>

      <div className={ui.usageToolsRow}>
        <div className={ui.usageToolCard}>
          <span className={`${ui.usageToolIcon} ${ui.usageToolBlue}`}>
            <ClerkIcon kind="inventory" />
          </span>
          <div>
            <p className={ui.usageToolTitle}>Scan Barcode</p>
            <p className={ui.usageToolMeta}>Fast log via inventory tags</p>
          </div>
        </div>

        <div className={ui.usageToolCard}>
          <span className={`${ui.usageToolIcon} ${ui.usageToolGreen}`}>
            <ClerkIcon kind="request" />
          </span>
          <div>
            <p className={ui.usageToolTitle}>Templates</p>
            <p className={ui.usageToolMeta}>Use preset surgical bundles</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function billConsumptionInPeriod(row, periodKey) {
  if (periodKey === 'all') return true;
  const days = Number(periodKey);
  if (!Number.isFinite(days) || days <= 0) return true;
  const t = new Date(row.createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - days * 86400000;
}

function ClerkBillingRailExport({
  t,
  billHistory,
  stockItems,
  billExportPeriod,
  setBillExportPeriod,
  billExportCategory,
  setBillExportCategory,
}) {
  const categories = useMemo(
    () => [...new Set(stockItems.map((i) => i.category).filter(Boolean))].sort(),
    [stockItems]
  );

  function categoryForBillRow(row) {
    const item = stockItems.find((s) => s.id === row.itemId);
    return item?.category || '';
  }

  function downloadBilledExcel() {
    const rows = billHistory.filter((row) => {
      if (!billConsumptionInPeriod(row, billExportPeriod)) return false;
      const cat = categoryForBillRow(row);
      if (billExportCategory !== 'all' && cat !== billExportCategory) return false;
      return true;
    });
    const aoa = [
      [
        t('app.clerk.billingColDateValue'),
        t('app.clerk.billingExportColRecorded'),
        t('app.clerk.billingColItem'),
        t('app.clerk.materialsExportColCategory'),
        t('app.clerk.billingColQty'),
        t('app.clerk.requisitionColUnit'),
        t('app.clerk.billingColRecipient'),
        t('app.clerk.billingColRequisition'),
        t('app.clerk.billingColNotes'),
      ],
    ];
    for (const row of rows) {
      const { recipient: rec, detail } = parseBillPurpose(row.purpose);
      const cat = categoryForBillRow(row);
      aoa.push([
        formatIsoDateOnly(row.createdAt) || '—',
        formatDateTime(row.createdAt),
        row.itemName || '—',
        cat || '—',
        row.quantity,
        row.unit || 'units',
        rec,
        row.relatedRequisitionId || '—',
        detail,
      ]);
    }
    if (aoa.length < 2) {
      aoa.push([t('app.clerk.billingExportEmpty')]);
    }
    downloadAoAAsXlsx(
      `billed-items-${billExportPeriod === 'all' ? 'all' : billExportPeriod + 'd'}-${new Date().toISOString().slice(0, 10)}`,
      aoa,
      'Billed'
    );
  }

  return (
    <div className={ui.clerkMaterialsRailExport}>
      <p className={ui.clerkMaterialsRailExportEyebrow}>{t('app.clerk.billingExportEyebrow')}</p>
      <p className={ui.clerkMaterialsRailExportTitle}>{t('app.clerk.billingExportTitle')}</p>
      <label className={ui.clerkMaterialsRailExportField}>
        <span>{t('app.clerk.billingExportPeriod')}</span>
        <select
          value={billExportPeriod}
          onChange={(e) => setBillExportPeriod(e.target.value)}
          className={ui.clerkMaterialsRailExportSelect}
        >
          <option value="7">{t('app.clerk.billingExportDays7')}</option>
          <option value="30">{t('app.clerk.billingExportDays30')}</option>
          <option value="90">{t('app.clerk.billingExportDays90')}</option>
          <option value="all">{t('app.clerk.billingExportAllTime')}</option>
        </select>
      </label>
      <label className={ui.clerkMaterialsRailExportField}>
        <span>{t('app.clerk.materialsExportCategory')}</span>
        <select
          value={billExportCategory}
          onChange={(e) => setBillExportCategory(e.target.value)}
          className={ui.clerkMaterialsRailExportSelect}
        >
          <option value="all">{t('app.clerk.materialsExportAllCategories')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={ui.clerkMaterialsRailExportBtn} onClick={downloadBilledExcel}>
        {t('app.clerk.billingExportDownload')}
      </button>
    </div>
  );
}

export function ClerkDocuments({ setRailSlot }) {
  const { t } = useI18n();
  const { state, consumeStockItem } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const stockItems = useMemo(
    () => state.stockItems.filter((entry) => entry.ownerId === actor?.id).sort((a, b) => a.name.localeCompare(b.name)),
    [state.stockItems, actor?.id]
  );
  const [stockSearch, setStockSearch] = useState('');
  const [lineQtys, setLineQtys] = useState({});
  const [sessionRecorded, setSessionRecorded] = useState([]);
  const [recordingItemId, setRecordingItemId] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [notes, setNotes] = useState('');
  const [relatedRequisitionId, setRelatedRequisitionId] = useState('');
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk] = useState(false);
  const [histSearch, setHistSearch] = useState('');
  const [billExportPeriod, setBillExportPeriod] = useState('30');
  const [billExportCategory, setBillExportCategory] = useState('all');
  const sessionBillKeyRef = useRef(0);

  const filteredStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return stockItems;
    return stockItems.filter((s) => {
      const label = inventoryCategoryLabel(s);
      const hay = `${s.name} ${s.sku || ''} ${s.category || ''} ${label}`.toLowerCase();
      return hay.includes(q);
    });
  }, [stockItems, stockSearch]);

  const linkableRequisitions = useMemo(() => {
    return (state.requisitions || [])
      .filter((r) => r.clerkId === actor?.id && r.status !== 'rejected')
      .sort((a, b) => new Date(b.requestedAt || b.updatedAt) - new Date(a.requestedAt || a.updatedAt));
  }, [state.requisitions, actor?.id]);

  const billHistory = useMemo(() => {
    return (state.consumptions || [])
      .filter((c) => c.clerkId === actor?.id && isBillConsumption(c))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [state.consumptions, actor?.id]);

  useEffect(() => {
    if (typeof setRailSlot !== 'function') return undefined;
    setRailSlot(
      <ClerkBillingRailExport
        t={t}
        billHistory={billHistory}
        stockItems={stockItems}
        billExportPeriod={billExportPeriod}
        setBillExportPeriod={setBillExportPeriod}
        billExportCategory={billExportCategory}
        setBillExportCategory={setBillExportCategory}
      />
    );
    return () => setRailSlot(null);
  }, [
    setRailSlot,
    t,
    billHistory,
    stockItems,
    billExportPeriod,
    billExportCategory,
  ]);

  const filteredHistory = useMemo(() => {
    const q = histSearch.trim().toLowerCase();
    if (!q) return billHistory;
    return billHistory.filter(
      (c) =>
        String(c.itemName || '')
          .toLowerCase()
          .includes(q) || String(c.purpose || '').toLowerCase().includes(q)
    );
  }, [billHistory, histSearch]);

  const historyPager = usePagedList(filteredHistory, { resetKey: histSearch, pageSize: 8 });

  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const billsThisMonth = billHistory.filter((c) => new Date(c.createdAt).getTime() >= monthStart).length;
  const qtyThisMonth = billHistory
    .filter((c) => new Date(c.createdAt).getTime() >= monthStart)
    .reduce((s, c) => s + Number(c.quantity || 0), 0);

  async function recordBillForItem(item) {
    setFormErr('');
    setFormOk(false);
    const raw = lineQtys[item.id];
    const q = raw === undefined || raw === '' ? 1 : Number(raw);
    if (!actor?.id) {
      setFormErr(t('app.clerk.billingErrorActor'));
      return;
    }
    if (!item) {
      setFormErr(t('app.clerk.billingErrorNoStock'));
      return;
    }
    if (!Number.isFinite(q) || q < 1) {
      setFormErr(t('app.clerk.billingErrorQty'));
      return;
    }
    if (q > Number(item.quantity || 0)) {
      setFormErr(t('app.clerk.billingErrorOverage'));
      return;
    }
    const rec = String(recipient || '').trim() || 'General';
    const note = String(notes || '').trim();
    const purpose = note ? `${BILL_PURPOSE_PREFIX} ${rec} — ${note}` : `${BILL_PURPOSE_PREFIX} ${rec}`;
    setRecordingItemId(item.id);
    try {
      await consumeStockItem(
        {
          itemId: item.id,
          quantity: q,
          purpose,
          consumptionKind: 'bill',
          relatedRequisitionId,
        },
        actor.id
      );
      setFormOk(true);
      setLineQtys((prev) => ({ ...prev, [item.id]: '1' }));
      setSessionRecorded((prev) =>
        [
          {
            key: `s-${sessionBillKeyRef.current++}`,
            itemName: item.name,
            quantity: q,
            unit: item.unit || '',
          },
          ...prev,
        ].slice(0, 25)
      );
    } catch (ex) {
      setFormErr(ex.message || t('app.clerk.billingErrorGeneric'));
    } finally {
      setRecordingItemId(null);
    }
  }

  return (
    <div className={ui.billingBoard}>
      <header className={ui.billingHeader}>
        <div>
          <h1 className={ui.billingTitle}>{t('app.clerk.billingTitle')}</h1>
          <p className={ui.billingLead}>{t('app.clerk.billingFormLead')}</p>
          <p className={ui.billingRelationshipNote}>
            {t('app.clerk.billingVsUsageExplain')}{' '}
            <Link to="/app/clerk/usage">{t('app.clerk.billingVsUsageLink')}</Link>
            {t('app.clerk.billingVsUsageAfterLink')}
          </p>
        </div>
      </header>

      <div className={ui.billingFormLayout}>
        <div className={ui.billingTopBar}>
          <div className={ui.billingSummaryStrip}>
            <article className={ui.billingValueCard}>
              <p className={ui.billingValueLabel}>{t('app.clerk.billingRailMonth')}</p>
              <strong className={ui.billingValueAmount}>{billsThisMonth}</strong>
              <span className={ui.billingValueMeta}>{t('app.clerk.billingRailMonthMeta', { qty: qtyThisMonth })}</span>
            </article>

            <div className={ui.billingFieldsStrip}>
              <label className={ui.billingFormField}>
                <span className={ui.billingFormLabel}>{t('app.clerk.billingFieldRecipient')}</span>
                <input
                  className={ui.billingFormInput}
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setFormOk(false);
                  }}
                  placeholder={t('app.clerk.billingRecipientPlaceholder')}
                  autoComplete="off"
                />
              </label>
              <label className={ui.billingFormField}>
                <span className={ui.billingFormLabel}>
                  {t('app.clerk.billingFieldNotes')} <span className={ui.optionalText}>(optional)</span>
                </span>
                <input
                  className={ui.billingFormInput}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setFormOk(false);
                  }}
                  placeholder={t('app.clerk.billingNotesPlaceholder')}
                  maxLength={300}
                />
              </label>
              <label className={ui.billingFormField}>
                <span className={ui.billingFormLabel}>{t('app.clerk.relatedRequisitionLabel')}</span>
                <select
                  className={ui.billingFormInput}
                  value={relatedRequisitionId}
                  onChange={(e) => {
                    setRelatedRequisitionId(e.target.value);
                    setFormOk(false);
                  }}
                >
                  <option value="">{t('app.clerk.relatedRequisitionNone')}</option>
                  {linkableRequisitions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section className={ui.billingRecordedStrip} aria-labelledby="billing-recorded-heading">
              <h3 id="billing-recorded-heading" className={ui.billingRecordedTitleSmall}>
                {t('app.clerk.billingRecordedSessionTitle')}
              </h3>
              {sessionRecorded.length ? (
                <div className={ui.billingRecordedScroll}>
                  {sessionRecorded.map((row) => (
                    <div key={row.key} className={ui.billingRecordedPill}>
                      <span className={ui.billingRecordedNameSmall}>{row.itemName}</span>
                      <span className={ui.billingRecordedQtySmall}>
                        {row.quantity}
                        {row.unit ? ` ${row.unit}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={ui.billingRecordedEmptySmall}>{t('app.clerk.billingRecordedSessionEmpty')}</p>
              )}
            </section>

            <div className={ui.billingActionStrip}>
              <button type="button" className={ui.billingPrimaryBtn} onClick={() => navigate('/app/clerk/inventory')}>
                {t('app.clerk.billingOpenInventory')}
              </button>
            </div>
          </div>
        </div>

        <div className={ui.billingFormMain}>
          <section className={ui.billingStockPanel} aria-labelledby="billing-stock-heading">
            {formErr ? <p className={ui.err}>{formErr}</p> : null}
            {formOk ? <p className={ui.billingFormSuccess}>{t('app.clerk.billingSuccess')}</p> : null}

            <label className={ui.billingStockSearchWrap}>
              <span className={ui.visuallyHidden}>{t('app.clerk.billingSearchPlaceholder')}</span>
          <input
                type="search"
                className={ui.billingStockSearch}
                value={stockSearch}
                onChange={(e) => {
                  setStockSearch(e.target.value);
                  setFormOk(false);
                }}
                placeholder={t('app.clerk.billingSearchPlaceholder')}
                autoComplete="off"
          />
        </label>

            <h2 id="billing-stock-heading" className={ui.billingItemsSectionTitle}>
              {t('app.clerk.billingItemsSectionTitle')}
            </h2>

            {!stockItems.length ? (
              <p className={ui.muted}>{t('app.clerk.billingNoSkus')}</p>
            ) : filteredStock.length ? (
              <>
                <div className={ui.billingStockListHead} aria-hidden>
                  <span>{t('app.clerk.billingColItem')}</span>
                  <span>{t('app.clerk.billingColInStock')}</span>
                  <span>{t('app.clerk.billingFieldQty')}</span>
                  <span>{t('app.clerk.billingColExpiry')}</span>
                  <span className={ui.billingStockHeadRecord}>{t('app.clerk.billingRecord')}</span>
                </div>
                <div className={ui.billingStockList} role="list">
                  {filteredStock.map((item) => {
                    const onHand = Number(item.quantity || 0);
                    const busy = recordingItemId === item.id;
                    const qtyStr = lineQtys[item.id] ?? '1';
                    return (
                      <div key={item.id} className={ui.billingStockRow} role="listitem">
                        <div className={ui.billingStockRowMain}>
                          <p className={ui.billingStockRowName}>{item.name}</p>
                          <p className={ui.billingStockRowMeta}>
                            SKU: {item.sku || '—'} · {inventoryCategoryLabel(item)}
                          </p>
                        </div>
                        <div className={ui.billingStockInStock}>
                          {onHand.toLocaleString()} {item.unit || ''}
                        </div>
                        <input
                          className={ui.billingStockQtyInput}
                          type="number"
                          min={1}
                          max={onHand > 0 ? onHand : undefined}
                          value={qtyStr}
                          disabled={onHand < 1 || busy}
                          onChange={(e) => {
                            setLineQtys((prev) => ({ ...prev, [item.id]: e.target.value }));
                            setFormOk(false);
                          }}
                          aria-label={t('app.clerk.billingFieldQty')}
                        />
                        <div className={ui.billingStockExpiry}>
                          {item.expiryDate ? formatIsoDateOnly(item.expiryDate) : '—'}
                        </div>
                        <button
                          type="button"
                          className={ui.billingRecordBtn}
                          disabled={onHand < 1 || busy || !stockItems.length}
                          onClick={() => recordBillForItem(item)}
                          aria-label={t('app.clerk.billingRecordAria', { name: item.name })}
                        >
                          {busy ? t('app.clerk.billingRecording') : t('app.clerk.billingRecord')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className={ui.muted}>{t('app.clerk.billingStockNoMatch')}</p>
            )}
          </section>

          <h2 className={ui.billingHistoryTitle}>{t('app.clerk.billingHistoryTitle')}</h2>
          <div className={ui.billingCompactToolbar} role="search">
            <span className={ui.billingToolbarInlineLabel}>{t('app.clerk.billingHistorySearch')}</span>
            <input
              type="search"
              className={ui.billingToolbarSearch}
              placeholder={t('app.clerk.billingHistoryPlaceholder')}
              value={histSearch}
              onChange={(e) => setHistSearch(e.target.value)}
              aria-label={t('app.clerk.billingHistorySearch')}
            />
            <button type="button" className={ui.billingToolbarClear} onClick={() => setHistSearch('')}>
              {t('app.clerk.billingHistoryClear')}
            </button>
          </div>

          <div className={ui.billingHistoryTableWrap}>
            <div className={ui.billingHistoryHead}>
              <span>{t('app.clerk.billingColDate')}</span>
              <span>{t('app.clerk.billingColItem')}</span>
              <span>{t('app.clerk.billingColQty')}</span>
              <span>{t('app.clerk.billingColRecipient')}</span>
              <span>{t('app.clerk.billingColRequisition')}</span>
              <span>{t('app.clerk.billingColNotes')}</span>
          </div>
            {historyPager.pageSlice.length ? (
              historyPager.pageSlice.map((row) => {
                const { recipient: rec, detail } = parseBillPurpose(row.purpose);
              return (
                  <div key={row.id} className={ui.billingHistoryRow}>
                    <span>{formatDate(row.createdAt)}</span>
                    <span>{row.itemName}</span>
                    <span>
                      {row.quantity} {row.unit || ''}
                    </span>
                    <span>{rec}</span>
                    <span className={ui.billingHistoryReqCell}>{row.relatedRequisitionId || '—'}</span>
                    <span className={ui.billingHistoryNoteCell}>{detail}</span>
                  </div>
              );
              })
            ) : (
              <p className={ui.billingHistoryEmpty}>{t('app.clerk.billingHistoryEmpty')}</p>
            )}
          </div>
          {filteredHistory.length ? (
            <ListPageControls
              variant="minimal"
              rangeFrom={historyPager.rangeFrom}
              rangeTo={historyPager.rangeTo}
              total={historyPager.total}
              page={historyPager.page}
              pageCount={historyPager.pageCount}
              pagerNums={historyPager.pagerNums}
              onPrev={historyPager.goPrev}
              onNext={historyPager.goNext}
              onSelectPage={historyPager.setPage}
              canPrev={historyPager.canPrev}
              canNext={historyPager.canNext}
            />
          ) : null}
            </div>


      </div>
    </div>
  );
}

export function ClerkMessages() {
  return <PortalMessagingHub role="clerk" />;
}

export function ClerkPlaceholder({ title, body }) {
  return (
    <div className={ui.panel}>
      <h2 className={ui.panelTitle}>{title}</h2>
      <p className={ui.muted}>{body}</p>
    </div>
  );
}

function StockItemDetailModal({ isOpen, item, onClose }) {
  if (!isOpen || !item) return null;
  const levelPct = Math.max(5, Math.min(100, (Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 100))) * 100));
  const isLow = Number(item.quantity || 0) <= Number(item.minThreshold || 0);

  return (
    <div className={ui.modalOverlay} role="dialog" aria-modal="true" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className={ui.modalCard} style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className={ui.modalHead}>
          <div>
            <h2 className={ui.modalTitle}>{item.name}</h2>
            <p className={ui.modalSubtitle}>SKU: {item.sku || 'N/A'} · {item.category}</p>
          </div>
          <button type="button" className={ui.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={ui.modalBody} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <section>
              <h3 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--ec-muted)', marginBottom: '0.5rem', fontWeight: 800 }}>Current Level</h3>
              <div style={{ fontSize: '2.4rem', fontWeight: '900', color: isLow ? '#ef4444' : 'var(--ec-text)' }}>
                {item.quantity} <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--ec-muted)' }}>{item.unit || 'units'}</span>
              </div>
              <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', marginTop: '1.2rem', overflow: 'hidden' }}>
                <div style={{ width: `${levelPct}%`, height: '100%', background: isLow ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius: '5px' }} />
              </div>
            </section>
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--ec-muted)', margin: 0, fontWeight: 800 }}>Shelf Location</h4>
                <p style={{ margin: '0.35rem 0 0', fontWeight: '700' }}>{item.location || 'Store Alpha'}</p>
              </div>
              <div>
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--ec-muted)', margin: 0, fontWeight: 800 }}>Saftey Limits</h4>
                <p style={{ margin: '0.25rem 0 0', fontWeight: '700' }}>{item.minThreshold} (min) / {item.maxThreshold} (max)</p>
              </div>
            </section>
          </div>
        </div>
        <div className={ui.modalActions}>
          <button type="button" className={ui.modalSecondaryBtn} onClick={onClose}>Close</button>
          <button type="button" className={ui.inventoryActionBtn} style={{ background: 'var(--ec-primary)', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }} onClick={() => {
            onClose();
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal', { detail: { item } }));
            }, 50);
          }}>
            Edit SKU
          </button>
        </div>
      </div>
    </div>
  );
}

function RequisitionPdfModal({ isOpen, req, onClose, onDownload, users = [] }) {
  if (!isOpen || !req) return null;
  const clerk = users.find((u) => u.id === req.clerkId) || { name: 'Inventory Clerk', department: 'General Stores' };
  const supervisor = users.find((u) => u.role === 'supervisor') || { name: 'Regional Supervisor' };
  
  const statusLabels = {
    submitted: 'Sent to Supervisor',
    pending: 'Sent to Supervisor',
    approved: 'Approved by Supervisor',
    sentToSupplier: 'Sent to Supplier',
    proformaReceived: 'Proforma Received',
    proformaApproved: 'Proforma Approved',
    paid: 'Payment Completed',
    deliveryNoteAttached: 'Delivery Attached',
    closed: 'Completed',
    rejected: 'Rejected'
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
            <h2 className={ui.modalTitle} style={{ fontSize: '1.4rem' }}>Requisition Preview</h2>
            <p className={ui.modalSubtitle} style={{ fontSize: '0.9rem', color: 'var(--ec-muted)' }}>
              {req.id} • Professional PDF Format
            </p>
          </div>
          <button type="button" className={ui.modalClose} onClick={onClose} style={{ fontSize: '1.8rem' }}>
            ×
          </button>
        </div>

        <div
          className={ui.modalBody}
          style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', background: '#f1f5f9' }}
        >
          <div
            id="requisition-pdf-content"
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
            {/* Header with Logo */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '3rem',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '2rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img 
                  src="/e-Cunga.png" 
                  alt="e-Cunga" 
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
                  <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--ec-primary-dark)' }}>
                    e-Cunga
                  </h1>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ec-muted)', letterSpacing: '0.1em' }}>
                    INVENTORY MANAGEMENT
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#1e293b' }}>
                  REQUISITION FORM
                </h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>
                  Ref: {req.id}
                </p>
              </div>
            </div>

            {/* Info Grid */}
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
                <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Requesting Entity</p>
                <p style={{ margin: 0, fontWeight: 700 }}>{clerk.department || 'General Stores'}</p>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b' }}>Clerk: {clerk.name}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Fulfillment Details</p>
                <p style={{ margin: 0 }}><strong>Date:</strong> {new Date(req.requestedAt || req.createdAt).toLocaleDateString()}</p>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--ec-primary)', fontWeight: 700 }}>
                  Status: {displayStatus}
                </p>
              </div>
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '3rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', width: '50px' }}>No.</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Description & Specifications</th>
                  <th style={{ padding: '1rem', textAlign: 'center', width: '80px' }}>Qty</th>
                  <th style={{ padding: '1rem', textAlign: 'center', width: '80px' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {(req.lines || []).map((line, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{i + 1}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{line.description}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700 }}>{line.quantity}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>{line.unit || 'Units'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer / Notes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', fontSize: '0.85rem', color: '#475569', marginBottom: '5rem' }}>
              <div>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Justification & Purpose</p>
                <p style={{ margin: 0, fontStyle: 'italic', background: '#f8fafc', padding: '1rem', borderRadius: '4px' }}>
                  "{req.clerkJustification || 'No justification provided.'}"
                </p>
              </div>
            </div>

            {/* Signatures */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4rem',
                gap: '4rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '0.5rem', height: '40px' }}></div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{clerk.name}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Requester / Inventory Clerk</p>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ borderBottom: '1px solid #cbd5e1', marginBottom: '0.5rem', height: '40px' }}></div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{supervisor.name}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Authorizing Supervisor</p>
              </div>
            </div>
          </div>
        </div>

        <div className={ui.modalActions} style={{ padding: '2rem', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: 0 }}>
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
              boxSizing: 'border-box'
            }}
          >
            Close Preview
          </button>
          <button
            type="button"
            className={ui.inventoryActionBtn}
            style={{
              width: '210px',
              height: '48px',
              padding: '0',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 800,
              color: 'white',
              border: '2px solid #780b23',
              background: 'linear-gradient(135deg, #780b23 0%, #5a081a 100%)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.55rem',
              boxShadow: '0 6px 18px rgba(120,11,35,0.25)',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
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
