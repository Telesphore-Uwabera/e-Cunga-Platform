import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useShellSearchQuery } from '../../hooks/useShellSearchQuery.js';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import { getAdminDateBounds, isoInBounds } from '../../utils/reportFilters.js';
import { conicGradientFromSlices, REPORT_SLICE_COLORS } from '../../utils/reportCharts.js';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import ui from './DashboardUi.module.css';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import { apiUploadMedia, apiFetch } from '../../api/client.js';
import { ClearFiltersIconButton, PageIntro, StatusBadge, formatMoney, workflowLabel } from './roleUi.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { describeActivityEntry } from '../../utils/activityLabels.js';

const ADMIN_REPORT_REGIONS = ['Gasabo', 'Kicukiro', 'HQ Kigali'];

function startOfDayMs(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** First day (00:00 local) of an N-day window ending today. */
function adminEngagementWindowStart(dayCount) {
  const endDay = startOfDayMs(new Date());
  const start = new Date(endDay);
  start.setDate(start.getDate() - (dayCount - 1));
  return start.getTime();
}

const RBAC_MATRIX = [
  { area: 'Inventory', clerk: 'Register + consume', supervisor: 'Read', accountant: 'Read', supplier: '—', admin: 'Full' },
  { area: 'Requisitions', clerk: 'Create', supervisor: 'Approve / reject', accountant: 'Track', supplier: 'Read approved', admin: 'Full' },
  { area: 'Invoices', clerk: 'Read own flow', supervisor: 'Visibility', accountant: 'Approve / pay', supplier: 'Upload docs', admin: 'Full' },
  { area: 'Payments', clerk: '—', supervisor: '—', accountant: 'Execute', supplier: 'Receive notice', admin: 'Full' },
  { area: 'Users / settings', clerk: '—', supervisor: '—', accountant: '—', supplier: '—', admin: 'Full' },
];

function RbacOpenWorkflowsList({ requisitions }) {
  const sorted = useMemo(
    () => [...requisitions].sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0)),
    [requisitions]
  );
  const pager = usePagedList(sorted, { resetKey: requisitions.length });
  return (
    <>
      <ul className={ui.listPlain}>
        {pager.pageSlice.map((entry) => (
          <li key={entry.id} className={ui.listItem}>
            <p className={ui.itemTitle}>{entry.title}</p>
            <p className={ui.itemMeta}>
              {entry.clerkName} · <span className={ui.highlight}>{workflowLabel(entry.status)}</span>
            </p>
          </li>
        ))}
      </ul>
      <ListPageControls
        variant="table"
        rangeFrom={pager.rangeFrom}
        rangeTo={pager.rangeTo}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        pagerNums={pager.pagerNums}
        onPrev={pager.goPrev}
        onNext={pager.goNext}
        onSelectPage={pager.setPage}
        canPrev={pager.canPrev}
        canNext={pager.canNext}
      />
    </>
  );
}

function useAdminActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'admin'),
    [state.users, user?.email]
  );
}

function matchesReqWorkflowStatus(req, key) {
  if (key === 'all') return true;
  const s = req.status;
  if (key === 'submitted') return s === 'submitted';
  if (key === 'in_progress') {
    return ['sentToSupplier', 'proformaAwaitingClerk', 'proformaReceived', 'proformaApproved'].includes(s);
  }
  if (key === 'fulfilled') return ['paid', 'deliveryNoteAttached', 'closed'].includes(s);
  if (key === 'rejected') return s === 'rejected';
  return true;
}

function AdminIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'users') {
    return (
      <svg {...common}>
        <path d="M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 20a4.5 4.5 0 0 1 9 0M13.5 20a3.5 3.5 0 0 1 7 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'settings') {
    return (
      <svg {...common}>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19 12a7 7 0 0 0-.08-1l2.04-1.6-2-3.46-2.48 1a7.2 7.2 0 0 0-1.72-1L14.5 3h-5l-.26 2.94a7.2 7.2 0 0 0-1.72 1l-2.48-1-2 3.46L5.08 11a7 7 0 0 0 0 2l-2.04 1.6 2 3.46 2.48-1a7.2 7.2 0 0 0 1.72 1L9.5 21h5l.26-2.94a7.2 7.2 0 0 0 1.72-1l2.48 1 2-3.46L18.92 13c.05-.33.08-.66.08-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 18V6h16v12H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 14h3m2 0h3M8 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AdminDashboard() {
  const { t } = useI18n();
  const { state, deleteStockItem } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { flash, FlashBanner } = useFlash();
  useAdminActor(state, user);
  const totalUsers = state.users.length;
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [engagementDays, setEngagementDays] = useState('all');
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (user?.canApproveRegistrations) {
      apiFetch('/registrations/pending-companies')
        .then((data) => {
          if (!cancelled && data?.companies) {
            setPendingApprovals(data.companies.length);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [user]);
  const priceByName = useMemo(() => {
    const m = {};
    for (const c of state.supplierCatalog || []) {
      m[String(c.name).toLowerCase()] = Number(c.price) || 0;
    }
    return m;
  }, [state.supplierCatalog]);
  const inventoryValue = useMemo(
    () =>
      state.stockItems.reduce((sum, entry) => {
        const p = priceByName[String(entry.name).toLowerCase()] || 0;
        return sum + Number(entry.quantity || 0) * p;
      }, 0),
    [state.stockItems, priceByName]
  );
  const revenue = state.invoices.filter((entry) => ['paid', 'closed'].includes(entry.status)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const requisitionTerminalStatuses = ['paid', 'deliveryNoteAttached', 'closed'];

  const requisitionCompletionPct = useMemo(() => {
    let startMs;
    if (engagementDays === 'all') {
      const allEvents = [...state.activity, ...state.consumptions, ...state.stockItems];
      if (allEvents.length === 0) {
        startMs = adminEngagementWindowStart(30);
      } else {
        const earliest = allEvents.reduce((acc, c) => {
          const t = new Date(c.createdAt || c.updatedAt || Date.now()).getTime();
          return t < acc ? t : acc;
        }, Date.now());
        startMs = startOfDayMs(earliest);
      }
    } else {
      startMs = adminEngagementWindowStart(engagementDays);
    }

    const now = Date.now();
    const inWindow = (state.requisitions || []).filter((r) => {
      const t = new Date(r.requestedAt || r.createdAt || r.updatedAt || now).getTime();
      if (Number.isNaN(t)) return false;
      return t >= startMs && t <= now;
    });
    if (!inWindow.length) return 0;
    const done = inWindow.filter((r) => requisitionTerminalStatuses.includes(r.status)).length;
    return Math.min(100, Math.round((done / inWindow.length) * 100));
  }, [state.requisitions, engagementDays]);

  const { engagementBarHeights, engagementPeakIdx, engagementDayCount, engagementRawValues, engagementDateLabels, engagementSlotSize, engagementStartMs } = useMemo(() => {
    let dayCount = engagementDays === 'all' ? 30 : Number(engagementDays);
    let startMs;

    if (engagementDays === 'all') {
      const allEvents = [...state.activity, ...state.consumptions, ...state.stockItems];
      if (allEvents.length === 0) {
        startMs = adminEngagementWindowStart(30);
        dayCount = 30;
      } else {
        const earliest = allEvents.reduce((acc, c) => {
          const t = new Date(c.createdAt || c.updatedAt || Date.now()).getTime();
          return t < acc ? t : acc;
        }, Date.now());
        startMs = startOfDayMs(earliest);
        dayCount = Math.max(7, Math.ceil((Date.now() - startMs) / 86400000) + 1);
      }
    } else {
      startMs = adminEngagementWindowStart(dayCount);
    }

    const endMs = Date.now();
    // Cap buckets to prevent UI lag if 'all' is very long
    const maxBars = 60;
    const slotSize = Math.ceil(dayCount / maxBars);
    const buckets = Array(Math.ceil(dayCount / slotSize)).fill(0);
    const consumptionBuckets = Array(Math.ceil(dayCount / slotSize)).fill(0);
    const activityBuckets = Array(Math.ceil(dayCount / slotSize)).fill(0);
    
    for (const c of state.consumptions || []) {
      const ts = new Date(c.createdAt || c.updatedAt || Date.now()).getTime();
      if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;
      const idx = Math.floor((ts - startMs) / (86400000 * slotSize));
      if (idx >= 0 && idx < buckets.length) {
        const qty = Number(c.quantity || 0);
        buckets[idx] += qty;
        consumptionBuckets[idx] += qty;
      }
    }
    for (const item of state.stockItems || []) {
      const ts = new Date(item.createdAt || item.updatedAt || Date.now()).getTime();
      if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;
      const idx = Math.floor((ts - startMs) / (86400000 * slotSize));
      if (idx >= 0 && idx < buckets.length) buckets[idx] += Number(item.quantity || 0);
    }
    for (const a of state.activity || []) {
      const ts = new Date(a.createdAt || a.updatedAt || Date.now()).getTime();
      if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;
      const idx = Math.floor((ts - startMs) / (86400000 * slotSize));
      if (idx >= 0 && idx < buckets.length) {
        buckets[idx] += 0.35;
        activityBuckets[idx] += 1;
      }
    }
    const max = Math.max(1, ...buckets);
    const peakIdx = buckets.indexOf(Math.max(...buckets));
    const heights = buckets.map((n) => Math.round((n / max) * 100));

    // Build date labels for each bucket
    const dateLabels = buckets.map((_, i) => {
      const slotStart = new Date(startMs + i * slotSize * 86400000);
      const slotEnd = new Date(startMs + (i + 1) * slotSize * 86400000 - 1);
      if (slotSize === 1) {
        return slotStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      return `${slotStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${slotEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    });

    // Raw values: consumption units + activity count per bucket
    const rawValues = buckets.map((_, i) => ({
      consumption: Math.round(consumptionBuckets[i]),
      activity: Math.round(activityBuckets[i]),
      total: Math.round(buckets[i]),
    }));

    return { engagementBarHeights: heights, engagementPeakIdx: peakIdx, engagementDayCount: dayCount, engagementRawValues: rawValues, engagementDateLabels: dateLabels, engagementSlotSize: slotSize, engagementStartMs: startMs };
  }, [state.consumptions, state.activity, state.stockItems, engagementDays]);

  const recentActivity = useMemo(() => {
    return (state.activity || []).slice(0, 5).map((a) => ({
      id: a.id,
      title: describeActivityEntry(a, t),
      meta: new Date(a.createdAt).toLocaleString(),
      tone:
        String(a.action || '').includes('rejected') || String(a.action || '').includes('error')
          ? 'bad'
          : String(a.action || '').includes('paid') || String(a.action || '').includes('closed')
            ? 'good'
            : 'info',
    }));
  }, [state.activity, t]);
  const insightItemsAll = useMemo(
    () =>
      [...state.stockItems]
        .sort((a, b) => {
          const aRatio = Number(a.quantity || 0) / Math.max(1, Number(a.minThreshold || 1));
          const bRatio = Number(b.quantity || 0) / Math.max(1, Number(b.minThreshold || 1));
          return aRatio - bRatio;
        })
        .filter((item) => categoryFilter === 'all' || item.category === categoryFilter)
        .map((item) => {
          const stockRatio = Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 1));
          const unitPrice = priceByName[String(item.name).toLowerCase()] || 0;
          return {
            ...item,
            value: Number(item.quantity || 0) * unitPrice,
            stockRatio,
            statusLabel: Number(item.quantity || 0) <= Number(item.minThreshold || 0) ? 'Restock' : 'In Stock',
            statusTone: Number(item.quantity || 0) <= Number(item.minThreshold || 0) ? 'bad' : 'good',
          };
        }),
    [state.stockItems, priceByName]
  );
  const insightPager = usePagedList(insightItemsAll, { resetKey: 'admin-dashboard-insights' });

  return (
    <div className={ui.adminDash}>
      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title="Delete Item"
        message={`Delete ${deletingItem?.name}?`}
        confirmText="Delete"
        onConfirm={async () => {
          try {
            await deleteStockItem(deletingItem.id);
          } catch (e) {
            flash(e?.message || 'Unable to delete item.', 'error');
            throw e;
          }
        }}
        onClose={() => setDeletingItem(null)}
      />
      <FlashBanner />
      <div className={ui.adminSummaryGrid}>
        <div className={ui.adminSummaryLeftRow}>
          <article className={ui.adminSummaryCard}>
            <div className={ui.summaryCardHead}>
              <p className={ui.adminSummaryLabel}>Total users</p>
              <button
                type="button"
                className={ui.summaryCardPlus}
                onClick={() => navigate('/app/admin/users', { state: { openInvite: true } })}
                title="Add User"
              >
                +
              </button>
            </div>
            <strong className={ui.adminSummaryValue}>{totalUsers.toLocaleString()}</strong>
            <span className={ui.adminSummaryMeta}>Active workspace accounts</span>
          </article>

          <article className={ui.adminSummaryCard}>
            <div className={ui.summaryCardHead}>
              <p className={ui.adminSummaryLabel}>Inventory value</p>
              <button
                type="button"
                className={ui.summaryCardPlus}
                onClick={() => window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal'))}
                title="Add Item"
              >
                +
              </button>
            </div>
            <strong className={ui.adminSummaryValue}>{formatMoney(inventoryValue)}</strong>
            <span className={ui.adminSummaryMeta}>{t('app.admin.inventoryValueMeta')}</span>
          </article>

          <article className={ui.adminSummaryCard}>
            <p className={ui.adminSummaryLabel}>Quick Actions</p>
            <div className={ui.adminQuickActions}>
              <button type="button" className={ui.adminQuickBtn} onClick={() => navigate('/app/admin/users', { state: { openInvite: true } })}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg> Add User
              </button>
              <button type="button" className={ui.adminQuickBtnStrong} onClick={() => window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal'))}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg> Add Item
              </button>
            </div>
            <span className={ui.adminSummaryMeta}>Operational shortcuts</span>
          </article>
        </div>

        <article className={`${ui.adminSummaryCard} ${ui.adminSummaryCardAccent}`}>
          <p className={ui.adminSummaryLabel}>Pending approvals</p>
          <strong className={ui.adminSummaryValue}>{pendingApprovals}</strong>
          <button type="button" className={ui.adminSummaryBtn} onClick={() => navigate('/app/admin/company-registrations')}>Review Now</button>
        </article>
      </div>

      <div className={ui.adminMainGrid}>
        <section className={ui.adminCurveCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h1 className={ui.adminTitle}>{t('app.admin.dashTitle')}</h1>
              <p className={ui.adminLead}>{t('app.admin.dashEngagementLead', { days: engagementDays === 'all' ? engagementDayCount : engagementDays })}</p>
            </div>
            <label className={ui.visuallyHidden} htmlFor="admin-dash-engagement-range">
              {t('app.admin.dashEngagementRangeLabel')}
            </label>
            <select
              id="admin-dash-engagement-range"
              className={ui.adminRangeBtn}
              value={engagementDays}
              onChange={(e) => setEngagementDays(Number(e.target.value))}
              aria-label={t('app.admin.dashEngagementRangeLabel')}
            >
              <option value="all">All Time</option>
              <option value={7}>{t('app.admin.dashEngagementOption7')}</option>
              <option value={30}>{t('app.admin.dashEngagementOption30')}</option>
              <option value={90}>{t('app.admin.dashEngagementOption90')}</option>
            </select>
          </div>

          <div
            className={ui.adminCurveChart}
            role="img"
            aria-label={t('app.admin.dashEngagementChartAria', { days: engagementDays })}
            style={{ position: 'relative' }}
            onMouseLeave={() => setHoveredBarIdx(null)}
          >
            {engagementBarHeights.map((height, index) => (
              <span
                key={`bar-${index}`}
                className={index === engagementPeakIdx && height > 0 ? ui.adminCurveBarAccent : ui.adminCurveBar}
                style={{
                  height: `${height}%`,
                  minHeight: height > 0 ? '4px' : '2px',
                  cursor: 'pointer',
                  opacity: hoveredBarIdx !== null && hoveredBarIdx !== index ? 0.45 : 1,
                  transition: 'opacity 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={() => setHoveredBarIdx(index)}
              />
            ))}

            {/* Hover tooltip */}
            {hoveredBarIdx !== null && engagementRawValues[hoveredBarIdx] !== undefined ? (
              <div
                className={ui.adminChartTooltip}
                style={{
                  left: `${((hoveredBarIdx + 0.5) / engagementBarHeights.length) * 100}%`,
                  bottom: `${engagementBarHeights[hoveredBarIdx] + 4}%`,
                }}
              >
                <span className={ui.adminChartTooltipDate}>{engagementDateLabels[hoveredBarIdx]}</span>
                <span className={ui.adminChartTooltipValue}>{engagementRawValues[hoveredBarIdx].consumption.toLocaleString()} units</span>
                <span className={ui.adminChartTooltipMeta}>{engagementRawValues[hoveredBarIdx].activity} events</span>
              </div>
            ) : null}
          </div>

          <div className={ui.adminCurveFooter}>
            <span>
              {t('app.admin.dashEngagementDayLabel', { n: 1 })}
            </span>
            <span>
              {t('app.admin.dashEngagementDayLabel', { n: Math.max(1, Math.ceil((engagementDays === 'all' ? engagementDayCount : engagementDays) / 2)) })}
            </span>
            <span>
              {t('app.admin.dashEngagementDayLabel', { n: engagementDays === 'all' ? engagementDayCount : engagementDays })}
            </span>
          </div>
        </section>

        <aside className={ui.adminRail}>
          <section className={ui.adminMovementCard}>
            <p className={ui.adminMovementLabel}>{t('app.admin.dashMovementTitle')}</p>
            <div className={ui.adminMovementRing} style={{ '--admin-progress': `${requisitionCompletionPct}%` }}>
              <span>{requisitionCompletionPct}%</span>
              <small>{t('app.admin.dashMovementRingCaption')}</small>
            </div>
            <p className={ui.adminMovementText}>{t('app.admin.dashMovementHelp', { days: engagementDays })}</p>
          </section>

          <section className={ui.adminActivityCard}>
            <h2 className={ui.adminActivityTitle}>Recent Activity</h2>
            <div className={ui.adminActivityList}>
              {recentActivity.map((entry) => (
                <article key={entry.id} className={ui.adminActivityItem}>
                  <span
                    className={
                      entry.tone === 'good'
                        ? ui.adminActivityDotGood
                        : entry.tone === 'info'
                        ? ui.adminActivityDotInfo
                        : ui.adminActivityDotBad
                    }
                  />
                  <div>
                    <p className={ui.adminActivityItemTitle}>{entry.title}</p>
                    <p className={ui.adminActivityItemMeta}>{entry.meta}</p>
                  </div>
                </article>
              ))}
            </div>
            <button type="button" className={ui.adminActivityBtn} onClick={() => navigate('/app/admin/activity')}>
              View All Activities
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginLeft: '6px' }}>
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </section>
        </aside>
      </div>

      <section className={ui.adminInsightCard}>
        <div className={ui.adminCardHead}>
          <div>
            <h2 className={ui.adminInsightTitle}>Curated Insights</h2>
            <p className={ui.adminLead}>Inventory items requiring attention</p>
          </div>
          <div className={ui.adminInsightActions}>
            <select
              className={ui.adminUsersSelect}
              style={{ width: 'auto', minWidth: '160px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="Laboratory">Laboratory</option>
              <option value="Medical consumables">Medical consumables</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Office supplies">Office supplies</option>
              <option value="Cold chain">Cold chain</option>
            </select>
            <button type="button" className={ui.adminGhostBtn} onClick={() => flash('Preparing Excel export. Your download will start shortly.', 'ok')}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
                <path d="M12 4v9m0 0 3.5-3.5M12 13l-3.5-3.5M5 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export Excel
            </button>
            <button type="button" className={ui.adminPrimaryBtn} onClick={() => navigate('/app/admin/settings')}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
                <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="2" />
                <path d="M19 12a7 7 0 0 0-.08-1l2.04-1.6-2-3.46-2.48 1a7.2 7.2 0 0 0-1.72-1L14.5 3h-5l-.26 2.94a7.2 7.2 0 0 0-1.72 1l-2.48-1-2 3.46L5.08 11a7 7 0 0 0 0 2l-2.04 1.6 2 3.46 2.48-1a7.2 7.2 0 0 0 1.72 1L9.5 21h5l.26-2.94a7.2 7.2 0 0 0 1.72-1l2.48 1 2-3.46L18.92 13c.05-.33.08-.66.08-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              Update Settings
            </button>
          </div>
        </div>

        <div className={ui.adminUsersTableWrap}>
          <div className={ui.adminInsightTableHead}>
            <span>Item Name</span>
            <span>SKU</span>
            <span>Stock Level</span>
            <span>Value</span>
            <span>Status</span>
            <span />
          </div>

        <div className={ui.adminInsightRows}>
          {insightPager.pageSlice.map((item) => (
            <article key={item.id} className={ui.adminInsightRow}>
              <div className={ui.adminInsightItem}>
                <span className={ui.adminInsightThumb}>
                  <AdminIcon kind="reports" />
                </span>
                <div>
                  <p className={ui.adminInsightItemName}>{item.name}</p>
                  <p className={ui.adminInsightItemMeta}>{item.category}</p>
                </div>
              </div>
              <div className={ui.adminInsightSku}>{item.sku}</div>
              <div className={ui.adminInsightStock}>
                <div className={ui.adminInsightTrack}>
                  <span className={ui.adminInsightFill} style={{ width: `${Math.max(12, Math.min(100, item.stockRatio * 100))}%` }} />
                </div>
                <small>{item.quantity} {item.unit}</small>
              </div>
              <div className={ui.adminInsightValue}>{formatMoney(item.value)}</div>
              <div>
                <span className={item.statusTone === 'good' ? ui.adminInsightBadgeGood : ui.adminInsightBadgeBad}>{item.statusLabel}</span>
              </div>
              <div className={ui.adminInsightActionsRow} style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className={ui.adminInsightMore} title="View Details" onClick={() => setSelectedDetailItem(item)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
                <button type="button" className={ui.adminInsightMore} title="Edit" onClick={() => window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal', { detail: { item } }))}>
                  ✎
                </button>
                <button type="button" className={ui.adminInsightMore} title="Delete" onClick={() => setDeletingItem(item)} style={{ color: '#ef4444' }}>
                  ✕
                </button>
              </div>
            </article>
          ))}
          </div>
        </div>
        <ListPageControls
          variant="table"
          rangeFrom={insightPager.rangeFrom}
          rangeTo={insightPager.rangeTo}
          total={insightPager.total}
          page={insightPager.page}
          pageCount={insightPager.pageCount}
          pagerNums={insightPager.pagerNums}
          onPrev={insightPager.goPrev}
          onNext={insightPager.goNext}
          onSelectPage={insightPager.setPage}
          canPrev={insightPager.canPrev}
          canNext={insightPager.canNext}
        />

        <StockItemDetailModal
          isOpen={Boolean(selectedDetailItem)}
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
        />
      </section>
    </div>
  );
}

export function AdminUsers() {
  const { t } = useI18n();
  const { flash, FlashBanner } = useFlash();
  const { state, inviteWorkspaceUser, toggleWorkspaceUserActive, updateWorkspaceUser, deleteWorkspaceUser } = usePortalData();
  const { user } = useAuth();
  const actor = useAdminActor(state, user);
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', fullName: '', role: 'clerk', jobTitle: '', phone: '', location: '' });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [workspaceBusyId, setWorkspaceBusyId] = useState(null);
  const [rolePatchBusyId, setRolePatchBusyId] = useState(null);
  const [changingRole, setChangingRole] = useState(null);
  const shellUserSearch = useShellSearchQuery();

  useEffect(() => {
    function onShellOpenInvite() {
      setShowInviteForm(true);
    }
    window.addEventListener('ecunga-admin-users-open-invite', onShellOpenInvite);
    return () => window.removeEventListener('ecunga-admin-users-open-invite', onShellOpenInvite);
  }, []);

  useEffect(() => {
    if (!location.state?.openInvite) return;
    setShowInviteForm(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  /** Platform-tenant admins and facility admins can both manage their rosters. */
  const companyAdminReadonlyRoster = false;
  const usersAtLimit =
    state.users.filter((u) => u.companyId === state.company?.id).length >= (state.company?.usersLimit || 100);
  const limitReached = user?.role === 'admin' ? false : usersAtLimit;

  const rows = state.users
    .filter((entry) => {
      const searchText = `${entry.fullName} ${entry.email}`.toLowerCase();
      const tokens = [search, shellUserSearch]
        .map((s) => String(s || '').trim().toLowerCase())
        .filter(Boolean);
      const matchesSearch = tokens.length === 0 || tokens.every((tok) => searchText.includes(tok));
      const matchesRole = roleFilter === 'all' || entry.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? entry.isActive : !entry.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt || b.invitedAt || 0) - new Date(a.createdAt || a.invitedAt || 0));
  const usersPager = usePagedList(rows, { resetKey: `${search}|${shellUserSearch}|${roleFilter}|${statusFilter}` });

  async function invite(inviteForm) {
    try {
      const data = await inviteWorkspaceUser(inviteForm, actor?.id);
      if (data?.inviteEmailSent && data?.inviteEmailKind === 'otp') {
        flash(t('app.admin.usersInviteSuccessOtp'), 'ok');
      } else if (data?.inviteEmailSent && data?.inviteEmailKind === 'temporary_password') {
        flash(t('app.admin.usersInviteSuccessTempPasswordEmail'), 'ok');
      } else if (data?.temporaryPassword) {
        flash(t('app.admin.usersInviteSuccessTempPasswordManual', { password: data.temporaryPassword }), 'ok');
      }
      setShowInviteForm(false);
    } catch (err) {
      flash(err?.message || 'Unable to invite user.', 'error');
    }
  }

  return (
    <div className={ui.adminUsersBoard}>
      <FlashBanner />
      <div className={ui.adminUsersTop}>
        <div>
          <h1 className={ui.adminUsersTitle}>{t('app.admin.usersTitle')}</h1>
          <p className={ui.adminUsersLead}>Add people and choose their role in your company.</p>
          {companyAdminReadonlyRoster ? (
            <p className={ui.adminUsersSectionMeta} role="status" style={{ marginTop: '0.65rem', maxWidth: '42rem' }}>
              {t('app.admin.usersSupervisorManagedNotice')}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={ui.adminUsersAddBtn}
          onClick={() => setShowInviteForm((current) => !current)}
          disabled={limitReached || companyAdminReadonlyRoster}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          Add New User
        </button>
      </div>

      <AdminUserInviteModal
        isOpen={showInviteForm && !companyAdminReadonlyRoster}
        onClose={() => setShowInviteForm(false)}
        onSave={invite}
        limitReached={limitReached}
        isPlatformTenant={state.company?.isPlatformTenant}
      />

      <AdminUserEditModal
        isOpen={Boolean(editingUser)}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSave={async (patch) => {
          try {
            await updateWorkspaceUser(editingUser.id, patch, actor?.id);
            setEditingUser(null);
            flash(t('app.supervisor.teamUserUpdated'), 'ok');
          } catch (err) {
            flash(err?.message || 'Unable to update user.', 'error');
          }
        }}
        isPlatformTenant={state.company?.isPlatformTenant}
      />

      <ConfirmModal
        isOpen={Boolean(changingRole)}
        title="Change Role"
        message={`Change role for ${changingRole?.user.fullName} to ${changingRole?.nextRole}?`}
        confirmText="Change Role"
        onConfirm={async () => {
          try {
            flash(t('app.supervisor.teamUserUpdateProcessing'), 'loading');
            await updateWorkspaceUser(changingRole.user.id, { role: changingRole.nextRole }, actor?.id);
            flash(t('app.supervisor.teamUserUpdated'), 'ok');
          } catch (err) {
            flash(err?.message || 'Unable to update role.', 'error');
            throw err;
          }
        }}
        onClose={() => setChangingRole(null)}
      />
      <AdminDeleteConfirmModal
        isOpen={Boolean(deletingUser)}
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={async () => {
          const removed = deletingUser;
          try {
            await deleteWorkspaceUser(removed.id, actor?.id);
            flash(t('app.supervisor.teamUserDeleted', { name: removed.fullName || removed.email || 'Member' }), 'ok');
          } catch (err) {
            flash(err?.message || 'Unable to delete user.', 'error');
            throw err;
          }
        }}
      />

      <section className={ui.adminUsersLedgerCard}>
        <div className={ui.adminUsersFilterRow}>
          <label className={ui.adminUsersSearchField}>
            <span className={ui.adminUsersFieldLabel}>Quick Search</span>
            <div className={ui.adminUsersSearchInputWrap}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm8 2-4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                className={ui.adminUsersSearchInput}
                placeholder="Filter by name or email address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>

          <label className={ui.adminUsersFilterField}>
            <span className={ui.adminUsersFieldLabel}>Filter by Role</span>
            <select className={ui.adminUsersSelect} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="accountant">Accountant</option>
              <option value="clerk">Clerk</option>
              <option value="supplier">Supplier</option>
            </select>
          </label>

          <label className={ui.adminUsersFilterField}>
            <span className={ui.adminUsersFieldLabel}>Status</span>
            <select className={ui.adminUsersSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className={ui.adminUsersTableWrap}>
          <div className={ui.adminUsersTableHead}>
            <span>Identity</span>
            <span>Role Assignment</span>
            <span>Current Status</span>
            <span>Registration Date</span>
            <span>Actions</span>
          </div>

        <div className={ui.adminUsersRows}>
          {rows.length ? (
            usersPager.pageSlice.map((entry, index) => (
              <article key={entry.id} className={ui.adminUsersRow}>
                <div className={ui.adminUsersIdentity}>

                  <div>
                    {entry.incrementalId != null ? (
                      <p className={ui.adminUsersRecordId} title="Record ID">
                        ID {entry.incrementalId}
                      </p>
                    ) : null}
                    <p className={ui.adminUsersName}>{entry.fullName}</p>
                    <p className={ui.adminUsersEmail}>{entry.email}</p>
                    {entry.permissions && entry.permissions.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                        {entry.permissions.map((p) => {
                          const label = p.split(':')[1] || p;
                          return (
                            <span 
                              key={p} 
                              style={{ 
                                fontSize: '0.65rem', 
                                fontWeight: '600', 
                                background: '#eff6ff', 
                                color: '#2563eb', 
                                border: '1px solid #dbeafe', 
                                padding: '1px 5px', 
                                borderRadius: '4px',
                                textTransform: 'capitalize'
                              }}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {state.company?.isPlatformTenant && entry.companyName && (
                      <p className={ui.adminUsersSectionMeta} style={{ marginTop: '0.15rem' }}>{entry.companyName}</p>
                    )}
                  </div>
                </div>
                <div>
                  <select
                    className={ui.adminUsersRoleSelect}
                    value={entry.role}
                    disabled={companyAdminReadonlyRoster || entry.role === 'admin' || rolePatchBusyId === entry.id}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setChangingRole({ user: entry, nextRole });
                    }}
                  >
                    <option value="clerk">Clerk</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="accountant">Accountant</option>
                    <option value="supplier">Supplier</option>
                    {entry.role === 'admin' && <option value="admin">Admin</option>}
                  </select>
                </div>
                <div>
                  <span className={entry.isActive ? ui.adminUsersStatusActive : ui.adminUsersStatusInactive}>
                    {entry.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className={ui.adminUsersDate}>
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </div>
                <div className={ui.adminUsersActions}>
                  {entry.role !== 'admin' ? (
                    companyAdminReadonlyRoster ? (
                      <span className={ui.adminUsersSectionMeta}>—</span>
                    ) : (
                      <div className={ui.adminUsersActionsWrap}>
                        <button
                          type="button"
                          className={ui.adminUsersActionBtn}
                          title="Edit User Info"
                          onClick={() => setEditingUser(entry)}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button
                          type="button"
                          className={ui.adminUsersActionBtn}
                          title={entry.isActive ? 'Disable User' : 'Enable User'}
                          disabled={workspaceBusyId === entry.id}
                          aria-busy={workspaceBusyId === entry.id}
                          onClick={async () => {
                            if (workspaceBusyId) return;
                            setWorkspaceBusyId(entry.id);
                            try {
                              await toggleWorkspaceUserActive(entry.id, actor?.id);
                              flash(t('app.supervisor.teamAccessUpdated'), 'ok');
                            } catch (e) {
                              flash(e?.message || 'Failed to toggle user', 'error');
                            } finally {
                              setWorkspaceBusyId(null);
                            }
                          }}
                          style={{ color: entry.isActive ? '#eab308' : '#22c55e' }}
                        >
                          {workspaceBusyId === entry.id ? (
                            <span className={`${ui.adminBtnSpinner} ${ui.adminBtnSpinnerDark}`} aria-hidden />
                          ) : entry.isActive ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                          )}
                        </button>
                        <button
                          type="button"
                          className={ui.adminUsersActionBtn}
                          title="Delete User"
                          onClick={() => setDeletingUser(entry)}
                          style={{ color: '#ef4444' }}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    )
                  ) : (
                    <span className={ui.adminUsersOwner}>Owner</span>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className={ui.empty}>No users match this filter.</p>
          )}
        </div>
        </div>

        <div className={ui.adminUsersFooter}>
          <span className={ui.adminUsersFooterMeta}>
            {rows.length ? `${usersPager.rangeFrom}–${usersPager.rangeTo} of ${rows.length}` : '0'} of {state.users.length} entries
          </span>
          <ListPageControls
            variant="table"
            rangeFrom={usersPager.rangeFrom}
            rangeTo={usersPager.rangeTo}
            total={usersPager.total}
            page={usersPager.page}
            pageCount={usersPager.pageCount}
            pagerNums={usersPager.pagerNums}
            onPrev={usersPager.goPrev}
            onNext={usersPager.goNext}
            onSelectPage={usersPager.setPage}
            canPrev={usersPager.canPrev}
            canNext={usersPager.canNext}
          />
        </div>
      </section>

      <div className={ui.adminUsersBottom}>
        <section className={ui.adminUsersAuditCard}>
          <p className={ui.adminUsersAuditEyebrow}>{t('cungaAi.securityInsightEyebrow')}</p>
          <h2 className={ui.adminUsersAuditTitle}>Workspace Security Audit</h2>
          <p className={ui.adminUsersAuditText}>Perform a comprehensive audit of all user permissions and access levels to ensure compliance with company policies.</p>
          <button type="button" className={ui.adminUsersAuditBtn} onClick={() => flash('Audit workflow started. Scanning workspace permissions...', 'ok')}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: '8px' }}>
              <path d="M12 3l8 4v5c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V7l8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9.5 12.5 11 14l3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Start Audit Workflow
          </button>
        </section>

        <section className={ui.adminUsersRoleCard}>
          <span className={ui.adminUsersRoleIcon}>
            <AdminIcon kind="settings" />
          </span>
          <h2 className={ui.adminUsersRoleTitle}>Role Customization</h2>
          <p className={ui.adminUsersRoleText}>Need a specialized role for a temporary auditor? Create custom permission sets.</p>
          <button type="button" className={ui.adminUsersRoleBtn} onClick={() => navigate('/app/admin/rbac')}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Manage Roles
          </button>
        </section>
      </div>
    </div>
  );
}

function formatRelativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function notifyBucket(severity) {
  if (severity === 'bad') return 'critical';
  if (severity === 'warn') return 'warnings';
  return 'information';
}

const NOTIFY_UI = {
  ntf_admin_001: { icon: 'security', primary: 'Secure Account', secondary: 'Dismiss' },
  ntf_admin_002: { icon: 'clipboard', links: ['Create Purchase Order', 'View History'] },
  ntf_admin_003: { icon: 'truck', links: ['Track Package'] },
  ntf_admin_004: { icon: 'cloud' },
};

function NotifyGlyph({ kind }) {
  const c = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'security') {
    return (
      <svg {...c}>
        <path d="M12 3l8 4v5c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V7l8-4Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M9.5 12.5 11 14l3.5-3.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'clipboard') {
    return (
      <svg {...c}>
        <path d="M9 4h6l1 2h3v14H5V6h3l1-2Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'truck') {
    return (
      <svg {...c}>
        <path d="M3 7h11v10H3V7Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M14 11h3l3 3v3h-3M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...c}>
      <path d="M7 16a4 4 0 0 0 4 4h5v-4M7 8a4 4 0 0 1 4-4h2v8M7 16l-3-3m3 3 3-3" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminActivity() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state } = usePortalData();
  const { user } = useAuth();
  const actor = useAdminActor(state, user);
  const [filter, setFilter] = useState('all');
  const [removedIds, setRemovedIds] = useState(() => new Set());
  const [readIds, setReadIds] = useState(() => new Set());

  const source = useMemo(() => {
    const list = notificationsForRole(state, 'admin', user?.id);
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [state]);

  const activeFeed = useMemo(() => source.filter((n) => !removedIds.has(n.id)), [source, removedIds]);

  const counts = useMemo(() => {
    const c = { all: activeFeed.length, critical: 0, warnings: 0, information: 0 };
    for (const n of activeFeed) {
      const b = notifyBucket(n.severity);
      if (b === 'critical') c.critical += 1;
      else if (b === 'warnings') c.warnings += 1;
      else c.information += 1;
    }
    return c;
  }, [activeFeed]);

  const filteredFeed = useMemo(() => {
    if (filter === 'all') return activeFeed;
    return activeFeed.filter((n) => notifyBucket(n.severity) === filter);
  }, [activeFeed, filter]);
  const notifyPager = usePagedList(filteredFeed, { resetKey: `${filter}|${activeFeed.length}` });

  const initials = (actor?.fullName || user?.email || 'A')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function markAllRead() {
    setReadIds(new Set(activeFeed.map((n) => n.id)));
  }

  function clearAll() {
    setRemovedIds(new Set(source.map((n) => n.id)));
    setReadIds(new Set());
  }

  function dismissOne(id) {
    setRemovedIds((prev) => new Set([...prev, id]));
  }

  const filterItems = [
    { key: 'all', label: 'All Alerts', countKey: 'all' },
    { key: 'critical', label: 'Critical', countKey: 'critical', dot: 'critical' },
    { key: 'warnings', label: 'Warnings', countKey: 'warnings', dot: 'warn' },
    { key: 'information', label: 'Information', countKey: 'information', dot: 'info' },
  ];

  return (
    <div className={ui.adminNotifyBoard}>
      <header className={ui.adminNotifyTop}>
        <h1 className={ui.adminNotifyTitle}>{t('app.admin.notifyTitle')}</h1>
        <div className={ui.adminNotifyActions}>
          <button type="button" className={ui.adminNotifyTextBtn} onClick={markAllRead}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12.5 8 16.5 20 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 12.5 12.5 16.5 20 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Mark All as Read
          </button>
          <button type="button" className={ui.adminNotifyTextBtn} onClick={clearAll}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M10 7V5h4v2M8 7l1 14h6l1-14" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
            </svg>
            Clear All
          </button>
          <button type="button" className={ui.adminNotifyIconBtn} aria-label="Notification preferences">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className={ui.adminNotifyIconBtn} aria-label="Settings">
            <AdminIcon kind="settings" />
          </button>
          <span className={ui.adminNotifyAvatar} aria-hidden="true">
            {initials}
          </span>
        </div>
      </header>

      <div className={ui.adminNotifyFiltersBar}>
        <p className={ui.adminNotifyEyebrow}>Quick filters</p>
        <ul className={ui.adminNotifyFilters}>
          {filterItems.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={item.key === filter ? ui.adminNotifyFilterActive : ui.adminNotifyFilter}
                onClick={() => setFilter(item.key)}
              >
                {item.dot ? <span className={ui[`adminNotifyDot_${item.dot}`]} aria-hidden="true" /> : null}
                <span className={ui.adminNotifyFilterLabel}>{item.label}</span>
                <span className={item.key === filter ? ui.adminNotifyFilterCountOn : ui.adminNotifyFilterCount}>{counts[item.countKey]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={ui.adminNotifyGrid}>
        <aside className={ui.adminNotifyAside}>
          <section className={ui.adminNotifyInsight}>
            <span className={ui.adminNotifyInsightIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width={22} height={22} fill="none">
                <path d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2m14 0h2M17 6l1.4-1.4M19 12l-1.5 1.5M12 19v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8.5 14.5 12 18l6.5-8.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className={ui.adminNotifyInsightTitle}>{t('cungaAi.notifySectionTitle')}</h2>
            <div className={ui.adminNotifyInsightText}>
              <WorkspaceAiInsight
                scope="admin"
                showRefresh
                fallbackText="Monitor low-stock items, open requisitions, and invoice pipeline from the reports and activity views."
              />
            </div>
            <button type="button" className={ui.adminNotifyInsightBtn} onClick={() => navigate('/app/admin/reports')}>
              Open reports
            </button>
          </section>
        </aside>

        <div className={ui.adminNotifyFeed}>
          {filteredFeed.length === 0 ? (
            <p className={ui.adminNotifyEmpty}>No alerts match this filter.</p>
          ) : (
            <ul className={ui.adminNotifyFeedList}>
              {notifyPager.pageSlice.map((n) => {
                const bucket = notifyBucket(n.severity);
                const uiMeta = NOTIFY_UI[n.id] || { icon: 'cloud' };
                const unread = !readIds.has(n.id);
                return (
                  <li
                    key={n.id}
                    className={`${ui.adminNotifyCard} ${ui[`adminNotifyCard_${bucket}`]} ${unread ? ui.adminNotifyCardUnread : ''}`}
                  >
                    <div className={ui.adminNotifyCardInner}>
                      <div className={`${ui.adminNotifyGlyph} ${ui[`adminNotifyGlyph_${bucket}`]}`}>
                        <NotifyGlyph kind={uiMeta.icon} />
                      </div>
                      <div className={ui.adminNotifyCardBody}>
                        <div className={ui.adminNotifyCardTop}>
                          <span className={ui[`adminNotifyBadge_${bucket}`]}>
                            {bucket === 'critical' ? 'Critical' : bucket === 'warnings' ? 'Warning' : 'Info'}
                          </span>
                          <time className={ui.adminNotifyTime} dateTime={n.createdAt}>
                            {formatRelativeTime(n.createdAt)}
                          </time>
                        </div>
                        <h3 className={ui.adminNotifyCardTitle}>{n.title}</h3>
                        <p className={ui.adminNotifyCardMeta}>{n.body}</p>
                        <div className={ui.adminNotifyCardFoot}>
                          {uiMeta.primary ? (
                            <button type="button" className={ui.adminNotifyPrimaryBtn} onClick={() => navigate('/app/admin/reports')}>
                              {uiMeta.primary}
                            </button>
                          ) : null}
                          {uiMeta.secondary ? (
                            <button type="button" className={ui.adminNotifyGhostBtn} onClick={() => dismissOne(n.id)}>
                              {uiMeta.secondary}
                            </button>
                          ) : null}
                          {uiMeta.links?.map((label) => (
                            <button key={label} type="button" className={ui.adminNotifyLinkBtn}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {filteredFeed.length > 0 ? (
            <ListPageControls
              variant="feed"
              rangeFrom={notifyPager.rangeFrom}
              rangeTo={notifyPager.rangeTo}
              total={notifyPager.total}
              page={notifyPager.page}
              pageCount={notifyPager.pageCount}
              pagerNums={notifyPager.pagerNums}
              onPrev={notifyPager.goPrev}
              onNext={notifyPager.goNext}
              onSelectPage={notifyPager.setPage}
              canPrev={notifyPager.canPrev}
              canNext={notifyPager.canNext}
            />
          ) : null}
        </div>
      </div>

      <button type="button" className={ui.adminNotifyFab} aria-label="Open notifications">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export function AdminRbac() {
  const { t } = useI18n();
  const { state } = usePortalData();

  return (
    <>
      <PageIntro
        eyebrow={t('app.admin.rbacEyebrow')}
        title={t('app.admin.rbacTitle')}
        description={t('app.admin.rbacDesc')}
      />
      <div className={ui.adminRbacGrid}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>{t('app.admin.rbacMatrix')}</h2>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Clerk</th>
                  <th>Supervisor</th>
                  <th>Accountant</th>
                  <th>Supplier</th>
                  <th>Admin</th>
                </tr>
              </thead>
              <tbody>
                {RBAC_MATRIX.map((row) => (
                  <tr key={row.area}>
                    <td>{row.area}</td>
                    <td>{row.clerk}</td>
                    <td>{row.supervisor}</td>
                    <td>{row.accountant}</td>
                    <td>{row.supplier}</td>
                    <td>{row.admin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>{t('app.admin.rbacOpen')}</h2>
          <RbacOpenWorkflowsList requisitions={state.requisitions} />
        </div>
      </div>
    </>
  );
}

const SETTINGS_LANGUAGE_CODES = new Set(['EN', 'EN-GB', 'RW']);
const SETTINGS_CURRENCY_CODES = new Set(['RWF', 'USD', 'EUR', 'GBP', 'KES', 'UGX']);

export function AdminSettings() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { flash, FlashBanner } = useFlash();
  const { state, patchCompanySettings } = usePortalData();
  const { user } = useAuth();
  const actor = useAdminActor(state, user);
  const [form, setForm] = useState({
    name: state.company.name || '',
    type: state.company.type || '',
    language: state.company.language,
    currency: state.company.currency,
    legalName: state.company.legalName || '',
    taxId: state.company.taxId || '',
    address: state.company.address || '',
    lowStockThreshold: state.company.lowStockThreshold || 15,
    anomalyDetection: state.company.anomalyDetection ?? true,
    auditRetention: state.company.auditRetention || '1 Year',
    sessionTimeout: state.company.sessionTimeout || '30 Minutes',
    logoUrl: state.company.logoUrl || '',
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const lang = String(state.company.language || 'EN').trim();
    const normalizedLang = SETTINGS_LANGUAGE_CODES.has(lang) ? lang : 'EN';
    const cur = String(state.company.currency || 'RWF').trim().toUpperCase();
    const normalizedCurrency = SETTINGS_CURRENCY_CODES.has(cur) ? cur : 'RWF';
    setForm({
      name: state.company.name || '',
      type: state.company.type || '',
      language: normalizedLang,
      currency: normalizedCurrency,
      legalName: state.company.legalName || '',
      taxId: state.company.taxId || '',
      address: state.company.address || '',
      lowStockThreshold: state.company.lowStockThreshold || 15,
      anomalyDetection: state.company.anomalyDetection ?? true,
      auditRetention: state.company.auditRetention || '1 Year',
      sessionTimeout: state.company.sessionTimeout || '30 Minutes',
      logoUrl: state.company.logoUrl || '',
    });
  }, [state.company]);

  async function handleLogoUpload(file) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const resp = await apiUploadMedia(file);
      setForm((f) => ({ ...f, logoUrl: resp.secure_url }));
    } catch (e) {
      flash('Logo upload failed: ' + e.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const displayName = String(form.legalName || form.name || '').trim();
      await patchCompanySettings({
        ...form,
        name: displayName || String(state.company.name || '').trim(),
        legalName: displayName,
        language: form.language,
        currency: form.currency,
        usersLimit: Number(state.company.usersLimit) || 10,
        industry: String(state.company.industry || ''),
      });
      flash('Settings saved successfully.', 'ok');
    } catch (err) {
      flash(err?.message || 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    const lang = String(state.company.language || 'EN').trim();
    const normalizedLang = SETTINGS_LANGUAGE_CODES.has(lang) ? lang : 'EN';
    const cur = String(state.company.currency || 'RWF').trim().toUpperCase();
    const normalizedCurrency = SETTINGS_CURRENCY_CODES.has(cur) ? cur : 'RWF';
    setForm({
      name: state.company.name || '',
      type: state.company.type || '',
      language: normalizedLang,
      currency: normalizedCurrency,
      legalName: state.company.legalName || '',
      taxId: state.company.taxId || '',
      address: state.company.address || '',
      lowStockThreshold: state.company.lowStockThreshold || 15,
      anomalyDetection: state.company.anomalyDetection ?? true,
      auditRetention: state.company.auditRetention || '1 Year',
      sessionTimeout: state.company.sessionTimeout || '30 Minutes',
      logoUrl: state.company.logoUrl || '',
    });
  }

  return (
    <form onSubmit={save} className={ui.adminSettingsBoard}>
      <FlashBanner />
      <div className={ui.adminSettingsTop}>
        <div>
          <h1 className={ui.adminSettingsTitle}>{t('app.admin.settingsTitle')}</h1>
          <p className={ui.adminSettingsLead}>Manage your organizational identity and system-wide configurations.</p>
        </div>
        <div className={ui.adminSettingsActions}>
          <button
            type="button"
            className={ui.adminSettingsGhostBtn}
            onClick={() => navigate(user?.role === 'supervisor' ? '/app/supervisor/profile' : '/app/admin/profile')}
          >
            {t('shell.myProfile')}
          </button>
          <Link
            to={
              user?.role === 'supervisor'
                ? '/app/supervisor/preferences'
                : `/app/${user?.role || 'admin'}/account-settings`
            }
            className={ui.adminSettingsGhostBtn}
            style={{ textDecoration: 'none' }}
          >
            {t('shell.accountSettings')}
          </Link>
          <button type="button" className={ui.adminSettingsGhostBtn} onClick={discard} disabled={saving}>
            Discard
          </button>
          <button type="submit" className={ui.adminSettingsPrimaryBtn} disabled={saving}>
            {saving ? t('accountPages.saving') : t('accountPages.saveChanges')}
          </button>
        </div>
      </div>

      <div className={ui.adminSettingsGrid}>
        <div className={ui.adminSettingsMain}>
          <div className={ui.adminSettingsCards2Col}>
          <section className={ui.adminSettingsCard}>
            <div className={ui.adminSettingsSectionHead}>
              <h2 className={ui.adminSettingsSectionTitle}>Company Information</h2>
            </div>

            <div className={ui.adminSettingsLogoBlock}>
              <div className={ui.adminSettingsLogoTile}>
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Company Logo" className={ui.adminSettingsLogoImg} />
                ) : (
                  (form.name || form.legalName || 'EC').charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className={ui.adminSettingsUploadTitle}>
                  {uploadingLogo ? 'Uploading…' : 'Upload new logo'}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e.target.files[0])}
                  disabled={uploadingLogo}
                  style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}
                />
                <p className={ui.adminSettingsUploadMeta}>Recommended: 400x400, PNG or JPG.</p>
              </div>
            </div>

            <div className={ui.adminSettingsFormGrid}>
              <label className={ui.adminSettingsField}>
                <span>Legal entity name</span>
                <input
                  className={ui.adminSettingsInput}
                  value={form.legalName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, legalName: v, name: v });
                  }}
                />
              </label>
              <label className={ui.adminSettingsField}>
                <span>Tax identification number</span>
                <input className={ui.adminSettingsInput} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
              </label>
              <label className={`${ui.adminSettingsField} ${ui.adminSettingsFieldWide}`}>
                <span>HQ address</span>
                <textarea className={ui.adminSettingsTextarea} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} />
              </label>
            </div>
          </section>

          <section className={ui.adminSettingsCard}>
            <div className={ui.adminSettingsSectionHead}>
              <h2 className={ui.adminSettingsSectionTitle}>System Preferences</h2>
            </div>

            <div className={ui.adminSettingsPreferenceGrid}>
              <label className={ui.adminSettingsField}>
                <span>Primary language</span>
                <select className={ui.adminSettingsSelect} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="EN">English</option>
                  <option value="EN-GB">English (United Kingdom)</option>
                  <option value="RW">Kinyarwanda</option>
                </select>
                <small>Used for automated reports and notifications.</small>
              </label>

              <label className={ui.adminSettingsField}>
                <span>Reporting currency</span>
                <select className={ui.adminSettingsSelect} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="RWF">RWF — Rwandan Franc</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="KES">KES — Kenyan Shilling</option>
                  <option value="UGX">UGX — Ugandan Shilling</option>
                </select>
                <small>Shown on invoices, dashboards, and finance views.</small>
              </label>

              <label className={ui.adminSettingsField}>
                <span>Institution type</span>
                <input className={ui.adminSettingsInput} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
                <small>Displayed across executive and audit exports.</small>
              </label>
            </div>

            <div className={ui.adminSettingsThresholdRow}>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>Low Stock Alert Threshold</p>
                <p className={ui.adminSettingsThresholdMeta}>Trigger warning when inventory drops below this percentage.</p>
              </div>
              <label className={ui.adminSettingsPercentField}>
                <input
                  className={ui.adminSettingsPercentInput}
                  type="number"
                  min="1"
                  max="100"
                  value={form.lowStockThreshold}
                  onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value || 0) })}
                />
                <span>%</span>
              </label>
            </div>

            <div className={ui.adminSettingsToggleRow}>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>Anomaly Detection</p>
                <p className={ui.adminSettingsThresholdMeta}>Enable AI-driven pattern recognition for inventory discrepancies.</p>
              </div>
              <button
                type="button"
                className={form.anomalyDetection ? ui.adminSettingsToggleActive : ui.adminSettingsToggle}
                onClick={() => setForm({ ...form, anomalyDetection: !form.anomalyDetection })}
                aria-pressed={form.anomalyDetection}
              >
                <span />
              </button>
            </div>
          </section>
          </div>

          <section className={ui.adminSettingsCard}>
            <div className={ui.adminSettingsSectionHead}>
              <h2 className={ui.adminSettingsSectionTitle}>Security & Compliance</h2>
            </div>

            <div className={ui.adminSettingsSecurityHero}>
              <div>
                <p className={ui.adminSettingsSecurityTitle}>Two-Factor Authentication (2FA)</p>
                <p className={ui.adminSettingsSecurityMeta}>Add an extra layer of security to all administrative accounts.</p>
              </div>
              <span className={ui.adminSettingsSecurityBadge}>Enabled</span>
            </div>

            <button type="button" className={ui.adminSettingsEnforceBtn} onClick={() => flash('Security policy updated. All users will be required to configure 2FA on their next login.', 'ok')}>Enforce for all users</button>

            <div className={ui.adminSettingsPreferenceGrid}>
              <label className={ui.adminSettingsField}>
                <span>Audit log retention</span>
                <select className={ui.adminSettingsSelect} value={form.auditRetention} onChange={(e) => setForm({ ...form, auditRetention: e.target.value })}>
                  <option>1 Year</option>
                  <option>2 Years</option>
                  <option>5 Years</option>
                </select>
              </label>

              <label className={ui.adminSettingsField}>
                <span>Session timeout</span>
                <select className={ui.adminSettingsSelect} value={form.sessionTimeout} onChange={(e) => setForm({ ...form, sessionTimeout: e.target.value })}>
                  <option>30 Minutes</option>
                  <option>45 Minutes</option>
                  <option>60 Minutes</option>
                </select>
              </label>
            </div>
          </section>
        </div>

        <aside className={ui.adminSettingsRail}>
          <section className={ui.adminSettingsHealthCard}>
            <p className={ui.adminSettingsHealthLabel}>System Health</p>
            <strong className={ui.adminSettingsHealthValue}>99.9%</strong>
            <p className={ui.adminSettingsHealthMeta}>All systems are operational. Last configuration backup completed 22 minutes ago.</p>
            <span className={ui.adminSettingsHealthSync}>Real-time sync</span>
          </section>

          <section className={ui.adminSettingsSuggestionCard}>
            <p className={ui.adminSettingsSuggestionLabel}>
              {t('cungaAi.brand')} <span>{t('cungaAi.suggestionSuffix')}</span>
            </p>
            <div className={ui.adminSettingsSuggestionBlock}>
              <p className={ui.adminSettingsSuggestionTitle}>Threshold Optimization</p>
              <p className={ui.adminSettingsSuggestionText}>Based on last month&apos;s velocity, increasing your stock threshold to 18% would prevent 3 expected stockouts.</p>
              <button type="button" className={ui.adminSettingsSuggestionBtn} onClick={() => setForm((f) => ({ ...f, lowStockThreshold: 18 }))}>Apply Suggestion</button>
            </div>
            <div className={ui.adminSettingsSuggestionBlock}>
              <p className={ui.adminSettingsSuggestionTitle}>Security Audit</p>
              <p className={ui.adminSettingsSuggestionText}>3 admin accounts haven&apos;t rotated their passwords in over 90 days. We recommend triggering a mandatory reset.</p>
            </div>
          </section>

          <button
            type="button"
            className={ui.adminSettingsProfileCard}
            onClick={() => navigate('/app/admin/profile')}
            aria-label={t('shell.myProfile')}
          >
            <span className={ui.adminSettingsProfileAvatar}>{actor?.fullName?.split(/\s+/).map((part) => part[0] || '').slice(0, 2).join('').toUpperCase() || 'AU'}</span>
            <div>
              <p className={ui.adminSettingsProfileName}>{actor?.fullName || 'Admin User'}</p>
              <p className={ui.adminSettingsProfileMeta}>{actor?.team || 'Global Controller'}</p>
            </div>
            <span className={ui.adminSettingsProfileArrow}>›</span>
          </button>
        </aside>
      </div>
    </form>
  );
}

export function AdminReports() {
  const { t } = useI18n();
  const { flash, FlashBanner } = useFlash();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const [adminRegion, setAdminRegion] = useState('all');
  const [adminAuditStatus, setAdminAuditStatus] = useState('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminDatePreset, setAdminDatePreset] = useState('all');
  const [adminCustomStart, setAdminCustomStart] = useState('');
  const [adminCustomEnd, setAdminCustomEnd] = useState('');
  const [adminReqStatus, setAdminReqStatus] = useState('all');
  const [adminCategory, setAdminCategory] = useState('all');
  const [showUserActivity, setShowUserActivity] = useState(false);
  const [showSystemMetrics, setShowSystemMetrics] = useState(false);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [userActivitySearch, setUserActivitySearch] = useState('');
  const velocityGradId = useId().replace(/:/g, '');
  const velocitySvgRef = useRef(null);
  const [hoveredVelocityIdx, setHoveredVelocityIdx] = useState(null);

  const bounds = useMemo(() => {
    if (adminDatePreset === 'custom') {
      if (!adminCustomStart || !adminCustomEnd) return null;
      const start = new Date(adminCustomStart).getTime();
      const end = new Date(adminCustomEnd).getTime() + 86399999;
      return Number.isFinite(start) && Number.isFinite(end) && start <= end ? { start, end } : null;
    }
    const b = getAdminDateBounds(adminDatePreset);
    if (b) return b;
    // For 'all', find the earliest possible start
    const allItems = [...state.activity, ...state.consumptions, ...state.stockItems];
    const first = allItems.reduce((acc, c) => {
      const t = new Date(c.createdAt || c.updatedAt || Date.now()).getTime();
      return (t > 0 && t < acc) ? t : acc;
    }, Date.now());
    return {
      start: first < Date.now() ? first : Date.now() - 30 * 86400000,
      end: Date.now(),
    };
  }, [adminDatePreset, adminCustomStart, adminCustomEnd, state.activity, state.consumptions, state.stockItems]);

  const adminCategories = useMemo(
    () => [...new Set(state.stockItems.map((s) => s.category).filter(Boolean))].sort(),
    [state.stockItems]
  );

  const reqsScoped = useMemo(() => {
    return state.requisitions.filter((r) => {
      if (adminRegion !== 'all' && r.location !== adminRegion) return false;
      if (!isoInBounds(r.requestedAt, bounds)) return false;
      if (!matchesReqWorkflowStatus(r, adminReqStatus)) return false;
      return true;
    });
  }, [state.requisitions, adminRegion, bounds, adminReqStatus]);

  const stockFiltered = useMemo(() => {
    return state.stockItems.filter((s) => {
      if (adminCategory !== 'all' && s.category !== adminCategory) return false;
      if (adminRegion !== 'all' && s.location !== adminRegion) return false;
      return true;
    });
  }, [state.stockItems, adminCategory, adminRegion]);

  const consumptionsScoped = useMemo(() => {
    const byId = Object.fromEntries(state.stockItems.map((s) => [s.id, s]));
    return state.consumptions.filter((c) => {
      if (!isoInBounds(c.createdAt, bounds)) return false;
      const item = byId[c.itemId];
      if (adminCategory !== 'all' && item?.category !== adminCategory) return false;
      if (adminRegion !== 'all' && item?.location !== adminRegion) return false;
      return true;
    });
  }, [state.consumptions, state.stockItems, bounds, adminCategory, adminRegion]);

  const reqIdsScoped = useMemo(() => new Set(reqsScoped.map((r) => r.id)), [reqsScoped]);
  const invoicesScoped = useMemo(() => {
    return state.invoices.filter((inv) => reqIdsScoped.has(inv.requisitionId) && isoInBounds(inv.createdAt, bounds));
  }, [state.invoices, reqIdsScoped, bounds]);

  const totalConsumption = useMemo(
    () => consumptionsScoped.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
    [consumptionsScoped]
  );
  const turnover = Number((totalConsumption / Math.max(1, stockFiltered.length)).toFixed(1));
  const stockAccuracy = Math.min(
    99.9,
    Number(
      (
        ((stockFiltered.filter((entry) => Number(entry.quantity || 0) > 0).length +
          invoicesScoped.filter((entry) => entry.status !== 'rejected').length) /
          Math.max(1, stockFiltered.length + invoicesScoped.length)) *
        100
      ).toFixed(1)
    )
  );

  // User activity data
  const userActivityData = useMemo(() => {
    const activityMap = new Map();
    state.activity.forEach((act) => {
      if (!isoInBounds(act.createdAt, bounds)) return;
      const userId = act.userId || act.actorId;
      if (!userId) return;
      if (!activityMap.has(userId)) {
        const user = state.users.find((u) => u.id === userId);
        activityMap.set(userId, {
          userId,
          userName: user?.fullName || user?.email || 'Unknown',
          role: user?.role || 'unknown',
          actionCount: 0,
          lastActivity: act.createdAt,
        });
      }
      const data = activityMap.get(userId);
      data.actionCount += 1;
      if (new Date(act.createdAt) > new Date(data.lastActivity)) {
        data.lastActivity = act.createdAt;
      }
    });
    return [...activityMap.values()].sort((a, b) => b.actionCount - a.actionCount);
  }, [state.activity, state.users, bounds]);

  const filteredUserActivity = useMemo(() => {
    let filtered = userActivityData;
    if (selectedRoleFilter !== 'all') {
      filtered = filtered.filter((u) => u.role === selectedRoleFilter);
    }
    const q = userActivitySearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((u) => `${u.userName} ${u.role}`.toLowerCase().includes(q));
    }
    return filtered;
  }, [userActivityData, selectedRoleFilter, userActivitySearch]);

  // System-wide metrics
  const systemMetrics = useMemo(() => {
    const usersByRole = {
      admin: state.users.filter((u) => u.role === 'admin').length,
      supervisor: state.users.filter((u) => u.role === 'supervisor').length,
      clerk: state.users.filter((u) => u.role === 'clerk').length,
      accountant: state.users.filter((u) => u.role === 'accountant').length,
      supplier: state.users.filter((u) => u.role === 'supplier').length,
    };

    // Calculate activity by role
    const activityByRole = {};
    Object.keys(usersByRole).forEach((role) => {
      activityByRole[role] = state.activity.filter((act) => {
        const user = state.users.find((u) => u.id === act.userId || u.id === act.actorId);
        return user?.role === role;
      }).length;
    });

    return {
      totalUsers: state.users.length,
      totalCompanies: state.companies?.length || 0,
      totalStockItems: state.stockItems.length,
      totalRequisitions: state.requisitions.length,
      totalConsumptions: state.consumptions.length,
      activeUsers: state.users.filter((u) => u.isActive !== false).length,
      usersByRole,
      activityByRole,
    };
  }, [state.users, state.companies, state.stockItems, state.requisitions, state.consumptions, state.activity]);

  function downloadUserActivity() {
    const aoa = [
      ['User ID', 'User Name', 'Role', 'Action Count', 'Last Activity'],
      ...filteredUserActivity.map((u) => [
        u.userId,
        u.userName,
        u.role,
        u.actionCount,
        formatDate(u.lastActivity),
      ]),
    ];
    downloadAoAAsXlsx(`user-activity-${new Date().toISOString().slice(0, 10)}`, aoa, 'User Activity');
  }

  function downloadSystemMetrics() {
    const aoa = [
      ['Metric', 'Value'],
      ['Total Users', systemMetrics.totalUsers],
      ['Total Companies', systemMetrics.totalCompanies],
      ['Total Stock Items', systemMetrics.totalStockItems],
      ['Total Requisitions', systemMetrics.totalRequisitions],
      ['Total Consumptions', systemMetrics.totalConsumptions],
      ['Active Users', systemMetrics.activeUsers],
      [''],
      ['Users by Role', ''],
      ['Admin', systemMetrics.usersByRole.admin],
      ['Supervisor', systemMetrics.usersByRole.supervisor],
      ['Clerk', systemMetrics.usersByRole.clerk],
      ['Accountant', systemMetrics.usersByRole.accountant],
      ['Supplier', systemMetrics.usersByRole.supplier],
    ];
    downloadAoAAsXlsx(`system-metrics-${new Date().toISOString().slice(0, 10)}`, aoa, 'System Metrics');
  }

  const fulfillmentRate = Math.min(
    99.9,
    Number(
      (
        (reqsScoped.filter((entry) => ['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status)).length / Math.max(1, reqsScoped.length)) *
        100
      ).toFixed(1)
    )
  );
  const regionSource = useMemo(() => {
    return ADMIN_REPORT_REGIONS.map((label) => ({
      label,
      value: reqsScoped.filter((entry) => entry.location === label).length,
    }));
  }, [reqsScoped]);
  const totalRegionValue = regionSource.reduce((sum, entry) => sum + Math.max(0, entry.value), 0) || 1;
  const regions = regionSource.map((entry) => ({
    ...entry,
    percent: Math.round(((entry.value || 0) / Math.max(1, totalRegionValue)) * 100),
  }));
  const topRegionRow = useMemo(() => [...regions].sort((a, b) => (b.value || 0) - (a.value || 0))[0], [regions]);
  const curatorShort =
    topRegionRow && topRegionRow.value > 0
      ? `${topRegionRow.label} · ${topRegionRow.percent}% share · ${topRegionRow.value} reqs`
      : 'Tune filters to see regional mix.';

  const { salesSeries, restockSeries, chartMax, monthLabels } = useMemo(() => {
    const points = 6;
    const start = bounds.start;
    const end = bounds.end;
    const span = Math.max(1, end - start);
    const step = Math.max(1, Math.floor(span / points));

    const bucketIndex = (ms) => {
      if (!Number.isFinite(ms)) return -1;
      if (ms < start || ms > end) return -1;
      const idx = Math.floor((ms - start) / step);
      return Math.max(0, Math.min(points - 1, idx));
    };

    const sales = new Array(points).fill(0);
    for (const c of consumptionsScoped) {
      const ms = new Date(c.createdAt || 0).getTime();
      const idx = bucketIndex(ms);
      if (idx < 0) continue;
      sales[idx] += Number(c.quantity || 0);
    }

    // Restock = stock received via fulfillment + initial registrations
    const stockById = Object.fromEntries((state.stockItems || []).map((s) => [s.id, s]));
    const restock = new Array(points).fill(0);
    for (const a of state.activity || []) {
      const ms = new Date(a.createdAt || 0).getTime();
      const idx = bucketIndex(ms);
      if (idx < 0) continue;
      const action = String(a.action || '');

      if (action === 'stock.fulfilled_from_requisition') {
        const lines = a?.meta?.lines;
        if (Array.isArray(lines)) {
          for (const ln of lines) {
            const itemId = ln?.itemId || ln?.stockId || ln?.id;
            const it = itemId ? stockById[itemId] : null;
            if (adminCategory !== 'all' && it?.category !== adminCategory) continue;
            if (adminRegion !== 'all' && it?.location !== adminRegion) continue;
            restock[idx] += Number(ln?.added ?? ln?.quantity ?? 0);
          }
        }
      } else if (action === 'stock.item.added') {
        const stockId = a?.meta?.stockId;
        const it = stockId ? stockById[stockId] : null;
        if (!it) continue;
        if (adminCategory !== 'all' && it?.category !== adminCategory) continue;
        if (adminRegion !== 'all' && it?.location !== adminRegion) continue;
        restock[idx] += Number(it.quantity || 0);
      } else if (action === 'stock.item.updated') {
        const stockId = a?.meta?.stockId;
        const it = stockId ? stockById[stockId] : null;
        if (!it) continue;
        if (adminCategory !== 'all' && it?.category !== adminCategory) continue;
        if (adminRegion !== 'all' && it?.location !== adminRegion) continue;
        const dq = Number(a?.meta?.deltaQuantity || 0);
        if (dq > 0) restock[idx] += dq;
      }
    }

    const salesSeries = sales.map((v) => Math.round(v));
    const restockSeries = restock.map((v) => Math.round(v));
    const chartMax = Math.max(...salesSeries, ...restockSeries, 1);
    
    // Dynamic Month Labels
    const monthLabels = [];
    for (let i = 0; i < points; i++) {
      const d = new Date(start + i * step);
      monthLabels.push(d.toLocaleString(undefined, { month: 'short' }));
    }

    return { salesSeries, restockSeries, chartMax, monthLabels };
  }, [bounds.start, bounds.end, consumptionsScoped, state.activity, state.stockItems, adminCategory, adminRegion]);

  // Proper viewBox geometry for the velocity chart
  const VEL_W = 500;
  const VEL_H = 220;
  const VEL_PAD_L = 48;
  const VEL_PAD_R = 12;
  const VEL_PAD_T = 18;
  const VEL_PAD_B = 32;
  const VEL_PLOT_W = VEL_W - VEL_PAD_L - VEL_PAD_R;
  const VEL_PLOT_H = VEL_H - VEL_PAD_T - VEL_PAD_B;

  const nV = salesSeries.length;
  const txV = salesSeries.map((_, i) =>
    nV <= 1 ? VEL_PAD_L + VEL_PLOT_W / 2 : VEL_PAD_L + (i / (nV - 1)) * VEL_PLOT_W
  );
  const syV = salesSeries.map((v) => VEL_PAD_T + VEL_PLOT_H - (v / chartMax) * VEL_PLOT_H);
  const ryV = restockSeries.map((v) => VEL_PAD_T + VEL_PLOT_H - (v / chartMax) * VEL_PLOT_H);
  const salesLineDV = txV.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${syV[i].toFixed(1)}`).join(' ');
  const salesAreaDV = nV > 0 ? `${salesLineDV} L ${txV[nV - 1].toFixed(1)} ${VEL_PAD_T + VEL_PLOT_H} L ${txV[0].toFixed(1)} ${VEL_PAD_T + VEL_PLOT_H} Z` : '';
  const restockLineDV = txV.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ryV[i].toFixed(1)}`).join(' ');
  const restockAreaDV = nV > 0 ? `${restockLineDV} L ${txV[nV - 1].toFixed(1)} ${VEL_PAD_T + VEL_PLOT_H} L ${txV[0].toFixed(1)} ${VEL_PAD_T + VEL_PLOT_H} Z` : '';

  // Y-axis ticks for velocity chart
  const velYTicks = useMemo(() => {
    const raw = chartMax;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const step = raw <= magnitude * 2 ? magnitude / 2 : raw <= magnitude * 5 ? magnitude : magnitude * 2;
    const niceMax = Math.ceil(raw / step) * step || step;
    const ticks = [];
    for (let v = 0; v <= niceMax + step / 2; v += step) ticks.push(v);
    return { ticks, niceMax: niceMax || step };
  }, [chartMax]);

  const salesPctEach = salesSeries.map((v) => Math.round((v / chartMax) * 100));
  const restockPctEach = restockSeries.map((v) => Math.round((v / chartMax) * 100));
  const velocityDelta =
    salesSeries.length >= 2 ? ((salesSeries.at(-1) - salesSeries[0]) / Math.max(1, salesSeries[0])) * 100 : 0;

  const auditLogsRaw = useMemo(() => {
    const act = state.activity || [];
    return act.map((entry) => {
      const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
      const action = String(entry.action || '');
      const createdAt = entry.createdAt;
      const id = String(entry.id || entry._id || meta.entityId || meta.stockId || meta.invoiceId || meta.requisitionId || '');
      const region = String(meta.location || meta.region || meta.facility || '').trim() || '—';

      let countText = '';
      if (action === 'stock.item.consumed') {
        countText = `${Number(meta.quantity || 0)} units`;
      } else if (action === 'stock.fulfilled_from_requisition') {
        const n = Array.isArray(meta.lines) ? meta.lines.reduce((s, ln) => s + Number(ln?.quantity || 0), 0) : 0;
        countText = `${n} units`;
      } else if (action === 'invoice.paid') {
        countText = meta.amount != null ? String(meta.amount) : '';
      }

      const statusTone =
        /rejected/i.test(action) ? 'bad' : /approved|paid|closed|fulfilled/i.test(action) ? 'good' : 'pending';
      const status = statusTone === 'good' ? 'Approved' : statusTone === 'bad' ? 'Discrepancy Detected' : 'Pending Review';
      const displayId = id ? id.toUpperCase() : `AUD-${String(entry.id || '').slice(-6) || '—'}`;

      return {
        id: displayId,
        region,
        count: countText || '—',
        status,
        statusTone,
        time: new Date(createdAt || Date.now()).toLocaleString(),
        rawAction: action || 'activity',
        activityCreatedAt: createdAt,
      };
    });
  }, [state.activity]);
  const auditLogs = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    return auditLogsRaw.filter((entry) => {
      if (!isoInBounds(entry.activityCreatedAt, bounds)) return false;
      if (adminAuditStatus !== 'all' && entry.statusTone !== adminAuditStatus) return false;
      if (q && !`${entry.id} ${entry.region} ${entry.count} ${entry.status} ${entry.rawAction}`.toLowerCase().includes(q)) return false;
      if (adminRegion === 'all') return true;
      const hub =
        adminRegion === 'Gasabo' ? 'Gasabo' : adminRegion === 'Kicukiro' ? 'Kicukiro' : adminRegion === 'HQ Kigali' ? 'HQ' : adminRegion;
      return entry.region.toLowerCase().includes(String(hub).toLowerCase());
    });
  }, [auditLogsRaw, adminAuditStatus, adminSearch, adminRegion, bounds]);
  const auditMixSlices = useMemo(() => {
    let good = 0;
    let pending = 0;
    let bad = 0;
    for (const e of auditLogs) {
      if (e.statusTone === 'good') good += 1;
      else if (e.statusTone === 'bad') bad += 1;
      else pending += 1;
    }
    const tot = good + pending + bad || 1;
    return [
      { name: 'Approved', value: good, pct: Math.round((good / tot) * 100), color: '#16a34a' },
      { name: 'Pending', value: pending, pct: Math.round((pending / tot) * 100), color: '#ca8a04' },
      { name: 'Discrepancy', value: bad, pct: Math.round((bad / tot) * 100), color: '#dc2626' },
    ];
  }, [auditLogs]);
  const regionDonutSlices = useMemo(
    () =>
      regions
        .filter((r) => (r.value || 0) > 0)
        .map((r, i) => ({
          name: r.label,
          value: r.value || 0,
          color: REPORT_SLICE_COLORS[i % REPORT_SLICE_COLORS.length],
        })),
    [regions]
  );
  const regionDonutTotal = regionDonutSlices.reduce((s, x) => s + x.value, 0) || 1;
  const auditLogsLatest = useMemo(
    () => [...auditLogs].sort((a, b) => new Date(b.activityCreatedAt || 0) - new Date(a.activityCreatedAt || 0)),
    [auditLogs]
  );
  const auditPager = usePagedList(auditLogsLatest, {
    resetKey: `${adminAuditStatus}|${adminSearch}|${adminRegion}|${bounds ? `${bounds.start}|${bounds.end}` : 'all'}`,
  });

  function exportExcel() {
    const companyName = state.company?.name || 'Company';
    const generatedDate = new Date().toLocaleDateString();
    const periodText = adminDatePreset === 'custom' && adminCustomStart && adminCustomEnd
      ? `${adminCustomStart} to ${adminCustomEnd}`
      : adminDatePreset;

    const reportRows = [
      ['Turnover Velocity', turnover],
      ['Stock Accuracy', `${stockAccuracy}%`],
      ['Fulfillment Rate', `${fulfillmentRate}%`],
      ['Total Requisitions', reqsScoped.length],
      ['Total Consumption', totalConsumption],
    ];

    const aoa = [
      ['e-Cunga Admin Compliance & Audit Report'],
      [''],
      ['Company', companyName],
      ['Generated Date', generatedDate],
      ['Report Period', periodText],
      [''],
      ['Summary Metrics'],
      ...reportRows,
      [''],
      ['System Metrics'],
      ['Total Users', systemMetrics.totalUsers],
      ['Active Users', systemMetrics.activeUsers],
      ['Total Stock Items', systemMetrics.totalStockItems],
      ['Total Requisitions', systemMetrics.totalRequisitions],
      ['Total Consumptions', systemMetrics.totalConsumptions],
      [''],
      ['Users by Role'],
      ['Role', 'Count', 'Activity Count'],
      ...Object.entries(systemMetrics.usersByRole).map(([role, count]) => [
        role,
        count,
        systemMetrics.activityByRole[role] || 0,
      ]),
      [''],
      ['Regional Distribution'],
      ['Region', 'Requisitions'],
      ...regionDonutSlices.map((entry) => [entry.name, entry.value]),
      [''],
      ['Recent Audit Logs'],
      ['Status', 'Time', 'Region', 'Action'],
      ...auditLogsLatest.slice(0, 15).map((entry) => [
        entry.statusTone.toUpperCase(),
        entry.time,
        entry.region,
        entry.rawAction,
      ]),
    ];
    downloadAoAAsXlsx(`admin-system-report-${new Date().toISOString().slice(0, 10)}`, aoa, 'Admin Compliance Report');
  }

  function exportPdf() {
    const companyName = state.company?.name || 'Company';
    const generatedDate = new Date().toLocaleDateString();
    const periodText = adminDatePreset === 'custom' && adminCustomStart && adminCustomEnd
      ? `${adminCustomStart} to ${adminCustomEnd}`
      : adminDatePreset;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('e-Cunga Admin Compliance & Audit Report', 14, 18);
    doc.setFontSize(11);
    doc.text(`Company: ${companyName}`, 14, 28);
    doc.text(`Generated: ${generatedDate}`, 14, 36);
    doc.text(`Report Period: ${periodText}`, 14, 44);
    doc.text(`Turnover Velocity: ${turnover}`, 14, 54);
    doc.text(`Stock Accuracy: ${stockAccuracy}%`, 14, 62);
    doc.text(`Fulfillment Rate: ${fulfillmentRate}%`, 14, 70);
    doc.text(`Total Requisitions: ${reqsScoped.length}`, 14, 78);
    doc.text(`Total Consumption: ${totalConsumption.toLocaleString()}`, 14, 86);
    doc.text(`Total Users: ${systemMetrics.totalUsers}`, 14, 94);
    doc.text(`Active Users: ${systemMetrics.activeUsers}`, 14, 102);

    doc.text('Users by Role', 14, 116);
    Object.entries(systemMetrics.usersByRole).forEach(([role, count], index) => {
      doc.text(`- ${role}: ${count} users (${systemMetrics.activityByRole[role] || 0} activities)`, 18, 126 + index * 8);
    });

    doc.text('Regional Distribution', 14, 158);
    regionDonutSlices.forEach((entry, index) => {
      doc.text(`- ${entry.name}: ${entry.value} reqs`, 18, 168 + index * 8);
    });

    doc.text('Recent Audit Logs', 14, 200);
    auditLogsLatest.slice(0, 15).forEach((entry, index) => {
      doc.text(`[${entry.statusTone.toUpperCase()}] ${entry.time} - ${entry.region} - ${entry.rawAction}`, 18, 210 + index * 8);
    });

    doc.save(`admin-compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className={ui.adminReportsBoard}>
      <FlashBanner />
      <div className={ui.adminReportsTop}>
        <div>
          <h1 className={ui.adminReportsTitle}>{t('app.admin.reportsTitle')}</h1>
          <div className={ui.analyticsKpiStrip} role="group" aria-label="Ledger summary">
            <span className={ui.analyticsKpiChip}>
              <strong>{turnover}</strong>
              <span className={ui.analyticsKpiChipLabel}>turnover</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{stockAccuracy}%</strong>
              <span className={ui.analyticsKpiChipLabel}>accuracy</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{fulfillmentRate}%</strong>
              <span className={ui.analyticsKpiChipLabel}>fulfill</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{reqsScoped.length}</strong>
              <span className={ui.analyticsKpiChipLabel}>reqs</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{totalConsumption.toLocaleString()}</strong>
              <span className={ui.analyticsKpiChipLabel}>consumed</span>
            </span>
          </div>
        </div>
        <div className={ui.adminReportsActions}>
          <button type="button" className={ui.adminReportsGhostBtn} onClick={() => { exportExcel(); flash('Exporting Excel report...', 'ok'); }}>Generate Excel</button>
          <button type="button" className={ui.adminReportsPrimaryBtn} onClick={() => { exportPdf(); flash('Generating PDF Audit Report...', 'ok'); }}>Generate Audit Report</button>
        </div>
      </div>

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Region focus</span>
          <select className={ui.portalFilterSelect} value={adminRegion} onChange={(e) => setAdminRegion(e.target.value)}>
            <option value="all">All regions</option>
            {ADMIN_REPORT_REGIONS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Date range</span>
          <select className={ui.portalFilterSelect} value={adminDatePreset} onChange={(e) => setAdminDatePreset(e.target.value)}>
            <option value="all">All time</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last 12 months</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {adminDatePreset === 'custom' && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem' }}>
              From
              <input type="date" value={adminCustomStart} onChange={(e) => setAdminCustomStart(e.target.value)} className={ui.portalFilterSelect} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem' }}>
              To
              <input type="date" value={adminCustomEnd} onChange={(e) => setAdminCustomEnd(e.target.value)} className={ui.portalFilterSelect} />
            </label>
            <span className={ui.portalFilterMeta}>
              {bounds ? 'Custom range applied' : 'Select a valid date range'}
            </span>
          </div>
        )}
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Req. status</span>
          <select className={ui.portalFilterSelect} value={adminReqStatus} onChange={(e) => setAdminReqStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="in_progress">In progress</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Stock category</span>
          <select className={ui.portalFilterSelect} value={adminCategory} onChange={(e) => setAdminCategory(e.target.value)}>
            <option value="all">All categories</option>
            {adminCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Audit status</span>
          <select className={ui.portalFilterSelect} value={adminAuditStatus} onChange={(e) => setAdminAuditStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="good">Approved</option>
            <option value="pending">Pending review</option>
            <option value="bad">Discrepancy</option>
          </select>
        </label>
        <label className={`${ui.portalFilterField} ${ui.portalFilterFieldSearch}`}>
          <span className={ui.portalFilterLabel}>Search audit log</span>
          <input
            type="search"
            className={ui.portalFilterSearch}
            placeholder="ID, region, action…"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
          />
        </label>
        <ClearFiltersIconButton
          title={t('common.clearFiltersAria')}
          onClick={() => {
            setAdminRegion('all');
            setAdminAuditStatus('all');
            setAdminSearch('');
            setAdminDatePreset('all');
            setAdminCustomStart('');
            setAdminCustomEnd('');
            setAdminReqStatus('all');
            setAdminCategory('all');
            setSelectedRoleFilter('all');
          }}
        />
        <span className={ui.portalFilterMeta}>
          {stockFiltered.length} items · {reqsScoped.length} reqs · {auditLogs.length} audit entries
        </span>
      </div>

      {/* User Activity Report Section */}
      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>User Activity Report</h2>
          <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowUserActivity(!showUserActivity)}>
            {showUserActivity ? 'Hide' : 'Show'}
          </button>
        </div>
        {showUserActivity && (
          <div style={{ marginTop: '1rem' }}>
            <div className={ui.analyticsFilterToolbar}>
              <InventoryFilterSelect
                value={selectedRoleFilter}
                onChange={setSelectedRoleFilter}
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: 'admin', label: 'Admin' },
                  { value: 'supervisor', label: 'Supervisor' },
                  { value: 'clerk', label: 'Clerk' },
                  { value: 'accountant', label: 'Accountant' },
                  { value: 'supplier', label: 'Supplier' },
                ]}
              />
              <input
                className={ui.portalFilterSearch}
                placeholder="Search users..."
                value={userActivitySearch}
                onChange={(e) => setUserActivitySearch(e.target.value)}
              />
              <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadUserActivity}>
                Download User Activity
              </button>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>
              {filteredUserActivity.length} users with activity in selected range
            </p>
            <div style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: '0.375rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>User Name</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Role</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Action Count</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Last Activity</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid var(--ec-border)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUserActivity.map((u) => (
                    <tr key={u.userId} style={{ borderBottom: '1px solid var(--ec-border)' }}>
                      <td style={{ padding: '0.5rem' }}>{u.userName}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '0.25rem', 
                          backgroundColor: u.role === 'admin' ? 'rgb(99 102 241)' : u.role === 'supervisor' ? 'rgb(14 165 233)' : u.role === 'clerk' ? 'rgb(34 197 94)' : u.role === 'accountant' ? 'rgb(168 85 247)' : 'rgb(107 114 128)', 
                          color: 'white', 
                          fontSize: '0.7rem', 
                          fontWeight: 600,
                          textTransform: 'capitalize'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{u.actionCount}</td>
                      <td style={{ padding: '0.5rem' }}>{formatDate(u.lastActivity)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '0.25rem', 
                          backgroundColor: 'rgb(34 197 94)', 
                          color: 'white', 
                          fontSize: '0.7rem', 
                          fontWeight: 600 
                        }}>
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* System Metrics Section */}
      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>System-Wide Metrics</h2>
          <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowSystemMetrics(!showSystemMetrics)}>
            {showSystemMetrics ? 'Hide' : 'Show'}
          </button>
        </div>
        {showSystemMetrics && (
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadSystemMetrics}>
              Download System Metrics
            </button>
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <article className={ui.analyticsMetricCard} style={{ border: '1px solid var(--ec-border)' }}>
                <p className={ui.analyticsMetricLabel}>Total Users</p>
                <strong className={ui.analyticsMetricValue} style={{ color: 'rgb(99 102 241)' }}>{systemMetrics.totalUsers}</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--ec-muted)' }}>{systemMetrics.activeUsers} active</span>
              </article>
              <article className={ui.analyticsMetricCard} style={{ border: '1px solid var(--ec-border)' }}>
                <p className={ui.analyticsMetricLabel}>Total Companies</p>
                <strong className={ui.analyticsMetricValue} style={{ color: 'rgb(14 165 233)' }}>{systemMetrics.totalCompanies}</strong>
              </article>
              <article className={ui.analyticsMetricCard} style={{ border: '1px solid var(--ec-border)' }}>
                <p className={ui.analyticsMetricLabel}>Total Stock Items</p>
                <strong className={ui.analyticsMetricValue} style={{ color: 'rgb(34 197 94)' }}>{systemMetrics.totalStockItems}</strong>
              </article>
              <article className={ui.analyticsMetricCard} style={{ border: '1px solid var(--ec-border)' }}>
                <p className={ui.analyticsMetricLabel}>Total Requisitions</p>
                <strong className={ui.analyticsMetricValue} style={{ color: 'rgb(168 85 247)' }}>{systemMetrics.totalRequisitions}</strong>
              </article>
              <article className={ui.analyticsMetricCard} style={{ border: '1px solid var(--ec-border)' }}>
                <p className={ui.analyticsMetricLabel}>Total Consumptions</p>
                <strong className={ui.analyticsMetricValue} style={{ color: 'rgb(234 179 8)' }}>{systemMetrics.totalConsumptions}</strong>
              </article>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Users by Role</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)', borderTop: '3px solid rgb(99 102 241)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Admin</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem', color: 'rgb(99 102 241)' }}>{systemMetrics.usersByRole.admin}</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)', borderTop: '3px solid rgb(14 165 233)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Supervisor</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem', color: 'rgb(14 165 233)' }}>{systemMetrics.usersByRole.supervisor}</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)', borderTop: '3px solid rgb(34 197 94)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Clerk</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem', color: 'rgb(34 197 94)' }}>{systemMetrics.usersByRole.clerk}</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)', borderTop: '3px solid rgb(168 85 247)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Accountant</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem', color: 'rgb(168 85 247)' }}>{systemMetrics.usersByRole.accountant}</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)', borderTop: '3px solid rgb(107 114 128)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Supplier</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem', color: 'rgb(107 114 128)' }}>{systemMetrics.usersByRole.supplier}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className={ui.adminReportsHeroGrid}>
        <div className={ui.adminReportsMetricsTrio}>
          <section className={ui.adminReportsTurnoverCard}>
            <p className={ui.adminReportsMetricLabel}>Inventory turnover</p>
            <div className={ui.analyticsMetricDonutRow}>
              <div
                className={`${ui.analyticsDonut} ${ui.analyticsDonutXs}`}
                style={{
                  background: `conic-gradient(var(--ec-primary) 0% ${Math.min(100, turnover * 14)}%, rgb(226 232 240) ${Math.min(100, turnover * 14)}% 100%)`,
                }}
                role="presentation"
              />
              <div className={ui.analyticsDonutLabel}>
                <strong className={ui.analyticsDonutHoleSm}>{turnover}</strong>
              </div>
              <div className={ui.adminReportsTurnoverMain}>
                <strong className={ui.adminReportsTurnoverValue}>{turnover}</strong>
                <span className={ui.adminReportsMetricMeta}>
                  {velocityDelta >= 0 ? '+' : ''}
                  {velocityDelta.toFixed(0)}% velocity
                </span>
              </div>
            </div>
          </section>

          <article className={ui.adminReportsMiniCard}>
            <p className={ui.adminReportsMiniLabel}>Stock accuracy</p>
            <div className={ui.analyticsMetricDonutRow}>
              <div
                className={`${ui.analyticsDonut} ${ui.analyticsDonutXs}`}
                style={{
                  background: `conic-gradient(#16a34a 0% ${stockAccuracy}%, rgb(226 232 240) ${stockAccuracy}% 100%)`,
                }}
                role="presentation"
              />
              <div className={ui.analyticsDonutLabel}>
                <strong className={ui.analyticsDonutHoleSm}>{stockAccuracy}%</strong>
              </div>
              <div className={ui.adminReportsMiniStatRow}>
                <strong className={ui.adminReportsMiniStat}>{stockAccuracy}%</strong>
                <span className={ui.adminReportsMiniPill}>OK</span>
              </div>
            </div>
          </article>

          <article className={ui.adminReportsMiniCard}>
            <p className={ui.adminReportsMiniLabel}>Fulfillment rate</p>
            <div className={ui.analyticsMetricDonutRow}>
              <div
                className={`${ui.analyticsDonut} ${ui.analyticsDonutXs}`}
                style={{
                  background: `conic-gradient(#2563eb 0% ${fulfillmentRate}%, rgb(226 232 240) ${fulfillmentRate}% 100%)`,
                }}
                role="presentation"
              />
              <div className={ui.analyticsDonutLabel}>
                <strong className={ui.analyticsDonutHoleSm}>{fulfillmentRate}%</strong>
              </div>
              <div className={ui.adminReportsMiniStatRow}>
                <strong className={ui.adminReportsMiniStat}>{fulfillmentRate}%</strong>
                <span className={ui.adminReportsMiniPill}>Ship</span>
              </div>
            </div>
          </article>
        </div>

        <aside className={ui.adminReportsCuratorCard}>
          <p className={ui.adminReportsCuratorEyebrow}>{t('cungaAi.reportsCardEyebrow')}</p>
          <h2 className={ui.adminReportsCuratorTitle}>{curatorShort}</h2>
          <div className={ui.analyticsDonutRow}>
            <div
              className={`${ui.analyticsDonut} ${ui.analyticsDonutOnDark}`}
              style={{
                background:
                  regionDonutSlices.length > 0
                    ? `conic-gradient(${conicGradientFromSlices(regionDonutSlices)})`
                    : 'rgb(255 255 255 / 0.2)',
              }}
              role="img"
              aria-label="Regional requisitions"
            />
            <div className={ui.analyticsDonutLabel}>
              <strong>{topRegionRow?.percent ?? 0}%</strong>
              <span>lead</span>
            </div>
            <ul className={ui.analyticsLegend}>
              {regionDonutSlices.length ? (
                regionDonutSlices.map((s, i) => (
                  <li key={s.name} className={ui.analyticsLegendRow}>
                    <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                    <span className={ui.analyticsLegendName}>{s.name}</span>
                    <span className={ui.analyticsLegendQty}>{s.value}</span>
                    <span className={ui.analyticsLegendPct}>{Math.round(((s.value || 0) / regionDonutTotal) * 100)}%</span>
                  </li>
                ))
              ) : (
                <li className={ui.analyticsLegendRowMuted}>No regional reqs in filters.</li>
              )}
            </ul>
          </div>
          <div className={ui.adminReportsCuratorFoot}>
            <div className={ui.adminReportsCuratorAvatars}>
              <span>PN</span>
              <span>CM</span>
              <small>+4</small>
            </div>
            <button type="button" className={ui.adminReportsCuratorBtn} onClick={() => navigate('/app/admin/alerts')}>
              Review plan
            </button>
          </div>
        </aside>
      </div>

      <div className={ui.adminReportsMiddleGrid}>
        <section className={ui.adminReportsRegionCard}>
          <div className={ui.adminCardHead}>
            <h2 className={ui.adminReportsSectionTitle}>Regional distribution</h2>
            <span className={ui.adminReportsDots}>···</span>
          </div>
          <div className={ui.analyticsStackBarWide} role="img" aria-label="Regional requisition share">
            {regions.map((entry) => (
              <div
                key={entry.label}
                className={ui.analyticsStackSeg}
                style={{
                  flex: Math.max(1, entry.percent),
                  background:
                    REPORT_SLICE_COLORS[ADMIN_REPORT_REGIONS.indexOf(entry.label) % REPORT_SLICE_COLORS.length],
                }}
                title={`${entry.label} ${entry.percent}%`}
              />
            ))}
          </div>
          <div className={ui.adminReportsRegionList}>
            {regions.map((entry) => (
              <div key={entry.label} className={ui.adminReportsRegionRow}>
                <div className={ui.adminReportsRegionTop}>
                  <span>{entry.label}</span>
                  <strong>{entry.percent}%</strong>
                </div>
                <div className={ui.adminReportsRegionTrack}>
                  <span className={ui.adminReportsRegionFill} style={{ width: `${entry.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className={ui.adminReportsRegionMap}>Live share by hub</div>
        </section>

        <section className={ui.adminReportsVelocityCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h2 className={ui.adminReportsSectionTitle}>Turnover velocity</h2>
              <p className={ui.adminReportsSectionMeta}>Consumption vs restock · {adminDatePreset === 'all' ? 'All time' : adminDatePreset === '30d' ? 'Last 30 days' : adminDatePreset === '90d' ? 'Last 90 days' : 'Last 12 months'}</p>
            </div>
            <div className={ui.adminReportsLegend}>
              <span><i className={ui.adminReportsLegendSales} /> Consumption</span>
              <span><i className={ui.adminReportsLegendRestock} /> Restock</span>
            </div>
          </div>

          <div
            className={`${ui.analyticsChartGrid} ${ui.analyticsChartGridTall}`}
            style={{ position: 'relative', overflow: 'visible' }}
          >
            <svg
              ref={velocitySvgRef}
              viewBox={`0 0 ${VEL_W} ${VEL_H}`}
              className={`${ui.adminReportsVelocityChart} ${ui.analyticsChartSvgTall}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Consumption and restock curves"
              style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
              onMouseMove={(e) => {
                if (!velocitySvgRef.current || txV.length === 0) return;
                const rect = velocitySvgRef.current.getBoundingClientRect();
                const svgX = ((e.clientX - rect.left) / rect.width) * VEL_W;
                let best = 0;
                let bestDist = Infinity;
                txV.forEach((x, i) => {
                  const d = Math.abs(x - svgX);
                  if (d < bestDist) { bestDist = d; best = i; }
                });
                setHoveredVelocityIdx(best);
              }}
              onMouseLeave={() => setHoveredVelocityIdx(null)}
            >
              <defs>
                <linearGradient id={`${velocityGradId}-sales`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(37 99 235 / 0.28)" />
                  <stop offset="100%" stopColor="rgb(37 99 235 / 0.03)" />
                </linearGradient>
                <linearGradient id={`${velocityGradId}-restock`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(120 11 35 / 0.25)" />
                  <stop offset="100%" stopColor="rgb(120 11 35 / 0.03)" />
                </linearGradient>
              </defs>

              {/* Y-axis grid lines + labels */}
              {velYTicks.ticks.map((v) => {
                const y = VEL_PAD_T + VEL_PLOT_H - (v / velYTicks.niceMax) * VEL_PLOT_H;
                const label = v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v);
                return (
                  <g key={v}>
                    <line
                      x1={VEL_PAD_L} y1={y.toFixed(1)}
                      x2={VEL_W - VEL_PAD_R} y2={y.toFixed(1)}
                      stroke="var(--ec-border)"
                      strokeWidth="0.6"
                      strokeDasharray={v === 0 ? 'none' : '3 3'}
                      opacity={v === 0 ? 0.7 : 0.4}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={VEL_PAD_L - 5} y={y.toFixed(1)}
                      textAnchor="end" dominantBaseline="middle"
                      fontSize="9" fill="var(--ec-muted)"
                      style={{ fontFamily: 'var(--ec-font-sans)', fontWeight: 400 }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Area fills */}
              {restockAreaDV ? <path d={restockAreaDV} fill={`url(#${velocityGradId}-restock)`} /> : null}
              {salesAreaDV ? <path d={salesAreaDV} fill={`url(#${velocityGradId}-sales)`} /> : null}

              {/* Hover crosshair */}
              {hoveredVelocityIdx !== null && txV[hoveredVelocityIdx] !== undefined ? (
                <line
                  x1={txV[hoveredVelocityIdx].toFixed(1)} y1={VEL_PAD_T}
                  x2={txV[hoveredVelocityIdx].toFixed(1)} y2={VEL_PAD_T + VEL_PLOT_H}
                  stroke="var(--ec-primary)" strokeWidth="0.8"
                  strokeDasharray="3 2" opacity="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {/* Restock line */}
              {restockLineDV ? (
                <path
                  d={restockLineDV} fill="none"
                  stroke="var(--ec-primary)" strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round"
                  className={ui.adminReportsRestockLine}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {/* Sales/consumption line */}
              {salesLineDV ? (
                <path
                  d={salesLineDV} fill="none"
                  stroke="rgb(37 99 235)" strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round"
                  className={ui.adminReportsSalesLine}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {/* Data point circles */}
              {txV.map((x, i) => (
                <g key={`v-${i}`}>
                  <circle
                    cx={x.toFixed(1)} cy={syV[i].toFixed(1)}
                    r={hoveredVelocityIdx === i ? 4 : 2.5}
                    fill={hoveredVelocityIdx === i ? 'rgb(37 99 235)' : 'var(--ec-white)'}
                    stroke="rgb(37 99 235)" strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    style={{ transition: 'r 0.15s ease' }}
                  />
                  <circle
                    cx={x.toFixed(1)} cy={ryV[i].toFixed(1)}
                    r={hoveredVelocityIdx === i ? 4 : 2.5}
                    fill={hoveredVelocityIdx === i ? 'var(--ec-primary)' : 'var(--ec-white)'}
                    stroke="var(--ec-primary)" strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    style={{ transition: 'r 0.15s ease' }}
                  />
                </g>
              ))}

              {/* X-axis date labels */}
              {monthLabels.map((label, i) => {
                const x = txV[i];
                if (x === undefined) return null;
                return (
                  <text
                    key={`xl-${i}`}
                    x={x.toFixed(1)} y={VEL_PAD_T + VEL_PLOT_H + 14}
                    textAnchor="middle" fontSize="9" fill="var(--ec-muted)"
                    style={{ fontFamily: 'var(--ec-font-sans)', fontWeight: 400 }}
                  >
                    {label}
                  </text>
                );
              })}

              {/* Empty state */}
              {salesSeries.every((v) => v === 0) && restockSeries.every((v) => v === 0) ? (
                <text
                  x={VEL_W / 2} y={VEL_H / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="11" fill="var(--ec-muted)"
                  style={{ fontFamily: 'var(--ec-font-sans)', fontWeight: 400 }}
                >
                  No data in this range — adjust filters
                </text>
              ) : null}
            </svg>

            {/* Hover tooltip */}
            {hoveredVelocityIdx !== null && velocitySvgRef.current ? (
              <div
                className={ui.adminChartTooltip}
                style={{
                  left: `${(txV[hoveredVelocityIdx] / VEL_W) * 100}%`,
                  top: `${(Math.min(syV[hoveredVelocityIdx], ryV[hoveredVelocityIdx]) / VEL_H) * 100}%`,
                  transform: 'translate(-50%, -110%)',
                  pointerEvents: 'none',
                  position: 'absolute',
                }}
              >
                <span className={ui.adminChartTooltipDate}>{monthLabels[hoveredVelocityIdx]}</span>
                <span className={ui.adminChartTooltipRow}>
                  <span className={ui.adminChartTooltipDotBlue} />
                  <span className={ui.adminChartTooltipLabel}>Consumption</span>
                  <strong className={ui.adminChartTooltipValue}>{salesSeries[hoveredVelocityIdx]?.toLocaleString()}</strong>
                </span>
                <span className={ui.adminChartTooltipRow}>
                  <span className={ui.adminChartTooltipDotMaroon} />
                  <span className={ui.adminChartTooltipLabel}>Restock</span>
                  <strong className={ui.adminChartTooltipValue}>{restockSeries[hoveredVelocityIdx]?.toLocaleString()}</strong>
                </span>
              </div>
            ) : null}
          </div>

          <div className={ui.adminReportsVelocityMonths}>
            {monthLabels.map((month, i) => (
              <span
                key={`${month}-${i}`}
                style={{ opacity: hoveredVelocityIdx === i ? 1 : hoveredVelocityIdx !== null ? 0.45 : 1, transition: 'opacity 0.15s' }}
              >
                {month}
                <strong className={ui.analyticsChartLabelPct}>
                  {salesPctEach[i]}% / {restockPctEach[i]}%
                </strong>
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className={ui.adminReportsAuditCard}>
        <div className={ui.adminReportsSectionHeadRow}>
          <h2 className={ui.adminReportsSectionTitle}>Audit log mix</h2>
        </div>
        <div className={ui.analyticsAnomalyVisual}>
          <div className={ui.analyticsStackBarWide} role="img" aria-label="Verification status distribution">
            {auditMixSlices.some((s) => s.value > 0) ? (
              auditMixSlices
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div
                    key={s.name}
                    className={ui.analyticsStackSeg}
                    style={{ flex: Math.max(1, s.value), background: s.color }}
                    title={`${s.name} ${s.pct}%`}
                  />
                ))
            ) : (
              <div className={ui.analyticsStackSeg} style={{ flex: 1, background: 'rgb(226 232 240)' }} title="No rows" />
            )}
          </div>
          <ul className={ui.analyticsLegendInline}>
            {auditMixSlices.map((s) => (
              <li key={s.name} className={ui.analyticsLegendRow}>
                <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                <span className={ui.analyticsLegendName}>{s.name}</span>
                <span className={ui.analyticsLegendPct}>{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={ui.adminReportsAuditHead}>
          <span>Audit ID</span>
          <span>Assigned Region</span>
          <span>Inventory Count</span>
          <span>Verification Status</span>
        </div>
        <div className={ui.adminReportsAuditRows}>
          {auditLogs.length === 0 ? (
            <p className={ui.empty}>No audit entries match these filters.</p>
          ) : (
            auditPager.pageSlice.map((entry) => (
              <article key={entry.id} className={ui.adminReportsAuditRow}>
                <div>
                  <p className={ui.adminReportsAuditId}>{entry.id}</p>
                  <p className={ui.adminReportsAuditMeta}>{entry.time}</p>
                </div>
                <div>
                  <span className={ui.adminReportsAuditRegion}>{entry.region}</span>
                </div>
                <div className={ui.adminReportsAuditCount}>{entry.count}</div>
                <div>
                  <span
                    className={
                      entry.statusTone === 'good'
                        ? ui.adminReportsAuditBadgeGood
                        : entry.statusTone === 'pending'
                          ? ui.adminReportsAuditBadgePending
                          : ui.adminReportsAuditBadgeBad
                    }
                  >
                    {entry.status}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
        <ListPageControls
          variant="table"
          rangeFrom={auditPager.rangeFrom}
          rangeTo={auditPager.rangeTo}
          total={auditPager.total}
          page={auditPager.page}
          pageCount={auditPager.pageCount}
          pagerNums={auditPager.pagerNums}
          onPrev={auditPager.goPrev}
          onNext={auditPager.goNext}
          onSelectPage={auditPager.setPage}
          canPrev={auditPager.canPrev}
          canNext={auditPager.canNext}
        />
      </section>
    </div>
  );
}

const ADMIN_HELP_QUICK = [
  { segment: 'dashboard', label: 'Dashboard', hint: 'KPIs, curves, and inventory spotlight' },
  { segment: 'users', label: 'User management', hint: 'Invite, activate, and audit accounts' },
  { segment: 'rbac', label: 'Roles & access', hint: 'RBAC matrix and workflow coverage' },
  { segment: 'settings', label: 'Company settings', hint: 'Legal profile, thresholds, preferences' },
  { segment: 'reports', label: 'Reports & analytics', hint: 'Turnover, regions, and audit trail' },
  { segment: 'activity', label: 'Notifications center', hint: 'Critical alerts and AI nudges' },
  { segment: 'messages', label: 'Messages', hint: 'Chat, files, directory, and alerts' },
];

const ADMIN_HELP_FAQ = [
  {
    id: 'faq-invite',
    q: 'How do I invite someone without breaking role separation?',
    a: 'Use User management → Add New User, pick exactly one operational role (clerk, supervisor, accountant, or supplier), and confirm they receive the invite email. Admins stay on this workspace; supplier accounts should use a dedicated supplier email domain when possible.',
    keys: 'invite user role email supplier',
  },
  {
    id: 'faq-rbac',
    q: 'Where can I see what each role is allowed to do?',
    a: 'Open Roles & access for the live RBAC matrix. It mirrors inventory, requisitions, invoices, payments, and settings visibility so you can explain access to auditors or new executives in one screen.',
    keys: 'rbac permissions matrix audit',
  },
  {
    id: 'faq-alerts',
    q: 'Why am I seeing stock and security alerts together?',
    a: 'The Notifications center groups operational warnings (stock, shipments) with governance signals (login anomalies, backups). Filter by Critical, Warnings, or Information to focus; mark items read when triaged.',
    keys: 'notifications alerts filter security stock',
  },
  {
    id: 'faq-settings',
    q: 'Which company fields affect downstream workflows?',
    a: 'Company name and currency appear on finance views; low-stock and approval thresholds in Company settings influence when supervisors and clerks get nudges. Save after edits—discard resets the form to the last saved snapshot.',
    keys: 'company settings currency threshold save',
  },
  {
    id: 'faq-data',
    q: 'Where does workspace data come from?',
    a: 'With MongoDB enabled, the app loads company state from the API (portal state, activity, stock, and workflows). Without a database connection, protected routes are unavailable.',
    keys: 'api production database mongodb',
  },
];

export function AdminHelpCenter() {
  const { t } = useI18n();
  const { state, adminUsesApi } = usePortalData();
  const shellHelpSearch = useShellSearchQuery();
  const openReqs = state.requisitions.filter((entry) => entry.status !== 'closed' && entry.status !== 'rejected').length;
  const activeUsers = state.users.filter((entry) => entry.isActive).length;
  const lowStock = state.stockItems.filter((entry) => Number(entry.quantity || 0) <= Number(entry.minThreshold || 0)).length;
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(() => new Set(['faq-invite']));

  const filteredFaq = useMemo(() => {
    const parts = [query, shellHelpSearch]
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return ADMIN_HELP_FAQ;
    return ADMIN_HELP_FAQ.filter((item) => {
      const blob = `${item.q} ${item.a} ${item.keys}`.toLowerCase();
      return parts.every((p) => blob.includes(p));
    });
  }, [query, shellHelpSearch]);
  const faqPager = usePagedList(filteredFaq, { resetKey: `${query}|${shellHelpSearch}` });

  function toggleFaq(id) {
    setOpenFaq((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={ui.adminHelpBoard}>
      <PageIntro
        eyebrow={t('app.admin.helpEyebrow')}
        title={t('app.admin.helpTitle')}
        description={t('app.admin.helpDesc')}
      />

      <div className={ui.adminHelpToolbar}>
        <label className={ui.adminHelpSearch}>
          <span className={ui.adminHelpSearchIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help topics (users, RBAC, alerts, settings…)"
            className={ui.adminHelpSearchInput}
            aria-label="Search help articles"
          />
        </label>
      </div>

      <div className={ui.adminHelpStatusRow} role="status">
        <div className={ui.adminHelpStatusPill}>
          <span className={ui.adminHelpStatusDot} aria-hidden="true" />
          {adminUsesApi ? 'Database' : 'Demo'} · v{String(state.version ?? 5)}
        </div>
        <div className={ui.adminHelpStatusPillMuted}>{activeUsers} active users</div>
        <div className={ui.adminHelpStatusPillMuted}>{openReqs} open workflows</div>
        <div className={ui.adminHelpStatusPillWarn}>{lowStock} SKUs at or below minimum</div>
      </div>

      <section className={ui.adminHelpSection} aria-labelledby="admin-help-quick-heading">
        <h2 id="admin-help-quick-heading" className={ui.adminHelpSectionTitle}>
          Jump to a workspace area
        </h2>
        <div className={ui.adminHelpQuickGrid}>
          {ADMIN_HELP_QUICK.map((item) => (
            <NavLink key={item.segment} to={`/app/admin/${item.segment}`} className={({ isActive }) => (isActive ? ui.adminHelpQuickCardActive : ui.adminHelpQuickCard)}>
              <span className={ui.adminHelpQuickLabel}>{item.label}</span>
              <span className={ui.adminHelpQuickHint}>{item.hint}</span>
            </NavLink>
          ))}
        </div>
      </section>

      <div className={ui.adminHelpSplit}>
        <aside className={ui.adminHelpAside} aria-labelledby="admin-help-contact-heading">
          <h2 id="admin-help-contact-heading" className={ui.adminHelpAsideTitle}>
            Contact & escalation
          </h2>
          <div className={ui.adminHelpContactCard}>
            <p className={ui.adminHelpContactEyebrow}>Portal support</p>
            <a className={ui.adminHelpContactLink} href="mailto:hello@ecunga.com">
              hello@ecunga.com
            </a>
            <p className={ui.adminHelpContactBody}>Onboarding, access issues, and dashboard questions.</p>
          </div>
          <div className={ui.adminHelpContactCard}>
            <p className={ui.adminHelpContactEyebrow}>Operations desk</p>
            <p className={ui.adminHelpContactBody}>Workflow design, stock governance, and supplier enablement during rollout.</p>
            <span className={ui.adminHelpContactMeta}>Target response · 2 business hours (priority admin)</span>
          </div>
          <div className={ui.adminHelpContactCardAccent}>
            <p className={ui.adminHelpContactEyebrowLight}>Tip</p>
            <p className={ui.adminHelpContactBodyLight}>
              Pin <NavLink to="/app/admin/activity">Notifications center</NavLink> during cutover weeks—filter Critical first, then clear informational noise after stand-up.
            </p>
          </div>
        </aside>

        <div className={ui.adminHelpMain}>
          <h2 className={ui.adminHelpSectionTitle}>Frequently asked questions</h2>
          <ul className={ui.adminHelpFaqList}>
            {filteredFaq.length === 0 ? (
              <li className={ui.adminHelpFaqEmpty}>No articles match that search. Try “invite”, “RBAC”, or “alerts”.</li>
            ) : (
              faqPager.pageSlice.map((item) => {
                const expanded = openFaq.has(item.id);
                return (
                  <li key={item.id} className={ui.adminHelpFaqItem}>
                    <button type="button" className={ui.adminHelpFaqTrigger} onClick={() => toggleFaq(item.id)} aria-expanded={expanded}>
                      <span>{item.q}</span>
                      <span className={expanded ? ui.adminHelpFaqChevronOpen : ui.adminHelpFaqChevron} aria-hidden="true">
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                          <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    {expanded ? <p className={ui.adminHelpFaqAnswer}>{item.a}</p> : null}
                  </li>
                );
              })
            )}
          </ul>
          {filteredFaq.length > 0 ? (
            <ListPageControls
              variant="feed"
              rangeFrom={faqPager.rangeFrom}
              rangeTo={faqPager.rangeTo}
              total={faqPager.total}
              page={faqPager.page}
              pageCount={faqPager.pageCount}
              pagerNums={faqPager.pagerNums}
              onPrev={faqPager.goPrev}
              onNext={faqPager.goNext}
              onSelectPage={faqPager.setPage}
              canPrev={faqPager.canPrev}
              canNext={faqPager.canNext}
            />
          ) : null}

          <section className={ui.adminHelpResources} aria-labelledby="admin-help-res-heading">
            <h2 id="admin-help-res-heading" className={ui.adminHelpSectionTitle}>
              Downloads & runbooks
            </h2>
            <div className={ui.adminHelpResourceGrid}>
              <button type="button" className={ui.adminHelpResourceBtn}>
                <span className={ui.adminHelpResourceIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className={ui.adminHelpResourceLabel}>Admin rollout checklist (PDF)</span>
                <span className={ui.adminHelpResourceMeta}>Mock asset · print-friendly</span>
              </button>
              <button type="button" className={ui.adminHelpResourceBtn}>
                <span className={ui.adminHelpResourceIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
                    <path d="M7 4h7l3 3v13H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </span>
                <span className={ui.adminHelpResourceLabel}>Incident response one-pager</span>
                <span className={ui.adminHelpResourceMeta}>Mock asset · security + stock</span>
              </button>
              <button type="button" className={ui.adminHelpResourceBtn}>
                <span className={ui.adminHelpResourceIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
                    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </span>
                <span className={ui.adminHelpResourceLabel}>Executive metrics glossary</span>
                <span className={ui.adminHelpResourceMeta}>Mock asset · board prep</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function AdminMessages() {
  return <PortalMessagingHub role="admin" />;
}

function AdminUserInviteModal({ isOpen, onClose, onSave, limitReached, isPlatformTenant }) {
  const { t } = useI18n();
  const { flash } = useFlash();
  const { state } = usePortalData();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    role: isPlatformTenant ? 'supervisor' : 'clerk',
    jobTitle: '',
    phone: '',
    location: '',
    department: '',
    companyName: '',
    logoUrl: '',
  });

  useEffect(() => {
    if (!isOpen) setSubmitting(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      email: '',
      fullName: '',
      role: isPlatformTenant ? 'supervisor' : 'clerk',
      jobTitle: '',
      phone: '',
      location: '',
      department: '',
      companyName: '',
      logoUrl: '',
    });
  }, [isOpen, isPlatformTenant]);

  async function handleInviteLogoUpload(file) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const resp = await apiUploadMedia(file);
      setForm((f) => ({ ...f, logoUrl: resp.secure_url || '' }));
    } catch (e) {
      flash(`Logo upload failed: ${e?.message || 'Unknown error'}`, 'error');
    } finally {
      setUploadingLogo(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={ui.adminModalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <section className={`${ui.adminModalInvite} ${ui.adminModalInviteCompact}`} onClick={(e) => e.stopPropagation()}>
        <header className={ui.adminCardHead}>
          <div>
            <h2 className={ui.adminUsersSectionTitle}>
              {isPlatformTenant ? 'Register New Supervisor / Supplier' : 'Invite New User'}
            </h2>
            <p className={ui.adminUsersSectionMeta}>
              {isPlatformTenant 
                ? 'Create an independent company entity and assign its primary user.' 
                : 'Create a new workspace account and assign an operational role.'}
            </p>
          </div>
          <button type="button" className={ui.adminModalClose} onClick={onClose} aria-label="Close modal">×</button>
        </header>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting || limitReached) return;
            setSubmitting(true);
            try {
              await Promise.resolve(
                onSave({
                  ...form,
                  logoUrl: String(form.logoUrl || '').trim(),
                  companyName: String(form.companyName || '').trim(),
                })
              );
            } finally {
              setSubmitting(false);
            }
          }}
          className={ui.adminUsersInviteFormModal}
        >
          <div className={ui.adminModalGrid}>
            <label className={ui.adminModalField}>
               <span>Email or Phone number</span>
               <input className={ui.input} placeholder="Email or +250..." type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className={ui.adminModalField}>
               <span>Full name</span>
               <input className={ui.input} placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </label>
            <label className={ui.adminModalField}>
               <span>{t('app.supervisor.workspaceRoleLabel')}</span>
               <select className={ui.select} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                 {isPlatformTenant ? (
                   <>
                     <option value="supervisor">Supervisor (Company Admin)</option>
                     <option value="supplier">Supplier (External Vendor)</option>
                   </>
                 ) : (
                   <>
                     <option value="clerk">Clerk</option>
                     <option value="supervisor">Supervisor</option>
                     <option value="accountant">Accountant</option>
                     <option value="supplier">Supplier</option>
                   </>
                 )}
               </select>
            </label>
            {isPlatformTenant && (
              <label className={ui.adminModalField}>
                 <span>Company name</span>
                 <input className={ui.input} placeholder="e.g. Acme Health Corp" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required={isPlatformTenant} />
              </label>
            )}
            {isPlatformTenant && (
              <div className={ui.adminModalFieldWide}>
                <span>Company logo (optional)</span>
                <div className={ui.adminInviteLogoInner}>
                  <div className={ui.adminInviteLogoTile} aria-hidden="true">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="" className={ui.adminInviteLogoImg} />
                    ) : (
                      (form.companyName || '?').trim().charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                  <div className={ui.adminInviteLogoControls}>
                    <input
                      className={ui.input}
                      type="url"
                      inputMode="url"
                      placeholder="https://… or upload a file"
                      value={form.logoUrl}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      autoComplete="off"
                    />
                    <label className={ui.adminInviteLogoFile}>
                      <span>{uploadingLogo ? 'Uploading…' : 'Upload image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingLogo}
                        onChange={(e) => handleInviteLogoUpload(e.target.files?.[0])}
                      />
                    </label>
                    <p className={ui.adminUsersSectionMeta} style={{ margin: '0.35rem 0 0' }}>
                      You can add or change this later in Company settings.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <label className={ui.adminModalField}>
               <span>{t('app.supervisor.teamFieldTeam')}</span>
               <input
                 className={ui.input}
                 placeholder={t('app.supervisor.teamFieldTeam')}
                 value={form.jobTitle}
                 onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
               />
            </label>
            <label className={ui.adminModalField}>
               <span>{t('app.supervisor.teamFieldPhone')}</span>
               <input
                 className={ui.input}
                 type="tel"
                 autoComplete="tel"
                 placeholder={t('app.supervisor.teamFieldPhone')}
                 value={form.phone}
                 onChange={(e) => setForm({ ...form, phone: e.target.value })}
               />
            </label>
            <label className={ui.adminModalField}>
               <span>{t('app.supervisor.teamFieldLocation')}</span>
               <input
                 className={ui.input}
                 placeholder={t('app.supervisor.teamFieldLocation')}
                 value={form.location}
                 onChange={(e) => setForm({ ...form, location: e.target.value })}
               />
            </label>
            <label className={ui.adminModalField}>
               <span>{t('app.supervisor.teamFieldDepartment')}</span>
               <input
                 className={ui.input}
                 placeholder={t('app.supervisor.teamFieldDepartment')}
                 value={form.department}
                 onChange={(e) => setForm({ ...form, department: e.target.value })}
               />
             </label>

            {['supervisor', 'admin'].includes(form.role) && (
            <div className={ui.adminModalFieldWide} style={{ marginTop: '1.0rem' }}>
              <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem', display: 'block', marginBottom: '0.4rem' }}>
                Auto-Assigned Plan Capabilities
              </span>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.8rem' }}>
                This user's initial access is determined by your active plan (<strong>{String(state.company?.plan || 'essential').toUpperCase()}</strong>) and role.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {[
                  { label: 'Inventory Overview', desc: 'Allows viewing stock levels.', tier: 'essential' },
                  { label: 'Inventory Modifications', desc: 'Allows registering/updating catalog.', tier: 'essential' },
                  { label: 'Manual Requisitions', desc: 'Submit purchase requests manually.', tier: 'essential' },
                  { label: 'Auto-Requisitioning (AI)', desc: 'AI-driven stockout checks.', tier: 'professional' },
                  { label: 'Weekly Stock Movement Digest', desc: 'Weekly analytical consumption reports.', tier: 'professional' },
                  { label: 'Dedicated Support & Custom Modules', desc: 'Enterprise SLAs and schema overrides.', tier: 'custom' },
                ].map((perm) => {
                  const companyPlan = String(state.company?.plan || 'essential').toLowerCase();
                  const isSuperOrAdmin = ['supervisor', 'admin'].includes(form.role) || ['supervisor', 'admin'].includes(user?.role || '');
                  const allowed = isSuperOrAdmin || companyPlan === 'custom' || companyPlan === 'enterprise' || 
                    (companyPlan === 'professional' && (perm.tier === 'essential' || perm.tier === 'professional')) ||
                    (companyPlan === 'essential' && perm.tier === 'essential');
                  return (
                    <div 
                      key={perm.label}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        padding: '0.5rem 0.75rem', 
                        borderRadius: '6px', 
                        background: allowed ? '#f0fdf4' : '#f1f5f9',
                        border: '1px solid',
                        borderColor: allowed ? '#bbf7d0' : '#cbd5e1',
                        opacity: allowed ? 1 : 0.65
                      }}
                    >
                      {allowed ? (
                        <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </span>
                      )}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: allowed ? '#166534' : '#475569' }}>
                          {perm.label}
                        </span>
                        {!allowed && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#ef4444', marginLeft: '0.35rem' }}>
                            ({perm.tier.toUpperCase()} ONLY)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>

          <div className={ui.adminModalFoot}>
            <button type="button" className={ui.adminGhostBtn} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={ui.adminPrimaryBtn} disabled={limitReached || submitting}>
              {limitReached ? (
                'Limit Reached'
              ) : submitting ? (
                <span className={ui.adminModalBtnContent}>
                  <span className={ui.adminBtnSpinner} aria-hidden />
                  {t('app.admin.usersInviteSubmitting')}
                </span>
              ) : (
                'Send Invitation'
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function AdminUserEditModal({
  isOpen,
  user,
  onClose,
  onSave,
  isPlatformTenant,
  supervisorOperationalRoster = false,
  /** When true, role dropdown includes Supplier (supervisor Suppliers segment only). */
  supervisorOperationalIncludeSupplier = false,
  /** Parent-controlled save state (e.g. supervisor clerk update). */
  isSaving = false,
}) {
  const { t } = useI18n();
  const { state } = usePortalData();
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    role: '',
    jobTitle: '',
    phone: '',
    location: '',
    department: '',
  });

  useEffect(() => {
    if (!isOpen) setSaving(false);
  }, [isOpen]);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        role: user.role || 'clerk',
        jobTitle: supervisorOperationalRoster ? user.team || '' : user.jobTitle || user.team || '',
        phone: user.phone || '',
        location: user.location || '',
        department: user.department || '',
      });
      let initialPerms = Array.isArray(user.permissions) ? user.permissions : [];
      if (initialPerms.length === 0) {
        const plan = String(state.company?.plan || 'essential').toLowerCase();
        if (plan === 'essential') {
          initialPerms = ['inventory:read', 'inventory:write', 'requisitions:manual', 'suppliers:all'];
        } else if (plan === 'professional') {
          initialPerms = ['inventory:read', 'inventory:write', 'requisitions:manual', 'requisitions:auto', 'reports:weekly', 'suppliers:all'];
        } else {
          initialPerms = ['inventory:read', 'inventory:write', 'requisitions:manual', 'requisitions:auto', 'reports:weekly', 'suppliers:all', 'support:dedicated', 'features:custom'];
        }
      }
      setSelectedPermissions(initialPerms);
    }
  }, [user, supervisorOperationalRoster, state.company]);

  const supplierRoleReadOnly =
    supervisorOperationalRoster &&
    !supervisorOperationalIncludeSupplier &&
    (user?.role === 'supplier' || form.role === 'supplier');

  const busy = saving || isSaving;

  if (!isOpen) return null;

  return (
    <div className={ui.adminModalOverlay} onClick={busy ? undefined : onClose} role="dialog" aria-modal="true">
      <section className={`${ui.adminModalInvite} ${ui.adminModalInviteCompact}`} onClick={(e) => e.stopPropagation()}>
        <header className={ui.adminCardHead}>
          <div>
            <h2 className={ui.adminUsersSectionTitle}>Edit User Profile</h2>
            <p className={ui.adminUsersSectionMeta}>Update account details for {user.email}.</p>
          </div>
          <button type="button" className={ui.adminModalClose} onClick={onClose} disabled={busy} aria-label="Close modal">×</button>
        </header>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setSaving(true);
            try {
              const patch = {
                fullName: form.fullName.trim(),
                role: form.role,
                location: form.location.trim(),
                phone: form.phone.trim(),
                department: form.department.trim(),
                permissions: selectedPermissions,
              };
              if (supervisorOperationalRoster) {
                patch.team = form.jobTitle.trim();
              } else {
                patch.jobTitle = form.jobTitle.trim();
              }
              await Promise.resolve(onSave(patch));
            } finally {
              setSaving(false);
            }
          }}
          className={ui.adminUsersInviteFormModal}
        >
          <div className={ui.adminModalGrid}>
            <label className={ui.adminModalFieldWide}>
               <span>Full name</span>
               <input className={ui.input} placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required disabled={busy} />
            </label>
            <label className={ui.adminModalField}>
               <span>{t('app.supervisor.workspaceRoleLabel')}</span>
               {supplierRoleReadOnly ? (
                 <input
                   className={ui.input}
                   readOnly
                   value={t(`roles.${form.role || 'supplier'}`)}
                   aria-readonly="true"
                 />
               ) : (
               <select className={ui.select} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                 {supervisorOperationalRoster ? (
                   <>
                     <option value="clerk">Clerk</option>
                     <option value="accountant">Accountant</option>
                     {supervisorOperationalIncludeSupplier ? <option value="supplier">Supplier</option> : null}
                   </>
                 ) : isPlatformTenant ? (
                   <>
                     <option value="supervisor">Supervisor (Company Admin)</option>
                     <option value="supplier">Supplier (External Vendor)</option>
                   </>
                 ) : (
                   <>
                     <option value="clerk">Clerk</option>
                     <option value="supervisor">Supervisor</option>
                     <option value="accountant">Accountant</option>
                     <option value="supplier">Supplier</option>
                   </>
                 )}
               </select>
               )}
            </label>
            <label className={ui.adminModalField}>
               <span>
                 {supervisorOperationalRoster ? t('accountPages.jobTitleLabel') : t('app.supervisor.teamFieldTeam')}
               </span>
               <input
                 className={ui.input}
                 placeholder={
                   supervisorOperationalRoster
                     ? t('accountPages.jobTitleLabel')
                     : t('app.supervisor.teamFieldTeam')
                 }
                 value={form.jobTitle}
                 onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                 required={supervisorOperationalRoster && ['clerk', 'accountant'].includes(form.role)}
               />
            </label>
            <label className={ui.adminModalField}>
               <span>{t('app.supervisor.teamFieldPhone')}</span>
               <input
                 className={ui.input}
                 type="tel"
                 autoComplete="tel"
                 placeholder={t('app.supervisor.teamFieldPhone')}
                 value={form.phone}
                 onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required={supervisorOperationalRoster && ['clerk', 'accountant'].includes(form.role)}
               />
            </label>
            <label className={ui.adminModalFieldWide}>
               <span>{t('app.supervisor.teamFieldLocation')}</span>
               <input
                 className={ui.input}
                 placeholder={t('app.supervisor.teamFieldLocation')}
                 value={form.location}
                 onChange={(e) => setForm({ ...form, location: e.target.value })}
                required={supervisorOperationalRoster && ['clerk', 'accountant'].includes(form.role)}
               />
            </label>
            <label className={ui.adminModalFieldWide}>
               <span>{t('app.supervisor.teamFieldDepartment')}</span>
               <input
                 className={ui.input}
                 placeholder={t('app.supervisor.teamFieldDepartment')}
                 value={form.department}
                 onChange={(e) => setForm({ ...form, department: e.target.value })}
                 required={supervisorOperationalRoster && ['clerk', 'accountant'].includes(form.role)}
               />
            </label>

            {['supervisor', 'admin'].includes(form.role || user?.role) && (
            <div className={ui.adminModalFieldWide} style={{ marginTop: '1.25rem' }}>
              <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.92rem', display: 'block', marginBottom: '0.5rem' }}>
                Subscription-Based Access Permissions
              </span>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.0rem' }}>
                Grant granular system access. Advanced capabilities are disabled/locked according to your active payment plan (<strong>{String(state.company?.plan || 'essential').toUpperCase()}</strong>).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', paddingRight: '0.5rem', paddingBottom: '0.5rem' }}>
                {[
                  { key: 'inventory:read', label: 'Inventory Read Access', desc: 'Allows viewing stock items and threshold levels.', tier: 'essential' },
                  { key: 'inventory:write', label: 'Inventory Add/Modify Stock', desc: 'Allows registering, updating, and deleting stock catalog items.', tier: 'essential' },
                  { key: 'requisitions:manual', label: 'Manual Requisitions', desc: 'Create and submit material purchase requests manually.', tier: 'essential' },
                  { key: 'requisitions:auto', label: 'Auto-Requisitioning (AI)', desc: 'Enables automatic stockout requisitions via recurring batch checks.', tier: 'professional' },
                  { key: 'reports:weekly', label: 'Weekly Stock Movement Report', desc: 'Generates analytical stock movements and consumption digests.', tier: 'professional' },
                  { key: 'suppliers:all', label: 'Unrestricted Supplier Access', desc: 'Connect and dispatch requisition orders to all portal suppliers.', tier: 'essential' },
                  { key: 'support:dedicated', label: 'Dedicated Support Channel', desc: 'Direct escalation support line for emergency operations.', tier: 'custom' },
                  { key: 'features:custom', label: 'Custom Feature Development', desc: 'Ability to request tailor-made modules and schema overrides.', tier: 'custom' },
                ].map((perm) => {
                  const companyPlan = String(state.company?.plan || 'essential').toLowerCase();
                  const isSuperOrAdmin = ['supervisor', 'admin'].includes(form.role) || ['supervisor', 'admin'].includes(user?.role || '');
                  const allowed = isSuperOrAdmin || companyPlan === 'custom' || companyPlan === 'enterprise' || 
                    (companyPlan === 'professional' && (perm.tier === 'essential' || perm.tier === 'professional')) ||
                    (companyPlan === 'essential' && perm.tier === 'essential');
                  const isChecked = selectedPermissions.includes(perm.key);
                  return (
                    <div 
                      key={perm.key}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '0.65rem', 
                        padding: '0.75rem', 
                        borderRadius: '6px', 
                        background: allowed ? '#f8fafc' : '#f1f5f9',
                        border: '1px solid',
                        borderColor: allowed ? '#e2e8f0' : '#cbd5e1',
                        opacity: allowed ? 1 : 0.75,
                        cursor: allowed ? 'pointer' : 'not-allowed',
                        position: 'relative'
                      }}
                      onClick={() => {
                        if (!allowed) return;
                        setSelectedPermissions((prev) => 
                          prev.includes(perm.key) 
                            ? prev.filter((k) => k !== perm.key) 
                            : [...prev, perm.key]
                        );
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked && allowed} 
                        disabled={!allowed} 
                        onChange={() => {}} // Handled by container click
                        style={{ cursor: allowed ? 'pointer' : 'not-allowed', marginTop: '0.2rem' }} 
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: allowed ? '#0f172a' : '#475569' }}>
                            {perm.label}
                          </span>
                          {(() => {
                            const getTierBadge = (tier) => {
                              const t = String(tier).toLowerCase();
                              if (t === 'essential') {
                                return (
                                  <span style={{ fontSize: '0.62rem', fontWeight: '800', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    Essential
                                  </span>
                                );
                              }
                              if (t === 'professional') {
                                return (
                                  <span style={{ fontSize: '0.62rem', fontWeight: '800', background: '#faf5ff', color: '#6b21a8', border: '1px solid #e9d5ff', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    Professional
                                  </span>
                                );
                              }
                              return (
                                <span style={{ fontSize: '0.62rem', fontWeight: '800', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                  Enterprise
                                </span>
                              );
                            };

                            const getStatusBadge = (allowed, isChecked) => {
                              if (!allowed) {
                                return (
                                  <span style={{ fontSize: '0.62rem', fontWeight: '800', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '1px 5px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px', textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    Locked
                                  </span>
                                );
                              }
                              if (isChecked) {
                                return (
                                  <span style={{ fontSize: '0.62rem', fontWeight: '800', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                                    Active
                                  </span>
                                );
                              }
                              return (
                                <span style={{ fontSize: '0.62rem', fontWeight: '800', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                                  Inactive
                                </span>
                              );
                            };

                            return (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                {getTierBadge(perm.tier)}
                                {getStatusBadge(allowed, isChecked)}
                              </div>
                            );
                          })()}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem', lineHeight: '1.25' }}>
                          {perm.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>

          <div className={ui.adminModalFoot}>
            <button type="button" className={ui.adminGhostBtn} onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={ui.adminPrimaryBtn} disabled={busy}>
              {busy ? (
                <span className={ui.adminModalBtnContent}>
                  <span className={ui.adminBtnSpinner} aria-hidden />
                  {t('app.supervisor.teamUserUpdateProcessing')}
                </span>
              ) : (
                t('accountPages.saveChanges')
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function AdminDeleteConfirmModal({ isOpen, user, onClose, onConfirm, isDeleting = false }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const busy = confirming || isDeleting;

  useEffect(() => {
    if (!isOpen) {
      setConfirming(false);
      setSaveResult(null);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  async function handleConfirm() {
    if (busy) return;
    setConfirming(true);
    setSaveResult(null);
    try {
      await Promise.resolve(onConfirm());
      setSaveResult('ok');
      setTimeout(() => {
        setSaveResult(null);
        onClose();
      }, 1500);
    } catch (e) {
      setSaveResult('err');
      setTimeout(() => setSaveResult(null), 2000);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div
      className={ui.adminModalOverlay}
      onClick={() => {
        if (!busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <section
        className={`${ui.adminModalInvite} ${ui.adminModalInviteCompact} ${ui.adminModalInviteCompactNarrow}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={ui.adminCardHead}>
          <div>
            <h2 className={ui.adminUsersSectionTitle}>Delete User?</h2>
            <p className={ui.adminUsersSectionMeta}>This action cannot be undone.</p>
          </div>
          <button
            type="button"
            className={ui.adminModalClose}
            onClick={onClose}
            disabled={busy}
            aria-label="Close modal"
          >
            ×
          </button>
        </header>

        <div className={ui.adminUsersInviteFormModal}>
          <p className={ui.adminModalDeleteLead}>
            Are you sure you want to permanently delete <strong>{user.fullName}</strong> ({user.email})?
            They will lose all access to the workspace immediately.
          </p>

          <div className={ui.adminModalFoot}>
            <button type="button" className={ui.adminGhostBtn} onClick={onClose} disabled={busy}>
              Keep User
            </button>
            <button
              type="button"
              className={`${ui.checkoutSaveBtn} ${busy ? ui.checkoutSaveBtnSaving : ''} ${saveResult === 'ok' ? ui.checkoutSaveBtnSuccess : ''} ${saveResult === 'err' ? ui.checkoutSaveBtnError : ''}`}
              onClick={handleConfirm}
              disabled={busy || saveResult === 'ok'}
            >
              {busy ? (
                'Deleting...'
              ) : saveResult === 'ok' ? (
                'SUCCESSFULLY'
              ) : saveResult === 'err' ? (
                'FAILED'
              ) : (
                'Confirm Delete'
              )}
            </button>
          </div>
        </div>
      </section>
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
              <h3 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--ec-muted)', marginBottom: '0.5rem', fontWeight: 800 }}>Real-time Stock</h3>
              <div style={{ fontSize: '2.4rem', fontWeight: '900', color: isLow ? '#ef4444' : 'var(--ec-text)' }}>
                {item.quantity} <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--ec-muted)' }}>{item.unit || 'units'}</span>
              </div>
              <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', marginTop: '1.2rem', overflow: 'hidden' }}>
                <div style={{ width: `${levelPct}%`, height: '100%', background: isLow ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius: '5px' }} />
              </div>
            </section>
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--ec-muted)', margin: 0, fontWeight: 800 }}>Location</h4>
                <p style={{ margin: '0.25rem 0 0', fontWeight: '700' }}>{item.location || 'Main Warehouse'}</p>
              </div>
              <div>
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--ec-muted)', margin: 0, fontWeight: 800 }}>Thresholds</h4>
                <p style={{ margin: '0.25rem 0 0', fontWeight: '700' }}>{item.minThreshold} (min) / {item.maxThreshold} (max)</p>
              </div>
            </section>
          </div>
        </div>
        <div className={ui.modalActions}>
          <button type="button" className={ui.modalSecondaryBtn} onClick={onClose}>Close</button>
          <button type="button" className={ui.adminPrimaryBtn} style={{ padding: '0.6rem 1.2rem' }} onClick={() => {
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
