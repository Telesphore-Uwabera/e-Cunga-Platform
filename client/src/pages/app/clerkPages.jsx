import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  addStockItem,
  consumeStockItem,
  createRequisition,
  getMessagesForRole,
  getNotificationsForRole,
  usePortalState,
} from '../../data/mockPortal.js';
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

function usageRows(consumptions) {
  const grouped = consumptions.reduce((map, entry) => {
    map.set(entry.itemName, (map.get(entry.itemName) || 0) + Number(entry.quantity || 0));
    return map;
  }, new Map());
  return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

export function ClerkDashboard() {
  const state = usePortalState();
  const { user } = useAuth();
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
  const bars = [34, 48, 41, 58, 62, 54, 69, 64];

  return (
    <>
      <PageIntro
        eyebrow="Inventory clerk"
        title="Clerk dashboard"
        description="Track stock health, move usage updates quickly, and keep requisitions flowing through the approval channel."
      />

      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.heroHeader}>
            <div>
              <p className={ui.panelSub}>Operational overview</p>
              <h2 className={ui.panelTitle}>Daily stock visibility for {actor?.location || 'your location'}</h2>
            </div>
            <span className={ui.heroBadge}>Live clerk view</span>
          </div>
          <div className={ui.heroStatGrid}>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{total}</p>
              <p className={ui.heroStatLabel}>Items tracked</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{activeRequests.length}</p>
              <p className={ui.heroStatLabel}>Active requests</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{consumptions.length}</p>
              <p className={ui.heroStatLabel}>Recent usage logs</p>
            </div>
          </div>
        </div>

        <div className={ui.panel}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Priority watchlist</p>
              <p className={ui.queueMeta}>The same critical areas surfaced in the reference dashboard.</p>
            </div>
            <span className={ui.iconTile}>
              <ClerkIcon kind="inventory" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Low stock items</span>
              <span>{low}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Out of stock</span>
              <span>{out}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Near expiry</span>
              <span>{nearExpiryItems.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Monthly requested materials</h2>
          <p className={ui.panelSub}>Quick demand pattern view for the clerk channel.</p>
          <div className={ui.chart}>
            {bars.map((height, index) => (
              <div key={index} className={ui.bar} style={{ height: `${height}%` }} title={`Week ${index + 1}`} />
            ))}
          </div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Next actions</h2>
          <div className={ui.stack}>
            <div className={ui.softCard}>
              <p className={ui.softTitle}>Requisition queue</p>
              <p className={ui.softBody}>{activeRequests.length} clerk requests are still waiting inside the workflow.</p>
            </div>
            <div className={ui.softCard}>
              <p className={ui.softTitle}>Auto alert</p>
              <p className={ui.softBody}>{alerts[0]?.body || 'No urgent auto-alerts. Continue regular inventory review.'}</p>
            </div>
            <div className={ui.softCard}>
              <p className={ui.softTitle}>Document follow-up</p>
              <p className={ui.softBody}>Use Reports to monitor proforma, delivery note, and invoice completion.</p>
            </div>
          </div>
        </div>
      </div>

      <div className={ui.queueGrid}>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Latest requisitions</p>
              <p className={ui.queueMeta}>Recent requests from this clerk account.</p>
            </div>
            <span className={ui.iconTile}>
              <ClerkIcon kind="request" />
            </span>
          </div>
          {requisitions.length ? (
            <ul className={ui.listPlain}>
              {requisitions.slice(0, 4).map((entry) => (
                <li key={entry.id} className={ui.listItem}>
                  <p className={ui.itemTitle}>{entry.title}</p>
                  <p className={ui.itemMeta}>
                    {entry.location} · {formatDate(entry.requestedAt)} · <span className={ui.highlight}>{workflowLabel(entry.status)}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={ui.empty}>No requisitions created yet.</p>
          )}
        </div>

        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Recent activity</p>
              <p className={ui.queueMeta}>Consumption and register actions by the clerk.</p>
            </div>
            <span className={ui.iconTile}>
              <ClerkIcon kind="analytics" />
            </span>
          </div>
          <ActivityFeed
            logs={state.activity.filter((entry) => entry.actorId === actor?.id).slice(0, 4)}
            emptyText="Consumption, requisition, and stock actions will appear here."
          />
        </div>
      </div>
    </>
  );
}

export function ClerkInventory() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const items = state.stockItems.filter((item) => item.ownerId === actor?.id);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    unit: '',
    quantity: 0,
    minThreshold: 0,
    maxThreshold: 0,
    expiryDate: '',
    location: actor?.location || 'Warehouse A',
  });
  const [consumption, setConsumption] = useState({ itemId: '', quantity: 1, purpose: '' });

  function addItem(e) {
    e.preventDefault();
    try {
      addStockItem(form, actor?.id);
      setForm({
        name: '',
        sku: '',
        category: '',
        unit: '',
        quantity: 0,
        minThreshold: 0,
        maxThreshold: 0,
        expiryDate: '',
        location: actor?.location || 'Warehouse A',
      });
      setErr('');
    } catch (ex) {
      setErr(ex.message);
    }
  }

  function logConsumption(e) {
    e.preventDefault();
    if (!consumption.itemId) return;
    try {
      consumeStockItem(consumption, actor?.id);
      setConsumption({ itemId: '', quantity: 1, purpose: '' });
      setErr('');
    } catch (ex) {
      setErr(ex.message);
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesQuery =
      !query ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      String(item.sku || '').toLowerCase().includes(query.toLowerCase()) ||
      String(item.category || '').toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (filter === 'low') return stockStatus(item) === 'Low stock';
    if (filter === 'out') return stockStatus(item) === 'Out of stock';
    if (filter === 'expiry') return Boolean(item.expiryDate);
    return true;
  });

  return (
    <>
      <PageIntro
        eyebrow="Inventory list"
        title="Inventory list, add or update stock, and record stock usage"
        description="The clerk inventory workspace combines the same functions shown across the design sequence into one efficient page."
      />
      {err ? <p className={ui.err}>{err}</p> : null}

      <div className={ui.queueGrid}>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Add / update stock</p>
              <p className={ui.queueMeta}>Create a new item with thresholds, category, and expiry details.</p>
            </div>
            <span className={ui.iconTile}>
              <ClerkIcon kind="inventory" />
            </span>
          </div>
          <form onSubmit={addItem}>
            <div className={ui.formRow}>
              <input className={ui.input} placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input className={ui.input} placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <input className={ui.input} placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input className={ui.input} placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <input className={ui.input} type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              <input className={ui.input} type="number" placeholder="Min threshold" value={form.minThreshold} onChange={(e) => setForm({ ...form, minThreshold: Number(e.target.value) })} />
              <input className={ui.input} type="number" placeholder="Max threshold" value={form.maxThreshold} onChange={(e) => setForm({ ...form, maxThreshold: Number(e.target.value) })} />
              <input className={ui.input} type="date" value={form.expiryDate ? form.expiryDate.slice(0, 10) : ''} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
            <button type="submit" className={ui.btn}>
              Save stock item
            </button>
          </form>
        </div>

        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Record stock usage</p>
              <p className={ui.queueMeta}>Log consumed quantities and trigger low-stock visibility automatically.</p>
            </div>
            <span className={ui.iconTile}>
              <ClerkIcon kind="request" />
            </span>
          </div>
          <form onSubmit={logConsumption}>
            <div className={ui.formRow}>
              <select className={ui.select} value={consumption.itemId} onChange={(e) => setConsumption({ ...consumption, itemId: e.target.value })}>
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                className={ui.input}
                type="number"
                placeholder="Consumed quantity"
                value={consumption.quantity}
                onChange={(e) => setConsumption({ ...consumption, quantity: Number(e.target.value) })}
              />
              <input
                className={ui.input}
                placeholder="Purpose / ward / department"
                value={consumption.purpose}
                onChange={(e) => setConsumption({ ...consumption, purpose: e.target.value })}
              />
            </div>
            <button type="submit" className={`${ui.btn} ${ui.btnOutline}`}>
              Record usage
            </button>
          </form>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Inventory list</h2>
        <div className={ui.toolbar}>
          <div className={ui.segmented}>
            {[
              ['all', 'All items'],
              ['low', 'Low stock'],
              ['out', 'Out of stock'],
              ['expiry', 'With expiry'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? ui.segBtnActive : ui.segBtn}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <input className={`${ui.input} ${ui.searchField}`} placeholder="Search by item, SKU, or category" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.category || '—'}</td>
                  <td>{row.sku || '—'}</td>
                  <td>
                    {row.quantity} {row.unit || ''}
                  </td>
                  <td>{row.expiryDate ? formatDate(row.expiryDate) : '—'}</td>
                  <td>
                    <StatusBadge status={stockStatus(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function ClerkRequests() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const list = state.requisitions.filter((entry) => entry.clerkId === actor?.id);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('Stock requisition');
  const [priority, setPriority] = useState('normal');
  const [line, setLine] = useState({ description: '', quantity: 1, unit: '', estimatedCost: '' });
  const [lines, setLines] = useState([]);

  function pushLine(e) {
    e.preventDefault();
    if (!line.description) return;
    setLines([...lines, { ...line, quantity: Number(line.quantity) }]);
    setLine({ description: '', quantity: 1, unit: '', estimatedCost: '' });
  }

  function submitRequest(e) {
    e.preventDefault();
    if (lines.length === 0) return;
    try {
      createRequisition({ title, lines, priority, location: actor?.location }, actor?.id);
      setTitle('Stock requisition');
      setPriority('normal');
      setLines([]);
      setErr('');
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Request materials"
        title="Build and submit material requests"
        description="Prepare each requisition line by line, submit it to the supervisor, and track its movement across the shared approval workflow."
      />
      {err ? <p className={ui.err}>{err}</p> : null}

      <div className={ui.queueGrid}>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Request material</p>
              <p className={ui.queueMeta}>Aligns with the request form shown in the design board.</p>
            </div>
            <span className={ui.iconTile}>
              <ClerkIcon kind="request" />
            </span>
          </div>
          <form onSubmit={submitRequest}>
            <div className={ui.formRow}>
              <input className={ui.input} placeholder="Request title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <select className={ui.select} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="normal">Normal priority</option>
                <option value="high">High priority</option>
                <option value="critical">Critical priority</option>
              </select>
            </div>
            <div className={ui.formRow}>
              <input className={ui.input} placeholder="Material / description" value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} />
              <input className={ui.input} type="number" placeholder="Qty" value={line.quantity} onChange={(e) => setLine({ ...line, quantity: e.target.value })} />
              <input className={ui.input} placeholder="Unit" value={line.unit} onChange={(e) => setLine({ ...line, unit: e.target.value })} />
              <input className={ui.input} placeholder="Estimated cost" value={line.estimatedCost} onChange={(e) => setLine({ ...line, estimatedCost: e.target.value })} />
              <button type="button" className={`${ui.btn} ${ui.btnOutline}`} onClick={pushLine}>
                Add line
              </button>
            </div>
            {lines.length ? (
              <ul className={ui.listPlain}>
                {lines.map((entry, index) => (
                  <li key={index} className={ui.listItem}>
                    <p className={ui.itemTitle}>
                      {entry.description} × {entry.quantity} {entry.unit}
                    </p>
                    <p className={ui.itemMeta}>Estimated cost: {formatMoney(entry.estimatedCost || 0)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={ui.empty}>Add line items before submitting the requisition.</p>
            )}
            <button type="submit" className={ui.btn} disabled={lines.length === 0}>
              Submit request
            </button>
          </form>
        </div>

        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Workflow steps</p>
              <p className={ui.queueMeta}>What happens after the clerk submits.</p>
            </div>
            <span className={ui.iconTile}>
              <ClerkIcon kind="analytics" />
            </span>
          </div>
          <div className={ui.timeline}>
            <div className={ui.timelineRow}>
              <p className={ui.timelineTitle}>1. Create requisition</p>
              <p className={ui.timelineMeta}>Build a multi-line request with quantities, unit, and estimated spend.</p>
            </div>
            <div className={ui.timelineRow}>
              <p className={ui.timelineTitle}>2. Supervisor review</p>
              <p className={ui.timelineMeta}>Approval or rejection returns into the same portal for full visibility.</p>
            </div>
            <div className={ui.timelineRow}>
              <p className={ui.timelineTitle}>3. Supplier and finance continue</p>
              <p className={ui.timelineMeta}>Track proforma, payment, delivery note, and closing invoice in Reports.</p>
            </div>
          </div>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>My requests</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Lines</th>
                <th>Priority</th>
                <th>Supervisor note</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>
                    <StatusBadge status={workflowLabel(r.status)} />
                  </td>
                  <td>{(r.lines || []).length}</td>
                  <td>{r.priority || 'normal'}</td>
                  <td>{r.supervisorNote || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function ClerkAlerts() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const items = state.stockItems.filter((item) => item.ownerId === actor?.id);
  const alerts = getNotificationsForRole('clerk');
  const consumptions = state.consumptions.filter((entry) => entry.clerkId === actor?.id);
  const topUsedRows = usageRows(consumptions);
  const expiryRows = items
    .filter((item) => item.expiryDate)
    .map((item) => ({ ...item, daysLeft: daysUntil(item.expiryDate) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6);

  return (
    <>
      <PageIntro
        eyebrow="Expiry & usage"
        title="Expiry tracking and usage analytics"
        description="Review expiry pressure, monitor high-consumption items, and keep the clerk informed before shortages escalate."
      />

      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.heroHeader}>
            <div>
              <p className={ui.panelSub}>Expiry tracker</p>
              <h2 className={ui.panelTitle}>Items approaching their expiry window</h2>
            </div>
            <span className={ui.heroBadge}>{expiryRows.length} flagged</span>
          </div>
          <div className={ui.heroStatGrid}>
            {expiryRows.slice(0, 3).map((item) => (
              <div key={item.id} className={ui.heroStat}>
                <p className={ui.heroStatValue}>{item.daysLeft}</p>
                <p className={ui.heroStatLabel}>{item.name}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Latest alerts</h2>
          {alerts.length ? (
            <ul className={ui.listPlain}>
              {alerts.slice(0, 4).map((alert) => (
                <li key={alert.id} className={ui.listItem}>
                  <p className={ui.itemTitle}>{alert.title}</p>
                  <p className={ui.itemMeta}>{alert.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={ui.empty}>No current alerts.</p>
          )}
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Near-expiry tracking</h2>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Expiry date</th>
                  <th>Days left</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {expiryRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{formatDate(item.expiryDate)}</td>
                    <td>{item.daysLeft}</td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Usage analytics</h2>
          <div className={ui.chartMini}>
            {[42, 58, 45, 72, 60, 68, 54, 80, 62, 74].map((height, index) => (
              <div key={index} className={ui.miniBar} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className={ui.progressGroup}>
            {topUsedRows.slice(0, 4).map(([name, qty]) => (
              <div key={name} className={ui.progressRow}>
                <span>{name}</span>
                <div className={ui.progressTrack}>
                  <div className={ui.progressFill} style={{ width: `${Math.min(100, qty * 6)}%` }} />
                </div>
                <strong>{qty}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function ClerkDocuments() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useClerkActor(state, user);
  const requisitions = state.requisitions.filter((entry) => entry.clerkId === actor?.id);
  const invoices = state.invoices.filter((invoice) => requisitions.some((entry) => entry.id === invoice.requisitionId));
  const [reportView, setReportView] = useState('workflow');

  return (
    <>
      <PageIntro
        eyebrow="Report generation"
        title="Generate reports and track workflow documents"
        description="This clerk-facing page combines report visibility with the document states attached to every requisition started by the clerk."
      />

      <div className={ui.toolbar}>
        <div className={ui.segmented}>
          {[
            ['workflow', 'Workflow status'],
            ['stock', 'Stock summary'],
            ['usage', 'Usage report'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={reportView === value ? ui.segBtnActive : ui.segBtn}
              onClick={() => setReportView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.docGrid}>
        <div className={ui.docCard}>
          <p className={ui.docName}>Workflow report</p>
          <p className={ui.docHint}>See requisitions by stage, from submission to supplier and invoice close-out.</p>
        </div>
        <div className={ui.docCard}>
          <p className={ui.docName}>Usage report</p>
          <p className={ui.docHint}>Understand the most consumed items before shortages affect delivery timelines.</p>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Workflow document tracker</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Requisition</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Proforma</th>
                <th>Delivery note</th>
                <th>Final invoice</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((req) => {
                const invoice = invoices.find((entry) => entry.requisitionId === req.id);
                return (
                  <tr key={req.id}>
                    <td>{req.title}</td>
                    <td>{invoice?.reference || '—'}</td>
                    <td>
                      <StatusBadge status={workflowLabel(req.status)} />
                    </td>
                    <td>{invoice?.attachmentUrl || 'Pending'}</td>
                    <td>{invoice?.deliveryNoteUrl || 'Pending'}</td>
                    <td>{invoice?.finalInvoiceUrl || 'Pending'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>{reportView === 'workflow' ? 'Workflow summary' : reportView === 'stock' ? 'Stock summary' : 'Usage summary'}</h2>
        <div className={ui.queueGrid}>
          <div className={ui.queueCard}>
            <p className={ui.queueTitle}>Submitted</p>
            <p className={ui.queueMeta}>{requisitions.filter((entry) => entry.status === 'submitted').length} requests awaiting supervisor review.</p>
          </div>
          <div className={ui.queueCard}>
            <p className={ui.queueTitle}>In supplier flow</p>
            <p className={ui.queueMeta}>
              {requisitions.filter((entry) => ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid'].includes(entry.status)).length} requisitions are moving across supplier and finance.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function ClerkMessages() {
  const state = usePortalState();
  const messages = getMessagesForRole('clerk');
  const alerts = getNotificationsForRole('clerk');

  return (
    <>
      <PageIntro
        eyebrow="Portal communication"
        title="Messages and automatic notifications"
        description="Keep clerk communication inside the portal instead of scattered calls and delayed follow-up."
      />
      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Inbox</h2>
          {messages.length ? (
            <ul className={ui.listPlain}>
              {messages.map((message) => (
                <li key={message.id} className={ui.listItem}>
                  <p className={ui.itemTitle}>{message.title}</p>
                  <p className={ui.itemMeta}>
                    {message.from} · {formatDate(message.createdAt)}
                  </p>
                  <p className={ui.itemMeta}>{message.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={ui.empty}>No messages yet.</p>
          )}
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Notifications</h2>
          {alerts.length ? (
            <ul className={ui.listPlain}>
              {alerts.map((alert) => (
                <li key={alert.id} className={ui.listItem}>
                  <p className={ui.itemTitle}>{alert.title}</p>
                  <p className={ui.itemMeta}>{alert.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={ui.empty}>No notifications yet.</p>
          )}
        </div>
      </div>
      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Recent workflow activity</h2>
        <ActivityFeed logs={state.activity.slice(0, 6)} />
      </div>
    </>
  );
}

export function ClerkPlaceholder({ title, body }) {
  return (
    <div className={ui.panel}>
      <h2 className={ui.panelTitle}>{title}</h2>
      <p className={ui.muted}>{body}</p>
    </div>
  );
}
