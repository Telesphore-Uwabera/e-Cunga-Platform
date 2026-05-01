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
import { DocumentViewerModal, InvoiceDocumentButtonGroup } from '../../components/InvoiceDocumentActions.jsx';
import { workflowLabel } from './roleUi.jsx';
import { useFlash } from '../../context/FlashContext.jsx';

function useSupervisorActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'supervisor'),
    [state.users, user?.email]
  );
}

function SupervisorTeamRowIcon({ kind }) {
  const c = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'view') {
    return (
      <svg {...c}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.55" />
      </svg>
    );
  }
  if (kind === 'edit') {
    return (
      <svg {...c}>
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'delete') {
    return (
      <svg {...c}>
        <path d="M3 6h18M8 6V4h8v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12zM10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'toggle') {
    return (
      <svg {...c}>
        <path d="M12 3v9" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
        <path d="M18.36 7.64a9 9 0 11-12.72 0" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

/** Invite and manage clerk and accountant accounts; supplier accounts are linked via Suppliers / marketplace flows. */
export function SupervisorTeam({ manageFocus = 'all' } = {}) {
  const { t } = useI18n();
  const { showFlash, FlashBanner } = useFlash();
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
    if (lockedRole === 'supplier') {
      navigate('/app/supervisor/supplier-directory', { replace: true, state: {} });
      return;
    }
    setShowInviteForm(true);
    requestAnimationFrame(() => {
      document.getElementById('supervisor-invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, lockedRole]);

  useEffect(() => {
    function onOpenInvite() {
      if (lockedRole === 'supplier') {
        navigate('/app/supervisor/supplier-directory');
        return;
      }
      setShowInviteForm(true);
      requestAnimationFrame(() => {
        document.getElementById('supervisor-invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    window.addEventListener('ecunga-supervisor-team-open-invite', onOpenInvite);
    return () => window.removeEventListener('ecunga-supervisor-team-open-invite', onOpenInvite);
  }, [lockedRole, navigate]);

  useEffect(() => {
    if (lockedRole) {
      setRoleFilter(lockedRole);
      setForm((f) => ({ ...f, role: lockedRole }));
      return;
    }
    setRoleFilter('all');
    setForm((f) => ({ ...f, role: 'clerk' }));
  }, [lockedRole]);

  /** Supervisors do not invite suppliers from this form (use supplier directory / other flows). */
  useEffect(() => {
    if (lockedRole || form.role !== 'supplier') return;
    setForm((f) => ({ ...f, role: 'clerk' }));
  }, [lockedRole, form.role]);

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
      if (data?.inviteEmailSent && data?.inviteEmailKind === 'otp') {
        showFlash(t('app.supervisor.teamInviteSuccessOtp'), 'ok');
      } else if (data?.inviteEmailSent && data?.inviteEmailKind === 'temporary_password') {
        showFlash(t('app.supervisor.teamInviteSuccessTempPasswordEmail'), 'ok');
      } else if (data?.temporaryPassword) {
        showFlash(t('app.supervisor.teamInviteSuccessTempPasswordManual', { password: data.temporaryPassword }), 'ok');
      }
      setForm({ email: '', fullName: '', role: lockedRole || 'clerk', team: 'Operations', location: 'HQ Kigali' });
      setShowInviteForm(false);
    } catch (err) {
      showFlash(err?.message || t('app.supervisor.teamInviteError'), 'error');
    }
  }

  return (
    <div className={ui.adminUsersBoard}>
      <FlashBanner />
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
          onClick={() =>
            manageFocus === 'supplier'
              ? navigate('/app/supervisor/supplier-directory')
              : setShowInviteForm((c) => !c)
          }
          disabled={manageFocus === 'supplier' ? false : state.users.length >= (state.company?.usersLimit || 999)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14M19 7h-4M7 19v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {manageFocus === 'supplier'
            ? t('app.supervisor.teamAddSupplier')
            : manageFocus === 'accountant'
              ? t('app.supervisor.teamAddAccountant')
              : t('app.supervisor.teamAddUser')}
        </button>
      </div>

      {showInviteForm && manageFocus !== 'supplier' ? (
        <section id="supervisor-invite-section" className={ui.adminUsersInviteCard}>
          <div className={ui.adminCardHead}>
            <div>
              <h2 className={ui.adminUsersSectionTitle}>
                {manageFocus === 'accountant' ? t('app.supervisor.teamInviteTitleAccountant') : t('app.supervisor.teamInviteTitle')}
              </h2>
              <p className={ui.adminUsersSectionMeta}>
                {manageFocus === 'accountant' ? t('app.supervisor.teamInviteMetaAccountant') : t('app.supervisor.teamInviteMeta')}
              </p>
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
              {manageFocus === 'accountant' ? t('app.supervisor.teamSaveAccountant') : t('app.supervisor.teamSaveUser')}
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
        supervisorOperationalIncludeSupplier={manageFocus === 'supplier'}
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
          {manageFocus === 'supplier' ? t('app.supervisor.teamSuppliersRosterHint') : t('app.supervisor.teamRosterHint')}
        </p>
        <div className={`${ui.adminUsersFilterRow} ${ui.supervisorTeamFilterRow}`}>
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

        <div className={`${ui.adminUsersTableHead} ${ui.supervisorTeamRosterGrid}`}>
          <span>{t('app.supervisor.teamColIdentity')}</span>
          <span>{t('app.supervisor.teamColRole')}</span>
          <span>{t('app.supervisor.teamColStatus')}</span>
          <span>{t('app.supervisor.teamColAdded')}</span>
          <span>{t('app.supervisor.teamColActions')}</span>
        </div>

        <div className={ui.adminUsersRows}>
          {rows.length ? (
            usersPager.pageSlice.map((entry, index) => (
              <article key={entry.id} className={`${ui.adminUsersRow} ${ui.supervisorTeamRosterGrid}`}>
                <div className={`${ui.adminUsersIdentity} ${ui.supervisorTeamIdentity}`}>
                  {entry.incrementalId != null ? (
                    <p className={ui.adminUsersRecordId} title="Record ID">
                      ID {entry.incrementalId}
                    </p>
                  ) : null}
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
                  <div className={ui.supervisorTeamRowActions}>
                    <button
                      type="button"
                      className={ui.supervisorClerkIconBtn}
                      onClick={() => setViewingUser(entry)}
                      aria-label={t('app.supervisor.teamActionView')}
                      title={t('app.supervisor.teamActionView')}
                    >
                      <SupervisorTeamRowIcon kind="view" />
                    </button>
                    {['clerk', 'accountant', 'supplier'].includes(entry.role) ? (
                      <>
                        <button
                          type="button"
                          className={ui.supervisorClerkIconBtn}
                          onClick={() => setEditingUser(entry)}
                          aria-label={t('app.supervisor.teamActionEdit')}
                          title={t('app.supervisor.teamActionEdit')}
                        >
                          <SupervisorTeamRowIcon kind="edit" />
                        </button>
                        <button
                          type="button"
                          className={`${ui.supervisorClerkIconBtn} ${ui.supervisorTeamIconBtnDanger}`}
                          onClick={() => {
                            if (entry.id === authUser?.id) {
                              alert(t('app.supervisor.teamCannotDeleteSelf'));
                              return;
                            }
                            setDeletingUser(entry);
                          }}
                          disabled={entry.id === authUser?.id}
                          aria-label={t('app.supervisor.teamActionDelete')}
                          title={t('app.supervisor.teamActionDelete')}
                        >
                          <SupervisorTeamRowIcon kind="delete" />
                        </button>
                        <button
                          type="button"
                          className={ui.supervisorClerkIconBtn}
                          onClick={() => toggleWorkspaceUserActive(entry.id, actor?.id)}
                          aria-label={entry.isActive ? t('app.supervisor.teamDeactivate') : t('app.supervisor.teamActivate')}
                          title={entry.isActive ? t('app.supervisor.teamDeactivate') : t('app.supervisor.teamActivate')}
                        >
                          <SupervisorTeamRowIcon kind="toggle" />
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
            <p className={ui.adminUsersSectionMeta}>
              {manageFocus === 'supplier' ? t('app.supervisor.teamSuppliersEmpty') : t('app.supervisor.teamEmpty')}
            </p>
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
  const { t } = useI18n();
  const { state } = usePortalData();
  const [docPreview, setDocPreview] = useState(null);
  const accountantInvoices = useMemo(() => {
    if (!user || user.role !== 'accountant') return [];
    const allInvoices = [...(state.invoices || [])].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
    const activeAccountants = (state.users || []).filter((u) => u.role === 'accountant' && u.isActive).length;
    if (activeAccountants <= 1) return allInvoices;
    const touched = new Set();
    for (const a of state.activity || []) {
      if (a.actorId !== user.id) continue;
      const id = a.meta?.invoiceId;
      if (id) touched.add(id);
    }
    return allInvoices.filter((inv) => touched.has(inv.id));
  }, [state.activity, state.invoices, state.users, user]);

  if (!isOpen || !user) return null;
  return (
    <>
    <div className={ui.adminModalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <section
        className={`${ui.adminModalInvite} ${ui.supervisorUserViewCard}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`${ui.adminCardHead} ${ui.supervisorUserViewHead}`}>
          <div className={ui.supervisorUserViewHeadText}>
            <h2 className={ui.adminUsersSectionTitle}>User details</h2>
            <p className={ui.adminUsersSectionMeta}>{user.email}</p>
          </div>
          <button type="button" className={ui.adminModalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={`${ui.adminUsersInviteFormModal} ${ui.supervisorUserViewBody}`}>
          {user.role === 'accountant' ? (
            <div className={ui.supervisorUserViewStack}>
              <dl className={ui.supervisorUserViewDl}>
                <div>
                  <dt>Name</dt>
                  <dd>{user.fullName}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{user.role}</dd>
                </div>
                <div>
                  <dt>Team</dt>
                  <dd>{user.team || '—'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{user.location || '—'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{user.isActive ? 'Active' : 'Inactive'}</dd>
                </div>
              </dl>
              <section className={ui.supervisorFinanceCard} aria-labelledby="supervisor-accountant-docs-title">
                <div className={ui.supervisorSectionHead}>
                  <div>
                    <h3 id="supervisor-accountant-docs-title" className={ui.supervisorSectionTitle}>
                      Accountant documents
                    </h3>
                    <p className={ui.supervisorSectionMeta}>Invoices and supporting documents for this accountant.</p>
                    <p className={ui.supervisorAccountantWorkflowHint}>
                      {t('app.supervisor.supervisorAccountantDocsWorkflow')}
                    </p>
                  </div>
                </div>
                <div className={`${ui.supervisorFinanceList} ${ui.supervisorUserViewDocList}`}>
                  {accountantInvoices.length ? (
                    accountantInvoices.map((invoice) => (
                      <article key={invoice.id} className={ui.supervisorFinanceRow}>
                        <div>
                          <p className={ui.supervisorFinanceTitle}>{invoice.reference}</p>
                          <InvoiceDocumentButtonGroup
                            invoice={invoice}
                            onPreview={(url, title) => setDocPreview({ url, title })}
                          />
                        </div>
                        <span className={ui.supervisorFinanceStatus}>{workflowLabel(invoice.status)}</span>
                      </article>
                    ))
                  ) : (
                    <p className={ui.supervisorSectionMeta}>No invoice activity linked to this accountant yet.</p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <dl className={ui.supervisorUserViewDl}>
              <div>
                <dt>Name</dt>
                <dd>{user.fullName}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{user.role}</dd>
              </div>
              <div>
                <dt>Team</dt>
                <dd>{user.team || '—'}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{user.location || '—'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{user.isActive ? 'Active' : 'Inactive'}</dd>
              </div>
            </dl>
          )}
        </div>
        <div className={`${ui.adminModalFoot} ${ui.supervisorUserViewFoot}`}>
          <button type="button" className={ui.adminPrimaryBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
    <DocumentViewerModal
      open={Boolean(docPreview?.url)}
      title={docPreview?.title}
      url={docPreview?.url}
      onClose={() => setDocPreview(null)}
    />
    </>
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
