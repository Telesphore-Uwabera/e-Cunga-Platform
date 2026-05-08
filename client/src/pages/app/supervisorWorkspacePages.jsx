import { ConfirmModal } from '../../components/ConfirmModal.jsx';
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
  const { showFlash } = useFlash();
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
    jobTitle: '',
    phone: '',
    location: '',
    department: '',
  });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(lockedRole || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [toggleBusyId, setToggleBusyId] = useState(null);
  const shellUserSearch = useShellSearchQuery();
  const linkedSupplierCompanyIds = useMemo(
    () => new Set((state.company?.linkedSupplierCompanyIds || []).map(String)),
    [state.company?.linkedSupplierCompanyIds]
  );

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
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const data = await inviteWorkspaceUser(form, actor?.id);
      if (data?.inviteEmailSent && data?.inviteEmailKind === 'otp') {
        showFlash(t('app.supervisor.teamInviteSuccessOtp'), 'ok');
      } else if (data?.inviteEmailSent && data?.inviteEmailKind === 'temporary_password') {
        showFlash(t('app.supervisor.teamInviteSuccessTempPasswordEmail'), 'ok');
      } else if (data?.temporaryPassword) {
        showFlash(t('app.supervisor.teamInviteSuccessTempPasswordManual', { password: data.temporaryPassword }), 'ok');
      }
      setForm({ email: '', fullName: '', role: lockedRole || 'clerk', jobTitle: '', phone: '', location: '', department: '' });
      setShowInviteForm(false);
    } catch (err) {
      showFlash(err?.message || t('app.supervisor.teamInviteError'), 'error');
    } finally {
      setInviteBusy(false);
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
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldTeam')}
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            />
            <input
              className={ui.input}
              type="tel"
              autoComplete="tel"
              placeholder={t('app.supervisor.teamFieldPhone')}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldLocation')}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <input
              className={ui.input}
              placeholder={t('app.supervisor.teamFieldDepartment')}
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
            <button
              type="submit"
              className={ui.adminPrimaryBtn}
              disabled={inviteBusy || state.users.length >= (state.company?.usersLimit || 999)}
            >
              {inviteBusy ? (
                <span className={ui.adminModalBtnContent}>
                  <span className={ui.adminBtnSpinner} aria-hidden />
                  {t('app.supervisor.teamInviteSubmitting')}
                </span>
              ) : manageFocus === 'accountant' ? (
                t('app.supervisor.teamSaveAccountant')
              ) : (
                t('app.supervisor.teamSaveUser')
              )}
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
            showFlash(t('app.supervisor.teamUserUpdated'), 'ok');
          } catch (err) {
            showFlash(err?.message || 'Unable to update user.', 'error');
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
            showFlash(t('app.supervisor.teamCannotDeleteSelf'), 'warn');
            throw new Error('Cannot delete self');
          }
          const removed = deletingUser;
          try {
            await deleteWorkspaceUser(removed.id, actor?.id);
            showFlash(
              t('app.supervisor.teamUserDeleted', { name: removed.fullName || removed.email || 'Member' }),
              'ok'
            );
          } catch (err) {
            showFlash(err?.message || 'Unable to delete user.', 'error');
            throw err;
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
                  {entry.role === 'supplier' && entry.isActive && linkedSupplierCompanyIds.has(String(entry.companyId)) ? (
                    <span className={ui.adminUsersStatusConnected}>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t('app.supervisor.teamStatusConnected')}
                    </span>
                  ) : (
                    <span
                      className={
                        entry.isActive ? ui.adminUsersStatusActive : index % 3 === 1 ? ui.adminUsersStatusPending : ui.adminUsersStatusInactive
                      }
                    >
                      {entry.isActive ? t('app.supervisor.teamStatusActive') : t('app.supervisor.teamStatusInactive')}
                    </span>
                  )}
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
                              showFlash(t('app.supervisor.teamCannotDeleteSelf'), 'warn');
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
                          disabled={toggleBusyId === entry.id}
                          aria-busy={toggleBusyId === entry.id}
                          onClick={async () => {
                            if (toggleBusyId) return;
                            setToggleBusyId(entry.id);
                            try {
                              await toggleWorkspaceUserActive(entry.id, actor?.id);
                              showFlash(t('app.supervisor.teamAccessUpdated'), 'ok');
                            } catch (err) {
                              showFlash(err?.message || 'Unable to update access.', 'error');
                            } finally {
                              setToggleBusyId(null);
                            }
                          }}
                          aria-label={entry.isActive ? t('app.supervisor.teamDeactivate') : t('app.supervisor.teamActivate')}
                          title={entry.isActive ? t('app.supervisor.teamDeactivate') : t('app.supervisor.teamActivate')}
                        >
                          {toggleBusyId === entry.id ? (
                            <span className={`${ui.adminBtnSpinner} ${ui.adminBtnSpinnerDark}`} aria-hidden />
                          ) : (
                            <SupervisorTeamRowIcon kind="toggle" />
                          )}
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
    // Show all invoices in the organization for accountants
    return [...(state.invoices || [])].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
  }, [state.invoices, user]);

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
                  <dt>{t('app.supervisor.workspaceRoleLabel')}</dt>
                  <dd>{t(`roles.${user.role}`)}</dd>
                </div>
                <div>
                  <dt>{t('app.supervisor.teamFieldTeam')}</dt>
                  <dd>{(user.jobTitle || user.team || '').trim() || '—'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{user.phone || '—'}</dd>
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
                <dt>{t('app.supervisor.workspaceRoleLabel')}</dt>
                <dd>{t(`roles.${user.role}`)}</dd>
              </div>
              <div>
                <dt>{t('app.supervisor.teamFieldTeam')}</dt>
                <dd>{(user.jobTitle || user.team || '').trim() || '—'}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{user.phone || '—'}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{user.location || '—'}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{user.department || '—'}</dd>
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

function fmt(v) {
  const s = v != null ? String(v).trim() : '';
  return s || '—';
}

function fmtSubmittedDate(iso) {
  if (iso == null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function PendingCompanyDetailModal({ company, onClose }) {
  if (!company) return null;

  return (
    <div className={ui.adminModalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <section
        className={`${ui.adminModalInvite} ${ui.supervisorUserViewCard} ${ui.pendingRegDetailModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`${ui.adminCardHead} ${ui.supervisorUserViewHead}`}>
          <div className={ui.supervisorUserViewHeadText}>
            <h2 className={ui.adminUsersSectionTitle}>Company registration details</h2>
            <p className={ui.adminUsersSectionMeta}>{fmt(company.name)}</p>
          </div>
          <button type="button" className={ui.adminModalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={`${ui.adminUsersInviteFormModal} ${ui.supervisorUserViewBody}`}>
          <div className={ui.pendingRegDetailGrids}>
            <section className={ui.pendingRegDetailGrid} aria-labelledby="pending-reg-company-heading">
              <h3 id="pending-reg-company-heading" className={ui.pendingRegDetailGridTitle}>
                Company
              </h3>
              <dl className={ui.supervisorUserViewDl}>
                <div>
                  <dt>Company ID</dt>
                  <dd>{fmt(company.id)}</dd>
                </div>
                <div>
                  <dt>Legal name</dt>
                  <dd>{fmt(company.legalName)}</dd>
                </div>
                <div>
                  <dt>Industry</dt>
                  <dd>{fmt(company.industry)}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{fmt(company.type)}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{fmt(company.location)}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{fmt(company.address)}</dd>
                </div>
                <div>
                  <dt>Tax ID</dt>
                  <dd>{fmt(company.taxId)}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{fmt(company.currency)}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{fmt(company.language)}</dd>
                </div>
                <div>
                  <dt>Account kind</dt>
                  <dd>{company.isSupplierCompany ? 'Supplier' : 'Buyer organization'}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{fmtSubmittedDate(company.createdAt)}</dd>
                </div>
                {company.logoUrl ? (
                  <div className={ui.pendingRegDetailLogoRow}>
                    <dt>Logo</dt>
                    <dd>
                      <a href={company.logoUrl} target="_blank" rel="noopener noreferrer">
                        View logo
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
            <section className={ui.pendingRegDetailGrid} aria-labelledby="pending-reg-contact-heading">
              <h3 id="pending-reg-contact-heading" className={ui.pendingRegDetailGridTitle}>
                Primary contact
              </h3>
              <dl className={ui.supervisorUserViewDl}>
                <div>
                  <dt>Name</dt>
                  <dd>{fmt(company.contactName)}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{fmt(company.contactEmail)}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{fmt(company.contactPhone)}</dd>
                </div>
                <div>
                  <dt>Job title</dt>
                  <dd>{fmt(company.contactJobTitle)}</dd>
                </div>
                <div>
                  <dt>Team</dt>
                  <dd>{fmt(company.contactTeam)}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{fmt(company.contactLocation)}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{fmt(company.contactRole)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
        <div className={`${ui.adminModalFoot} ${ui.supervisorUserViewFoot}`}>
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
  const { refreshPortalState } = usePortalData();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [detailCompany, setDetailCompany] = useState(null);

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
      await refreshPortalState();
    } catch (e) {
      setError(e.body?.error || e.message || 'Approval failed.');
    } finally {
      setBusyId('');
    }
  }

  async function reject(companyId) {
    setRejectingId(companyId);
  }

  async function handleRejectConfirm() {
    const companyId = rejectingId;
    if (!companyId) return;
    setBusyId(companyId);
    setError('');
    try {
      const resp = await apiFetch(`/api/v1/auth/super/companies/${companyId}/reject`, {
        method: 'POST',
      });
      if (resp.error) throw new Error(resp.error);
      await state.refresh();
      showFlash('Registration rejected', 'ok');
    } catch (e) {
      setError(e.body?.error || e.message || 'Reject failed.');
      throw e;
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
    <>
      <div className={`${ui.adminUsersBoard} ${ui.pendingRegPage}`}>
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
        <section className={`${ui.adminUsersLedgerCard} ${ui.pendingRegTableWrap}`}>
          <div className={`${ui.adminUsersTableHead} ${ui.pendingRegTableHead}`}>
            <span>Company</span>
            <span>Industry</span>
            <span>Phone</span>
            <span>Submitted</span>
            <span>Actions</span>
          </div>
          <div className={ui.adminUsersRows}>
            {companies.map((c) => (
              <article key={c.id} className={`${ui.adminUsersRow} ${ui.pendingRegRow}`}>
                {editingId === c.id ? (
                  <>
                    <div className={ui.pendingRegCell}>
                      <input className={ui.input} value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem' }} />
                      <p className={ui.pendingRegCompanyMeta} title={c.id}>
                        {c.id}
                      </p>
                    </div>
                    <div className={ui.pendingRegCell}>
                      <input className={ui.input} value={editIndustry} onChange={(e) => setEditIndustry(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem' }} />
                    </div>
                    <div className={ui.pendingRegCell}>
                      <p className={ui.pendingRegContactPhoneOnly}>{c.contactPhone || '—'}</p>
                    </div>
                    <div className={ui.adminUsersDate}>{fmtSubmittedDate(c.createdAt)}</div>
                    <div className={`${ui.pendingRegActions} ${ui.pendingRegActionsCell}`}>
                      <button
                        type="button"
                        className={`${ui.pendingRegBtn} ${ui.pendingRegBtnIconOnly} ${ui.pendingRegBtnApprove}`}
                        disabled={busyId === c.id}
                        onClick={saveEdit}
                        aria-label="Save changes"
                        title="Save"
                      >
                        {busyId === c.id ? (
                          <span aria-hidden>…</span>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className={`${ui.pendingRegBtn} ${ui.pendingRegBtnIconOnly} ${ui.pendingRegBtnGhost}`}
                        disabled={busyId === c.id}
                        onClick={() => setEditingId('')}
                        aria-label="Cancel editing"
                        title="Cancel"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={ui.pendingRegCell}>
                      <p className={ui.adminUsersName}>{c.name}</p>
                      <p className={ui.pendingRegCompanyMeta} title={c.id}>
                        {c.id}
                      </p>
                    </div>
                    <div className={ui.pendingRegCell}>{c.industry || '—'}</div>
                    <div className={ui.pendingRegCell}>
                      <p className={ui.pendingRegContactPhoneOnly}>{c.contactPhone || '—'}</p>
                    </div>
                    <div className={ui.adminUsersDate}>{fmtSubmittedDate(c.createdAt)}</div>
                    <div className={`${ui.pendingRegActions} ${ui.pendingRegActionsCell}`}>
                      <button
                        type="button"
                        className={`${ui.pendingRegBtn} ${ui.pendingRegBtnIconOnly} ${ui.pendingRegBtnGhost}`}
                        disabled={busyId === c.id}
                        onClick={() => setDetailCompany(c)}
                        aria-label="View registration details"
                        title="Details"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${ui.pendingRegBtn} ${ui.pendingRegBtnIconOnly} ${ui.pendingRegBtnApprove}`}
                        disabled={busyId === c.id}
                        onClick={() => approve(c.id)}
                        aria-label="Approve registration"
                        title="Approve"
                      >
                        {busyId === c.id ? (
                          <span aria-hidden>…</span>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className={`${ui.pendingRegBtn} ${ui.pendingRegBtnIconOnly} ${ui.pendingRegBtnGhost}`}
                        disabled={busyId === c.id}
                        onClick={() => startEdit(c)}
                        aria-label="Edit company name and industry"
                        title="Edit"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${ui.pendingRegBtn} ${ui.pendingRegBtnIconOnly} ${ui.pendingRegBtnDanger}`}
                        disabled={busyId === c.id}
                        onClick={() => reject(c.id)}
                        aria-label="Reject registration"
                        title="Reject"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
      <PendingCompanyDetailModal company={detailCompany} onClose={() => setDetailCompany(null)} />

      <ConfirmModal
        isOpen={Boolean(rejectingId)}
        title="Reject Registration"
        message="Are you sure you want to reject this company registration? This action will prevent the company from accessing the portal."
        confirmText="Reject Registration"
        cancelText="Cancel"
        isBusy={busyId === rejectingId}
        onConfirm={handleRejectConfirm}
        onClose={() => setRejectingId('')}
      />
    </>
  );
}
