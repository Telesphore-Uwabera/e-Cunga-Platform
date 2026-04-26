import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePortalData } from '../../context/PortalStateContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import { useFlash } from '../../components/FlashMessage.jsx';
import { CheckIcon, CloseIcon } from '../../components/Icons.jsx';
import ui from './DashboardUi.module.css';
import { conicGradientFromSlices, REPORT_SLICE_COLORS } from '../../utils/reportCharts.js';
import { ClearFiltersIconButton, MoneyFigure, StatusBadge, formatMoney, workflowLabel } from './roleUi.jsx';

function useAccountantActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'accountant'),
    [state.users, user?.email]
  );
}

function AccountantIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'invoice') {
    return (
      <svg {...common}>
        <path d="M6 3h9l3 3v15H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 10h6M9 14h6M9 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'payment') {
    return (
      <svg {...common}>
        <path d="M4 7h16v10H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 10h16M12 15h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 12h4l2-6 4 12 2-6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function invoiceDocsCount(invoice) {
  return [invoice.attachmentUrl, invoice.deliveryNoteUrl, invoice.finalInvoiceUrl].filter(Boolean).length;
}

function safeDocUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return t.startsWith('/') ? t : `/${t}`;
}

/** Invoices awaiting accountant proforma review (approve / reject). */
export function isInvoicePendingAccountantReview(status) {
  return ['proformaReceived', 'sent', 'draft'].includes(status);
}

function invoiceTabBucket(status) {
  if (status === 'proformaApproved') return 'accepted';
  if (isInvoicePendingAccountantReview(status)) return 'pending';
  if (status === 'rejected') return 'rejected';
  if (['paid', 'deliveryNoteAttached', 'closed'].includes(status)) return 'paid';
  return 'paid';
}

function initialsFor(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

function requisitionTotalQty(requisition) {
  return requisition?.lines?.reduce((sum, line) => sum + Number(line.quantity || 0), 0) || 0;
}

function requisitionPrimaryItem(requisition) {
  if (!requisition?.lines?.length) return 'Inventory request';
  if (requisition.lines.length === 1) return requisition.lines[0].description;
  return `${requisition.lines[0].description} +${requisition.lines.length - 1} more`;
}

function accountantFinanceBucket(status) {
  if (status === 'rejected') return 'rejected';
  if (isInvoicePendingAccountantReview(status)) return 'pending';
  return 'approved';
}

function accountantFinanceLabel(status) {
  if (status === 'proformaApproved') return 'Accepted proforma';
  if (status === 'proformaReceived') return 'Pending approval';
  if (status === 'draft') return 'Draft';
  if (status === 'sent') return 'Awaiting review';
  if (status === 'rejected') return 'Rejected';
  if (status === 'paid') return 'Paid';
  if (status === 'deliveryNoteAttached') return 'Delivery note attached';
  if (status === 'closed') return 'Closed';
  return workflowLabel(status);
}

export function AccountantDashboard() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const readyToPayCount = state.invoices.filter((entry) => entry.status === 'proformaApproved').length;
  const pendingPayments = state.invoices
    .filter((entry) => entry.status === 'proformaApproved')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const settledInvoices = state.invoices.filter((entry) => ['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status));
  const monthlyExpenses = settledInvoices.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const openFinanceItems = state.invoices.filter((entry) => !['closed', 'rejected'].includes(entry.status)).length;
  const pendingApprovals = state.invoices.filter((entry) => isInvoicePendingAccountantReview(entry.status)).length;
  const budgetActual = [44, 52, 49, 58, 55, 63];
  const budgetPlan = [48, 50, 53, 54, 58, 60];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const maxBudget = Math.max(...budgetPlan, ...budgetActual);
  const actualPoints = budgetActual.map((value, index) => `${index * 72},${128 - Math.round((value / maxBudget) * 86)}`).join(' ');
  const plannedPoints = budgetPlan.map((value, index) => `${index * 72},${128 - Math.round((value / maxBudget) * 86)}`).join(' ');
  const recentTransactions = [...state.invoices]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 4);

  function transactionTone(status) {
    if (status === 'rejected') return ui.accountantTxnRejected;
    if (isInvoicePendingAccountantReview(status)) return ui.accountantTxnPending;
    return ui.accountantTxnApproved;
  }

  function transactionLabel(status) {
    if (status === 'rejected') return 'Rejected';
    if (isInvoicePendingAccountantReview(status)) return 'Pending review';
    if (status === 'proformaApproved') return 'Accepted';
    if (['paid', 'deliveryNoteAttached', 'closed'].includes(status)) return 'Settled';
    return 'In workflow';
  }

  return (
    <div className={ui.accountantDash}>
      <div className={ui.accountantSummaryGrid}>
        <article className={ui.accountantSummaryCard}>
          <p className={ui.accountantSummaryLabel}>{t('app.accountant.dashPendingLabel')}</p>
          <p className={ui.accountantSummaryValue}>
            <MoneyFigure
              value={pendingPayments}
              amountClassName={ui.accountantSummaryAmount}
              currencyClassName={ui.accountantSummaryCurrency}
            />
          </p>
          <span className={ui.accountantSummaryPill}>
            {readyToPayCount} {t('app.accountant.dashReadyToPay')}
          </span>
        </article>

        <article className={ui.accountantSummaryCard}>
          <p className={ui.accountantSummaryLabel}>{t('app.accountant.dashSettledLabel')}</p>
          <p className={ui.accountantSummaryValue}>
            <MoneyFigure
              value={monthlyExpenses}
              amountClassName={ui.accountantSummaryAmount}
              currencyClassName={ui.accountantSummaryCurrency}
            />
          </p>
          <span className={ui.accountantSummaryPill}>
            {settledInvoices.length} {t('app.accountant.dashTotalSettled')}
          </span>
        </article>

        <article className={ui.accountantSummaryCard}>
          <p className={ui.accountantSummaryLabel}>{t('app.accountant.dashOpenLabel')}</p>
          <p className={ui.accountantSummaryValue}>{openFinanceItems}</p>
          <span className={`${ui.accountantSummaryPill} ${openFinanceItems > 0 ? ui.accountantSummaryPillInfo : ''}`}>
            {t('app.accountant.dashOpenMeta')}
          </span>
        </article>

        <article className={ui.accountantSummaryCard}>
          <p className={ui.accountantSummaryLabel}>{t('app.accountant.dashAwaitingLabel')}</p>
          <p className={ui.accountantSummaryValue}>{pendingApprovals}</p>
          <span className={ui.accountantSummaryPill}>{t('app.accountant.dashAwaitingMeta')}</span>
        </article>
      </div>

      <div className={ui.accountantMainGrid}>
        <section className={ui.accountantChartCard}>
          <div className={ui.accountantCardHead}>
            <div>
              <h1 className={ui.accountantTitle}>{t('app.accountant.dashTitle')}</h1>
              <p className={ui.accountantLead}>Fiscal year 2024 analysis.</p>
            </div>
            <div className={ui.accountantLegend}>
              <span><i className={ui.accountantLegendDot} />Actual</span>
              <span><i className={`${ui.accountantLegendDot} ${ui.accountantLegendDotBlue}`} />Budgeted</span>
            </div>
          </div>
          <svg viewBox="0 0 360 150" className={ui.accountantChartSvg} aria-hidden>
            <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={actualPoints} className={ui.accountantChartActual} />
            <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={plannedPoints} className={ui.accountantChartBudget} />
          </svg>
          <div className={ui.accountantMonthRow}>
            {months.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </section>

        <aside className={ui.accountantInsightCard}>
          <h2 className={ui.accountantInsightTitle}>{t('cungaAi.digitalTitle')}</h2>
          <div className={ui.accountantInsightList}>
            <article className={ui.accountantInsightItem}>
              <p className={ui.accountantInsightEyebrow}>Live guidance</p>
              <div className={ui.accountantInsightText}>
                <WorkspaceAiInsight
                  scope="accountant"
                  showRefresh
                  fallbackText="Review proforma invoices waiting for approval and align payments with open requisitions."
                />
              </div>
            </article>
          </div>
          <button type="button" className={ui.accountantInsightBtn} onClick={() => navigate('/app/accountant/reports')}>
            Open reports
          </button>
        </aside>
      </div>

      <section className={ui.accountantLedgerCard}>
        <div className={ui.accountantCardHead}>
          <h2 className={ui.accountantLedgerTitle}>Recent Transactions</h2>
          <button type="button" className={ui.accountantLedgerLink} onClick={() => navigate('/app/accountant/invoices')}>
            View Full Ledger -&gt;
          </button>
        </div>

        <div className={ui.accountantTxnList}>
          {recentTransactions.map((invoice, index) => (
            <article key={invoice.id} className={ui.accountantTxnRow}>
              <div className={ui.accountantTxnIdentity}>
                <span className={index % 2 === 0 ? ui.accountantTxnIcon : `${ui.accountantTxnIcon} ${ui.accountantTxnIconAlt}`}>
                  <AccountantIcon kind={index % 3 === 0 ? 'payment' : 'invoice'} />
                </span>
                <div>
                  <p className={ui.accountantTxnTitle}>{invoice.supplierName}</p>
                  <p className={ui.accountantTxnMeta}>
                    {invoice.type === 'final' ? 'Final invoice' : 'Inventory restock'} · {invoice.reference}
                  </p>
                </div>
              </div>
              <div className={ui.accountantTxnDateBlock}>
                <span>Date</span>
                <strong>{new Date(invoice.updatedAt || invoice.createdAt).toLocaleDateString()}</strong>
              </div>
              <div className={ui.accountantTxnAmountBlock}>
                <span>Amount</span>
                <strong>{formatMoney(invoice.amount, invoice.currency)}</strong>
              </div>
              <span className={`${ui.accountantTxnBadge} ${transactionTone(invoice.status)}`}>{transactionLabel(invoice.status)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AccountantApprovals() {
  const { t } = useI18n();
  const { state, accountantReviewInvoice } = usePortalData();
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [filter, setFilter] = useState('approved');
  const [busyInvoiceId, setBusyInvoiceId] = useState(null);
  const approvalRequests = useMemo(
    () =>
      state.invoices
        .filter((invoice) => invoice.type === 'proforma')
        .map((invoice) => {
          const requisition = state.requisitions.find((entry) => entry.id === invoice.requisitionId);
          const bucket = accountantFinanceBucket(invoice.status);
          return {
            id: invoice.id,
            invoice,
            requisition,
            bucket,
            requestId: requisition ? requisition.id.replace('req_', 'REQ-') : invoice.reference,
            item: requisitionPrimaryItem(requisition),
            category: requisition?.location || requisition?.lines?.[0]?.unit || 'Operations',
            qty: requisitionTotalQty(requisition),
            totalCost: Number(invoice.amount || 0),
            currency: invoice.currency,
            requester: requisition?.clerkName || invoice.supplierName,
            requesterInitials: initialsFor(requisition?.clerkName || invoice.supplierName),
            requesterEmail:
              state.users.find((u) => u.fullName === requisition?.clerkName)?.email ||
              state.users.find((u) => u.id === requisition?.clerkId)?.email ||
              '',
            supplierName: invoice.supplierName || requisition?.supplierName || 'Supplier',
            proformaUrl: invoice.attachmentUrl || '',
          };
        })
        .sort((a, b) => new Date(b.invoice.updatedAt || b.invoice.createdAt) - new Date(a.invoice.updatedAt || a.invoice.createdAt)),
    [state.invoices, state.requisitions, state.users]
  );
  const rows =
    filter === 'all'
      ? approvalRequests
      : approvalRequests.filter((entry) => entry.bucket === filter);
  const approvalTablePager = usePagedList(rows, { resetKey: filter });
  const awaitingCount = approvalRequests.filter((entry) => entry.bucket === 'pending').length;
  const fiscalSpend = approvalRequests.reduce((sum, entry) => sum + entry.totalCost, 0);

  async function onAccountantReview(invoiceId, decision) {
    setBusyInvoiceId(invoiceId);
    try {
      await accountantReviewInvoice(invoiceId, decision, actor?.id);
      showFlash(`Invoice ${decision === 'approved' ? 'approved' : 'rejected'} successfully.`, 'ok');
    } catch (e) {
      showFlash(e.message || 'Update failed.', 'error');
    } finally {
      setBusyInvoiceId(null);
    }
  }

  return (
    <div className={ui.accountantApprovalBoard}>
      <div className={ui.accountantApprovalTop}>
        <div>
          <p className={ui.accountantApprovalEyebrow}>Approval Workflow</p>
          <h1 className={ui.accountantApprovalTitle}>{t('app.accountant.approvalTitle')}</h1>
        </div>
        <div className={ui.accountantApprovalCount}>
          <span>Awaiting action:</span>
          <strong>{awaitingCount}</strong>
        </div>
      </div>

      <div className={ui.toolbar}>
        <div className={ui.segmented}>
          {[
            ['approved', 'Approved'],
            ['pending', 'Pending'],
            ['rejected', 'Rejected'],
            ['all', 'All'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? ui.segBtnActive : ui.segBtn} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.accountantApprovalGrid}>
        <section className={ui.accountantApprovalTableCard}>
          <div className={ui.accountantApprovalTableHead}>
            <span>Request ID</span>
            <span>Item</span>
            <span>Qty</span>
            <span>Total Cost</span>
            <span>Requester</span>
            <span>Supplier to pay</span>
            <span>Proforma</span>
            <span>Actions</span>
          </div>

          <div className={ui.accountantApprovalRows}>
            {rows.length ? (
              approvalTablePager.pageSlice.map((entry) => (
                <article key={entry.id} className={ui.accountantApprovalRow}>
                  <div className={ui.accountantApprovalId}>{entry.requestId}</div>
                  <div>
                    <p className={ui.accountantApprovalItem}>{entry.item}</p>
                    <p className={ui.accountantApprovalMeta}>{entry.category}</p>
                  </div>
                  <div className={ui.accountantApprovalQty}>{entry.qty}</div>
                  <div className={ui.accountantApprovalCost}>{formatMoney(entry.totalCost, entry.currency)}</div>
                  <div className={ui.accountantApprovalRequester}>
                    <div>
                      <p className={ui.accountantApprovalRequesterName}>{entry.requester}</p>
                      <StatusBadge status={accountantFinanceLabel(entry.invoice.status)} />
                      {entry.requesterEmail ? (
                        <a
                          href={`mailto:${entry.requesterEmail}`}
                          className={ui.accountantLedgerLink}
                          style={{ display: 'inline-block', marginTop: '0.25rem' }}
                        >
                          Contact requester
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className={ui.accountantApprovalQty}>{entry.supplierName}</div>
                  <div className={ui.accountantApprovalActions}>
                    {entry.proformaUrl ? (
                      <button
                        type="button"
                        className={ui.accountantApprovalApprove}
                        onClick={() => window.open(safeDocUrl(entry.proformaUrl), '_blank', 'noopener,noreferrer')}
                      >
                        Proforma
                      </button>
                    ) : (
                      <span className={ui.mutedSm}>No file</span>
                    )}
                  </div>
                  <div className={ui.accountantApprovalActions}>
                    {entry.bucket === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className={ui.accountantApprovalReject}
                          disabled={busyInvoiceId === entry.invoice.id}
                          onClick={() => onAccountantReview(entry.invoice.id, 'rejected')}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className={ui.accountantApprovalApprove}
                          disabled={busyInvoiceId === entry.invoice.id}
                          onClick={() => onAccountantReview(entry.invoice.id, 'approved')}
                        >
                          {busyInvoiceId === entry.invoice.id ? '…' : 'Approve'}
                        </button>
                      </>
                    ) : (
                      <span className={ui.mutedSm}>—</span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p className={ui.empty}>No material requests match this finance view.</p>
            )}
          </div>
          <ListPageControls
            variant="table"
            rangeFrom={approvalTablePager.rangeFrom}
            rangeTo={approvalTablePager.rangeTo}
            total={approvalTablePager.total}
            page={approvalTablePager.page}
            pageCount={approvalTablePager.pageCount}
            pagerNums={approvalTablePager.pagerNums}
            onPrev={approvalTablePager.goPrev}
            onNext={approvalTablePager.goNext}
            onSelectPage={approvalTablePager.setPage}
            canPrev={approvalTablePager.canPrev}
            canNext={approvalTablePager.canNext}
          />
        </section>

        <aside className={ui.accountantApprovalRail}>
          <section className={ui.accountantApprovalInsight}>
            <div className={ui.accountantApprovalInsightHead}>
              <span className={ui.accountantApprovalInsightIcon}>
                <AccountantIcon kind="payment" />
              </span>
              <div>
                <h2 className={ui.accountantApprovalRailTitle}>{t('cungaAi.approvalInsightRail')}</h2>
                <p className={ui.accountantApprovalRailMeta}>From your live workspace</p>
              </div>
            </div>

            <div className={ui.accountantApprovalInsightBox}>
              <p className={ui.accountantApprovalInsightLabel}>Guidance</p>
              <div className={ui.accountantApprovalInsightText}>
                <WorkspaceAiInsight
                  scope="accountant"
                  showRefresh
                  fallbackText="Use invoice statuses and amounts in the list to prioritise proforma reviews and payments."
                />
              </div>
            </div>

            <button type="button" className={ui.accountantApprovalInsightBtn} onClick={() => navigate('/app/accountant/reports')}>
              Open reports
            </button>
          </section>

          <section className={ui.accountantApprovalSummary}>
            <p className={ui.accountantApprovalSummaryLabel}>Fiscal Summary</p>
            <p className={ui.accountantApprovalSummaryMeta}>Q3 operational spending</p>
            <strong className={ui.accountantApprovalSummaryValue}>{formatMoney(fiscalSpend)}</strong>
            <span className={ui.accountantApprovalSummaryPill}>{awaitingCount} awaiting review</span>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function AccountantInvoices() {
  const { t } = useI18n();
  const { state, accountantReviewInvoice, markInvoicePaid } = usePortalData();
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const invoices = useMemo(
    () =>
      [...state.invoices]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .map((invoice) => {
          const requisition = state.requisitions.find((entry) => entry.id === invoice.requisitionId);
          return {
            ...invoice,
            supplier: invoice.supplierName,
            email: `${(invoice.supplierName || 'supplier').toLowerCase().replace(/[^a-z0-9]+/g, '')}@ecunga.demo`,
            dateIssued: new Date(invoice.createdAt).toLocaleDateString(),
            initials: initialsFor(invoice.supplierName),
            financeLabel: accountantFinanceLabel(invoice.status),
            bucket: invoiceTabBucket(invoice.status),
            requisitionTitle: requisition?.title || 'Inventory workflow',
          };
        }),
    [state.invoices, state.requisitions]
  );
  const [invSearch, setInvSearch] = useState('');
  const rows = useMemo(() => {
    const base = filter === 'all' ? invoices : invoices.filter((entry) => entry.bucket === filter);
    const q = invSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (entry) =>
        entry.reference.toLowerCase().includes(q) ||
        (entry.supplier || '').toLowerCase().includes(q) ||
        (entry.requisitionTitle || '').toLowerCase().includes(q) ||
        (entry.email || '').toLowerCase().includes(q)
    );
  }, [invoices, filter, invSearch]);
  const invoicePager = usePagedList(rows, { resetKey: `${filter}|${invSearch}` });
  const totalOutstanding = invoices
    .filter((entry) => ['proformaReceived', 'sent', 'draft', 'proformaApproved'].includes(entry.status))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const pendingApprovals = invoices.filter((entry) => isInvoicePendingAccountantReview(entry.status)).length;

  function invoiceStatusTone(status) {
    if (status === 'rejected') return ui.accountantInvoiceBadgeRejected;
    if (status === 'proformaApproved') return ui.accountantInvoiceBadgeAccepted;
    if (['paid', 'deliveryNoteAttached', 'closed'].includes(status)) return ui.accountantInvoiceBadgePaid;
    return ui.accountantInvoiceBadgePending;
  }

  function invoiceStatusLabel(status) {
    return accountantFinanceLabel(status);
  }

  async function onInvoiceApprove(id) {
    setBusyId(id);
    try {
      await accountantReviewInvoice(id, 'approved', actor?.id);
      showFlash('Invoice approved successfully.', 'ok');
    } catch (e) {
      showFlash(e.message || 'Approve failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onInvoiceReject(id) {
    setBusyId(id);
    try {
      await accountantReviewInvoice(id, 'rejected', actor?.id);
      showFlash('Invoice rejected.', 'warn');
    } catch (e) {
      showFlash(e.message || 'Reject failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onInvoicePay(id) {
    setBusyId(id);
    try {
      await markInvoicePaid(id, actor?.id);
      showFlash('Payment processed successfully.', 'ok');
    } catch (e) {
      showFlash(e.message || 'Payment failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={ui.accountantInvoiceBoard}>
      <div className={ui.accountantInvoiceTop}>
        <div>
          <h1 className={ui.accountantInvoiceTitle}>{t('app.accountant.invoiceTitle')}</h1>
          <p className={ui.accountantInvoiceLead}>Review and process your digital receivables and payables.</p>
        </div>
      </div>

      <div className={ui.accountantInvoiceStats}>
        <section className={ui.accountantInvoiceStatCard}>
          <p className={ui.accountantInvoiceStatLabel}>Total outstanding</p>
          <strong className={ui.accountantInvoiceStatValue}>
            <MoneyFigure
              value={totalOutstanding}
              amountClassName={ui.accountantInvoiceStatAmount}
              currencyClassName={ui.accountantInvoiceStatCurrency}
            />
          </strong>
          <span className={ui.accountantInvoiceMutedMeta}>Pending review + accepted proforma</span>
        </section>

        <section className={ui.accountantInvoiceStatCard}>
          <p className={ui.accountantInvoiceStatLabel}>Pending approval</p>
          <strong className={ui.accountantInvoiceStatValue}>{pendingApprovals}</strong>
          <span className={ui.accountantInvoiceMutedMeta}>Proformas awaiting review</span>
        </section>

        <section className={ui.accountantInvoiceStatCard}>
          <p className={ui.accountantInvoiceStatLabel}>Settled this month</p>
          <strong className={ui.accountantInvoiceStatValue}>
            <MoneyFigure
              value={invoices.filter(i => ['paid', 'closed'].includes(i.status)).reduce((acc, i) => acc + Number(i.amount || 0), 0)}
              amountClassName={ui.accountantInvoiceStatAmount}
              currencyClassName={ui.accountantInvoiceStatCurrency}
            />
          </strong>
          <span className={ui.accountantInvoiceMutedMeta}>Finalized disbursements</span>
        </section>

        <section className={ui.accountantInvoicePrediction}>
          <div>
            <p className={ui.accountantInvoicePredictionTitle}>AI Cash Flow Prediction</p>
            <p className={ui.accountantInvoicePredictionText}>
              Based on trends, we anticipate 85% of pending invoices will be cleared by the 15th.
            </p>
          </div>
          <span className={ui.accountantInvoicePredictionIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 15l4-4 3 3 6-7M15 7h6v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </section>
      </div>

      <div className={ui.accountantInvoiceToolbar}>
        <div className={ui.accountantInvoiceTabs}>
          {[
            ['all', 'All Invoices'],
            ['accepted', 'Accepted'],
            ['pending', 'Pending'],
            ['rejected', 'Rejected'],
            ['paid', 'Paid'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? ui.accountantInvoiceTabActive : ui.accountantInvoiceTab}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={ui.accountantInvoiceFilters}>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>Search</span>
            <input
              className={ui.portalFilterSearch}
              placeholder="Reference, supplier, workflow…"
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
            />
          </label>
          <ClearFiltersIconButton title={t('common.clearSearchAria')} onClick={() => setInvSearch('')} />
          <button type="button" className={ui.accountantInvoiceDateBtn}>
            Date Range: Last 30 Days
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <section className={ui.accountantInvoiceTableCard}>
        <div className={ui.accountantInvoiceMetaBar}>
          <label className={ui.accountantInvoiceSelectAll}>
            <input type="checkbox" />
            <span>Select all</span>
          </label>
          <span className={ui.accountantInvoiceShowing}>
            {rows.length ? `${invoicePager.rangeFrom}–${invoicePager.rangeTo} of ${rows.length}` : '0'} of {invoices.length} invoices
          </span>
        </div>

        <div className={ui.accountantInvoiceTableHead}>
          <span />
          <span>Invoice ID</span>
          <span>Recipient / Supplier</span>
          <span>Date Issued</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        <div className={ui.accountantInvoiceRows}>
          {rows.length ? (
            invoicePager.pageSlice.map((entry) => (
              <article key={entry.id} className={ui.accountantInvoiceRow}>
                <label className={ui.accountantInvoiceCheck}>
                  <input type="checkbox" />
                </label>
                <div className={ui.accountantInvoiceId}>{entry.reference}</div>
                <div className={ui.accountantInvoiceSupplier}>
                  <div>
                    <p className={ui.accountantInvoiceSupplierName}>{entry.supplier}</p>
                    <p className={ui.accountantInvoiceSupplierMeta}>{entry.requisitionTitle}</p>
                  </div>
                </div>
                <div className={ui.accountantInvoiceDate}>{entry.dateIssued}</div>
                <div className={ui.accountantInvoiceAmount}>{formatMoney(entry.amount, entry.currency)}</div>
                <div>
                  <span className={`${ui.accountantInvoiceBadge} ${invoiceStatusTone(entry.status)}`}>{invoiceStatusLabel(entry.status)}</span>
                </div>
                <div className={ui.accountantInvoiceActions}>
                  {entry.attachmentUrl ? (
                    <button
                      type="button"
                      className={ui.accountantInvoiceIconBtn}
                      aria-label="Open proforma document"
                      onClick={() => window.open(safeDocUrl(entry.attachmentUrl), '_blank', 'noopener,noreferrer')}
                    >
                      PDF
                    </button>
                  ) : (
                    <button type="button" className={ui.accountantInvoiceIconBtn} aria-label="Document count" disabled>
                      {invoiceDocsCount(entry)}
                    </button>
                  )}
                  {isInvoicePendingAccountantReview(entry.status) ? (
                    <>
                      <button
                        type="button"
                        className={ui.accountantInvoiceIconBtn}
                        aria-label="Reject proforma"
                        disabled={busyId === entry.id}
                        onClick={() => onInvoiceReject(entry.id)}
                      >
                        <CloseIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className={ui.accountantInvoiceIconBtn}
                        aria-label="Approve proforma"
                        disabled={busyId === entry.id}
                        onClick={() => onInvoiceApprove(entry.id)}
                      >
                        <CheckIcon size={16} />
                      </button>
                    </>
                  ) : null}
                  {entry.status === 'proformaApproved' ? (
                    <button
                      type="button"
                      className={ui.accountantInvoiceIconBtn}
                      aria-label="Pay invoice and notify supplier"
                      disabled={busyId === entry.id}
                      onClick={() => onInvoicePay(entry.id)}
                    >
                      Pay
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={ui.accountantInvoiceIconBtn}
                    aria-label="Open payment workspace"
                    onClick={() => navigate('/app/accountant/payments')}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className={ui.empty}>No invoices match this accountant filter.</p>
          )}
        </div>

        <div className={ui.accountantInvoiceFooter}>
          <ListPageControls
            variant="table"
            rangeFrom={invoicePager.rangeFrom}
            rangeTo={invoicePager.rangeTo}
            total={invoicePager.total}
            page={invoicePager.page}
            pageCount={invoicePager.pageCount}
            pagerNums={invoicePager.pagerNums}
            onPrev={invoicePager.goPrev}
            onNext={invoicePager.goNext}
            onSelectPage={invoicePager.setPage}
            canPrev={invoicePager.canPrev}
            canNext={invoicePager.canNext}
          />
          <div className={ui.accountantInvoiceFooterMeta}>
            <span>Items per page:</span>
            <strong>{invoicePager.pageSize}</strong>
          </div>
        </div>
      </section>


    </div>
  );
}

export function AccountantPayments() {
  const { t } = useI18n();
  const { state, markInvoicePaid } = usePortalData();
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);
  const payable = useMemo(
    () =>
      state.invoices
        .filter((entry) => entry.type === 'proforma' && entry.status === 'proformaApproved')
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)),
    [state.invoices]
  );
  const suppliers = useMemo(() => [...new Set(payable.map((entry) => entry.supplierName))], [payable]);
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ach');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const invoices = useMemo(
    () =>
      payable
        .filter((entry) => !supplier || entry.supplierName === supplier)
        .map((entry) => ({
          id: entry.id,
          ref: entry.reference,
          dueDate: new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(),
          amount: entry.amount,
          currency: entry.currency,
        })),
    [payable, supplier]
  );
  const payInvPager = usePagedList(invoices, { resetKey: supplier });
  const recentPaymentsAll = useMemo(
    () =>
      [...state.invoices]
        .filter((entry) => ['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status))
        .sort((a, b) => new Date(b.paidAt || b.updatedAt || b.createdAt) - new Date(a.paidAt || a.updatedAt || a.createdAt))
        .map((entry, index) => ({
          id: entry.id,
          company: entry.supplierName,
          amount: entry.amount,
          batch: entry.reference,
          status: index === 0 ? 'Completed' : 'Approved',
          time: new Date(entry.paidAt || entry.updatedAt || entry.createdAt).toLocaleString(),
          progress: 100,
          tone: 'approved',
        })),
    [state.invoices]
  );
  const recentPayPager = usePagedList(recentPaymentsAll, { resetKey: 'payments-recent' });
  const totalDisbursement = invoices
    .filter((entry) => selectedInvoiceIds.includes(entry.id))
    .reduce((sum, entry) => sum + entry.amount, 0);

  useEffect(() => {
    if (!suppliers.length) {
      setSupplier('');
      return;
    }
    if (!suppliers.includes(supplier)) {
      setSupplier(suppliers[0]);
    }
  }, [supplier, suppliers]);

  useEffect(() => {
    const availableIds = new Set(invoices.map((entry) => entry.id));
    setSelectedInvoiceIds((current) => {
      const next = current.filter((entry) => availableIds.has(entry));
      if (next.length) return next;
      return invoices[0] ? [invoices[0].id] : [];
    });
  }, [invoices]);

  function toggleInvoiceSelection(invoiceId) {
    setSelectedInvoiceIds((current) => (current.includes(invoiceId) ? current.filter((entry) => entry !== invoiceId) : [...current, invoiceId]));
  }

  async function authorizeSelectedPayments() {
    setPayError(null);
    setPaying(true);
    try {
      for (const invoiceId of selectedInvoiceIds) {
        await markInvoicePaid(invoiceId, actor?.id);
      }
    } catch (e) {
      setPayError(e.message || 'Payment failed.');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className={ui.accountantPaymentBoard}>
      <div>
        <h1 className={ui.accountantPaymentTitle}>{t('app.accountant.paymentTitle')}</h1>
        <p className={ui.accountantPaymentLead}>
          Mark accepted proformas as paid. The server notifies the supplier and expects delivery documentation next.
        </p>
      </div>

      {payError ? (
        <div className={ui.panel} style={{ marginBottom: '1rem' }}>
          <p className={ui.panelSub}>{payError}</p>
          <button type="button" className={ui.accountantPaymentSecurityBtn} onClick={() => setPayError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className={ui.accountantPaymentGrid}>
        <section className={ui.accountantPaymentCard}>
          <div className={ui.accountantPaymentCardHead}>
            <span className={ui.accountantPaymentCardIcon}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12a8 8 0 1116 0 8 8 0 01-16 0zm5-1h6M12 8v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className={ui.accountantPaymentCardTitle}>Initiate Payment</h2>
          </div>

          <div className={ui.accountantPaymentControls}>
            <label className={ui.accountantPaymentField}>
              <span className={ui.accountantPaymentLabel}>Select supplier</span>
              <select
                className={ui.accountantPaymentSelect}
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
                disabled={!suppliers.length}
              >
                {!suppliers.length ? <option value="">No payable invoices</option> : null}
                {suppliers.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>

            <div className={ui.accountantPaymentField}>
              <span className={ui.accountantPaymentLabel}>Payment method</span>
              <div className={ui.accountantPaymentMethods}>
                <button
                  type="button"
                  className={paymentMethod === 'ach' ? ui.accountantPaymentMethodActive : ui.accountantPaymentMethod}
                  onClick={() => setPaymentMethod('ach')}
                >
                  <span className={ui.accountantPaymentMethodIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10.5h18" />
                      <path d="M5 6.5h14v11H5z" />
                      <path d="M9 14.5h.01M12 14.5h3.5" />
                      <path d="M8 6.5V5M16 6.5V5" />
                    </svg>
                  </span>
                  <span className={ui.accountantPaymentMethodText}>ACH Transfer</span>
                </button>
                <button
                  type="button"
                  className={paymentMethod === 'virtual' ? ui.accountantPaymentMethodActive : ui.accountantPaymentMethod}
                  onClick={() => setPaymentMethod('virtual')}
                >
                  <span className={ui.accountantPaymentMethodIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3.5" y="6" width="17" height="12" rx="2" />
                      <path d="M3.5 10.25h17" />
                      <path d="M7 14h2.5M14.5 14h2.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className={ui.accountantPaymentMethodText}>Virtual Card</span>
                </button>
              </div>
            </div>
          </div>

          <div className={ui.accountantPaymentInvoiceBlock}>
            <p className={ui.accountantPaymentLabel}>Select invoices to pay</p>
            <div className={ui.accountantPaymentInvoiceHead}>
              <span>Ref number</span>
              <span>Due date</span>
              <span>Amount</span>
              <span>Select</span>
            </div>
            <div className={ui.accountantPaymentInvoiceList}>
              {invoices.length ? (
                payInvPager.pageSlice.map((invoice) => (
                  <label key={invoice.id} className={ui.accountantPaymentInvoiceRow}>
                    <div className={ui.accountantPaymentInvoiceRef}>{invoice.ref}</div>
                    <div className={ui.accountantPaymentInvoiceDate}>{invoice.dueDate}</div>
                    <div className={ui.accountantPaymentInvoiceAmount}>{formatMoney(invoice.amount, invoice.currency)}</div>
                    <span className={ui.accountantPaymentInvoiceCheck}>
                      <input type="checkbox" checked={selectedInvoiceIds.includes(invoice.id)} onChange={() => toggleInvoiceSelection(invoice.id)} />
                    </span>
                  </label>
                ))
              ) : (
                <p className={ui.empty}>No accepted proforma invoices are ready for payment.</p>
              )}
            </div>
            <ListPageControls
              variant="table"
              rangeFrom={payInvPager.rangeFrom}
              rangeTo={payInvPager.rangeTo}
              total={payInvPager.total}
              page={payInvPager.page}
              pageCount={payInvPager.pageCount}
              pagerNums={payInvPager.pagerNums}
              onPrev={payInvPager.goPrev}
              onNext={payInvPager.goNext}
              onSelectPage={payInvPager.setPage}
              canPrev={payInvPager.canPrev}
              canNext={payInvPager.canNext}
            />
          </div>

          <div className={ui.accountantPaymentFooter}>
            <div>
              <p className={ui.accountantPaymentTotalLabel}>Total disbursement amount</p>
              <strong className={ui.accountantPaymentTotalValue}>{formatMoney(totalDisbursement)}</strong>
            </div>
            <button
              type="button"
              className={ui.accountantPaymentAuthorizeBtn}
              disabled={!selectedInvoiceIds.length || paying}
              onClick={() => authorizeSelectedPayments()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l7 3v6c0 4.4-3 8.4-7 9-4-0.6-7-4.6-7-9V6l7-3zm-2.2 9.2l1.6 1.6 3.4-3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {paying ? 'Processing…' : 'Pay and Notify Supplier'}
            </button>
          </div>
        </section>

        <aside className={ui.accountantPaymentRail}>
          <section className={ui.accountantPaymentRecentCard}>
            <h2 className={ui.accountantPaymentRailTitle}>Recent Payments</h2>
            <div className={ui.accountantPaymentRecentList}>
              {recentPayPager.pageSlice.map((payment) => (
                <article key={payment.id} className={ui.accountantPaymentRecentItem}>
                  <div className={ui.accountantPaymentRecentTop}>
                    <div>
                      <p className={ui.accountantPaymentRecentName}>{payment.company}</p>
                      <p className={ui.accountantPaymentRecentMeta}>Batch {payment.batch} · Completed</p>
                    </div>
                    <strong className={ui.accountantPaymentRecentAmount}>{formatMoney(payment.amount)}</strong>
                  </div>
                  <div className={ui.accountantPaymentRecentStatusRow}>
                    <span className={payment.tone === 'approved' ? ui.accountantPaymentBadgeApproved : ui.accountantPaymentBadgePending}>{payment.status}</span>
                    <span className={ui.accountantPaymentRecentTime}>{payment.time}</span>
                  </div>
                  <div className={ui.accountantPaymentRecentTrack}>
                    <div
                      className={payment.tone === 'approved' ? ui.accountantPaymentRecentFill : ui.accountantPaymentRecentFillPending}
                      style={{ width: `${payment.progress}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
            <ListPageControls
              variant="feed"
              rangeFrom={recentPayPager.rangeFrom}
              rangeTo={recentPayPager.rangeTo}
              total={recentPayPager.total}
              page={recentPayPager.page}
              pageCount={recentPayPager.pageCount}
              pagerNums={recentPayPager.pagerNums}
              onPrev={recentPayPager.goPrev}
              onNext={recentPayPager.goNext}
              onSelectPage={recentPayPager.setPage}
              canPrev={recentPayPager.canPrev}
              canNext={recentPayPager.canNext}
            />
          </section>

          <section className={ui.accountantPaymentSecurityCard}>
            <div className={ui.accountantPaymentSecurityHead}>
              <span className={ui.accountantPaymentSecurityIcon}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l7 3v6c0 4.4-3 8.4-7 9-4-0.6-7-4.6-7-9V6l7-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className={ui.accountantPaymentRailTitle}>Security Health</h2>
            </div>
            <div className={ui.accountantPaymentSecurityRows}>
              <div className={ui.accountantPaymentSecurityRow}>
                <span>Biometric Auth</span>
                <strong>Enabled</strong>
              </div>
              <div className={ui.accountantPaymentSecurityRow}>
                <span>IP Filtering</span>
                <strong>Active</strong>
              </div>
            </div>
            <p className={ui.accountantPaymentSecurityMeta}>Last authenticated from: 192.168.1.42</p>
            <button type="button" className={ui.accountantPaymentSecurityBtn}>
              View Security Logs
            </button>
          </section>
        </aside>
      </div>

      <section className={ui.accountantPaymentInsight}>
        <div className={ui.accountantPaymentInsightIcon}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l1.8 4.7L18 9.5l-4.2 1.7L12 16l-1.8-4.8L6 9.5l4.2-1.8L12 3zm7 12l.9 2.2L22 18l-2.1.8L19 21l-.9-2.2L16 18l2.1-.8L19 15zM5 14l.9 2.2L8 17l-2.1.8L5 20l-.9-2.2L2 17l2.1-.8L5 14z" fill="currentColor" />
          </svg>
        </div>
        <div>
          <h2 className={ui.accountantPaymentInsightTitle}>{t('cungaAi.paymentInsightTitle')}</h2>
          <p className={ui.accountantPaymentInsightText}>
            Paying Global Logistics Corp today captures an early-payment discount of $249.00. Your cash flow projections remain optimal for the remainder of Q4.
          </p>
        </div>
      </section>
    </div>
  );
}

const ACCOUNTANT_DEMO_TRANSACTIONS = [
  {
    id: 'trx-98321',
    initials: 'AA',
    vendor: 'Apex Manufacturing',
    type: 'Hardware Components',
    transactionId: 'TRX-98321',
    date: 'Oct 24, 2023',
    amount: 42500,
    status: 'approved',
    balanceDue: 0,
    supplierEmail: 'apex@ecunga.com',
    proformaUrl: 'proforma-apex-components.pdf',
    deliveryNoteUrl: 'delivery-apex-components.pdf',
    finalInvoiceUrl: 'final-apex-components.pdf',
  },
  {
    id: 'trx-98442',
    initials: 'SL',
    vendor: 'Swift Logistics Ltd.',
    type: 'Global Shipping',
    transactionId: 'TRX-98442',
    date: 'Oct 22, 2023',
    amount: 12840.5,
    status: 'pending',
    balanceDue: 12840.5,
    supplierEmail: 'swift@ecunga.com',
    proformaUrl: 'proforma-swift-logistics.pdf',
    deliveryNoteUrl: 'delivery-swift-logistics.pdf',
    finalInvoiceUrl: '',
  },
  {
    id: 'trx-98115',
    initials: 'NX',
    vendor: 'NextGen Electronics',
    type: 'Semiconductors',
    transactionId: 'TRX-98115',
    date: 'Oct 20, 2023',
    amount: 156000,
    status: 'rejected',
    balanceDue: 0,
    supplierEmail: 'nextgen@ecunga.com',
    proformaUrl: 'proforma-nextgen.pdf',
    deliveryNoteUrl: '',
    finalInvoiceUrl: '',
  },
  {
    id: 'trx-97881',
    initials: 'VS',
    vendor: 'Vantage Solutions',
    type: 'Cloud Infrastructure',
    transactionId: 'TRX-97881',
    date: 'Oct 18, 2023',
    amount: 8200,
    status: 'approved',
    balanceDue: 0,
    supplierEmail: 'vantage@ecunga.com',
    proformaUrl: 'proforma-vantage-cloud.pdf',
    deliveryNoteUrl: 'delivery-vantage-cloud.pdf',
    finalInvoiceUrl: 'final-vantage-cloud.pdf',
  },
];

export function AccountantReports() {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const [vendorSearch, setVendorSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const spendTypes = useMemo(() => [...new Set(ACCOUNTANT_DEMO_TRANSACTIONS.map((x) => x.type))].sort(), []);
  const rows = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return ACCOUNTANT_DEMO_TRANSACTIONS.filter((entry) => {
      if (filter !== 'all' && entry.status !== filter) return false;
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      if (q && !`${entry.vendor} ${entry.transactionId} ${entry.type}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, typeFilter, vendorSearch]);
  const vendorPager = usePagedList(rows, { resetKey: `${filter}|${typeFilter}|${vendorSearch}` });

  const rowSum = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);
  const approvedN = useMemo(() => rows.filter((r) => r.status === 'approved').length, [rows]);
  const approvedPct = rows.length ? Math.round((approvedN / rows.length) * 100) : 0;
  const statusSlices = useMemo(() => {
    const m = { approved: 0, pending: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status === 'approved') m.approved += 1;
      else if (r.status === 'pending') m.pending += 1;
      else if (r.status === 'rejected') m.rejected += 1;
    }
    return [
      { name: 'Approved', value: m.approved, color: '#16a34a' },
      { name: 'Pending', value: m.pending, color: '#ca8a04' },
      { name: 'Rejected', value: m.rejected, color: '#dc2626' },
    ];
  }, [rows]);
  const statusTotal = statusSlices.reduce((s, x) => s + x.value, 0) || 1;
  const typeSlices = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      map.set(r.type, (map.get(r.type) || 0) + Number(r.amount || 0));
    }
    const arr = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const tot = arr.reduce((s, [, v]) => s + v, 0) || 1;
    return arr.map(([name, value], i) => ({
      name,
      value,
      pct: Math.round((value / tot) * 100),
      color: REPORT_SLICE_COLORS[i % REPORT_SLICE_COLORS.length],
    }));
  }, [rows]);
  const typeTotalForDonut = typeSlices.reduce((s, x) => s + x.value, 0) || 1;

  function vendorStatusLabel(status) {
    if (status === 'approved') return 'Approved';
    if (status === 'pending') return 'Pending';
    return 'Rejected';
  }

  function vendorStatusTone(status) {
    if (status === 'approved') return ui.accountantVendorBadgeApproved;
    if (status === 'pending') return ui.accountantVendorBadgePending;
    return ui.accountantVendorBadgeRejected;
  }

  function openDoc(url) {
    if (!url) return;
    window.open(safeDocUrl(url), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={ui.accountantVendorBoard}>
      <div className={ui.accountantVendorTop}>
        <div>
          <p className={ui.accountantVendorEyebrow}>Management · Supplier Transactions</p>
          <h1 className={ui.accountantVendorTitle}>{t('app.accountant.vendorTitle')}</h1>
          <div className={ui.analyticsKpiStrip} role="group" aria-label="Transaction summary">
            <span className={ui.analyticsKpiChip}>
              <strong>{rows.length}</strong>
              <span className={ui.analyticsKpiChipLabel}>rows</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{approvedPct}%</strong>
              <span className={ui.analyticsKpiChipLabel}>approved</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{formatMoney(rowSum)}</strong>
              <span className={ui.analyticsKpiChipLabel}>filtered</span>
            </span>
            <span className={ui.analyticsKpiChip}>
              <strong>{typeSlices.length}</strong>
              <span className={ui.analyticsKpiChipLabel}>types</span>
            </span>
          </div>
        </div>
        <div className={ui.accountantVendorTopActions}>
          <button type="button" className={ui.accountantVendorGhostBtn}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v9M8 11l4 4 4-4M6 19h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export Excel
          </button>
          <button type="button" className={ui.accountantVendorPrimaryBtn}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New Transaction
          </button>
        </div>
      </div>

      <div className={ui.accountantVendorStats}>
        <section className={ui.accountantVendorStatCard}>
          <p className={ui.accountantVendorStatLabel}>Status mix</p>
          <div className={ui.analyticsDonutRow}>
            <div
              className={`${ui.analyticsDonut} ${ui.analyticsDonutLg}`}
              style={{
                background:
                  statusTotal > 0
                    ? `conic-gradient(${conicGradientFromSlices(statusSlices.map((s) => ({ value: s.value, color: s.color })))})`
                    : 'rgb(226 232 240)',
              }}
              role="img"
              aria-label="Transactions by status"
            >
              <div className={ui.analyticsDonutHole}>
                <strong>{approvedPct}%</strong>
                <span>approved</span>
              </div>
            </div>
            <ul className={ui.analyticsLegend}>
              {statusSlices.map((s) => (
                <li key={s.name} className={ui.analyticsLegendRow}>
                  <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                  <span className={ui.analyticsLegendName}>{s.name}</span>
                  <span className={ui.analyticsLegendQty}>{s.value}</span>
                  <span className={ui.analyticsLegendPct}>{Math.round(((s.value || 0) / statusTotal) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={ui.accountantVendorStatCard}>
          <p className={ui.accountantVendorStatLabel}>Spend by type</p>
          <div className={ui.analyticsDonutRow}>
            <div
              className={`${ui.analyticsDonut} ${ui.analyticsDonutLg}`}
              style={{
                background:
                  typeSlices.length > 0
                    ? `conic-gradient(${conicGradientFromSlices(typeSlices.map((s) => ({ value: s.value, color: s.color })))})`
                    : 'rgb(226 232 240)',
              }}
              role="img"
              aria-label="Spend share by category"
            >
              <div className={ui.analyticsDonutHole}>
                <strong>{typeSlices[0]?.pct ?? 0}%</strong>
                <span>top type</span>
              </div>
            </div>
            <ul className={ui.analyticsLegend}>
              {typeSlices.length ? (
                typeSlices.map((s) => (
                  <li key={s.name} className={ui.analyticsLegendRow}>
                    <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                    <span className={ui.analyticsLegendName}>{s.name}</span>
                    <span className={ui.analyticsLegendQty}>{formatMoney(s.value)}</span>
                    <span className={ui.analyticsLegendPct}>{s.pct}%</span>
                  </li>
                ))
              ) : (
                <li className={ui.analyticsLegendRowMuted}>No rows in this filter.</li>
              )}
            </ul>
          </div>
        </section>

        <section className={ui.accountantVendorStatCard}>
          <p className={ui.accountantVendorStatLabel}>Outstanding &amp; MTD</p>
          <div className={ui.analyticsMetricDonutRow}>
            <div
              className={`${ui.analyticsDonut} ${ui.analyticsDonutXs}`}
              style={{
                background: `conic-gradient(var(--ec-primary) 0% 58%, rgb(226 232 240) 58% 100%)`,
              }}
              role="presentation"
            >
              <div className={ui.analyticsDonutHole}>
                <strong className={ui.analyticsDonutHoleSm}>58%</strong>
              </div>
            </div>
            <div>
              <div className={ui.accountantVendorValueRow}>
                <strong className={ui.accountantVendorStatValue}>
                  <MoneyFigure
                    value={1142800}
                    amountClassName={ui.accountantVendorStatAmount}
                    currencyClassName={ui.accountantVendorStatCurrency}
                  />
                </strong>
                <span className={ui.accountantVendorDelta}>-12%</span>
              </div>
              <p className={ui.accountantVendorStatMeta}>Outstanding · MTD paid below</p>
              <strong className={ui.accountantVendorStatValue} style={{ marginTop: '0.35rem', display: 'block' }}>
                <MoneyFigure
                  value={840230}
                  amountClassName={ui.accountantVendorStatAmount}
                  currencyClassName={ui.accountantVendorStatCurrency}
                />
              </strong>
            </div>
          </div>
          <div className={ui.analyticsMicroBars} aria-hidden>
            {typeSlices.length
              ? typeSlices.map((s) => (
                  <div
                    key={s.name}
                    className={ui.analyticsMicroBar}
                    style={{ height: `${Math.max(12, (s.value / typeTotalForDonut) * 100)}%` }}
                  />
                ))
              : null}
          </div>
        </section>
      </div>

      <section className={ui.accountantVendorLedgerCard}>
        <div className={ui.accountantVendorLedgerHead}>
          <h2 className={ui.accountantVendorLedgerTitle}>Recent Transactions</h2>
        </div>

        <div className={ui.accountantVendorFiltersGrid}>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>Search vendors &amp; IDs</span>
            <input
              className={ui.portalFilterSearch}
              placeholder="Vendor, transaction ID, category…"
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
            />
          </label>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>Status</span>
            <select className={ui.accountantVendorSelect} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All Transactions</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>Spend type</span>
            <select className={ui.accountantVendorSelect} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              {spendTypes.map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', paddingBottom: '0.1rem' }}>
            <ClearFiltersIconButton
              title={t('common.clearFiltersAria')}
              onClick={() => {
                setVendorSearch('');
                setTypeFilter('all');
                setFilter('all');
              }}
            />
            <span className={ui.portalFilterMeta}>{rows.length} transactions</span>
          </div>
        </div>

        <div className={ui.accountantVendorTableHead}>
          <span>Supplier</span>
          <span>Transaction ID</span>
          <span>Date</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Balance Due</span>
          <span>Final invoice (PDF)</span>
          <span>Supporting documents</span>
          <span>Action</span>
        </div>

        <div className={ui.accountantVendorRows}>
          {rows.length === 0 ? (
            <p className={ui.empty}>No transactions match these filters.</p>
          ) : (
            vendorPager.pageSlice.map((entry) => (
              <article key={entry.id} className={ui.accountantVendorRow}>
                <div className={ui.accountantVendorSupplier}>
                  <span className={ui.accountantVendorAvatar}>{entry.initials}</span>
                  <div>
                    <p className={ui.accountantVendorSupplierName}>{entry.vendor}</p>
                    <p className={ui.accountantVendorSupplierMeta}>{entry.type}</p>
                  </div>
                </div>
                <div className={ui.accountantVendorTransactionId}>{entry.transactionId}</div>
                <div className={ui.accountantVendorDate}>{entry.date}</div>
                <div className={ui.accountantVendorAmount}>{formatMoney(entry.amount)}</div>
                <div>
                  <span className={`${ui.accountantVendorBadge} ${vendorStatusTone(entry.status)}`}>{vendorStatusLabel(entry.status)}</span>
                </div>
                <div className={entry.balanceDue > 0 ? ui.accountantVendorBalanceDueHot : ui.accountantVendorBalanceDue}>
                  {formatMoney(entry.balanceDue)}
                </div>
                <div>
                  {entry.finalInvoiceUrl ? (
                    <button type="button" className={ui.accountantVendorLinkBtn} onClick={() => openDoc(entry.finalInvoiceUrl)}>
                      Final invoice
                    </button>
                  ) : (
                    <span className={ui.mutedSm}>Not uploaded</span>
                  )}
                </div>
                <div className={ui.accountantApprovalActions}>
                  <button type="button" className={ui.accountantInvoiceIconBtn} onClick={() => openDoc(entry.proformaUrl)}>
                    Proforma
                  </button>
                  <button
                    type="button"
                    className={ui.accountantInvoiceIconBtn}
                    onClick={() => openDoc(entry.deliveryNoteUrl)}
                    disabled={!entry.deliveryNoteUrl}
                  >
                    Delivery note
                  </button>
                </div>
                <a href={`mailto:${entry.supplierEmail}`} className={ui.accountantVendorLinkBtn}>
                  Contact supplier
                </a>
              </article>
            ))
          )}
        </div>

        <div className={ui.accountantVendorLedgerFooter}>
          <ListPageControls
            variant="table"
            rangeFrom={vendorPager.rangeFrom}
            rangeTo={vendorPager.rangeTo}
            total={vendorPager.total}
            page={vendorPager.page}
            pageCount={vendorPager.pageCount}
            pagerNums={vendorPager.pagerNums}
            onPrev={vendorPager.goPrev}
            onNext={vendorPager.goNext}
            onSelectPage={vendorPager.setPage}
            canPrev={vendorPager.canPrev}
            canNext={vendorPager.canNext}
          />
        </div>
      </section>

      <div className={ui.accountantVendorBottom}>
        <section className={ui.accountantVendorInsightCard}>
          <p className={ui.accountantVendorInsightEyebrow}>{t('cungaAi.vendorInsightEyebrow')}</p>
          <div className={ui.analyticsStackBarWide} role="img" aria-label="Status share">
            {statusSlices.some((s) => s.value > 0) ? (
              statusSlices
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div
                    key={s.name}
                    className={ui.analyticsStackSeg}
                    style={{ flex: Math.max(1, s.value), background: s.color }}
                    title={`${s.name} ${Math.round(((s.value || 0) / statusTotal) * 100)}%`}
                  />
                ))
            ) : (
              <div className={ui.analyticsStackSeg} style={{ flex: 1, background: 'rgb(226 232 240)' }} title="No rows" />
            )}
          </div>
          <ul className={ui.analyticsLegendInline} style={{ marginTop: '0.65rem' }}>
            {statusSlices.map((s) => (
              <li key={s.name} className={ui.analyticsLegendRow}>
                <span className={ui.analyticsLegendSwatch} style={{ background: s.color }} />
                <span className={ui.analyticsLegendName}>{s.name}</span>
                <span className={ui.analyticsLegendPct}>{Math.round(((s.value || 0) / statusTotal) * 100)}%</span>
              </li>
            ))}
          </ul>
          <button type="button" className={ui.accountantVendorInsightLink}>
            Cash flow forecast →
          </button>
        </section>

        <section className={ui.accountantVendorDistributionCard}>
          <p className={ui.accountantVendorDistributionTitle}>Type mix (amount-weighted)</p>
          <div className={ui.accountantVendorDistributionBar}>
            {typeSlices.map((s) => (
              <span
                key={s.name}
                style={{
                  flex: Math.max(1, s.pct),
                  minHeight: '100%',
                  background: s.color,
                }}
              />
            ))}
          </div>
          <div className={ui.accountantVendorLegend}>
            {typeSlices.length ? (
              typeSlices.map((s) => (
                <span key={s.name}>
                  <i style={{ background: s.color, width: '0.55rem', height: '0.55rem', borderRadius: '999px', display: 'inline-block' }} />{' '}
                  {s.name} ({s.pct}%)
                </span>
              ))
            ) : (
              <span className={ui.analyticsLegendRowMuted}>No type data.</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AccountantMessages() {
  return <PortalMessagingHub role="accountant" />;
}

export function AccountantPlaceholder({ title, body }) {
  return (
    <div className={ui.panel}>
      <h2 className={ui.panelTitle}>{title}</h2>
      <p className={ui.muted}>{body}</p>
    </div>
  );
}
