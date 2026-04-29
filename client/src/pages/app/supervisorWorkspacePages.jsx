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
import { AdminUserEditModal, AdminDeleteConfirmModal } from './adminPages.jsx';

function useSupervisorActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'supervisor'),
    [state.users, user?.email]
  );
}

/** Invite and manage clerk, accountant, and supplier accounts (company supervisor). */
export function SupervisorTeam({ manageFocus = 'all' } = {}) {
  const { t } = useI18n();
  const { user: authUser } = useAuth();
  const { state, inviteWorkspaceUser, toggleWorkspaceUserActive, updateWorkspaceUser, deleteWorkspaceUser } = usePortalData();
  const location = useLocation();
  const navigate = useNavigate();
  const actor = useSupervisorActor(state, authUser);
  const lockedRole = manageFocus === 'accountant' || manageFocus === 'supplier' ? manageFocus : null;
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    role: lockedRole || 'clerk',
    team: 'Operations',
    location: 'HQ Kigali',
  });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(lockedRole || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
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

  useEffect(() => {
    if (lockedRole) {
      setRoleFilter(lockedRole);
      setForm((f) => ({ ...f, role: lockedRole }));
      return;
    }
    setRoleFilter('all');
    setForm((f) => ({ ...f, role: 'clerk' }));
  }, [lockedRole]);

  const effectiveRoleFilter = lockedRole || roleFilter;

  const rows = state.users
    .filter((entry) => {
      const searchText = `${entry.fullName} ${entry.email}`.toLowerCase();
      const tokens = [search, shellUserSearch]
        .map((s) => String(s || '').trim().toLowerCase())
        .filter(Boolean);
      const matchesSearch = tokens.length === 0 || tokens.every((tok) => searchText.includes(tok));
      const matchesRole = effectiveRoleFilter === 'all' || entry.role === effectiveRoleFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? entry.isActive : !entry.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt || b.invitedAt || 0) - new Date(a.createdAt || a.invitedAt || 0));

  const usersPager = usePagedList(rows, { resetKey: `${search}|${shellUserSearch}|${effectiveRoleFilter}|${statusFilter}` });

  async function invite(e) {
    e.preventDefault();
    try {
      const data = await inviteWorkspaceUser(form, actor?.id);
      if (data?.inviteEmailSent) {
        alert('We sent an email with a 6-digit code. They should use Activate account to set a password.');
      } else if (data?.temporaryPassword) {
        alert(`User added. Temporary password: ${data.temporaryPassword}`);
      }
      setForm({ email: '', fullName: '', role: lockedRole || 'clerk', team: 'Operations', location: 'HQ Kigali' });
      setShowInviteForm(false);
    } catch (err) {
      alert(err?.message || 'Unable to invite user.');
    }
  }

  return (
    <div className={ui.adminUsersBoard}>
      <div className={ui.adminUsersTop}>
        <div>
          <h1 className={ui.adminUsersTitle}>
            {manageFocus === 'accountant'
              ? t('app.supervisor.teamAccountantsTitle')
              : manageFocus === 'supplier'
                ? t('app.supervisor.teamSuppliersTitle')
                : t('app.supervisor.teamTitle')}
          </h1>
          <p className={ui.adminUsersLead}>
            {manageFocus === 'accountant'
              ? t('app.supervisor.teamAccountantsLead')
              : manageFocus === 'supplier'
                ? t('app.supervisor.teamSuppliersLead')
                : t('app.supervisor.teamLead')}
          </p>
        </div>
        <button
          type="button"
          className={ui.adminUsersAddBtn}
          onClick={() => setShowInviteForm((c) => !c)}
          disabled={state.users.length >= (state.company?.usersLimit || 999)}
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
            {lockedRole ? (
              <span className={ui.adminUsersSectionMeta} style={{ alignSelf: 'center', padding: '0 0.25rem' }}>
                {t(`roles.${lockedRole}`)}
              </span>
            ) : (
              <select className={ui.select} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="clerk">{t('app.supervisor.teamRoleClerk')}</option>
                <option value="accountant">{t('app.supervisor.teamRoleAccountant')}</option>
                <option value="supplier">{t('app.supervisor.teamRoleSupplier')}</option>
              </select>
            )}
            <input className={ui.input} placeholder={t('app.supervisor.teamFieldTeam')} value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldLocation')}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <button type="submit" className={ui.adminPrimaryBtn} disabled={state.users.length >= (state.company?.usersLimit || 999)}>
              {t('app.supervisor.teamSaveUser')}
            </button>
          </form>
        </section>
      ) : null}

      <SupervisorUserViewModal isOpen={Boolean(viewingUser)} user={viewingUser} onClose={() => setViewingUser(null)} />
      <AdminUserEditModal
        isOpen={Boolean(editingUser)}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSave={async (patch) => {
          try {
            await updateWorkspaceUser(editingUser.id, patch, actor?.id);
            setEditingUser(null);
            alert(t('app.supervisor.teamUserUpdated'));
          } catch (err) {
            alert(err?.message || 'Unable to update user.');
          }
        }}
        isPlatformTenant={false}
        supervisorOperationalRoster
      />
      <AdminDeleteConfirmModal
        isOpen={Boolean(deletingUser)}
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={async () => {
          if (deletingUser?.id === authUser?.id) {
            alert(t('app.supervisor.teamCannotDeleteSelf'));
            setDeletingUser(null);
            return;
          }
          try {
            await deleteWorkspaceUser(deletingUser.id, actor?.id);
            setDeletingUser(null);
            alert(t('app.supervisor.teamUserDeleted'));
          } catch (err) {
            alert(err?.message || 'Unable to delete user.');
          }
        }}
      />

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
          {lockedRole ? null : (
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
          )}
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
                  <div className={ui.adminUsersActionsWrap} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    <button type="button" className={ui.adminUsersActionBtn} onClick={() => setViewingUser(entry)}>
                      {t('app.supervisor.teamActionView')}
                    </button>
                    {['clerk', 'accountant', 'supplier'].includes(entry.role) ? (
                      <>
                        <button type="button" className={ui.adminUsersActionBtn} onClick={() => setEditingUser(entry)}>
                          {t('app.supervisor.teamActionEdit')}
                        </button>
                        <button
                          type="button"
                          className={ui.adminUsersActionBtn}
                          onClick={() => {
                            if (entry.id === authUser?.id) {
                              alert(t('app.supervisor.teamCannotDeleteSelf'));
                              return;
                            }
                            setDeletingUser(entry);
                          }}
                          disabled={entry.id === authUser?.id}
                          style={entry.id === authUser?.id ? undefined : { borderColor: '#fecaca', color: '#b91c1c' }}
                        >
                          {t('app.supervisor.teamActionDelete')}
                        </button>
                        <button type="button" className={ui.adminUsersActionBtn} onClick={() => toggleWorkspaceUserActive(entry.id, actor?.id)}>
                          {entry.isActive ? t('app.supervisor.teamDeactivate') : t('app.supervisor.teamActivate')}
                        </button>
                      </>
                    ) : (
                      <span className={ui.adminUsersSectionMeta}>{t('app.supervisor.teamNoAction')}</span>
                    )}
                  </div>
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

