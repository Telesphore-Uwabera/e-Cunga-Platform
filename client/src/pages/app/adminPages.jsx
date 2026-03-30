import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getNotificationsForRole, inviteUser, toggleUserActive, updateCompanySettings, usePortalState } from '../../data/mockPortal.js';
import ui from './DashboardUi.module.css';
import { PageIntro, StatusBadge, formatMoney, workflowLabel } from './roleUi.jsx';

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
  const { user } = useAuth();
  useAdminActor(state, user);
  const totalUsers = state.users.length;
  const pendingApprovals = state.requisitions.filter((entry) => ['submitted', 'proformaReceived'].includes(entry.status)).length;
  const inventoryValue = state.stockItems.reduce((sum, entry) => sum + Number(entry.quantity || 0) * Math.max(2500, Number(entry.maxThreshold || 0) * 120), 0);
  const revenue = state.invoices.filter((entry) => ['paid', 'closed'].includes(entry.status)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const monthlyMovement = Math.min(
    96,
    Math.round(
      (state.requisitions.filter((entry) => ['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status)).length / Math.max(1, state.requisitions.length)) * 100
    )
  );
  const activityBars = [36, 42, 39, 48, 57, 54, 66, 74, 62, 58, 64, 71];
  const recentActivity = [
    {
      id: 'admin-activity-1',
      title: 'New User Registration',
      meta: '2m ago · HQ Kigali',
      tone: 'good',
    },
    {
      id: 'admin-activity-2',
      title: 'Batch Update Complete',
      meta: '45m ago · 1,120 entries synced',
      tone: 'info',
    },
    {
      id: 'admin-activity-3',
      title: 'Security Alert',
      meta: '1h ago · Unauthorized login attempt',
      tone: 'bad',
    },
  ];
  const insightItems = [...state.stockItems]
    .sort((a, b) => {
      const aRatio = Number(a.quantity || 0) / Math.max(1, Number(a.minThreshold || 1));
      const bRatio = Number(b.quantity || 0) / Math.max(1, Number(b.minThreshold || 1));
      return aRatio - bRatio;
    })
    .slice(0, 2)
    .map((item) => {
      const stockRatio = Number(item.quantity || 0) / Math.max(1, Number(item.maxThreshold || 1));
      return {
        ...item,
        value: Number(item.quantity || 0) * Math.max(2500, Number(item.maxThreshold || 0) * 120),
        stockRatio,
        statusLabel: Number(item.quantity || 0) <= Number(item.minThreshold || 0) ? 'Restock' : 'In Stock',
        statusTone: Number(item.quantity || 0) <= Number(item.minThreshold || 0) ? 'bad' : 'good',
      };
    });

  return (
    <div className={ui.adminDash}>
      <div className={ui.adminSummaryGrid}>
        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Total users</p>
          <strong className={ui.adminSummaryValue}>{totalUsers.toLocaleString()}</strong>
          <span className={ui.adminSummaryMeta}>+ 12.5% vs last month</span>
        </article>

        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Inventory value</p>
          <strong className={ui.adminSummaryValue}>{formatMoney(inventoryValue)}</strong>
          <span className={ui.adminSummaryMeta}>Real-time valuation</span>
        </article>

        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Revenue</p>
          <strong className={ui.adminSummaryValue}>{formatMoney(revenue)}</strong>
          <span className={ui.adminSummaryMeta}>Monthly target</span>
        </article>

        <article className={`${ui.adminSummaryCard} ${ui.adminSummaryCardAccent}`}>
          <p className={ui.adminSummaryLabel}>Pending approvals</p>
          <strong className={ui.adminSummaryValue}>{pendingApprovals}</strong>
          <button type="button" className={ui.adminSummaryBtn}>Review Now</button>
        </article>
      </div>

      <div className={ui.adminMainGrid}>
        <section className={ui.adminCurveCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h1 className={ui.adminTitle}>Active Users Curve</h1>
              <p className={ui.adminLead}>30-day engagement overview</p>
            </div>
            <button type="button" className={ui.adminRangeBtn}>Last 30 Days</button>
          </div>

          <div className={ui.adminCurveChart} aria-hidden="true">
            {activityBars.map((height, index) => (
              <span
                key={`bar-${index}`}
                className={index === 5 || index === 6 ? ui.adminCurveBarAccent : ui.adminCurveBar}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>

          <div className={ui.adminCurveFooter}>
            <span>Day 01</span>
            <span>Day 15</span>
            <span>Day 30</span>
          </div>
        </section>

        <aside className={ui.adminRail}>
          <section className={ui.adminMovementCard}>
            <p className={ui.adminMovementLabel}>Monthly Movement</p>
            <div className={ui.adminMovementRing} style={{ '--admin-progress': `${monthlyMovement}%` }}>
              <span>{monthlyMovement}%</span>
              <small>Target</small>
            </div>
            <p className={ui.adminMovementText}>You are ahead of schedule by 12% this month.</p>
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
            <button type="button" className={ui.adminActivityBtn}>View All Activities</button>
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
            <button type="button" className={ui.adminGhostBtn}>Export CSV</button>
            <button type="button" className={ui.adminPrimaryBtn}>Add Entry</button>
          </div>
        </div>

        <div className={ui.adminInsightTableHead}>
          <span>Item Name</span>
          <span>SKU</span>
          <span>Stock Level</span>
          <span>Value</span>
          <span>Status</span>
          <span />
        </div>

        <div className={ui.adminInsightRows}>
          {insightItems.map((item) => (
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
              <button type="button" className={ui.adminInsightMore} aria-label={`More options for ${item.name}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                  <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                </svg>
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdminUsers() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useAdminActor(state, user);
  const [form, setForm] = useState({ email: '', fullName: '', role: 'clerk', team: 'Operations', location: 'HQ Kigali' });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteForm, setShowInviteForm] = useState(false);

  const rows = state.users
    .filter((entry) => {
      const searchText = `${entry.fullName} ${entry.email}`.toLowerCase();
      const matchesSearch = !search || searchText.includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || entry.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? entry.isActive : !entry.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt || b.invitedAt || 0) - new Date(a.createdAt || a.invitedAt || 0));

  function invite(e) {
    e.preventDefault();
    inviteUser(form, actor?.id);
    setForm({ email: '', fullName: '', role: 'clerk', team: 'Operations', location: 'HQ Kigali' });
    setShowInviteForm(false);
  }

  return (
    <div className={ui.adminUsersBoard}>
      <div className={ui.adminUsersTop}>
        <div>
          <h1 className={ui.adminUsersTitle}>User Management</h1>
          <p className={ui.adminUsersLead}>Orchestrate your team&apos;s access levels and system permissions with surgical precision.</p>
        </div>
        <button
          type="button"
          className={ui.adminUsersAddBtn}
          onClick={() => setShowInviteForm((current) => !current)}
          disabled={state.users.length >= state.company.usersLimit}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14M19 7h-4M7 19v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Add New User
        </button>
      </div>

      {showInviteForm ? (
        <section className={ui.adminUsersInviteCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h2 className={ui.adminUsersSectionTitle}>Invite New User</h2>
              <p className={ui.adminUsersSectionMeta}>Create a new workspace account and assign an operational role.</p>
            </div>
          </div>
          <form onSubmit={invite} className={ui.adminUsersInviteForm}>
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
            <button type="submit" className={ui.adminPrimaryBtn} disabled={state.users.length >= state.company.usersLimit}>
              Save User
            </button>
          </form>
        </section>
      ) : null}

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

        <div className={ui.adminUsersTableHead}>
          <span>Identity</span>
          <span>Role Assignment</span>
          <span>Current Status</span>
          <span>Registration Date</span>
          <span>Actions</span>
        </div>

        <div className={ui.adminUsersRows}>
          {rows.length ? (
            rows.map((entry, index) => (
              <article key={entry.id} className={ui.adminUsersRow}>
                <div className={ui.adminUsersIdentity}>
                  <span className={ui.adminUsersAvatar}>{entry.fullName.split(/\s+/).map((part) => part[0] || '').slice(0, 2).join('').toUpperCase()}</span>
                  <div>
                    <p className={ui.adminUsersName}>{entry.fullName}</p>
                    <p className={ui.adminUsersEmail}>{entry.email}</p>
                  </div>
                </div>
                <div>
                  <select className={ui.adminUsersRoleSelect} value={entry.role} disabled>
                    <option>{entry.role[0].toUpperCase() + entry.role.slice(1)}</option>
                  </select>
                </div>
                <div>
                  <span className={entry.isActive ? ui.adminUsersStatusActive : index % 3 === 1 ? ui.adminUsersStatusPending : ui.adminUsersStatusInactive}>
                    {entry.isActive ? 'Active' : index % 3 === 1 ? 'Pending' : 'Inactive'}
                  </span>
                </div>
                <div className={ui.adminUsersDate}>{new Date().toLocaleDateString()}</div>
                <div className={ui.adminUsersActions}>
                  {entry.role !== 'admin' ? (
                    <button type="button" className={ui.adminUsersActionBtn} onClick={() => toggleUserActive(entry.id, actor?.id)}>
                      {entry.isActive ? 'Disable' : 'Enable'}
                    </button>
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

        <div className={ui.adminUsersFooter}>
          <span className={ui.adminUsersFooterMeta}>Showing {rows.length} of {state.users.length} entries</span>
          <div className={ui.adminUsersPager}>
            <button type="button" className={ui.adminUsersPagerBtn} aria-label="Previous page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className={ui.adminUsersPageActive}>1</button>
            <button type="button" className={ui.adminUsersPageBtn}>2</button>
            <button type="button" className={ui.adminUsersPageBtn}>3</button>
            <button type="button" className={ui.adminUsersPagerBtn} aria-label="Next page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <div className={ui.adminUsersBottom}>
        <section className={ui.adminUsersAuditCard}>
          <p className={ui.adminUsersAuditEyebrow}>AI Security Insight</p>
          <h2 className={ui.adminUsersAuditTitle}>Permissions Audit Recommendation</h2>
          <p className={ui.adminUsersAuditText}>
            Our curator AI has noticed that 3 users in the &apos;Clerk&apos; role haven&apos;t accessed the &apos;Ledger&apos; module in over 30 days. Consider downgrading their
            access to &apos;Viewer&apos; to maintain system hygiene.
          </p>
          <button type="button" className={ui.adminUsersAuditBtn}>Start Audit Workflow</button>
        </section>

        <section className={ui.adminUsersRoleCard}>
          <span className={ui.adminUsersRoleIcon}>
            <AdminIcon kind="settings" />
          </span>
          <h2 className={ui.adminUsersRoleTitle}>Role Customization</h2>
          <p className={ui.adminUsersRoleText}>Need a specialized role for a temporary auditor? Create custom permission sets.</p>
          <button type="button" className={ui.adminUsersRoleBtn}>Manage Roles</button>
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
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useAdminActor(state, user);
  const [filter, setFilter] = useState('all');
  const [removedIds, setRemovedIds] = useState(() => new Set());
  const [readIds, setReadIds] = useState(() => new Set());

  const source = useMemo(() => {
    const list = getNotificationsForRole('admin');
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [state.notifications]);

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
        <h1 className={ui.adminNotifyTitle}>Notifications Center</h1>
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

      <div className={ui.adminNotifyGrid}>
        <aside className={ui.adminNotifyAside}>
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
                  <span>{item.label}</span>
                  <span className={item.key === filter ? ui.adminNotifyFilterCountOn : ui.adminNotifyFilterCount}>{counts[item.countKey]}</span>
                </button>
              </li>
            ))}
          </ul>

          <section className={ui.adminNotifyInsight}>
            <span className={ui.adminNotifyInsightIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width={22} height={22} fill="none">
                <path d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2m14 0h2M17 6l1.4-1.4M19 12l-1.5 1.5M12 19v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8.5 14.5 12 18l6.5-8.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className={ui.adminNotifyInsightTitle}>AI Insights</h2>
            <p className={ui.adminNotifyInsightText}>
              Stock depletion detected for Gasket-X9 based on current velocity. Suggested reorder: 500 units.
            </p>
            <button type="button" className={ui.adminNotifyInsightBtn}>
              Review Suggested Order
            </button>
          </section>
        </aside>

        <div className={ui.adminNotifyFeed}>
          {filteredFeed.length === 0 ? (
            <p className={ui.adminNotifyEmpty}>No alerts match this filter.</p>
          ) : (
            <ul className={ui.adminNotifyFeedList}>
              {filteredFeed.map((n) => {
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
                            <button type="button" className={ui.adminNotifyPrimaryBtn}>
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
    legalName: state.company.legalName || 'e-CUNGA Solutions Ltd.',
    taxId: state.company.taxId || 'VAT-9920-X1',
    address: state.company.address || 'Suite 402, Innovation Hub, Tech District, Central City, 10110',
    lowStockThreshold: state.company.lowStockThreshold || 15,
    anomalyDetection: state.company.anomalyDetection ?? true,
    auditRetention: state.company.auditRetention || '1 Year',
    sessionTimeout: state.company.sessionTimeout || '30 Minutes',
  });

  function save(e) {
    e.preventDefault();
    updateCompanySettings(form, actor?.id);
  }

  function discard() {
    setForm({
      name: state.company.name,
      type: state.company.type,
      language: state.company.language,
      currency: state.company.currency,
      legalName: state.company.legalName || 'e-CUNGA Solutions Ltd.',
      taxId: state.company.taxId || 'VAT-9920-X1',
      address: state.company.address || 'Suite 402, Innovation Hub, Tech District, Central City, 10110',
      lowStockThreshold: state.company.lowStockThreshold || 15,
      anomalyDetection: state.company.anomalyDetection ?? true,
      auditRetention: state.company.auditRetention || '1 Year',
      sessionTimeout: state.company.sessionTimeout || '30 Minutes',
    });
  }

  return (
    <form onSubmit={save} className={ui.adminSettingsBoard}>
      <div className={ui.adminSettingsTop}>
        <div>
          <h1 className={ui.adminSettingsTitle}>Company Settings</h1>
          <p className={ui.adminSettingsLead}>Manage your organizational identity and system-wide configurations.</p>
        </div>
        <div className={ui.adminSettingsActions}>
          <button type="button" className={ui.adminSettingsGhostBtn} onClick={discard}>
            Discard
          </button>
          <button type="submit" className={ui.adminSettingsPrimaryBtn}>
            Save Changes
          </button>
        </div>
      </div>

      <div className={ui.adminSettingsGrid}>
        <div className={ui.adminSettingsMain}>
          <section className={ui.adminSettingsCard}>
            <div className={ui.adminSettingsSectionHead}>
              <h2 className={ui.adminSettingsSectionTitle}>Company Information</h2>
            </div>

            <div className={ui.adminSettingsLogoBlock}>
              <div className={ui.adminSettingsLogoTile}>e-CUNGA</div>
              <div>
                <p className={ui.adminSettingsUploadTitle}>Upload new logo</p>
                <p className={ui.adminSettingsUploadMeta}>Recommended: 400x400, PNG, SVG or JPG.</p>
              </div>
            </div>

            <div className={ui.adminSettingsFormGrid}>
              <label className={ui.adminSettingsField}>
                <span>Legal entity name</span>
                <input className={ui.adminSettingsInput} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value, name: e.target.value })} />
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
                  <option>English (United Kingdom)</option>
                  <option>English</option>
                  <option>Kinyarwanda</option>
                </select>
                <small>Used for automated reports and notifications.</small>
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

            <button type="button" className={ui.adminSettingsEnforceBtn}>Enforce for all users</button>

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
            <p className={ui.adminSettingsSuggestionLabel}>The Curator <span>AI Suggestion</span></p>
            <div className={ui.adminSettingsSuggestionBlock}>
              <p className={ui.adminSettingsSuggestionTitle}>Threshold Optimization</p>
              <p className={ui.adminSettingsSuggestionText}>Based on last month&apos;s velocity, increasing your stock threshold to 18% would prevent 3 expected stockouts.</p>
              <button type="button" className={ui.adminSettingsSuggestionBtn}>Apply Suggestion</button>
            </div>
            <div className={ui.adminSettingsSuggestionBlock}>
              <p className={ui.adminSettingsSuggestionTitle}>Security Audit</p>
              <p className={ui.adminSettingsSuggestionText}>3 admin accounts haven&apos;t rotated their passwords in over 90 days. We recommend triggering a mandatory reset.</p>
            </div>
          </section>

          <section className={ui.adminSettingsProfileCard}>
            <span className={ui.adminSettingsProfileAvatar}>{actor?.fullName?.split(/\s+/).map((part) => part[0] || '').slice(0, 2).join('').toUpperCase() || 'AU'}</span>
            <div>
              <p className={ui.adminSettingsProfileName}>{actor?.fullName || 'Admin User'}</p>
              <p className={ui.adminSettingsProfileMeta}>{actor?.team || 'Global Controller'}</p>
            </div>
            <span className={ui.adminSettingsProfileArrow}>›</span>
          </section>
        </aside>
      </div>
    </form>
  );
}

export function AdminReports() {
  const state = usePortalState();
  const totalConsumption = state.consumptions.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const turnover = Number((totalConsumption / Math.max(1, state.stockItems.length)).toFixed(1));
  const stockAccuracy = Math.min(
    99.9,
    Number(
      (
        ((state.stockItems.filter((entry) => Number(entry.quantity || 0) > 0).length + state.invoices.filter((entry) => entry.status !== 'rejected').length) /
          Math.max(1, state.stockItems.length + state.invoices.length)) *
        100
      ).toFixed(1)
    )
  );
  const fulfillmentRate = Math.min(
    99.9,
    Number(
      (
        (state.requisitions.filter((entry) => ['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status)).length / Math.max(1, state.requisitions.length)) *
        100
      ).toFixed(1)
    )
  );
  const regionSource = [
    { label: 'Gasabo', value: state.requisitions.filter((entry) => entry.location === 'Gasabo').length || 1 },
    { label: 'Kicukiro', value: state.requisitions.filter((entry) => entry.location === 'Kicukiro').length || 1 },
    { label: 'HQ Kigali', value: state.requisitions.filter((entry) => entry.location === 'HQ Kigali').length || 1 },
  ];
  const totalRegionValue = regionSource.reduce((sum, entry) => sum + entry.value, 0);
  const regions = regionSource.map((entry) => ({
    ...entry,
    percent: Math.round((entry.value / Math.max(1, totalRegionValue)) * 100),
  }));
  const salesSeries = [24, 28, 35, 32, 40, 46];
  const restockSeries = [18, 21, 25, 23, 31, 34];
  const chartMax = Math.max(...salesSeries, ...restockSeries);
  const salesPoints = salesSeries.map((value, index) => `${index * 68},${130 - Math.round((value / chartMax) * 92)}`).join(' ');
  const restockPoints = restockSeries.map((value, index) => `${index * 68},${130 - Math.round((value / chartMax) * 92)}`).join(' ');
  const auditLogs = state.activity.slice(0, 3).map((entry, index) => ({
    id: `AUD-2023-${9912 + index * 16}`,
    region: index === 0 ? 'Gasabo Hub' : index === 1 ? 'Kicukiro Hub' : 'HQ Kigali',
    count: `${(state.stockItems[index]?.quantity || 0) * (index + 6)} units`,
    status: index === 0 ? 'Approved' : index === 1 ? 'Pending Review' : 'Discrepancy Detected',
    statusTone: index === 0 ? 'good' : index === 1 ? 'pending' : 'bad',
    time: new Date(entry.createdAt).toLocaleString(),
  }));

  return (
    <div className={ui.adminReportsBoard}>
      <div className={ui.adminReportsTop}>
        <div>
          <h1 className={ui.adminReportsTitle}>Reports & Analytics</h1>
          <p className={ui.adminReportsLead}>The Intelligent Ledger visualizing your inventory heartbeat.</p>
        </div>
        <div className={ui.adminReportsActions}>
          <button type="button" className={ui.adminReportsGhostBtn}>Generate CSV</button>
          <button type="button" className={ui.adminReportsPrimaryBtn}>Generate Audit Report</button>
        </div>
      </div>

      <div className={ui.adminReportsHeroGrid}>
        <section className={ui.adminReportsTurnoverCard}>
          <p className={ui.adminReportsMetricLabel}>Inventory Turnover</p>
          <strong className={ui.adminReportsTurnoverValue}>{turnover}</strong>
          <span className={ui.adminReportsMetricMeta}>+12%</span>
          <p className={ui.adminReportsMetricText}>Exceeding industry benchmark by 2.4 points this quarter.</p>
        </section>

        <div className={ui.adminReportsMiniStack}>
          <article className={ui.adminReportsMiniCard}>
            <div className={ui.adminReportsMiniHead}>
              <span className={ui.adminReportsMiniPill}>{stockAccuracy}%</span>
            </div>
            <p className={ui.adminReportsMiniLabel}>Stock Accuracy</p>
            <strong className={ui.adminReportsMiniValue}>Precision Level</strong>
          </article>

          <article className={ui.adminReportsMiniCard}>
            <div className={ui.adminReportsMiniHead}>
              <span className={ui.adminReportsMiniPill}>{fulfillmentRate}%</span>
            </div>
            <p className={ui.adminReportsMiniLabel}>Fulfillment Rate</p>
            <strong className={ui.adminReportsMiniValue}>Global Delivery</strong>
          </article>
        </div>

        <aside className={ui.adminReportsCuratorCard}>
          <p className={ui.adminReportsCuratorEyebrow}>AI Insight Curator</p>
          <h2 className={ui.adminReportsCuratorTitle}>Gasabo region is seeing a significant velocity spike in medical supplies.</h2>
          <p className={ui.adminReportsCuratorText}>
            Recommend restock allocation +15% for the satellite warehouse before Friday to prevent stock pressure.
          </p>
          <div className={ui.adminReportsCuratorFoot}>
            <div className={ui.adminReportsCuratorAvatars}>
              <span>PN</span>
              <span>CM</span>
              <small>+4</small>
            </div>
            <button type="button" className={ui.adminReportsCuratorBtn}>Review Plan</button>
          </div>
        </aside>
      </div>

      <div className={ui.adminReportsMiddleGrid}>
        <section className={ui.adminReportsRegionCard}>
          <div className={ui.adminCardHead}>
            <h2 className={ui.adminReportsSectionTitle}>Regional Distribution</h2>
            <span className={ui.adminReportsDots}>...</span>
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
          <div className={ui.adminReportsRegionMap}>e-CUNGA service map</div>
        </section>

        <section className={ui.adminReportsVelocityCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h2 className={ui.adminReportsSectionTitle}>Turnover Velocity</h2>
              <p className={ui.adminReportsSectionMeta}>Sales vs. Restock Comparison</p>
            </div>
            <div className={ui.adminReportsLegend}>
              <span><i className={ui.adminReportsLegendSales} /> Sales</span>
              <span><i className={ui.adminReportsLegendRestock} /> Restock</span>
            </div>
          </div>
          <svg viewBox="0 0 340 160" className={ui.adminReportsVelocityChart} aria-hidden="true">
            <polyline fill="none" stroke="currentColor" strokeWidth="3" points={salesPoints} className={ui.adminReportsSalesLine} />
            <polyline fill="none" stroke="currentColor" strokeWidth="3" points={restockPoints} className={ui.adminReportsRestockLine} />
          </svg>
          <div className={ui.adminReportsVelocityMonths}>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </section>
      </div>

      <section className={ui.adminReportsAuditCard}>
        <h2 className={ui.adminReportsSectionTitle}>Recent System Audit Logs</h2>
        <div className={ui.adminReportsAuditHead}>
          <span>Audit ID</span>
          <span>Assigned Region</span>
          <span>Inventory Count</span>
          <span>Verification Status</span>
        </div>
        <div className={ui.adminReportsAuditRows}>
          {auditLogs.map((entry) => (
            <article key={entry.id} className={ui.adminReportsAuditRow}>
              <div>
                <p className={ui.adminReportsAuditId}>{entry.id}</p>
                <p className={ui.adminReportsAuditMeta}>{entry.time}</p>
              </div>
              <div><span className={ui.adminReportsAuditRegion}>{entry.region}</span></div>
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
          ))}
        </div>
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
    id: 'faq-mock',
    q: 'Is this environment connected to a live ERP?',
    a: 'This demo runs on a mock portal with local persistence for workshops. Replace mockPortal with your API layer when wiring production; navigation and RBAC patterns stay the same.',
    keys: 'mock demo api production',
  },
];

export function AdminHelpCenter() {
  const state = usePortalState();
  const openReqs = state.requisitions.filter((entry) => entry.status !== 'closed' && entry.status !== 'rejected').length;
  const activeUsers = state.users.filter((entry) => entry.isActive).length;
  const lowStock = state.stockItems.filter((entry) => Number(entry.quantity || 0) <= Number(entry.minThreshold || 0)).length;
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(() => new Set(['faq-invite']));

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADMIN_HELP_FAQ;
    return ADMIN_HELP_FAQ.filter(
      (item) =>
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        item.keys.includes(q)
    );
  }, [query]);

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
        eyebrow="Help center"
        title="Admin playbook & support"
        description="Shortcuts into every admin surface, searchable answers, and channels when you need a human. Built for rollout weeks and day-two operations."
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
          Portal mock · v{String(state.version ?? 3)}
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
            <p className={ui.adminHelpContactEyebrow}>Platform support</p>
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
              filteredFaq.map((item) => {
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
