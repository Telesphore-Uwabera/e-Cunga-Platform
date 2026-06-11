import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import { EditDraftRequisitionModal } from '../../components/EditDraftRequisitionModal.jsx';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { categoryFilterOptionLabel } from '../../lib/formatters.js';
import {
  HEALTHCARE_STOCK_CATEGORIES,
  isHealthcareCompany,
  normalizeToHealthcareCategory,
} from '../../constants/ecosystemCatalog.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import { getClerkVisibleRecords, normalizeOrgScopePart } from '../../utils/orgScope.js';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useShellSearchQuery } from '../../hooks/useShellSearchQuery.js';
import { getClerkRangeBounds, isoInRange } from '../../utils/reportFilters.js';
import { filterMasterRecommendations } from '../../utils/filterMasterRecommendations.js';
import { SearchIcon, TrashIcon, CheckIcon, CloseIcon, DownloadIcon } from '../../components/Icons.jsx';
import { RequisitionPdfModal, downloadRequisitionPdf } from '../../components/RequisitionPdfModal.jsx';
import { DocumentViewerModal, resolvePortalDocumentUrl } from '../../components/InvoiceDocumentActions.jsx';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import { InventoryFilterSelect } from '../../components/InventoryFilterSelect.jsx';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { apiUploadMedia } from '../../api/client.js';
import jsPDF from 'jspdf';
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

/** @deprecated use normalizeOrgScopePart from utils/orgScope.js */
function normalizeMembershipScope(value) {
  return normalizeOrgScopePart(value);
}

function clerkVisibleRecords(records, actor) {
  return getClerkVisibleRecords(records, actor);
}

