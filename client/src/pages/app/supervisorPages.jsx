import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useShellSearchQuery } from '../../hooks/useShellSearchQuery.js';
import { getPeriodBounds, isoInRange } from '../../utils/reportFilters.js';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import ui from './DashboardUi.module.css';
import { StatusBadge, formatDate, formatMoney, stockStatus, workflowLabel } from './roleUi.jsx';

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
  const { t } = useI18n();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const requests = state.requisitions;
  const clerkUsers = state.users.filter((entry) => entry.role === 'clerk' && entry.isActive);
  const allItems = state.stockItems;
  const allConsumptions = state.consumptions;
  const weeklyConsumptions = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return allConsumptions.filter((c) => new Date(c.createdAt).getTime() >= cutoff);
  }, [allConsumptions]);
  const totalStockUnits = allItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const submitted = requests.filter((entry) => entry.status === 'submitted').length;
  const lowStock = allItems.filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0)).length;
  const latestUsed = usageByClerk(weeklyConsumptions, state.users).slice(0, 10);
  const topUsed = usageTotalsWithUnit(weeklyConsumptions).slice(0, 10);
  const invoices = [...state.invoices].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const unitPriceMap = requests.reduce((map, req) => {
    req.lines.forEach((line) => {
      if (!map.has(line.description) && Number(line.quantity || 0) > 0) {
        map.set(line.description, Number(line.estimatedCost || 0) / Number(line.quantity || 1));
      }
    });
    return map;
  }, new Map());
  const inventoryValue = allItems.reduce((sum, item) => {
    const unitPrice = unitPriceMap.get(item.name) || 18000;
    return sum + Number(item.quantity || 0) * unitPrice;
  }, 0);
  const inventoryMeasures = [...new Set(allItems.map((item) => item.unit).filter(Boolean))].slice(0, 4).join(', ');
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
  const clerkSummaries = clerkUsers.map((clerk) => {
    const items = allItems.filter((item) => item.ownerId === clerk.id);
    const usage = usageByClerk(allConsumptions, state.users).filter((entry) => entry.clerkId === clerk.id);
    const requisitions = requests.filter((entry) => entry.clerkId === clerk.id);
    const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const measures = [...new Set(items.map((item) => item.unit).filter(Boolean))].slice(0, 3).join(', ');
    return {
      clerk,
      items: items.length,
      totalUnits,
      measures,
      lowStock: items.filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0)).length,
      pending: requisitions.filter((entry) => entry.status === 'submitted').length,
      latestUsage: usage[0],
    };
  });

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
          <h1 className={ui.supervisorDashTitle}>{t('app.supervisor.dashTitle')}</h1>
          <p className={ui.supervisorDashLead}>
            Monitor stock health, clerk workspaces, accountant documents, and weekly consumption from one oversight board.
          </p>
        </div>
        <button type="button" className={ui.supervisorReportBtn} onClick={downloadMonthlyReport}>
          Download Monthly Report
        </button>
      </div>

      <div className={ui.supervisorSummaryGrid}>
        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Inventory value (est.)</p>
            <span className={ui.supervisorSummaryNeutral}>{allItems.length} SKUs</span>
          </div>
          <p className={ui.supervisorSummaryValue}>{formatMoney(inventoryValue, 'RWF')}</p>
          <p className={ui.supervisorSummaryMeta}>
            {totalStockUnits} total qty across measures: {inventoryMeasures || 'units'} (from requisition line pricing where available).
          </p>
        </article>

        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Low stock alerts</p>
            <span className={ui.supervisorSummaryIcon}>!</span>
          </div>
          <p className={ui.supervisorSummaryValue}>{lowStock}</p>
          <p className={ui.supervisorSummaryMeta}>Items below minimum threshold and needing action.</p>
        </article>

        <article className={ui.supervisorSummaryCard}>
          <div className={ui.supervisorSummaryHead}>
            <p className={ui.supervisorSummaryLabel}>Pending approvals</p>
            <span className={ui.supervisorSummaryIcon}>[]</span>
          </div>
          <p className={ui.supervisorSummaryValue}>{submitted}</p>
          <p className={ui.supervisorSummaryMeta}>Inventory requests awaiting supervisor review.</p>
        </article>
      </div>

      <div className={ui.supervisorMainGrid}>
        <section className={ui.supervisorUsageCard}>
          <div className={ui.supervisorSectionHead}>
            <div>
              <h2 className={ui.supervisorSectionTitle}>Weekly Top 10 Most Used Items</h2>
              <p className={ui.supervisorSectionMeta}>Rolling last 7 days — quantities by item and unit.</p>
            </div>
            <button type="button" className={ui.supervisorTextBtn} onClick={() => navigate('/app/supervisor/reports')}>
              Detailed Stats -&gt;
            </button>
          </div>

          <div className={ui.supervisorUsageList}>
            {topUsed.map((entry, index) => (
              <article key={entry.name} className={ui.supervisorUsageRow}>
                <div className={ui.supervisorUsageTop}>
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.quantity} {entry.unit}
                  </span>
                </div>
                <div className={ui.supervisorUsageTrack}>
                  <div
                    className={index % 2 === 0 ? ui.supervisorUsageFill : `${ui.supervisorUsageFill} ${ui.supervisorUsageFillBlue}`}
                    style={{ width: `${Math.min(100, 22 + entry.quantity * 7)}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className={ui.supervisorSideStack}>
          <section className={ui.supervisorActivityCard}>
            <h2 className={ui.supervisorSectionTitle}>Weekly Latest Used Items</h2>
            <p className={ui.supervisorSectionMeta} style={{ margin: '0 0 0.75rem' }}>
              Most recent consumption events in the last 7 days.
            </p>
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
                  <span className={ui.supervisorFinanceAmount}>{formatMoney(invoice.amount, invoice.currency)}</span>
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

      <section className={ui.supervisorClerkCard}>
        <div className={ui.supervisorSectionHead}>
          <div>
            <h2 className={ui.supervisorSectionTitle}>Inventory Clerk Dashboard Access</h2>
            <p className={ui.supervisorSectionMeta}>Summary of each clerk workspace, stock volume, and pending pressure.</p>
          </div>
        </div>
        <div className={ui.supervisorClerkGrid}>
          {clerkSummaries.map((entry) => (
            <article key={entry.clerk.id} className={ui.supervisorClerkSummary}>
              <div className={ui.supervisorClerkTop}>
                <div>
                  <p className={ui.supervisorClerkName}>{entry.clerk.fullName}</p>
                  <p className={ui.supervisorClerkMeta}>
                    {entry.clerk.team ? `${entry.clerk.team} · ` : ''}
                    {entry.clerk.location} · {entry.items} items · {entry.totalUnits} total units
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" className={ui.supervisorTextBtn} onClick={() => downloadClerkMonthlyReport(entry.clerk)}>
                    Excel report
                  </button>
                  <button type="button" className={ui.supervisorTextBtn} onClick={() => navigate('/app/supervisor/visibility')}>
                    Open
                  </button>
                </div>
              </div>
              <div className={ui.supervisorMeasureRow}>
                <span>Measures: {entry.measures || 'units'}</span>
                <span>{entry.lowStock} low stock</span>
                <span>{entry.pending} pending approvals</span>
              </div>
              <p className={ui.supervisorClerkMeta}>
                Latest used item: {entry.latestUsage ? `${entry.latestUsage.itemName} · ${entry.latestUsage.quantity} ${entry.latestUsage.unit}` : 'No recent usage log'}
              </p>
            </article>
          ))}
        </div>
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
          <p className={ui.supervisorInventoryLead}>
            Managing {totalAssetUnits.toLocaleString()} total quantity across {totalLocations} warehouse locations.
            {unitMixSummary ? (
              <>
                {' '}
                <span className={ui.muted}>Unit mix: {unitMixSummary}.</span>
              </>
            ) : null}
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
        <label className={ui.supervisorInventoryFilter} style={{ minWidth: '11rem', flex: '1 1 10rem' }}>
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

        <button type="button" className={ui.supervisorInventoryClear} onClick={clearFilters}>
          Clear Filters
        </button>
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
            const fillClass =
              item.status === 'Out of stock'
                ? `${ui.inventoryLevelFill} ${ui.inventoryLevelFillBad}`
                : item.status === 'Low stock'
                  ? `${ui.inventoryLevelFill} ${ui.inventoryLevelFillWarn}`
                  : ui.inventoryLevelFill;

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
                <div className={ui.inventoryLevelCell}>
                  <div className={ui.inventoryLevelNumbers}>
                    <strong>
                      {item.quantity} {item.unit || ''}
                    </strong>
                    <span>
                      min {item.minThreshold} · max {item.maxThreshold} {item.unit || ''} · {Math.round(levelPct)}%
                    </span>
                  </div>
                  <div className={ui.inventoryLevelTrack}>
                    <div className={fillClass} style={{ width: `${levelPct}%` }} />
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
        <button
          type="button"
          className={ui.portalFilterClear}
          onClick={() => {
            setLocFilter('all');
            setReqSearch('');
          }}
        >
          Clear
        </button>
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
  const trendPoints = trendValues.map((value, index) => `${index * 88},${130 - Math.round((value / maxTrend) * 92)}`).join(' ');
  const categoryGroups = stockForReport.reduce((map, item) => {
    map.set(item.category, (map.get(item.category) || 0) + 1);
    return map;
  }, new Map());
  let categorySplit = [...categoryGroups.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  if (categorySplit.length === 0) {
    categorySplit = [{ label: 'No items match filters', count: 1 }];
  }
  const splitTotal = categorySplit.reduce((sum, entry) => sum + entry.count, 0) || 1;
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
          <p className={ui.supervisorReportLead}>Real-time curriculum and inventory data synthesis.</p>
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
            placeholder="Item name, SKU, category…"
            value={repSearch}
            onChange={(e) => setRepSearch(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={ui.portalFilterClear}
          onClick={() => {
            setRepCategory('all');
            setRepWarehouse('all');
            setRepSearch('');
            setRepReqStatus('all');
            setRepStockStatus('all');
          }}
        >
          Clear filters
        </button>
        <span className={ui.portalFilterMeta}>
          {stockForReport.length} SKUs · {reqsForReport.length} requisitions · {invoicesScoped.length} invoices (period)
        </span>
      </div>

      <div className={ui.supervisorReportGrid}>
        <section className={ui.supervisorReportTrendCard}>
          <div className={ui.supervisorReportCardHead}>
            <div>
              <h2 className={ui.supervisorReportCardTitle}>Invoice totals (6 months)</h2>
              <p className={ui.supervisorReportCardMeta}>
                Sum of invoice amounts by calendar month (company-wide). Filters below affect the headline value and tables, not this chart.
              </p>
            </div>
            <div className={ui.supervisorReportValueBlock}>
              <strong>{formatMoney(currentValue, 'RWF')}</strong>
              <span>
                {monthlyFlux >= 0 ? '+' : ''}
                {monthlyFlux.toFixed(1)}% trend
              </span>
            </div>
          </div>

          <svg viewBox="0 0 440 150" className={ui.supervisorReportTrendSvg} aria-hidden>
            <polyline fill="none" stroke="currentColor" strokeWidth="2" points={trendPoints} />
            <polygon fill="rgb(105 39 81 / 0.08)" points={`0,150 ${trendPoints} 440,150`} />
          </svg>
          <div className={ui.supervisorReportMonthRow}>
            {trendMonths.map((month, idx) => (
              <span key={`${month}-${idx}`}>{month}</span>
            ))}
          </div>
        </section>

        <section className={ui.supervisorReportCategoryCard}>
          <h2 className={ui.supervisorReportCardTitle}>Category Split</h2>
          <p className={ui.supervisorReportCardMeta}>Distribution by department</p>
          <div className={ui.supervisorReportRingWrap}>
            <div className={ui.supervisorReportRing}>
              <span>{categorySplit.length}</span>
              <small>groups</small>
            </div>
          </div>
          <div className={ui.supervisorReportLegend}>
            {categorySplit.map((entry, index) => (
              <div key={entry.label} className={ui.supervisorReportLegendRow}>
                <span className={index === 0 ? ui.supervisorReportDotPrimary : index === 1 ? ui.supervisorReportDotBlue : ui.supervisorReportDotSoft} />
                <span>{entry.label}</span>
                <strong>{Math.round((entry.count / splitTotal) * 100)}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={ui.supervisorReportWasteCard}>
          <div className={ui.supervisorReportCardHead}>
            <div>
              <h2 className={ui.supervisorReportCardTitle}>Waste/Loss Analytics</h2>
              <p className={ui.supervisorReportCardMeta}>Impact analysis of damaged or expired stock</p>
            </div>
            <button type="button" className={ui.supervisorReportDetailBtn} onClick={() => navigate('/app/supervisor/monitoring')}>
              Details -&gt;
            </button>
          </div>
          <div className={ui.supervisorReportWasteBars}>
            {wasteRows.map((entry) => (
              <div key={entry.label} className={ui.supervisorReportWasteCol}>
                <div className={ui.supervisorReportWasteTrack}>
                  <div className={ui.supervisorReportWasteFill} style={{ height: `${Math.max(14, (entry.value / maxWaste) * 100)}%` }} />
                </div>
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className={ui.supervisorReportExportCard}>
          <h2 className={ui.supervisorReportExportTitle}>Export Ledger</h2>
          <p className={ui.supervisorReportExportMeta}>Distribute high-fidelity audit reports.</p>
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
