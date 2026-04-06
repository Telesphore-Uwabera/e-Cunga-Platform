import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useShellSearchQuery } from '../../hooks/useShellSearchQuery.js';
import { getClerkRangeBounds, isoInRange } from '../../utils/reportFilters.js';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import ui from './DashboardUi.module.css';
import {
  ActivityFeed,
  PageIntro,
  StatusBadge,
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

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path d="M12 4v9m0 0 3.5-3.5M12 13l-3.5-3.5M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <path d="M5 7h14M9 7V5h6v2m-7 4v6m4-6v6m4-6v6M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClerkDashboard() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
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
    const chartBars = chartSeriesFromConsumptions(usageForTrends, 12);
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
  }, [actor?.id, state.stockItems, state.requisitions, state.consumptions, state.notifications, state.users]);

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
            <article className={ui.clerkStatCard}>
              <div className={ui.clerkStatHead}>
                <span className={`${ui.clerkStatIcon} ${ui.clerkStatIconPink}`}>
                  <StatCardIcon kind="stock" />
                </span>
                <span className={stockDeltaClass} title="Change in units consumed vs the previous 7 days">
                  {usageWow.label}
                </span>
              </div>
              <p className={ui.clerkStatLabel}>Total stock</p>
              <p className={ui.clerkStatValue}>{Math.round(totalUnitsOnHand).toLocaleString()}</p>
              <p className={ui.clerkStatMeta}>
                Units on hand across {skuCount.toLocaleString()} {skuCount === 1 ? 'SKU' : 'SKUs'}
              </p>
            </article>

            <article className={ui.clerkStatCard}>
              <div className={ui.clerkStatHead}>
                <span className={`${ui.clerkStatIcon} ${ui.clerkStatIconPeach}`}>
                  <StatCardIcon kind="warning" />
                </span>
                <span className={out > 0 ? ui.clerkDeltaWarn : low > 0 ? ui.clerkDeltaInfo : ui.clerkDeltaOk}>
                  {out > 0 ? `${out} out` : low > 0 ? `${low} low` : 'OK'}
                </span>
              </div>
              <p className={ui.clerkStatLabel}>Low / out of stock</p>
              <p className={ui.clerkStatValue}>{lowStockOrOutCount.toLocaleString()}</p>
              <p className={ui.clerkStatMeta}>
                {nearExpiryItems.length} SKU{nearExpiryItems.length === 1 ? '' : 's'} expiring within 30 days
              </p>
            </article>

            <article className={ui.clerkStatCard}>
              <div className={ui.clerkStatHead}>
                <span className={`${ui.clerkStatIcon} ${ui.clerkStatIconBlue}`}>
                  <StatCardIcon kind="request" />
                </span>
                <span className={ui.clerkDeltaInfo}>
                  {activeRequests.length} open
                </span>
              </div>
              <p className={ui.clerkStatLabel}>{monthLabel} requests</p>
              <p className={ui.clerkStatValue}>{monthlyRequestedMaterials.toLocaleString()}</p>
              <p className={ui.clerkStatMeta}>
                Total units requested on {monthlyRequests.length} requisition{monthlyRequests.length === 1 ? '' : 's'} this month
              </p>
            </article>
          </div>

          <section className={ui.clerkChartCard}>
            <div className={ui.clerkSectionHead}>
              <div>
                <h2 className={ui.clerkSectionTitle}>Stock Usage Velocity</h2>
                <p className={ui.clerkSectionSub}>Units you consumed per day (last 12 days).</p>
              </div>
              <div className={ui.clerkRangePills}>
                <span className={ui.clerkRangePillActive}>30 D</span>
                <span className={ui.clerkRangePill}>90 D</span>
              </div>
            </div>
            <div className={ui.clerkBars}>
              {chartBars.map((entry) => (
                <div key={entry.id} className={ui.clerkBarCol}>
                  <span className={entry.emphasis ? ui.clerkBarHintActive : ui.clerkBarHint}>{entry.amount}</span>
                  <div
                    className={entry.emphasis ? `${ui.clerkBar} ${ui.clerkBarActive}` : ui.clerkBar}
                    style={{ height: `${entry.value}%` }}
                  />
                  <span className={ui.clerkBarLabel}>{entry.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className={ui.clerkQuickRow}>
            <button type="button" className={`${ui.clerkQuickAction} ${ui.clerkQuickPink}`} onClick={() => navigate('/app/clerk/materials')}>
              <span className={ui.clerkQuickIcon}>
                <ClerkIcon kind="inventory" />
              </span>
              <span>Add Stock</span>
            </button>
            <button type="button" className={`${ui.clerkQuickAction} ${ui.clerkQuickBlue}`} onClick={() => navigate('/app/clerk/usage')}>
              <span className={ui.clerkQuickIcon}>
                <ClerkIcon kind="analytics" />
              </span>
              <span>Record Usage</span>
            </button>
            <button type="button" className={`${ui.clerkQuickAction} ${ui.clerkQuickGreen}`} onClick={() => navigate('/app/clerk/materials')}>
              <span className={ui.clerkQuickIcon}>
                <ClerkIcon kind="request" />
              </span>
              <span>Request Item</span>
            </button>
          </div>

          <section className={ui.clerkRecoBanner}>
            <div className={ui.clerkRecoCopy}>
              <span className={ui.clerkRecoIcon}>
                <ClerkIcon kind="analytics" />
              </span>
              <div>
                <h2 className={ui.clerkRecoTitle}>The Curator&apos;s Recommendation</h2>
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
                Apply Forecast
              </button>
              <button type="button" className={ui.clerkRecoSecondary}>
                Dismiss
              </button>
            </div>
          </section>
        </div>

        <aside className={ui.clerkSideRail}>
          <div className={ui.clerkSectionHead}>
            <h2 className={ui.clerkSideTitle}>Recent Movement</h2>
            <span className={ui.clerkSideDot} />
          </div>
          <div className={ui.clerkMovementList}>
            {recentMovement.map((entry) => (
              <article key={entry.id} className={ui.clerkMovementItem}>
                <span
                  className={
                    entry.tone === 'bad'
                      ? `${ui.clerkMovementIcon} ${ui.clerkMovementBad}`
                      : entry.tone === 'warn'
                        ? `${ui.clerkMovementIcon} ${ui.clerkMovementWarn}`
                        : entry.tone === 'ok'
                          ? `${ui.clerkMovementIcon} ${ui.clerkMovementOk}`
                          : `${ui.clerkMovementIcon} ${ui.clerkMovementNeutral}`
                  }
                >
                  <MovementIcon kind={entry.kind} />
                </span>
                <div className={ui.clerkMovementBody}>
                  <p className={ui.clerkMovementTime}>{entry.time}</p>
                  <p className={ui.clerkMovementTitle}>{entry.title}</p>
                  <p className={ui.clerkMovementMeta}>{entry.meta}</p>
                  <span className={ui.clerkMovementTag}>{entry.tag}</span>
                </div>
              </article>
            ))}
          </div>
          <button type="button" className={ui.clerkHistoryBtn} onClick={() => navigate('/app/clerk/documents')}>
            View full history log
          </button>
        </aside>
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
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [insightDismissed, setInsightDismissed] = useState(false);
  const shellSearch = useShellSearchQuery();
  const selectAllRef = useRef(null);

  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();

  const filteredItems = items.filter((item) => {
    const tokens = [query, shellSearch]
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean);
    const hay = `${item.name} ${item.sku || ''} ${item.category || ''}`.toLowerCase();
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
      Category: item.category || '',
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
                {category}
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
            const percentage = Math.max(0, Math.min(100, Math.round((Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 100))) * 100)));
            const initials = item.name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() || '')
              .join('');

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
                  <span className={ui.inventoryThumb} aria-hidden>
                    {initials}
                  </span>
                  <div>
                    <p className={ui.inventoryItemName}>{item.name}</p>
                    <p className={ui.inventoryItemMeta}>SKU: {item.sku || 'WL-0000-X'}</p>
                  </div>
                </div>

                <div>
                  <span className={ui.inventoryCategoryPill}>{item.category || 'Uncategorized'}</span>
                </div>

                <div className={ui.inventoryLevelCell}>
                  <div className={ui.inventoryLevelNumbers}>
                    <strong>{item.quantity}</strong>
                    <span>/ {item.maxThreshold || 100}</span>
                  </div>
                  <div className={ui.inventoryLevelTrack}>
                    <div
                      className={
                        status === 'Out of stock'
                          ? `${ui.inventoryLevelFill} ${ui.inventoryLevelFillBad}`
                          : status === 'Low stock'
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
                  <button type="button" className={ui.inventoryActionBtn} aria-label={`View ${item.name}`} onClick={() => navigate('/app/clerk/documents')}>
                    <EyeLineIcon />
                  </button>
                  <button type="button" className={ui.inventoryActionBtn} aria-label={`Edit ${item.name}`} onClick={() => navigate('/app/clerk/materials')}>
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

export function ClerkMaterials({ setRailSlot }) {
  const { t } = useI18n();
  const { state, createRequisition } = usePortalData();
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
              <p className={ui.materialsRequisitionH2}>{t('app.clerk.requisitionFormSubtitle')}</p>
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
                <span>{t('app.clerk.requisitionDeliveryNoteField')}</span>
                <textarea
                  className={ui.materialsTextarea}
                  rows={3}
                  value={deliveryNote}
                  onChange={(e) => {
                    setDeliveryNote(e.target.value);
                    setSubmitted(false);
                  }}
                  placeholder={t('app.clerk.requisitionDeliveryNotePlaceholder')}
                />
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
    const headers = ['Item name', 'SKU', 'Category', 'Days left', 'Expiry date', 'Quantity', 'Location'];
    const rows = items.map((item) => [
      item.name,
      item.sku || '',
      item.category || '',
      item.daysLeft,
      shortMonthDay(item.expiryDate),
      `${item.quantity} ${item.unit}`,
      item.location || '',
    ]);
    downloadAoAAsXlsx('clerk-expiry-log', [headers, ...rows], 'Expiry log');
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
          <button
            type="button"
            className={ui.portalFilterClear}
            onClick={() => {
              setExpCat('all');
              setExpQ('');
            }}
          >
            Clear
          </button>
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

          <div className={ui.expiryQueueList}>
            {queueItems.length ? (
              expiryQueuePager.pageSlice.map((item) => {
                const critical = item.daysLeft <= 2;
                const progress = Math.max(
                  10,
                  Math.min(100, Math.round((Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 100))) * 100))
                );
                const initials = item.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() || '')
                  .join('');

                return (
                  <article key={item.id} className={ui.expiryQueueCard}>
                    <div className={ui.expiryQueueMetaRow}>
                      <span className={critical ? `${ui.expiryTag} ${ui.expiryTagCritical}` : `${ui.expiryTag} ${ui.expiryTagUpcoming}`}>
                        {critical ? 'Expiring < 48 hrs' : `Expiring < ${Math.min(14, item.daysLeft)} days`}
                      </span>
                      <span className={ui.expirySku}>SKU: {item.sku || '—'}</span>
                    </div>

                    <div className={ui.expiryQueueBody}>
                      <span className={critical ? `${ui.expiryThumb} ${ui.expiryThumbCritical}` : ui.expiryThumb}>{initials}</span>
                      <div className={ui.expiryQueueMain}>
                        <p className={ui.expiryItemName}>{item.name}</p>
                        <div className={ui.expiryProgressTrack}>
                          <div className={critical ? `${ui.expiryProgressFill} ${ui.expiryProgressFillCritical}` : ui.expiryProgressFill} style={{ width: `${progress}%` }} />
                        </div>
                        <div className={ui.expiryQueueFoot}>
                          <span>Produced: {shortMonthDay(new Date(Date.now() - Math.max(30, item.daysLeft * 8) * 86400000))}</span>
                          <strong>Expiry: {shortMonthDay(item.expiryDate)}</strong>
                        </div>
                      </div>
                      <div className={ui.expiryCardActions}>
                        <button type="button" className={ui.expiryPrimaryBtn} onClick={() => navigate('/app/clerk/usage')}>
                          Record Usage
                        </button>
                        <button type="button" className={ui.expirySecondaryBtn} onClick={() => toggleSalvage(item.id)}>
                          {salvageMarked.includes(item.id) ? 'Salvage Marked' : 'Mark Salvage'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className={ui.expiryQueueCard}>
                <p className={ui.empty}>No expiring inventory items match this filter.</p>
              </article>
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
            <span>Monthly waste reduction: +{wasteDrop}%</span>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ClerkAlerts() {
  const { t } = useI18n();
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
  const consumedPager = usePagedList(consumedListFull, {
    resetKey: `${consumedQ}|${range}|${analyticsCategory}|${analyticsSubcategory}`,
  });
  const topItem = usageByItem[0]?.[0] || itemsScoped[0]?.name || '—';
  const predictiveText =
    totalUsage > 0
      ? `${topItem} leads consumption in this view (${totalUsage.toLocaleString()} units in the selected window). Review on-hand vs. min threshold.`
      : 'No consumption in this date range and category—widen the window or clear the category filter.';
  const totalWaste = `${Math.max(0, Math.min(12.5, (itemsScoped.filter((item) => item.expiryDate).length / Math.max(itemsScoped.length, 1)) * 14)).toFixed(1)}%`;
  const turnRate = `${Math.max(0, Math.min(24, totalUsage / Math.max(itemsScoped.length, 1))).toFixed(1)}x`;
  const chartLabels = granularity === 'day' ? ['Day 1', 'Day 2', 'Day 3', 'Day 4'] : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

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
          <p className={ui.analyticsLead}>Real-time inventory consumption, predictive modeling, and material use by time.</p>
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
        <button
          type="button"
          className={ui.portalFilterClear}
          onClick={() => {
            setAnomTone('all');
            setConsumedQ('');
            setAnalyticsCategory('all');
            setAnalyticsSubcategory('all');
          }}
        >
          {t('app.clerk.analyticsClearFilters')}
        </button>
        <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadAnalyticsExcel}>
          {t('app.clerk.analyticsDownloadExcel')}
        </button>
      </div>

      <div className={ui.analyticsTopGrid}>
        <section className={ui.analyticsTrendCard}>
          <div className={ui.analyticsSectionHead}>
            <div>
              <h2 className={ui.analyticsSectionTitle}>Monthly Usage Trends</h2>
              <p className={ui.analyticsSectionMeta}>
                Scoped to {range}d window, {granularity} buckets, and category filter; chart shape follows filtered volume.
              </p>
            </div>
            <div className={ui.analyticsTrendValue}>
              <strong>{totalUsage.toLocaleString()}</strong>
              <span>units consumed</span>
            </div>
          </div>

          <div className={ui.analyticsChart}>
            <div className={ui.analyticsChartGrid}>
              <svg viewBox="0 0 100 40" className={ui.analyticsChartSvg} preserveAspectRatio="none" aria-hidden>
                <path
                  d={`M 0 ${40 - trendPoints[0] * 0.4} C 14 ${40 - trendPoints[0] * 0.35}, 18 ${40 - trendPoints[1] * 0.45}, 33 ${40 - trendPoints[1] * 0.4} S 52 ${40 - trendPoints[2] * 0.35}, 66 ${40 - trendPoints[2] * 0.4} S 84 ${40 - trendPoints[3] * 0.48}, 100 ${40 - trendPoints[3] * 0.4}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </div>
            <div className={ui.analyticsChartLabels}>
              {chartLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </section>

        <aside className={ui.analyticsSideStack}>
          <section className={ui.analyticsPredictCard}>
            <p className={ui.analyticsPredictLabel}>Predictive Shortage</p>
            <p className={ui.analyticsPredictBody}>{predictiveText}</p>
            <button type="button" className={ui.analyticsPredictBtn} onClick={() => navigate('/app/clerk/materials')}>
              Automate Restock Order
            </button>
          </section>

          <section className={ui.analyticsNoteCard}>
            <p className={ui.analyticsNoteTitle}>Unusual Spike</p>
            <p className={ui.analyticsNoteBody}>
              Late-night usage of <strong>{topItem}</strong> detected in Warehouse A. This deviates from standard 9-5
              operations.
            </p>
            <div className={ui.analyticsNoteActions}>
              <button type="button" className={ui.analyticsMiniBtn}>
                View Log
              </button>
              <button type="button" className={ui.analyticsMiniBtn}>
                Dismiss
              </button>
            </div>
          </section>
        </aside>
      </div>

      <div className={ui.analyticsMiddleGrid}>
        <section className={ui.analyticsConsumedCard}>
          <div className={ui.analyticsSectionHead}>
            <div>
              <h2 className={ui.analyticsSectionTitle}>Most Consumed Items</h2>
              <p className={ui.analyticsSectionMeta}>Volume distribution by product line</p>
            </div>
            <button type="button" className={ui.analyticsLinkBtn} onClick={() => navigate('/app/clerk/inventory')}>
              View full list →
            </button>
          </div>

          <div className={ui.analyticsConsumedList}>
            {consumedPager.pageSlice.length ? (
              consumedPager.pageSlice.map(([name, qty], index) => (
                <article key={name} className={ui.analyticsConsumedRow}>
                  <div className={ui.analyticsConsumedTop}>
                    <strong>{name}</strong>
                    <span>{(qty * (index === 0 ? 200 : index === 1 ? 140 : index === 2 ? 95 : 41)).toLocaleString()} Units</span>
                  </div>
                  <div className={ui.analyticsConsumedTrack}>
                    <div
                      className={index === 1 ? `${ui.analyticsConsumedFill} ${ui.analyticsConsumedFillBlue}` : ui.analyticsConsumedFill}
                      style={{ width: `${Math.min(100, 28 + qty * 11)}%` }}
                    />
                  </div>
                </article>
              ))
            ) : (
              <p className={ui.empty}>No consumed lines match this search.</p>
            )}
          </div>
          <ListPageControls
            variant="feed"
            rangeFrom={consumedPager.rangeFrom}
            rangeTo={consumedPager.rangeTo}
            total={consumedPager.total}
            page={consumedPager.page}
            pageCount={consumedPager.pageCount}
            pagerNums={consumedPager.pagerNums}
            onPrev={consumedPager.goPrev}
            onNext={consumedPager.goNext}
            onSelectPage={consumedPager.setPage}
            canPrev={consumedPager.canPrev}
            canNext={consumedPager.canNext}
          />
        </section>

        <div className={ui.analyticsMiniStack}>
          <article className={ui.analyticsMetricCard}>
            <p className={ui.analyticsMetricLabel}>Total waste</p>
            <strong className={ui.analyticsMetricValue}>{totalWaste}</strong>
            <span className={ui.analyticsMetricMeta}>+0.8% increase</span>
          </article>
          <article className={ui.analyticsMetricCard}>
            <p className={ui.analyticsMetricLabel}>Inventory turn</p>
            <strong className={ui.analyticsMetricValue}>{turnRate}</strong>
            <span className={ui.analyticsMetricMeta}>Optimal range</span>
          </article>
          <article className={`${ui.analyticsMetricCard} ${ui.analyticsSyncCard}`}>
            <p className={ui.analyticsSyncTitle}>Last Sync Complete</p>
            <span>Database matched with RFID sensors 2m ago</span>
          </article>
        </div>
      </div>

      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <div>
            <h2 className={ui.analyticsSectionTitle}>Anomalous Consumption Log</h2>
          </div>
          <span className={ui.analyticsFlagPill}>4 Live Flagged</span>
        </div>

        <div className={ui.analyticsLogHead}>
          <span>Timestamp</span>
          <span>Item Identifier</span>
          <span>Location</span>
          <span>Quantity Delta</span>
          <span>Status</span>
        </div>

        <div className={ui.analyticsLogRows}>
          {anomalyPager.pageSlice.length ? (
            anomalyPager.pageSlice.map((row) => (
              <article key={row.id} className={ui.analyticsLogRow}>
                <span>{row.time}</span>
                <span>{row.code}</span>
                <span>{row.location}</span>
                <strong className={row.tone === 'bad' ? ui.analyticsDeltaBad : row.tone === 'ok' ? ui.analyticsDeltaOk : ui.analyticsDeltaWarn}>
                  {row.delta}
                </strong>
                <span
                  className={
                    row.tone === 'bad'
                      ? `${ui.analyticsStatusPill} ${ui.analyticsStatusBad}`
                      : row.tone === 'ok'
                        ? `${ui.analyticsStatusPill} ${ui.analyticsStatusOk}`
                        : `${ui.analyticsStatusPill} ${ui.analyticsStatusWarn}`
                  }
                >
                  {row.status}
                </span>
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
        <button type="button" className={ui.portalFilterClear} onClick={() => setHistSearch('')}>
          Clear
        </button>
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
              <span>Notes / reason for usage</span>
              <textarea
                className={ui.usageTextarea}
                rows={5}
                placeholder="Describe clinical context or specific case reference..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
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
            <p className={ui.usageInsightEyebrow}>Curator Insight</p>
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
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState(1);
  const [recipient, setRecipient] = useState('');
  const [notes, setNotes] = useState('');
  const [relatedRequisitionId, setRelatedRequisitionId] = useState('');
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [histSearch, setHistSearch] = useState('');
  const [billExportPeriod, setBillExportPeriod] = useState('30');
  const [billExportCategory, setBillExportCategory] = useState('all');

  useEffect(() => {
    if (!stockItems.length) {
      setItemId('');
      return;
    }
    if (!itemId || !stockItems.some((s) => s.id === itemId)) {
      setItemId(stockItems[0].id);
    }
  }, [stockItems, itemId]);

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

  const selectedItem = stockItems.find((s) => s.id === itemId);

  async function onSubmitBill(event) {
    event.preventDefault();
    setFormErr('');
    setFormOk(false);
    const item = stockItems.find((s) => s.id === itemId);
    const q = Number(qty);
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
    setSubmitting(true);
    try {
      await consumeStockItem(
        {
          itemId,
          quantity: q,
          purpose,
          consumptionKind: 'bill',
          relatedRequisitionId,
        },
        actor.id
      );
      setFormOk(true);
      setQty(1);
      setNotes('');
      setRelatedRequisitionId('');
    } catch (ex) {
      setFormErr(ex.message || t('app.clerk.billingErrorGeneric'));
    } finally {
      setSubmitting(false);
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
        <div className={ui.billingFormMain}>
          <form className={ui.billingFormCard} onSubmit={onSubmitBill}>
            {formErr ? <p className={ui.err}>{formErr}</p> : null}
            {formOk ? <p className={ui.billingFormSuccess}>{t('app.clerk.billingSuccess')}</p> : null}

            <div className={ui.portalProfilePair}>
              <label className={ui.billingFormField}>
                <span className={ui.billingFormLabel}>{t('app.clerk.billingFieldItem')}</span>
                <select
                  className={ui.billingFormInput}
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setFormOk(false);
                  }}
                  required
                  disabled={!stockItems.length}
                >
                  {stockItems.length ? null : <option value="">{t('app.clerk.billingNoSkus')}</option>}
                  {stockItems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({Number(s.quantity || 0).toLocaleString()} {s.unit || 'units'} on hand)
                    </option>
                  ))}
                </select>
              </label>
              <label className={ui.billingFormField}>
                <span className={ui.billingFormLabel}>{t('app.clerk.billingFieldQty')}</span>
                <input
                  className={ui.billingFormInput}
                  type="number"
                  min={1}
                  max={selectedItem ? Number(selectedItem.quantity || 0) : undefined}
                  value={qty}
                  onChange={(e) => {
                    setQty(e.target.value);
                    setFormOk(false);
                  }}
                  required
                />
              </label>
            </div>

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
              <span className={ui.billingFormLabel}>{t('app.clerk.billingFieldNotes')}</span>
              <textarea
                className={ui.billingFormTextarea}
                rows={3}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setFormOk(false);
                }}
                placeholder={t('app.clerk.billingNotesPlaceholder')}
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

            <button type="submit" className={ui.billingPrimaryBtn} disabled={submitting || !stockItems.length}>
              {submitting ? t('app.clerk.billingSubmitting') : t('app.clerk.billingSubmit')}
            </button>
          </form>

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
              <span>{t('app.clerk.billingColDateValue')}</span>
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
                    <span className={ui.billingHistoryDateValue}>{formatIsoDateOnly(row.createdAt) || '—'}</span>
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
        </div>

        <aside className={ui.billingRail}>
          <section className={ui.billingValueCard}>
            <p className={ui.billingValueLabel}>{t('app.clerk.billingRailMonth')}</p>
            <strong className={ui.billingValueAmount}>{billsThisMonth}</strong>
            <span className={ui.billingValueMeta}>{t('app.clerk.billingRailMonthMeta', { qty: qtyThisMonth })}</span>
          </section>
          <button type="button" className={ui.billingPrimaryBtn} onClick={() => navigate('/app/clerk/inventory')}>
            {t('app.clerk.billingOpenInventory')}
          </button>
          <p className={ui.billingRailTip}>{t('app.clerk.billingRailTip')}</p>
        </aside>
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
