import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import React, { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useShellSearchQuery } from '../../hooks/useShellSearchQuery.js';
import { getPeriodBounds, isoInRange } from '../../utils/reportFilters.js';
import { filterMasterRecommendations } from '../../utils/filterMasterRecommendations.js';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import { conicGradientFromSlices, REPORT_SLICE_COLORS } from '../../utils/reportCharts.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import { RequisitionPdfModal, downloadRequisitionPdf } from '../../components/RequisitionPdfModal.jsx';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import { AddItemModal } from '../../components/StockManagementModals.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { AdminUserEditModal, AdminDeleteConfirmModal } from './adminPages.jsx';
import { SupervisorUserViewModal } from './supervisorWorkspacePages.jsx';
import ui from './DashboardUi.module.css';
import { InventoryFilterSelect } from '../../components/InventoryFilterSelect.jsx';
import { ClearFiltersIconButton, StatusBadge, formatDate, formatMoney, stockStatus, workflowLabel } from './roleUi.jsx';
import { resolveWorkspaceCompanyName } from '../../utils/workspaceCompanyName.js';
import { categoryFilterOptionLabel } from '../../lib/formatters.js';
import {
  HEALTHCARE_STOCK_CATEGORIES,
  isHealthcareCompany,
  normalizeToHealthcareCategory,
} from '../../constants/ecosystemCatalog.js';
import { isAwaitingSupervisorApproval, isRejectedRequisition, isSentToSupplierWorkflow } from '../../utils/requisitionWorkflow.js';
import { describeActivityEntry } from '../../utils/activityLabels.js';

function isBillConsumptionSupervisor(c) {
  if (c?.consumptionKind === 'bill') return true;
  return String(c?.purpose || '').startsWith('Bill:');
}

function monitorActivityEventTitle(action) {
  switch (action) {
    case 'stock.request.approved':
      return 'Batch approval';
    case 'stock.request.rejected':
      return 'Request rejected';
    case 'stock.request.created':
      return 'Request created';
    case 'stock.item.consumed':
      return 'Stock consumption';
    case 'stock.item.added':
      return 'Stock item added';
    case 'stock.auto_requisition':
      return 'Auto requisition';
    case 'masterStock.item.added':
      return 'Catalog item published';
    case 'invoice.proforma.received':
      return 'Proforma received';
    case 'invoice.paid':
      return 'Payment posted';
    case 'workflow.closed':
      return 'Workflow closed';
    case 'invoice.approved':
      return 'Proforma approved';
    case 'invoice.rejected':
      return 'Proforma rejected';
    case 'delivery.note.attached':
      return 'Delivery note';
    case 'requisition.clerk_proforma.accepted':
      return 'Clerk accepted proforma';
    case 'requisition.clerk_proforma.rejected':
      return 'Clerk declined proforma';
    default:
      return 'Activity';
  }
}

function monitorActivityActionLabel(action) {
  switch (action) {
    case 'stock.request.approved':
      return 'Approved request';
    case 'stock.request.rejected':
      return 'Rejected request';
    case 'stock.item.consumed':
      return 'Recorded consumption';
    case 'stock.item.added':
      return 'Added stock line';
    case 'stock.auto_requisition':
      return 'Auto restock triggered';
    case 'masterStock.item.added':
      return 'Published catalog template';
    case 'invoice.proforma.received':
      return 'Updated workflow';
    case 'invoice.paid':
      return 'Recorded payment';
    case 'workflow.closed':
      return 'Closed workflow';
    case 'invoice.approved':
      return 'Approved proforma';
    case 'invoice.rejected':
      return 'Rejected proforma';
    case 'delivery.note.attached':
      return 'Attached delivery note';
    default:
      return String(action || '').replace(/\./g, ' ');
  }
}

function monitorActivityMetaLine(meta) {
  if (!meta || typeof meta !== 'object') return '';
  const parts = [];
  if (meta.name) parts.push(meta.name);
  if (meta.itemName) parts.push(meta.itemName);
  if (meta.quantity != null && meta.quantity !== '') parts.push(`×${meta.quantity}`);
  if (meta.requisitionId) parts.push(meta.requisitionId);
  if (meta.invoiceId) parts.push(meta.invoiceId);
  if (meta.itemId) parts.push(meta.itemId);
  return parts.length ? parts.join(' · ') : '';
}

function resolveActivityRelated(entry, state) {
  const meta = entry?.meta && typeof entry.meta === 'object' ? entry.meta : {};
  const findReq = (rid) =>
    rid != null && rid !== ''
      ? state.requisitions?.find((x) => String(x.id) === String(rid))
      : null;
  const findInv = (iid) =>
    iid != null && iid !== ''
      ? state.invoices?.find((x) => String(x.id) === String(iid))
      : null;
  const findStock = (sid) =>
    sid != null && sid !== ''
      ? state.stockItems?.find((x) => String(x.id) === String(sid))
      : null;

  const req = findReq(meta.requisitionId) || findReq(meta.stockRequestId);
  if (req) return { kind: 'requisition', data: req };

  const inv = findInv(meta.invoiceId);
  if (inv) return { kind: 'invoice', data: inv };

  const st = findStock(meta.itemId) || findStock(meta.stockId);
  if (st) return { kind: 'stock', data: st };

  return null;
}

function activityMetaHasRefs(meta) {
  if (!meta || typeof meta !== 'object') return false;
  return ['requisitionId', 'stockRequestId', 'invoiceId', 'itemId', 'stockId'].some(
    (k) => meta[k] != null && meta[k] !== ''
  );
}

function matchesReqReportStatus(req, repReqStatus) {
  if (repReqStatus === 'all') return true;
  const s = req.status;
  if (repReqStatus === 'submitted') return s === 'submitted';
  if (repReqStatus === 'in_progress') {
    return ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived', 'proformaApproved'].includes(s);
  }
  if (repReqStatus === 'fulfilled') return ['paid', 'deliveryNoteAttached', 'closed'].includes(s);
  if (repReqStatus === 'rejected') return s === 'rejected';
  return true;
}

function matchesStockReportStatus(item, repStockStatus) {
  if (repStockStatus === 'all') return true;
  const label = stockStatus(item);
  if (repStockStatus === 'in_stock') return label === 'In Stock';
  if (repStockStatus === 'low') return label === 'Low stock';
  if (repStockStatus === 'out') return label === 'Out of stock';
  return true;
}

function compactApprovalSearchKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s_\-]/g, '');
}

function requisitionApprovalSearchHaystack(entry) {
  const lineBits = (entry.lines || []).flatMap((l) => [l.description, l.unit].filter(Boolean));
  return [
    entry.id,
    entry.title,
    entry.clerkName,
    entry.location,
    entry.clerkJustification,
    entry.requestingDepartment,
    entry.deliveryNote,
    entry.supervisorNote,
    ...lineBits,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function requisitionMatchesApprovalSearch(entry, tokens) {
  if (!tokens.length) return true;
  const hay = requisitionApprovalSearchHaystack(entry);
  const hayCompact = compactApprovalSearchKey(hay);
  return tokens.every((tok) => {
    const t = String(tok || '').toLowerCase().trim();
    if (!t) return true;
    if (hay.includes(t)) return true;
    const tc = compactApprovalSearchKey(t);
    return tc.length > 0 && hayCompact.includes(tc);
  });
}

function approvalSearchTokensFromInputs(reqSearch, shellReqSearch) {
  const combined = [reqSearch, shellReqSearch]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!combined) return [];
  return combined.split(/\s+/).filter(Boolean);
}

function useSupervisorActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'supervisor'),
    [state.users, user?.email]
  );
}

function SupervisorIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'overview') {
    return (
      <svg {...common}>
        <path d="M4 13h7V4H4zm9 7h7V4h-7zm-9 0h7v-5H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'approval') {
    return (
      <svg {...common}>
        <path d="M6 4h9l3 3v13H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 19V9M12 19V5M19 19v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function clerkCardInitials(fullName) {
  const parts = String(fullName || '?')
    .split(/\s+/)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();
  return parts.slice(0, 2) || '?';
}

function ClerkRowIcon({ kind }) {
  const c = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'sku') {
    return (
      <svg {...c}>
        <path d="M8 5h8v14H8z" stroke="currentColor" strokeWidth="1.65" />
        <path d="M11 10h2M11 14h2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'units') {
    return (
      <svg {...c}>
        <path d="M7 6h10v12H7z" stroke="currentColor" strokeWidth="1.65" />
        <path d="M7 12h10" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === 'low') {
    return (
      <svg {...c}>
        <path d="M12 4v14M8 14l4-4 4 4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'pending') {
    return (
      <svg {...c}>
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8v4l2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'download') {
    return (
      <svg {...c}>
        <path d="M12 4v11m0 0l-3-3m3 3l3-3M6 18h12" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'inventory') {
    return (
      <svg {...c}>
        <path d="M5 9l7-4 7 4-7 4-7-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M5 13l7 4 7-4M5 17l7 4 7-4" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'view') {
    return (
      <svg {...c}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.55" />
      </svg>
    );
  }
  if (kind === 'edit') {
    return (
      <svg {...c}>
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'delete') {
    return (
      <svg {...c}>
        <path d="M3 6h18M8 6V4h8v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12zM10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

function usageTotals(consumptions) {
  const grouped = consumptions.reduce((map, entry) => {
    map.set(entry.itemName, (map.get(entry.itemName) || 0) + Number(entry.quantity || 0));
    return map;
  }, new Map());
  return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function usageTotalsWithUnit(consumptions) {
  const grouped = consumptions.reduce((map, entry) => {
    const current = map.get(entry.itemName) || { quantity: 0, unit: entry.unit || 'units' };
    current.quantity += Number(entry.quantity || 0);
    map.set(entry.itemName, current);
    return map;
  }, new Map());
  return [...grouped.entries()]
    .map(([name, meta]) => ({ name, quantity: meta.quantity, unit: meta.unit }))
    .sort((a, b) => b.quantity - a.quantity);
}

function usageByClerk(consumptions, users) {
  return [...consumptions]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((entry) => ({
      ...entry,
      clerk: users.find((user) => user.id === entry.clerkId),
    }));
}

/** Resolve label for a consumption row when `itemName` is missing in legacy data. */
function consumptionItemLabel(entry, itemById) {
  const fromRow = String(entry.itemName || '').trim();
  if (fromRow) return fromRow;
  const stock = entry.itemId ? itemById[entry.itemId] : null;
  const fromStock = String(stock?.name || '').trim();
  if (fromStock) return fromStock;
  const id = String(entry.itemId || '').trim();
  return id || '—';
}

function startOfLocalDaySup(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Chargeable billing entries use this prefix in `purpose` (legacy) or `consumptionKind === 'bill'`. */
const BILL_PURPOSE_PREFIX = 'Bill:';

function isBillConsumption(c) {
  if (c?.consumptionKind === 'bill') return true;
  return String(c?.purpose || '').startsWith(BILL_PURPOSE_PREFIX);
}

function consumptionKindLabel(entry) {
  if (isBillConsumption(entry)) return 'Billed';
  const q = Number(entry.quantity || 0);
  if (entry.consumptionKind === 'usage' || q < 0) return 'Usage';
  return 'Recorded';
}

/** One row per calendar day in the window, oldest → newest. Buckets by trend type. */
function systemTrendSeries(consumptions, dayCountInput, stockItems = []) {
  const now = new Date();
  let dayCount = Number(dayCountInput);

  if (dayCountInput === 'all') {
    const allEvents = [...consumptions, ...stockItems];
    if (allEvents.length === 0) {
      dayCount = 30; // fallback
    } else {
      const earliest = allEvents.reduce((acc, c) => {
        const t = new Date(c.createdAt || c.updatedAt || Date.now()).getTime();
        return t < acc ? t : acc;
      }, now.getTime());
      dayCount = Math.max(7, Math.ceil((now.getTime() - earliest) / 86400000) + 1);
    }
  }

  const buckets = [];
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = startOfLocalDaySup(d);
    buckets.push({
      key,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      added: 0,
      billed: 0,
      usage: 0,
      total: 0, // legacy/sum
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  consumptions.forEach((c) => {
    const key = startOfLocalDaySup(new Date(c.createdAt || c.updatedAt || Date.now()));
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

  // Note: We no longer include initial quantities from stockItems.forEach here 
  // to stay consistent with the restock-only definition of "Added".

  const currentStockTotal = stockItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
  let rollingBalance = currentStockTotal;
  const reversed = [...buckets].reverse();
  reversed.forEach((b) => {
    b.balance = rollingBalance;
    rollingBalance -= (b.added - (b.billed + b.usage));
  });

  return buckets;
}

const MS_PER_DAY = 86400000;

/** One plotted point: totals + calendar span for time-accurate x placement. */
function usageTrendSlotFromChunk(chunk) {
  const first = chunk[0];
  const last = chunk[chunk.length - 1];
  const label =
    chunk.length === 1 ? first.label : `${first.label}–${last.label}`;
  return {
    label,
    added: chunk.reduce((s, x) => s + (x.added || 0), 0),
    billed: chunk.reduce((s, x) => s + (x.billed || 0), 0),
    usage: chunk.reduce((s, x) => s + (x.usage || 0), 0),
    balance: last.balance,
    total: chunk.reduce((s, x) => s + x.total, 0),
    startMs: first.key,
    endMs: last.key + MS_PER_DAY,
  };
}

/** Cap SVG point count by merging adjacent days. */
function usageTrendSlots(dailyBuckets, maxSlots = 10) {
  if (dailyBuckets.length <= maxSlots) {
    return dailyBuckets.map((b) => usageTrendSlotFromChunk([b]));
  }
  const per = Math.ceil(dailyBuckets.length / maxSlots);
  const out = [];
  for (let i = 0; i < dailyBuckets.length; i += per) {
    const chunk = dailyBuckets.slice(i, i + per);
    out.push(usageTrendSlotFromChunk(chunk));
  }
  return out;
}

/** Map slot calendar midpoints to SVG x (0–100), padded like the plot area. */
  const usageTrendXPositions = (slots, start, end) => {
    const n = slots.length;
    if (n === 0) return [];
    const denom = n > 1 ? n - 1 : 1;
    const innerW = SUP_USAGE_TREND_VB_W - SUP_USAGE_TREND_PAD_X * 2;
    return slots.map((_, i) => {
      const plotX = SUP_USAGE_TREND_PAD_X + (n > 1 ? (i / denom) * innerW : innerW / 2);
      const pctX = (plotX / SUP_USAGE_TREND_VB_W) * 100;
      return { plotX, pctX };
    });
  };

/** Round axis maximum up to a “nice” bound (1–2–5 × 10ⁿ) so ticks are readable. */
function niceCeilAxisMax(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = 10 ** exp;
  const f = x / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * base;
}

/** Integer tick step for counts / whole RWF amounts. */
function niceTickStepCounts(axisMax, maxTicks = 5) {
  if (axisMax <= 0) return 1;
  // Use fixed 500 interval for inventory dashboard as requested
  if (axisMax <= 20000) return 500;
  const rough = Math.ceil(axisMax / maxTicks);
  const pow10 = 10 ** Math.floor(Math.log10(rough));
  const r = rough / pow10;
  const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
  return nice * pow10;
}

/** Ticks from 0 → axisMax with aligned SVG y (value 0 at yBottom). */
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

/** ViewBox height: plot area only; x-axis dates use the same HTML row as clerk charts (`clerkChartXLabels`). */
const SUP_REPORT_TREND_VB_H = 52;

function ownerLabel(ownerId, users) {
  if (!ownerId) return 'Unassigned';
  const u = users.find((x) => x.id === ownerId);
  if (!u) return 'Unassigned';
  const tag = (u.jobTitle || u.team || '').trim();
  return tag ? `${u.fullName} · ${tag}` : u.fullName;
}

function sanitizeFilePart(name) {
  return String(name || 'clerk').replace(/[^\w\-]+/g, '_').slice(0, 48);
}

/** Rolling 7d, multi-month calendar windows, or a single calendar month (YYYY-MM). */
function top10PeriodBounds(periodKey, now = new Date()) {
  const end = now.getTime();
  if (periodKey === 'week') {
    return { start: end - 7 * 86400000, end };
  }
  if (periodKey === 'm3' || periodKey === 'm6' || periodKey === 'm12') {
    const n = periodKey === 'm3' ? 3 : periodKey === 'm6' ? 6 : 12;
    const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1).getTime();
    return { start, end };
  }
  const parts = String(periodKey).split('-');
  if (parts.length !== 2) return { start: end - 7 * 86400000, end };
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  if (!y || !mo || mo < 1 || mo > 12) return { start: end - 7 * 86400000, end };
  const start = new Date(y, mo - 1, 1).getTime();
  const monthEnd = new Date(y, mo, 0, 23, 59, 59, 999).getTime();
  return { start, end: Math.min(monthEnd, end) };
}

function formatYyyyMmMonthLabel(yyyyMm, localeTag) {
  const [y, mo] = yyyyMm.split('-').map(Number);
  return new Date(y, mo - 1, 15).toLocaleDateString(localeTag, { month: 'short', year: 'numeric' });
}

function buildClerkMonthlyCsvRows(clerk, state) {
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const stock = state.stockItems.filter((i) => i.ownerId === clerk.id);
  const monthlyConsumptions = state.consumptions.filter(
    (c) => c.clerkId === clerk.id && new Date(c.createdAt) >= monthStart
  );
  const monthlyReqs = state.requisitions.filter(
    (r) => r.clerkId === clerk.id && new Date(r.requestedAt || r.updatedAt || 0) >= monthStart
  );
  const company = state.company?.name || '';
  return [
    ['Monthly clerk report', monthKey],
    ['Company', company],
    ['Clerk', clerk.fullName],
    ['Role', clerk.jobTitle || clerk.team || ''],
    ['Phone', clerk.phone || ''],
    ['Location', clerk.location || ''],
    ['Tracked line items', String(stock.length)],
    ['Total on-hand qty', String(stock.reduce((s, i) => s + Number(i.quantity || 0), 0))],
    [],
    ['SKU', 'Name', 'Qty', 'Unit', 'Min', 'Max', 'Location', 'Category'],
    ...stock.map((i) => [i.sku, i.name, i.quantity, i.unit, i.minThreshold, i.maxThreshold, i.location, i.category]),
    [],
    ['Month consumptions', 'item', 'qty', 'unit', 'date', 'purpose'],
    ...monthlyConsumptions.map((c) => ['', c.itemName, c.quantity, c.unit, c.createdAt, c.purpose || '']),
    [],
    ['Month requisitions', 'id', 'title', 'status'],
    ...monthlyReqs.map((r) => ['', r.id, r.title, r.status]),
  ];
}


const SUP_USAGE_TREND_PAD_X = 40;
const SUP_USAGE_TREND_Y_TOP = 20;
const SUP_USAGE_TREND_VB_W = 400;
const SUP_USAGE_TREND_VB_H = 220;

export const SupervisorDashboard = React.memo(function SupervisorDashboard() {
  const { language, t } = useI18n();
  const { user } = useAuth();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [viewingActivity, setViewingActivity] = useState(null);
  const [usageRangeDays, setUsageRangeDays] = useState(7);
  const [usageCategory, setUsageCategory] = useState('all');
  const [usageLocation, setUsageLocation] = useState('all');
  const [usageClerk, setUsageClerk] = useState('all');
  const [usageSearch, setUsageSearch] = useState('');
  const [top10Period, setTop10Period] = useState('week');
  const [top10Location, setTop10Location] = useState('all');
  const [top10Clerk, setTop10Clerk] = useState('all');
  const usageTrendSvgRef = useRef(null);
  const usageTrendGradId = useId();
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const requests = state.requisitions;
  const allItems = state.stockItems;
  const allConsumptions = state.consumptions;
  const allConsumptionsUsage = useMemo(
    () => allConsumptions,
    [allConsumptions]
  );
  const weeklyConsumptions = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return allConsumptionsUsage.filter((c) => new Date(c.createdAt).getTime() >= cutoff);
  }, [allConsumptionsUsage]);
  const itemById = useMemo(() => Object.fromEntries(allItems.map((i) => [i.id, i])), [allItems]);
  const usageCategories = useMemo(
    () => [...new Set(allItems.map((i) => i.category).filter(Boolean))].sort(),
    [allItems]
  );
  const usageLocations = useMemo(
    () => [...new Set(allItems.map((i) => i.location).filter(Boolean))].sort(),
    [allItems]
  );
  const clerkFilterOptions = useMemo(
    () =>
      [...state.users]
        .filter((u) => u.role === 'clerk')
        .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || ''))),
    [state.users]
  );
  const filteredUsageConsumptions = useMemo(() => {
    const isAll = usageRangeDays === 'all';
    const cutoff = isAll ? 0 : Date.now() - usageRangeDays * 86400000;
    return allConsumptionsUsage.filter((c) => {
      if (!isAll && new Date(c.createdAt || c.updatedAt || Date.now()).getTime() < cutoff) return false;
      if (usageClerk !== 'all' && c.clerkId !== usageClerk) return false;
      const item = itemById[c.itemId];
      if (usageCategory !== 'all' && item?.category !== usageCategory) return false;
      if (usageLocation !== 'all' && item?.location !== usageLocation) return false;
      const q = usageSearch.trim().toLowerCase();
      if (q && !String(c.itemName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allConsumptionsUsage, usageRangeDays, usageClerk, itemById, usageCategory, usageLocation, usageSearch]);
  const top10CalendarMonthKeys = useMemo(() => {
    const now = new Date();
    const keys = [];
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
  }, []);
  const localeTag = language === 'kiny' ? 'rw-RW' : 'en-US';
  const top10Bounds = top10PeriodBounds(top10Period);
  const top10FilteredConsumptions = useMemo(() => {
    const { start, end } = top10Bounds;
    return allConsumptionsUsage.filter((c) => {
      const t0 = new Date(c.createdAt || c.updatedAt || Date.now()).getTime();
      if (t0 < start || t0 > end) return false;
      if (top10Clerk !== 'all' && c.clerkId !== top10Clerk) return false;
      const item = itemById[c.itemId];
      if (top10Location !== 'all' && item?.location !== top10Location) return false;
      return true;
    });
  }, [allConsumptionsUsage, top10Bounds, top10Clerk, top10Location, itemById]);
  const top10Used = useMemo(
    () => usageTotalsWithUnit(top10FilteredConsumptions).slice(0, 10),
    [top10FilteredConsumptions]
  );
  const usageFilteredTotalQty = useMemo(
    () => filteredUsageConsumptions.reduce((s, c) => s + Number(c.quantity || 0), 0),
    [filteredUsageConsumptions]
  );
  const dailyForTrend = useMemo(
    () => systemTrendSeries(filteredUsageConsumptions, usageRangeDays, allItems),
    [filteredUsageConsumptions, usageRangeDays, allItems]
  );
  const trendSlots = useMemo(() => usageTrendSlots(dailyForTrend, 10), [dailyForTrend]);
  
  const { trendAdded, trendBilled, trendBalance, trendTotals } = useMemo(() => {
    return {
      trendAdded: trendSlots.map((s) => s.added),
      trendBilled: trendSlots.map((s) => s.billed + s.usage), // Combined "Recorded Usage"
      trendBalance: trendSlots.map((s) => s.balance),
      trendTotals: trendSlots.map((s) => s.total),
    };
  }, [trendSlots]);

  const usageTrendDataMax = Math.max(0, ...trendAdded, ...trendBilled, ...trendBalance);
  const usageTrendAxisMax = useMemo(
    () => (Math.ceil(usageTrendDataMax / 500) || 1) * 500 + 500,
    [usageTrendDataMax]
  );

  const SUP_USAGE_TREND_Y_BOTTOM = 200;
  const SUP_USAGE_TREND_Y_SPAN = SUP_USAGE_TREND_Y_BOTTOM - SUP_USAGE_TREND_Y_TOP;

  const nTrend = trendSlots.length;
  const trendPositions = useMemo(() => usageTrendXPositions(trendSlots), [trendSlots]);
  const txTrend = trendPositions.map((p) => p.plotX);
  const baseYTrend = SUP_USAGE_TREND_Y_BOTTOM;
  const usageTrendValueSpan = SUP_USAGE_TREND_Y_SPAN;

  const getTyTrend = (series) => series.map((v) => baseYTrend - (v / usageTrendAxisMax) * usageTrendValueSpan);
  
  const tyTrendAdded = getTyTrend(trendAdded);
  const tyTrendBilled = getTyTrend(trendBilled);
  const tyTrendBalance = getTyTrend(trendBalance);

  const getTrendLineD = (ty) => txTrend.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ty[i]}`).join(' ');
  
  const trendLineDAdded = getTrendLineD(tyTrendAdded);
  const trendLineDBilled = getTrendLineD(tyTrendBilled);
  const trendLineDBalance = getTrendLineD(tyTrendBalance);

  const getTrendAreaD = (lineD) => 
    nTrend > 0 ? `${lineD} L ${txTrend[nTrend - 1]} ${baseYTrend} L ${txTrend[0]} ${baseYTrend} Z` : '';

  const trendAreaDAdded = getTrendAreaD(trendLineDAdded);
  const trendAreaDBilled = getTrendAreaD(trendLineDBilled);
  const trendAreaDBalance = getTrendAreaD(trendLineDBalance);
  const usageTrendXMin = nTrend > 0 ? Math.min(...txTrend) : 4;
  const usageTrendXMax = nTrend > 0 ? Math.max(...txTrend) : 96;
  const usageTrendYTicks = useMemo(
    () => buildCountAxisTicks(usageTrendAxisMax, SUP_USAGE_TREND_Y_BOTTOM, SUP_USAGE_TREND_Y_SPAN),
    [usageTrendAxisMax, SUP_USAGE_TREND_Y_BOTTOM, SUP_USAGE_TREND_Y_SPAN]
  );
  const curveData = useMemo(() => {
    return txTrend.map((x, i) => ({
      x,
      y: tyTrendBalance[i],
      pctX: x,
    }));
  }, [txTrend, tyTrendBalance]);

  const top10BarMaxQty = top10Used[0]?.quantity || 1;
  const totalStockUnits = allItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const submitted = requests.filter((entry) => entry.status === 'submitted').length;
  const lowStock = allItems.filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0)).length;
  const outOfStock = allItems.filter((item) => Number(item.quantity || 0) <= 0).length;
  const userGroups = {
    clerks: state.users.filter((u) => u.role === 'clerk' && u.isActive).length,
    accountants: state.users.filter((u) => u.role === 'accountant' && u.isActive).length,
    suppliers: state.users.filter((u) => u.role === 'supplier' && u.isActive).length,
  };
  const latestUsed = usageByClerk(weeklyConsumptions, state.users).slice(0, 10);
  const criticalAlerts = [
    ...allItems
      .filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0))
      .slice(0, 2)
      .map((item) => ({
        id: `stk_${item.id}`,
        title: 'Stock depletion',
        body: `${item.name}: ${item.quantity} ${item.unit || ''} remaining in ${item.location}`,
      })),
    ...notificationsForRole(state, 'supervisor', user?.id)
      .slice(0, 2)
      .map((entry) => ({ id: entry.id, title: entry.title, body: entry.body })),
  ].slice(0, 4);

  const institutionName = useMemo(() => {
    const resolved = resolveWorkspaceCompanyName(state.company?.name, user?.companyName);
    return resolved || t('app.supervisor.dashInstitutionFallback');
  }, [state.company?.name, user?.companyName, t]);

  return (
    <div className={ui.supervisorDash}>
      <div className={ui.supervisorDashTop}>
        <div>
          <div className={ui.supervisorDashHead}>
            <h1 className={ui.supervisorDashInstitution}>
              <strong>{institutionName}</strong>
            </h1>
          </div>
          <p className={ui.visuallyHidden}>{t('app.supervisor.dashLeadSr')}</p>
        </div>
      </div>

      <div className={ui.supervisorSummaryGrid}>
        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Inventory items</p>
            <button
              type="button"
              className={ui.summaryCardPlus}
              onClick={() => navigate('/app/supervisor/visibility')}
              title="View inventory"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className={ui.clerkStatMain}>
            <p className={ui.clerkStatValue}>{allItems.length.toLocaleString()}</p>
            <span className={ui.supervisorSummaryNeutral}>{totalStockUnits.toLocaleString()} units</span>
          </div>
        </article>

        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Low and stockouts</p>
            <button
              type="button"
              className={ui.summaryCardPlus}
              onClick={() => navigate('/app/supervisor/visibility?alerts=1')}
              title="View low stock and stockouts across all clerks"
            >
              <span className={ui.clerkStatIcon} style={{ color: '#ea6b5d' }}>
                <ClerkRowIcon kind="low" />
              </span>
            </button>
          </div>
          <div className={ui.clerkStatMain}>
            <p className={ui.clerkStatValue}>{lowStock + outOfStock}</p>
            <span className={lowStock + outOfStock > 0 ? ui.clerkDeltaWarn : ui.clerkDeltaOk}>
              {outOfStock > 0 ? `${outOfStock} fully stocked out` : 'No stockout'}
            </span>
          </div>
        </article>

        <article
          className={ui.supervisorSummaryCard}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/app/supervisor/approvals')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/app/supervisor/approvals');
            }
          }}
          aria-label={t('app.supervisor.dashPendingApprovalsCardAria')}
        >
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Pending approvals</p>
            <span className={ui.clerkStatIcon} style={{ color: 'var(--ec-primary-light)' }}>
              <ClerkRowIcon kind="pending" />
            </span>
          </div>
          <div className={ui.clerkStatMain}>
            <p className={ui.clerkStatValue}>{submitted}</p>
            <span className={submitted > 0 ? ui.clerkDeltaInfo : ui.clerkDeltaOk}>
              {submitted > 0 ? 'Includes requisition status' : 'All clear'}
            </span>
          </div>
        </article>

        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Users</p>
            <button
              type="button"
              className={ui.summaryCardPlus}
              onClick={() => navigate('/app/supervisor/clerks', { state: { openInvite: true } })}
              title="Add User"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className={ui.clerkStatMain}>
            <p className={ui.clerkStatValue}>{userGroups.clerks + userGroups.accountants + userGroups.suppliers}</p>
            <span className={ui.clerkDeltaInfo}>
              <button type="button" className={ui.supervisorTextLink} onClick={() => navigate('/app/supervisor/clerks')}>{userGroups.clerks} clerks</button> ·{' '}
              <button type="button" className={ui.supervisorTextLink} onClick={() => navigate('/app/supervisor/accountants')}>{userGroups.accountants} accountants</button> ·{' '}
              <button type="button" className={ui.supervisorTextLink} onClick={() => navigate('/app/supervisor/suppliers')}>{userGroups.suppliers} suppliers</button>
            </span>
          </div>
        </article>
      </div>

      <div className={ui.supervisorClerkPromo}>
        <div>
          <h2 className={ui.supervisorClerkPromoTitle}>{t('app.supervisor.clerksTitle')}</h2>
          <p className={ui.visuallyHidden}>{t('app.supervisor.clerksTeaser')}</p>
        </div>
        <button type="button" className={ui.supervisorReportBtn} onClick={() => navigate('/app/supervisor/clerks')}>
          {t('app.supervisor.clerksOpen')}
        </button>
      </div>

      <div className={ui.supervisorMainGrid}>
        <section className={ui.supervisorUsageCard}>
          <div className={ui.supervisorSectionHead}>
            <div>
              <h2 className={ui.supervisorSectionTitle}>Inventory Trends</h2>
              <p className={ui.visuallyHidden}>{t('app.supervisor.usageLead')}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--ec-muted)', marginTop: '0.35rem' }}>
                Monitoring cumulative stock levels vs daily inflow (Added) and outflow (Billed).
              </p>
            </div>
            <button
              type="button"
              className={ui.supervisorTextBtn}
              onClick={() => navigate('/app/supervisor/reports')}
              aria-label={t('app.supervisor.usageReportsLink')}
              title={t('app.supervisor.usageReportsLink')}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className={ui.supervisorUsageToolbar} role="search">
            <div className={ui.supervisorUsageRange} role="group" aria-label={t('app.supervisor.usageRangeAria')}>
              {[7, 14, 30, 'all'].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={usageRangeDays === d ? `${ui.supervisorUsageRangeBtn} ${ui.supervisorUsageRangeBtnActive}` : ui.supervisorUsageRangeBtn}
                  onClick={() => setUsageRangeDays(d)}
                  title={d === 'all' ? 'All Time' : d === 7 ? t('app.supervisor.usageDays7') : d === 14 ? t('app.supervisor.usageDays14') : t('app.supervisor.usageDays30')}
                >
                  {d === 'all' ? 'All' : d === 7 ? t('app.supervisor.usageDays7Short') : d === 14 ? t('app.supervisor.usageDays14Short') : t('app.supervisor.usageDays30Short')}
                </button>
              ))}
            </div>

            <InventoryFilterSelect
              value={usageCategory}
              onChange={setUsageCategory}
              options={[
                { value: 'all', label: t('app.supervisor.usageAllCategories') },
                ...usageCategories.map((c) => ({
                  value: c,
                  label: categoryFilterOptionLabel(c, state.company),
                })),
              ]}
            />

            <InventoryFilterSelect
              value={usageLocation}
              onChange={setUsageLocation}
              options={[
                { value: 'all', label: t('app.supervisor.usageAllLocations') },
                ...usageLocations.map((loc) => ({ value: loc, label: loc })),
              ]}
            />

            <InventoryFilterSelect
              value={usageClerk}
              onChange={setUsageClerk}
              options={[
                { value: 'all', label: t('app.supervisor.usageAllClerks') },
                ...clerkFilterOptions.map((cl) => ({
                  value: cl.id,
                  label: cl.fullName || cl.email,
                })),
              ]}
            />
            <input
              className={ui.portalFilterSearch}
              placeholder={t('app.supervisor.usageSearchPh')}
              value={usageSearch}
              onChange={(e) => setUsageSearch(e.target.value)}
              aria-label={t('app.supervisor.usageSearchAria')}
            />
            <ClearFiltersIconButton
              title={t('app.supervisor.usageClear')}
              onClick={() => {
                setUsageRangeDays(7);
                setUsageCategory('all');
                setUsageLocation('all');
                setUsageClerk('all');
                setUsageSearch('');
              }}
            />
          </div>

          <div className={ui.supervisorUsageCharts}>
            <div className={ui.supervisorUsageTrendBlock}>
              <div className={ui.supervisorTrendLegend} style={{ padding: '0.2rem 0.5rem 1.2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
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
              <p className={ui.visuallyHidden}>{t('app.supervisor.usageTrendTitle')}</p>
              <div className={`${ui.analyticsChartGrid} ${ui.analyticsChartGridTall} ${ui.supervisorUsageChartGridClean}`}>
                {nTrend > 0 && (trendAreaDBalance || trendAreaDBilled || trendAreaDAdded) ? (
                  <div className={ui.lineChartPlot}>
                    <div className={ui.lineChartMain}>
                      <svg
                        ref={usageTrendSvgRef}
                        viewBox={`0 0 ${SUP_USAGE_TREND_VB_W} ${SUP_USAGE_TREND_VB_H}`}
                        className={ui.analyticsChartSvgTall}
                        preserveAspectRatio="none"
                        style={{ fontFamily: 'inherit' }}
                        onMouseMove={(e) => {
                          if (!nTrend || !tyTrendBalance.length) return;
                          const el = usageTrendSvgRef.current;
                          if (!el) return;
                          const r = el.getBoundingClientRect();
                          const px = e.clientX - r.left;
                          const w = r.width || 1;
                          const x = (px / w) * SUP_USAGE_TREND_VB_W;
                          let bestI = 0;
                          let bestD = Number.POSITIVE_INFINITY;
                          for (let i = 0; i < txTrend.length; i += 1) {
                            const d = Math.abs((txTrend[i] ?? 0) - x);
                            if (d < bestD) {
                              bestD = d;
                              bestI = i;
                            }
                          }
                          const h = el.clientHeight ?? 0;
                          const yBalance = tyTrendBalance[bestI] ?? 0;
                          const tooltipTopPx = h > 0 ? (yBalance / SUP_USAGE_TREND_VB_H) * h : null;
                          setHoveredPoint({
                            x: txTrend[bestI] ?? 0,
                            y: yBalance,
                            pctX: ((txTrend[bestI] ?? 0) / SUP_USAGE_TREND_VB_W) * 100,
                            label: trendSlots[bestI]?.label,
                            balance: trendBalance[bestI] ?? 0,
                            billed: trendBilled[bestI] ?? 0,
                            added: trendAdded[bestI] ?? 0,
                            tooltipTopPx,
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <defs>
                          <linearGradient id={`${usageTrendGradId}-u`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--ec-chart-gradient-top)" />
                            <stop offset="100%" stopColor="var(--ec-chart-gradient-bottom)" />
                          </linearGradient>
                          <linearGradient id={`${usageTrendGradId}-b`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
                            <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                          </linearGradient>
                          <linearGradient id={`${usageTrendGradId}-a`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(245, 158, 11, 0.2)" />
                            <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
                          </linearGradient>
                        </defs>
                        {trendSlots.map((slot, i) => {
                          const tx = txTrend[i];
                          if (tx == null) return null;
                          return (
                            <g key={i}>
                              <line
                                x1={tx}
                                x2={tx}
                                y1={SUP_USAGE_TREND_Y_TOP}
                                y2={SUP_USAGE_TREND_Y_BOTTOM}
                                stroke="var(--ec-chart-grid)"
                                strokeWidth="0.5"
                                vectorEffect="non-scaling-stroke"
                              />
                            </g>
                          );
                        })}
                        {usageTrendYTicks.map((tk, i) => (
                          <g key={i}>
                            <line
                              key={tk.value}
                              x1={SUP_USAGE_TREND_PAD_X}
                              x2={SUP_USAGE_TREND_VB_W - SUP_USAGE_TREND_PAD_X}
                              y1={tk.y}
                              y2={tk.y}
                              stroke="var(--ec-chart-grid)"
                              strokeWidth="0.5"
                              vectorEffect="non-scaling-stroke"
                            />
                            <text
                              x={SUP_USAGE_TREND_PAD_X - 6}
                              y={tk.y}
                              textAnchor="end"
                              dominantBaseline="middle"
                              fontSize="10"
                              fill="var(--ec-text)"
                              style={{ 
                                fontWeight: 500, 
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
                          x1={usageTrendXMin}
                          y1={baseYTrend}
                          x2={usageTrendXMax}
                          y2={baseYTrend}
                          stroke="var(--ec-chart-axis)"
                          strokeWidth="0.55"
                          vectorEffect="non-scaling-stroke"
                        />

                        {/* Total Stock Series */}
                        <path d={trendAreaDBalance} fill={`url(#${usageTrendGradId}-u)`} />
                        <path
                          d={trendLineDBalance}
                          fill="none"
                          stroke="var(--ec-primary)"
                          strokeWidth="3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />

                        {/* Billed Series */}
                        <path d={trendAreaDBilled} fill={`url(#${usageTrendGradId}-b)`} />
                        <path
                          d={trendLineDBilled}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />

                        {/* Added Series */}
                        <path d={trendAreaDAdded} fill={`url(#${usageTrendGradId}-a)`} />
                        <path
                          d={trendLineDAdded}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2.5"
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
                              <span>Stock Balance:</span>
                              <strong>{Math.round(hoveredPoint.balance).toLocaleString()}</strong>
                            </div>
                            <div style={{ color: '#10b981', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                              <span>Billed/Usage:</span>
                              <strong>{Math.round(hoveredPoint.billed).toLocaleString()}</strong>
                            </div>
                            <div style={{ color: '#f59e0b', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                              <span>Added:</span>
                              <strong>{Math.round(hoveredPoint.added).toLocaleString()}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className={ui.clerkChartXLabels} aria-hidden>
                        {trendSlots.map((slot, i) => (
                          <span
                            key={`xlab-${slot.startMs}-${i}`}
                            className={ui.clerkChartXLabel}
                            style={{ left: `${txTrend[i] ?? 0}%` }}
                          >
                            {slot.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className={ui.supervisorUsageEmptyChart}>{t('app.supervisor.usageNoTrend')}</p>
                )}
              </div>
            </div>
          </div>

          <div className={ui.supervisorUsageBarsSection}>
            <div className={ui.supervisorUsageTop10Block}>
              <div className={ui.supervisorUsageTop10Head}>
                <h3 className={ui.supervisorUsageTop10Title}>{t('app.supervisor.usageTop10Title')}</h3>
                <p className={ui.visuallyHidden}>{t('app.supervisor.usageTop10LeadSr')}</p>
              </div>
              <div className={`${ui.supervisorUsageToolbar} ${ui.supervisorUsageTop10Toolbar}`} role="search">
                <InventoryFilterSelect
                  value={top10Period}
                  onChange={setTop10Period}
                  options={[
                    { value: 'week', label: t('app.supervisor.usageTop10PeriodWeek') },
                    { value: 'm3', label: t('app.supervisor.usageTop10PeriodLast3m') },
                    { value: 'm6', label: t('app.supervisor.usageTop10PeriodLast6m') },
                    { value: 'm12', label: t('app.supervisor.usageTop10PeriodLast12m') },
                    ...top10CalendarMonthKeys.map((k) => ({
                      value: k,
                      label: formatYyyyMmMonthLabel(k, localeTag),
                    })),
                  ]}
                />
                <InventoryFilterSelect
                  value={top10Location}
                  onChange={setTop10Location}
                  options={[
                    { value: 'all', label: t('app.supervisor.usageAllLocations') },
                    ...usageLocations.map((loc) => ({ value: loc, label: loc })),
                  ]}
                />
                <InventoryFilterSelect
                  value={top10Clerk}
                  onChange={setTop10Clerk}
                  options={[
                    { value: 'all', label: t('app.supervisor.usageAllClerks') },
                    ...clerkFilterOptions.map((cl) => ({
                      value: cl.id,
                      label: cl.fullName || cl.email,
                    })),
                  ]}
                />
                <ClearFiltersIconButton
                  title={t('app.supervisor.usageTop10Clear')}
                  onClick={() => {
                    setTop10Period('week');
                    setTop10Location('all');
                    setTop10Clerk('all');
                  }}
                />
              </div>
              <p className={ui.visuallyHidden}>{t('app.supervisor.usageBarsTitle')}</p>
              {top10Used.length ? (
                <div className={ui.supervisorUsageRankRow} role="img" aria-label={t('app.supervisor.usageTop10Title')}>
                  {top10Used.map((entry, index) => {
                    const hPct = Math.min(100, (entry.quantity / top10BarMaxQty) * 100);
                    return (
                      <div key={`${entry.name}-${index}`} className={ui.supervisorUsageRankCell}>
                        <div className={ui.supervisorUsageRankBarWrap} aria-hidden>
                          <div
                            className={`${ui.supervisorUsageRankBar} ${index % 2 === 0 ? ui.supervisorUsageRankBarA : ui.supervisorUsageRankBarB}`}
                            style={{ height: `${hPct}%` }}
                          />
                        </div>
                        <p className={ui.supervisorUsageRankName} title={entry.name}>
                          {entry.name}
                        </p>
                        <p className={ui.supervisorUsageRankQty}>
                          {entry.quantity.toLocaleString()} {entry.unit}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={ui.supervisorSectionMeta}>{t('app.supervisor.usageNoData')}</p>
              )}
            </div>
          </div>
        </section>

        <div className={ui.supervisorSideStack}>
          <section className={ui.supervisorActivityCard}>
            <h2 className={ui.supervisorSectionTitle}>Weekly Latest Used Items</h2>
            <p className={ui.visuallyHidden}>Most recent consumption events in the last 7 days.</p>
            <div className={ui.supervisorActivityList}>
              {latestUsed.length ? (
                latestUsed.map((entry) => {
                  const stock = entry.itemId ? itemById[entry.itemId] : null;
                  const itemLabel = consumptionItemLabel(entry, itemById);
                  const sku = String(stock?.sku || '').trim();
                  const purpose = String(entry.purpose || '').trim();
                  const where = String(entry.location || stock?.location || entry.clerk?.location || '').trim();
                  const metaBits = [
                    `${formatDate(entry.createdAt)} at ${new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                    consumptionKindLabel(entry),
                    where || null,
                    sku ? `SKU ${sku}` : null,
                    purpose || null,
                  ].filter(Boolean);
                  return (
                <article key={entry.id} className={ui.supervisorActivityRow}>
                  <span className={ui.supervisorAvatar}>{entry.clerk?.fullName?.slice(0, 2).toUpperCase() || 'CL'}</span>
                  <div>
                    <p className={ui.supervisorActivityTitle}>
                      <strong>{itemLabel}</strong>
                      {' — '}
                      {entry.clerk?.fullName || 'Clerk'} · {Math.abs(Number(entry.quantity || 0))}{' '}
                      {entry.unit || 'units'}
                    </p>
                    <p className={ui.supervisorActivityMeta}>
                      {metaBits.join(' · ')}
                    </p>
                  </div>
                  <div style={{ alignSelf: 'center' }}>
                    <button
                      type="button"
                      className={ui.supervisorActivityViewBtn}
                      onClick={() => {
                        setViewingActivity(entry);
                        if (entry.clerk?.id) {
                          navigate(`/app/supervisor/visibility?clerk=${encodeURIComponent(entry.clerk.id)}`);
                        }
                      }}
                    >
                      View
                    </button>
                  </div>
                </article>
                  );
                })
              ) : (
                <p className={ui.supervisorSectionMeta}>No consumption recorded in the last 7 days.</p>
              )}
            </div>
          </section>

          {viewingActivity && (() => {
            const va = viewingActivity;
            const stock = va.itemId ? itemById[va.itemId] : null;
            const itemLabel = consumptionItemLabel(va, itemById);
            const sku = String(stock?.sku || '').trim();
            const purpose = String(va.purpose || '').trim();
            const where = String(va.location || stock?.location || va.clerk?.location || '').trim();
            const dept = String(va.department || stock?.department || '').trim();
            const reqId = String(va.relatedRequisitionId || '').trim();
            return (
            <div className={ui.modalOverlay} onClick={() => setViewingActivity(null)}>
              <div className={ui.modalCard} onClick={(e) => e.stopPropagation()}>
                <h3 className={ui.modalTitle}>Usage Details</h3>
                <p><strong>Item:</strong> {itemLabel}</p>
                {sku ? (
                  <p><strong>SKU:</strong> {sku}</p>
                ) : null}
                <p><strong>Type:</strong> {consumptionKindLabel(va)}</p>
                <p><strong>Quantity:</strong> {Math.abs(Number(va.quantity || 0))} {va.unit || 'units'}</p>
                <p><strong>Clerk:</strong> {va.clerk?.fullName || '—'}</p>
                {where ? <p><strong>Location:</strong> {where}</p> : null}
                {dept ? <p><strong>Department:</strong> {dept}</p> : null}
                {purpose ? <p><strong>Notes / purpose:</strong> {purpose}</p> : null}
                {reqId ? <p><strong>Related requisition:</strong> {reqId}</p> : null}
                <p><strong>Date:</strong> {formatDate(va.createdAt)}</p>
                <button type="button" onClick={() => setViewingActivity(null)}>Close</button>
              </div>
            </div>
            );
          })()}

          <section className={ui.supervisorAlertCard}>
            <h2 className={ui.supervisorSectionTitle}>Critical Alerts</h2>
            <div className={ui.supervisorAlertList}>
              {criticalAlerts.map((alert) => (
                <article key={alert.id} className={ui.supervisorAlertRow}>
                  <p className={ui.supervisorAlertTitle}>{alert.title}</p>
                  <p className={ui.supervisorAlertMeta}>{alert.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});

export function SupervisorClerksManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { state, inviteWorkspaceUser, updateWorkspaceUser, deleteWorkspaceUser } = usePortalData();
  const { showFlash, FlashBanner } = useFlash();
  const navigate = useNavigate();
  const location = useLocation();
  const actor = useSupervisorActor(state, user);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [viewingClerk, setViewingClerk] = useState(null);
  const [editingClerk, setEditingClerk] = useState(null);
  const [deletingClerk, setDeletingClerk] = useState(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    role: 'clerk',
    jobTitle: '',
    phone: '',
    location: '',
    department: '',
  });
  const requests = state.requisitions;

  useEffect(() => {
    if (!location.state?.openInvite) return;
    setShowInviteForm(true);
    requestAnimationFrame(() => {
      document.getElementById('supervisor-clerks-invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const clerkId = params.get('clerkId');
    if (clerkId) {
      const targetClerk = state.users.find((u) => u.id === clerkId && u.role === 'clerk');
      if (targetClerk) {
        setViewingClerk(targetClerk);
      }
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, state.users, location.pathname, navigate]);

  useEffect(() => {
    function onOpenInvite() {
      setShowInviteForm(true);
      requestAnimationFrame(() => {
        document.getElementById('supervisor-clerks-invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    window.addEventListener('ecunga-supervisor-team-open-invite', onOpenInvite);
    return () => window.removeEventListener('ecunga-supervisor-team-open-invite', onOpenInvite);
  }, []);

  async function submitClerkInvite(e) {
    e.preventDefault();
    try {
      const data = await inviteWorkspaceUser(inviteForm, actor?.id);
      if (data?.inviteEmailSent && data?.inviteEmailKind === 'otp') {
        showFlash(t('app.supervisor.teamInviteSuccessOtp'), 'ok');
      } else if (data?.inviteEmailSent && data?.inviteEmailKind === 'temporary_password') {
        showFlash(t('app.supervisor.teamInviteSuccessTempPasswordEmail'), 'ok');
      } else if (data?.temporaryPassword) {
        showFlash(t('app.supervisor.teamInviteSuccessTempPasswordManual', { password: data.temporaryPassword }), 'ok');
      }
      setInviteForm({ email: '', fullName: '', role: 'clerk', jobTitle: '', phone: '', location: '', department: '' });
      setShowInviteForm(false);
    } catch (err) {
      showFlash(err?.message || t('app.supervisor.teamInviteError'), 'error');
    }
  }
  const clerkUsers = useMemo(() => state.users.filter((entry) => entry.role === 'clerk'), [state.users]);
  const allItems = state.stockItems;
  const allConsumptions = state.consumptions;

  const clerkSummaries = useMemo(() => {
    const usageIndex = usageByClerk(allConsumptions, state.users);
    return clerkUsers.map((clerk) => {
      const items = allItems.filter((item) => item.ownerId === clerk.id);
      const usage = usageIndex.filter((entry) => entry.clerkId === clerk.id);
      const requisitions = requests.filter((entry) => entry.clerkId === clerk.id);
      const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const measures = [...new Set(items.map((item) => item.unit).filter(Boolean))].slice(0, 3).join(', ');
      const lowStock = items.filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0)).length;
      const unitTags = [...new Set(items.map((item) => item.unit).filter(Boolean))].slice(0, 4);
      return {
        clerk,
        items: items.length,
        totalUnits,
        measures,
        unitTags,
        lowStock,
        pending: requisitions.filter((entry) => entry.status === 'submitted').length,
        latestUsage: usage[0],
        okSkus: Math.max(0, items.length - lowStock),
      };
    });
  }, [clerkUsers, allItems, allConsumptions, state.users, requests]);

  function downloadMonthlyReport() {
    const headers = ['Clerk', 'Role', 'Phone', 'Location', 'Tracked items', 'Total units', 'Measures', 'Low stock', 'Pending approvals'];
    const rows = clerkSummaries.map((entry) => [
      entry.clerk.fullName,
      entry.clerk.jobTitle || entry.clerk.team || '',
      entry.clerk.phone || '',
      entry.clerk.location,
      entry.items,
      entry.totalUnits,
      entry.measures || 'units',
      entry.lowStock,
      entry.pending,
    ]);
    downloadAoAAsXlsx('supervisor-monthly-clerk-report', [headers, ...rows], 'Monthly summary');
  }

  function downloadClerkMonthlyReport(clerk) {
    const monthKey = new Date().toISOString().slice(0, 7);
    const rows = buildClerkMonthlyCsvRows(clerk, state);
    downloadAoAAsXlsx(`clerk-monthly-${sanitizeFilePart(clerk.fullName)}-${monthKey}`, rows, 'Clerk monthly');
  }

  return (
    <div className={ui.supervisorDash}>
      <FlashBanner />
      <div className={ui.supervisorDashTop}>
        <div>
          <h1 className={ui.supervisorDashTitle}>{t('app.supervisor.clerksTitle')}</h1>
          <p className={ui.visuallyHidden}>{t('app.supervisor.clerksPageLead')}</p>
        </div>
        <div className={ui.supervisorClerksTopActions}>
          <button type="button" className={ui.supervisorReportBtn} onClick={downloadMonthlyReport}>
            {t('app.supervisor.clerksDownloadMonthly')}
          </button>
          <button
            type="button"
            className={ui.adminUsersAddBtn}
            onClick={() => setShowInviteForm((c) => !c)}
            disabled={state.users.length >= (state.company?.usersLimit || 999)}
            aria-expanded={showInviteForm}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14M19 7h-4M7 19v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {t('app.supervisor.teamAddClerk')}
          </button>
        </div>
      </div>

      {showInviteForm ? (
        <section id="supervisor-clerks-invite-section" className={ui.adminUsersInviteCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h2 className={ui.adminUsersSectionTitle}>{t('app.supervisor.teamInviteTitleClerk')}</h2>
              <p className={ui.adminUsersSectionMeta}>{t('app.supervisor.teamInviteMetaClerk')}</p>
            </div>
          </div>
          <form onSubmit={submitClerkInvite} className={ui.adminUsersInviteForm}>
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldEmail')}
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              required
            />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldName')}
              value={inviteForm.fullName}
              onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
              required
            />
            <span className={ui.adminUsersSectionMeta} style={{ alignSelf: 'center', padding: '0 0.25rem' }}>
              {t('roles.clerk')}
            </span>
            <input
              className={ui.input}
              placeholder={t('accountPages.jobTitleLabel')}
              value={inviteForm.jobTitle}
              onChange={(e) => setInviteForm({ ...inviteForm, jobTitle: e.target.value })}
              required
            />
            <input
              className={ui.input}
              type="tel"
              autoComplete="tel"
              placeholder={t('app.supervisor.teamFieldPhone')}
              value={inviteForm.phone}
              onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
              required
            />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldLocation')}
              value={inviteForm.location}
              onChange={(e) => setInviteForm({ ...inviteForm, location: e.target.value })}
              required
            />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldDepartment')}
              value={inviteForm.department}
              onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
              required
            />
            <button type="submit" className={ui.adminPrimaryBtn} disabled={state.users.length >= state.company.usersLimit}>
              {t('app.supervisor.teamSaveClerk')}
            </button>
          </form>
        </section>
      ) : null}

      <SupervisorUserViewModal isOpen={Boolean(viewingClerk)} user={viewingClerk} onClose={() => setViewingClerk(null)} />
      <AdminUserEditModal
        isOpen={Boolean(editingClerk)}
        user={editingClerk}
        onClose={() => setEditingClerk(null)}
        onSave={async (patch) => {
          try {
            await updateWorkspaceUser(editingClerk.id, patch, actor?.id);
            setEditingClerk(null);
            showFlash(t('app.supervisor.clerksCrudUpdated'), 'ok');
          } catch (err) {
            showFlash(err?.message || 'Unable to update user.', 'error');
          }
        }}
        isPlatformTenant={false}
        supervisorOperationalRoster
      />
      <AdminDeleteConfirmModal
        isOpen={Boolean(deletingClerk)}
        user={deletingClerk}
        onClose={() => setDeletingClerk(null)}
        onConfirm={async () => {
          if (deletingClerk?.id === user?.id) {
            showFlash(t('app.supervisor.teamCannotDeleteSelf'), 'error');
            throw new Error('Cannot delete self');
          }
          try {
            await deleteWorkspaceUser(deletingClerk.id, actor?.id);
            const name = deletingClerk.fullName || deletingClerk.email || 'Member';
            showFlash(t('app.supervisor.clerksCrudDeleted', { name }), 'ok');
          } catch (err) {
            showFlash(err?.message || 'Unable to delete user.', 'error');
            throw err;
          }
        }}
      />

      <section className={ui.supervisorClerkCard}>
        <div className={ui.supervisorSectionHead}>
          <div>
            <h2 className={ui.supervisorSectionTitle}>{t('app.supervisor.clerksSectionTitle')}</h2>
            <p className={ui.visuallyHidden}>{t('app.supervisor.clerksSectionMeta')}</p>
          </div>
          <button
            type="button"
            className={ui.supervisorTextBtn}
            onClick={() => navigate('/app/supervisor/team')}
            aria-label={t('app.supervisor.clerksInviteTeam')}
            title={t('app.supervisor.clerksInviteTeam')}
          >
            →
          </button>
        </div>
        {clerkSummaries.length ? (
          <div className={ui.supervisorClerkGrid}>
            <div className={ui.supervisorClerkHeaderRow}>
              <span>No</span>
              <span>Names</span>
              <span>{t('app.supervisor.clerksTableRole')}</span>
              <span>Location</span>
              <span>{t('app.supervisor.clerksTablePhone')}</span>
              <span>Total items</span>
              <span>Actions</span>
            </div>
            {clerkSummaries.map((entry) => {
              const rowNumber = clerkSummaries.findIndex((x) => x.clerk.id === entry.clerk.id) + 1;
              return (
                <article key={entry.clerk.id} className={ui.supervisorClerkSummary}>
                  <div className={ui.supervisorClerkTableRow}>
                    <span>{rowNumber}</span>
                    <span>
                      {entry.clerk.fullName}
                      {!entry.clerk.isActive ? (
                        <span className={ui.supervisorClerkInactiveBadge}> ({t('app.supervisor.teamStatusInactive')})</span>
                      ) : null}
                    </span>
                    <span>{(entry.clerk.jobTitle || entry.clerk.team || '').trim() || '—'}</span>
                    <span>{entry.clerk.location || '—'}</span>
                    <span>{entry.clerk.phone || '—'}</span>
                    <span>{entry.items}</span>
                    <div className={ui.supervisorClerkActions}>
                      <button
                        type="button"
                        className={ui.supervisorClerkIconBtn}
                        onClick={() => setViewingClerk(entry.clerk)}
                        aria-label={t('app.supervisor.clerksCrudViewAria')}
                        title={t('app.supervisor.clerksCrudViewAria')}
                      >
                        <ClerkRowIcon kind="view" />
                      </button>
                      <button
                        type="button"
                        className={ui.supervisorClerkIconBtn}
                        onClick={() => setEditingClerk(entry.clerk)}
                        aria-label={t('app.supervisor.clerksCrudEditAria')}
                        title={t('app.supervisor.clerksCrudEditAria')}
                      >
                        <ClerkRowIcon kind="edit" />
                      </button>
                      <button
                        type="button"
                        className={ui.supervisorClerkIconBtn}
                        onClick={() => {
                          if (entry.clerk.id === user?.id) {
                            showFlash(t('app.supervisor.teamCannotDeleteSelf'), 'error');
                            return;
                          }
                          setDeletingClerk(entry.clerk);
                        }}
                        disabled={entry.clerk.id === user?.id}
                        aria-label={t('app.supervisor.clerksCrudDeleteAria')}
                        title={t('app.supervisor.clerksCrudDeleteAria')}
                      >
                        <ClerkRowIcon kind="delete" />
                      </button>
                      <button
                        type="button"
                        className={ui.supervisorClerkIconBtn}
                        onClick={() => downloadClerkMonthlyReport(entry.clerk)}
                        aria-label={t('app.supervisor.clerksCardExcelAria')}
                        title={t('app.supervisor.clerksCardExcelAria')}
                      >
                        <ClerkRowIcon kind="download" />
                      </button>
                      <button
                        type="button"
                        className={ui.supervisorClerkIconBtn}
                        onClick={() =>
                          navigate(`/app/supervisor/visibility?clerk=${encodeURIComponent(entry.clerk.id)}`)
                        }
                        aria-label={t('app.supervisor.clerksCardInvAria')}
                        title={t('app.supervisor.clerksCardInvAria')}
                      >
                        <ClerkRowIcon kind="inventory" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={ui.supervisorSectionMeta}>{t('app.supervisor.clerksEmpty')}</p>
        )}
      </section>
    </div>
  );
}

export const SupervisorVisibility = React.memo(function SupervisorVisibility() {
  const { t } = useI18n();
  const { state, deleteStockItem, portalLoading } = usePortalData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const alertsOnly = searchParams.get('alerts') === '1';
  const clerkParam = String(searchParams.get('clerk') || '').trim();
  const clerkFilterUser = useMemo(() => {
    if (!clerkParam) return null;
    const u = state.users.find((x) => x.id === clerkParam);
    if (!u || u.role !== 'clerk') return null;
    return u;
  }, [clerkParam, state.users]);

  useEffect(() => {
    if (portalLoading) return;
    if (!clerkParam) return;
    if (clerkFilterUser) return;
    const next = new URLSearchParams(searchParams);
    next.delete('clerk');
    setSearchParams(next, { replace: true });
  }, [portalLoading, clerkParam, clerkFilterUser, searchParams, setSearchParams]);

  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [warehouse, setWarehouse] = useState('all');
  const [invSearch, setInvSearch] = useState('');
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  /** Master-catalog row from "Recommended for …" — opens add modal with fields pre-filled (not edit-by-id). */
  const [addModalMasterPrefill, setAddModalMasterPrefill] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const shellInvSearch = useShellSearchQuery();

  useEffect(() => {
    setCategory('all');
    setStatus('all');
    setWarehouse('all');
    setInvSearch('');
  }, [clerkParam]);

  const allRows = state.stockItems.map((item) => ({
    ...item,
    status: stockStatus(item),
  }));
  const scopeRows = useMemo(() => {
    if (!clerkFilterUser) return allRows;
    return allRows.filter((item) => item.ownerId === clerkFilterUser.id);
  }, [allRows, clerkFilterUser]);
  const categories = useMemo(() => {
    if (isHealthcareCompany(state.company)) return HEALTHCARE_STOCK_CATEGORIES;
    return [...new Set(scopeRows.map((item) => item.category).filter(Boolean))].sort();
  }, [state.company, scopeRows]);
  const warehouses = [...new Set(scopeRows.map((item) => item.location).filter(Boolean))];
  const invSearchTokens = [invSearch, shellInvSearch]
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
  const filteredRows = scopeRows.filter((item) => {
    if (category !== 'all') {
      if (isHealthcareCompany(state.company)) {
        if (normalizeToHealthcareCategory(item.category) !== category) return false;
      } else if (item.category !== category) return false;
    }
    if (alertsOnly) {
      if (item.status !== 'Low stock' && item.status !== 'Out of stock') return false;
      if (status !== 'all' && item.status !== status) return false;
    } else if (status !== 'all' && item.status !== status) return false;
    if (warehouse !== 'all' && item.location !== warehouse) return false;
    const hay = `${item.name} ${item.sku || ''} ${item.category || ''}`.toLowerCase();
    if (invSearchTokens.length && !invSearchTokens.every((tok) => hay.includes(tok))) return false;
    return true;
  });
  const invPager = usePagedList(filteredRows, {
    resetKey: `${clerkParam}|${category}|${status}|${warehouse}|${invSearch}|${shellInvSearch}|${alertsOnly ? '1' : '0'}`,
  });
  const totalAssetUnits = scopeRows.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalLocations = warehouses.length;
  const unitMixSummary = useMemo(() => {
    const map = scopeRows.reduce((m, item) => {
      const u = item.unit || 'units';
      m.set(u, (m.get(u) || 0) + 1);
      return m;
    }, new Map());
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([u, c]) => `${c} line${c === 1 ? '' : 's'} in ${u}`)
      .slice(0, 6)
      .join(' · ');
  }, [scopeRows]);
  const lowStockRows = scopeRows
    .filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0))
    .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0));
  const predictiveItem = lowStockRows[0] || scopeRows[0];
  const recentActivity = [...state.activity].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

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
  const recRawList = useMemo(() => {
    const master = state.masterStock || [];
    const suppliers = (state.supplierCatalog || []).filter(c => c.listed);
    return [...master, ...suppliers];
  }, [state.masterStock, state.supplierCatalog]);

  const recList = useMemo(
    () => filterMasterRecommendations(recRawList, recSearch),
    [recRawList, recSearch]
  );
  const recTotal = recList.length;
  const recVisible = Math.min(recVisibleCount, recTotal);
  const recSlice = recList.slice(0, recVisible);
  const recCanMore = recVisible < recTotal;
  const recCanLess = recVisible > RECOMMENDATIONS_PAGE;

  function exportInventoryCsv() {
    const headers = ['SKU', 'Item', 'Category', 'Quantity', 'Unit', 'Max threshold', 'Status', 'Warehouse'];
    const rows = filteredRows.map((item) => [item.sku, item.name, item.category, item.quantity, item.unit, item.maxThreshold, item.status, item.location]);
    downloadAoAAsXlsx('supervisor-inventory-overview', [headers, ...rows], 'Inventory');
  }

  function clearFilters() {
    setCategory('all');
    setStatus('all');
    setWarehouse('all');
    setInvSearch('');
    const next = new URLSearchParams(searchParams);
    next.delete('clerk');
    if (alertsOnly) next.delete('alerts');
    setSearchParams(next, { replace: true });
  }

  function clearClerkScope() {
    const next = new URLSearchParams(searchParams);
    next.delete('clerk');
    setSearchParams(next, { replace: true });
  }

  return (
    <div className={ui.supervisorInventoryBoard}>
      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title="Delete Item"
        message={`Permanently delete ${deletingItem?.name}?`}
        confirmText="Delete"
        onConfirm={async () => {
          try {
            await deleteStockItem(deletingItem.id);
            if (selectedDetailItem?.id === deletingItem.id) setSelectedDetailItem(null);
          } catch (e) {
            const { useFlash } = await import('../../context/FlashContext.jsx');
            const flash = useFlash().showFlash || alert;
            flash(e?.message || 'Unable to delete item.', 'error');
            throw e;
          }
        }}
        onClose={() => setDeletingItem(null)}
      />
      <div className={ui.supervisorInventoryHeader}>
        <div>
          <h1 className={ui.supervisorInventoryTitle}>
            {clerkFilterUser ? t('app.supervisor.inventoryClerkTitle') : t('app.supervisor.inventoryTitle')}
          </h1>
          {clerkFilterUser ? (
            <p className={ui.supervisorInventoryLead}>
              {t('app.supervisor.inventoryClerkScopeLead', { name: clerkFilterUser.fullName || clerkFilterUser.email })}
            </p>
          ) : null}
          <p className={ui.supervisorInventoryLead} aria-hidden={Boolean(clerkFilterUser)}>
            {totalAssetUnits.toLocaleString()} u · {totalLocations} WH
          </p>
          <p className={ui.visuallyHidden}>
            {totalAssetUnits.toLocaleString()} total units across {totalLocations} warehouse locations.
            {unitMixSummary ? ` Unit mix: ${unitMixSummary}.` : ''}
          </p>
          {clerkFilterUser ? (
            <button type="button" className={ui.supervisorTextLink} onClick={clearClerkScope}>
              {t('app.supervisor.inventoryViewAll')}
            </button>
          ) : null}
        </div>
        <div className={ui.supervisorInventoryActions}>
          <button type="button" className={ui.inventoryDownloadBtn} onClick={exportInventoryCsv}>
            Export Excel
          </button>
          <button
            type="button"
            className={ui.supervisorInventoryPrimaryBtn}
            onClick={() => {
              setEditingItem(null);
              setAddModalMasterPrefill(null);
              setShowAddModal(true);
            }}
          >
            + Add New SKU
          </button>
        </div>
      </div>

      <div className={ui.supervisorInventoryFilters}>
        <div className={ui.supervisorInventoryFilterGrid}>
          <label className={ui.supervisorInventoryFilter}>
            <span className={ui.supervisorInventoryFilterLabel}>Search</span>
            <input
              type="search"
              className={ui.portalFilterSearch}
              placeholder="Name, SKU, category…"
              value={invSearch}
              onChange={(event) => {
                setInvSearch(event.target.value);
              }}
            />
          </label>
          <label className={ui.supervisorInventoryFilter}>
            <span className={ui.supervisorInventoryFilterLabel}>Category</span>
            <InventoryFilterSelect
              value={category}
              onChange={setCategory}
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map((entry) => ({
                  value: entry,
                  label: categoryFilterOptionLabel(entry, state.company),
                })),
              ]}
            />
          </label>
          <label className={ui.supervisorInventoryFilter}>
            <span className={ui.supervisorInventoryFilterLabel}>Status</span>
            <InventoryFilterSelect
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'In stock', label: 'In Stock' },
                { value: 'Low stock', label: 'Low Stock' },
                { value: 'Out of stock', label: 'Out of Stock' },
              ]}
            />
          </label>
          <label className={ui.supervisorInventoryFilter}>
            <span className={ui.supervisorInventoryFilterLabel}>Warehouse</span>
            <InventoryFilterSelect
              value={warehouse}
              onChange={setWarehouse}
              options={[
                { value: 'all', label: 'Global View' },
                ...warehouses.map((entry) => ({ value: entry, label: entry })),
              ]}
            />
          </label>
        </div>
        <div className={ui.supervisorInventoryFiltersActions}>
          <ClearFiltersIconButton className={ui.supervisorInventoryClearIcon} title={t('common.clearFiltersAria')} onClick={clearFilters} />
        </div>
      </div>

      <div className={ui.supervisorInventoryTable}>
        <div className={ui.supervisorInventoryGrid}>
          {['SKU', 'Item Name', 'Category', 'Stock Level', 'Status', 'Warehouse', 'Actions'].map((label) => (
            <span key={label} className={ui.supervisorInventoryTh}>
              {label}
            </span>
          ))}
          {invPager.pageSlice.map((item) => {
            const levelPct = Math.max(0, Math.min(100, (Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 1))) * 100));
            const statusClass =
              item.status === 'Out of stock'
                ? `${ui.inventoryStatusPill} ${ui.inventoryStatusBad}`
                : item.status === 'Low stock'
                  ? `${ui.inventoryStatusPill} ${ui.inventoryStatusWarn}`
                  : `${ui.inventoryStatusPill} ${ui.inventoryStatusOk}`;
            return (
              <Fragment key={item.id}>
                <div className={`${ui.supervisorInventorySku} ${ui.supervisorInventoryTd}`}>{item.sku}</div>
                <div className={`${ui.supervisorInventoryNameCell} ${ui.supervisorInventoryTd}`}>
                  <span className={ui.supervisorInventoryItemName}>{item.name}</span>
                  <span className={ui.supervisorInventoryItemMeta}>Warehouse: {item.location}</span>
                </div>
                <div className={ui.supervisorInventoryTd}>
                  <span className={ui.inventoryCategoryPill}>{categoryFilterOptionLabel(item.category, state.company)}</span>
                </div>
                <div className={`${ui.inventoryLevelCell} ${ui.supervisorInventoryLevelCell} ${ui.supervisorInventoryTd}`}>
                  <div className={ui.inventoryLevelNumbers}>
                    <strong>
                      {item.quantity} {item.unit || ''}
                    </strong>
                    <span>
                      min {item.minThreshold} · max {item.maxThreshold} {item.unit || ''} · {Math.round(levelPct)}%
                    </span>
                  </div>
                </div>
                <div className={ui.supervisorInventoryTd}>
                  <span className={statusClass}>{item.status}</span>
                </div>
                <div className={`${ui.supervisorInventoryWarehouse} ${ui.supervisorInventoryTd}`}>{item.location}</div>
                <div className={`${ui.supervisorInventoryActionCell} ${ui.supervisorInventoryTd}`}>
                  <button type="button" className={ui.supervisorInventoryActionBtn} onClick={() => navigate('/app/supervisor/approvals')}>
                    Restock
                  </button>
                  <button type="button" className={ui.supervisorInventoryActionBtnGhost} onClick={() => setSelectedDetailItem(item)}>
                    View
                  </button>
                  <button
                    type="button"
                    className={ui.supervisorInventoryActionBtnIcon}
                    title="Edit Item"
                    onClick={() => {
                      setEditingItem(item);
                      setAddModalMasterPrefill(null);
                      setShowAddModal(true);
                    }}
                  >
                    ✎
                  </button>
                  <button type="button" className={ui.supervisorInventoryActionBtnIcon} title="Delete Item" onClick={() => setDeletingItem(item)} style={{ color: '#ef4444' }}>
                    ✕
                  </button>
                </div>
              </Fragment>
            );
          })}
        </div>

        <StockItemDetailModal
          isOpen={Boolean(selectedDetailItem)}
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
        />

        <AddItemModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setAddModalMasterPrefill(null);
          }}
          item={editingItem}
          prefillMaster={addModalMasterPrefill}
        />

        <ListPageControls
          className={ui.supervisorInventoryPager}
          variant="table"
          rangeFrom={invPager.rangeFrom}
          rangeTo={invPager.rangeTo}
          total={invPager.total}
          page={invPager.page}
          pageCount={invPager.pageCount}
          pagerNums={invPager.pagerNums}
          onPrev={invPager.goPrev}
          onNext={invPager.goNext}
          onSelectPage={invPager.setPage}
          canPrev={invPager.canPrev}
          canNext={invPager.canNext}
        />
      </div>

      <div className={ui.supervisorInventoryBottom}>
        <section className={ui.supervisorInsightCard}>
          <p className={ui.supervisorInsightEyebrow}>{t('app.supervisor.inventoryPredictiveEyebrow')}</p>
          <p className={ui.supervisorInsightText}>
            {lowStockRows.length > 0
              ? t('app.supervisor.inventoryPredictiveBodyLow', {
                  name: predictiveItem?.name || '—',
                  location: predictiveItem?.location || t('app.supervisor.inventoryPredictiveLocationUnknown'),
                })
              : t('app.supervisor.inventoryPredictiveBodyNone')}
          </p>
          <button type="button" className={ui.supervisorInsightBtn} onClick={() => navigate('/app/supervisor/approvals')}>
            {t('app.supervisor.inventoryPredictiveRestockBtn')}
          </button>
        </section>

        <aside className={ui.supervisorActivityRail}>
          <div className={ui.sectorRecommendations}>
            <h3 className={ui.sectorRecommendationsTitle}>Recommended for {state.company?.type || 'Healthcare'}</h3>
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
                        <div key={m._id || m.id} className={ui.sectorRecommendationsCard}>
                          <div className={ui.sectorRecommendationsCardName}>{m.name}</div>
                          <div className={ui.sectorRecommendationsCardCat}>
                            {categoryFilterOptionLabel(m.category, state.company)}
                            {m.supplierId && (
                              <span style={{ marginLeft: '4px', opacity: 0.7, fontSize: '0.9em' }}>
                                · Supplier
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className={ui.sectorRecommendationsCardBtn}
                            onClick={() => {
                              setEditingItem(null);
                              setAddModalMasterPrefill(m);
                              setShowAddModal(true);
                            }}
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

          <p className={ui.supervisorActivityRailLabel}>Recent System Activity</p>
          <div className={ui.supervisorActivityRailList}>
            {recentActivity.map((entry) => (
              <article key={entry.id} className={ui.supervisorActivityRailRow}>
                <span className={ui.supervisorActivityDot} />
                <div>
                  <p className={ui.supervisorActivityRailTitle}>{describeActivityEntry(entry, t)}</p>
                  <p className={ui.supervisorActivityRailMeta}>
                    {entry.actorName} - {formatDate(entry.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <button type="button" className={ui.supervisorActivityRailBtn} onClick={() => navigate('/app/supervisor/reports')}>
            View All Logs
          </button>
        </aside>
      </div>
    </div>
  );
});

function StockItemDetailModal({ isOpen, item, onClose }) {
  const { t } = useI18n();
  const { state } = usePortalData();
  if (!isOpen || !item) return null;

  const levelPct = Math.max(5, Math.min(100, (Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 100))) * 100));
  const isLow = Number(item.quantity || 0) <= Number(item.minThreshold || 0);

  return (
    <div className={ui.modalOverlay} role="dialog" aria-modal="true" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className={ui.modalCard} style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className={ui.modalHead}>
          <div>
            <h2 className={ui.modalTitle}>{item.name}</h2>
            <p className={ui.modalSubtitle}>SKU: {item.sku || 'N/A'} · {item.category}</p>
          </div>
          <button type="button" className={ui.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={ui.modalBody} style={{ padding: '1.5rem' }}>
          <div className={ui.detailGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <section>
              <h3 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--ec-muted)', marginBottom: '0.5rem', fontWeight: 800 }}>Stock Level</h3>
              <div style={{ fontSize: '2.4rem', fontWeight: '900', color: isLow ? '#ef4444' : 'var(--ec-text)', letterSpacing: '-0.02em' }}>
                {item.quantity} <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--ec-muted)' }}>{item.unit || 'units'}</span>
              </div>
              <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', marginTop: '1.2rem', overflow: 'hidden' }}>
                <div style={{ width: `${levelPct}%`, height: '100%', background: isLow ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius: '5px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--ec-muted)' }}>
                <span>Min: {item.minThreshold}</span>
                <span>Max: {item.maxThreshold}</span>
              </div>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--ec-muted)', margin: 0, fontWeight: 800 }}>Warehouse Location</h4>
                <p style={{ margin: '0.35rem 0 0', fontWeight: '700', fontSize: '0.95rem' }}>{item.location || 'Main Store'}</p>
              </div>
              <div>
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--ec-muted)', margin: 0, fontWeight: 800 }}>Batch & Traceability</h4>
                <p style={{ margin: '0.35rem 0 0', fontWeight: '700', fontSize: '0.95rem' }}>{item.batchNumber || 'BN-8829-X'}</p>
              </div>
              <div>
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--ec-muted)', margin: 0, fontWeight: 800 }}>Expiry Status</h4>
                <p style={{ margin: '0.35rem 0 0', fontWeight: '700', fontSize: '0.95rem', color: item.expiryDate ? '#ef4444' : 'var(--ec-text)' }}>
                  {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'No expiry date set'}
                </p>
              </div>
            </section>
          </div>

          <div style={{ marginTop: '2.5rem', padding: '1.25rem', background: 'linear-gradient(145deg, #f8fafc, #f1f5f9)', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: '900', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inventory Log Summary</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Stock registered initially</span>
                <span style={{ color: 'var(--ec-muted)', fontSize: '0.75rem' }}>2 days ago</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Threshold calibration</span>
                <span style={{ color: 'var(--ec-muted)', fontSize: '0.75rem' }}>1 week ago</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>System audit performed</span>
                <span style={{ color: 'var(--ec-muted)', fontSize: '0.75rem' }}>2 weeks ago</span>
              </li>
            </ul>
          </div>
        </div>

        <div className={ui.modalActions} style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '1.25rem 1.5rem' }}>
          <button type="button" className={ui.modalSecondaryBtn} onClick={onClose}>Close Details</button>
          <button type="button" className={ui.materialsSubmitBtn} onClick={() => {
            onClose();
            window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal', { detail: { item } }));
          }}>
            Edit Details
          </button>
        </div>
      </div>
    </div>
  );
}

export function SupervisorApprovals() {
  const { t } = useI18n();
  const { showFlash } = useFlash();
  const { state, reviewRequisition } = usePortalData();
  const { user } = useAuth();
  const actor = useSupervisorActor(state, user);
  const navigate = useNavigate();
  const [note, setNote] = useState({});
  const [selectedSupplierId, setSelectedSupplierId] = useState({});
  const [reviewError, setReviewError] = useState(null);
  const [reviewSubmittingId, setReviewSubmittingId] = useState(null);
  const [supplierErrorId, setSupplierErrorId] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [locFilter, setLocFilter] = useState('all');
  const [reqSearch, setReqSearch] = useState('');
  const [pdfPreviewReq, setPdfPreviewReq] = useState(null);
  const shellReqSearch = useShellSearchQuery();
  const approvalLocations = useMemo(
    () => [...new Set(state.requisitions.map((r) => r.location).filter(Boolean))].sort(),
    [state.requisitions]
  );
  const searchTokens = useMemo(
    () => approvalSearchTokensFromInputs(reqSearch, shellReqSearch),
    [reqSearch, shellReqSearch]
  );
  const requests = useMemo(() => {
    const base =
      filter === 'pending'
        ? state.requisitions.filter((entry) => isAwaitingSupervisorApproval(entry.status))
        : filter === 'submitted'
          ? state.requisitions.filter((entry) => isSentToSupplierWorkflow(entry.status))
          : filter === 'rejected'
            ? state.requisitions.filter((entry) => isRejectedRequisition(entry.status))
            : state.requisitions;
    return base.filter((entry) => {
      if (locFilter !== 'all' && entry.location !== locFilter) return false;
      return requisitionMatchesApprovalSearch(entry, searchTokens);
    });
  }, [state.requisitions, filter, locFilter, searchTokens]);
  const sortedRequests = useMemo(
    () => [...requests].sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0)),
    [requests]
  );
  const approvalReqPager = usePagedList(sortedRequests, { resetKey: `${filter}|${locFilter}|${reqSearch}|${shellReqSearch}` });
  const pendingCount = state.requisitions.filter((entry) => isAwaitingSupervisorApproval(entry.status)).length;
  const submittedPipelineCount = state.requisitions.filter((entry) => isSentToSupplierWorkflow(entry.status)).length;
  const rejectedCount = state.requisitions.filter((entry) => isRejectedRequisition(entry.status)).length;
  const approvalHistory = [...state.activity]
    .filter((entry) => ['stock.request.approved', 'stock.request.created', 'workflow.closed'].includes(entry.action))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);
  const healthPct = Math.max(
    80,
    Math.round(
      (state.stockItems.filter((item) => Number(item.quantity || 0) > Number(item.minThreshold || 0)).length / Math.max(1, state.stockItems.length)) * 100
    )
  );

  /** Only supplier user accounts linked to this workspace (Suppliers page), not the public marketplace directory. */
  const linkedWorkspaceSuppliers = useMemo(() => {
    return state.users
      .filter((u) => u.role === 'supplier' && u.isActive)
      .map((u) => ({
        id: u.id,
        companyName: u.companyName || u.fullName || u.email || 'Supplier',
      }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }));
  }, [state.users]);

  async function review(id, decision) {
    setReviewError(null);
    if (decision === 'approved' && !String(selectedSupplierId[id] || '').trim()) {
      setSupplierErrorId(id);
      showFlash(t('app.supervisor.approvalSupplierRequired'), 'warn');
      return;
    }
    setSupplierErrorId(null);
    setReviewSubmittingId(id);
    showFlash(
      decision === 'approved' ? t('app.supervisor.approvalToastSubmittingApprove') : t('app.supervisor.approvalToastSubmittingReject'),
      'loading'
    );
    try {
      await reviewRequisition(id, decision, note[id] || '', selectedSupplierId[id]);
      if (decision === 'approved') {
        setFilter('submitted');
        showFlash(t('app.supervisor.approvalToastApproved'), 'ok');
      } else if (decision === 'rejected') {
        setFilter('rejected');
        showFlash(t('app.supervisor.approvalToastRejected'), 'warn');
      }
    } catch (e) {
      const msg = e.message || t('app.supervisor.approvalToastError');
      setReviewError(msg);
      showFlash(msg, 'error');
    } finally {
      setReviewSubmittingId(null);
    }
  }

  return (
    <div className={ui.supervisorApprovalBoard}>
      {reviewError ? (
        <div className={ui.panel} style={{ marginBottom: '1rem' }}>
          <p className={ui.panelSub}>{reviewError}</p>
          <button
            type="button"
            className={ui.supervisorTextBtn}
            onClick={() => {
              setReviewError(null);
              setSupplierErrorId(null);
            }}
          >
            {t('app.supervisor.approvalDismiss')}
          </button>
        </div>
      ) : null}
      <div className={ui.supervisorApprovalTop}>
        <div>
          <p className={ui.supervisorApprovalEyebrow}>{t('app.supervisor.approvalEyebrow')}</p>
          <h1 className={ui.supervisorApprovalTitle}>{t('app.supervisor.approvalTitle')}</h1>
          <p className={ui.supervisorApprovalLead}>{t('app.supervisor.approvalPageLead')}</p>
        </div>
        <div className={ui.supervisorApprovalStatRow}>
          <article className={ui.supervisorApprovalStat}>
            <span className={ui.supervisorApprovalStatLabel}>{t('app.supervisor.approvalStatPending')}</span>
            <strong className={ui.supervisorApprovalStatValue}>{String(pendingCount).padStart(2, '0')}</strong>
          </article>
          <article className={ui.supervisorApprovalStat}>
            <span className={ui.supervisorApprovalStatLabel}>{t('app.supervisor.approvalStatWithSupplier')}</span>
            <strong className={ui.supervisorApprovalStatValue}>{String(submittedPipelineCount).padStart(2, '0')}</strong>
          </article>
          <article className={ui.supervisorApprovalStat}>
            <span className={ui.supervisorApprovalStatLabel}>{t('app.supervisor.approvalStatRejected')}</span>
            <strong className={ui.supervisorApprovalStatValue}>{String(rejectedCount).padStart(2, '0')}</strong>
          </article>
        </div>
      </div>

      <div className={ui.toolbar}>
        <div className={ui.segmented}>
          {(
            [
              ['pending', t('app.supervisor.approvalFilterPending')],
              ['submitted', t('app.supervisor.approvalFilterSubmitted')],
              ['rejected', t('app.supervisor.approvalFilterRejected')],
              ['all', t('app.supervisor.approvalFilterAll')],
            ]
          ).map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? ui.segBtnActive : ui.segBtn} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>{t('app.supervisor.approvalLocationLabel')}</span>
          <InventoryFilterSelect
            value={locFilter}
            onChange={setLocFilter}
            options={[
              { value: 'all', label: t('app.supervisor.approvalLocationAll') },
              ...approvalLocations.map((loc) => ({ value: loc, label: loc })),
            ]}
          />
        </label>
        <label className={ui.portalFilterField} style={{ flex: '1 1 14rem', maxWidth: '24rem' }}>
          <span className={ui.portalFilterLabel}>{t('app.supervisor.approvalSearchLabel')}</span>
          <input
            className={ui.portalFilterSearch}
            placeholder={t('app.supervisor.approvalSearchPh')}
            value={reqSearch}
            onChange={(e) => setReqSearch(e.target.value)}
          />
        </label>
        <ClearFiltersIconButton
          title={t('common.clearFiltersAria')}
          onClick={() => {
            setLocFilter('all');
            setReqSearch('');
          }}
        />
        <span className={ui.portalFilterMeta}>{t('app.supervisor.approvalInView', { n: requests.length })}</span>
      </div>

      <div className={ui.supervisorApprovalGrid}>
        <section className={ui.supervisorApprovalList}>
          {sortedRequests.length ? (
            approvalReqPager.pageSlice.map((request, index) => {
              const isSubmitting = reviewSubmittingId === request.id;
              const supplierProformaInv =
                request.status === 'proformaAwaitingClerk'
                  ? (state.invoices || []).find(
                      (i) => String(i.requisitionId) === String(request.id) && i.type === 'proforma'
                    )
                  : null;
              const lineCount = request.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
              const primaryLine = request.lines[0];
              const priorityTone =
                request.priority === 'critical' || request.priority === 'high'
                  ? ui.supervisorApprovalPriorityHot
                  : request.priority === 'normal'
                    ? ui.supervisorApprovalPriorityWarm
                    : ui.supervisorApprovalPriorityCool;
              const clerkJustification = String(request.clerkJustification || '').trim();
              const quoteIsFromClerk = Boolean(clerkJustification);
              const quoteBody = quoteIsFromClerk
                ? clerkJustification
                : request.status === 'submitted'
                  ? t('app.supervisor.approvalCardNoteFallback', {
                      desc: primaryLine?.description || t('app.supervisor.approvalCardDescFallback'),
                      location: request.location || '—',
                      count: request.lines.length,
                    })
                  : String(request.supervisorNote || '').trim() ||
                    t('app.supervisor.approvalCardNoteFallback', {
                      desc: primaryLine?.description || t('app.supervisor.approvalCardDescFallback'),
                      location: request.location || '—',
                      count: request.lines.length,
                    });

              return (
                <article key={request.id} className={ui.supervisorApprovalCard}>
                  <div className={ui.supervisorApprovalIconWrap}>
                    <span className={ui.iconTile}>
                      <SupervisorIcon kind={index % 2 === 0 ? 'approval' : 'overview'} />
                    </span>
                  </div>
                  <div className={ui.supervisorApprovalBody}>
                    <div className={ui.supervisorApprovalHead}>
                      <div>
                        <div className={ui.supervisorApprovalTitleRow}>
                          <h2 className={ui.supervisorApprovalCardTitle}>{request.title}</h2>
                          <button
                            type="button"
                            className={`${ui.supervisorApprovalRequestId} ${ui.supervisorApprovalRequestIdBtn}`}
                            title={`${t('app.supervisor.approvalRequestIdLabel')}: ${request.id}`}
                            aria-label={t('app.supervisor.approvalRequestIdViewPdfAria', { id: request.id })}
                            onClick={() => setPdfPreviewReq(request)}
                          >
                            {request.id}
                          </button>
                          <span className={`${ui.supervisorApprovalPriority} ${priorityTone}`}>{request.priority}</span>
                        </div>
                        <div className={ui.supervisorApprovalMeta}>
                          <span>{request.clerkName}</span>
                          {request.requestingDepartment ? <span>{request.requestingDepartment}</span> : null}
                          <span>{formatDate(request.requestedAt)}</span>
                          <span>
                            {lineCount} {primaryLine?.unit || 'units'}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={workflowLabel(request.status)} />
                    </div>

                    <div className={ui.supervisorApprovalQuote}>
                      {quoteIsFromClerk ? (
                        <p className={ui.supervisorApprovalQuoteLabel}>{t('app.supervisor.approvalCardClerkNoteLabel')}</p>
                      ) : null}
                      <p className={ui.supervisorApprovalText}>
                        &ldquo;{quoteBody}&rdquo;
                      </p>
                    </div>

                    <div className={ui.supervisorApprovalFoot}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                        <button type="button" className={ui.supervisorApprovalLink} onClick={() => setPdfPreviewReq(request)}>
                          {t('app.supervisor.approvalViewPdfLink')}
                        </button>
                        {supplierProformaInv?.attachmentUrl ? (
                          <button
                            type="button"
                            className={ui.supervisorApprovalLink}
                            onClick={() => {
                              const u = String(supplierProformaInv.attachmentUrl || '').trim();
                              if (!u) return;
                              const href = /^https?:\/\//i.test(u) ? u : u.startsWith('/') ? u : `/${u}`;
                              window.open(href, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            {t('app.supervisor.approvalViewSupplierProformaLink')}
                          </button>
                        ) : null}
                        <button type="button" className={ui.supervisorApprovalLink} onClick={() => navigate('/app/supervisor/invoices')}>
                          {t('app.supervisor.approvalViewJustification')}
                        </button>
                      </div>
                      {request.status === 'submitted' ? (
                        <div className={ui.supervisorApprovalActions}>
                          <div className={ui.supervisorApprovalFormRow}>
                            <div className={ui.supervisorApprovalSelectCol}>
                              <InventoryFilterSelect
                                disabled={isSubmitting || linkedWorkspaceSuppliers.length === 0}
                                value={selectedSupplierId[request.id] || ''}
                                onChange={(v) => {
                                  setSelectedSupplierId({ ...selectedSupplierId, [request.id]: v });
                                  if (v && supplierErrorId === request.id) setSupplierErrorId(null);
                                }}
                                options={[
                                  {
                                    value: '',
                                    label: linkedWorkspaceSuppliers.length
                                      ? t('app.supervisor.approvalSupplierPlaceholder')
                                      : t('app.supervisor.approvalNoLinkedSuppliers'),
                                  },
                                  ...linkedWorkspaceSuppliers.map((s) => ({ value: s.id, label: s.companyName })),
                                ]}
                              />
                              {supplierErrorId === request.id ? (
                                <p id={`approval-supplier-err-${request.id}`} className={ui.supervisorApprovalFieldError} role="alert">
                                  {t('app.supervisor.approvalSupplierRequired')}
                                </p>
                              ) : null}
                            </div>
                            <input
                              className={`${ui.supervisorApprovalInput} ${ui.supervisorApprovalNoteInput}`}
                              placeholder={t('app.supervisor.approvalSupervisorNotePh')}
                              disabled={isSubmitting}
                              value={note[request.id] || ''}
                              onChange={(event) => setNote({ ...note, [request.id]: event.target.value })}
                            />
                          </div>
                          <button
                            type="button"
                            className={ui.supervisorRejectBtn}
                            disabled={isSubmitting}
                            onClick={() => review(request.id, 'rejected')}
                          >
                            {isSubmitting ? (
                              <span className={ui.supervisorApprovalBtnInner}>
                                <span className={ui.supervisorApprovalSpinner} aria-hidden />
                                {t('app.supervisor.approvalActionWorking')}
                              </span>
                            ) : (
                              t('app.supervisor.approvalReject')
                            )}
                          </button>
                          <button
                            type="button"
                            className={ui.supervisorApproveBtn}
                            disabled={isSubmitting}
                            onClick={() => review(request.id, 'approved')}
                          >
                            {isSubmitting ? (
                              <span className={ui.supervisorApprovalBtnInner}>
                                <span className={ui.supervisorApprovalSpinner} aria-hidden />
                                {t('app.supervisor.approvalActionWorking')}
                              </span>
                            ) : (
                              t('app.supervisor.approvalApprove')
                            )}
                          </button>
                        </div>
                      ) : request.status === 'rejected' ? (
                        <div className={ui.supervisorApprovalRejectedBox}>
                          <p className={ui.supervisorApprovalRejectedLabel}>{t('app.supervisor.approvalRejectionReasonLabel')}</p>
                          <p className={ui.supervisorApprovalRejectedReason}>
                            {String(request.supervisorNote || '').trim() || t('app.supervisor.approvalRejectionNoNote')}
                          </p>
                        </div>
                      ) : (
                        <div className={ui.supervisorReviewedNote}>
                          {String(request.supplierName || '').trim()
                            ? t('app.supervisor.approvalRoutedWithSupplier', {
                                supplier: String(request.supplierName).trim(),
                              })
                            : request.supervisorNote || t('app.supervisor.approvalReviewedNote')}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className={ui.panel}>
              <h2 className={ui.panelTitle}>{t('app.supervisor.approvalEmptyTitle')}</h2>
              <p className={ui.panelSub}>{t('app.supervisor.approvalEmptySub')}</p>
              <p className={ui.visuallyHidden}>{t('app.supervisor.approvalQueueClearSr')}</p>
            </div>
          )}
          <ListPageControls
            variant="feed"
            rangeFrom={approvalReqPager.rangeFrom}
            rangeTo={approvalReqPager.rangeTo}
            total={approvalReqPager.total}
            page={approvalReqPager.page}
            pageCount={approvalReqPager.pageCount}
            pagerNums={approvalReqPager.pagerNums}
            onPrev={approvalReqPager.goPrev}
            onNext={approvalReqPager.goNext}
            onSelectPage={approvalReqPager.setPage}
            canPrev={approvalReqPager.canPrev}
            canNext={approvalReqPager.canNext}
          />
        </section>

        <aside className={ui.supervisorApprovalRail}>
          <section className={ui.supervisorApprovalInsight}>
            <h2 className={ui.supervisorApprovalRailTitle}>{t('cungaAi.approvalInsightsRail')}</h2>
            <div className={ui.supervisorApprovalInsightList}>
              <article className={ui.supervisorApprovalInsightCard}>
                <WorkspaceAiInsight
                  scope="supervisor"
                  showRefresh
                  fallbackText={`Prioritise requisitions waiting on suppliers or internal review${
                    requests[0]?.lines[0]?.description ? ` — e.g. “${requests[0].lines[0].description}”.` : '.'
                  }`}
                />
              </article>
            </div>
            <button type="button" className={ui.supervisorApprovalInsightBtn} onClick={() => navigate('/app/supervisor/reports')}>
              {t('app.supervisor.approvalViewOptimization')}
            </button>
          </section>

          <section className={ui.supervisorApprovalHistory}>
            <h2 className={ui.supervisorApprovalRailTitle}>{t('app.supervisor.approvalHistoryTitle')}</h2>
            <div className={ui.supervisorApprovalHistoryList}>
              {approvalHistory.map((entry) => (
                <article key={entry.id} className={ui.supervisorApprovalHistoryRow}>
                  <span className={ui.supervisorApprovalHistoryBar} />
                  <div>
                    <p className={ui.supervisorApprovalHistoryTitle}>{describeActivityEntry(entry, t)}</p>
                    <p className={ui.supervisorApprovalHistoryMeta}>
                      {entry.actorName} · {formatDate(entry.createdAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={ui.supervisorApprovalHealth}>
            <p className={ui.supervisorApprovalHealthLabel}>{t('app.supervisor.approvalHealthLabel')}</p>
            <strong className={ui.supervisorApprovalHealthValue}>{t('app.supervisor.approvalHealthStable', { pct: healthPct })}</strong>
          </section>
        </aside>
      </div>

      <RequisitionPdfModal
        isOpen={!!pdfPreviewReq}
        req={pdfPreviewReq}
        onClose={() => setPdfPreviewReq(null)}
        onDownload={downloadRequisitionPdf}
        users={state.users}
        company={state.company}
      />
    </div>
  );
}

export function SupervisorInvoices() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const [shift, setShift] = useState('Morning');
  const [sortBy, setSortBy] = useState('Accuracy'); // Accuracy = sort by closed %
  const [rosterDetailUser, setRosterDetailUser] = useState(null);
  const [logDetailEntry, setLogDetailEntry] = useState(null);
  const dayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const operationalUsers = useMemo(
    () => state.users.filter((u) => ['clerk', 'accountant', 'supplier'].includes(u.role)),
    [state.users]
  );

  const monitorRows = useMemo(() => {
    const rows = operationalUsers.map((person) => {
      if (person.role === 'clerk') {
        const requisitions = state.requisitions.filter((entry) => entry.clerkId === person.id);
        const consumptions = state.consumptions.filter((entry) => entry.clerkId === person.id);
        const consumptionsToday = consumptions.filter((c) => new Date(c.createdAt).getTime() >= dayStart).length;
        const reqsToday = requisitions.filter((r) => new Date(r.requestedAt).getTime() >= dayStart).length;
        const tasksToday = consumptionsToday + reqsToday;
        const closedCount = requisitions.filter((r) => r.status === 'closed').length;
        const fulfillmentPct = requisitions.length === 0 ? null : (closedCount / requisitions.length) * 100;
        return {
          person,
          subtitle: (person.jobTitle || person.team || '').trim() || t('roles.clerk'),
          tasksToday,
          fulfillmentPct,
        };
      }
      if (person.role === 'accountant') {
        const invoices = state.invoices || [];
        const activityToday = (state.activity || []).filter(
          (a) => a.actorId === person.id && new Date(a.createdAt).getTime() >= dayStart
        ).length;
        const invToday = invoices.filter(
          (inv) => new Date(inv.updatedAt || inv.createdAt || 0).getTime() >= dayStart
        ).length;
        const tasksToday = activityToday + invToday;
        const closedInv = invoices.filter((i) => ['closed', 'paid'].includes(i.status)).length;
        const fulfillmentPct = invoices.length === 0 ? null : (closedInv / invoices.length) * 100;
        return {
          person,
          subtitle: (person.jobTitle || person.team || '').trim() || t('roles.accountant'),
          tasksToday,
          fulfillmentPct,
        };
      }
      const sid = person.id;
      const requisitions = state.requisitions.filter((r) => r.supplierId === sid);
      const invoices = (state.invoices || []).filter((i) => i.supplierId === sid);
      const activityToday = (state.activity || []).filter(
        (a) => a.actorId === sid && new Date(a.createdAt).getTime() >= dayStart
      ).length;
      const reqsToday = requisitions.filter(
        (r) => new Date(r.updatedAt || r.requestedAt || 0).getTime() >= dayStart
      ).length;
      const invToday = invoices.filter(
        (inv) => new Date(inv.updatedAt || inv.createdAt || 0).getTime() >= dayStart
      ).length;
      const tasksToday = activityToday + reqsToday + invToday;
      const closedCount = requisitions.filter((r) => ['closed', 'paid'].includes(r.status)).length;
      const fulfillmentPct = requisitions.length === 0 ? null : (closedCount / requisitions.length) * 100;
      return {
        person,
        subtitle: person.companyName || (person.jobTitle || person.team || '').trim() || t('roles.supplier'),
        tasksToday,
        fulfillmentPct,
      };
    });
    return rows;
  }, [operationalUsers, state.requisitions, state.consumptions, state.invoices, state.activity, dayStart, t]);

  const sortedMonitorRows = useMemo(() => {
    const copy = [...monitorRows];
    copy.sort((a, b) => {
      if (sortBy === 'Accuracy') return (b.fulfillmentPct ?? -1) - (a.fulfillmentPct ?? -1);
      return b.tasksToday - a.tasksToday;
    });
    return copy;
  }, [monitorRows, sortBy]);

  const rosterDetailBundle = useMemo(() => {
    if (!rosterDetailUser) return null;
    const uid = rosterDetailUser.id;
    const activities = [...(state.activity || [])]
      .filter((a) => a.actorId === uid)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((entry) => ({
        ...entry,
        title: monitorActivityEventTitle(entry.action),
        actionLabel: monitorActivityActionLabel(entry.action),
        metaLine: monitorActivityMetaLine(entry.meta),
      }));
    if (rosterDetailUser.role === 'clerk') {
      return {
        activities,
        requisitions: [...state.requisitions]
          .filter((r) => r.clerkId === uid)
          .sort(
            (a, b) =>
              new Date(b.updatedAt || b.requestedAt || 0) - new Date(a.updatedAt || a.requestedAt || 0)
          )
          .slice(0, 25),
        consumptions: [...(state.consumptions || [])]
          .filter((c) => c.clerkId === uid)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 25),
      };
    }
    if (rosterDetailUser.role === 'accountant') {
      return {
        activities,
        invoices: [...(state.invoices || [])]
          .sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
          )
          .slice(0, 25),
      };
    }
    return {
      activities,
      requisitions: [...state.requisitions]
        .filter((r) => r.supplierId === uid)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.requestedAt || 0) - new Date(a.updatedAt || a.requestedAt || 0)
        )
        .slice(0, 25),
      invoices: [...(state.invoices || [])]
        .filter((i) => i.supplierId === uid)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
        )
        .slice(0, 25),
    };
  }, [rosterDetailUser, state.activity, state.requisitions, state.consumptions, state.invoices]);

  const totalItems = state.stockItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const avgProcessHours =
    state.requisitions.length === 0
      ? 0
      : state.requisitions.reduce((sum, request) => {
          const created = new Date(request.requestedAt).getTime();
          const updated = new Date(request.updatedAt || request.requestedAt).getTime();
          return sum + Math.max(0, (updated - created) / (1000 * 60 * 60));
        }, 0) / state.requisitions.length;

  const liveLogs = useMemo(() => {
    const memberIds = new Set(operationalUsers.map((u) => u.id));
    const sorted = [...(state.activity || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const preferred = sorted.filter((a) => memberIds.has(a.actorId));
    const rest = sorted.filter((a) => !memberIds.has(a.actorId));
    return [...preferred, ...rest].slice(0, 10).map((entry) => ({
      ...entry,
      title: monitorActivityEventTitle(entry.action),
      actionLabel: monitorActivityActionLabel(entry.action),
      metaLine: monitorActivityMetaLine(entry.meta),
    }));
  }, [state.activity, operationalUsers]);

  const logDetailRelated = useMemo(() => {
    if (!logDetailEntry) return null;
    return resolveActivityRelated(logDetailEntry, state);
  }, [logDetailEntry, state]);

  function navigateRelatedWorkspace(person) {
    if (person.role === 'clerk') navigate('/app/supervisor/visibility');
    else if (person.role === 'accountant') navigate('/app/supervisor/invoices');
    else navigate('/app/supervisor/suppliers');
  }

  return (
    <div className={ui.supervisorMonitorBoard}>
      <div className={ui.supervisorMonitorGrid}>
        <section className={ui.supervisorMonitorMain}>
          <div className={ui.supervisorMonitorTop}>
            <div className={ui.supervisorMonitorTitleBlock}>
              <h1 className={ui.supervisorMonitorTitle}>{t('app.supervisor.monitorTitle')}</h1>
              <p className={ui.supervisorMonitorLead}>{t('app.supervisor.monitorLead')}</p>
            </div>
            <article className={ui.supervisorMonitorMetric}>
              <span className={ui.supervisorMonitorMetricLabel}>{t('app.supervisor.monitorMetricReqAge')}</span>
              <strong className={ui.supervisorMonitorMetricValue}>{avgProcessHours.toFixed(1)}</strong>
              <span className={ui.supervisorMonitorMetricUnit}>{t('app.supervisor.monitorMetricHours')}</span>
            </article>
            <article className={ui.supervisorMonitorMetric}>
              <span className={ui.supervisorMonitorMetricLabel}>{t('app.supervisor.monitorMetricTotalItems')}</span>
              <strong className={ui.supervisorMonitorMetricValue}>{totalItems.toLocaleString()}</strong>
            </article>
          </div>

          <section className={ui.supervisorMonitorCard}>
            <div className={ui.supervisorMonitorCardHead}>
              <h2 className={ui.supervisorMonitorCardTitle}>{t('app.supervisor.monitorRosterTitle')}</h2>
              <div className={ui.supervisorMonitorFilters}>
                <button type="button" className={ui.supervisorMonitorChip} onClick={() => setShift(shift === 'Morning' ? 'Evening' : 'Morning')}>
                  {t('app.supervisor.monitorShift', { shift })}
                </button>
                <button
                  type="button"
                  className={ui.supervisorMonitorChip}
                  onClick={() => setSortBy(sortBy === 'Accuracy' ? 'Tasks' : 'Accuracy')}
                >
                  {sortBy === 'Accuracy' ? t('app.supervisor.monitorSortClosed') : t('app.supervisor.monitorSortTasks')}
                </button>
              </div>
            </div>

            <div className={ui.supervisorMonitorClerkList}>
              {sortedMonitorRows.map((entry) => (
                <article key={entry.person.id} className={ui.supervisorMonitorClerkRow}>
                  <div className={ui.supervisorMonitorClerkIdentity}>
                    <p className={ui.supervisorMonitorClerkName}>{entry.person.fullName}</p>
                    <p className={ui.supervisorMonitorClerkRole}>
                      {t(`roles.${entry.person.role}`)} · {entry.subtitle}
                    </p>
                  </div>
                  <div className={ui.supervisorMonitorStatCell}>
                    <span className={ui.supervisorMonitorMiniLabel}>{t('app.supervisor.monitorColToday')}</span>
                    <strong>{entry.tasksToday}</strong>
                  </div>
                  <div className={ui.supervisorMonitorStatCell}>
                    <span className={ui.supervisorMonitorMiniLabel}>{t('app.supervisor.monitorColClosed')}</span>
                    <strong>{entry.fulfillmentPct == null ? '—' : `${entry.fulfillmentPct.toFixed(1)}%`}</strong>
                  </div>
                  <button
                    type="button"
                    className={ui.supervisorMonitorViewBtn}
                    onClick={() => setRosterDetailUser(entry.person)}
                  >
                    {t('app.supervisor.monitorRosterView')}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className={ui.supervisorMonitorRail}>
          <div className={ui.supervisorMonitorRailHead}>
            <h2 className={ui.supervisorMonitorRailTitle}>{t('app.supervisor.monitorLogTitle')}</h2>
            <button type="button" className={ui.supervisorMonitorRailIcon} onClick={() => navigate('/app/supervisor/reports')}>
              =
            </button>
          </div>

          <div className={ui.supervisorMonitorLogTable}>
            <div className={ui.supervisorMonitorLogTableHead}>
              <span>{t('app.supervisor.monitorLogColEvent')}</span>
              <span>{t('app.supervisor.monitorLogColActor')}</span>
              <span>{t('app.supervisor.monitorLogColAction')}</span>
              <span>{t('app.supervisor.monitorLogColDate')}</span>
              <span className={ui.supervisorMonitorLogTableHeadAction}>{t('app.supervisor.monitorLogColView')}</span>
            </div>
            <div className={ui.supervisorMonitorLogTableBody}>
              {liveLogs.map((entry) => (
                <div key={entry.id} className={ui.supervisorMonitorLogTableRow}>
                  <span>{entry.title}</span>
                  <span>{entry.actorName}</span>
                  <span>{entry.actionLabel}</span>
                  <span>{formatDate(entry.createdAt)}</span>
                  <span className={ui.supervisorMonitorLogTableCellAction}>
                    <button
                      type="button"
                      className={ui.supervisorMonitorLogViewBtn}
                      onClick={() => setLogDetailEntry(entry)}
                    >
                      {t('app.supervisor.monitorRosterView')}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button type="button" className={ui.supervisorMonitorHistoryBtn} onClick={() => navigate('/app/supervisor/reports')}>
            {t('app.supervisor.monitorLogHistory')}
          </button>
        </aside>
      </div>

      {rosterDetailUser && rosterDetailBundle ? (
        <div
          className={ui.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="supervisor-roster-detail-title"
          onClick={() => setRosterDetailUser(null)}
        >
          <div
            className={ui.modalCard}
            style={{ maxWidth: 'min(640px, 96vw)', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={ui.modalHead}>
              <h2 id="supervisor-roster-detail-title" className={ui.modalTitle}>
                {rosterDetailUser.fullName}
              </h2>
              <button type="button" className={ui.modalClose} onClick={() => setRosterDetailUser(null)}>
                ×
              </button>
            </div>
            <div className={ui.modalBody} style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--ec-muted)' }}>
                {t(`roles.${rosterDetailUser.role}`)} ·{' '}
                {rosterDetailUser.email ||
                  (rosterDetailUser.jobTitle || rosterDetailUser.team || '').trim() ||
                  rosterDetailUser.phone ||
                  '—'}
              </p>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem' }}>
                {t('app.supervisor.monitorDetailLead')}
              </p>

              <h3 className={ui.supervisorMonitorDetailSectionTitle}>{t('app.supervisor.monitorDetailSectionActivity')}</h3>
              {rosterDetailBundle.activities.length === 0 ? (
                <p className={ui.supervisorMonitorDetailEmpty}>{t('app.supervisor.monitorDetailEmpty')}</p>
              ) : (
                <ul className={ui.supervisorMonitorDetailList}>
                  {rosterDetailBundle.activities.map((row) => (
                    <li key={row.id} className={ui.supervisorMonitorDetailItem}>
                      <div className={ui.supervisorMonitorDetailItemMain}>
                        <strong>{row.title}</strong>
                        <span className={ui.supervisorMonitorDetailItemAction}>{row.actionLabel}</span>
                        {row.metaLine ? (
                          <span className={ui.supervisorMonitorDetailItemMeta}>{row.metaLine}</span>
                        ) : null}
                      </div>
                      <time className={ui.supervisorMonitorDetailItemDate}>{formatDate(row.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              )}

              {rosterDetailUser.role === 'clerk' && rosterDetailBundle.requisitions ? (
                <>
                  <h3 className={ui.supervisorMonitorDetailSectionTitle}>
                    {t('app.supervisor.monitorDetailSectionReqs')}
                  </h3>
                  {rosterDetailBundle.requisitions.length === 0 ? (
                    <p className={ui.supervisorMonitorDetailEmpty}>{t('app.supervisor.monitorDetailEmpty')}</p>
                  ) : (
                    <ul className={ui.supervisorMonitorDetailList}>
                      {rosterDetailBundle.requisitions.map((r) => (
                        <li key={r.id} className={ui.supervisorMonitorDetailItem}>
                          <div className={ui.supervisorMonitorDetailItemMain}>
                            <strong>{r.title || r.id}</strong>
                            <span className={ui.supervisorMonitorDetailItemMeta}>{workflowLabel(r.status)}</span>
                          </div>
                          <time className={ui.supervisorMonitorDetailItemDate}>{formatDate(r.updatedAt || r.requestedAt)}</time>
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3 className={ui.supervisorMonitorDetailSectionTitle}>
                    {t('app.supervisor.monitorDetailSectionConsumptions')}
                  </h3>
                  {rosterDetailBundle.consumptions?.length === 0 ? (
                    <p className={ui.supervisorMonitorDetailEmpty}>{t('app.supervisor.monitorDetailEmpty')}</p>
                  ) : (
                    <ul className={ui.supervisorMonitorDetailList}>
                      {(rosterDetailBundle.consumptions || []).map((c) => (
                        <li key={c.id} className={ui.supervisorMonitorDetailItem}>
                          <div className={ui.supervisorMonitorDetailItemMain}>
                            <strong>{c.itemName || c.itemId}</strong>
                            <span className={ui.supervisorMonitorDetailItemMeta}>
                              {c.quantity} {c.unit || ''}
                            </span>
                          </div>
                          <time className={ui.supervisorMonitorDetailItemDate}>{formatDate(c.createdAt)}</time>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}

              {rosterDetailUser.role === 'accountant' && rosterDetailBundle.invoices ? (
                <>
                  <h3 className={ui.supervisorMonitorDetailSectionTitle}>
                    {t('app.supervisor.monitorDetailSectionInvoices')}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--ec-muted)', margin: '0 0 0.5rem' }}>
                    {t('app.supervisor.monitorDetailInvoicesNote')}
                  </p>
                  {rosterDetailBundle.invoices.length === 0 ? (
                    <p className={ui.supervisorMonitorDetailEmpty}>{t('app.supervisor.monitorDetailEmpty')}</p>
                  ) : (
                    <ul className={ui.supervisorMonitorDetailList}>
                      {rosterDetailBundle.invoices.map((inv) => (
                        <li key={inv.id} className={ui.supervisorMonitorDetailItem}>
                          <div className={ui.supervisorMonitorDetailItemMain}>
                            <strong>{inv.reference || inv.id}</strong>
                            <span className={ui.supervisorMonitorDetailItemMeta}>
                              {inv.status} · {formatMoney(inv.amount, inv.currency || state.company?.currency)}
                            </span>
                          </div>
                          <time className={ui.supervisorMonitorDetailItemDate}>
                            {formatDate(inv.updatedAt || inv.createdAt)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}

              {rosterDetailUser.role === 'supplier' && rosterDetailBundle.requisitions ? (
                <>
                  <h3 className={ui.supervisorMonitorDetailSectionTitle}>
                    {t('app.supervisor.monitorDetailSectionReqs')}
                  </h3>
                  {rosterDetailBundle.requisitions.length === 0 ? (
                    <p className={ui.supervisorMonitorDetailEmpty}>{t('app.supervisor.monitorDetailEmpty')}</p>
                  ) : (
                    <ul className={ui.supervisorMonitorDetailList}>
                      {rosterDetailBundle.requisitions.map((r) => (
                        <li key={r.id} className={ui.supervisorMonitorDetailItem}>
                          <div className={ui.supervisorMonitorDetailItemMain}>
                            <strong>{r.title || r.id}</strong>
                            <span className={ui.supervisorMonitorDetailItemMeta}>{workflowLabel(r.status)}</span>
                          </div>
                          <time className={ui.supervisorMonitorDetailItemDate}>{formatDate(r.updatedAt || r.requestedAt)}</time>
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3 className={ui.supervisorMonitorDetailSectionTitle}>
                    {t('app.supervisor.monitorDetailSectionInvoices')}
                  </h3>
                  {rosterDetailBundle.invoices?.length === 0 ? (
                    <p className={ui.supervisorMonitorDetailEmpty}>{t('app.supervisor.monitorDetailEmpty')}</p>
                  ) : (
                    <ul className={ui.supervisorMonitorDetailList}>
                      {(rosterDetailBundle.invoices || []).map((inv) => (
                        <li key={inv.id} className={ui.supervisorMonitorDetailItem}>
                          <div className={ui.supervisorMonitorDetailItemMain}>
                            <strong>{inv.reference || inv.id}</strong>
                            <span className={ui.supervisorMonitorDetailItemMeta}>
                              {inv.status} · {formatMoney(inv.amount, inv.currency || state.company?.currency)}
                            </span>
                          </div>
                          <time className={ui.supervisorMonitorDetailItemDate}>
                            {formatDate(inv.updatedAt || inv.createdAt)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}

              <div className={ui.modalActions} style={{ marginTop: '1rem', paddingTop: '0.5rem' }}>
                <button type="button" className={ui.modalSecondaryBtn} onClick={() => setRosterDetailUser(null)}>
                  {t('app.supervisor.monitorDetailClose')}
                </button>
                <button
                  type="button"
                  className={ui.materialsSubmitBtn}
                  onClick={() => {
                    navigateRelatedWorkspace(rosterDetailUser);
                    setRosterDetailUser(null);
                  }}
                >
                  {t('app.supervisor.monitorDetailOpenRelated')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {logDetailEntry ? (
        <div
          className={ui.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="supervisor-log-detail-title"
          onClick={() => setLogDetailEntry(null)}
        >
          <div
            className={ui.modalCard}
            style={{ maxWidth: 'min(560px, 96vw)', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={ui.modalHead}>
              <h2 id="supervisor-log-detail-title" className={ui.modalTitle}>
                {t('app.supervisor.monitorLogDetailTitle')}
              </h2>
              <button type="button" className={ui.modalClose} onClick={() => setLogDetailEntry(null)}>
                ×
              </button>
            </div>
            <div className={ui.modalBody} style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <dl className={ui.supervisorMonitorLogDetailDl}>
                <dt>{t('app.supervisor.monitorLogColEvent')}</dt>
                <dd>{logDetailEntry.title}</dd>
                <dt>{t('app.supervisor.monitorLogDetailSystemAction')}</dt>
                <dd>
                  <code className={ui.supervisorMonitorLogDetailCode}>{logDetailEntry.action}</code>
                </dd>
                <dt>{t('app.supervisor.monitorLogColActor')}</dt>
                <dd>{logDetailEntry.actorName}</dd>
                <dt>{t('app.supervisor.monitorLogDetailActorId')}</dt>
                <dd>
                  <code className={ui.supervisorMonitorLogDetailCode}>{logDetailEntry.actorId}</code>
                </dd>
                <dt>{t('app.supervisor.monitorLogColDate')}</dt>
                <dd>{formatDate(logDetailEntry.createdAt)}</dd>
                {logDetailEntry.metaLine ? (
                  <>
                    <dt>{t('app.supervisor.monitorLogDetailSummary')}</dt>
                    <dd>{logDetailEntry.metaLine}</dd>
                  </>
                ) : null}
              </dl>

              {logDetailEntry.meta && typeof logDetailEntry.meta === 'object' && Object.keys(logDetailEntry.meta).length > 0 ? (
                <>
                  <h3 className={ui.supervisorMonitorDetailSectionTitle}>{t('app.supervisor.monitorLogDetailMetaTitle')}</h3>
                  <dl className={ui.supervisorMonitorLogDetailDl}>
                    {Object.entries(logDetailEntry.meta)
                      .filter(([, v]) => v != null && v !== '')
                      .map(([k, v]) => (
                        <Fragment key={k}>
                          <dt>{k}</dt>
                          <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                        </Fragment>
                      ))}
                  </dl>
                </>
              ) : null}

              {logDetailRelated ? (
                <>
                  <h3 className={ui.supervisorMonitorDetailSectionTitle}>{t('app.supervisor.monitorLogDetailRelatedTitle')}</h3>
                  <div className={ui.supervisorMonitorLogDetailRelated}>
                    {logDetailRelated.kind === 'requisition' ? (
                      <>
                        <p>
                          <strong>{logDetailRelated.data.title || logDetailRelated.data.id}</strong>
                        </p>
                        <p className={ui.supervisorMonitorDetailItemMeta}>
                          {workflowLabel(logDetailRelated.data.status)} · {logDetailRelated.data.id}
                        </p>
                        {Array.isArray(logDetailRelated.data.lines) && logDetailRelated.data.lines.length > 0 ? (
                          <ul className={ui.supervisorMonitorDetailList} style={{ marginTop: '0.5rem' }}>
                            {logDetailRelated.data.lines.slice(0, 8).map((line, idx) => (
                              <li key={idx} className={ui.supervisorMonitorDetailItemMeta}>
                                {line.description} — {line.quantity} {line.unit || ''}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : null}
                    {logDetailRelated.kind === 'invoice' ? (
                      <>
                        <p>
                          <strong>{logDetailRelated.data.reference || logDetailRelated.data.id}</strong>
                        </p>
                        <p className={ui.supervisorMonitorDetailItemMeta}>
                          {logDetailRelated.data.status} ·{' '}
                          {formatMoney(logDetailRelated.data.amount, logDetailRelated.data.currency || state.company?.currency)}
                        </p>
                      </>
                    ) : null}
                    {logDetailRelated.kind === 'stock' ? (
                      <>
                        <p>
                          <strong>{logDetailRelated.data.name}</strong>
                        </p>
                        <p className={ui.supervisorMonitorDetailItemMeta}>
                          SKU {logDetailRelated.data.sku || '—'} · {logDetailRelated.data.quantity}{' '}
                          {logDetailRelated.data.unit || ''} · {logDetailRelated.data.location || '—'}
                        </p>
                      </>
                    ) : null}
                  </div>
                </>
              ) : activityMetaHasRefs(logDetailEntry.meta) ? (
                <p className={ui.supervisorMonitorDetailEmpty} style={{ marginTop: '0.75rem' }}>
                  {t('app.supervisor.monitorLogDetailMissingRelated')}
                </p>
              ) : null}

              <div className={ui.modalActions} style={{ marginTop: '1rem' }}>
                <button type="button" className={ui.modalSecondaryBtn} onClick={() => setLogDetailEntry(null)}>
                  {t('app.supervisor.monitorDetailClose')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const SupervisorReports = React.memo(function SupervisorReports() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const [period, setPeriod] = useState('30d');
  const [repCategory, setRepCategory] = useState('all');
  const [repWarehouse, setRepWarehouse] = useState('all');
  const [repSearch, setRepSearch] = useState('');
  const [repReqStatus, setRepReqStatus] = useState('all');
  const [repStockStatus, setRepStockStatus] = useState('all');
  const navigate = useNavigate();
  const trendGradId = useId().replace(/:/g, '');
  const reportTrendSvgRef = useRef(null);
  const [hoveredTrend, setHoveredTrend] = useState(null);

  const { start, end } = useMemo(() => getPeriodBounds(period), [period]);

  const reportCategories = useMemo(() => {
    if (isHealthcareCompany(state.company)) return HEALTHCARE_STOCK_CATEGORIES;
    return [...new Set(state.stockItems.map((item) => item.category).filter(Boolean))].sort();
  }, [state.stockItems, state.company]);
  const reportWarehouses = useMemo(
    () => [...new Set(state.stockItems.map((item) => item.location).filter(Boolean))].sort(),
    [state.stockItems]
  );

  const stockForReport = useMemo(() => {
    const q = repSearch.trim().toLowerCase();
    return state.stockItems.filter((item) => {
      if (repCategory !== 'all') {
        if (isHealthcareCompany(state.company)) {
          if (normalizeToHealthcareCategory(item.category) !== repCategory) return false;
        } else if (item.category !== repCategory) return false;
      }
      if (repWarehouse !== 'all' && item.location !== repWarehouse) return false;
      if (!matchesStockReportStatus(item, repStockStatus)) return false;
      if (q && !`${item.name} ${item.sku || ''} ${item.category || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.stockItems, state.company, repCategory, repWarehouse, repSearch, repStockStatus]);

  const reqsForReport = useMemo(() => {
    return state.requisitions.filter((r) => {
      if (repWarehouse !== 'all' && r.location !== repWarehouse) return false;
      if (!isoInRange(r.requestedAt, start, end)) return false;
      if (!matchesReqReportStatus(r, repReqStatus)) return false;
      return true;
    });
  }, [state.requisitions, repWarehouse, start, end, repReqStatus]);

  const scopedReqIds = useMemo(() => new Set(reqsForReport.map((r) => r.id)), [reqsForReport]);
  const invoicesScoped = useMemo(
    () =>
      state.invoices.filter(
        (inv) => scopedReqIds.has(inv.requisitionId) && isoInRange(inv.createdAt, start, end)
      ),
    [state.invoices, scopedReqIds, start, end]
  );

  const notificationsScoped = useMemo(
    () =>
      state.notifications.filter(
        (n) => n.role === 'supervisor' && isoInRange(n.createdAt, start, end)
      ),
    [state.notifications, start, end]
  );

  const unitPriceMapForReport = useMemo(() => {
    const m = new Map();
    for (const req of state.requisitions) {
      for (const line of req.lines || []) {
        const q = Number(line.quantity || 0);
        if (q > 0 && !m.has(line.description)) {
          m.set(line.description, Number(line.estimatedCost || 0) / q);
        }
      }
    }
    return m;
  }, [state.requisitions]);

  const invoiceTotal = invoicesScoped.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const stockQtySum = stockForReport.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const currentValue = Math.round(
    invoiceTotal +
      stockForReport.reduce((sum, item) => {
        const up = unitPriceMapForReport.get(item.name) || 18000;
        return sum + Number(item.quantity || 0) * up;
      }, 0)
  );

  const { trendMonths, trendValues } = useMemo(() => {
    const now = new Date();
    const labels = [];
    const values = [];
    for (let i = 5; i >= 0; i--) {
      const d0 = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const d1 = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      labels.push(d0.toLocaleString('default', { month: 'short' }));
      const sum = state.invoices
        .filter((inv) => {
          const t = new Date(inv.createdAt).getTime();
          return t >= d0.getTime() && t <= d1.getTime();
        })
        .reduce((s, inv) => s + Number(inv.amount || 0), 0);
      values.push(Math.round(sum));
    }
    return { trendMonths: labels, trendValues: values };
  }, [state.invoices]);

  const invoiceTrendDataMax = Math.max(0, ...trendValues);
  const invoiceTrendAxisMax = useMemo(
    () => (Math.ceil(invoiceTrendDataMax / 500) || 1) * 500 + 500,
    [invoiceTrendDataMax]
  );

  const SUP_REPORT_VB_W = 400;
  const SUP_REPORT_PAD_X = 40;
  const SUP_REPORT_Y_TOP = 20;

  const SUP_REPORT_VB_H = 220;
  const SUP_REPORT_Y_BOTTOM = 200;
  const SUP_REPORT_Y_SPAN = SUP_REPORT_Y_BOTTOM - SUP_REPORT_Y_TOP;

  const nT = trendValues.length;

  const txT = useMemo(() => {
    if (nT === 0) return [];
    if (nT === 1) return [SUP_REPORT_VB_W / 2];
    const innerW = SUP_REPORT_VB_W - SUP_REPORT_PAD_X * 2;
    const denom = nT - 1;
    return trendValues.map((_, i) => SUP_REPORT_PAD_X + (i / denom) * innerW);
  }, [nT, trendValues]);

  const tyT = useMemo(() => {
    return trendValues.map((v) => SUP_REPORT_Y_BOTTOM - (invoiceTrendAxisMax > 0 ? (v / invoiceTrendAxisMax) * SUP_REPORT_Y_SPAN : 0));
  }, [trendValues, invoiceTrendAxisMax]);

  const trendLineDT = txT.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${tyT[i]}`).join(' ');
  const trendAreaDT = nT > 0 ? `${trendLineDT} L ${txT[nT - 1]} ${SUP_REPORT_Y_BOTTOM} L ${txT[0]} ${SUP_REPORT_Y_BOTTOM} Z` : '';
  
  const reportTrendYTicks = useMemo(() => {
    const step = niceTickStepCounts(invoiceTrendAxisMax);
    const ticks = [];
    for (let v = 0; v <= invoiceTrendAxisMax + step / 2; v += step) {
      ticks.push({
        value: v,
        y: SUP_REPORT_Y_BOTTOM - (invoiceTrendAxisMax > 0 ? (v / invoiceTrendAxisMax) * SUP_REPORT_Y_SPAN : 0),
      });
    }
    return ticks;
  }, [invoiceTrendAxisMax]);
  const categoryGroups = stockForReport.reduce((map, item) => {
    const label = isHealthcareCompany(state.company)
      ? normalizeToHealthcareCategory(item.category)
      : item.category;
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map());
  let categorySplit = [...categoryGroups.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  if (categorySplit.length === 0) {
    categorySplit = [{ label: 'No items match filters', count: 1 }];
  }
  const splitTotal = categorySplit.reduce((sum, entry) => sum + entry.count, 0) || 1;
  const categoryDonutSlices = categorySplit.map((entry, i) => ({
    name: entry.label,
    count: entry.count,
    color: REPORT_SLICE_COLORS[i % REPORT_SLICE_COLORS.length],
  }));
  const categoryDonutPct = categoryDonutSlices.map((s) => Math.round(((s.count || 0) / splitTotal) * 100));
  const wasteRows = [
    { label: 'Damaged', value: notificationsScoped.filter((entry) => entry.severity === 'bad').length },
    {
      label: 'Expired',
      value: stockForReport.filter(
        (item) => item.expiryDate && new Date(item.expiryDate) < new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      ).length,
    },
    { label: 'Missing', value: reqsForReport.filter((entry) => entry.status === 'submitted').length },
    { label: 'Other', value: notificationsScoped.filter((entry) => entry.severity === 'warn').length },
  ];
  const maxWaste = Math.max(...wasteRows.map((entry) => entry.value), 1);
  const wasteTotalUnits = wasteRows.reduce((s, e) => s + e.value, 0) || 1;
  const wasteDonutSlices = wasteRows.map((entry, i) => ({
    name: entry.label,
    value: entry.value,
    color: ['#dc2626', '#ca8a04', '#2563eb', '#64748b'][i % 4],
  }));
  const wasteDonutPct = wasteDonutSlices.map((s) => Math.round(((s.value || 0) / wasteTotalUnits) * 100));
  const totalItems = stockQtySum;
  const activeAlerts = notificationsScoped.filter((entry) => entry.severity !== 'ok').length;
  const monthlyFlux =
    trendValues[0] === 0 && trendValues[trendValues.length - 1] === 0
      ? 0
      : ((trendValues.at(-1) - trendValues[0]) / Math.max(1, trendValues[0])) * 100;
  const efficiency =
    reqsForReport.length === 0
      ? 100
      : Math.min(
          99.9,
          Number(
            (
              (reqsForReport.filter((entry) => ['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status)).length /
                reqsForReport.length) *
              100
            ).toFixed(1)
          )
        );
  const reportRows = [
    ['Total items', totalItems],
    ['Active alerts', activeAlerts],
    ['Inventory value', `${currentValue.toLocaleString()} RWF`],
    ['Monthly flux', `${monthlyFlux.toFixed(1)}%`],
    ['Efficiency', `${efficiency.toFixed(1)}%`],
  ];

  function exportCsv() {
    downloadAoAAsXlsx('supervisor-ledger-report', [['Metric', 'Value'], ...reportRows], 'Ledger summary');
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('e-Cunga Supervisor Intelligence Report', 14, 18);
    doc.setFontSize(11);
    doc.text(`Generated period: ${period}`, 14, 28);
    doc.text(`Inventory value: ${formatMoney(currentValue, 'RWF')}`, 14, 38);
    doc.text(`Active alerts: ${activeAlerts}`, 14, 46);
    doc.text(`Efficiency: ${efficiency.toFixed(1)}%`, 14, 54);
    doc.text('Top categories', 14, 68);
    categorySplit.forEach((entry, index) => {
      doc.text(`- ${entry.label}: ${Math.round((entry.count / splitTotal) * 100)}%`, 18, 78 + index * 8);
    });
    doc.text('Waste / loss analytics', 14, 110);
    wasteRows.forEach((entry, index) => {
      doc.text(`- ${entry.label}: ${entry.value}`, 18, 120 + index * 8);
    });
    doc.save('supervisor-ledger-report.pdf');
  }

  function scheduleWeekly() {
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(8, 0, 0, 0);
    const end = new Date(nextMonday);
    end.setHours(end.getHours() + 1);
    const formatIcs = (value) =>
      value
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${formatIcs(nextMonday)}`,
      `DTEND:${formatIcs(end)}`,
      'RRULE:FREQ=WEEKLY;COUNT=12',
      'SUMMARY:e-Cunga Weekly Supervisor Ledger',
      'DESCRIPTION:Recurring supervisor intelligence report review.',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supervisor-weekly-ledger.ics';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={ui.supervisorReportBoard}>
      <div className={ui.supervisorReportTop}>
        <div>
          <h1 className={ui.supervisorReportTitle}>{t('app.supervisor.reportTitle')}</h1>
          <div className={ui.analyticsKpiStrip} role="group" aria-label="Report summary">
            <span className={ui.analyticsKpiChip}>
              <strong>{formatMoney(currentValue, 'RWF')}</strong>
              <span className={ui.analyticsKpiChipLabel}>value</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{stockForReport.length}</strong>
              <span className={ui.analyticsKpiChipLabel}>SKUs</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{reqsForReport.length}</strong>
              <span className={ui.analyticsKpiChipLabel}>reqs</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{invoicesScoped.length}</strong>
              <span className={ui.analyticsKpiChipLabel}>invoices</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{efficiency.toFixed(0)}%</strong>
              <span className={ui.analyticsKpiChipLabel}>efficiency</span>
            </span>
          </div>
        </div>
        <div className={ui.supervisorReportPeriod}>
          {[
            ['30d', 'Last 30 Days'],
            ['quarter', 'Quarterly'],
            ['year', 'Yearly'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={period === value ? `${ui.supervisorReportPeriodBtn} ${ui.supervisorReportPeriodBtnActive}` : ui.supervisorReportPeriodBtn}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${ui.portalFilterBar} ${ui.reportsFilterToolbar}`} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Warehouse</span>
          <InventoryFilterSelect
            value={repWarehouse}
            onChange={setRepWarehouse}
            options={[
              { value: 'all', label: 'All locations' },
              ...reportWarehouses.map((w) => ({ value: w, label: w })),
            ]}
          />
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Category</span>
          <InventoryFilterSelect
            value={repCategory}
            onChange={setRepCategory}
            options={[
              { value: 'all', label: 'All categories' },
              ...reportCategories.map((c) => ({
                value: c,
                label: categoryFilterOptionLabel(c, state.company),
              })),
            ]}
          />
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Req. status</span>
          <InventoryFilterSelect
            value={repReqStatus}
            onChange={setRepReqStatus}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'fulfilled', label: 'Fulfilled' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Stock status</span>
          <InventoryFilterSelect
            value={repStockStatus}
            onChange={setRepStockStatus}
            options={[
              { value: 'all', label: 'Any level' },
              { value: 'in_stock', label: 'In stock' },
              { value: 'low', label: 'Low stock' },
              { value: 'out', label: 'Out of stock' },
            ]}
          />
        </label>
        <label className={`${ui.portalFilterField} ${ui.portalFilterFieldSearch}`}>
          <span className={ui.portalFilterLabel}>Search</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="SKU, name…"
            value={repSearch}
            onChange={(e) => setRepSearch(e.target.value)}
          />
        </label>
        <ClearFiltersIconButton
          title={t('common.clearFiltersAria')}
          onClick={() => {
            setRepCategory('all');
            setRepWarehouse('all');
            setRepSearch('');
            setRepReqStatus('all');
            setRepStockStatus('all');
          }}
        />
        <span className={ui.portalFilterMeta}>
          {stockForReport.length} Products · {reqsForReport.length} requisitions · {invoicesScoped.length} invoices (period)
        </span>
      </div>

      <div className={ui.supervisorReportGrid}>
        <section className={ui.supervisorReportTrendCard}>
          <div className={ui.supervisorReportCardHead}>
            <h2 className={ui.supervisorReportCardTitle}>Invoices processed (6 mo)</h2>
            <div className={ui.supervisorReportValueBlock}>
              <strong>{invoicesScoped.length}</strong>
              <span>{formatMoney(currentValue, 'RWF')} handled in value</span>
            </div>
          </div>

          <div className={`${ui.analyticsChartGrid} ${ui.analyticsChartGridTall}`}>
            <div className={ui.lineChartPlot}>
              <div className={ui.lineChartMain}>
                <svg
                  ref={reportTrendSvgRef}
                  viewBox={`0 0 ${SUP_REPORT_VB_W} ${SUP_REPORT_VB_H}`}
                  className={`${ui.supervisorReportTrendSvg} ${ui.analyticsChartSvgTall}`}
                  style={{ fontFamily: 'inherit' }}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Monthly invoice totals trend"
                  onMouseMove={(e) => {
                    if (!nT) return;
                    const el = reportTrendSvgRef.current;
                    if (!el) return;
                    const r = el.getBoundingClientRect();
                    const px = e.clientX - r.left;
                    const w = r.width || 1;
                    const x = (px / w) * 400;
                    
                    let bestI = 0;
                    let bestD = Number.POSITIVE_INFINITY;
                    for (let i = 0; i < txT.length; i++) {
                      const d = Math.abs(txT[i] - x);
                      if (d < bestD) {
                        bestD = d;
                        bestI = i;
                      }
                    }
                    setHoveredTrend({
                      idx: bestI,
                      x: txT[bestI],
                      y: tyT[bestI],
                      pctX: (txT[bestI] / 400) * 100,
                      label: trendMonths[bestI],
                      value: trendValues[bestI],
                    });
                  }}
                  onMouseLeave={() => setHoveredTrend(null)}
                >
                  <defs>
                    <linearGradient id={`${trendGradId}-sup`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--ec-primary)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="var(--ec-primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {reportTrendYTicks.map((tk) => (
                    <g key={tk.value}>
                      <line
                        x1={SUP_REPORT_PAD_X}
                        y1={tk.y}
                        x2={400 - SUP_REPORT_PAD_X}
                        y2={tk.y}
                        stroke="var(--ec-chart-grid)"
                        strokeWidth="0.5"
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={SUP_REPORT_PAD_X - 6}
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
                        {tk.value > 999999 ? `${(tk.value / 1000000).toFixed(1)}M` : tk.value > 999 ? `${(tk.value / 1000).toFixed(0)}k` : tk.value}
                      </text>
                    </g>
                  ))}
                  {trendAreaDT ? (
                    <>
                      <path d={trendAreaDT} fill={`url(#${trendGradId}-sup)`} />
                      <path
                        d={trendLineDT}
                        fill="none"
                        stroke="var(--ec-primary)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {txT.map((x, i) => (
                        <circle
                          key={i}
                          cx={x}
                          cy={tyT[i]}
                          r={hoveredTrend?.idx === i ? "4" : "1.5"}
                          fill={hoveredTrend?.idx === i ? "var(--ec-primary)" : "var(--ec-white)"}
                          stroke="var(--ec-primary)"
                          strokeWidth={hoveredTrend?.idx === i ? "0" : "1.5"}
                          style={{ transition: 'all 0.2s ease' }}
                        />
                      ))}
                    </>
                  ) : null}
                </svg>
                {hoveredTrend && (
                  <div 
                    className={ui.clerkChartTooltip} 
                    style={{ 
                      left: `${hoveredTrend.pctX}%`,
                      top: '20px',
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none'
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.75rem' }}>{hoveredTrend.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.88rem', fontWeight: 800, color: 'var(--ec-primary)' }}>
                      {formatMoney(hoveredTrend.value, 'RWF')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={ui.supervisorReportMonthRow}>
            {trendMonths.map((month, idx) => (
              <span key={`${month}-${idx}`}>
                {month}
              </span>
            ))}
          </div>
        </section>

        <div className={ui.supervisorReportDonutPair}>
          <section className={ui.supervisorReportCategoryCard}>
            <h2 className={ui.supervisorReportCardTitle}>Products mix by category</h2>
            <div className={ui.analyticsDonutRow}>
              <div
                className={`${ui.analyticsDonut} ${ui.analyticsDonutLg}`}
                style={{
                  background:
                    splitTotal > 0
                      ? `conic-gradient(${conicGradientFromSlices(categoryDonutSlices.map((s) => ({ count: s.count, color: s.color })))})`
                      : 'rgb(226 232 240)',
                }}
                role="img"
                aria-label="Category distribution"
              >
                <div className={ui.analyticsDonutHole}>
                  <strong>{categoryDonutPct[0] ?? 0}%</strong>
                  <span>top</span>
                </div>
              </div>
              <ul className={ui.analyticsLegend}>
                {categorySplit.map((entry, index) => (
                  <li key={entry.label} className={ui.analyticsLegendRow}>
                    <span
                      className={ui.analyticsLegendSwatch}
                      style={{ background: REPORT_SLICE_COLORS[index % REPORT_SLICE_COLORS.length] }}
                    />
                    <span className={ui.analyticsLegendName}>{categoryFilterOptionLabel(entry.label, state.company)}</span>
                    <span className={ui.analyticsLegendPct}>{categoryDonutPct[index]}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className={ui.supervisorReportWasteCard}>
            <div className={ui.supervisorReportCardHead}>
              <h2 className={ui.supervisorReportCardTitle}>Waste / loss signals</h2>
              <button type="button" className={ui.supervisorReportDetailBtn} onClick={() => navigate('/app/supervisor/monitoring')}>
                Monitoring
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginLeft: '6px' }}>
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className={ui.analyticsDonutRow}>
              <div
                className={ui.analyticsDonut}
                style={{
                  background:
                    wasteTotalUnits > 0
                      ? `conic-gradient(${conicGradientFromSlices(wasteDonutSlices)})`
                      : 'rgb(226 232 240)',
                }}
                role="img"
                aria-label="Waste composition"
              >
                <div className={ui.analyticsDonutHole}>
                  <strong>{wasteRows.reduce((s, e) => s + e.value, 0)}</strong>
                  <span>signals</span>
                </div>
              </div>
              <ul className={ui.analyticsLegend}>
                {wasteDonutSlices.map((s, i) => (
                  <li key={s.name} className={ui.analyticsLegendRow}>
                    <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                    <span className={ui.analyticsLegendName}>{s.name}</span>
                    <span className={ui.analyticsLegendQty}>{s.value}</span>
                    <span className={ui.analyticsLegendPct}>{wasteDonutPct[i]}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={ui.analyticsMicroBars} aria-hidden>
              {wasteRows.map((entry) => (
                <div
                  key={entry.label}
                  className={ui.analyticsMicroBar}
                  style={{ height: `${Math.max(10, (entry.value / maxWaste) * 100)}%` }}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className={ui.supervisorReportExportCard}>
          <h2 className={ui.supervisorReportExportTitle}>Export</h2>
          <p className={ui.supervisorReportExportMeta}>PDF · Excel · Calendar</p>
          <div className={ui.supervisorReportExportCols}>
            <div className={ui.supervisorReportExportActions}>
              <button type="button" className={ui.supervisorReportActionBtn} onClick={exportPdf}>
                Export PDF
              </button>
              <button type="button" className={ui.supervisorReportActionBtn} onClick={exportCsv}>
                Export Excel
              </button>
              <button type="button" className={ui.supervisorReportActionBtn} onClick={scheduleWeekly}>
                Schedule Weekly
              </button>
            </div>
            <div className={ui.supervisorReportInsightPane}>
              <strong>{t('cungaAi.insightReady')}</strong>
              <div className={ui.supervisorReportAiText}>
                <WorkspaceAiInsight
                  scope="supervisor"
                  showRefresh
                  fallbackText="Use this report to compare requisition throughput, product movement, and supplier invoice behavior."
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className={ui.supervisorReportStats}>
        <article className={ui.supervisorReportStatCard}>
          <span>Total Items</span>
          <strong>{totalItems.toLocaleString()}</strong>
        </article>
        <article className={ui.supervisorReportStatCard}>
          <span>Active Alerts</span>
          <strong>{String(activeAlerts).padStart(2, '0')}</strong>
        </article>
        <article className={ui.supervisorReportStatCard}>
          <span>Monthly Flux</span>
          <strong>{monthlyFlux >= 0 ? '+' : ''}{monthlyFlux.toFixed(1)}%</strong>
        </article>
        <article className={ui.supervisorReportStatCard}>
          <span>Efficiency</span>
          <strong>{efficiency.toFixed(1)}%</strong>
        </article>
      </div>
    </div>
  );
});

export function SupervisorMessages() {
  return <PortalMessagingHub role="supervisor" />;
}

export function SupervisorPlaceholder({ title, body }) {
  return (
    <div className={ui.panel}>
      <h2 className={ui.panelTitle}>{title}</h2>
      <p className={ui.muted}>{body}</p>
    </div>
  );
}