function clerkVisibleStockItems(state, actor) {
  return clerkVisibleRecords(state.stockItems, actor);
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
    const mine = requisitions || [];
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
        <InventoryFilterSelect
          value={exportMonth}
          onChange={setExportMonth}
          options={monthChoices}
        />
      </label>
      <label className={ui.clerkMaterialsRailExportField}>
        <span>{t('app.clerk.materialsExportCategory')}</span>
        <InventoryFilterSelect
          value={exportCategory}
          onChange={setExportCategory}
          options={[{ value: 'all', label: t('app.clerk.materialsExportAllCategories') }, ...categories.map(c => ({ value: c, label: c }))]}
        />
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

/** Group daily totals into slots (e.g. 3-day buckets for a 30-day view) to keep SVG point count manageable. */
function chartSeriesFromConsumptions(consumptions, totalDaysInput = 30, maxSlots = 12, stockItems = []) {
  const now = new Date();
  let totalDays = Number(totalDaysInput);

  if (totalDaysInput === 'all') {
    const allEvents = [...consumptions, ...stockItems];
    if (allEvents.length === 0) {
      totalDays = 30; // fallback
    } else {
      const earliest = allEvents.reduce((acc, c) => {
        const t = new Date(c.createdAt || c.updatedAt || Date.now()).getTime();
        return t < acc ? t : acc;
      }, now.getTime());
      totalDays = Math.max(7, Math.ceil((now.getTime() - earliest) / 86400000) + 1);
    }
  }

  const dailyBuckets = [];
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = startOfLocalDay(d);
    dailyBuckets.push({ key, date: d, added: 0, billed: 0, usage: 0, total: 0 });
  }

  const byKey = new Map(dailyBuckets.map((b) => [b.key, b]));
  consumptions.forEach((c) => {
    const key = startOfLocalDay(new Date(c.createdAt || c.updatedAt || Date.now()));
    const b = byKey.get(key);
    if (b) {
      const qty = Number(c.quantity || 0);
      const isOutflow = isBillConsumption(c) || c.consumptionKind === 'usage' || qty < 0;

      if (isOutflow) {
        const absQty = Math.abs(qty);
        if (isBillConsumption(c)) {
          b.billed += absQty;
        } else {
          b.usage += absQty;
        }
      } else {
        // This is a restock / addition (qty > 0 and not explicitly usage/bill)
        b.added += qty;
      }
      b.total += Math.abs(qty);
    }
  });

  // Note: We no longer include initial quantities from stockItems.forEach to avoid 
  // false spikes on creation/sync day. "Added" strictly tracks restocks in the movement feed.

  const currentStockTotal = stockItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
  
  // Calculate historical daily balances by walking backwards from today
  let rollingBalance = currentStockTotal;
  // We need to walk backwards from today's bucket to the oldest.
  // dailyBuckets is oldest -> newest, so we reverse it for the calculation loop.
  const reversedBuckets = [...dailyBuckets].reverse();
  reversedBuckets.forEach((b, idx) => {
    // b.balance is the balance AT THE END of that day.
    b.balance = rollingBalance;
    // For the NEXT iteration (which is the previous day), we subtract today's net change.
    // Net change today = Added - (Billed + Usage)
    rollingBalance -= (b.added - (b.billed + b.usage));
  });

  const slotSize = Math.ceil(totalDays / maxSlots);
  const slots = [];
  for (let i = 0; i < dailyBuckets.length; i += slotSize) {
    const chunk = dailyBuckets.slice(i, i + slotSize);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    const added = chunk.reduce((s, b) => s + b.added, 0);
    const billed = chunk.reduce((s, b) => s + b.billed, 0);
    const usage = chunk.reduce((s, b) => s + b.usage, 0);
    const total = chunk.reduce((s, b) => s + b.total, 0);
    // For the slot balance, we take the balance at the end of the last day in the chunk.
    const balance = last.balance;
    
    const label = chunk.length === 1 ? first.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `${first.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${last.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    slots.push({
      id: `slot_${first.key}`,
      added,
      billed,
      usage,
      balance,
      units: total,
      label,
      startMs: first.key,
      endMs: last.key
    });
  }

  return slots;
}

/** Compare units consumed last 7 days vs the previous 7 days. */
function consumptionWeekOverWeekDelta(consumptions) {
  const now = Date.now();
  const ms7 = 7 * 86400000;
  let recent = 0;
  let prior = 0;
  consumptions.forEach((c) => {
    // Only count outflows (usage or billing) for the week-over-week delta
    const isOutflow = isBillConsumption(c) || c.consumptionKind === 'usage' || Number(c.quantity || 0) < 0;
    if (!isOutflow) return;

    const t = new Date(c.createdAt).getTime();
    const q = Math.abs(Number(c.quantity || 0));
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
    id: `mov-${entry.id}`,
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
    const restock = entry.quantity > 0;
    const { recipient: billTo } = bill ? parseBillPurpose(entry.purpose) : { recipient: '' };
    events.push({
      sortTime: new Date(entry.createdAt).getTime(),
    id: `use_${entry.id}`,
      kind: bill ? 'bill' : restock ? 'restock' : 'usage',
    time: formatDate(entry.createdAt),
      title: bill ? `${entry.itemName} billed` : restock ? `${entry.itemName} added` : `${entry.itemName} used`,
      meta: bill
        ? `${Math.abs(entry.quantity)} ${entry.unit} · ${billTo}${entry.relatedRequisitionId ? ` · Req ${entry.relatedRequisitionId}` : ''}`
        : `${Math.abs(entry.quantity)} ${entry.unit} · ${entry.purpose}${entry.relatedRequisitionId ? ` · Req ${entry.relatedRequisitionId}` : ''}`,
      tag: bill ? 'Billed' : restock ? 'Restock' : 'Consumed',
    tone: restock ? 'ok' : 'neutral',
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



function niceCeilAxisMax(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = 10 ** exp;
  const f = x / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * base;
}

function niceTickStepCounts(axisMax, maxTicks = 5) {
  if (axisMax <= 0) return 1;
  // Use fixed 500 interval for inventory dashboard as requested
  if (axisMax <= 5000) return 500;
  const rough = Math.ceil(axisMax / maxTicks);
  const pow10 = 10 ** Math.floor(Math.log10(rough));
  const r = rough / pow10;
  const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
  return nice * pow10;
}

function buildCountAxisTicks(axisMax, yBottom, valueSpan) {
  const max = Math.max(1, Number(axisMax) || 1);
  const step = niceTickStepCounts(max, 5);
  const values = [];
  for (let v = 0; v < max; v += step) values.push(v);
  if (values.length === 0 || values[values.length - 1] !== max) values.push(max);
  return values.map((value) => ({
    value,
    y: yBottom - (value / max) * valueSpan,
  }));
}

function linearPathFromPoints(points) {
  if (points.length < 2) return '';
  const xAt = (p) => p.x ?? p.plotX;
  const yAt = (p) => p.y;
  let d = `M ${xAt(points[0])} ${yAt(points[0])}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${xAt(points[i])} ${yAt(points[i])}`;
  }
  return d;
}

const CLERK_VELOCITY_PAD_X = 40; 
const CLERK_VELOCITY_Y_TOP = 10;
const CLERK_VELOCITY_VB_W = 400;

export const ClerkDashboard = React.memo(function ClerkDashboard() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [timeRange, setTimeRange] = useState('all');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const clerkVelocitySvgRef = useRef(null);
  const actor = useClerkActor(state, user);

  // scopeComplete is true when the clerk profile has both location AND department set.
  // Without both fields, clerkVisibleRecords falls back to personal-only visibility,
  // which means clerks in the same dept/location see different subsets → split dashboards.
  const scopeComplete = Boolean(
    normalizeMembershipScope(actor?.location) &&
    normalizeMembershipScope(actor?.department || actor?.team)
  );

  const dashboardMetrics = useMemo(() => {
    const clerkId = actor?.id;
    const items = clerkVisibleStockItems(state, actor);
    const requisitions = clerkVisibleRecords(state.requisitions, actor);
    const alerts = notificationsForRole(state, 'clerk', user?.id);
    const consumptions = clerkVisibleRecords(state.consumptions, actor);
    const usageForTrends = consumptions;

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
      (entry) => new Date(entry.requestedAt || entry.createdAt || entry.updatedAt || Date.now()).getTime() >= monthStart
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
    const chartBars = chartSeriesFromConsumptions(usageForTrends, timeRange, 12, items);
    
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
  // Include actor.location and actor.department in the dep array so the dashboard
  // correctly recomputes when these profile fields are updated, and so all clerks
  // with the same location+department arrive at the same shared scope computation.
  }, [actor?.id, actor?.location, actor?.department, actor?.team, state.stockItems, state.requisitions, state.consumptions, state.notifications, state.users, timeRange]);

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

  const { trendAdded, trendBilled, trendBalance } = useMemo(() => {
    return {
      trendAdded: chartBars.map((b) => b.added),
      trendBilled: chartBars.map((b) => b.billed + b.usage),
      trendBalance: chartBars.map((b) => b.balance),
    };
  }, [chartBars]);

  const chartMaxUnits = useMemo(() => {
    if (!trendAdded.length) return 0;
    return Math.max(...trendAdded, ...trendBilled, ...trendBalance);
  }, [trendAdded, trendBilled, trendBalance]);
  const clerkVelocityAxisMax = useMemo(
    () => (Math.ceil(chartMaxUnits / 500) || 1) * 500 + 500,
    [chartMaxUnits]
  );

  const CLERK_VELOCITY_VB_H = Math.min(1200, (clerkVelocityAxisMax / 500) * 100 + 20);
  const CLERK_VELOCITY_Y_BOTTOM = CLERK_VELOCITY_VB_H - 10;
  const CLERK_VELOCITY_Y_SPAN = CLERK_VELOCITY_Y_BOTTOM - CLERK_VELOCITY_Y_TOP;

  const getCurveData = (key) => {
    const n = chartBars.length;
    if (!n) return [];
    const denom = n > 1 ? n - 1 : 1;
    return chartBars.map((b, i) => {
      const units = key === 'balance' ? trendBalance[i] : key === 'billed' ? trendBilled[i] : trendAdded[i];
      const norm = clerkVelocityAxisMax > 0 ? units / clerkVelocityAxisMax : 0;
      const innerW = CLERK_VELOCITY_VB_W - CLERK_VELOCITY_PAD_X * 2;
      const plotX = CLERK_VELOCITY_PAD_X + (n > 1 ? (i / denom) * innerW : innerW / 2);
      const pctX = (plotX / CLERK_VELOCITY_VB_W) * 100;
      return {
        plotX,
        pctX,
        y: CLERK_VELOCITY_Y_BOTTOM - norm * CLERK_VELOCITY_Y_SPAN,
      };
    });
  };

  const curveDataBalance = useMemo(() => getCurveData('balance'), [chartBars, clerkVelocityAxisMax]);
  const curveDataBilled = useMemo(() => getCurveData('billed'), [chartBars, clerkVelocityAxisMax]);
  const curveDataAdded = useMemo(() => getCurveData('added'), [chartBars, clerkVelocityAxisMax]);

  const linePathBalance = useMemo(() => linearPathFromPoints(curveDataBalance), [curveDataBalance]);
  const linePathBilled = useMemo(() => linearPathFromPoints(curveDataBilled), [curveDataBilled]);
  const linePathAdded = useMemo(() => linearPathFromPoints(curveDataAdded), [curveDataAdded]);

  const clerkVelocityYTicks = useMemo(
    () => buildCountAxisTicks(clerkVelocityAxisMax, CLERK_VELOCITY_Y_BOTTOM, CLERK_VELOCITY_Y_SPAN),
    [clerkVelocityAxisMax, CLERK_VELOCITY_Y_BOTTOM, CLERK_VELOCITY_Y_SPAN]
  );

  const getAreaPath = (curveData) => {
    if (curveData.length < 2) return '';
    const firstX = curveData[0].plotX;
    const lastX = curveData[curveData.length - 1].plotX;
    return `${linearPathFromPoints(curveData)} L ${lastX} ${CLERK_VELOCITY_Y_BOTTOM} L ${firstX} ${CLERK_VELOCITY_Y_BOTTOM} Z`;
  };

  const areaPathBalance = useMemo(() => getAreaPath(curveDataBalance), [curveDataBalance]);
  const areaPathBilled = useMemo(() => getAreaPath(curveDataBilled), [curveDataBilled]);
  const areaPathAdded = useMemo(() => getAreaPath(curveDataAdded), [curveDataAdded]);

  return (
    <div className={ui.clerkBoard}>
      {!scopeComplete && (
        <div
          role="alert"
          style={{
            background: 'linear-gradient(90deg, #780b23 0%, #b91c3c 100%)',
            color: '#fff',
            borderRadius: '10px',
            padding: '0.9rem 1.2rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            boxShadow: '0 2px 12px rgb(120 11 35 / 0.22)',
          }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M12 4 20 19H4L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
          <span>
            <strong>Dashboard scope incomplete.</strong>&nbsp;Your profile is missing a&nbsp;
            {!normalizeMembershipScope(actor?.location) ? <strong>Location</strong> : null}
            {!normalizeMembershipScope(actor?.location) && !normalizeMembershipScope(actor?.department || actor?.team) ? ' and ' : null}
            {!normalizeMembershipScope(actor?.department || actor?.team) ? <strong>Department</strong> : null}.
            &nbsp;Without these, you only see your personally created items — not the shared pool with your colleagues.
            &nbsp;Ask your administrator to update your profile.
          </span>
          <button
            type="button"
            onClick={() => navigate('/app/clerk/account-settings')}
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff',
              borderRadius: '6px',
              padding: '0.35rem 0.85rem',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            My Profile
          </button>
        </div>
      )}
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
          {scopeComplete && (
            <p style={{ fontSize: '0.75rem', color: 'var(--ec-muted)', marginTop: '0.2rem' }}>
              Shared pool: <strong>{normalizeMembershipScope(actor?.location)}</strong> · <strong>{normalizeMembershipScope(actor?.department || actor?.team)}</strong>
            </p>
          )}
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
                  onClick={() => navigate('/app/clerk/inventory?status=lowAndOut')}
                  title="View Low & Out of Stock"
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
                <h2 className={ui.clerkSectionTitle}>Inventory Trends</h2>
                <p className={ui.clerkSectionSub}>
                  {timeRange === 'all' ? 'Tracking cumulative stock levels and daily activity (All Time).' : `Tracking cumulative stock levels and daily activity (last ${timeRange} days).`}
                </p>
              </div>
              <div className={ui.clerkRangePills}>
                {[7, 30, 90, 'all'].map((d) => (
                  <button 
                    key={d}
                    type="button" 
                    className={timeRange === d ? ui.clerkRangePillBtnActive : ui.clerkRangePillBtn}
                    onClick={() => setTimeRange(d)}
                  >
                    {d === 'all' ? 'All' : `${d} D`}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={ui.clerkChartContainer}>
              <div className={ui.supervisorTrendLegend}>
                <div className={ui.supervisorTrendLegendItem} title="Total items currently in stock at this point in time">
                  <span className={ui.supervisorTrendLegendColor} style={{ backgroundColor: 'var(--ec-primary)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ec-text)' }}>Total Stock</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--ec-muted)', marginTop: '-2px' }}>Cumulative units on hand</span>
                  </div>
                </div>
                <div className={ui.supervisorTrendLegendItem} title="Items that have been officially billed/invoiced">
                  <span className={ui.supervisorTrendLegendColor} style={{ backgroundColor: '#10b981' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ec-text)' }}>Billed/Usage</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--ec-muted)', marginTop: '-2px' }}>Total recorded outflow</span>
                  </div>
                </div>
                <div className={ui.supervisorTrendLegendItem} title="New items added to stock via requisitions or intake">
                  <span className={ui.supervisorTrendLegendColor} style={{ backgroundColor: '#f59e0b' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ec-text)' }}>Added</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--ec-muted)', marginTop: '-2px' }}>Inventory replenishment</span>
                  </div>
                </div>
              </div>
              <div className={ui.lineChartPlot}>
                <div className={ui.lineChartMain}>
                  <svg
                    ref={clerkVelocitySvgRef}
                    viewBox={`0 0 ${CLERK_VELOCITY_VB_W} ${CLERK_VELOCITY_VB_H}`}
                    style={{ fontFamily: 'inherit', height: `${CLERK_VELOCITY_VB_H}px`, minHeight: '160px' }}
                    className={ui.clerkChartSvg}
                    preserveAspectRatio="none"
                    onMouseMove={(e) => {
                      if (!curveDataBalance.length) return;
                      const el = clerkVelocitySvgRef.current;
                      if (!el) return;
                      const r = el.getBoundingClientRect();
                      const px = e.clientX - r.left;
                      const w = r.width || 1;
                      const x = (px / w) * CLERK_VELOCITY_VB_W;
                      let bestI = 0;
                      let bestD = Number.POSITIVE_INFINITY;
                      for (let i = 0; i < curveDataBalance.length; i += 1) {
                        const d = Math.abs((curveDataBalance[i]?.plotX ?? 0) - x);
                        if (d < bestD) {
                          bestD = d;
                          bestI = i;
                        }
                      }
                      const h = el.clientHeight ?? 0;
                      const y = curveDataBalance[bestI]?.y ?? 0;
                      const tooltipTopPx = h > 0 ? (y / CLERK_VELOCITY_VB_H) * h : null;
                      setHoveredPoint({
                        ...curveDataBalance[bestI],
                        ...chartBars[bestI],
                        idx: bestI,
                        tooltipTopPx,
                      });
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id="clerkTrendFillUsage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--ec-primary)" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="var(--ec-primary)" stopOpacity="0.01" />
                      </linearGradient>
                      <linearGradient id="clerkTrendFillBilled" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                      </linearGradient>
                      <linearGradient id="clerkTrendFillAdded" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    {clerkVelocityYTicks.map((tk, i) => (
                      <g key={i}>
                        <line
                          x1={CLERK_VELOCITY_PAD_X}
                          y1={tk.y}
                          x2={400 - CLERK_VELOCITY_PAD_X}
                          y2={tk.y}
                          stroke="var(--ec-chart-grid)"
                          strokeWidth="0.35"
                          strokeDasharray="2 2"
                          vectorEffect="non-scaling-stroke"
                        />
                        <text
                          x={CLERK_VELOCITY_PAD_X - 6}
                          y={tk.y}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fontSize="10"
                          fill="var(--ec-text)"
                          style={{ 
                            fontWeight: 800, 
                            pointerEvents: 'none',
                            fontFamily: 'var(--ec-font-sans)',
                            letterSpacing: '-0.04em'
                          }}
                        >
                          {Math.round(tk.value).toLocaleString()}
                        </text>
                      </g>
                    ))}

                    <line
                      x1={CLERK_VELOCITY_PAD_X}
                      y1={CLERK_VELOCITY_Y_TOP}
                      x2={CLERK_VELOCITY_PAD_X}
                      y2={CLERK_VELOCITY_Y_BOTTOM}
                      stroke="var(--ec-chart-axis)"
                      strokeWidth="0.55"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={CLERK_VELOCITY_PAD_X}
                      y1={CLERK_VELOCITY_Y_BOTTOM}
                      x2={400 - CLERK_VELOCITY_PAD_X}
                      y2={CLERK_VELOCITY_Y_BOTTOM}
                      stroke="var(--ec-chart-axis)"
                      strokeWidth="0.55"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Total Stock Series */}
                    <path d={areaPathBalance} fill="url(#clerkTrendFillUsage)" />
                    <path
                      d={linePathBalance}
                      fill="none"
                      stroke="var(--ec-primary)"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Billed Series */}
                    <path d={areaPathBilled} fill="url(#clerkTrendFillBilled)" />
                    <path
                      d={linePathBilled}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Added Series */}
                    <path d={areaPathAdded} fill="url(#clerkTrendFillAdded)" />
                    <path
                      d={linePathAdded}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>

                  {hoveredPoint && (
                    <div
                      className={ui.clerkChartTooltip}
                      style={{
                        left: `${hoveredPoint.pctX}%`,
                        ...(hoveredPoint.tooltipTopPx != null ? { top: `${hoveredPoint.tooltipTopPx}px` } : {}),
                        transform: 'translateX(-50%) translateY(-100%)',
                        marginTop: '-10px',
                        width: 'max-content',
                        padding: '0.6rem'
                      }}
                    >
                      <div className={ui.clerkChartTooltipLabel} style={{ marginBottom: '0.3rem', fontWeight: 800 }}>{hoveredPoint.label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem' }}>
                        <div style={{ color: 'var(--ec-primary)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <span>Total Stock:</span>
                          <strong>{Math.round(hoveredPoint.balance).toLocaleString()}</strong>
                        </div>
                        <div style={{ color: '#10b981', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <span>Billed/Usage:</span>
                          <strong>{Math.round(trendBilled[hoveredPoint.idx] || 0).toLocaleString()}</strong>
                        </div>
                        <div style={{ color: '#f59e0b', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <span>Added:</span>
                          <strong>{Math.round(hoveredPoint.added).toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={ui.clerkChartXLabels} aria-hidden>
                    {chartBars.map((entry, i) => (
                      <span key={entry.id} className={ui.clerkChartXLabel} style={{ left: `${curveDataBalance[i]?.pctX ?? 0}%` }}>
                        {entry.label}
                      </span>
                    ))}
                  </div>
                </div>
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
              <span>Record usage</span>
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
});

/** Row + filter label: prefer subcategory; healthcare companies use canonical category buckets. */
function inventoryCategoryLabel(item, company) {
  const c = String(item.category || '').trim();
  const catLabel = c ? categoryFilterOptionLabel(c, company) : 'Uncategorized';
  const sub = String(item.subcategory || '').trim();
  if (sub) return `${catLabel} (${sub})`;
  return catLabel;
}



export function ClerkBillItemModal({ isOpen, onClose }) {
  const { t } = useI18n();
  const { state, consumeStockItem } = usePortalData();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const useHealthcare = isHealthcareCompany(state.company);

  const categories = useMemo(() => {
    if (useHealthcare) return ['All', ...HEALTHCARE_STOCK_CATEGORIES];
    return ['All', 'Laboratory', 'Consumables', 'Medications', 'Sanitation', 'Office materials', 'Others'];
  }, [useHealthcare]);

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [basket, setBasket] = useState([]); // { itemId, quantity, name, unit, price, max }
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // 'ok' | 'err' | null
  const [error, setError] = useState('');

  const stockItems = useMemo(() => {
    return clerkVisibleStockItems(state, actor);
  }, [state.stockItems, state.users, actor?.id, actor?.location, actor?.department, actor?.team]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return stockItems.filter((s) => {
      let matchesCat = true;
      if (activeCategory !== 'All') {
        if (useHealthcare) {
          matchesCat = normalizeToHealthcareCategory(s.category) === activeCategory;
        } else if (activeCategory === 'Others') {
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
  }, [stockItems, activeCategory, searchQuery, categories, useHealthcare]);

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
    setSaveResult(null);
    try {
      for (const entry of basket) {
        await consumeStockItem({
          itemId: entry.itemId,
          quantity: entry.quantity,
          purpose: 'Billed to patient/procedure',
          consumptionKind: 'bill',
        }, actor.id);
      }
      setSaveResult('ok');
      setBasket([]);
      setTimeout(() => {
        setSaveResult(null);
        onClose();
      }, 1500);
    } catch (ex) {
      setError(ex.message);
      setSaveResult('err');
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
              className={`${ui.checkoutSaveBtn} ${saving ? ui.checkoutSaveBtnSaving : ''} ${saveResult === 'ok' ? ui.checkoutSaveBtnSuccess : ''} ${saveResult === 'err' ? ui.checkoutSaveBtnError : ''}`}
              onClick={handleSave}
              disabled={saving || !basket.length}
            >
              {saving ? '...' : saveResult === 'ok' ? 'SAVED' : saveResult === 'err' ? 'FAILED' : <><span style={{ fontSize: '1.1rem' }}>+</span> SAVE</>}
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
                    {item.unit || (item.price ? `${item.price.toLocaleString()} RWF` : 'Unit')}
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
                  <p className={ui.checkoutBasketMeta}>{item.unit || (item.price ? `${item.price.toLocaleString()} RWF` : 'Unit')}</p>
                </div>
                <div className={ui.checkoutQtyControl}>
                  <button type="button" onClick={() => updateQty(item.itemId, -1)}>−</button>
                  <input
                    type="number"
                    className={ui.checkoutQtyVal}
                    value={item.quantity}
                    min={1}
                    max={item.max}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setBasket((prev) => prev.map((i) => i.itemId === item.itemId ? { ...i, quantity: '' } : i));
                        return;
                      }
                      const n = parseInt(raw, 10);
                      if (!isNaN(n)) {
                        setBasket((prev) => prev.map((i) => i.itemId === item.itemId ? { ...i, quantity: Math.max(1, Math.min(i.max, n)) } : i));
                      }
                    }}
                    onBlur={() => {
                      setBasket((prev) => prev.map((i) => {
                        if (i.itemId === item.itemId) {
                          const clamped = Math.max(1, Math.min(i.max, Number(i.quantity) || 1));
                          return { ...i, quantity: clamped };
                        }
                        return i;
                      }));
                    }}
                  />
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

export const ClerkInventory = React.memo(function ClerkInventory() {
  const { t } = useI18n();
  const { state, deleteStockItem } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const items = clerkVisibleStockItems(state, actor);
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('status') || 'all';
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingItem, setDeletingItem] = useState(null);
  const shellSearch = useShellSearchQuery();
  const selectAllRef = useRef(null);

  const RECOMMENDATIONS_PAGE = 9;
  const recommendationIdsKey = useMemo(
    () => (state.masterStock || []).map((m) => m._id).join(','),
    [state.masterStock]
  );
  const [recSearch, setRecSearch] = useState('');
  const [recVisibleCount, setRecVisibleCount] = useState(RECOMMENDATIONS_PAGE);
  useEffect(() => {
    setRecVisibleCount(RECOMMENDATIONS_PAGE);
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
  const recCanLess = recVisible > RECOMMENDATIONS_PAGE;

  const categories = useMemo(() => {
    if (isHealthcareCompany(state.company)) return HEALTHCARE_STOCK_CATEGORIES;
    return [...new Set(items.map((item) => item.category).filter(Boolean))].sort();
  }, [state.company, items]);

  const categorySelectOptions = useMemo(
    () => [
      { value: 'all', label: 'All Categories' },
      ...categories.map((category) => ({
        value: category,
        label: categoryFilterOptionLabel(category, state.company),
      })),
    ],
    [categories, state.company],
  );

  const statusSelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Any Status' },
      { value: 'low', label: 'Low Stock' },
      { value: 'out', label: 'Out of Stock' },
      { value: 'lowAndOut', label: 'Low / Out of Stock' },
      { value: 'expiry', label: 'With Expiry' },
    ],
    [],
  );

  const filteredItems = items.filter((item) => {
    const tokens = [query, shellSearch]
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean);
    const hay = `${item.name} ${item.sku || ''} ${item.category || ''} ${item.subcategory || ''} ${inventoryCategoryLabel(item, state.company)}`.toLowerCase();
    const matchesQuery = tokens.length === 0 || tokens.every((tok) => hay.includes(tok));
    if (!matchesQuery) return false;
    if (categoryFilter !== 'all') {
      if (isHealthcareCompany(state.company)) {
        if (normalizeToHealthcareCategory(item.category) !== categoryFilter) return false;
      } else if (item.category !== categoryFilter) return false;
    }
    if (filter === 'low') return stockStatus(item) === 'Low stock';
    if (filter === 'out') return stockStatus(item) === 'Out of stock';
    if (filter === 'lowAndOut') {
      const status = stockStatus(item);
      return status === 'Low stock' || status === 'Out of stock';
    }
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
      Category: inventoryCategoryLabel(item, state.company),
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
  const isLowAndOutFilter = filter === 'lowAndOut';

  function addSelectedToRequisition() {
    const lines = selectedItems.map((item) => {
      const currentQty = Number(item.quantity || 0);
      const minQty = Math.max(1, Number(item.minThreshold || 1));
      return {
        ...newMaterialReqLine(),
        description: item.name || '',
        dateValue: '',
        quantityRequested: Math.max(1, minQty - currentQty),
        quantityReceived: '',
        unit: item.unit || 'units',
      };
    });
    navigate('/app/clerk/materials', { state: { prefillReqLines: lines } });
  }

  function handleDeleteItem(item) {
    if (!item?.id) return;
    setDeletingItem(item);
  }

  return (
    <div className={ui.inventoryBoard}>
      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title="Delete Item"
        message={`Delete "${deletingItem?.name}"? This cannot be undone.`}
        confirmText="Delete"
        onConfirm={async () => {
          setDeleteError('');
          try {
            await deleteStockItem(deletingItem.id);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(deletingItem.id);
              return next;
            });
            if (selectedDetailItem?.id === deletingItem.id) setSelectedDetailItem(null);
          } catch (e) {
            setDeleteError(e?.message || 'Failed to delete item.');
            throw e;
          }
        }}
        onClose={() => setDeletingItem(null)}
      />
      <div className={ui.inventoryHeader}>
        <h1 className={ui.inventoryTitle}>{t('app.clerk.inventoryTitle')}</h1>
        <div className={ui.inventoryHeaderSub}>
          <div className={ui.inventoryLeadBlock}>
            <p className={ui.inventoryLead}>{t('app.clerk.inventoryLead')}</p>
            <Link to="/terms" className={ui.inventoryLegalLink}>
              {t('shell.termsAndConditions')}
            </Link>
          </div>
          <button type="button" className={ui.inventoryDownloadBtn} onClick={() => downloadXlsx(filteredItems)}>
            <DownloadIcon />
            <span>{t('app.clerk.downloadXlsx')}</span>
          </button>
        </div>
      </div>

      <div className={ui.inventoryFilterRow}>
        <label className={ui.inventoryFilter}>
          <span>Category:</span>
          <InventoryFilterSelect value={categoryFilter} onChange={setCategoryFilter} options={categorySelectOptions} />
        </label>

        <label className={ui.inventoryFilter}>
          <span>Status:</span>
          <InventoryFilterSelect value={filter} onChange={setFilter} options={statusSelectOptions} />
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

      {deleteError ? <p className={ui.formError}>{deleteError}</p> : null}

      {selectedIds.size > 0 ? (
        <div className={ui.inventorySelectionBar} role="status">
          <span className={ui.inventorySelectionMeta}>
            {t('app.clerk.inventorySelectedCount', { count: selectedIds.size })}
          </span>
          <button
            type="button"
            className={ui.inventorySelectionBtn}
            onClick={isLowAndOutFilter ? addSelectedToRequisition : () => downloadXlsx(selectedItems)}
          >
            {isLowAndOutFilter ? 'Add selected to requisition' : t('app.clerk.downloadSelectedXlsx')}
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
            const minT = Number(item.minThreshold);
            const maxT = Number(item.maxThreshold);
            const minLabel = Number.isFinite(minT) && minT > 0 ? minT : '—';
            const maxLabel = Number.isFinite(maxT) && maxT > 0 ? maxT : '—';

            const pendingRequest = (state.stockEditRequests || []).find(
              (r) => r.stockItemId === item.id && r.status === 'pending'
            );
            const itemCreatedAt = item.createdAt || item.updatedAt || new Date();
            const isOlderThan24h = (new Date() - new Date(itemCreatedAt)) > 24 * 60 * 60 * 1000;

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
                    <p className={ui.inventoryItemMeta}>
                      SKU: {item.sku || '—'}
                      {pendingRequest && (
                        <span className={`${ui.badge} ${ui.badgeWarn}`} style={{ fontSize: '0.65rem', marginLeft: '0.6rem', padding: '0.1rem 0.35rem' }}>
                          Pending Approval
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className={ui.inventoryCategoryCell}>
                  <span className={ui.inventoryCategoryPill}>{inventoryCategoryLabel(item, state.company)}</span>
                </div>

                <div className={`${ui.inventoryLevelCell} ${ui.inventoryLevelCellSlim}`}>
                  <div className={ui.inventoryLevelNumbers}>
                    <strong>{item.quantity}</strong>
                    <span>/ {maxLabel}</span>
                    <span style={{ marginLeft: '0.5rem', color: 'var(--ec-muted)', fontSize: '0.72rem' }}>
                      min {minLabel}
                    </span>
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
                  <button
                    type="button"
                    className={ui.inventoryActionBtn}
                    aria-label={`Delete ${item.name}`}
                    title={isOlderThan24h ? `Cannot delete items older than 24 hours` : `Delete ${item.name}`}
                    disabled={deleteBusyId === item.id || isOlderThan24h}
                    onClick={() => handleDeleteItem(item)}
                  >
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

        <div className={ui.inventoryRecommendationsSection}>
          <div className={ui.sectorRecommendations}>
            <h3 className={ui.sectorRecommendationsTitle}>
              Recommended for {state.company?.type || 'Healthcare'}
            </h3>
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
                              window.dispatchEvent(
                                new CustomEvent('ecunga-open-add-item-modal', { detail: { prefillMaster: m } })
                              )
                            }
                          >
                            Add to My Stock
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
                              setRecVisibleCount((c) => Math.max(RECOMMENDATIONS_PAGE, c - RECOMMENDATIONS_PAGE))
                            }
                          >
                            {t('listings.viewLess')}
                          </button>
                        ) : null}
                        {recCanMore ? (
                          <button
                            type="button"
                            className={ui.sectorRecommendationsToggleBtn}
                            onClick={() =>
                              setRecVisibleCount((c) => Math.min(recTotal, c + RECOMMENDATIONS_PAGE))
                            }
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
              <p className={ui.sectorRecommendationsEmpty}>No recommendations found for your sector yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

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
  if (status === 'closed') return 'Closed';
  if (status === 'rejected') return 'Rejected';
  if (status === 'draft') return 'Draft';
  if (status === 'cancelled') return 'Cancelled';
  if (
    [
      'approved',
      'approvedExternal',
      'sentToSupplier',
      'proformaAwaitingClerk',
      'proformaReceived',
      'proformaApproved',
      'paid',
      'creditPurchase',
      'creditAndPaid',
      'deliveryNoteAttached',
    ].includes(status)
  ) {
    return 'Approved';
  }
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

function clerkSafeDocUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return t.startsWith('/') ? t : `/${t}`;
}

function clerkResolveDocUrl(url) {
  return resolvePortalDocumentUrl(url) || clerkSafeDocUrl(url);
}

/** After payment or credit release: clerk may upload delivery note (not yet attached). */
function invoiceForClerkDeliveryNoteUpload(invoices, requisitionId) {
  return (invoices || []).find(
    (i) =>
      i.requisitionId === requisitionId &&
      ['paid', 'creditPurchase'].includes(i.status) &&
      !String(i.deliveryNoteUrl || '').trim()
  );
}

function deliveryNoteUrlForClerkRequisition(invoices, requisitionId) {
  const rid = String(requisitionId || '').trim();
  if (!rid) return '';
  const inv = (invoices || []).find((i) => {
    const ir = String(i.requisitionId || i.stockRequestId || '').trim();
    return ir === rid && String(i.deliveryNoteUrl || '').trim();
  });
  return String(inv?.deliveryNoteUrl || '').trim();
}

/** Supplier official invoice URL for this requisition (same invoice row is updated from proforma → final on the server). */
function proformaUrlForClerkRequisition(invoices, requisitionId) {
  const rid = String(requisitionId || '').trim();
  if (!rid) return '';
  for (const inv of invoices || []) {
    const ir = String(inv.requisitionId || inv.stockRequestId || '').trim();
    if (ir !== rid) continue;
    const url = String(inv.attachmentUrl || '').trim();
    if (url) return url;
  }
  return '';
}

function finalInvoiceUrlForClerkRequisition(invoices, requisitionId) {
  const rid = String(requisitionId || '').trim();
  if (!rid) return '';
  for (const inv of invoices || []) {
    const ir = String(inv.requisitionId || inv.stockRequestId || '').trim();
    if (ir !== rid) continue;
    const fi = String(inv.finalInvoiceUrl || '').trim();
    if (fi) return fi;
  }
  return '';
}

export function ClerkMaterials({ setRailSlot }) {
  const { t } = useI18n();
  const { showFlash } = useFlash();
  const {
    state,
    createRequisition,
    clerkProformaReview,
    clerkUploadExternalProforma,
    attachDeliveryNote,
    submitAutoDraft,
    updateAutoDraftLines,
    cancelAutoDraft,
  } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const actor = useClerkActor(state, user);
  const items = useMemo(
    () => clerkVisibleStockItems(state, actor),
    [state.stockItems, state.users, actor?.id, actor?.location, actor?.department, actor?.team]
  );
  const priorityMeta = [
    { id: 'low', label: 'Low', copy: 'Standard restocking, 3-5 business days.' },
    { id: 'medium', label: 'Medium', copy: 'Required for upcoming tasks, 1-2 business days.' },
    { id: 'high', label: 'High', copy: 'Production bottleneck potential, 24-hour fulfillment.' },
    { id: 'urgent', label: 'Urgent', copy: 'Critical line stoppage, immediate dispatch.' },
  ];
  const [err, setErr] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [department, setDepartment] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [reqLines, setReqLines] = useState(() => [newMaterialReqLine()]);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [form, setForm] = useState({ priority: 'low', reason: '' });
  const [exportMonth, setExportMonth] = useState('');
  const [exportCategory, setExportCategory] = useState('all');
  const [reqFilter, setReqFilter] = useState('all');
  const [reqSearch, setReqSearch] = useState('');
  const [selectedReqForPdf, setSelectedReqForPdf] = useState(null);
  const [selectedReqForEdit, setSelectedReqForEdit] = useState(null);
  const [clerkDocPreview, setClerkDocPreview] = useState(null);
  const [externalUploadReq, setExternalUploadReq] = useState(null);
  const deliveryNoteInputRef = useRef(null);
  const deliveryNoteTargetReqIdRef = useRef(null);
  const [deliveryNoteUploadingReqId, setDeliveryNoteUploadingReqId] = useState(null);
  useEffect(() => {
    const preferredDepartment = String(actor?.department || actor?.team || '').trim();
    if (!preferredDepartment) return;
    setDepartment((prev) => (String(prev || '').trim() ? prev : preferredDepartment));
  }, [actor?.department, actor?.team]);

  useEffect(() => {
    const prefill = location.state?.prefillReqLines;
    if (!prefillApplied && Array.isArray(prefill) && prefill.length > 0) {
      setReqLines(prefill.map((line) => ({ ...newMaterialReqLine(), ...line })));
      setPrefillApplied(true);
    }
  }, [location.state?.prefillReqLines, prefillApplied]);

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
    let list = clerkVisibleRecords(state.requisitions, actor);
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
  }, [state.requisitions, actor?.id, actor?.location, actor?.department, actor?.team, reqFilter, reqSearch]);

  useEffect(() => {
    if (typeof setRailSlot !== 'function') return undefined;
    setRailSlot(
      <ClerkMaterialsRailExport
        t={t}
        stockItems={items}
        requisitions={clerkVisibleRecords(state.requisitions, actor)}
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

  function openClerkDeliveryNotePicker(requisitionId) {
    deliveryNoteTargetReqIdRef.current = requisitionId;
    deliveryNoteInputRef.current?.click();
  }

  async function onClerkDeliveryNoteFileChange(ev) {
    const file = ev.target.files?.[0];
    const reqId = deliveryNoteTargetReqIdRef.current;
    ev.target.value = '';
    deliveryNoteTargetReqIdRef.current = null;
    if (!file || !reqId) return;

    const okType = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!okType) {
      showFlash('Please choose a PDF file.', 'warn');
      return;
    }

    const inv = invoiceForClerkDeliveryNoteUpload(state.invoices, reqId);
    if (!inv) {
      showFlash('Delivery note can be uploaded after finance marks this request as paid.', 'warn');
      return;
    }

    setDeliveryNoteUploadingReqId(reqId);
    showFlash(t('app.clerk.deliveryNoteToastUploading'), 'loading');
    try {
      const resp = await apiUploadMedia(file);
      const url = resp?.secure_url || resp?.url;
      if (!url) throw new Error('Upload did not return a file URL.');
      await attachDeliveryNote(inv.id, url, actor?.id);
      showFlash(t('app.clerk.deliveryNoteToastSuccess'), 'ok');
    } catch (e) {
      showFlash(e.message || t('app.clerk.deliveryNoteToastError'), 'error');
    } finally {
      setDeliveryNoteUploadingReqId(null);
    }
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
      showFlash(t('app.clerk.requisitionErrorLines'), 'warn');
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
    setReqSubmitting(true);
    showFlash(t('app.clerk.requisitionToastSubmitting'), 'loading');
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
      showFlash(t('app.clerk.requisitionToastSuccess'), 'ok');
    } catch (ex) {
      setErr(ex.message);
      setSubmitted(false);
      showFlash(ex.message || t('app.clerk.requisitionToastError'), 'error');
    } finally {
      setReqSubmitting(false);
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
                <InventoryFilterSelect
                  value={form.priority}
                  onChange={(val) => {
                    setForm({ ...form, priority: val });
                    setSubmitted(false);
                  }}
                  options={priorityMeta.map((p) => ({ value: p.id, label: p.label }))}
                />
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
            <button type="submit" className={ui.materialsSubmitBtn} disabled={reqSubmitting} aria-busy={reqSubmitting}>
                {reqSubmitting ? t('app.clerk.requisitionSubmitting') : t('app.clerk.requisitionSubmit')}
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
          <input
            ref={deliveryNoteInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className={ui.visuallyHidden}
            aria-hidden
            tabIndex={-1}
            onChange={onClerkDeliveryNoteFileChange}
          />
          <p className={ui.materialsGuideEyebrow}>Request status</p>
          <div className={ui.materialsRequestStatusHead}>
            <h2 className={ui.materialsRequestStatusTitle}>Approved, Pending, and Rejected requests</h2>
            <span className={ui.materialsRequestStatusMeta}>
              {filteredMyRequisitions.length} {filteredMyRequisitions.length === 1 ? 'request' : 'requests'}
            </span>
          </div>

          <div className={ui.materialsTableToolbar}>
            <div className={ui.materialsFilterGroup}>
              {['all', 'draft', 'pending', 'approved', 'rejected'].map((f) => (
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
                    const proformaUrl = proformaUrlForClerkRequisition(state.invoices, req.id);
                    const finalInvoiceUrl = finalInvoiceUrlForClerkRequisition(state.invoices, req.id);
                    const statusBucket = req.status === 'closed' ? 'Closed' : requestStatusBucket(req.status);
                    const isApproved = requestStatusBucket(req.status) === 'Approved' || req.status === 'closed';
                    const stockState = requestStockState(req, items);
                    const qtyRequested = (req.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0);
                    const reqIdNorm = String(req.id || '').trim();
                    const proforma =
                      (state.invoices || []).find(
                        (inv) =>
                          String(inv.requisitionId || inv.stockRequestId || '').trim() === reqIdNorm &&
                          inv.type === 'proforma'
                      ) ||
                      (state.invoices || []).find(
                        (inv) =>
                          String(inv.requisitionId || inv.stockRequestId || '').trim() === reqIdNorm &&
                          inv.type === 'final' &&
                          String(inv.attachmentUrl || '').trim()
                      );
                    const deliveryNoteUrl = deliveryNoteUrlForClerkRequisition(state.invoices, req.id);
                    const canUploadDeliveryNote = Boolean(invoiceForClerkDeliveryNoteUpload(state.invoices, req.id));
                    const requestedAt = req.requestedAt || req.createdAt;
                    const reviewedAt = isApproved ? (req.reviewedAt || req.updatedAt || req.requestedAt || req.createdAt) : null;
                    const isNoPortalSupplier = !req.supplierId || String(req.supplierId).trim() === '';
                    const canUploadProforma = isNoPortalSupplier && isApproved && !proformaUrl && !proforma;
                    // For non-portal suppliers, allow final invoice upload after proforma is uploaded and accepted
                    const canUploadFinalInvoice = isNoPortalSupplier && isApproved && proformaUrl && !finalInvoiceUrl;
                    const canUploadDeliveryNoteForNoPortal = isNoPortalSupplier && isApproved && finalInvoiceUrl && !deliveryNoteUrl;
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
                          {req.status === 'draft' && (
                            <div style={{ marginTop: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedReqForEdit(req)}
                                title="Edit or submit this auto-draft"
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '4px',
                                  background: 'var(--ec-primary, #692751)',
                                  color: 'white',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                Edit / Submit
                              </button>
                            </div>
                          )}
                          {req.status === 'rejected' && String(req.supervisorNote || '').trim() ? (
                            <p className={ui.materialsClerkRejectionNote}>
                              {t('app.clerk.requisitionSupervisorReason', { reason: String(req.supervisorNote).trim() })}
                            </p>
                          ) : null}
                        </td>
                        <td>{stockState}</td>
                        <td>{requestedAt ? (() => { const d = new Date(requestedAt); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; })() : '—'}</td>
                        <td>{reviewedAt ? (() => { const d = new Date(reviewedAt); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; })() : '—'}</td>
                        <td className={ui.materialsProformaCell}>
                          {proformaUrl || proforma ? (
                            <div className={ui.materialsActionRow}>
                              {proformaUrl || proforma.attachmentUrl ? (
                                <button
                                  type="button"
                                  className={ui.invoiceDocBtn}
                                  title="Proforma"
                                  onClick={() =>
                                    setClerkDocPreview({
                                      url: clerkResolveDocUrl(proformaUrl || proforma.attachmentUrl),
                                      title: 'Proforma',
                                    })
                                  }
                                >
                                  Proforma
                                </button>
                              ) : (
                                '—'
                              )}
                              {req.status === 'proformaAwaitingClerk' && (
                                <div className={ui.materialsMiniActions}>
                                  <button
                                    type="button"
                                    className={ui.materialsMiniActionBtnOk}
                                    onClick={async () => {
                                      showFlash(t('app.clerk.proformaToastAccepting'), 'loading');
                                      try {
                                        await clerkProformaReview(req.id, 'accepted', 'Clerk accepted proforma');
                                        showFlash(t('app.clerk.proformaToastAccepted'), 'ok');
                                      } catch (e) {
                                        showFlash(e.message || t('app.clerk.proformaToastError'), 'error');
                                      }
                                    }}
                                    title="Accept proforma"
                                  >
                                    <CheckIcon size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className={ui.materialsMiniActionBtnBad}
                                    onClick={async () => {
                                      showFlash(t('app.clerk.proformaToastDeclining'), 'loading');
                                      try {
                                        await clerkProformaReview(req.id, 'rejected', 'Clerk declined proforma');
                                        showFlash(t('app.clerk.proformaToastDeclined'), 'warn');
                                      } catch (e) {
                                        showFlash(e.message || t('app.clerk.proformaToastError'), 'error');
                                      }
                                    }}
                                    title="Decline proforma"
                                  >
                                    <CloseIcon size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : canUploadProforma || req.status === 'approvedExternal' ? (
                            <button
                              type="button"
                              className={ui.materialsUploadBtn}
                              onClick={() => {
                                setExternalUploadReq(req);
                              }}
                            >
                              Upload Proforma
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {finalInvoiceUrl ? (
                            <button
                              type="button"
                              className={ui.materialsViewLink}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                              title="Final invoice from supplier"
                              onClick={() =>
                                setClerkDocPreview({
                                  url: resolvePortalDocumentUrl(finalInvoiceUrl) || clerkResolveDocUrl(finalInvoiceUrl),
                                  title: 'Final invoice',
                                })
                              }
                            >
                              Final Invoice
                            </button>
                          ) : canUploadFinalInvoice ? (
                            <button
                              type="button"
                              className={ui.materialsUploadBtn}
                              onClick={() => {
                                setExternalUploadReq({ ...req, uploadType: 'final' });
                              }}
                            >
                              Upload Final Invoice
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {deliveryNoteUrl ? (
                            <button
                              type="button"
                              className={ui.materialsViewLink}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                              onClick={() =>
                                setClerkDocPreview({
                                  url: clerkResolveDocUrl(deliveryNoteUrl),
                                  title: 'Delivery note',
                                })
                              }
                            >
                              View
                            </button>
                          ) : canUploadDeliveryNote || canUploadDeliveryNoteForNoPortal ? (
                            <button
                              type="button"
                              className={ui.materialsUploadBtn}
                              disabled={deliveryNoteUploadingReqId === req.id}
                              onClick={() => openClerkDeliveryNotePicker(req.id)}
                            >
                              {deliveryNoteUploadingReqId === req.id ? 'Uploading…' : 'Upload PDF'}
                            </button>
                          ) : (
                            '—'
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
          company={state.company}
        />

        <EditDraftRequisitionModal
          isOpen={!!selectedReqForEdit}
          requisition={selectedReqForEdit}
          onClose={() => setSelectedReqForEdit(null)}
          onSave={updateAutoDraftLines}
          onSubmit={submitAutoDraft}
          onCancel={cancelAutoDraft}
        />

        <ClerkUploadExternalProformaModal
          isOpen={!!externalUploadReq}
          requisition={externalUploadReq}
          onClose={() => setExternalUploadReq(null)}
          onUpload={async (reqId, payload) => {
            showFlash('Uploading document...', 'loading');
            try {
              await clerkUploadExternalProforma(reqId, payload);
              // Auto-accept proforma for non-portal suppliers so accountant can process payment
              if (payload.type === 'proforma' || !payload.type) {
                showFlash('Proforma uploaded and auto-accepted for payment processing', 'ok');
                try {
                  await clerkProformaReview(reqId, 'accepted', 'Clerk auto-accepted proforma for non-portal supplier');
                } catch (e) {
                  console.error('Failed to auto-accept proforma:', e);
                }
              } else if (payload.type === 'final') {
                showFlash('Final invoice uploaded successfully!', 'ok');
              } else {
                showFlash('Document uploaded successfully!', 'ok');
              }
            } catch (err) {
              showFlash(err.message || 'Failed to upload document.', 'error');
              throw err;
            }
          }}
        />

        <DocumentViewerModal
          open={Boolean(clerkDocPreview?.url)}
          title={clerkDocPreview?.title}
          url={clerkDocPreview?.url}
          onClose={() => setClerkDocPreview(null)}
        />

        <aside className={ui.materialsRail}>
          <section className={ui.materialsStockCard}>
            <p className={ui.materialsSideEyebrow}>Current available stock</p>
            <div className={ui.materialsStockValue}>
              <strong>{Number(selectedItem?.quantity || 0).toLocaleString()}</strong>
              <span>Units</span>
            </div>
            <div className={ui.materialsStockTrack}>
              <div className={ui.materialsStockFill} style={{ width: `${stockPercent}%` }} />
            </div>
            <div className={ui.materialsStatList}>
              <div className={ui.materialsStatRow}>
                <span>Last Replenished</span>
                <strong>—</strong>
              </div>
              <div className={ui.materialsStatRow}>
                <span>Reorder Point</span>
                <strong className={ui.materialsStatWarn}>
                  {Number.isFinite(Number(selectedItem?.minThreshold)) ? Number(selectedItem?.minThreshold) : '—'} Units
                </strong>
              </div>
              <div className={ui.materialsStatRow}>
                <span>Storage Location</span>
                <strong>{selectedItem?.location || actor?.location || '—'}</strong>
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
  const items = clerkVisibleStockItems(state, actor)
    .filter((item) => item.expiryDate)
    .map((item) => ({ ...item, daysLeft: daysUntil(item.expiryDate) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const [filter, setFilter] = useState('all');
  const [salvageMarked, setSalvageMarked] = useState([]);
  const [expCat, setExpCat] = useState('all');
  const [expQ, setExpQ] = useState('');

  const criticalItems = items.filter((item) => item.daysLeft <= 2);
  const upcomingItems = items.filter((item) => item.daysLeft > 2 && item.daysLeft <= 30);
  const stableItems = items.filter((item) => item.daysLeft > 30);
  const underMinItems = items.filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0));
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
            <InventoryFilterSelect
              value={expCat}
              onChange={setExpCat}
              options={[{ value: 'all', label: 'All categories' }, ...expCategories.map(c => ({ value: c, label: c }))]}
            />
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
          <p className={ui.expirySummaryLabel}>Under minimum</p>
          <p className={ui.expirySummaryValue}>{underMinItems.length} Items</p>
          <span className={ui.expirySummaryMeta}>Qty at or below minimum threshold</span>
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
                    const low = Number(item.quantity || 0) <= Number(item.minThreshold || 0);
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
                          <span className={ui.expiryTableStockPct}>
                            {progress}% · {Number(item.quantity || 0)}/{Number(item.minThreshold || 0)}
                            {low ? ' · LOW' : ''}
                          </span>
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

export function ClerkReports() {
  const { t } = useI18n();
  const chartGradId = useId().replace(/:/g, '');
  const navigate = useNavigate();
  const { state } = usePortalData();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const [range, setRange] = useState('all');
  const [granularity, setGranularity] = useState('day');
  const [analyticsCategory, setAnalyticsCategory] = useState('all');
  const [analyticsSubcategory, setAnalyticsSubcategory] = useState('all');
  const [anomTone, setAnomTone] = useState('all');
  const [consumedQ, setConsumedQ] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [showProductList, setShowProductList] = useState(false);
  const [showExpiredItems, setShowExpiredItems] = useState(false);
  const [showConsumptionHistory, setShowConsumptionHistory] = useState(false);
  const [showTopItems, setShowTopItems] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  const items = useMemo(
    () => clerkVisibleStockItems(state, actor),
    [state.stockItems, state.users, actor?.id, actor?.location, actor?.department, actor?.team]
  );
  const bounds = useMemo(() => {
    // Use custom date range if provided
    if (customDateStart && customDateEnd) {
      return {
        start: new Date(customDateStart).getTime(),
        end: new Date(customDateEnd).getTime(),
      };
    }
    const b = getClerkRangeBounds(range);
    if (b) return b;
    // For 'all', find the earliest activity in the system
    const all = [...state.consumptions, ...items];
    const first = all.reduce((acc, c) => {
      const t = new Date(c.createdAt || c.updatedAt || Date.now()).getTime();
      return (t > 0 && t < acc) ? t : acc;
    }, Date.now());
    return { start: first, end: Date.now() };
  }, [range, state.consumptions, items, customDateStart, customDateEnd]);
  const consumptionsMine = useMemo(
    () => state.consumptions.filter((entry) => entry.clerkId === actor?.id && !isBillConsumption(entry)),
    [state.consumptions, actor?.id]
  );
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
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
      if (purposeFilter !== 'all' && c.purpose !== purposeFilter) return false;
      if (locationFilter !== 'all' && item?.location !== locationFilter) return false;
      return true;
    });
  }, [consumptionsMine, bounds, analyticsCategory, analyticsSubcategory, itemById, purposeFilter, locationFilter]);
  const itemsScoped = useMemo(() => {
    let list = analyticsCategory === 'all' ? items : items.filter((i) => i.category === analyticsCategory);
    if (analyticsSubcategory !== 'all') {
      list = list.filter((i) => String(i.subcategory || '').trim() === analyticsSubcategory);
    }
    return list;
  }, [items, analyticsCategory, analyticsSubcategory]);

  const usageByItem = usageRows(consumptionsScoped);
  const totalUsage = consumptionsScoped.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  // Real time-series data from consumptions
  const trendSlots = useMemo(() => {
    const rangeKey = range === 'all' ? 'all' : range;
    const maxSlots = granularity === 'week' ? 12 : (range === '7' ? 7 : range === '90' ? 18 : range === 'all' ? 16 : 14);
    return chartSeriesFromConsumptions(consumptionsMine, rangeKey, maxSlots, itemsScoped);
  }, [consumptionsMine, range, granularity, itemsScoped]);

  const [hoveredTrendIdx, setHoveredTrendIdx] = useState(null);
  const trendSvgRef = useRef(null);
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

  // Stock filtering logic
  const filteredStockItems = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return items.filter((item) => {
      const qty = Number(item.quantity || 0);
      const min = Number(item.minThreshold || 0);
      const max = Number(item.maxThreshold || 0);
      
      if (stockFilter === 'low') return qty <= min && qty > 0;
      if (stockFilter === 'overstock') return qty > max && max > 0;
      if (stockFilter === 'in_stock') return qty > min;
      if (q && !`${item.name} ${item.sku || ''}`.toLowerCase().includes(q)) return false;
      return true; // 'all'
    });
  }, [items, stockFilter, productSearch]);

  // Expired items (last 7 days)
  const expiredItems = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return items.filter((item) => {
      if (!item.expiryDate) return false;
      const expiryDate = new Date(item.expiryDate).getTime();
      return expiryDate >= sevenDaysAgo && expiryDate <= Date.now();
    });
  }, [items]);

  // Requisition stats for cards
  const myRequisitions = useMemo(() => {
    return state.requisitions.filter((r) => r.clerkId === actor?.id);
  }, [state.requisitions, actor?.id]);

  const requisitionStats = useMemo(() => {
    const inRange = myRequisitions.filter((r) => isoInRange(r.requestedAt, bounds.start, bounds.end));
    return {
      total: inRange.length,
      approved: inRange.filter((r) => ['approved', 'paid', 'deliveryNoteAttached', 'closed'].includes(r.status)).length,
      rejected: inRange.filter((r) => r.status === 'rejected').length,
      pending: inRange.filter((r) => ['submitted', 'sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived'].includes(r.status)).length,
    };
  }, [myRequisitions, bounds]);

  // 20 most used items by month
  const monthlyUsageData = useMemo(() => {
    const monthMap = new Map();
    consumptionsMine.forEach((c) => {
      const date = new Date(c.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, new Map());
      }
      const itemMap = monthMap.get(monthKey);
      itemMap.set(c.itemId, (itemMap.get(c.itemId) || 0) + Number(c.quantity || 0));
    });

    const months = [...monthMap.keys()].sort().reverse();
    const topItemsByMonth = months.map((month) => {
      const itemMap = monthMap.get(month);
      const sorted = [...itemMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
      return {
        month,
        items: sorted.map(([itemId, qty]) => ({
          itemId,
          name: itemById[itemId]?.name || 'Unknown',
          quantity: qty,
        })),
      };
    });

    return { months, topItemsByMonth };
  }, [consumptionsMine, itemById]);

  const filteredTopItems = useMemo(() => {
    if (selectedMonth === 'all') return monthlyUsageData.topItemsByMonth;
    return monthlyUsageData.topItemsByMonth.filter((m) => m.month === selectedMonth);
  }, [monthlyUsageData, selectedMonth]);

  // Stock prediction logic
  const stockPredictionData = useMemo(() => {
    const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentConsumptions = consumptionsMine.filter((c) => new Date(c.createdAt).getTime() >= last30Days);
    
    const consumptionByItem = new Map();
    recentConsumptions.forEach((c) => {
      consumptionByItem.set(c.itemId, (consumptionByItem.get(c.itemId) || 0) + Number(c.quantity || 0));
    });

    const predictions = items.slice(0, 10).map((item) => {
      const avgDailyConsumption = (consumptionByItem.get(item.id) || 0) / 30;
      const currentStock = Number(item.quantity || 0);
      const daysUntilEmpty = avgDailyConsumption > 0 ? Math.floor(currentStock / avgDailyConsumption) : 999;
      
      return {
        itemId: item.id,
        name: item.name,
        currentStock,
        avgDailyConsumption,
        daysUntilEmpty,
        predictedEmptyDate: daysUntilEmpty < 999 ? new Date(Date.now() + daysUntilEmpty * 24 * 60 * 60 * 1000).toLocaleDateString() : 'N/A',
      };
    });

    return predictions;
  }, [consumptionsMine, items]);

  // Download functions
  function downloadProductList() {
    const aoa = [
      ['Item ID', 'Name', 'Quantity in Stock', 'Unit', 'Min Threshold', 'Max Threshold', 'Expiry Date', 'Category', 'Location'],
      ...filteredStockItems.map((item) => [
        item.id,
        item.name,
        item.quantity,
        item.unit,
        item.minThreshold,
        item.maxThreshold,
        item.expiryDate || 'N/A',
        item.category,
        item.location,
      ]),
    ];
    downloadAoAAsXlsx(`product-list-${stockFilter}-${new Date().toISOString().slice(0, 10)}`, aoa, 'Product List');
  }

  function downloadExpiredItems() {
    const aoa = [
      ['Item ID', 'Name', 'Quantity in Stock', 'Unit', 'Expiry Date', 'Category', 'Location'],
      ...expiredItems.map((item) => [
        item.id,
        item.name,
        item.quantity,
        item.unit,
        item.expiryDate,
        item.category,
        item.location,
      ]),
    ];
    downloadAoAAsXlsx(`expired-items-${new Date().toISOString().slice(0, 10)}`, aoa, 'Expired Items');
  }

  function downloadConsumptionHistory() {
    const companyName = state.company?.name || 'Company';
    const generatedDate = new Date().toLocaleDateString();
    const periodText = range === 'custom' && customDateStart && customDateEnd
      ? `${customDateStart} to ${customDateEnd}`
      : `${range} days`;
    const clerkName = actor?.fullName || 'Unknown Clerk';

    const sorted = [...consumptionsScoped].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const aoa = [
      ['e-Cunga Clerk Consumption History Report'],
      [''],
      ['Company', companyName],
      ['Generated Date', generatedDate],
      ['Report Period', periodText],
      ['Clerk', clerkName],
      [''],
      ['Summary'],
      ['Total Consumption Records', sorted.length],
      ['Total Quantity Consumed', totalUsage],
      [''],
      ['Consumption Details'],
      ['Item ID', 'Name', 'Date Consumed', 'Quantity Consumed', 'Unit', 'Remained in Stock', 'Name of Clerk', 'Purpose'],
      ...sorted.map((c) => {
        const item = itemById[c.itemId];
        return [
          c.itemId,
          c.itemName,
          formatDate(c.createdAt),
          c.quantity,
          c.unit || item?.unit || 'N/A',
          item?.quantity || 'N/A',
          state.users.find((u) => u.id === c.clerkId)?.fullName || 'Unknown',
          c.purpose || 'N/A',
        ];
      }),
    ];
    downloadAoAAsXlsx(`consumption-history-${range}d-${new Date().toISOString().slice(0, 10)}`, aoa, 'Consumption History');
  }

  function downloadTopItems() {
    const companyName = state.company?.name || 'Company';
    const generatedDate = new Date().toLocaleDateString();
    const periodText = range === 'custom' && customDateStart && customDateEnd
      ? `${customDateStart} to ${customDateEnd}`
      : `${range} days`;
    const clerkName = actor?.fullName || 'Unknown Clerk';

    const aoa = [
      ['e-Cunga Clerk Top Items Report'],
      [''],
      ['Company', companyName],
      ['Generated Date', generatedDate],
      ['Report Period', periodText],
      ['Clerk', clerkName],
      [''],
      ['Top Consumed Items'],
      ['Month', 'Item ID', 'Name', 'Quantity Consumed'],
      ...filteredTopItems.flatMap((monthData) =>
        monthData.items.map((item) => [monthData.month, item.itemId, item.name, item.quantity])
      ),
    ];
    downloadAoAAsXlsx(`top-items-${new Date().toISOString().slice(0, 10)}`, aoa, 'Top Items');
  }

  function downloadAnalyticsPdf() {
    const companyName = state.company?.name || 'Company';
    const generatedDate = new Date().toLocaleDateString();
    const periodText = range === 'custom' && customDateStart && customDateEnd
      ? `${customDateStart} to ${customDateEnd}`
      : `${range} days`;
    const clerkName = actor?.fullName || 'Unknown Clerk';

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('e-Cunga Clerk Analytics Report', 14, 18);
    doc.setFontSize(11);
    doc.text(`Company: ${companyName}`, 14, 28);
    doc.text(`Generated: ${generatedDate}`, 14, 36);
    doc.text(`Report Period: ${periodText}`, 14, 44);
    doc.text(`Clerk: ${clerkName}`, 14, 52);
    doc.text(`Total Usage: ${totalUsage}`, 14, 62);
    doc.text(`Total Items: ${itemsScoped.length}`, 14, 70);

    doc.text('Top Consumed Items', 14, 84);
    usageByItem.slice(0, 5).forEach((item, index) => {
      doc.text(`- ${item[0]}: ${item[1]}`, 18, 94 + index * 8);
    });

    doc.text('Category Distribution', 14, 130);
    categoryPieSlices.slice(0, 5).forEach((cat, index) => {
      doc.text(`- ${cat.name}: ${cat.value} (${cat.pct}%)`, 18, 140 + index * 8);
    });

    doc.text('Requisition Summary', 14, 176);
    doc.text(`Total: ${requisitionStats.total}`, 18, 186);
    doc.text(`Approved: ${requisitionStats.approved}`, 18, 194);
    doc.text(`Rejected: ${requisitionStats.rejected}`, 18, 202);
    doc.text(`Pending: ${requisitionStats.pending}`, 18, 210);

    doc.save(`clerk-analytics-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

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

  // Real chart geometry from trendSlots
  const TREND_VB_W = 500;
  const TREND_VB_H = 200;
  const TREND_PAD_L = 44;
  const TREND_PAD_R = 12;
  const TREND_PAD_T = 18;
  const TREND_PAD_B = 32;
  const TREND_PLOT_W = TREND_VB_W - TREND_PAD_L - TREND_PAD_R;
  const TREND_PLOT_H = TREND_VB_H - TREND_PAD_T - TREND_PAD_B;

  const trendMaxVal = useMemo(() => {
    const maxUsage = Math.max(...trendSlots.map((s) => s.usage + s.billed), 0);
    return maxUsage > 0 ? maxUsage : 1;
  }, [trendSlots]);

  const trendYTicks = useMemo(() => {
    const raw = trendMaxVal;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const step = raw <= magnitude * 2 ? magnitude / 2 : raw <= magnitude * 5 ? magnitude : magnitude * 2;
    const niceMax = Math.ceil(raw / step) * step || step;
    const ticks = [];
    for (let v = 0; v <= niceMax + step / 2; v += step) {
      ticks.push(v);
    }
    return { ticks, niceMax: niceMax || step };
  }, [trendMaxVal]);

  const trendTxPoints = useMemo(() => {
    const n = trendSlots.length;
    if (n === 0) return [];
    if (n === 1) return [TREND_PAD_L + TREND_PLOT_W / 2];
    return trendSlots.map((_, i) => TREND_PAD_L + (i / (n - 1)) * TREND_PLOT_W);
  }, [trendSlots]);

  const trendTyPoints = useMemo(() => {
    const { niceMax } = trendYTicks;
    return trendSlots.map((s) => {
      const v = s.usage + s.billed;
      return TREND_PAD_T + TREND_PLOT_H - (v / niceMax) * TREND_PLOT_H;
    });
  }, [trendSlots, trendYTicks]);

  const trendLineD = useMemo(() => {
    if (trendTxPoints.length === 0) return '';
    return trendTxPoints.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${trendTyPoints[i].toFixed(2)}`).join(' ');
  }, [trendTxPoints, trendTyPoints]);

  const trendAreaD = useMemo(() => {
    if (!trendLineD || trendTxPoints.length === 0) return '';
    const baseY = TREND_PAD_T + TREND_PLOT_H;
    return `${trendLineD} L ${trendTxPoints[trendTxPoints.length - 1].toFixed(2)} ${baseY} L ${trendTxPoints[0].toFixed(2)} ${baseY} Z`;
  }, [trendLineD, trendTxPoints]);

  // Label every Nth slot to avoid crowding
  const trendLabelStep = useMemo(() => {
    const n = trendSlots.length;
    if (n <= 7) return 1;
    if (n <= 14) return 2;
    if (n <= 20) return 3;
    return Math.ceil(n / 6);
  }, [trendSlots]);

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
          <h1 className={ui.analyticsTitle}>Reports</h1>
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
          <button
            type="button"
            className={range === 'all' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
            onClick={() => setRange('all')}
          >
            {t('app.clerk.analyticsRangeAll')}
          </button>
          <button
            type="button"
            className={range === 'custom' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
            onClick={() => setRange('custom')}
          >
            Custom
          </button>
        </div>
        {range === 'custom' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => setCustomDateStart(e.target.value)}
              style={{ padding: '0.4rem', border: '1px solid var(--ec-border)', borderRadius: '4px' }}
            />
            <span>–</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => setCustomDateEnd(e.target.value)}
              style={{ padding: '0.4rem', border: '1px solid var(--ec-border)', borderRadius: '4px' }}
            />
          </div>
        )}
      </div>

      <div className={ui.analyticsFilterToolbar} role="search">
        <InventoryFilterSelect
          value={analyticsCategory}
          onChange={setAnalyticsCategory}
          options={[
            { value: 'all', label: t('app.clerk.analyticsAllCategories') },
            ...analyticsCategories.map((c) => ({ value: c, label: c })),
          ]}
        />
        {analyticsSubcategories.length ? (
          <InventoryFilterSelect
            value={analyticsSubcategory}
            onChange={setAnalyticsSubcategory}
            options={[
              { value: 'all', label: t('app.clerk.analyticsSubcategoryAll') },
              ...analyticsSubcategories.map((s) => ({ value: s, label: s })),
            ]}
          />
        ) : null}
        <InventoryFilterSelect
          value={anomTone}
          onChange={setAnomTone}
          options={[
            { value: 'all', label: t('app.clerk.analyticsSeverityAll') },
            { value: 'bad', label: t('app.clerk.analyticsSeverityCritical') },
            { value: 'warn', label: t('app.clerk.analyticsSeverityWarning') },
            { value: 'ok', label: t('app.clerk.analyticsSeverityResolved') },
          ]}
        />
        <InventoryFilterSelect
          value={purposeFilter}
          onChange={setPurposeFilter}
          options={[
            { value: 'all', label: 'All Purposes' },
            { value: 'patient_care', label: 'Patient Care' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'emergency', label: 'Emergency' },
            { value: 'routine', label: 'Routine' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <InventoryFilterSelect
          value={locationFilter}
          onChange={setLocationFilter}
          options={[
            { value: 'all', label: 'All Locations' },
            ...[...new Set(items.map((i) => i.location).filter(Boolean))].sort().map((l) => ({ value: l, label: l })),
          ]}
        />
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
            setPurposeFilter('all');
            setLocationFilter('all');
          }}
        />
        <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadAnalyticsExcel}>
          {t('app.clerk.analyticsDownloadExcel')}
        </button>
      </div>

      {/* Requisition Stats Cards */}
      <div className={ui.analyticsMiddleGrid}>
        <article className={ui.analyticsMetricCard}>
          <p className={ui.analyticsMetricLabel}>Requisitions</p>
          <div className={ui.analyticsMetricDonutRow}>
            <div
              className={`${ui.analyticsDonut} ${ui.analyticsDonutXs}`}
              style={{
                background: `conic-gradient(rgb(34 197 94 / 0.9) 0% ${requisitionStats.approved / Math.max(requisitionStats.total, 1) * 100}%, rgb(220 38 38 / 0.9) ${requisitionStats.approved / Math.max(requisitionStats.total, 1) * 100}% ${ (requisitionStats.approved + requisitionStats.rejected) / Math.max(requisitionStats.total, 1) * 100}%, rgb(234 179 8 / 0.9) ${(requisitionStats.approved + requisitionStats.rejected) / Math.max(requisitionStats.total, 1) * 100}% 100%)`,
              }}
              role="presentation"
            />
            <div className={ui.analyticsDonutLabel}>
              <strong className={ui.analyticsDonutHoleSm}>{requisitionStats.total}</strong>
            </div>
            <div className={ui.analyticsMetricAside}>
              <strong className={ui.analyticsMetricValue}>{requisitionStats.total}</strong>
              <span className={ui.analyticsMetricMeta}>total requisitions</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'rgb(34 197 94)' }}>{requisitionStats.approved} approved</span>
            <span style={{ color: 'rgb(220 38 38)' }}>{requisitionStats.rejected} rejected</span>
            <span style={{ color: 'rgb(234 179 8)' }}>{requisitionStats.pending} pending</span>
          </div>
        </article>
      </div>

      {/* Product List Download Section */}
      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>Product List Download</h2>
          <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowProductList(!showProductList)}>
            {showProductList ? 'Hide' : 'Show'}
          </button>
        </div>
        {showProductList && (
          <div style={{ marginTop: '1rem' }}>
            <div className={ui.analyticsFilterToolbar}>
              <InventoryFilterSelect
                value={stockFilter}
                onChange={setStockFilter}
                options={[
                  { value: 'all', label: 'All Items' },
                  { value: 'low', label: 'Low Stock' },
                  { value: 'overstock', label: 'Overstock' },
                  { value: 'in_stock', label: 'In Stock' },
                ]}
              />
              <input
                className={ui.portalFilterSearch}
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadProductList}>
                Download Product List
              </button>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>
              {filteredStockItems.length} items match filter
            </p>
            <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: '0.375rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Item ID</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Name</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Quantity</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Unit</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Min</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Max</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Expiry Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStockItems.slice(0, 50).map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--ec-border)' }}>
                      <td style={{ padding: '0.5rem' }}>{item.id}</td>
                      <td style={{ padding: '0.5rem' }}>{item.name}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '0.5rem' }}>{item.unit}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.minThreshold}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.maxThreshold}</td>
                      <td style={{ padding: '0.5rem' }}>{item.expiryDate || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStockItems.length > 50 && (
                <p style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--ec-muted)', textAlign: 'center' }}>
                  Showing first 50 of {filteredStockItems.length} items
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Expired Items Section */}
      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>Expired Items (Last 7 Days)</h2>
          <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowExpiredItems(!showExpiredItems)}>
            {showExpiredItems ? 'Hide' : 'Show'}
          </button>
        </div>
        {showExpiredItems && (
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadExpiredItems}>
              Download Expired Items
            </button>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>
              {expiredItems.length} items expired in the last 7 days
            </p>
            {expiredItems.length > 0 && (
              <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: '0.375rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Item ID</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Name</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Quantity</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Expiry Date</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiredItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--ec-border)', backgroundColor: 'rgba(220, 38, 38, 0.05)' }}>
                        <td style={{ padding: '0.5rem' }}>{item.id}</td>
                        <td style={{ padding: '0.5rem' }}>{item.name}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '0.5rem', color: 'rgb(220 38 38)' }}>{item.expiryDate}</td>
                        <td style={{ padding: '0.5rem' }}>{item.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Consumption History Section */}
      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>Consumption History</h2>
          <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowConsumptionHistory(!showConsumptionHistory)}>
            {showConsumptionHistory ? 'Hide' : 'Show'}
          </button>
        </div>
        {showConsumptionHistory && (
          <div style={{ marginTop: '1rem' }}>
            <div className={ui.analyticsFilterToolbar}>
              <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadConsumptionHistory}>
                Download Consumption History
              </button>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>
              {consumptionsScoped.length} consumption records in selected range
            </p>
            {consumptionsScoped.length > 0 && (
              <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: '0.375rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Item ID</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Name</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Date Consumed</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Quantity</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Unit</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Remained</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Clerk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumptionsScoped.slice(0, 50).map((c) => {
                      const item = itemById[c.itemId];
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--ec-border)' }}>
                          <td style={{ padding: '0.5rem' }}>{c.itemId}</td>
                          <td style={{ padding: '0.5rem' }}>{c.itemName}</td>
                          <td style={{ padding: '0.5rem' }}>{formatDate(c.createdAt)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{c.quantity}</td>
                          <td style={{ padding: '0.5rem' }}>{c.unit || item?.unit || 'N/A'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item?.quantity || 'N/A'}</td>
                          <td style={{ padding: '0.5rem' }}>{state.users.find((u) => u.id === c.clerkId)?.fullName || 'Unknown'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {consumptionsScoped.length > 50 && (
                  <p style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--ec-muted)', textAlign: 'center' }}>
                    Showing first 50 of {consumptionsScoped.length} records
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Top 20 Most Used Items Section */}
      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>20 Most Used Items by Month</h2>
          <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowTopItems(!showTopItems)}>
            {showTopItems ? 'Hide' : 'Show'}
          </button>
        </div>
        {showTopItems && (
          <div style={{ marginTop: '1rem' }}>
            <div className={ui.analyticsFilterToolbar}>
              <InventoryFilterSelect
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={[
                  { value: 'all', label: 'All Months' },
                  ...monthlyUsageData.months.map((m) => ({ value: m, label: m })),
                ]}
              />
              <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadTopItems}>
                Download Top Items
              </button>
              <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadAnalyticsPdf}>
                Download PDF Report
              </button>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>
              {filteredTopItems.reduce((sum, m) => sum + m.items.length, 0)} items across {filteredTopItems.length} months
            </p>
            <div style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: '0.375rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Month</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Item ID</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Name</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Quantity Consumed</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTopItems.flatMap((monthData) =>
                    monthData.items.map((item, idx) => (
                      <tr key={`${monthData.month}-${item.itemId}`} style={{ borderBottom: '1px solid var(--ec-border)' }}>
                        <td style={{ padding: '0.5rem', backgroundColor: idx === 0 ? 'rgba(34, 197, 94, 0.1)' : '' }}>{monthData.month}</td>
                        <td style={{ padding: '0.5rem', backgroundColor: idx === 0 ? 'rgba(34, 197, 94, 0.1)' : '' }}>{item.itemId}</td>
                        <td style={{ padding: '0.5rem', backgroundColor: idx === 0 ? 'rgba(34, 197, 94, 0.1)' : '' }}>{item.name}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', backgroundColor: idx === 0 ? 'rgba(34, 197, 94, 0.1)' : '', fontWeight: idx === 0 ? 600 : 400 }}>{item.quantity.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Stock Prediction Section */}
      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>Stock Prediction (Based on Last 30 Days)</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Top 10 items by current stock</span>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: '0.375rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                <tr>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Item</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Current Stock</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Avg Daily Consumption</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Days Until Empty</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Predicted Empty Date</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid var(--ec-border)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {stockPredictionData.map((item) => {
                  const isCritical = item.daysUntilEmpty < 30 && item.daysUntilEmpty < 999;
                  const isWarning = item.daysUntilEmpty >= 30 && item.daysUntilEmpty < 60 && item.daysUntilEmpty < 999;
                  return (
                    <tr key={item.itemId} style={{ borderBottom: '1px solid var(--ec-border)', backgroundColor: isCritical ? 'rgba(220, 38, 38, 0.05)' : isWarning ? 'rgba(234, 179, 8, 0.05)' : '' }}>
                      <td style={{ padding: '0.5rem' }}>{item.name}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.currentStock.toLocaleString()}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.avgDailyConsumption.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: isCritical ? 'rgb(220 38 38)' : isWarning ? 'rgb(234 179 8)' : 'inherit', fontWeight: isCritical ? 600 : 400 }}>
                        {item.daysUntilEmpty < 999 ? item.daysUntilEmpty : 'N/A'}
                      </td>
                      <td style={{ padding: '0.5rem', color: isCritical ? 'rgb(220 38 38)' : isWarning ? 'rgb(234 179 8)' : 'inherit' }}>
                        {item.predictedEmptyDate}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        {isCritical ? (
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgb(220 38 38)', color: 'white', fontSize: '0.7rem', fontWeight: 600 }}>CRITICAL</span>
                        ) : isWarning ? (
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgb(234 179 8)', color: 'white', fontSize: '0.7rem', fontWeight: 600 }}>WARNING</span>
                        ) : (
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgb(34 197 94)', color: 'white', fontSize: '0.7rem', fontWeight: 600 }}>OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
            <div className={`${ui.analyticsChartGrid} ${ui.analyticsChartGridTall}`} style={{ position: 'relative', overflow: 'visible' }}>
              <svg
                ref={trendSvgRef}
                viewBox={`0 0 ${TREND_VB_W} ${TREND_VB_H}`}
                className={`${ui.analyticsChartSvg} ${ui.analyticsChartSvgTall}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Daily usage trend from real consumption data"
                style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
                onMouseMove={(e) => {
                  if (!trendSvgRef.current || trendTxPoints.length === 0) return;
                  const rect = trendSvgRef.current.getBoundingClientRect();
                  const px = e.clientX - rect.left;
                  const svgX = (px / rect.width) * TREND_VB_W;
                  let best = 0;
                  let bestDist = Infinity;
                  trendTxPoints.forEach((x, i) => {
                    const d = Math.abs(x - svgX);
                    if (d < bestDist) { bestDist = d; best = i; }
                  });
                  setHoveredTrendIdx(best);
                }}
                onMouseLeave={() => setHoveredTrendIdx(null)}
              >
                <defs>
                  <linearGradient id={`${chartGradId}-trend`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(120 11 35 / 0.28)" />
                    <stop offset="85%" stopColor="rgb(120 11 35 / 0.04)" />
                    <stop offset="100%" stopColor="rgb(120 11 35 / 0)" />
                  </linearGradient>
                  <linearGradient id={`${chartGradId}-line`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(120 11 35 / 0.6)" />
                    <stop offset="50%" stopColor="rgb(120 11 35 / 1)" />
                    <stop offset="100%" stopColor="rgb(120 11 35 / 0.7)" />
                  </linearGradient>
                </defs>

                {/* Y-axis grid lines and labels */}
                {trendYTicks.ticks.map((v) => {
                  const y = TREND_PAD_T + TREND_PLOT_H - (v / trendYTicks.niceMax) * TREND_PLOT_H;
                  const label = v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v);
                  return (
                    <g key={v}>
                      <line
                        x1={TREND_PAD_L} y1={y.toFixed(1)}
                        x2={TREND_VB_W - TREND_PAD_R} y2={y.toFixed(1)}
                        stroke="var(--ec-border)"
                        strokeWidth="0.6"
                        strokeDasharray={v === 0 ? 'none' : '3 3'}
                        opacity={v === 0 ? 0.7 : 0.45}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={TREND_PAD_L - 5} y={y.toFixed(1)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fontSize="9"
                        fill="var(--ec-muted)"
                        style={{ fontFamily: 'var(--ec-font-sans)', fontWeight: 400 }}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Area fill */}
                {trendAreaD ? (
                  <path d={trendAreaD} fill={`url(#${chartGradId}-trend)`} />
                ) : null}

                {/* Hover vertical line */}
                {hoveredTrendIdx !== null && trendTxPoints[hoveredTrendIdx] !== undefined ? (
                  <line
                    x1={trendTxPoints[hoveredTrendIdx].toFixed(2)}
                    y1={TREND_PAD_T}
                    x2={trendTxPoints[hoveredTrendIdx].toFixed(2)}
                    y2={TREND_PAD_T + TREND_PLOT_H}
                    stroke="var(--ec-primary)"
                    strokeWidth="0.8"
                    strokeDasharray="3 2"
                    opacity="0.5"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}

                {/* Main line */}
                {trendLineD ? (
                  <path
                    d={trendLineD}
                    fill="none"
                    stroke={`url(#${chartGradId}-line)`}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}

                {/* Data points */}
                {trendTxPoints.map((x, i) => {
                  const slot = trendSlots[i];
                  const isHovered = hoveredTrendIdx === i;
                  const v = slot.usage + slot.billed;
                  return (
                    <circle
                      key={slot.id || i}
                      cx={x.toFixed(2)}
                      cy={trendTyPoints[i].toFixed(2)}
                      r={isHovered ? 4 : 2}
                      fill={isHovered ? 'var(--ec-primary)' : 'var(--ec-white)'}
                      stroke="var(--ec-primary)"
                      strokeWidth={isHovered ? 0 : 1.5}
                      vectorEffect="non-scaling-stroke"
                      style={{ transition: 'r 0.15s ease, fill 0.15s ease' }}
                    />
                  );
                })}

                {/* X-axis date labels */}
                {trendSlots.map((slot, i) => {
                  if (i % trendLabelStep !== 0 && i !== trendSlots.length - 1) return null;
                  const x = trendTxPoints[i];
                  if (x === undefined) return null;
                  const shortLabel = slot.label.split('–')[0].trim();
                  return (
                    <text
                      key={`lbl-${i}`}
                      x={x.toFixed(2)}
                      y={TREND_PAD_T + TREND_PLOT_H + 14}
                      textAnchor="middle"
                      fontSize="8.5"
                      fill="var(--ec-muted)"
                      style={{ fontFamily: 'var(--ec-font-sans)', fontWeight: 400 }}
                    >
                      {shortLabel}
                    </text>
                  );
                })}

                {/* Empty state */}
                {trendSlots.length === 0 || trendSlots.every((s) => s.usage + s.billed === 0) ? (
                  <text
                    x={TREND_VB_W / 2} y={TREND_VB_H / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fill="var(--ec-muted)"
                    style={{ fontFamily: 'var(--ec-font-sans)', fontWeight: 400 }}
                  >
                    No consumption data in this range
                  </text>
                ) : null}
              </svg>

              {/* Hover tooltip */}
              {hoveredTrendIdx !== null && trendSlots[hoveredTrendIdx] && trendSvgRef.current ? (() => {
                const slot = trendSlots[hoveredTrendIdx];
                const pctX = (trendTxPoints[hoveredTrendIdx] / TREND_VB_W) * 100;
                const pctY = (trendTyPoints[hoveredTrendIdx] / TREND_VB_H) * 100;
                return (
                  <div
                    className={ui.clerkChartTooltip}
                    style={{
                      left: `${pctX}%`,
                      top: `${pctY}%`,
                      transform: 'translate(-50%, -110%)',
                      pointerEvents: 'none',
                      position: 'absolute',
                    }}
                  >
                    <span className={ui.clerkChartTooltipLabel}>{slot.label}</span>
                    <span className={ui.clerkChartTooltipValue}>{(slot.usage + slot.billed).toLocaleString()} units</span>
                    {slot.usage > 0 ? <span className={ui.clerkChartTooltipLabel}>Usage: {slot.usage.toLocaleString()}</span> : null}
                    {slot.billed > 0 ? <span className={ui.clerkChartTooltipLabel}>Billed: {slot.billed.toLocaleString()}</span> : null}
                  </div>
                );
              })() : null}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem', fontSize: '0.68rem', color: 'var(--ec-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '1.8rem', height: '2px', background: 'var(--ec-primary)', display: 'inline-block', borderRadius: '2px' }} />
                Usage + Billed
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.62rem' }}>
                {trendSlots.length} data points · {range === 'all' ? 'All time' : `Last ${range} days`}
              </span>
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
              />
              <div className={ui.analyticsDonutLabel}>
                <strong>{categoryPieSlices.length ? `${categoryPieSlices[0].pct}%` : '—'}</strong>
                <span>top</span>
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
              />
              <div className={ui.analyticsDonutLabel}>
                <strong>{topShareSlices[0]?.pct ?? 0}%</strong>
                <span>{topItem}</span>
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
              {trendSlots.slice(0, 4).map((slot, i) => {
                const maxV = Math.max(...trendSlots.map((s) => s.usage + s.billed), 1);
                const pct = Math.round(((slot.usage + slot.billed) / maxV) * 100);
                return (
                  <div key={slot.id || i} className={ui.analyticsMicroBar} style={{ height: `${Math.max(8, pct)}%` }} />
                );
              })}
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
            />
            <div className={ui.analyticsDonutLabel}>
              <strong>{itemPieSlices[0]?.pct ?? 0}%</strong>
              <span>lead</span>
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
              />
              <div className={ui.analyticsDonutLabel}>
                <strong className={ui.analyticsDonutHoleSm}>{totalWaste}</strong>
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
              />
              <div className={ui.analyticsDonutLabel}>
                <strong className={ui.analyticsDonutHoleSm}>{turnRate}</strong>
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
              {(() => {
                const maxV = Math.max(...trendSlots.map((s) => s.usage + s.billed), 1);
                const sample = trendSlots.length <= 4 ? trendSlots : trendSlots.filter((_, i) => i % Math.ceil(trendSlots.length / 4) === 0).slice(0, 4);
                return sample.map((slot, i) => {
                  const p = Math.round(((slot.usage + slot.billed) / maxV) * 100);
                  return (
                    <div
                      key={slot.id || i}
                      className={ui.analyticsStackSeg}
                      style={{ flex: Math.max(1, p), background: ANALYTICS_SLICE_COLORS[i % ANALYTICS_SLICE_COLORS.length] }}
                      title={`${slot.label}: ${slot.usage + slot.billed} units`}
                    />
                  );
                });
              })()}
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
  const items = clerkVisibleStockItems(state, actor);
  const linkableRequisitions = useMemo(() => {
    return (state.requisitions || [])
      .filter((r) => r.clerkId === actor?.id && r.status !== 'rejected')
      .sort((a, b) => new Date(b.requestedAt || b.updatedAt) - new Date(a.requestedAt || a.updatedAt));
  }, [state.requisitions, actor?.id]);
  const alerts = notificationsForRole(state, 'clerk', user?.id);
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
                <InventoryFilterSelect
                  value={form.itemId}
                  onChange={(val) => setForm({ ...form, itemId: val })}
                  options={items.map((i) => ({ value: i.id, label: i.name }))}
                />
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
                <InventoryFilterSelect
                  value={form.department}
                  onChange={(val) => setForm({ ...form, department: val })}
                  options={departments.map((d) => ({ value: d, label: d }))}
                />
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
              <InventoryFilterSelect
                value={form.relatedRequisitionId}
                onChange={(val) => setForm({ ...form, relatedRequisitionId: val })}
                options={[
                  { value: '', label: t('app.clerk.relatedRequisitionNone') },
                  ...linkableRequisitions.map((r) => ({ value: r.id, label: `${r.id} · ${r.title}` })),
                ]}
              />
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
  company,
  billExportPeriod,
  setBillExportPeriod,
  billExportCategory,
  setBillExportCategory,
}) {
  const categories = useMemo(() => {
    if (isHealthcareCompany(company)) return HEALTHCARE_STOCK_CATEGORIES;
    return [...new Set(stockItems.map((i) => i.category).filter(Boolean))].sort();
  }, [company, stockItems]);

  function categoryForBillRow(row) {
    const item = stockItems.find((s) => s.id === row.itemId);
    return item?.category || '';
  }

  function downloadBilledExcel() {
    const rows = billHistory.filter((row) => {
      if (!billConsumptionInPeriod(row, billExportPeriod)) return false;
      const cat = categoryForBillRow(row);
      if (billExportCategory === 'all') return true;
      if (isHealthcareCompany(company)) {
        if (normalizeToHealthcareCategory(cat) !== billExportCategory) return false;
      } else if (cat !== billExportCategory) return false;
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
        <InventoryFilterSelect
          value={billExportPeriod}
          onChange={setBillExportPeriod}
          options={[
            { value: '7', label: t('app.clerk.billingExportDays7') },
            { value: '30', label: t('app.clerk.billingExportDays30') },
            { value: '90', label: t('app.clerk.billingExportDays90') },
            { value: 'all', label: t('app.clerk.billingExportAllTime') },
          ]}
        />
      </label>
      <label className={ui.clerkMaterialsRailExportField}>
        <span>{t('app.clerk.materialsExportCategory')}</span>
        <InventoryFilterSelect
          value={billExportCategory}
          onChange={setBillExportCategory}
          options={[
            { value: 'all', label: t('app.clerk.materialsExportAllCategories') },
            ...categories.map((c) => ({
              value: c,
              label: categoryFilterOptionLabel(c, company),
            })),
          ]}
        />
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
    () => clerkVisibleStockItems(state, actor).sort((a, b) => a.name.localeCompare(b.name)),
    [state.stockItems, state.users, actor?.id, actor?.location, actor?.department, actor?.team]
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
      const label = inventoryCategoryLabel(s, state.company);
      const hay = `${s.name} ${s.sku || ''} ${s.category || ''} ${label}`.toLowerCase();
      return hay.includes(q);
    });
  }, [stockItems, stockSearch]);

  const linkableRequisitions = useMemo(() => {
    return clerkVisibleRecords(state.requisitions || [], actor)
      .filter((r) => r.status !== 'rejected')
      .sort((a, b) => new Date(b.requestedAt || b.updatedAt) - new Date(a.requestedAt || a.updatedAt));
  }, [state.requisitions, actor?.id, actor?.location, actor?.department, actor?.team]);

  const billHistory = useMemo(() => {
    return clerkVisibleRecords(state.consumptions || [], actor)
      .filter((c) => isBillConsumption(c))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [state.consumptions, actor?.id, actor?.location, actor?.department, actor?.team]);

  useEffect(() => {
    if (typeof setRailSlot !== 'function') return undefined;
    setRailSlot(
      <ClerkBillingRailExport
        t={t}
        billHistory={billHistory}
        stockItems={stockItems}
        company={state.company}
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
    state.company,
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
        </div>
      </header>

      <div className={ui.billingFormLayout}>
        <div className={ui.billingFormMain}>
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
                <div className={ui.billingStockTableScroll}>
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
                            SKU: {item.sku || '—'} · {inventoryCategoryLabel(item, state.company)}
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
                </div>
              </>
            ) : (
              <p className={ui.muted}>{t('app.clerk.billingStockNoMatch')}</p>
            )}
          </section>
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
          <button type="button" className={ui.modalPrimaryBtn} onClick={() => {
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

export function ClerkUploadExternalProformaModal({ isOpen, requisition, onClose, onUpload }) {
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RWF');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const uploadType = requisition?.uploadType || 'proforma';

  useEffect(() => {
    if (isOpen) {
      setReference(`EXT-${Date.now()}`);
      setAmount('');
      setCurrency('RWF');
      setNotes('');
      setFile(null);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Please select a proforma/invoice PDF file.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    setError('');
    setUploading(true);

    try {
      const okType = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!okType) {
        throw new Error('Please choose a PDF file.');
      }
      const resp = await apiUploadMedia(file);
      const url = resp?.secure_url || resp?.url;
      if (!url) throw new Error('Upload did not return a file URL.');

      await onUpload(requisition.id, {
        reference,
        amount: Number(amount),
        currency,
        notes,
        attachmentUrl: url,
        type: uploadType,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  }

  const title = uploadType === 'final' ? 'Upload Final Invoice' : 'Upload External Supplier Proforma';
  const submitText = uploadType === 'final' ? 'Submit Final Invoice' : 'Submit Proforma';

  return (
    <div className={ui.modalOverlay} role="dialog" aria-modal="true" style={{ zIndex: 5000 }}>
      <div className={ui.modalCard} style={{ maxWidth: '500px' }}>
        <div className={ui.modalHead}>
          <h2 className={ui.modalTitle}>{title}</h2>
          <button type="button" className={ui.modalClose} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 500 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ec-muted)' }}>Requisition</label>
            <input type="text" className={ui.portalFilterSearch} style={{ background: '#f1f5f9', cursor: 'not-allowed' }} value={`${requisition?.id || ''} - ${requisition?.title || ''}`} disabled />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ec-muted)' }}>Proforma/Invoice Reference</label>
            <input type="text" className={ui.portalFilterSearch} value={reference} onChange={e => setReference(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ec-muted)' }}>Amount</label>
              <input type="number" min="0" step="any" className={ui.portalFilterSearch} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ec-muted)' }}>Currency</label>
              <select className={ui.portalFilterSearch} value={currency} onChange={e => setCurrency(e.target.value)} style={{ padding: '0.45rem' }}>
                <option value="RWF">RWF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ec-muted)' }}>Notes / Comments Label</label>
            <textarea className={ui.portalFilterSearch} style={{ minHeight: '80px', resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes from the proforma invoice..." />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ec-muted)' }}>PDF Document</label>
            <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0])} required style={{ fontSize: '0.875rem' }} />
          </div>

          <div className={ui.modalActions} style={{ marginTop: '1rem' }}>
            <button type="button" className={ui.modalSecondaryBtn} onClick={onClose} disabled={uploading}>Cancel</button>
            <button type="submit" className={ui.modalPrimaryBtn} disabled={uploading}>
              {uploading ? 'Uploading...' : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

