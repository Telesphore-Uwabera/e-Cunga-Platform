import { useEffect, useId, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useShellSearchQuery } from '../../hooks/useShellSearchQuery.js';
import { getPeriodBounds, isoInRange } from '../../utils/reportFilters.js';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import { conicGradientFromSlices, REPORT_SLICE_COLORS } from '../../utils/reportCharts.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import ui from './DashboardUi.module.css';
import { ClearFiltersIconButton, StatusBadge, formatDate, formatMoney, stockStatus, workflowLabel } from './roleUi.jsx';
import { resolveWorkspaceCompanyName } from '../../utils/workspaceCompanyName.js';

function isBillConsumptionSupervisor(c) {
  if (c?.consumptionKind === 'bill') return true;
  return String(c?.purpose || '').startsWith('Bill:');
}

function matchesReqReportStatus(req, repReqStatus) {
  if (repReqStatus === 'all') return true;
  const s = req.status;
  if (repReqStatus === 'submitted') return s === 'submitted';
  if (repReqStatus === 'in_progress') return ['sentToSupplier', 'proformaReceived', 'proformaApproved'].includes(s);
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

function startOfLocalDaySup(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** One row per calendar day in the window, oldest → newest. */
function usageDailySeries(consumptions, dayCount) {
  const now = new Date();
  const buckets = [];
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = startOfLocalDaySup(d);
    buckets.push({
      key,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      total: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  consumptions.forEach((c) => {
    const key = startOfLocalDaySup(new Date(c.createdAt));
    const b = byKey.get(key);
    if (b) b.total += Number(c.quantity || 0);
  });
  return buckets;
}

/** Cap SVG point count by merging adjacent days. */
function usageTrendSlots(dailyBuckets, maxSlots = 10) {
  if (dailyBuckets.length <= maxSlots) {
    return dailyBuckets.map((b) => ({ label: b.label, total: b.total }));
  }
  const per = Math.ceil(dailyBuckets.length / maxSlots);
  const out = [];
  for (let i = 0; i < dailyBuckets.length; i += per) {
    const chunk = dailyBuckets.slice(i, i + per);
    out.push({
      label: chunk[0].label,
      total: chunk.reduce((s, x) => s + x.total, 0),
    });
  }
  return out;
}

function ownerLabel(ownerId, users) {
  if (!ownerId) return 'Unassigned';
  const u = users.find((x) => x.id === ownerId);
  if (!u) return 'Unassigned';
  return u.team ? `${u.fullName} · ${u.team}` : u.fullName;
}

function safeDocUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return t.startsWith('/') ? t : `/${t}`;
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
    ['Team', clerk.team || ''],
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

export function SupervisorDashboard() {
  const { language, t } = useI18n();
  const { user } = useAuth();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const usageTrendGradId = useId().replace(/:/g, '');
  const [usageRangeDays, setUsageRangeDays] = useState(7);
  const [usageCategory, setUsageCategory] = useState('all');
  const [usageLocation, setUsageLocation] = useState('all');
  const [usageClerk, setUsageClerk] = useState('all');
  const [usageSearch, setUsageSearch] = useState('');
  const [top10Period, setTop10Period] = useState('week');
  const [top10Location, setTop10Location] = useState('all');
  const [top10Clerk, setTop10Clerk] = useState('all');
  const requests = state.requisitions;
  const allItems = state.stockItems;
  const allConsumptions = state.consumptions;
  const allConsumptionsUsage = useMemo(
    () => allConsumptions.filter((c) => !isBillConsumptionSupervisor(c)),
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
    const cutoff = Date.now() - usageRangeDays * 86400000;
    return allConsumptionsUsage.filter((c) => {
      if (new Date(c.createdAt).getTime() < cutoff) return false;
      if (usageClerk !== 'all' && c.clerkId !== usageClerk) return false;
      const item = itemById[c.itemId];
      if (usageCategory !== 'all' && item?.category !== usageCategory) return false;
      if (usageLocation !== 'all' && item?.location !== usageLocation) return false;
      const q = usageSearch.trim().toLowerCase();
      if (q && !String(c.itemName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allConsumptionsUsage, usageRangeDays, usageClerk, itemById, usageCategory, usageLocation, usageSearch]);
  const topUsed = useMemo(
    () => usageTotalsWithUnit(filteredUsageConsumptions).slice(0, 10),
    [filteredUsageConsumptions]
  );
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
      const t0 = new Date(c.createdAt).getTime();
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
    () => usageDailySeries(filteredUsageConsumptions, usageRangeDays),
    [filteredUsageConsumptions, usageRangeDays]
  );
  const trendSlots = useMemo(() => usageTrendSlots(dailyForTrend, 10), [dailyForTrend]);
  const trendTotals = trendSlots.map((s) => s.total);
  const trendMax = Math.max(1, ...trendTotals);
  const trendPct = trendTotals.map((v) => Math.round((v / trendMax) * 100));
  const nTrend = trendSlots.length;
  const txTrend = nTrend <= 1 ? [50] : trendSlots.map((_, i) => 4 + (i / Math.max(1, nTrend - 1)) * 92);
  const baseYTrend = 44;
  const tyTrend = trendTotals.map((v) => baseYTrend - (v / trendMax) * 30);
  const trendLineD = txTrend.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${tyTrend[i]}`).join(' ');
  const trendAreaD =
    nTrend > 0 ? `${trendLineD} L ${txTrend[nTrend - 1]} ${baseYTrend} L ${txTrend[0]} ${baseYTrend} Z` : '';
  const pieDenom = useMemo(() => topUsed.reduce((s, e) => s + e.quantity, 0) || 1, [topUsed]);
  const pieSlices = useMemo(
    () =>
      topUsed.map((e, i) => ({
        name: e.name,
        value: e.quantity,
        unit: e.unit,
        pct: Math.round((e.quantity / pieDenom) * 100),
        color: REPORT_SLICE_COLORS[i % REPORT_SLICE_COLORS.length],
      })),
    [topUsed, pieDenom]
  );
  const top10BarMaxQty = top10Used[0]?.quantity || 1;
  const totalStockUnits = allItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const submitted = requests.filter((entry) => entry.status === 'submitted').length;
  const lowStock = allItems.filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0)).length;
  const latestUsed = usageByClerk(weeklyConsumptions, state.users).slice(0, 10);
  const invoices = [...state.invoices].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const criticalAlerts = [
    ...allItems
      .filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0))
      .slice(0, 2)
      .map((item) => ({
        id: `stk_${item.id}`,
        title: 'Stock depletion',
        body: `${item.name}: ${item.quantity} ${item.unit || ''} remaining in ${item.location}`,
      })),
    ...notificationsForRole(state, 'supervisor')
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
            <p className={ui.supervisorDashInstitution}>
              <strong>{institutionName}</strong>
            </p>
            <h3 className={ui.supervisorDashHeading}>{t('app.supervisor.dashHeading')}</h3>
          </div>
          <p className={ui.visuallyHidden}>{t('app.supervisor.dashLeadSr')}</p>
        </div>
      </div>

      <div className={ui.supervisorSummaryGrid}>
        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Inventory items</p>
            <span className={ui.supervisorSummaryNeutral}>{totalStockUnits.toLocaleString()} u</span>
          </div>
          <p className={ui.supervisorSummaryValue}>{allItems.length.toLocaleString()}</p>
        </article>

        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Low stock alerts</p>
            <span className={ui.supervisorSummaryIcon}>!</span>
          </div>
          <p className={ui.supervisorSummaryValue}>{lowStock}</p>
        </article>

        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Pending approvals</p>
            <span className={ui.supervisorSummaryIcon}>[]</span>
          </div>
          <p className={ui.supervisorSummaryValue}>{submitted}</p>
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
              <h2 className={ui.supervisorSectionTitle}>{t('app.supervisor.usageTitle')}</h2>
              <p className={ui.visuallyHidden}>{t('app.supervisor.usageLead')}</p>
            </div>
            <button
              type="button"
              className={ui.supervisorTextBtn}
              onClick={() => navigate('/app/supervisor/reports')}
              aria-label={t('app.supervisor.usageReportsLink')}
              title={t('app.supervisor.usageReportsLink')}
            >
              →
            </button>
          </div>

          <div className={ui.supervisorUsageToolbar} role="search">
            <div className={ui.supervisorUsageRange} role="group" aria-label={t('app.supervisor.usageRangeAria')}>
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={usageRangeDays === d ? `${ui.supervisorUsageRangeBtn} ${ui.supervisorUsageRangeBtnActive}` : ui.supervisorUsageRangeBtn}
                  onClick={() => setUsageRangeDays(d)}
                  title={d === 7 ? t('app.supervisor.usageDays7') : d === 14 ? t('app.supervisor.usageDays14') : t('app.supervisor.usageDays30')}
                >
                  {d === 7 ? t('app.supervisor.usageDays7Short') : d === 14 ? t('app.supervisor.usageDays14Short') : t('app.supervisor.usageDays30Short')}
                </button>
              ))}
            </div>
            <select
              className={ui.portalFilterSelect}
              value={usageCategory}
              onChange={(e) => setUsageCategory(e.target.value)}
              aria-label={t('app.supervisor.usageCategoryAria')}
            >
              <option value="all">{t('app.supervisor.usageAllCategories')}</option>
              {usageCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={ui.portalFilterSelect}
              value={usageLocation}
              onChange={(e) => setUsageLocation(e.target.value)}
              aria-label={t('app.supervisor.usageLocationAria')}
            >
              <option value="all">{t('app.supervisor.usageAllLocations')}</option>
              {usageLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <select
              className={ui.portalFilterSelect}
              value={usageClerk}
              onChange={(e) => setUsageClerk(e.target.value)}
              aria-label={t('app.supervisor.usageClerkAria')}
            >
              <option value="all">{t('app.supervisor.usageAllClerks')}</option>
              {clerkFilterOptions.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.fullName || cl.email}
                </option>
              ))}
            </select>
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

          <div className={ui.supervisorUsageKpiStrip} role="group" aria-label={t('app.supervisor.usageKpiAria')}>
            <span className={ui.supervisorUsageKpiChip} title={t('app.supervisor.usageTotalUnits')}>
              <strong>{usageFilteredTotalQty.toLocaleString()}</strong>
              <span className={ui.supervisorUsageKpiLabel}>{t('app.supervisor.usageTotalUnitsShort')}</span>
            </span>
            <span className={ui.supervisorUsageKpiChip} title={t('app.supervisor.usageEvents')}>
              <strong>{filteredUsageConsumptions.length}</strong>
              <span className={ui.supervisorUsageKpiLabel}>{t('app.supervisor.usageEventsShort')}</span>
            </span>
            <span className={ui.supervisorUsageKpiChip} title={t('app.supervisor.usageTopN')}>
              <strong>{topUsed.length}</strong>
              <span className={ui.supervisorUsageKpiLabel}>{t('app.supervisor.usageTopNShort')}</span>
            </span>
          </div>

          <div className={ui.supervisorUsageCharts}>
            <div className={ui.supervisorUsageTrendBlock}>
              <p className={ui.visuallyHidden}>{t('app.supervisor.usageTrendTitle')}</p>
              <div className={`${ui.analyticsChartGrid} ${ui.analyticsChartGridTall}`}>
                {nTrend > 0 && trendAreaD ? (
                  <svg
                    viewBox="0 0 100 52"
                    className={ui.analyticsChartSvgTall}
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={t('app.supervisor.usageTrendAria')}
                  >
                    <defs>
                      <linearGradient id={`${usageTrendGradId}-u`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(105 39 81 / 0.32)" />
                        <stop offset="100%" stopColor="rgb(105 39 81 / 0.04)" />
                      </linearGradient>
                    </defs>
                    <path d={trendAreaD} fill={`url(#${usageTrendGradId}-u)`} />
                    <path
                      d={trendLineD}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                      className={ui.supervisorUsageTrendLine}
                    />
                    {txTrend.map((x, i) => (
                      <g key={trendSlots[i].label}>
                        <circle cx={x} cy={tyTrend[i]} r="1.9" fill="var(--ec-primary)" />
                      </g>
                    ))}
                  </svg>
                ) : (
                  <p className={ui.supervisorUsageEmptyChart}>{t('app.supervisor.usageNoTrend')}</p>
                )}
              </div>
              <div className={ui.supervisorUsageTrendLabels}>
                {trendSlots.map((slot, i) => (
                  <span key={`${slot.label}-${i}`} title={`${trendPct[i] ?? 0}%`}>
                    {slot.label}
                    <span className={ui.visuallyHidden}>{trendPct[i] ?? 0}%</span>
                  </span>
                ))}
              </div>
            </div>

            <div className={ui.supervisorUsageDonutBlock}>
              <p className={ui.visuallyHidden}>{t('app.supervisor.usageMixTitle')}</p>
              <div className={ui.analyticsDonutRow}>
                <div
                  className={`${ui.analyticsDonut} ${ui.analyticsDonutLg}`}
                  style={{
                    background:
                      pieSlices.length > 0
                        ? `conic-gradient(${conicGradientFromSlices(pieSlices.map((s) => ({ value: s.value, color: s.color })))})`
                        : 'rgb(226 232 240)',
                  }}
                  role="img"
                  aria-label={t('app.supervisor.usageMixAria')}
                >
                  <div className={ui.analyticsDonutHole}>
                    <strong>{pieSlices[0]?.pct ?? 0}%</strong>
                  </div>
                </div>
                <ul className={`${ui.analyticsLegend} ${ui.supervisorUsageMixLegend}`}>
                  {pieSlices.length ? (
                    pieSlices.map((s) => (
                      <li key={s.name} className={ui.analyticsLegendRow}>
                        <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                        <span className={ui.analyticsLegendName}>{s.name}</span>
                        <span className={ui.analyticsLegendPct}>{s.pct}%</span>
                      </li>
                    ))
                  ) : (
                    <li className={ui.analyticsLegendRowMuted}>{t('app.supervisor.usageNoData')}</li>
                  )}
                </ul>
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
                <select
                  className={ui.portalFilterSelect}
                  value={top10Period}
                  onChange={(e) => setTop10Period(e.target.value)}
                  aria-label={t('app.supervisor.usageTop10PeriodAria')}
                >
                  <option value="week">{t('app.supervisor.usageTop10PeriodWeek')}</option>
                  <option value="m3">{t('app.supervisor.usageTop10PeriodLast3m')}</option>
                  <option value="m6">{t('app.supervisor.usageTop10PeriodLast6m')}</option>
                  <option value="m12">{t('app.supervisor.usageTop10PeriodLast12m')}</option>
                  {top10CalendarMonthKeys.map((k) => (
                    <option key={k} value={k}>
                      {formatYyyyMmMonthLabel(k, localeTag)}
                    </option>
                  ))}
                </select>
                <select
                  className={ui.portalFilterSelect}
                  value={top10Location}
                  onChange={(e) => setTop10Location(e.target.value)}
                  aria-label={t('app.supervisor.usageTop10LocationAria')}
                >
                  <option value="all">{t('app.supervisor.usageAllLocations')}</option>
                  {usageLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <select
                  className={ui.portalFilterSelect}
                  value={top10Clerk}
                  onChange={(e) => setTop10Clerk(e.target.value)}
                  aria-label={t('app.supervisor.usageTop10ClerkAria')}
                >
                  <option value="all">{t('app.supervisor.usageAllClerks')}</option>
                  {clerkFilterOptions.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.fullName || cl.email}
                    </option>
                  ))}
                </select>
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
                latestUsed.map((entry) => (
                <article key={entry.id} className={ui.supervisorActivityRow}>
                  <span className={ui.supervisorAvatar}>{entry.clerk?.fullName?.slice(0, 2).toUpperCase() || 'CL'}</span>
                  <div>
                    <p className={ui.supervisorActivityTitle}>
                      {entry.clerk?.fullName || 'Clerk'} recorded usage of {entry.quantity} {entry.unit}
                    </p>
                    <p className={ui.supervisorActivityMeta}>
                      {formatDate(entry.createdAt)} - {entry.clerk?.location || 'Warehouse'}
                    </p>
                  </div>
                </article>
                ))
              ) : (
                <p className={ui.supervisorSectionMeta}>No consumption recorded in the last 7 days.</p>
              )}
            </div>
          </section>

          <section className={ui.supervisorFinanceCard}>
            <div className={ui.supervisorSectionHead}>
              <div>
                <h2 className={ui.supervisorSectionTitle}>Accountant Documents</h2>
                <p className={ui.supervisorSectionMeta}>Invoices and supporting documents shared with finance.</p>
              </div>
            </div>
            <div className={ui.supervisorFinanceList}>
              {invoices.slice(0, 3).map((invoice) => (
                <article key={invoice.id} className={ui.supervisorFinanceRow}>
                  <div>
                    <p className={ui.supervisorFinanceTitle}>{invoice.reference}</p>
                    <p className={ui.supervisorFinanceMeta}>
                      {invoice.attachmentUrl ? (
                        <a href={safeDocUrl(invoice.attachmentUrl)} target="_blank" rel="noopener noreferrer">
                          Proforma
                        </a>
                      ) : (
                        'Pending proforma'
                      )}
                      {' · '}
                      {invoice.deliveryNoteUrl ? (
                        <a href={safeDocUrl(invoice.deliveryNoteUrl)} target="_blank" rel="noopener noreferrer">
                          Delivery note
                        </a>
                      ) : (
                        'No delivery note'
                      )}
                      {' · '}
                      {invoice.finalInvoiceUrl ? (
                        <a href={safeDocUrl(invoice.finalInvoiceUrl)} target="_blank" rel="noopener noreferrer">
                          Final invoice
                        </a>
                      ) : (
                        'No final invoice'
                      )}
                    </p>
                  </div>
                  <span className={ui.supervisorFinanceStatus}>{workflowLabel(invoice.status)}</span>
                </article>
              ))}
            </div>
          </section>

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
}

export function SupervisorClerksManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { state, inviteWorkspaceUser } = usePortalData();
  const navigate = useNavigate();
  const location = useLocation();
  const actor = useSupervisorActor(state, user);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    role: 'clerk',
    team: 'Operations',
    location: 'HQ Kigali',
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
      if (data?.inviteEmailSent) {
        alert('We sent an email with a 6-digit code. They should use Activate account to set a password.');
      } else if (data?.temporaryPassword) {
        alert(`User added. Temporary password: ${data.temporaryPassword}`);
      }
      setInviteForm({ email: '', fullName: '', role: 'clerk', team: 'Operations', location: 'HQ Kigali' });
      setShowInviteForm(false);
    } catch (err) {
      alert(err?.message || 'Unable to invite user.');
    }
  }
  const clerkUsers = useMemo(
    () => state.users.filter((entry) => entry.role === 'clerk' && entry.isActive),
    [state.users]
  );
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
    const headers = ['Clerk', 'Team', 'Location', 'Tracked items', 'Total units', 'Measures', 'Low stock', 'Pending approvals'];
    const rows = clerkSummaries.map((entry) => [
      entry.clerk.fullName,
      entry.clerk.team || '',
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
      <div className={ui.supervisorDashTop}>
        <div>
          <h1 className={ui.supervisorDashTitle}>{t('app.supervisor.clerksTitle')}</h1>
          <p className={ui.visuallyHidden}>{t('app.supervisor.clerksPageLead')}</p>
        </div>
        <div className={ui.supervisorClerksTopActions}>
          <button
            type="button"
            className={ui.adminUsersAddBtn}
            onClick={() => setShowInviteForm((c) => !c)}
            disabled={state.users.length >= state.company.usersLimit}
            aria-expanded={showInviteForm}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14M19 7h-4M7 19v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {t('app.supervisor.teamAddUser')}
          </button>
          <button type="button" className={ui.supervisorReportBtn} onClick={downloadMonthlyReport}>
            {t('app.supervisor.clerksDownloadMonthly')}
          </button>
        </div>
      </div>

      {showInviteForm ? (
        <section id="supervisor-clerks-invite-section" className={ui.adminUsersInviteCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h2 className={ui.adminUsersSectionTitle}>{t('app.supervisor.teamInviteTitle')}</h2>
              <p className={ui.adminUsersSectionMeta}>{t('app.supervisor.clerksInviteMeta')}</p>
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
            />
            <span className={ui.adminUsersSectionMeta} style={{ alignSelf: 'center', padding: '0 0.25rem' }}>
              {t('roles.clerk')}
            </span>
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldTeam')}
              value={inviteForm.team}
              onChange={(e) => setInviteForm({ ...inviteForm, team: e.target.value })}
            />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldLocation')}
              value={inviteForm.location}
              onChange={(e) => setInviteForm({ ...inviteForm, location: e.target.value })}
            />
            <button type="submit" className={ui.adminPrimaryBtn} disabled={state.users.length >= state.company.usersLimit}>
              {t('app.supervisor.teamSaveUser')}
            </button>
          </form>
        </section>
      ) : null}

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
            {clerkSummaries.map((entry) => {
              const locLine = [entry.clerk.team, entry.clerk.location].filter(Boolean).join(' · ');
              const healthTitle =
                entry.items > 0
                  ? t('app.supervisor.clerksCardHealthTitle', {
                      ok: entry.okSkus,
                      low: entry.lowStock,
                      items: entry.items,
                    })
                  : t('app.supervisor.clerksCardHealthEmpty');
              return (
                <article key={entry.clerk.id} className={ui.supervisorClerkSummary}>
                  <div className={ui.supervisorClerkRow}>
                    <div className={ui.supervisorClerkIdentity}>
                      <span className={ui.supervisorClerkAvatarTile} aria-hidden>
                        {clerkCardInitials(entry.clerk.fullName)}
                      </span>
                      <div className={ui.supervisorClerkIdText}>
                        <p className={ui.supervisorClerkName}>{entry.clerk.fullName}</p>
                        {locLine ? (
                          <p className={ui.supervisorClerkLoc} title={locLine}>
                            {locLine}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className={ui.supervisorClerkStatStrip} role="group" aria-label={t('app.supervisor.clerksCardStatsGroup')}>
                      <span className={ui.supervisorClerkStat} title={t('app.supervisor.clerksCardSkuTitle')}>
                        <ClerkRowIcon kind="sku" />
                        {entry.items}
                      </span>
                      <span className={ui.supervisorClerkStat} title={t('app.supervisor.clerksCardUnitsTitle')}>
                        <ClerkRowIcon kind="units" />
                        {entry.totalUnits.toLocaleString()}
                        <span className={ui.supervisorClerkStatSuffix}>u</span>
                      </span>
                      <span
                        className={`${ui.supervisorClerkStat} ${entry.lowStock > 0 ? ui.supervisorClerkStatWarn : ''}`}
                        title={t('app.supervisor.clerksCardLowTitle')}
                      >
                        <ClerkRowIcon kind="low" />
                        {entry.lowStock}
                      </span>
                      <span className={ui.supervisorClerkStat} title={t('app.supervisor.clerksCardPendingTitle')}>
                        <ClerkRowIcon kind="pending" />
                        {entry.pending}
                      </span>
                      {entry.unitTags.length ? (
                        <span className={ui.supervisorClerkUnitTags} aria-hidden>
                          {entry.unitTags.map((u) => (
                            <span key={u} className={ui.supervisorClerkUnitTag}>
                              {u}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>

                    <div className={ui.supervisorClerkHealth} role="img" aria-label={healthTitle}>
                      <div className={ui.supervisorClerkHealthTrack}>
                        {entry.items > 0 ? (
                          <>
                            {entry.okSkus > 0 ? (
                              <span className={ui.supervisorClerkHealthOk} style={{ flex: entry.okSkus }} />
                            ) : null}
                            {entry.lowStock > 0 ? (
                              <span className={ui.supervisorClerkHealthLow} style={{ flex: entry.lowStock }} />
                            ) : null}
                          </>
                        ) : (
                          <span className={ui.supervisorClerkHealthEmpty} />
                        )}
                      </div>
                    </div>

                    <div
                      className={ui.supervisorClerkLatest}
                      title={
                        entry.latestUsage
                          ? `${entry.latestUsage.itemName} · ${entry.latestUsage.quantity} ${entry.latestUsage.unit || ''}`
                          : t('app.supervisor.clerksNoUsage')
                      }
                    >
                      {entry.latestUsage ? (
                        <>
                          <span className={ui.supervisorClerkLatestQty}>
                            {entry.latestUsage.quantity}
                            {entry.latestUsage.unit ? `\u00A0${entry.latestUsage.unit}` : ''}
                          </span>
                          <span className={ui.supervisorClerkLatestName}>{entry.latestUsage.itemName}</span>
                        </>
                      ) : (
                        <span className={ui.supervisorClerkLatestEmpty}>—</span>
                      )}
                    </div>

                    <div className={ui.supervisorClerkActions}>
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
                        onClick={() => navigate('/app/supervisor/visibility')}
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

export function SupervisorVisibility() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [warehouse, setWarehouse] = useState('all');
  const [invSearch, setInvSearch] = useState('');
  const shellInvSearch = useShellSearchQuery();
  const allRows = state.stockItems.map((item) => ({
    ...item,
    status: stockStatus(item),
  }));
  const categories = [...new Set(allRows.map((item) => item.category).filter(Boolean))];
  const warehouses = [...new Set(allRows.map((item) => item.location).filter(Boolean))];
  const invSearchTokens = [invSearch, shellInvSearch]
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
  const filteredRows = allRows.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (warehouse !== 'all' && item.location !== warehouse) return false;
    const hay = `${item.name} ${item.sku || ''} ${item.category || ''}`.toLowerCase();
    if (invSearchTokens.length && !invSearchTokens.every((tok) => hay.includes(tok))) return false;
    return true;
  });
  const invPager = usePagedList(filteredRows, { resetKey: `${category}|${status}|${warehouse}|${invSearch}|${shellInvSearch}` });
  const totalAssetUnits = allRows.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalLocations = warehouses.length;
  const unitMixSummary = useMemo(() => {
    const map = allRows.reduce((m, item) => {
      const u = item.unit || 'units';
      m.set(u, (m.get(u) || 0) + 1);
      return m;
    }, new Map());
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([u, c]) => `${c} line${c === 1 ? '' : 's'} in ${u}`)
      .slice(0, 6)
      .join(' · ');
  }, [allRows]);
  const lowStockRows = allRows
    .filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0))
    .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0));
  const predictiveItem = lowStockRows[0] || allRows[0];
  const recentActivity = [...state.activity].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

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
  }

  return (
    <div className={ui.supervisorInventoryBoard}>
      <div className={ui.supervisorInventoryHeader}>
        <div>
          <h1 className={ui.supervisorInventoryTitle}>{t('app.supervisor.inventoryTitle')}</h1>
          <p className={ui.supervisorInventoryLead} aria-hidden>
            {totalAssetUnits.toLocaleString()} u · {totalLocations} WH
          </p>
          <p className={ui.visuallyHidden}>
            {totalAssetUnits.toLocaleString()} total units across {totalLocations} warehouse locations.
            {unitMixSummary ? ` Unit mix: ${unitMixSummary}.` : ''}
          </p>
        </div>
        <div className={ui.supervisorInventoryActions}>
          <button type="button" className={ui.inventoryDownloadBtn} onClick={exportInventoryCsv}>
            Export Excel
          </button>
          <button type="button" className={ui.supervisorInventoryPrimaryBtn} onClick={() => navigate('/app/supervisor/approvals')}>
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
            <select
              className={ui.supervisorInventorySelect}
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
              }}
            >
              <option value="all">All Categories</option>
              {categories.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={ui.supervisorInventoryFilterGrid}>
          <label className={ui.supervisorInventoryFilter}>
            <span className={ui.supervisorInventoryFilterLabel}>Status</span>
            <select
              className={ui.supervisorInventorySelect}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="In stock">In Stock</option>
              <option value="Low stock">Low Stock</option>
              <option value="Out of stock">Out of Stock</option>
            </select>
          </label>
          <label className={ui.supervisorInventoryFilter}>
            <span className={ui.supervisorInventoryFilterLabel}>Warehouse</span>
            <select
              className={ui.supervisorInventorySelect}
              value={warehouse}
              onChange={(event) => {
                setWarehouse(event.target.value);
              }}
            >
              <option value="all">Global View</option>
              {warehouses.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={ui.supervisorInventoryFiltersActions}>
          <ClearFiltersIconButton className={ui.supervisorInventoryClearIcon} title={t('common.clearFiltersAria')} onClick={clearFilters} />
        </div>
      </div>

      <div className={ui.supervisorInventoryTable}>
        <div className={ui.supervisorInventoryTableHead}>
          <span>SKU</span>
          <span>Item Name</span>
          <span>Category</span>
          <span>Stock Level</span>
          <span>Status</span>
          <span>Warehouse</span>
          <span>Actions</span>
        </div>

        <div className={ui.supervisorInventoryRows}>
          {invPager.pageSlice.map((item) => {
            const levelPct = Math.max(0, Math.min(100, (Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 1))) * 100));
            const statusClass =
              item.status === 'Out of stock'
                ? `${ui.inventoryStatusPill} ${ui.inventoryStatusBad}`
                : item.status === 'Low stock'
                  ? `${ui.inventoryStatusPill} ${ui.inventoryStatusWarn}`
                  : `${ui.inventoryStatusPill} ${ui.inventoryStatusOk}`;
            return (
              <article key={item.id} className={ui.supervisorInventoryRow}>
                <div className={ui.supervisorInventorySku}>{item.sku}</div>
                <div>
                  <p className={ui.supervisorInventoryItemName}>{item.name}</p>
                  <p className={ui.supervisorInventoryItemMeta}>Managed by {ownerLabel(item.ownerId, state.users)}</p>
                </div>
                <div>
                  <span className={ui.inventoryCategoryPill}>{item.category}</span>
                </div>
                <div className={`${ui.inventoryLevelCell} ${ui.supervisorInventoryLevelCell}`}>
                  <div className={ui.inventoryLevelNumbers}>
                    <strong>
                      {item.quantity} {item.unit || ''}
                    </strong>
                    <span>
                      min {item.minThreshold} · max {item.maxThreshold} {item.unit || ''} · {Math.round(levelPct)}%
                    </span>
                  </div>
                </div>
                <div>
                  <span className={statusClass}>{item.status}</span>
                </div>
                <div className={ui.supervisorInventoryWarehouse}>{item.location}</div>
                <div className={ui.supervisorInventoryActionCell}>
                  <button type="button" className={ui.supervisorInventoryActionBtn} onClick={() => navigate('/app/supervisor/invoices')}>
                    View
                  </button>
                </div>
              </article>
            );
          })}
        </div>

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
          <p className={ui.supervisorInsightEyebrow}>Predictive Insight: Supply Chain Warning</p>
          <p className={ui.supervisorInsightText}>
            Based on current consumption rates and low-stock positions, <strong>{predictiveItem?.name}</strong> is projected to remain under safe
            coverage at <strong>{predictiveItem?.location}</strong>. We recommend initiating a supervisor review and restock action within 48 hours.
          </p>
          <button type="button" className={ui.supervisorInsightBtn} onClick={() => navigate('/app/supervisor/approvals')}>
            Authorize Restock Transfer
          </button>
        </section>

        <aside className={ui.supervisorActivityRail}>
          <p className={ui.supervisorActivityRailLabel}>Recent System Activity</p>
          <div className={ui.supervisorActivityRailList}>
            {recentActivity.map((entry) => (
              <article key={entry.id} className={ui.supervisorActivityRailRow}>
                <span className={ui.supervisorActivityDot} />
                <div>
                  <p className={ui.supervisorActivityRailTitle}>{entry.action}</p>
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
}

export function SupervisorApprovals() {
  const { t } = useI18n();
  const { state, reviewRequisition } = usePortalData();
  const { user } = useAuth();
  const actor = useSupervisorActor(state, user);
  const navigate = useNavigate();
  const [note, setNote] = useState({});
  const [reviewError, setReviewError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [locFilter, setLocFilter] = useState('all');
  const [reqSearch, setReqSearch] = useState('');
  const shellReqSearch = useShellSearchQuery();
  const approvalLocations = useMemo(
    () => [...new Set(state.requisitions.map((r) => r.location).filter(Boolean))].sort(),
    [state.requisitions]
  );
  const searchTokens = [reqSearch, shellReqSearch]
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
  const requests = (
    filter === 'pending'
      ? state.requisitions.filter((entry) => entry.status === 'submitted')
      : filter === 'reviewed'
        ? state.requisitions.filter((entry) => entry.status !== 'submitted')
        : state.requisitions
  ).filter((entry) => {
    if (locFilter !== 'all' && entry.location !== locFilter) return false;
    const hay = `${entry.title} ${entry.clerkName || ''} ${entry.id}`.toLowerCase();
    if (searchTokens.length && !searchTokens.every((tok) => hay.includes(tok))) return false;
    return true;
  });
  const sortedRequests = useMemo(
    () => [...requests].sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0)),
    [requests]
  );
  const approvalReqPager = usePagedList(sortedRequests, { resetKey: `${filter}|${locFilter}|${reqSearch}|${shellReqSearch}` });
  const pendingCount = state.requisitions.filter((entry) => entry.status === 'submitted').length;
  const priorityCount = state.requisitions.filter((entry) => entry.status === 'submitted' && ['high', 'critical'].includes(entry.priority)).length;
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

  async function review(id, decision) {
    setReviewError(null);
    try {
      await reviewRequisition(id, decision, note[id] || '', actor?.id);
    } catch (e) {
      setReviewError(e.message || 'Review failed.');
    }
  }

  return (
    <div className={ui.supervisorApprovalBoard}>
      {reviewError ? (
        <div className={ui.panel} style={{ marginBottom: '1rem' }}>
          <p className={ui.panelSub}>{reviewError}</p>
          <button type="button" className={ui.supervisorTextBtn} onClick={() => setReviewError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      <div className={ui.supervisorApprovalTop}>
        <div>
          <p className={ui.supervisorApprovalEyebrow}>Curation Hub</p>
          <h1 className={ui.supervisorApprovalTitle}>{t('app.supervisor.approvalTitle')}</h1>
          <p className={ui.supervisorApprovalLead}>
            Manage and review incoming stock procurement requests for e-CUNGA logistics chain.
          </p>
        </div>
        <div className={ui.supervisorApprovalStatRow}>
          <article className={ui.supervisorApprovalStat}>
            <span className={ui.supervisorApprovalStatLabel}>Pending</span>
            <strong className={ui.supervisorApprovalStatValue}>{String(pendingCount).padStart(2, '0')}</strong>
          </article>
          <article className={ui.supervisorApprovalStat}>
            <span className={ui.supervisorApprovalStatLabel}>Priority</span>
            <strong className={ui.supervisorApprovalStatValue}>{String(priorityCount).padStart(2, '0')}</strong>
          </article>
        </div>
      </div>

      <div className={ui.toolbar}>
        <div className={ui.segmented}>
          {[
            ['pending', 'Pending'],
            ['reviewed', 'Reviewed'],
            ['all', 'All'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? ui.segBtnActive : ui.segBtn} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Location</span>
          <select className={ui.portalFilterSelect} value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
            <option value="all">All locations</option>
            {approvalLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.portalFilterField} style={{ flex: '1 1 14rem', maxWidth: '24rem' }}>
          <span className={ui.portalFilterLabel}>Search</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="Title, clerk, request ID…"
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
        <span className={ui.portalFilterMeta}>{requests.length} in view</span>
      </div>

      <div className={ui.supervisorApprovalGrid}>
        <section className={ui.supervisorApprovalList}>
          {sortedRequests.length ? (
            approvalReqPager.pageSlice.map((request, index) => {
              const lineCount = request.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
              const primaryLine = request.lines[0];
              const priorityTone =
                request.priority === 'critical' || request.priority === 'high'
                  ? ui.supervisorApprovalPriorityHot
                  : request.priority === 'normal'
                    ? ui.supervisorApprovalPriorityWarm
                    : ui.supervisorApprovalPriorityCool;

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
                          <span className={`${ui.supervisorApprovalPriority} ${priorityTone}`}>{request.priority}</span>
                        </div>
                        <div className={ui.supervisorApprovalMeta}>
                          <span>{request.clerkName}</span>
                          <span>{formatDate(request.requestedAt)}</span>
                          <span>
                            {lineCount} {primaryLine?.unit || 'units'}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={workflowLabel(request.status)} />
                    </div>

                    <p className={ui.supervisorApprovalText}>
                      "{request.supervisorNote || `Request includes ${primaryLine?.description || 'inventory support'} for ${request.location} with ${request.lines.length} line items.`}"
                    </p>

                    <div className={ui.supervisorApprovalFoot}>
                      <button type="button" className={ui.supervisorApprovalLink} onClick={() => navigate('/app/supervisor/invoices')}>
                        View full justification
                      </button>
                      {request.status === 'submitted' ? (
                        <div className={ui.supervisorApprovalActions}>
                          <input
                            className={ui.supervisorApprovalInput}
                            placeholder="Add supervisor note"
                            value={note[request.id] || ''}
                            onChange={(event) => setNote({ ...note, [request.id]: event.target.value })}
                          />
                          <button type="button" className={ui.supervisorRejectBtn} onClick={() => review(request.id, 'rejected')}>
                            Reject
                          </button>
                          <button type="button" className={ui.supervisorApproveBtn} onClick={() => review(request.id, 'approved')}>
                            Approve Request
                          </button>
                        </div>
                      ) : (
                        <div className={ui.supervisorReviewedNote}>{request.supervisorNote || 'Reviewed and routed.'}</div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className={ui.panel}>
              <h2 className={ui.panelTitle}>Approval queue clear</h2>
              <p className={ui.panelSub}>There are no requests in this filter right now.</p>
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
              View Optimization Report
            </button>
          </section>

          <section className={ui.supervisorApprovalHistory}>
            <h2 className={ui.supervisorApprovalRailTitle}>Approval History</h2>
            <div className={ui.supervisorApprovalHistoryList}>
              {approvalHistory.map((entry) => (
                <article key={entry.id} className={ui.supervisorApprovalHistoryRow}>
                  <span className={ui.supervisorApprovalHistoryBar} />
                  <div>
                    <p className={ui.supervisorApprovalHistoryTitle}>{entry.action.replaceAll('.', ' ')}</p>
                    <p className={ui.supervisorApprovalHistoryMeta}>
                      {entry.actorName} · {formatDate(entry.createdAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={ui.supervisorApprovalHealth}>
            <p className={ui.supervisorApprovalHealthLabel}>Inventory Health</p>
            <strong className={ui.supervisorApprovalHealthValue}>Stable {healthPct}%</strong>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function SupervisorInvoices() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const [shift, setShift] = useState('Morning');
  const [sortBy, setSortBy] = useState('Accuracy'); // Accuracy = sort by closed requisition %
  const dayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const clerks = state.users.filter((entry) => entry.role === 'clerk');

  const clerkRows = clerks.map((clerk) => {
    const requisitions = state.requisitions.filter((entry) => entry.clerkId === clerk.id);
    const consumptions = state.consumptions.filter((entry) => entry.clerkId === clerk.id);
    const submitted = requisitions.filter((entry) => entry.status === 'submitted').length;
    const escalated = requisitions.filter((entry) => ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid'].includes(entry.status)).length;
    const consumptionsToday = consumptions.filter((c) => new Date(c.createdAt).getTime() >= dayStart).length;
    const reqsToday = requisitions.filter((r) => new Date(r.requestedAt).getTime() >= dayStart).length;
    const tasksToday = consumptionsToday + reqsToday;
    const closedCount = requisitions.filter((r) => r.status === 'closed').length;
    const fulfillmentPct = requisitions.length === 0 ? null : (closedCount / requisitions.length) * 100;
    const status =
      fulfillmentPct == null ? 'neutral' : fulfillmentPct >= 80 ? 'strong' : fulfillmentPct >= 40 ? 'active' : 'review';
    return {
      clerk,
      requisitions: requisitions.length,
      submitted,
      escalated,
      lastRequest: requisitions[0]?.updatedAt || '',
      tasksToday,
      fulfillmentPct,
      status,
    };
  });
  const sortedClerkRows = [...clerkRows].sort((a, b) => {
    if (sortBy === 'Accuracy') return (b.fulfillmentPct ?? -1) - (a.fulfillmentPct ?? -1);
    return b.tasksToday - a.tasksToday;
  });
  const totalItems = state.stockItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const avgProcessHours =
    state.requisitions.length === 0
      ? 0
      : state.requisitions.reduce((sum, request) => {
          const created = new Date(request.requestedAt).getTime();
          const updated = new Date(request.updatedAt || request.requestedAt).getTime();
          return sum + Math.max(0, (updated - created) / (1000 * 60 * 60));
        }, 0) / state.requisitions.length;
  const liveLogs = [...state.activity]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((entry) => ({
      ...entry,
      title:
        entry.action === 'stock.request.approved'
          ? 'Batch approval'
          : entry.action === 'invoice.proforma.received'
            ? 'Reconciliation'
            : entry.action === 'invoice.paid'
              ? 'Report generated'
              : entry.action === 'workflow.closed'
                ? 'System alert'
                : 'Login event',
    }));

  return (
    <div className={ui.supervisorMonitorBoard}>
      <div className={ui.supervisorMonitorGrid}>
        <section className={ui.supervisorMonitorMain}>
          <div className={ui.supervisorMonitorTop}>
            <div className={ui.supervisorMonitorTitleBlock}>
              <h1 className={ui.supervisorMonitorTitle}>{t('app.supervisor.monitorTitle')}</h1>
              <p className={ui.supervisorMonitorLead}>Real-time performance metrics and oversight.</p>
            </div>
            <article className={ui.supervisorMonitorMetric}>
              <span className={ui.supervisorMonitorMetricLabel}>Avg. requisition age</span>
              <strong className={ui.supervisorMonitorMetricValue}>{avgProcessHours.toFixed(1)}</strong>
              <span className={ui.supervisorMonitorMetricUnit}>hours</span>
            </article>
            <article className={ui.supervisorMonitorMetric}>
              <span className={ui.supervisorMonitorMetricLabel}>Total Items</span>
              <strong className={ui.supervisorMonitorMetricValue}>{totalItems.toLocaleString()}</strong>
            </article>
          </div>

          <section className={ui.supervisorMonitorCard}>
            <div className={ui.supervisorMonitorCardHead}>
              <h2 className={ui.supervisorMonitorCardTitle}>Active Clerks</h2>
              <div className={ui.supervisorMonitorFilters}>
                <button type="button" className={ui.supervisorMonitorChip} onClick={() => setShift(shift === 'Morning' ? 'Evening' : 'Morning')}>
                  Shift: {shift}
                </button>
                <button
                  type="button"
                  className={ui.supervisorMonitorChip}
                  onClick={() => setSortBy(sortBy === 'Accuracy' ? 'Tasks' : 'Accuracy')}
                >
                  Sort: {sortBy === 'Accuracy' ? 'Closed %' : 'Tasks'}
                </button>
              </div>
            </div>

            <div className={ui.supervisorMonitorClerkList}>
              {sortedClerkRows.map((entry) => (
                <article key={entry.clerk.id} className={ui.supervisorMonitorClerkRow}>
                  <div className={ui.supervisorMonitorClerkIdentity}>
                    <span className={ui.supervisorMonitorAvatar}>{entry.clerk.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
                    <div>
                      <p className={ui.supervisorMonitorClerkName}>{entry.clerk.fullName}</p>
                      <p className={ui.supervisorMonitorClerkRole}>{entry.clerk.team || 'Inventory clerk'}</p>
                    </div>
                  </div>
                  <div className={ui.supervisorMonitorStatCell}>
                    <span className={ui.supervisorMonitorMiniLabel}>Today (events)</span>
                    <strong>{entry.tasksToday}</strong>
                  </div>
                  <div className={ui.supervisorMonitorStatCell}>
                    <span className={ui.supervisorMonitorMiniLabel}>Closed reqs</span>
                    <strong>{entry.fulfillmentPct == null ? '—' : `${entry.fulfillmentPct.toFixed(1)}%`}</strong>
                  </div>
                  <div className={ui.supervisorMonitorStatusWrap}>
                    <span
                      className={
                        entry.status === 'strong'
                          ? `${ui.supervisorMonitorStatus} ${ui.supervisorMonitorStatusGood}`
                          : entry.status === 'active'
                            ? `${ui.supervisorMonitorStatus} ${ui.supervisorMonitorStatusStable}`
                            : entry.status === 'neutral'
                              ? `${ui.supervisorMonitorStatus} ${ui.supervisorMonitorStatusStable}`
                              : `${ui.supervisorMonitorStatus} ${ui.supervisorMonitorStatusReview}`
                      }
                    >
                      {entry.status === 'strong'
                        ? 'Strong'
                        : entry.status === 'active'
                          ? 'Active'
                          : entry.status === 'neutral'
                            ? 'No reqs'
                            : 'Review'}
                    </span>
                  </div>
                  <button type="button" className={ui.supervisorMonitorArrow} onClick={() => navigate('/app/supervisor/visibility')}>
                    &gt;
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className={ui.supervisorMonitorRail}>
          <div className={ui.supervisorMonitorRailHead}>
            <h2 className={ui.supervisorMonitorRailTitle}>Live Activity Log</h2>
            <button type="button" className={ui.supervisorMonitorRailIcon} onClick={() => navigate('/app/supervisor/reports')}>
              =
            </button>
          </div>

          <div className={ui.supervisorMonitorLogList}>
            {liveLogs.map((entry, index) => (
              <article key={entry.id} className={ui.supervisorMonitorLogRow}>
                <span
                  className={
                    index === 0
                      ? `${ui.supervisorMonitorLogDot} ${ui.supervisorMonitorLogPurple}`
                      : index === 1
                        ? `${ui.supervisorMonitorLogDot} ${ui.supervisorMonitorLogBlue}`
                        : index === 2
                          ? `${ui.supervisorMonitorLogDot} ${ui.supervisorMonitorLogRed}`
                          : ui.supervisorMonitorLogDot
                  }
                />
                <div>
                  <p className={ui.supervisorMonitorLogTitle}>{entry.title}</p>
                  <p className={ui.supervisorMonitorLogText}>
                    {entry.actorName} {entry.action === 'stock.request.approved' ? 'approved a request' : 'updated the workflow'}.
                  </p>
                  <p className={ui.supervisorMonitorLogMeta}>{formatDate(entry.createdAt)}</p>
                </div>
              </article>
            ))}
          </div>

          <button type="button" className={ui.supervisorMonitorHistoryBtn} onClick={() => navigate('/app/supervisor/reports')}>
            View Historical Logs
          </button>
        </aside>
      </div>
    </div>
  );
}

export function SupervisorReports() {
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

  const { start, end } = useMemo(() => getPeriodBounds(period), [period]);

  const reportCategories = useMemo(
    () => [...new Set(state.stockItems.map((item) => item.category).filter(Boolean))].sort(),
    [state.stockItems]
  );
  const reportWarehouses = useMemo(
    () => [...new Set(state.stockItems.map((item) => item.location).filter(Boolean))].sort(),
    [state.stockItems]
  );

  const stockForReport = useMemo(() => {
    const q = repSearch.trim().toLowerCase();
    return state.stockItems.filter((item) => {
      if (repCategory !== 'all' && item.category !== repCategory) return false;
      if (repWarehouse !== 'all' && item.location !== repWarehouse) return false;
      if (!matchesStockReportStatus(item, repStockStatus)) return false;
      if (q && !`${item.name} ${item.sku || ''} ${item.category || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.stockItems, repCategory, repWarehouse, repSearch, repStockStatus]);

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

  const maxTrend = Math.max(...trendValues, 1);
  const nT = trendValues.length;
  const txT =
    nT <= 1
      ? [50]
      : trendValues.map((_, i) => Math.round(6 + (i / Math.max(1, nT - 1)) * 88));
  const baseYT = 44;
  const tyT = trendValues.map((v) => baseYT - (v / maxTrend) * 32);
  const trendLineDT = txT.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${tyT[i]}`).join(' ');
  const trendAreaDT =
    nT > 0 ? `${trendLineDT} L ${txT[nT - 1]} ${baseYT} L ${txT[0]} ${baseYT} Z` : '';
  const trendPctEach = trendValues.map((v) => Math.round((v / maxTrend) * 100));

  const categoryGroups = stockForReport.reduce((map, item) => {
    map.set(item.category, (map.get(item.category) || 0) + 1);
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
    doc.text('e-CUNGA Supervisor Intelligence Report', 14, 18);
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
      'SUMMARY:e-CUNGA Weekly Supervisor Ledger',
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

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Warehouse</span>
          <select className={ui.portalFilterSelect} value={repWarehouse} onChange={(e) => setRepWarehouse(e.target.value)}>
            <option value="all">All locations</option>
            {reportWarehouses.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Category</span>
          <select className={ui.portalFilterSelect} value={repCategory} onChange={(e) => setRepCategory(e.target.value)}>
            <option value="all">All categories</option>
            {reportCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Req. status</span>
          <select className={ui.portalFilterSelect} value={repReqStatus} onChange={(e) => setRepReqStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="in_progress">In progress</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Stock status</span>
          <select className={ui.portalFilterSelect} value={repStockStatus} onChange={(e) => setRepStockStatus(e.target.value)}>
            <option value="all">Any level</option>
            <option value="in_stock">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </label>
        <label className={ui.portalFilterField} style={{ flex: '1 1 12rem', maxWidth: '22rem' }}>
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
          {stockForReport.length} SKUs · {reqsForReport.length} requisitions · {invoicesScoped.length} invoices (period)
        </span>
      </div>

      <div className={ui.supervisorReportGrid}>
        <section className={ui.supervisorReportTrendCard}>
          <div className={ui.supervisorReportCardHead}>
            <h2 className={ui.supervisorReportCardTitle}>Invoice trend (6 mo)</h2>
            <div className={ui.supervisorReportValueBlock}>
              <strong>{formatMoney(currentValue, 'RWF')}</strong>
              <span>
                {monthlyFlux >= 0 ? '+' : ''}
                {monthlyFlux.toFixed(1)}% vs first month
              </span>
            </div>
          </div>

          <div className={`${ui.analyticsChartGrid} ${ui.analyticsChartGridTall}`}>
            <svg
              viewBox="0 0 100 52"
              className={`${ui.supervisorReportTrendSvg} ${ui.analyticsChartSvgTall}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Monthly invoice totals trend"
            >
              <defs>
                <linearGradient id={`${trendGradId}-sup`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(105 39 81 / 0.35)" />
                  <stop offset="100%" stopColor="rgb(105 39 81 / 0.05)" />
                </linearGradient>
              </defs>
              {trendAreaDT ? (
                <>
                  <path d={trendAreaDT} fill={`url(#${trendGradId}-sup)`} />
                  <path d={trendLineDT} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
                  {txT.map((x, i) => (
                    <g key={`${trendMonths[i]}-${i}`}>
                      <circle cx={x} cy={tyT[i]} r="2" fill="var(--ec-primary)" />
                      <text
                        x={x}
                        y={Math.max(7, tyT[i] - 5)}
                        textAnchor="middle"
                        fontSize="5"
                        fontWeight="700"
                        fill="var(--ec-primary-dark)"
                      >
                        {trendPctEach[i]}%
                      </text>
                    </g>
                  ))}
                </>
              ) : null}
            </svg>
          </div>
          <div className={ui.supervisorReportMonthRow}>
            {trendMonths.map((month, idx) => (
              <span key={`${month}-${idx}`}>
                {month}
                <strong className={ui.analyticsChartLabelPct}>{trendPctEach[idx] ?? 0}%</strong>
              </span>
            ))}
          </div>
        </section>

        <section className={ui.supervisorReportCategoryCard}>
          <h2 className={ui.supervisorReportCardTitle}>SKU mix by category</h2>
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
                  <span className={ui.analyticsLegendName}>{entry.label}</span>
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
              Monitoring →
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

        <aside className={ui.supervisorReportExportCard}>
          <h2 className={ui.supervisorReportExportTitle}>Export</h2>
          <p className={ui.supervisorReportExportMeta}>PDF · Excel · Calendar</p>
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
          <div className={ui.supervisorReportInsight}>
            <strong>{t('cungaAi.insightReady')}</strong>
            <span>{t('cungaAi.reportPoweredBy')}</span>
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
}

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
