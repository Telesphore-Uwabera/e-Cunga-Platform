import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { usePortalData } from '../../context/PortalStateContext.jsx';
import { apiFetch } from '../../api/client.js';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { useShellSearchQuery } from '../../hooks/useShellSearchQuery.js';
import ui from './DashboardUi.module.css';
import auth from '../auth/AuthForms.module.css';

function useSupervisorActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'supervisor'),
    [state.users, user?.email]
  );
}

/** Invite and manage clerk, accountant, and supplier accounts (company supervisor). */
export function SupervisorTeam() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { state, inviteWorkspaceUser, toggleWorkspaceUserActive } = usePortalData();
  const location = useLocation();
  const navigate = useNavigate();
  const actor = useSupervisorActor(state, user);
  const [form, setForm] = useState({ email: '', fullName: '', role: 'clerk', team: 'Operations', location: 'HQ Kigali' });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const shellUserSearch = useShellSearchQuery();

  useEffect(() => {
    if (!location.state?.openInvite) return;
    setShowInviteForm(true);
    requestAnimationFrame(() => {
      document.getElementById('supervisor-invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    function onOpenInvite() {
      setShowInviteForm(true);
      requestAnimationFrame(() => {
        document.getElementById('supervisor-invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    window.addEventListener('ecunga-supervisor-team-open-invite', onOpenInvite);
    return () => window.removeEventListener('ecunga-supervisor-team-open-invite', onOpenInvite);
  }, []);

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

  async function invite(e) {
    e.preventDefault();
    try {
      const data = await inviteWorkspaceUser(form, actor?.id);
      if (data?.inviteEmailSent) {
        alert('We sent an email with a 6-digit code. They should use Activate account to set a password.');
      } else if (data?.temporaryPassword) {
        alert(`User added. Temporary password: ${data.temporaryPassword}`);
      }
      setForm({ email: '', fullName: '', role: 'clerk', team: 'Operations', location: 'HQ Kigali' });
      setShowInviteForm(false);
    } catch (err) {
      alert(err?.message || 'Unable to invite user.');
    }
  }

  return (
    <div className={ui.adminUsersBoard}>
      <div className={ui.adminUsersTop}>
        <div>
          <h1 className={ui.adminUsersTitle}>{t('app.supervisor.teamTitle')}</h1>
          <p className={ui.adminUsersLead}>{t('app.supervisor.teamLead')}</p>
        </div>
        <button
          type="button"
          className={ui.adminUsersAddBtn}
          onClick={() => setShowInviteForm((c) => !c)}
          disabled={state.users.length >= state.company.usersLimit}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14M19 7h-4M7 19v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {t('app.supervisor.teamAddUser')}
        </button>
      </div>

      {showInviteForm ? (
        <section id="supervisor-invite-section" className={ui.adminUsersInviteCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h2 className={ui.adminUsersSectionTitle}>{t('app.supervisor.teamInviteTitle')}</h2>
              <p className={ui.adminUsersSectionMeta}>{t('app.supervisor.teamInviteMeta')}</p>
            </div>
          </div>
          <form onSubmit={invite} className={ui.adminUsersInviteForm}>
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldEmail')}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldName')}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
            <select className={ui.select} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="clerk">{t('app.supervisor.teamRoleClerk')}</option>
              <option value="accountant">{t('app.supervisor.teamRoleAccountant')}</option>
              <option value="supplier">{t('app.supervisor.teamRoleSupplier')}</option>
            </select>
            <input className={ui.input} placeholder={t('app.supervisor.teamFieldTeam')} value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldLocation')}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <button type="submit" className={ui.adminPrimaryBtn} disabled={state.users.length >= state.company.usersLimit}>
              {t('app.supervisor.teamSaveUser')}
            </button>
          </form>
        </section>
      ) : null}

      <section className={ui.adminUsersLedgerCard}>
        <p className={ui.adminUsersSectionMeta} style={{ margin: '0 0 0.75rem' }}>
          {t('app.supervisor.teamRosterHint')}
        </p>
        <div className={ui.adminUsersFilterRow}>
          <label className={ui.adminUsersSearchField}>
            <span className={ui.adminUsersFieldLabel}>{t('app.supervisor.teamSearchLabel')}</span>
            <div className={ui.adminUsersSearchInputWrap}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm8 2-4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                className={ui.adminUsersSearchInput}
                placeholder={t('app.supervisor.teamSearchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>
          <label className={ui.adminUsersFilterField}>
            <span className={ui.adminUsersFieldLabel}>{t('app.supervisor.teamRoleFilter')}</span>
            <select className={ui.adminUsersSelect} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">{t('app.supervisor.teamFilterAll')}</option>
              <option value="supervisor">{t('roles.supervisor')}</option>
              <option value="clerk">{t('roles.clerk')}</option>
              <option value="accountant">{t('roles.accountant')}</option>
              <option value="supplier">{t('roles.supplier')}</option>
            </select>
          </label>
          <label className={ui.adminUsersFilterField}>
            <span className={ui.adminUsersFieldLabel}>{t('app.supervisor.teamStatusFilter')}</span>
            <select className={ui.adminUsersSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('app.supervisor.teamFilterAll')}</option>
              <option value="active">{t('app.supervisor.teamStatusActive')}</option>
              <option value="inactive">{t('app.supervisor.teamStatusInactive')}</option>
            </select>
          </label>
        </div>

        <div className={ui.adminUsersTableHead}>
          <span>{t('app.supervisor.teamColIdentity')}</span>
          <span>{t('app.supervisor.teamColRole')}</span>
          <span>{t('app.supervisor.teamColStatus')}</span>
          <span>{t('app.supervisor.teamColAdded')}</span>
          <span>{t('app.supervisor.teamColActions')}</span>
        </div>

        <div className={ui.adminUsersRows}>
          {rows.length ? (
            usersPager.pageSlice.map((entry, index) => (
              <article key={entry.id} className={ui.adminUsersRow}>
                <div className={`${ui.adminUsersIdentity} ${ui.supervisorTeamIdentity}`}>
                  <p className={ui.adminUsersName}>{entry.fullName}</p>
                  <p className={ui.adminUsersEmail}>{entry.email}</p>
                </div>
                <div>
                  <span className={ui.adminUsersRoleSelect}>{entry.role}</span>
                </div>
                <div>
                  <span className={entry.isActive ? ui.adminUsersStatusActive : index % 3 === 1 ? ui.adminUsersStatusPending : ui.adminUsersStatusInactive}>
                    {entry.isActive ? t('app.supervisor.teamStatusActive') : t('app.supervisor.teamStatusInactive')}
                  </span>
                </div>
                <div className={ui.adminUsersDate}>—</div>
                <div className={ui.adminUsersActions}>
                  {['clerk', 'accountant', 'supplier'].includes(entry.role) ? (
                    <button type="button" className={ui.adminUsersActionBtn} onClick={() => toggleWorkspaceUserActive(entry.id, actor?.id)}>
                      {entry.isActive ? t('app.supervisor.teamDeactivate') : t('app.supervisor.teamActivate')}
                    </button>
                  ) : (
                    <span className={ui.adminUsersSectionMeta}>{t('app.supervisor.teamNoAction')}</span>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className={ui.adminUsersSectionMeta}>{t('app.supervisor.teamEmpty')}</p>
          )}
        </div>
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
      </section>
    </div>
  );
}

/** Platform-tenant supervisors: approve pending company registrations. */
export function SupervisorCompanyRegistrations() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/registrations/pending-companies');
      setCompanies(Array.isArray(data.companies) ? data.companies : []);
    } catch (e) {
      setError(e.body?.error || e.message || 'Unable to load list.');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(companyId) {
    setBusyId(companyId);
    setError('');
    try {
      await apiFetch('/registrations/approve-company', {
        method: 'POST',
        body: JSON.stringify({ companyId }),
      });
      await load();
    } catch (e) {
      setError(e.body?.error || e.message || 'Approval failed.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className={ui.adminUsersBoard}>
      <div className={ui.adminUsersTop}>
        <div>
          <h1 className={ui.adminUsersTitle}>{t('nav.admin.company-registrations')}</h1>
          <p className={ui.adminUsersLead}>Check new companies and approve them so the supervisor can sign in.</p>
        </div>
        <button type="button" className={ui.adminUsersAddBtn} onClick={() => load()} disabled={loading}>
          Refresh
        </button>
      </div>
      {error ? (
        <p className={auth.error} role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className={ui.adminUsersSectionMeta}>Loading…</p> : null}
      {!loading && !companies.length ? <p className={ui.adminUsersSectionMeta}>No pending registrations.</p> : null}
      <section className={ui.adminUsersLedgerCard}>
        <div className={ui.adminUsersTableHead}>
          <span>Company</span>
          <span>Industry</span>
          <span>Contact</span>
          <span>Submitted</span>
          <span />
        </div>
        <div className={ui.adminUsersRows}>
          {companies.map((c) => (
            <article key={c.id} className={ui.adminUsersRow}>
              <div>
                <p className={ui.adminUsersName}>{c.name}</p>
                <p className={ui.adminUsersEmail}>{c.id}</p>
              </div>
              <div>{c.industry || '—'}</div>
              <div>
                <p className={ui.adminUsersName}>{c.contactName || '—'}</p>
                <p className={ui.adminUsersEmail}>{c.contactEmail || '—'}</p>
              </div>
              <div className={ui.adminUsersDate}>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</div>
              <div className={ui.adminUsersActions}>
                <button type="button" className={ui.adminPrimaryBtn} disabled={busyId === c.id} onClick={() => approve(c.id)}>
                  {busyId === c.id ? '…' : 'Approve'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