export function SupervisorUserViewModal({ isOpen, user, onClose }) {
  if (!isOpen || !user) return null;
  return (
    <div className={ui.adminModalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <section className={ui.adminModalInvite} style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <header className={ui.adminCardHead}>
          <div>
            <h2 className={ui.adminUsersSectionTitle}>User details</h2>
            <p className={ui.adminUsersSectionMeta}>{user.email}</p>
          </div>
          <button type="button" className={ui.adminModalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={ui.adminUsersInviteFormModal} style={{ display: 'grid', gap: '0.65rem' }}>
          <p style={{ margin: 0 }}>
            <strong>Name:</strong> {user.fullName}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Role:</strong> {user.role}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Team:</strong> {user.team || '—'}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Location:</strong> {user.location || '—'}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Status:</strong> {user.isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
        <div className={ui.adminModalFoot}>
          <button type="button" className={ui.adminPrimaryBtn} onClick={onClose}>
            Close
          </button>
        </div>
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
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [editIndustry, setEditIndustry] = useState('');

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

  async function reject(companyId) {
    if (!window.confirm('Are you sure you want to reject this registration?')) return;
    setBusyId(companyId);
    setError('');
    try {
      await apiFetch('/registrations/reject-company', {
        method: 'POST',
        body: JSON.stringify({ companyId }),
      });
      await load();
    } catch (e) {
      setError(e.body?.error || e.message || 'Reject failed.');
    } finally {
      setBusyId('');
    }
  }

  async function saveEdit() {
    setBusyId(editingId);
    setError('');
    try {
      await apiFetch('/registrations/update-company', {
        method: 'PATCH',
        body: JSON.stringify({ companyId: editingId, name: editName, industry: editIndustry }),
      });
      setEditingId('');
      await load();
    } catch (e) {
      setError(e.body?.error || e.message || 'Update failed.');
    } finally {
      setBusyId('');
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditIndustry(c.industry || '');
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
              {editingId === c.id ? (
                <>
                  <div>
                    <input className={ui.input} value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem' }} />
                    <p className={ui.adminUsersEmail}>{c.id}</p>
                  </div>
                  <div>
                    <input className={ui.input} value={editIndustry} onChange={(e) => setEditIndustry(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem' }} />
                  </div>
                  <div>
                    <p className={ui.adminUsersName}>{c.contactName || '—'}</p>
                    <p className={ui.adminUsersEmail}>{c.contactEmail || '—'}</p>
                  </div>
                  <div className={ui.adminUsersDate}>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</div>
                  <div className={ui.adminUsersActions} style={{ gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" className={ui.adminPrimaryBtn} disabled={busyId === c.id} onClick={saveEdit}>
                      Save
                    </button>
                    <button type="button" className={ui.btnOutline} disabled={busyId === c.id} onClick={() => setEditingId('')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
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
                  <div className={ui.adminUsersActions} style={{ gap: '0.4rem', flexWrap: 'nowrap', justifyContent: 'flex-end', display: 'flex' }}>
                    <button type="button" className={ui.adminPrimaryBtn} disabled={busyId === c.id} onClick={() => approve(c.id)} title="Approve" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0, flexShrink: 0 }}>
                      {busyId === c.id ? '…' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>}
                    </button>
                    <button type="button" className={ui.btnOutline} disabled={busyId === c.id} onClick={() => startEdit(c)} title="Edit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0, flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button type="button" className={ui.btnOutline} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0, flexShrink: 0, borderColor: '#dc2626', color: '#dc2626' }} disabled={busyId === c.id} onClick={() => reject(c.id)} title="Reject">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
