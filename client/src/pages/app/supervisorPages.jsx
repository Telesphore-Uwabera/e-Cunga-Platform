import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getMessagesForRole, getNotificationsForRole, reviewRequisition, usePortalState } from '../../data/mockPortal.js';
import ui from './DashboardUi.module.css';
import { ActivityFeed, PageIntro, StatusBadge, formatDate, formatMoney, workflowLabel } from './roleUi.jsx';

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

export function SupervisorDashboard() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupervisorActor(state, user);
  const requests = state.requisitions;
  const submitted = requests.filter((entry) => entry.status === 'submitted').length;
  const approved = requests.filter((entry) =>
    ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid', 'deliveryNoteAttached', 'closed'].includes(entry.status)
  ).length;
  const clerkCount = state.users.filter((entry) => entry.role === 'clerk' && entry.isActive).length;
  const atRisk = state.stockItems.filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0)).length;
  const recentApprovals = state.activity.filter((entry) => entry.actorId === actor?.id).slice(0, 5);
  const bars = [42, 54, 49, 66, 58, 72, 68, 61];

  return (
    <>
      <PageIntro
        eyebrow="Supervisor"
        title="Supervisor dashboard"
        description="Review stock exposure, pending approvals, and cross-clerk operational health from one oversight workspace."
      />

      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.heroHeader}>
            <div>
              <p className={ui.panelSub}>Oversight summary</p>
              <h2 className={ui.panelTitle}>Daily operations dashboard</h2>
            </div>
            <span className={ui.heroBadge}>Supervisor view</span>
          </div>
          <div className={ui.heroStatGrid}>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{submitted}</p>
              <p className={ui.heroStatLabel}>Pending approvals</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{clerkCount}</p>
              <p className={ui.heroStatLabel}>Active clerks</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{atRisk}</p>
              <p className={ui.heroStatLabel}>At-risk items</p>
            </div>
          </div>
        </div>

        <div className={ui.panel}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Quick status</p>
              <p className={ui.queueMeta}>A compact panel like the reference dashboard’s right rail.</p>
            </div>
            <span className={ui.iconTile}>
              <SupervisorIcon kind="overview" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Approved workflow</span>
              <span>{approved}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Invoice-linked requests</span>
              <span>{state.invoices.length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Recent activity logs</span>
              <span>{recentApprovals.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Approval throughput</h2>
          <p className={ui.panelSub}>Recent approval pattern across weekly review windows.</p>
          <div className={ui.chart}>
            {bars.map((height, index) => (
              <div key={index} className={ui.bar} style={{ height: `${height}%` }} title={`Week ${index + 1}`} />
            ))}
          </div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Recent approval activity</h2>
          <ActivityFeed logs={recentApprovals} />
        </div>
      </div>
    </>
  );
}

