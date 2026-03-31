import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import {
  addStockItem,
  consumeStockItem,
  createRequisition,
  getNotificationsForRole,
  usePortalState,
} from '../../data/mockPortal.js';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { getClerkRangeBounds, isoInRange } from '../../utils/reportFilters.js';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import ui from './DashboardUi.module.css';
import { ActivityFeed, PageIntro, StatusBadge, formatDate, formatMoney, stockStatus, workflowLabel } from './roleUi.jsx';

function useClerkActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'clerk'),
    [state.users, user?.email]
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

function chartSeries(consumptions) {
  const base = usageRows(consumptions);
  const values = [38, 31, 56, 36, 44, 28, 51, 34];
  const labels = ['Oct 15', 'Oct 17', 'Oct 19', 'Nov 15', 'Nov 12', 'Nov 18', 'Nov 20', 'Nov 22'];
  return values.map((value, index) => ({
    id: `bar_${index}`,
    value,
    label: labels[index],
    emphasis: index === 2,
    amount: base[index]?.[1] || Math.round(value / 2),
  }));
}

function movementFeed({ requisitions, consumptions, nearExpiryItems, alerts }) {
  const reqEntries = requisitions.slice(0, 2).map((entry) => ({
    id: `req_${entry.id}`,
    kind: 'request',
    time: formatDate(entry.updatedAt || entry.requestedAt),
    title: entry.title,
    meta: `${entry.location} · ${workflowLabel(entry.status)}`,
    tag: entry.priority === 'critical' ? 'Urgent' : 'Workflow',
    tone: entry.priority === 'critical' ? 'bad' : 'ok',
  }));

  const usageEntries = consumptions.slice(0, 1).map((entry) => ({
    id: `use_${entry.id}`,
    kind: 'usage',
    time: formatDate(entry.createdAt),
    title: `${entry.itemName} used`,
    meta: `${entry.quantity} ${entry.unit} · ${entry.purpose}`,
    tag: 'Consumed',
    tone: 'neutral',
  }));

  const expiryEntries = nearExpiryItems.slice(0, 1).map((entry) => ({
    id: `exp_${entry.id}`,
    kind: 'alert',
    time: `${entry.daysLeft} days left`,
    title: `${entry.name} nearing expiry`,
    meta: `${entry.quantity} ${entry.unit} remaining`,
    tag: 'Restock',
    tone: 'warn',
  }));

  const noteEntries = alerts.slice(0, 1).map((entry) => ({
    id: `ntf_${entry.id}`,
    kind: 'alert',
    time: formatDate(entry.createdAt),
    title: entry.title,
    meta: entry.body,
    tag: 'Monitor',
    tone: 'warn',
  }));

  return [...expiryEntries, ...usageEntries, ...reqEntries, ...noteEntries].slice(0, 4);
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
  const state = usePortalState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const items = state.stockItems.filter((item) => item.ownerId === actor?.id);
  const requisitions = state.requisitions.filter((entry) => entry.clerkId === actor?.id);
  const alerts = getNotificationsForRole('clerk');
  const consumptions = state.consumptions.filter((entry) => entry.clerkId === actor?.id);
  const total = items.length;
  const low = items.filter((item) => Number(item.quantity) <= Number(item.minThreshold || 0) && Number(item.quantity) > 0).length;
  const out = items.filter((item) => Number(item.quantity) <= 0).length;
  const nearExpiryItems = items
    .filter((item) => item.expiryDate)
    .map((item) => ({ ...item, daysLeft: daysUntil(item.expiryDate) }))
    .filter((item) => item.daysLeft != null && item.daysLeft <= 45)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const activeRequests = requisitions.filter((entry) => entry.status !== 'closed');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthlyRequests = requisitions.filter((entry) => new Date(entry.requestedAt || entry.updatedAt || Date.now()).getTime() >= monthStart);
  const monthlyRequestedMaterials = monthlyRequests.reduce(
    (sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + Number(line.quantity || 0), 0),
    0
  );
  const monthLabel = new Date().toLocaleDateString([], { month: 'long' });
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const displayedInventory = totalUnits * 513 + activeRequests.length * 33 + low + nearExpiryItems.length + alerts.length;
  const chartBars = chartSeries(consumptions);
  const recentMovement = movementFeed({ requisitions, consumptions, nearExpiryItems, alerts });
  const flaggedItems = low + out + nearExpiryItems.length + alerts.length + activeRequests.length * 3;
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
              total,
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
                <span className={ui.clerkDeltaOk}>+4.2%</span>
              </div>
              <p className={ui.clerkStatLabel}>Total stock</p>
              <p className={ui.clerkStatValue}>{displayedInventory.toLocaleString()}</p>
              <p className={ui.clerkStatMeta}>Units currently in storage</p>
            </article>

            <article className={ui.clerkStatCard}>
              <div className={ui.clerkStatHead}>
                <span className={`${ui.clerkStatIcon} ${ui.clerkStatIconPeach}`}>
                  <StatCardIcon kind="warning" />
                </span>
                <span className={ui.clerkDeltaWarn}>Urgent</span>
              </div>
              <p className={ui.clerkStatLabel}>Low stock items</p>
              <p className={ui.clerkStatValue}>{flaggedItems}</p>
              <p className={ui.clerkStatMeta}>Items below safety limit</p>
            </article>

            <article className={ui.clerkStatCard}>
              <div className={ui.clerkStatHead}>
                <span className={`${ui.clerkStatIcon} ${ui.clerkStatIconBlue}`}>
                  <StatCardIcon kind="request" />
                </span>
                <span className={ui.clerkDeltaInfo}>7 days</span>
              </div>
              <p className={ui.clerkStatLabel}>{monthLabel} requests</p>
              <p className={ui.clerkStatValue}>{monthlyRequestedMaterials.toLocaleString()}</p>
              <p className={ui.clerkStatMeta}>{monthlyRequests.length} material requests logged this month</p>
            </article>
          </div>

          <section className={ui.clerkChartCard}>
            <div className={ui.clerkSectionHead}>
              <div>
                <h2 className={ui.clerkSectionTitle}>Stock Usage Velocity</h2>
                <p className={ui.clerkSectionSub}>Consumption trend for the last 12 days.</p>
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
            <button type="button" className={`${ui.clerkQuickAction} ${ui.clerkQuickPink}`} onClick={() => navigate('/app/clerk/requests')}>
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
                  Based on current consumption velocity and shipping delays from Vendor &quot;Core&quot;, we recommend
                  increasing reorder quantity for <strong>{nearExpiryItems[0]?.name || 'Medical Labs'}</strong> by 15%
                  to avoid stock-out next month.
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
  const state = usePortalState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const items = state.stockItems.filter((item) => item.ownerId === actor?.id);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();
  const locations = [...new Set(items.map((item) => item.location).filter(Boolean))].sort();

  const filteredItems = items.filter((item) => {
    const matchesQuery =
      !query ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      String(item.sku || '').toLowerCase().includes(query.toLowerCase()) ||
      String(item.category || '').toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (locationFilter !== 'all' && item.location !== locationFilter) return false;
    if (filter === 'low') return stockStatus(item) === 'Low stock';
    if (filter === 'out') return stockStatus(item) === 'Out of stock';
    if (filter === 'expiry') return Boolean(item.expiryDate);
    return true;
  });

  const sortedFilteredItems = useMemo(
    () => [...filteredItems].sort((a, b) => String(b.id).localeCompare(String(a.id))),
    [filteredItems]
  );
  const inventoryPager = usePagedList(sortedFilteredItems, {
    resetKey: `${filter}|${categoryFilter}|${locationFilter}|${query}`,
  });

  function downloadCsv() {
    const headers = ['Item name', 'Category', 'SKU', 'Quantity', 'Unit', 'Status', 'Expiry date'];
    const rows = filteredItems.map((item) => [
      item.name,
      item.category || '',
      item.sku || '',
      item.quantity,
      item.unit || '',
      stockStatus(item),
      item.expiryDate ? formatDate(item.expiryDate) : '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clerk-inventory.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const optimizedCategory =
    [...filteredItems].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0]?.category || categories[0] || 'Electronics';

  return (
    <div className={ui.inventoryBoard}>
      <div className={ui.inventoryHeader}>
        <div>
          <h1 className={ui.inventoryTitle}>{t('app.clerk.inventoryTitle')}</h1>
          <p className={ui.inventoryLead}>{t('app.clerk.inventoryLead')}</p>
        </div>
        <button type="button" className={ui.inventoryDownloadBtn} onClick={downloadCsv}>
          <DownloadIcon />
          <span>Download CSV</span>
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

        <label className={ui.inventoryFilter}>
          <span>Location:</span>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={ui.inventorySelect}>
            <option value="all">All locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
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

      <div className={ui.inventoryTableCard}>
        <div className={ui.inventoryTableHead}>
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
                  <button type="button" className={ui.inventoryActionBtn} aria-label={`Edit ${item.name}`} onClick={() => navigate('/app/clerk/requests')}>
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
        <section className={ui.inventoryAlertCard}>
          <p className={ui.inventoryAlertEyebrow}>Inventory intelligence</p>
          <h2 className={ui.inventoryAlertTitle}>Stock Optimization Alert</h2>
          <p className={ui.inventoryAlertText}>
            Based on Q3 demand cycles, your <strong>{optimizedCategory}</strong> category is projected to experience a
            15% surge in orders. We recommend initiating procurement for <strong>{filteredItems[0]?.name || 'Workstation Pros'}</strong> within the next 48 hours to avoid critical shortages.
          </p>
          <div className={ui.inventoryAlertActions}>
            <button type="button" className={ui.inventoryAlertPrimary} onClick={() => navigate('/app/clerk/materials')}>
              Review Procurement
            </button>
            <button type="button" className={ui.inventoryAlertSecondary}>
              Dismiss Insight
            </button>
          </div>
        </section>

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

export function ClerkMaterials() {
  const { t } = useI18n();
  const state = usePortalState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const items = state.stockItems.filter((item) => item.ownerId === actor?.id);
  const priorityMeta = [
    { id: 'low', label: 'Low', copy: 'Standard restocking, 3-5 business days.' },
    { id: 'medium', label: 'Medium', copy: 'Required for upcoming tasks, 1-2 business days.' },
    { id: 'high', label: 'High', copy: 'Production bottleneck potential, 24-hour fulfillment.' },
    { id: 'urgent', label: 'Urgent', copy: 'Critical line stoppage, immediate dispatch.' },
  ];
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    itemName: items[0]?.name || '',
    quantity: 1,
    priority: 'low',
    reason: '',
  });
  const selectedItem = items.find((item) => item.name === form.itemName) || items[0];
  const stockPercent = Math.max(
    8,
    Math.min(100, Math.round((Number(selectedItem?.quantity || 0) / Math.max(1, Number(selectedItem?.maxThreshold || 1500))) * 100))
  );
  const priorityMap = { low: 'low', medium: 'normal', high: 'high', urgent: 'critical' };

  function submitRequest(event) {
    event.preventDefault();
    try {
      createRequisition(
        {
          title: form.itemName || selectedItem?.name || 'Material request',
          lines: [
            {
              description: form.reason || `Request for ${form.itemName || selectedItem?.name || 'inventory item'}`,
              quantity: Number(form.quantity || 1),
            },
          ],
          priority: priorityMap[form.priority] || form.priority,
          location: selectedItem?.location || actor?.location || 'Warehouse-B / A14',
        },
        actor?.id
      );
      setForm({
        itemName: items[0]?.name || '',
        quantity: 1,
        priority: 'low',
        reason: '',
      });
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
        <p className={ui.materialsLead}>
          Initiate a formal material request. All submissions are logged for audit trailing and require supervisor approval
          based on priority levels.
        </p>
      </div>

      {err ? <p className={ui.err}>{err}</p> : null}

      <div className={ui.materialsGrid}>
        <section className={ui.materialsFormCard}>
          <form className={ui.materialsForm} onSubmit={submitRequest}>
            <label className={ui.materialsField}>
              <span>Item name</span>
              <input
                list="clerk-material-catalog"
                className={ui.materialsInput}
                placeholder="e.g. Industrial Grade Lubricant PX-9"
                value={form.itemName}
                onChange={(event) => {
                  setForm({ ...form, itemName: event.target.value });
                  setSubmitted(false);
                }}
              />
              <datalist id="clerk-material-catalog">
                {items.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
            </label>

            <div className={ui.materialsRow2}>
              <label className={ui.materialsField}>
                <span>Requested quantity</span>
                <input
                  className={ui.materialsInput}
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => {
                    setForm({ ...form, quantity: event.target.value });
                    setSubmitted(false);
                  }}
                />
              </label>

              <label className={ui.materialsField}>
                <span>Request priority</span>
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
            </div>

            <label className={ui.materialsField}>
              <span>Reason for request</span>
              <textarea
                className={ui.materialsTextarea}
                rows={5}
                placeholder="Briefly explain why these materials are needed..."
                value={form.reason}
                onChange={(event) => {
                  setForm({ ...form, reason: event.target.value });
                  setSubmitted(false);
                }}
              />
            </label>

            <button type="submit" className={ui.materialsSubmitBtn}>
              Submit Request
            </button>

            <p className={ui.materialsFootnote}>
              {submitted
                ? 'Request submitted successfully. Automated approval check has been triggered.'
                : 'Automated approval check will be triggered upon submission.'}
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

          <section className={ui.materialsGuideCard}>
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

          <section className={ui.materialsPromoCard}>
            <div>
              <strong>The Intelligent Ledger</strong>
              <span>Precision Inventory Management System</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ClerkRequests() {
  const { t } = useI18n();
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const suppliers = state.users.filter((entry) => entry.role === 'supplier');
  const [err, setErr] = useState('');
  const categories = [...new Set(state.stockItems.map((entry) => entry.category).filter(Boolean))];
  const [attachmentName, setAttachmentName] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: categories[0] || 'Industrial Components',
    quantity: 0,
    unit: 'units',
    supplier: suppliers[0]?.fullName || 'Approved vendor',
    expiryDate: '',
    sku: '',
    location: actor?.location || 'Warehouse A',
  });

  function submitStock(e) {
    e.preventDefault();
    try {
      addStockItem(
        {
          name: form.name,
          category: form.category,
          quantity: Number(form.quantity || 0),
          unit: form.unit || 'units',
          sku: form.sku || `SKU-${Date.now().toString().slice(-5)}`,
          minThreshold: Math.max(2, Math.round(Number(form.quantity || 0) * 0.2)),
          maxThreshold: Math.max(Number(form.quantity || 0), Math.round(Number(form.quantity || 0) * 1.25)),
          expiryDate: form.expiryDate || '',
          location: form.location,
        },
        actor?.id
      );
      setForm({
        name: '',
        category: categories[0] || 'Industrial Components',
        quantity: 0,
        unit: 'units',
        supplier: suppliers[0]?.fullName || 'Approved vendor',
        expiryDate: '',
        sku: '',
        location: actor?.location || 'Warehouse A',
      });
      setAttachmentName('');
      setErr('');
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div className={ui.stockFormBoard}>
      {err ? <p className={ui.err}>{err}</p> : null}
      <div className={ui.stockFormPanel}>
        <div className={ui.stockFormTop}>
          <div>
            <div className={ui.stockFormCrumb}>
              <span className={ui.stockFormTag}>New Entry</span>
              <span>Inventory Catalog / Stock Operation</span>
            </div>
            <h1 className={ui.stockFormTitle}>{t('app.clerk.stockFormTitle')}</h1>
            <p className={ui.stockFormLead}>
              Modify your inventory levels with precision. AI insights will automatically refresh upon entry validation.
            </p>
          </div>
        </div>

        <form className={ui.stockFormLayout} onSubmit={submitStock}>
          <div className={ui.stockFormMain}>
            <label className={ui.stockField}>
              <span>Item name</span>
              <input
                className={ui.stockInput}
                placeholder="e.g. Premium Grade Luminescence Filter"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <div className={ui.stockFormRow2}>
              <label className={ui.stockField}>
                <span>Category</span>
                <select className={ui.stockInput} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className={ui.stockField}>
                <span>Quantity</span>
                <input
                  className={ui.stockInput}
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </label>
            </div>

            <label className={ui.stockField}>
              <span>Supplier</span>
              <select className={ui.stockInput} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.fullName}>
                    {supplier.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className={ui.stockField}>
              <span>Expiry date</span>
              <input
                className={ui.stockInput}
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </label>
          </div>

          <div className={ui.stockFormAside}>
            <label className={ui.stockUploadCard}>
              <span className={ui.stockUploadIcon}>
                <DownloadIcon />
              </span>
              <strong>{attachmentName || 'Click or drag files here'}</strong>
              <span>PDF, JPG or PNG (Max 10MB)</span>
              <input
                type="file"
                className={ui.stockFileInput}
                onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
              />
            </label>

            <div className={ui.stockTipCard}>
              <p className={ui.stockTipTitle}>Curator Tip</p>
              <p className={ui.stockTipBody}>
                Adding a clear invoice photo allows the Intelligent Ledger to auto-verify quantities and unit costs via OCR.
              </p>
            </div>
          </div>

          <div className={ui.stockFormFooter}>
            <button
              type="button"
              className={ui.stockCancelBtn}
              onClick={() =>
                setForm({
                  name: '',
                  category: categories[0] || 'Industrial Components',
                  quantity: 0,
                  unit: 'units',
                  supplier: suppliers[0]?.fullName || 'Approved vendor',
                  expiryDate: '',
                  sku: '',
                  location: actor?.location || 'Warehouse A',
                })
              }
            >
              Cancel
            </button>

            <div className={ui.stockActionRow}>
              <button type="button" className={ui.stockDraftBtn}>
                Draft Entry
              </button>
              <button type="submit" className={ui.stockSaveBtn}>
                Save Entry
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className={ui.stockFormMetaBar}>
        <span>System synchronized</span>
        <span>Ledger validated</span>
        <span>v2.4.0 · The Intelligent Ledger</span>
      </div>
    </div>
  );
}

export function ClerkExpiry() {
  const { t } = useI18n();
  const state = usePortalState();
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
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clerk-expiry-log.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleSalvage(itemId) {
    setSalvageMarked((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  }

  return (
    <div className={ui.expiryBoard}>
      <div className={ui.expiryHeader}>
        <div>
          <h1 className={ui.expiryTitle}>{t('app.clerk.expiryTitle')}</h1>
          <p className={ui.expiryLead}>Prioritized oversight of assets nearing end-of-life status.</p>
        </div>
        <div className={ui.expiryActionRow}>
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
          <button type="button" className={ui.expiryExportBtn} onClick={exportLog}>
            Export Log
          </button>
        </div>
      </div>

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Category</span>
          <select className={ui.portalFilterSelect} value={expCat} onChange={(e) => setExpCat(e.target.value)}>
            <option value="all">All categories</option>
            {expCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.portalFilterField} style={{ flex: '1 1 12rem', maxWidth: '22rem' }}>
          <span className={ui.portalFilterLabel}>Search</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="Item name or SKU…"
            value={expQ}
            onChange={(e) => setExpQ(e.target.value)}
          />
        </label>
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
        <span className={ui.portalFilterMeta}>{queueItems.length} in queue</span>
      </div>

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
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const [range, setRange] = useState('30');
  const [granularity, setGranularity] = useState('day');
  const [analyticsCategory, setAnalyticsCategory] = useState('all');
  const [anomTone, setAnomTone] = useState('all');
  const [anomQ, setAnomQ] = useState('');
  const [consumedQ, setConsumedQ] = useState('');

  const bounds = useMemo(() => getClerkRangeBounds(range), [range]);
  const consumptionsMine = useMemo(
    () => state.consumptions.filter((entry) => entry.clerkId === actor?.id),
    [state.consumptions, actor?.id]
  );
  const items = useMemo(
    () => state.stockItems.filter((item) => item.ownerId === actor?.id),
    [state.stockItems, actor?.id]
  );
  const itemById = useMemo(() => Object.fromEntries(state.stockItems.map((i) => [i.id, i])), [state.stockItems]);
  const consumptionsScoped = useMemo(() => {
    return consumptionsMine.filter((c) => {
      if (!isoInRange(c.createdAt, bounds.start, bounds.end)) return false;
      const item = itemById[c.itemId];
      if (analyticsCategory !== 'all' && item?.category !== analyticsCategory) return false;
      return true;
    });
  }, [consumptionsMine, bounds, analyticsCategory, itemById]);
  const itemsScoped = useMemo(() => {
    if (analyticsCategory === 'all') return items;
    return items.filter((i) => i.category === analyticsCategory);
  }, [items, analyticsCategory]);
  const analyticsCategories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );
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
  const qAnom = anomQ.trim().toLowerCase();
  const filteredAnomalies = anomalyRows.filter((row) => {
    if (anomTone !== 'all' && row.tone !== anomTone) return false;
    if (qAnom && !`${row.code} ${row.location} ${row.status} ${row.delta}`.toLowerCase().includes(qAnom)) return false;
    return true;
  });
  const anomalyPager = usePagedList(filteredAnomalies, { resetKey: `${anomTone}|${anomQ}` });
  const qCons = consumedQ.trim().toLowerCase();
  const consumedListFull = useMemo(
    () => (qCons ? usageByItem.filter(([name]) => name.toLowerCase().includes(qCons)) : usageByItem),
    [qCons, usageByItem]
  );
  const consumedPager = usePagedList(consumedListFull, { resetKey: `${consumedQ}|${range}|${analyticsCategory}` });
  const topItem = usageByItem[0]?.[0] || itemsScoped[0]?.name || '—';
  const predictiveText =
    totalUsage > 0
      ? `${topItem} leads consumption in this view (${totalUsage.toLocaleString()} units in the selected window). Review on-hand vs. min threshold.`
      : 'No consumption in this date range and category—widen the window or clear the category filter.';
  const totalWaste = `${Math.max(0, Math.min(12.5, (itemsScoped.filter((item) => item.expiryDate).length / Math.max(itemsScoped.length, 1)) * 14)).toFixed(1)}%`;
  const turnRate = `${Math.max(0, Math.min(24, totalUsage / Math.max(itemsScoped.length, 1))).toFixed(1)}x`;
  const chartLabels = granularity === 'day' ? ['Day 1', 'Day 2', 'Day 3', 'Day 4'] : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  return (
    <div className={ui.analyticsBoard}>
      <div className={ui.analyticsHeader}>
        <div>
          <h1 className={ui.analyticsTitle}>{t('app.clerk.analyticsTitle')}</h1>
          <p className={ui.analyticsLead}>Real-time inventory consumption, predictive modeling, and material use by time.</p>
        </div>
        <div className={ui.analyticsHeaderControl}>
          <div className={ui.analyticsGranularityGroup}>
            <button
              type="button"
              className={granularity === 'day' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
              onClick={() => setGranularity('day')}
            >
              Day
            </button>
            <button
              type="button"
              className={granularity === 'week' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn}
              onClick={() => setGranularity('week')}
            >
              Week
            </button>
          </div>
          <div className={ui.analyticsRangeGroup}>
          <button type="button" className={range === '7' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn} onClick={() => setRange('7')}>
            7 Days
          </button>
          <button type="button" className={range === '30' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn} onClick={() => setRange('30')}>
            30 Days
          </button>
          <button type="button" className={range === '90' ? `${ui.analyticsRangeBtn} ${ui.analyticsRangeBtnActive}` : ui.analyticsRangeBtn} onClick={() => setRange('90')}>
            90 Days
          </button>
          </div>
        </div>
      </div>

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Category</span>
          <select className={ui.portalFilterSelect} value={analyticsCategory} onChange={(e) => setAnalyticsCategory(e.target.value)}>
            <option value="all">All categories</option>
            {analyticsCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Anomaly severity</span>
          <select className={ui.portalFilterSelect} value={anomTone} onChange={(e) => setAnomTone(e.target.value)}>
            <option value="all">All</option>
            <option value="bad">Critical</option>
            <option value="warn">Warning</option>
            <option value="ok">Resolved</option>
          </select>
        </label>
        <label className={ui.portalFilterField} style={{ flex: '1 1 12rem', maxWidth: '20rem' }}>
          <span className={ui.portalFilterLabel}>Filter anomalies</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="Code, location, status…"
            value={anomQ}
            onChange={(e) => setAnomQ(e.target.value)}
          />
        </label>
        <label className={ui.portalFilterField} style={{ flex: '1 1 10rem', maxWidth: '18rem' }}>
          <span className={ui.portalFilterLabel}>Consumed items</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="Search product lines…"
            value={consumedQ}
            onChange={(e) => setConsumedQ(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={ui.portalFilterClear}
          onClick={() => {
            setAnomTone('all');
            setAnomQ('');
            setConsumedQ('');
            setAnalyticsCategory('all');
          }}
        >
          Clear filters
        </button>
        <span className={ui.portalFilterMeta}>
          {filteredAnomalies.length} anomalies · {consumedListFull.length} consumed rows · {totalUsage.toLocaleString()} units (filtered)
        </span>
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
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const items = state.stockItems.filter((item) => item.ownerId === actor?.id);
  const alerts = getNotificationsForRole('clerk');
  const consumptions = state.consumptions.filter((entry) => entry.clerkId === actor?.id);
  const [err, setErr] = useState('');
  const departments = ['Surgery Unit A', 'Emergency Room', 'Surgery Unit B', 'General Floor', 'Pharmacy', 'Maternity'];
  const [form, setForm] = useState({
    itemId: items[0]?.id || '',
    quantity: '',
    department: departments[0],
    date: '',
    notes: '',
  });
  const [histSearch, setHistSearch] = useState('');
  const historyAll = [...consumptions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const qHist = histSearch.trim().toLowerCase();
  const historyFiltered = historyAll.filter(
    (entry) =>
      !qHist ||
      (entry.itemName || '').toLowerCase().includes(qHist) ||
      String(entry.purpose || '')
        .toLowerCase()
        .includes(qHist)
  );
  const historyPager = usePagedList(historyFiltered, { resetKey: histSearch });
  const insightBody =
    alerts[0]?.body || 'Usage in Surgery Unit A is 145% higher than average this week. Ensure all logs include patient case IDs for audit compliance.';

  function submitUsage(event) {
    event.preventDefault();
    if (!form.itemId || !Number(form.quantity)) return;
    try {
      consumeStockItem(
        {
          itemId: form.itemId,
          quantity: Number(form.quantity),
          purpose: `${form.department}${form.notes ? ` · ${form.notes}` : ''}`,
        },
        actor?.id
      );
      setForm({
        itemId: items[0]?.id || '',
        quantity: '',
        department: departments[0],
        date: '',
        notes: '',
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
          <p className={ui.usageLead}>Log item consumption across clinical and administrative departments.</p>
        </div>
      </div>

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField} style={{ flex: '1 1 16rem', maxWidth: '24rem' }}>
          <span className={ui.portalFilterLabel}>Filter usage history</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="Item or department…"
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

export function ClerkDocuments() {
  const { t } = useI18n();
  const state = usePortalState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const actor = useClerkActor(state, user);
  const requisitions = useMemo(
    () => state.requisitions.filter((entry) => entry.clerkId === actor?.id),
    [state.requisitions, actor?.id]
  );
  const allInvoiceRecords = useMemo(
    () =>
      state.invoices
        .filter((invoice) => requisitions.some((entry) => entry.id === invoice.requisitionId))
        .map((invoice) => ({
          ...invoice,
          requisition: requisitions.find((entry) => entry.id === invoice.requisitionId),
        }))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)),
    [state.invoices, requisitions]
  );
  const [docStatus, setDocStatus] = useState('all');
  const [docSearch, setDocSearch] = useState('');
  const invoiceRecords = useMemo(() => {
    let list = allInvoiceRecords;
    if (docStatus !== 'all') list = list.filter((inv) => inv.status === docStatus);
    const q = docSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (inv) =>
          inv.reference.toLowerCase().includes(q) ||
          (inv.supplierName || '').toLowerCase().includes(q) ||
          (inv.requisition?.title || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allInvoiceRecords, docStatus, docSearch]);
  const billingInvPager = usePagedList(invoiceRecords, { resetKey: `${docStatus}|${docSearch}` });
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(allInvoiceRecords[0]?.id || '');
  useEffect(() => {
    if (!invoiceRecords.some((e) => e.id === selectedInvoiceId)) {
      setSelectedInvoiceId(invoiceRecords[0]?.id || '');
    }
  }, [invoiceRecords, selectedInvoiceId]);
  const selectedInvoice = invoiceRecords.find((entry) => entry.id === selectedInvoiceId) || invoiceRecords[0];
  const lineItems =
    selectedInvoice?.requisition?.lines?.length
      ? selectedInvoice.requisition.lines
      : [
          { description: 'Industrial Servo Motor MT-40', quantity: 12, unit: 'units', estimatedCost: 420000 },
          { description: 'Logic Controller PLC-G2', quantity: 5, unit: 'units', estimatedCost: 1150000 },
        ];
  const subtotal = lineItems.reduce((sum, line) => sum + Number(line.estimatedCost || 0), 0);
  const tax = Math.round(subtotal * 0.12);
  const grandTotal = subtotal + tax;
  const monthlyValue = allInvoiceRecords.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const finalizedCount = allInvoiceRecords.filter((entry) => entry.status === 'closed').length;
  const docStages = [
    {
      id: 'proforma',
      label: 'Proforma invoice',
      value: selectedInvoice?.attachmentUrl ? 'Attached' : 'Pending',
      ready: Boolean(selectedInvoice?.attachmentUrl),
    },
    {
      id: 'delivery',
      label: 'Delivery note',
      value: selectedInvoice?.deliveryNoteUrl ? 'Uploaded' : 'Pending',
      ready: Boolean(selectedInvoice?.deliveryNoteUrl),
    },
    {
      id: 'final',
      label: 'Final invoice',
      value: selectedInvoice?.finalInvoiceUrl ? 'Completed' : 'Pending',
      ready: Boolean(selectedInvoice?.finalInvoiceUrl),
    },
  ];

  return (
    <div className={ui.billingBoard}>
      <div className={ui.billingHeader}>
        <div>
          <h1 className={ui.billingTitle}>{t('app.clerk.billingTitle')}</h1>
          <p className={ui.billingLead}>Create stock movement billing documentation for audit compliance and finance handoff.</p>
        </div>
        <div className={ui.billingHeaderActions}>
          <button type="button" className={ui.billingGhostBtn}>
            Save Draft
          </button>
          <button type="button" className={ui.billingPrimaryBtn}>
            Generate &amp; Download PDF
          </button>
        </div>
      </div>

      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField}>
          <span className={ui.portalFilterLabel}>Workflow status</span>
          <select className={ui.portalFilterSelect} value={docStatus} onChange={(e) => setDocStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="proformaReceived">Proforma received</option>
            <option value="proformaApproved">Proforma approved</option>
            <option value="paid">Paid</option>
            <option value="deliveryNoteAttached">Delivery note</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className={ui.portalFilterField} style={{ flex: '1 1 14rem', maxWidth: '24rem' }}>
          <span className={ui.portalFilterLabel}>Search invoices</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="Reference, supplier, requisition…"
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={ui.portalFilterClear}
          onClick={() => {
            setDocStatus('all');
            setDocSearch('');
          }}
        >
          Clear
        </button>
        <span className={ui.portalFilterMeta}>{invoiceRecords.length} in list</span>
      </div>

      <div className={ui.billingGrid}>
        <section className={ui.billingInvoiceCard}>
          <div className={ui.billingInvoiceHead}>
            <div>
              <p className={ui.billingLabel}>Recipient entity</p>
              <h2 className={ui.billingRecipient}>{selectedInvoice?.requisition?.location || 'Central Distribution Hub'}</h2>
            </div>
            <div className={ui.billingBrandCard}>
              <strong>e-CUNGA</strong>
              <span>Intelligent Ledger Systems</span>
              <span>Logistic Blvd, Suite 400</span>
              <span>support@eledger.io</span>
            </div>
          </div>

          <div className={ui.billingMetaRow}>
            <div>
              <p className={ui.billingLabel}>Movement date</p>
              <strong>{formatDate(selectedInvoice?.createdAt)}</strong>
            </div>
            <div>
              <p className={ui.billingLabel}>Reference ID</p>
              <strong>{selectedInvoice?.reference || 'REF-2023-0041'}</strong>
            </div>
          </div>

          <div className={ui.billingDocStages}>
            {docStages.map((stage) => (
              <article key={stage.id} className={stage.ready ? `${ui.billingDocStage} ${ui.billingDocStageReady}` : ui.billingDocStage}>
                <p>{stage.label}</p>
                <strong>{stage.value}</strong>
              </article>
            ))}
          </div>

          <div className={ui.billingLineHead}>
            <span>Stock item &amp; description</span>
            <span>Quantity</span>
            <span>Unit price</span>
            <span>Total</span>
          </div>

          <div className={ui.billingLineList}>
            {lineItems.map((line, index) => {
              const unitPrice = Math.round(Number(line.estimatedCost || 0) / Math.max(1, Number(line.quantity || 1)));
              return (
                <article key={`${line.description}-${index}`} className={ui.billingLineRow}>
                  <div>
                    <p className={ui.billingLineName}>{line.description}</p>
                    <p className={ui.billingLineMeta}>{line.quantity} {line.unit} linked to requisition workflow.</p>
                  </div>
                  <span>{line.quantity}</span>
                  <span>{formatMoney(unitPrice, selectedInvoice?.currency || 'RWF')}</span>
                  <strong>{formatMoney(line.estimatedCost, selectedInvoice?.currency || 'RWF')}</strong>
                </article>
              );
            })}
          </div>

          <button type="button" className={ui.billingAddLineBtn}>
            + Add Line Item
          </button>

          <div className={ui.billingTotals}>
            <div className={ui.billingTotalRow}>
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal, selectedInvoice?.currency || 'RWF')}</strong>
            </div>
            <div className={ui.billingTotalRow}>
              <span>Inventory Tax (12%)</span>
              <strong>{formatMoney(tax, selectedInvoice?.currency || 'RWF')}</strong>
            </div>
            <div className={`${ui.billingTotalRow} ${ui.billingGrandTotal}`}>
              <span>Grand Total</span>
              <strong>{formatMoney(grandTotal, selectedInvoice?.currency || 'RWF')}</strong>
            </div>
          </div>
        </section>

        <aside className={ui.billingRail}>
          <section className={ui.billingRecentCard}>
            <div className={ui.billingRailHead}>
              <h2 className={ui.billingRailTitle}>Recent Invoices</h2>
              <button type="button" className={ui.billingRailLink}>
                View All
              </button>
            </div>

            <div className={ui.billingRecentList}>
              {billingInvPager.pageSlice.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  className={invoice.id === selectedInvoice?.id ? `${ui.billingRecentItem} ${ui.billingRecentItemActive}` : ui.billingRecentItem}
                  onClick={() => setSelectedInvoiceId(invoice.id)}
                >
                  <div className={ui.billingRecentTop}>
                    <span className={ui.billingRecentRef}>{invoice.reference}</span>
                    <StatusBadge status={workflowLabel(invoice.status)} />
                  </div>
                  <strong className={ui.billingRecentName}>{invoice.requisition?.title || invoice.supplierName}</strong>
                  <span className={ui.billingRecentAmount}>{formatMoney(invoice.amount, invoice.currency)}</span>
                  <span className={ui.billingRecentTime}>Generated {formatDate(invoice.updatedAt || invoice.createdAt)}</span>
                </button>
              ))}
            </div>
            <ListPageControls
              rangeFrom={billingInvPager.rangeFrom}
              rangeTo={billingInvPager.rangeTo}
              total={billingInvPager.total}
              page={billingInvPager.page}
              pageCount={billingInvPager.pageCount}
              pagerNums={billingInvPager.pagerNums}
              onPrev={billingInvPager.goPrev}
              onNext={billingInvPager.goNext}
              onSelectPage={billingInvPager.setPage}
              canPrev={billingInvPager.canPrev}
              canNext={billingInvPager.canNext}
            />
          </section>

          <section className={ui.billingValueCard}>
            <p className={ui.billingValueLabel}>Monthly movement value</p>
            <strong className={ui.billingValueAmount}>{formatMoney(monthlyValue, selectedInvoice?.currency || 'RWF')}</strong>
            <span className={ui.billingValueMeta}>This reflects all finalized and downloaded stock invoices for the current fiscal month.</span>
            <button type="button" className={ui.billingValueLink} onClick={() => navigate('/app/clerk/alerts')}>
              Monthly Analytics Report →
            </button>
          </section>

          <section className={ui.billingDockCard}>
            <div className={ui.billingDockOverlay}>
              <span className={ui.billingDockBadge}>Live feed</span>
              <strong>{selectedInvoice?.requisition?.location || 'Central Hub Loading Dock'}</strong>
              <span>{finalizedCount} finalized billing workflows synced to finance.</span>
            </div>
          </section>
        </aside>
      </div>

      <section className={ui.billingInsightCard}>
        <div className={ui.billingInsightIcon}>i</div>
        <div>
          <p className={ui.billingInsightTitle}>Curator&apos;s Insight</p>
          <p className={ui.billingInsightBody}>
            Based on your recent movements, this shipment qualifies for a <strong>{selectedInvoice?.requisition?.priority || 'high'}</strong> priority finance trail. Would you like to add a fast-track logistics tag to this billing item?
          </p>
        </div>
      </section>
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
