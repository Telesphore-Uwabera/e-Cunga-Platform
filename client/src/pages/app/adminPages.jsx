import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getMessagesForRole, getNotificationsForRole, inviteUser, toggleUserActive, updateCompanySettings, usePortalState } from '../../data/mockPortal.js';
import ui from './DashboardUi.module.css';
import { ActivityFeed, PageIntro, StatusBadge, formatDateTime, formatMoney, workflowLabel } from './roleUi.jsx';

const RBAC_MATRIX = [
  { area: 'Inventory', clerk: 'Register + consume', supervisor: 'Read', accountant: 'Read', supplier: '—', admin: 'Full' },
  { area: 'Requisitions', clerk: 'Create', supervisor: 'Approve / reject', accountant: 'Track', supplier: 'Read approved', admin: 'Full' },
  { area: 'Invoices', clerk: 'Read own flow', supervisor: 'Visibility', accountant: 'Approve / pay', supplier: 'Upload docs', admin: 'Full' },
  { area: 'Payments', clerk: '—', supervisor: '—', accountant: 'Execute', supplier: 'Receive notice', admin: 'Full' },
  { area: 'Users / settings', clerk: '—', supervisor: '—', accountant: '—', supplier: '—', admin: 'Full' },
];

function useAdminActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'admin'),
    [state.users, user?.email]
  );
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
  const state = usePortalState();
  const openReqs = state.requisitions.filter((entry) => entry.status !== 'closed' && entry.status !== 'rejected').length;
  const lowStock = state.stockItems.filter((entry) => Number(entry.quantity || 0) <= Number(entry.minThreshold || 0)).length;
  const financeValue = state.invoices.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const activeUsers = state.users.filter((entry) => entry.isActive).length;

  return (
    <>
      <PageIntro
        eyebrow="Admin"
        title="Admin dashboard"
        description="Review company activity, user growth, workflow pressure, and finance visibility from one executive control surface."
      />

      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.heroHeader}>
            <div>
              <p className={ui.panelSub}>Executive overview</p>
              <h2 className={ui.panelTitle}>Company performance snapshot</h2>
            </div>
            <span className={ui.heroBadge}>Admin view</span>
          </div>
          <div className={ui.heroStatGrid}>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{state.users.length}</p>
              <p className={ui.heroStatLabel}>Registered users</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{openReqs}</p>
              <p className={ui.heroStatLabel}>Open workflows</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{formatMoney(financeValue)}</p>
              <p className={ui.heroStatLabel}>Workflow value</p>
            </div>
          </div>
        </div>

        <div className={ui.panel}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Quick status</p>
              <p className={ui.queueMeta}>A compact summary rail like the reference dashboard.</p>
            </div>
            <span className={ui.iconTile}>
              <AdminIcon kind="reports" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Active users</span>
              <span>{activeUsers}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Low-stock risks</span>
              <span>{lowStock}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Pending approvals</span>
              <span>{state.requisitions.filter((entry) => entry.status === 'submitted').length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Activity trend</h2>
          <p className={ui.panelSub}>Operational movement across the latest reporting periods.</p>
          <div className={ui.chart}>{[28, 34, 31, 47, 39, 55, 49, 61].map((height, index) => <div key={index} className={ui.bar} style={{ height: `${height}%` }} />)}</div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Latest activity</h2>
          <ActivityFeed logs={state.activity.slice(0, 6)} />
        </div>
      </div>
    </>
  );
}