export function SupervisorVisibility() {
  const state = usePortalState();
  const [filter, setFilter] = useState('all');
  const clerks = state.users.filter((entry) => entry.role === 'clerk');
  const perLocation = clerks.map((clerk) => {
    const items = state.stockItems.filter((item) => item.ownerId === clerk.id);
    return {
      id: clerk.id,
      clerk,
      trackedItems: items.length,
      totalUnits: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      lowStock: items.filter((item) => Number(item.quantity || 0) <= Number(item.minThreshold || 0)).length,
      categories: new Set(items.map((item) => item.category).filter(Boolean)).size,
    };
  });
  const visibleRows =
    filter === 'risk' ? perLocation.filter((entry) => entry.lowStock > 0) : filter === 'active' ? perLocation.filter((entry) => entry.trackedItems > 0) : perLocation;

  return (
    <>
      <PageIntro
        eyebrow="Inventory overview"
        title="Inventory overview by clerk and location"
        description="Compare stock health across clerk-managed sites and detect which locations need the fastest intervention."
      />

      <div className={ui.toolbar}>
        <div className={ui.segmented}>
          {[
            ['all', 'All locations'],
            ['active', 'Active stock'],
            ['risk', 'Low-stock risk'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? ui.segBtnActive : ui.segBtn} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.queueGrid}>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Inventory health summary</p>
              <p className={ui.queueMeta}>High-level cross-location view similar to the design reference.</p>
            </div>
            <span className={ui.iconTile}>
              <SupervisorIcon kind="overview" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Total locations</span>
              <span>{perLocation.length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Locations at risk</span>
              <span>{perLocation.filter((entry) => entry.lowStock > 0).length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Total tracked units</span>
              <span>{perLocation.reduce((sum, entry) => sum + entry.totalUnits, 0)}</span>
            </div>
          </div>
        </div>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Watchlist</p>
              <p className={ui.queueMeta}>Locations with the most low-stock pressure.</p>
            </div>
            <span className={ui.iconTile}>
              <SupervisorIcon kind="analytics" />
            </span>
          </div>
          <ul className={ui.listPlain}>
            {perLocation
              .sort((a, b) => b.lowStock - a.lowStock)
              .slice(0, 3)
              .map((entry) => (
                <li key={entry.id} className={ui.listItem}>
                  <p className={ui.itemTitle}>{entry.clerk.location}</p>
                  <p className={ui.itemMeta}>{entry.lowStock} low-stock items under {entry.clerk.fullName}</p>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Inventory by location</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Clerk</th>
                <th>Location</th>
                <th>Tracked items</th>
                <th>Categories</th>
                <th>Total units</th>
                <th>Low stock items</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.clerk.fullName}</td>
                  <td>{entry.clerk.location}</td>
                  <td>{entry.trackedItems}</td>
                  <td>{entry.categories}</td>
                  <td>{entry.totalUnits}</td>
                  <td>{entry.lowStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function SupervisorApprovals() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupervisorActor(state, user);
  const [note, setNote] = useState({});
  const [filter, setFilter] = useState('pending');
  const requests =
    filter === 'pending'
      ? state.requisitions.filter((entry) => entry.status === 'submitted')
      : filter === 'reviewed'
      ? state.requisitions.filter((entry) => entry.status !== 'submitted')
      : state.requisitions;

  function review(id, decision) {
    reviewRequisition(id, decision, note[id] || '', actor?.id);
  }

  return (
    <>
      <PageIntro
        eyebrow="Requests approval"
        title="Review and approve clerk requisitions"
        description="Open the approval queue, compare urgency, and add supervisor notes before pushing requests to the supplier stage."
      />

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

      <div className={ui.queueGrid}>
        {requests.slice(0, 2).map((request) => (
          <div key={request.id} className={ui.queueCard}>
            <div className={ui.queueCardHead}>
              <div>
                <p className={ui.queueTitle}>{request.title}</p>
                <p className={ui.queueMeta}>
                  {request.clerkName} · {request.location} · {request.priority}
                </p>
              </div>
              <StatusBadge status={workflowLabel(request.status)} />
            </div>
            <div className={ui.kvList}>
              <div className={ui.kvRow}>
                <span>Requested</span>
                <span>{formatDate(request.requestedAt)}</span>
              </div>
              <div className={ui.kvRow}>
                <span>Lines</span>
                <span>{request.lines.length}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Approval queue</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Clerk</th>
                <th>Status</th>
                <th>Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.title}</td>
                  <td>{request.clerkName}</td>
                  <td>
                    <StatusBadge status={workflowLabel(request.status)} />
                  </td>
                  <td>
                    <input
                      className={ui.input}
                      placeholder="Optional note"
                      value={note[request.id] || ''}
                      onChange={(e) => setNote({ ...note, [request.id]: e.target.value })}
                      disabled={request.status !== 'submitted'}
                    />
                  </td>
                  <td>
                    {request.status === 'submitted' ? (
                      <div className={ui.formRow}>
                        <button type="button" className={`${ui.btn} ${ui.btnSm}`} onClick={() => review(request.id, 'approved')}>
                          Approve
                        </button>
                        <button type="button" className={`${ui.btnOutline} ${ui.btn} ${ui.btnSm}`} onClick={() => review(request.id, 'rejected')}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className={ui.muted}>{request.supervisorNote || '—'}</span>
                    )}
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

export function SupervisorInvoices() {
  const state = usePortalState();
  const clerks = state.users.filter((entry) => entry.role === 'clerk');
  const clerkRows = clerks.map((clerk) => {
    const requisitions = state.requisitions.filter((entry) => entry.clerkId === clerk.id);
    const submitted = requisitions.filter((entry) => entry.status === 'submitted').length;
    const escalated = requisitions.filter((entry) => ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid'].includes(entry.status)).length;
    return {
      clerk,
      requisitions: requisitions.length,
      submitted,
      escalated,
      lastRequest: requisitions[0]?.updatedAt || '',
    };
  });

  return (
    <>
      <PageIntro
        eyebrow="Clerk monitoring"
        title="Monitor clerk activity and request movement"
        description="Compare clerk productivity, request status, and operational pressure across locations without leaving the supervisor workspace."
      />

      <div className={ui.queueGrid}>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Clerk workload</p>
              <p className={ui.queueMeta}>Side-by-side monitoring inspired by the reference page.</p>
            </div>
            <span className={ui.iconTile}>
              <SupervisorIcon kind="overview" />
            </span>
          </div>
          <ul className={ui.listPlain}>
            {clerkRows.map((entry) => (
              <li key={entry.clerk.id} className={ui.listItem}>
                <p className={ui.itemTitle}>{entry.clerk.fullName}</p>
                <p className={ui.itemMeta}>
                  {entry.clerk.location} · {entry.requisitions} total requests
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Risk summary</p>
              <p className={ui.queueMeta}>Which clerk queues need the fastest attention.</p>
            </div>
            <span className={ui.iconTile}>
              <SupervisorIcon kind="analytics" />
            </span>
          </div>
          <div className={ui.kvList}>
            {clerkRows.map((entry) => (
              <div key={entry.clerk.id} className={ui.kvRow}>
                <span>{entry.clerk.location}</span>
                <span>{entry.submitted} pending</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Clerk monitoring board</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Clerk</th>
                <th>Location</th>
                <th>Total requests</th>
                <th>Pending</th>
                <th>Escalated</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {clerkRows.map((entry) => (
                <tr key={entry.clerk.id}>
                  <td>{entry.clerk.fullName}</td>
                  <td>{entry.clerk.location}</td>
                  <td>{entry.requisitions}</td>
                  <td>{entry.submitted}</td>
                  <td>{entry.escalated}</td>
                  <td>{entry.lastRequest ? formatDate(entry.lastRequest) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function SupervisorReports() {
  const state = usePortalState();
  const usage = usageTotals(state.consumptions);
  const requestsByStatus = [
    ['Submitted', state.requisitions.filter((entry) => entry.status === 'submitted').length],
    ['Supplier stage', state.requisitions.filter((entry) => ['sentToSupplier', 'proformaReceived'].includes(entry.status)).length],
    ['Finance stage', state.requisitions.filter((entry) => ['proformaApproved', 'paid'].includes(entry.status)).length],
    ['Closed', state.requisitions.filter((entry) => entry.status === 'closed').length],
  ];

  return (
    <>
      <PageIntro
        eyebrow="Reports"
        title="Supervisor reports and weekly oversight"
        description="Track approval flow, usage pressure, and leadership summary metrics from a single reporting view."
      />

      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.heroHeader}>
            <div>
              <p className={ui.panelSub}>Oversight pack</p>
              <h2 className={ui.panelTitle}>Supervisor report summary</h2>
            </div>
            <span className={ui.heroBadge}>Live metrics</span>
          </div>
          <div className={ui.progressGroup}>
            {requestsByStatus.map(([label, count]) => (
              <div key={label} className={ui.progressRow}>
                <span className={ui.muted}>{label}</span>
                <div className={ui.progressTrack}>
                  <div className={ui.progressFill} style={{ width: `${Math.max(12, count * 22)}%` }} />
                </div>
                <span className={ui.mutedSm}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Usage snapshot</h2>
          <div className={ui.chartMini}>
            {[26, 42, 51, 38, 61, 58, 73, 49, 57, 68].map((height, index) => (
              <div key={index} className={ui.miniBar} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className={ui.pillRow}>
            <span className={ui.pill}>Approval SLA</span>
            <span className={ui.pill}>Usage trend</span>
            <span className={ui.pill}>Monthly summary</span>
          </div>
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Top used items</h2>
          <ul className={ui.listPlain}>
            {usage.map(([name, qty]) => (
              <li key={name} className={ui.listItem}>
                <p className={ui.itemTitle}>{name}</p>
                <p className={ui.itemMeta}>{qty} units consumed</p>
              </li>
            ))}
          </ul>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Financial visibility</h2>
          <ul className={ui.listPlain}>
            {state.invoices.slice(0, 5).map((invoice) => (
              <li key={invoice.id} className={ui.listItem}>
                <p className={ui.itemTitle}>{invoice.reference}</p>
                <p className={ui.itemMeta}>
                  {formatMoney(invoice.amount, invoice.currency)} · {workflowLabel(invoice.status)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export function SupervisorMessages() {
  const state = usePortalState();
  const messages = getMessagesForRole('supervisor');
  const notifications = getNotificationsForRole('supervisor');

  return (
    <>
      <PageIntro
        eyebrow="Messages"
        title="Portal communication for approvals and exceptions"
        description="Keep approval notes, operational exceptions, and automatic alerts inside the supervisor workspace."
      />
      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Messages</h2>
          <ul className={ui.listPlain}>
            {messages.map((message) => (
              <li key={message.id} className={ui.listItem}>
                <p className={ui.itemTitle}>{message.title}</p>
                <p className={ui.itemMeta}>{message.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Notifications</h2>
          <ul className={ui.listPlain}>
            {notifications.map((entry) => (
              <li key={entry.id} className={ui.listItem}>
                <p className={ui.itemTitle}>{entry.title}</p>
                <p className={ui.itemMeta}>{entry.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Recent role activity</h2>
        <ActivityFeed logs={state.activity.slice(0, 6)} />
      </div>
    </>
  );
}

export function SupervisorPlaceholder({ title, body }) {
  return (
    <div className={ui.panel}>
      <h2 className={ui.panelTitle}>{title}</h2>
      <p className={ui.muted}>{body}</p>
    </div>
  );
}
