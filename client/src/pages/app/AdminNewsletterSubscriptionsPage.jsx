import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import ListPageControls from '../../components/ListPageControls.jsx';
import { ConfirmModal } from '../../components/ConfirmModal.jsx';
import ui from './DashboardUi.module.css';

export function AdminNewsletterSubscriptions() {
  const { t } = useI18n();
  const { flash, FlashBanner } = useFlash();
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({ active: 0, unsubscribed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingSubscription, setDeletingSubscription] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    try {
      setLoading(true);
      const data = await apiFetch('/admin/newsletter-subscriptions?limit=100');
      setSubscriptions(data.subscriptions || []);
      setStats(data.stats || { active: 0, unsubscribed: 0, total: 0 });
    } catch (err) {
      flash(err?.message || 'Could not load newsletter subscriptions.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(subscription) {
    try {
      await apiFetch(`/admin/newsletter-subscriptions/${subscription._id}`, { method: 'DELETE' });
      flash('Newsletter subscription deleted successfully.', 'ok');
      loadSubscriptions();
    } catch (err) {
      flash(err?.message || 'Could not delete subscription.', 'error');
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      const statusParam = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      
      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = `/api/admin/newsletter-subscriptions-export${statusParam}`;
      a.download = `newsletter-subscriptions-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      flash('Export started! Your download should begin shortly.', 'ok');
    } catch (err) {
      flash(err?.message || 'Could not export subscriptions.', 'error');
    } finally {
      setExporting(false);
    }
  }

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch = 
        !search || 
        sub.email.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || 
        sub.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, search, statusFilter]);

  const pager = usePagedList(filteredSubscriptions, { pageSize: 20, resetKey: filteredSubscriptions.length });

  return (
    <div className={ui.adminPage}>
      <FlashBanner />
      
      <ConfirmModal
        isOpen={Boolean(deletingSubscription)}
        title="Delete Newsletter Subscription"
        message={`Delete subscription for ${deletingSubscription?.email}?`}
        confirmText="Delete"
        onConfirm={async () => {
          await handleDelete(deletingSubscription);
          setDeletingSubscription(null);
        }}
        onClose={() => setDeletingSubscription(null)}
      />

      <div className={ui.adminPageHead}>
        <div>
          <h1 className={ui.adminTitle}>Newsletter Subscriptions</h1>
          <p className={ui.adminLead}>Manage email subscribers and export mailing lists</p>
        </div>
      </div>

      <div className={ui.adminSummaryGrid} style={{ marginBottom: '1.5rem' }}>
        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Active Subscribers</p>
          <strong className={ui.adminSummaryValue}>{stats.active.toLocaleString()}</strong>
          <span className={ui.adminSummaryMeta}>Currently subscribed</span>
        </article>

        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Unsubscribed</p>
          <strong className={ui.adminSummaryValue}>{stats.unsubscribed.toLocaleString()}</strong>
          <span className={ui.adminSummaryMeta}>Opted out</span>
        </article>

        <article className={ui.adminSummaryCard}>
          <p className={ui.adminSummaryLabel}>Total Subscribers</p>
          <strong className={ui.adminSummaryValue}>{stats.total.toLocaleString()}</strong>
          <span className={ui.adminSummaryMeta}>All time</span>
        </article>
      </div>

      <div className={ui.adminControls}>
        <input
          type="search"
          placeholder="Search by email..."
          className={ui.adminSearchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={ui.adminUsersSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
        <button
          type="button"
          className={ui.adminPrimaryBtn}
          onClick={handleExport}
          disabled={exporting || filteredSubscriptions.length === 0}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
            <path d="M12 4v9m0 0 3.5-3.5M12 13l-3.5-3.5M5 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {loading ? (
        <div className={ui.adminEmpty}>Loading newsletter subscriptions...</div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className={ui.adminEmpty}>
          {search || statusFilter !== 'all' ? 'No subscriptions match your filters.' : 'No newsletter subscriptions yet.'}
        </div>
      ) : (
        <>
          <div className={ui.adminUsersTableWrap}>
            <div className={ui.adminUsersTableHead}>
              <span>Email</span>
              <span>Status</span>
              <span>Subscribed Date</span>
              <span>Source</span>
              <span>Actions</span>
            </div>
            <div className={ui.adminUsersRows}>
              {pager.pageSlice.map((sub) => (
                <article key={sub._id} className={ui.adminUsersRow}>
                  <div>
                    <a href={`mailto:${sub.email}`} style={{ color: 'var(--ec-primary, #692751)', fontWeight: '500' }}>
                      {sub.email}
                    </a>
                  </div>
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        backgroundColor: sub.status === 'active' ? '#dcfce7' : '#fee2e2',
                        color: sub.status === 'active' ? '#166534' : '#991b1b',
                      }}
                    >
                      {sub.status === 'active' ? 'Active' : 'Unsubscribed'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      {new Date(sub.subscribedAt || sub.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {sub.source || 'website_footer'}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className={ui.adminUsersRowBtn}
                      onClick={() => setDeletingSubscription(sub)}
                      title="Delete"
                      style={{ color: '#ef4444' }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <ListPageControls
            variant="table"
            rangeFrom={pager.rangeFrom}
            rangeTo={pager.rangeTo}
            total={pager.total}
            page={pager.page}
            pageCount={pager.pageCount}
            pagerNums={pager.pagerNums}
            onPrev={pager.goPrev}
            onNext={pager.goNext}
            onSelectPage={pager.setPage}
            canPrev={pager.canPrev}
            canNext={pager.canNext}
          />
        </>
      )}
    </div>
  );
}