export function AdminUsers() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useAdminActor(state, user);
  const [form, setForm] = useState({ email: '', fullName: '', role: 'clerk', team: 'Operations', location: 'HQ Kigali' });

  function invite(e) {
    e.preventDefault();
    inviteUser(form, actor?.id);
    setForm({ email: '', fullName: '', role: 'clerk', team: 'Operations', location: 'HQ Kigali' });
  }

  return (
    <>
      <PageIntro
        eyebrow="User management"
        title="Manage users, roles, and workspace access"
        description="Invite new staff, assign operational roles, and control user activation from one central admin workspace."
      />
      <div className={ui.queueGrid}>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Workspace seats</p>
              <p className={ui.queueMeta}>Current team growth against the company user limit.</p>
            </div>
            <span className={ui.iconTile}>
              <AdminIcon kind="users" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Used seats</span>
              <span>{state.users.length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Available seats</span>
              <span>{Math.max(0, state.company.usersLimit - state.users.length)}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Inactive users</span>
              <span>{state.users.filter((entry) => !entry.isActive).length}</span>
            </div>
          </div>
        </div>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Role spread</p>
              <p className={ui.queueMeta}>Keep all workflow roles represented across the platform.</p>
            </div>
            <span className={ui.iconTile}>
              <AdminIcon kind="reports" />
            </span>
          </div>
          <div className={ui.kvList}>
            {['clerk', 'supervisor', 'accountant', 'supplier', 'admin'].map((role) => (
              <div key={role} className={ui.kvRow}>
                <span>{role}</span>
                <span>{state.users.filter((entry) => entry.role === role).length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Invite user</h2>
        <form onSubmit={invite}>
          <div className={ui.formRow}>
            <input className={ui.input} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className={ui.input} placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <select className={ui.select} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="clerk">Clerk</option>
              <option value="supervisor">Supervisor</option>
              <option value="accountant">Accountant</option>
              <option value="supplier">Supplier</option>
            </select>
            <input className={ui.input} placeholder="Team" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
            <input className={ui.input} placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <button type="submit" className={ui.btn} disabled={state.users.length >= state.company.usersLimit}>
              Invite
            </button>
          </div>
        </form>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Team roster</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Team</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.users.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.fullName}</td>
                  <td>{entry.email}</td>
                  <td>{entry.role}</td>
                  <td>{entry.team}</td>
                  <td>{entry.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    {entry.role !== 'admin' ? (
                      <button type="button" className={`${ui.btnOutline} ${ui.btn} ${ui.btnSm}`} onClick={() => toggleUserActive(entry.id, actor?.id)}>
                        Toggle active
                      </button>
                    ) : (
                      <span className={ui.mutedSm}>Owner</span>
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

export function AdminActivity() {
  const state = usePortalState();
  const messages = getMessagesForRole('admin');
  const notifications = getNotificationsForRole('admin');
  const alertCards = [
    {
      id: 'risk-1',
      title: 'Low stock attention',
      body: `${state.stockItems.filter((entry) => Number(entry.quantity || 0) <= Number(entry.minThreshold || 0)).length} items are currently below threshold.`,
      badge: 'Operations',
    },
    {
      id: 'risk-2',
      title: 'Open approval queue',
      body: `${state.requisitions.filter((entry) => entry.status === 'submitted').length} requisitions are waiting for supervisor action.`,
      badge: 'Workflow',
    },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Notifications center"
        title="Notifications, alerts, and executive updates"
        description="Track executive digest items, system alerts, and recent platform activity from one admin communications center."
      />

      <div className={ui.queueGrid}>
        {alertCards.map((card) => (
          <div key={card.id} className={ui.queueCard}>
            <div className={ui.queueCardHead}>
              <div>
                <p className={ui.queueTitle}>{card.title}</p>
                <p className={ui.queueMeta}>{card.body}</p>
              </div>
              <span className={ui.heroBadge}>{card.badge}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Admin messages</h2>
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
          <h2 className={ui.panelTitle}>System notifications</h2>
          {notifications.length ? (
            <ul className={ui.listPlain}>
              {notifications.map((entry) => (
                <li key={entry.id} className={ui.listItem}>
                  <p className={ui.itemTitle}>{entry.title}</p>
                  <p className={ui.itemMeta}>{entry.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={ui.empty}>Admin notifications will surface here as the workspace grows.</p>
          )}
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Recent platform activity</h2>
        <ActivityFeed logs={state.activity.slice(0, 8)} />
      </div>
    </>
  );
}

export function AdminRbac() {
  const state = usePortalState();

  return (
    <>
      <PageIntro
        eyebrow="Workflow control"
        title="Role coverage and operational visibility"
        description="Use this screen as the admin's RBAC and workflow control tower for stock, approvals, supplier steps, and finance closure."
      />
      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>RBAC matrix</h2>
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
          <h2 className={ui.panelTitle}>Open workflow statuses</h2>
          <ul className={ui.listPlain}>
            {state.requisitions.slice(0, 6).map((entry) => (
              <li key={entry.id} className={ui.listItem}>
                <p className={ui.itemTitle}>{entry.title}</p>
                <p className={ui.itemMeta}>
                  {entry.clerkName} · <span className={ui.highlight}>{workflowLabel(entry.status)}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export function AdminSettings() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useAdminActor(state, user);
  const [form, setForm] = useState({
    name: state.company.name,
    type: state.company.type,
    language: state.company.language,
    currency: state.company.currency,
  });

  function save(e) {
    e.preventDefault();
    updateCompanySettings(form, actor?.id);
  }

  return (
    <>
      <PageIntro
        eyebrow="Company settings"
        title="Workspace profile, defaults, and workflow guardrails"
        description="Configure company identity, workspace defaults, and the role structure that drives the universal e-CUNGA workflow."
      />

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Company profile</h2>
          <form onSubmit={save}>
            <div className={ui.formRow}>
              <input className={ui.input} placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={ui.input} placeholder="Institution type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              <input className={ui.input} placeholder="Language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
              <input className={ui.input} placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              <button type="submit" className={ui.btn}>
                Save settings
              </button>
            </div>
          </form>
        </div>
        <div className={ui.panel}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Workspace defaults</p>
              <p className={ui.queueMeta}>Operational boundaries used across all roles.</p>
            </div>
            <span className={ui.iconTile}>
              <AdminIcon kind="settings" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>User limit</span>
              <span>{state.company.usersLimit}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Language</span>
              <span>{state.company.language}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Currency</span>
              <span>{state.company.currency}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Workflow and access matrix</h2>
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
    </>
  );
}

export function AdminReports() {
  const state = usePortalState();
  const closedValue = state.invoices.filter((entry) => entry.status === 'closed').reduce((sum, entry) => sum + entry.amount, 0);
  const approvalMoved = state.requisitions.filter((entry) => entry.status !== 'submitted').length;
  const activeUsers = state.users.filter((entry) => entry.isActive).length;

  return (
    <>
      <PageIntro
        eyebrow="Reports & analytics"
        title="Executive reports and analytics"
        description="Monitor platform health, workflow throughput, and completed value with an admin-friendly analytics surface."
      />
      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.heroHeader}>
            <div>
              <p className={ui.panelSub}>Reports snapshot</p>
              <h2 className={ui.panelTitle}>Operations and finance performance</h2>
            </div>
            <span className={ui.heroBadge}>Analytics</span>
          </div>
          <div className={ui.heroStatGrid}>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{formatMoney(closedValue)}</p>
              <p className={ui.heroStatLabel}>Closed workflow value</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{approvalMoved}</p>
              <p className={ui.heroStatLabel}>Requests advanced</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{activeUsers}</p>
              <p className={ui.heroStatLabel}>Active platform users</p>
            </div>
          </div>
        </div>

        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Quick exports</h2>
          <div className={ui.pillRow}>
            <span className={ui.pill}>Executive summary</span>
            <span className={ui.pill}>Approval report</span>
            <span className={ui.pill}>Finance snapshot</span>
            <span className={ui.pill}>Supplier scorecard</span>
          </div>
          <p className={ui.panelSub}>The layout is ready for future PDF and CSV export actions.</p>
          <div className={ui.chartMini}>
            {[24, 44, 39, 58, 42, 66, 51, 73, 49, 61].map((height, index) => (
              <div key={index} className={ui.miniBar} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Monthly performance</h2>
          <div className={ui.chart}>{[22, 35, 28, 40, 33, 48, 44, 51].map((height, index) => <div key={index} className={ui.bar} style={{ height: `${height}%` }} />)}</div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Snapshot</h2>
          <div className={ui.stack}>
            <div className={ui.softCard}>
              <p className={ui.softTitle}>Closed workflow value</p>
              <p className={ui.softBody}>{closedValue.toLocaleString()} RWF in finalized invoices.</p>
            </div>
            <div className={ui.softCard}>
              <p className={ui.softTitle}>Approval throughput</p>
              <p className={ui.softBody}>{approvalMoved} requisitions already moved beyond intake.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
