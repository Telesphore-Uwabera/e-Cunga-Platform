import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { accountantReviewInvoice, getMessagesForRole, getNotificationsForRole, markInvoicePaid, usePortalState } from '../../data/mockPortal.js';
import ui from './DashboardUi.module.css';
import { ActivityFeed, StatusBadge, formatMoney, workflowLabel } from './roleUi.jsx';

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
  if (status === 'proformaReceived') return 'pending';
  return 'approved';
}

function accountantFinanceLabel(status) {
  if (status === 'proformaApproved') return 'Accepted proforma';
  if (status === 'proformaReceived') return 'Pending approval';
  if (status === 'rejected') return 'Rejected';
  if (status === 'paid') return 'Paid';
  if (status === 'deliveryNoteAttached') return 'Delivery note attached';
  if (status === 'closed') return 'Closed';
  return workflowLabel(status);
}

export function AccountantDashboard() {
  const { t } = useI18n();
  const state = usePortalState();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pendingPayments = state.invoices
    .filter((entry) => entry.status === 'proformaApproved')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const monthlyExpenses = state.invoices
    .filter((entry) => ['paid', 'closed'].includes(entry.status))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const overdueInvoices = state.invoices.filter((entry) => ['proformaReceived', 'proformaApproved'].includes(entry.status)).length;
  const pendingApprovals = state.invoices.filter((entry) => entry.status === 'proformaReceived').length;
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
    if (status === 'proformaReceived') return ui.accountantTxnPending;
    return ui.accountantTxnApproved;
  }

  function transactionLabel(status) {
    if (status === 'rejected') return 'Rejected';
    if (status === 'proformaReceived') return 'Pending';
    return 'Approved';
  }

  return (
    <div className={ui.accountantDash}>
      <div className={ui.accountantSummaryGrid}>
        <article className={ui.accountantSummaryCard}>
          <p className={ui.accountantSummaryLabel}>Pending payments</p>
          <p className={ui.accountantSummaryValue}>{formatMoney(pendingPayments)}</p>
          <span className={ui.accountantSummaryPill}>+ 12% from last month</span>
        </article>

        <article className={ui.accountantSummaryCard}>
          <p className={ui.accountantSummaryLabel}>Monthly expenses</p>
          <p className={ui.accountantSummaryValue}>{formatMoney(monthlyExpenses)}</p>
          <span className={`${ui.accountantSummaryPill} ${ui.accountantSummaryPillBad}`}>+ 4.5% over budget</span>
        </article>

        <article className={ui.accountantSummaryCard}>
          <p className={ui.accountantSummaryLabel}>Overdue invoices</p>
          <p className={ui.accountantSummaryValue}>{overdueInvoices}</p>
          <span className={`${ui.accountantSummaryPill} ${ui.accountantSummaryPillInfo}`}>Action required</span>
        </article>

        <article className={ui.accountantSummaryCard}>
          <p className={ui.accountantSummaryLabel}>Pending approvals</p>
          <p className={ui.accountantSummaryValue}>{pendingApprovals}</p>
          <span className={ui.accountantSummaryPill}>Avg 4h response</span>
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
          <h2 className={ui.accountantInsightTitle}>The Digital Curator</h2>
          <div className={ui.accountantInsightList}>
            <article className={ui.accountantInsightItem}>
              <p className={ui.accountantInsightEyebrow}>Liquidity Alert</p>
              <p className={ui.accountantInsightText}>
                Inventory holding costs for North Sector have increased by 14.2% this week. Consider adjusting procurement velocity.
              </p>
            </article>
            <article className={ui.accountantInsightItem}>
              <p className={ui.accountantInsightEyebrow}>Tax Opportunity</p>
              <p className={ui.accountantInsightText}>
                Eligible R&D credits detected in Q2 overhead. Estimated savings: {formatMoney(12400)} before next Friday.
              </p>
            </article>
          </div>
          <button type="button" className={ui.accountantInsightBtn} onClick={() => navigate('/app/accountant/reports')}>
            Apply Optimized Strategy
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
  const state = usePortalState();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('pending');
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
          };
        })
        .sort((a, b) => new Date(b.invoice.updatedAt || b.invoice.createdAt) - new Date(a.invoice.updatedAt || a.invoice.createdAt)),
    [state.invoices, state.requisitions]
  );
  const rows =
    filter === 'all'
      ? approvalRequests
      : approvalRequests.filter((entry) => entry.bucket === filter);
  const awaitingCount = approvalRequests.filter((entry) => entry.bucket === 'pending').length;
  const fiscalSpend = approvalRequests.reduce((sum, entry) => sum + entry.totalCost, 0);

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
            ['pending', 'Pending'],
            ['approved', 'Approved'],
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
          </div>

          <div className={ui.accountantApprovalRows}>
            {rows.length ? (
              rows.map((entry) => (
                <article key={entry.id} className={ui.accountantApprovalRow}>
                  <div className={ui.accountantApprovalId}>{entry.requestId}</div>
                  <div>
                    <p className={ui.accountantApprovalItem}>{entry.item}</p>
                    <p className={ui.accountantApprovalMeta}>{entry.category}</p>
                  </div>
                  <div className={ui.accountantApprovalQty}>{entry.qty}</div>
                  <div className={ui.accountantApprovalCost}>{formatMoney(entry.totalCost, entry.currency)}</div>
                  <div className={ui.accountantApprovalRequester}>
                    <span className={ui.accountantApprovalAvatar}>{entry.requesterInitials || 'RQ'}</span>
                    <div>
                      <p className={ui.accountantApprovalRequesterName}>{entry.requester}</p>
                      <StatusBadge status={accountantFinanceLabel(entry.invoice.status)} />
                    </div>
                  </div>
                  {entry.bucket === 'pending' ? (
                    <div className={ui.accountantApprovalActions}>
                      <button type="button" className={ui.accountantApprovalReject} onClick={() => accountantReviewInvoice(entry.invoice.id, 'rejected')}>
                        Reject
                      </button>
                      <button type="button" className={ui.accountantApprovalApprove} onClick={() => accountantReviewInvoice(entry.invoice.id, 'approved')}>
                        Approve
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className={ui.empty}>No material requests match this finance view.</p>
            )}
          </div>
        </section>

        <aside className={ui.accountantApprovalRail}>
          <section className={ui.accountantApprovalInsight}>
            <div className={ui.accountantApprovalInsightHead}>
              <span className={ui.accountantApprovalInsightIcon}>
                <AccountantIcon kind="payment" />
              </span>
              <div>
                <h2 className={ui.accountantApprovalRailTitle}>AI Curator Insight</h2>
                <p className={ui.accountantApprovalRailMeta}>Analyzing #MAT-9011</p>
              </div>
            </div>

            <div className={ui.accountantApprovalInsightBox}>
              <p className={ui.accountantApprovalInsightLabel}>Financial projection</p>
              <p className={ui.accountantApprovalInsightText}>
                This purchase is 14% below the rolling 6-month average for lubricants. Immediate approval recommended to secure current vendor rebate.
              </p>
            </div>

            <div className={ui.accountantApprovalMetricRow}>
              <span>Market volatility</span>
              <strong>Low Risk</strong>
            </div>
            <div className={ui.accountantApprovalMetricTrack}>
              <div className={ui.accountantApprovalMetricFill} />
            </div>

            <div className={ui.accountantApprovalMetricRow}>
              <span>Budget impact</span>
              <strong>Minimal (0.2%)</strong>
            </div>
            <div className={ui.accountantApprovalMetricTrack}>
              <div className={`${ui.accountantApprovalMetricFill} ${ui.accountantApprovalMetricFillSoft}`} />
            </div>

            <button type="button" className={ui.accountantApprovalInsightBtn} onClick={() => navigate('/app/accountant/reports')}>
              Stock Prediction
            </button>
          </section>

          <section className={ui.accountantApprovalSummary}>
            <p className={ui.accountantApprovalSummaryLabel}>Fiscal Summary</p>
            <p className={ui.accountantApprovalSummaryMeta}>Q3 operational spending</p>
            <strong className={ui.accountantApprovalSummaryValue}>{formatMoney(fiscalSpend)}</strong>
            <span className={ui.accountantApprovalSummaryPill}>+ 2.4% MoM</span>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function AccountantInvoices() {
  const { t } = useI18n();
  const state = usePortalState();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
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
            bucket:
              invoice.status === 'proformaApproved'
                ? 'accepted'
                : invoice.status === 'proformaReceived'
                ? 'pending'
                : invoice.status === 'rejected'
                ? 'rejected'
                : 'paid',
            requisitionTitle: requisition?.title || 'Inventory workflow',
          };
        }),
    [state.invoices, state.requisitions]
  );
  const rows =
    filter === 'all'
      ? invoices
      : invoices.filter((entry) => entry.bucket === filter);
  const totalOutstanding = invoices
    .filter((entry) => ['proformaReceived', 'proformaApproved'].includes(entry.status))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const pendingApprovals = invoices.filter((entry) => entry.status === 'proformaReceived').length;

  function invoiceStatusTone(status) {
    if (status === 'rejected') return ui.accountantInvoiceBadgeRejected;
    if (status === 'proformaApproved') return ui.accountantInvoiceBadgeAccepted;
    if (['paid', 'deliveryNoteAttached', 'closed'].includes(status)) return ui.accountantInvoiceBadgePaid;
    return ui.accountantInvoiceBadgePending;
  }

  function invoiceStatusLabel(status) {
    return accountantFinanceLabel(status);
  }

  return (
    <div className={ui.accountantInvoiceBoard}>
      <div className={ui.accountantInvoiceTop}>
        <div>
          <h1 className={ui.accountantInvoiceTitle}>{t('app.accountant.invoiceTitle')}</h1>
          <p className={ui.accountantInvoiceLead}>Review and process your digital receivables and payables.</p>
        </div>
        <div className={ui.accountantInvoiceTopActions}>
          <button type="button" className={ui.accountantInvoiceGhostBtn}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 7h8M8 11h8M8 15h5M6 3h9l3 3v15H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Import Bulk
          </button>
          <button type="button" className={ui.accountantInvoicePrimaryBtn}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Create Invoice
          </button>
        </div>
      </div>

      <div className={ui.accountantInvoiceStats}>
        <section className={ui.accountantInvoiceStatCard}>
          <p className={ui.accountantInvoiceStatLabel}>Total outstanding</p>
          <strong className={ui.accountantInvoiceStatValue}>{formatMoney(totalOutstanding)}</strong>
          <span className={ui.accountantInvoiceTrend}>+12.5% from last month</span>
        </section>

        <section className={ui.accountantInvoiceStatCard}>
          <p className={ui.accountantInvoiceStatLabel}>Pending approval</p>
          <strong className={ui.accountantInvoiceStatValue}>{pendingApprovals}</strong>
          <span className={ui.accountantInvoiceMutedMeta}>Avg. 2 days delay</span>
        </section>

        <section className={ui.accountantInvoicePrediction}>
          <div>
            <p className={ui.accountantInvoicePredictionTitle}>AI Cash Flow Prediction</p>
            <p className={ui.accountantInvoicePredictionText}>
              Based on current trends, we anticipate 85% of pending invoices will be cleared by the 15th of next month.
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
          <button type="button" className={ui.accountantInvoiceFilterBtn}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M8 12h8M10 17h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Advanced Filters
          </button>
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
          <span className={ui.accountantInvoiceShowing}>Showing {rows.length} of {invoices.length} invoices</span>
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
            rows.map((entry) => (
              <article key={entry.id} className={ui.accountantInvoiceRow}>
                <label className={ui.accountantInvoiceCheck}>
                  <input type="checkbox" />
                </label>
                <div className={ui.accountantInvoiceId}>{entry.reference}</div>
                <div className={ui.accountantInvoiceSupplier}>
                  <span className={ui.accountantInvoiceAvatar}>{entry.initials}</span>
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
                  <button type="button" className={ui.accountantInvoiceIconBtn} aria-label="Document count">
                    {invoiceDocsCount(entry)}
                  </button>
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
          <div className={ui.accountantInvoicePager}>
            <button type="button" className={ui.accountantInvoicePagerBtn} aria-label="Previous page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className={ui.accountantInvoicePageActive}>1</button>
            <button type="button" className={ui.accountantInvoicePageBtn}>2</button>
            <button type="button" className={ui.accountantInvoicePageBtn}>3</button>
            <button type="button" className={ui.accountantInvoicePagerBtn} aria-label="Next page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className={ui.accountantInvoiceFooterMeta}>
            <span>Items per page:</span>
            <strong>25</strong>
          </div>
        </div>
      </section>

      <button type="button" className={ui.accountantInvoiceFab} aria-label="Create invoice quick action">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function AccountantPayments() {
  const { t } = useI18n();
  const state = usePortalState();
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
  const recentPayments = useMemo(
    () =>
      [...state.invoices]
        .filter((entry) => ['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status))
        .sort((a, b) => new Date(b.paidAt || b.updatedAt || b.createdAt) - new Date(a.paidAt || a.updatedAt || a.createdAt))
        .slice(0, 3)
        .map((entry, index) => ({
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

  function authorizeSelectedPayments() {
    selectedInvoiceIds.forEach((invoiceId) => {
      markInvoicePaid(invoiceId, actor?.id);
    });
  }

  return (
    <div className={ui.accountantPaymentBoard}>
      <div>
        <h1 className={ui.accountantPaymentTitle}>{t('app.accountant.paymentTitle')}</h1>
        <p className={ui.accountantPaymentLead}>Securely manage and authorize outgoing payments to suppliers.</p>
      </div>

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
              <select className={ui.accountantPaymentSelect} value={supplier} onChange={(event) => setSupplier(event.target.value)}>
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
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 10h18M5 6h14v12H5zM9 14h.01M12 14h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  ACH Transfer
                </button>
                <button
                  type="button"
                  className={paymentMethod === 'virtual' ? ui.accountantPaymentMethodActive : ui.accountantPaymentMethod}
                  onClick={() => setPaymentMethod('virtual')}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16v10H4zM4 10h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                  Virtual Card
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
                invoices.map((invoice) => (
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
          </div>

          <div className={ui.accountantPaymentFooter}>
            <div>
              <p className={ui.accountantPaymentTotalLabel}>Total disbursement amount</p>
              <strong className={ui.accountantPaymentTotalValue}>{formatMoney(totalDisbursement)}</strong>
            </div>
            <button type="button" className={ui.accountantPaymentAuthorizeBtn} disabled={!selectedInvoiceIds.length} onClick={authorizeSelectedPayments}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l7 3v6c0 4.4-3 8.4-7 9-4-0.6-7-4.6-7-9V6l7-3zm-2.2 9.2l1.6 1.6 3.4-3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Pay and Notify Supplier
            </button>
          </div>
        </section>

        <aside className={ui.accountantPaymentRail}>
          <section className={ui.accountantPaymentRecentCard}>
            <h2 className={ui.accountantPaymentRailTitle}>Recent Payments</h2>
            <div className={ui.accountantPaymentRecentList}>
              {recentPayments.map((payment) => (
                <article key={payment.batch} className={ui.accountantPaymentRecentItem}>
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
          <h2 className={ui.accountantPaymentInsightTitle}>The Curator&apos;s Insight</h2>
          <p className={ui.accountantPaymentInsightText}>
            Paying Global Logistics Corp today captures an early-payment discount of $249.00. Your cash flow projections remain optimal for the remainder of Q4.
          </p>
        </div>
      </section>
    </div>
  );
}

export function AccountantReports() {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const transactions = [
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
    },
  ];
  const rows = filter === 'all' ? transactions : transactions.filter((entry) => entry.status === filter);

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

  return (
    <div className={ui.accountantVendorBoard}>
      <div className={ui.accountantVendorTop}>
        <div>
          <p className={ui.accountantVendorEyebrow}>Management · Supplier Transactions</p>
          <h1 className={ui.accountantVendorTitle}>{t('app.accountant.vendorTitle')}</h1>
          <p className={ui.accountantVendorLead}>Monitoring $2.4M in total accounts payable across 14 active partners.</p>
        </div>
        <div className={ui.accountantVendorTopActions}>
          <button type="button" className={ui.accountantVendorGhostBtn}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v9M8 11l4 4 4-4M6 19h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
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
          <p className={ui.accountantVendorStatLabel}>Total outstanding</p>
          <div className={ui.accountantVendorValueRow}>
            <strong className={ui.accountantVendorStatValue}>{formatMoney(1142800)}</strong>
            <span className={ui.accountantVendorDelta}>-12%</span>
          </div>
          <p className={ui.accountantVendorStatMeta}>Estimated closure: 14 days</p>
        </section>

        <section className={ui.accountantVendorStatCard}>
          <p className={ui.accountantVendorStatLabel}>Total paid (MTD)</p>
          <strong className={ui.accountantVendorStatValue}>{formatMoney(840230)}</strong>
          <p className={ui.accountantVendorStatMeta}>92% of scheduled payments completed</p>
        </section>

        <section className={ui.accountantVendorStatCard}>
          <p className={ui.accountantVendorStatLabel}>Active vendors</p>
          <div className={ui.accountantVendorPartnerRow}>
            <strong className={ui.accountantVendorPartnerValue}>14</strong>
            <span className={ui.accountantVendorPartnerText}>partners</span>
          </div>
          <div className={ui.accountantVendorAvatarGroup}>
            <span>AA</span>
            <span>SL</span>
            <span>NX</span>
            <span>VS</span>
            <small>+11</small>
          </div>
        </section>
      </div>

      <section className={ui.accountantVendorLedgerCard}>
        <div className={ui.accountantVendorLedgerHead}>
          <h2 className={ui.accountantVendorLedgerTitle}>Recent Transactions</h2>
          <div className={ui.accountantVendorLedgerTools}>
            <label className={ui.accountantVendorFilterWrap}>
              <span>Filter by status</span>
              <select className={ui.accountantVendorSelect} value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All Transactions</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
        </div>

        <div className={ui.accountantVendorTableHead}>
          <span>Supplier</span>
          <span>Transaction ID</span>
          <span>Date</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Balance Due</span>
          <span>Action</span>
        </div>

        <div className={ui.accountantVendorRows}>
          {rows.map((entry) => (
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
              <button type="button" className={ui.accountantVendorLinkBtn}>
                View Records
              </button>
            </article>
          ))}
        </div>

        <div className={ui.accountantVendorLedgerFooter}>
          <span className={ui.accountantVendorFooterMeta}>Showing 4 of 128 transactions</span>
          <div className={ui.accountantVendorPager}>
            <button type="button" className={ui.accountantVendorPagerBtn} aria-label="Previous page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className={ui.accountantVendorPageActive}>1</button>
            <button type="button" className={ui.accountantVendorPageBtn}>2</button>
            <button type="button" className={ui.accountantVendorPageBtn}>3</button>
            <button type="button" className={ui.accountantVendorPagerBtn} aria-label="Next page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <div className={ui.accountantVendorBottom}>
        <section className={ui.accountantVendorInsightCard}>
          <p className={ui.accountantVendorInsightEyebrow}>The Curator&apos;s Insight</p>
          <p className={ui.accountantVendorInsightText}>
            Based on your Q4 projections, switching <strong>Apex Manufacturing</strong> to a net-60 payment term could improve your immediate liquidity by 14%.
            Their historical compliance rate is 98%, making them a low-risk candidate for negotiation.
          </p>
          <button type="button" className={ui.accountantVendorInsightLink}>View Cash Flow Forecast</button>
        </section>

        <section className={ui.accountantVendorDistributionCard}>
          <p className={ui.accountantVendorDistributionTitle}>Payment Distribution by Vendor Type</p>
          <div className={ui.accountantVendorDistributionBar}>
            <span className={ui.accountantVendorDistributionHardware} />
            <span className={ui.accountantVendorDistributionLogistics} />
            <span className={ui.accountantVendorDistributionInfra} />
          </div>
          <div className={ui.accountantVendorLegend}>
            <span><i className={ui.accountantVendorLegendHardware} /> Manufacturing (45%)</span>
            <span><i className={ui.accountantVendorLegendLogistics} /> Logistics (20%)</span>
            <span><i className={ui.accountantVendorLegendInfra} /> Infrastructure (35%)</span>
          </div>
        </section>
      </div>
    </div>
  );
}

export function AccountantMessages() {
  const { t } = useI18n();
  const state = usePortalState();
  const messages = getMessagesForRole('accountant');
  const notifications = getNotificationsForRole('accountant');
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);
  const financeThreads = [
    {
      id: 'thread-1',
      channel: 'Supplier Payment',
      contact: 'Apex Manufacturing',
      initials: 'AM',
      subject: 'Updated proforma and payment release',
      preview: 'We uploaded the corrected banking letter and revised the shipping surcharge as requested.',
      time: '09:12',
      unread: true,
      status: 'Needs response',
      messages: [
        {
          author: 'Apex Manufacturing',
          meta: 'Supplier · 08:45',
          body: 'Good morning. We uploaded the corrected banking letter and revised the shipping surcharge for PO-2841.',
        },
        {
          author: actor?.fullName || 'Finance Controller',
          meta: 'You · 08:58',
          body: 'Received. I am reviewing the revised total against the approved batch before I release payment.',
        },
        {
          author: 'Apex Manufacturing',
          meta: 'Supplier · 09:12',
          body: 'Thank you. Please confirm whether the revised settlement can still be processed in today’s cycle.',
        },
      ],
    },
    {
      id: 'thread-2',
      channel: 'Approval Escalation',
      contact: 'Supervisor Desk',
      initials: 'SD',
      subject: 'Priority review for lubricant requisition',
      preview: 'This request supports emergency maintenance and needs finance clearance before 14:00.',
      time: '08:30',
      unread: true,
      status: 'High priority',
      messages: [
        {
          author: 'Supervisor Desk',
          meta: 'Supervisor · 08:30',
          body: 'Please prioritize the lubricant requisition. Engineering needs confirmation before 14:00 to avoid downtime.',
        },
        {
          author: actor?.fullName || 'Finance Controller',
          meta: 'You · 08:42',
          body: 'Understood. I am validating the vendor rate against the rolling average before final sign-off.',
        },
      ],
    },
    {
      id: 'thread-3',
      channel: 'Internal Audit',
      contact: 'Audit Office',
      initials: 'AO',
      subject: 'Quarter-close attachment request',
      preview: 'Please share delivery notes and approval comments for the last three closed vendor batches.',
      time: 'Yesterday',
      unread: false,
      status: 'Document request',
      messages: [
        {
          author: 'Audit Office',
          meta: 'Audit · Yesterday',
          body: 'Please share delivery notes and approval comments for the last three closed vendor batches before noon.',
        },
        {
          author: actor?.fullName || 'Finance Controller',
          meta: 'You · Yesterday',
          body: 'The files are compiled. I will attach the batch references together with the payment trail.',
        },
      ],
    },
  ];
  const [activeThreadId, setActiveThreadId] = useState(financeThreads[0].id);
  const activeThread = financeThreads.find((entry) => entry.id === activeThreadId) || financeThreads[0];
  const unreadThreads = financeThreads.filter((entry) => entry.unread).length;

  return (
    <div className={ui.accountantCommsBoard}>
      <div>
        <p className={ui.accountantCommsEyebrow}>Financial Messages</p>
        <h1 className={ui.accountantCommsTitle}>{t('app.accountant.commsTitle')}</h1>
        <p className={ui.accountantCommsLead}>Stay aligned with payment approvals, supplier follow-ups, and audit-ready finance conversations in one workspace.</p>
      </div>

      <div className={ui.accountantCommsSummary}>
        <section className={ui.accountantCommsSummaryCard}>
          <p className={ui.accountantCommsSummaryLabel}>Unread threads</p>
          <strong className={ui.accountantCommsSummaryValue}>{unreadThreads}</strong>
          <span className={ui.accountantCommsSummaryMeta}>Needs attention this morning</span>
        </section>
        <section className={ui.accountantCommsSummaryCard}>
          <p className={ui.accountantCommsSummaryLabel}>Finance alerts</p>
          <strong className={ui.accountantCommsSummaryValue}>{notifications.length}</strong>
          <span className={ui.accountantCommsSummaryMeta}>Approval, due-date, and audit reminders</span>
        </section>
        <section className={ui.accountantCommsSummaryCard}>
          <p className={ui.accountantCommsSummaryLabel}>Open payment follow-ups</p>
          <strong className={ui.accountantCommsSummaryValue}>4</strong>
          <span className={ui.accountantCommsSummaryMeta}>Vendor callbacks before close of day</span>
        </section>
      </div>

      <div className={ui.accountantCommsGrid}>
        <section className={ui.accountantCommsInboxCard}>
          <div className={ui.accountantCommsSectionHead}>
            <h2 className={ui.accountantCommsSectionTitle}>Priority Inbox</h2>
            <span className={ui.accountantCommsSectionMeta}>{financeThreads.length} active threads</span>
          </div>
          <div className={ui.accountantCommsThreadList}>
            {financeThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={thread.id === activeThread.id ? ui.accountantCommsThreadActive : ui.accountantCommsThread}
                onClick={() => setActiveThreadId(thread.id)}
              >
                <span className={ui.accountantCommsThreadAvatar}>{thread.initials}</span>
                <div className={ui.accountantCommsThreadBody}>
                  <div className={ui.accountantCommsThreadTop}>
                    <p className={ui.accountantCommsThreadContact}>{thread.contact}</p>
                    <span className={ui.accountantCommsThreadTime}>{thread.time}</span>
                  </div>
                  <p className={ui.accountantCommsThreadSubject}>{thread.subject}</p>
                  <p className={ui.accountantCommsThreadPreview}>{thread.preview}</p>
                  <div className={ui.accountantCommsThreadFoot}>
                    <span className={ui.accountantCommsThreadChannel}>{thread.channel}</span>
                    <span className={thread.unread ? ui.accountantCommsThreadStatusHot : ui.accountantCommsThreadStatus}>{thread.status}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className={ui.accountantCommsConversationCard}>
          <div className={ui.accountantCommsSectionHead}>
            <div>
              <h2 className={ui.accountantCommsSectionTitle}>{activeThread.subject}</h2>
              <p className={ui.accountantCommsConversationMeta}>{activeThread.contact} · {activeThread.channel}</p>
            </div>
            <button type="button" className={ui.accountantCommsReplyBtn}>Reply with template</button>
          </div>

          <div className={ui.accountantCommsMessageStack}>
            {activeThread.messages.map((message) => (
              <article key={`${activeThread.id}-${message.meta}`} className={ui.accountantCommsMessageCard}>
                <p className={ui.accountantCommsMessageAuthor}>{message.author}</p>
                <p className={ui.accountantCommsMessageMeta}>{message.meta}</p>
                <p className={ui.accountantCommsMessageBody}>{message.body}</p>
              </article>
            ))}
          </div>

          <div className={ui.accountantCommsComposer}>
            <p className={ui.accountantCommsComposerLabel}>Suggested response</p>
            <p className={ui.accountantCommsComposerText}>
              We have validated the revised document pack. Final finance confirmation will be released once batch totals are reconciled against the approved disbursement limit.
            </p>
            <div className={ui.accountantCommsComposerActions}>
              <button type="button" className={ui.accountantCommsGhostBtn}>Save draft</button>
              <button type="button" className={ui.accountantCommsPrimaryBtn}>Send response</button>
            </div>
          </div>
        </section>

        <aside className={ui.accountantCommsRail}>
          <section className={ui.accountantCommsAlertCard}>
            <div className={ui.accountantCommsSectionHead}>
              <h2 className={ui.accountantCommsSectionTitle}>Finance Alerts</h2>
            </div>
            <div className={ui.accountantCommsAlertList}>
              {notifications.slice(0, 4).map((entry) => (
                <article key={entry.id} className={ui.accountantCommsAlertItem}>
                  <p className={ui.accountantCommsAlertTitle}>{entry.title}</p>
                  <p className={ui.accountantCommsAlertBody}>{entry.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={ui.accountantCommsActionCard}>
            <h2 className={ui.accountantCommsSectionTitle}>Quick Finance Actions</h2>
            <div className={ui.accountantCommsActionList}>
              <button type="button" className={ui.accountantCommsActionBtn}>Request revised invoice</button>
              <button type="button" className={ui.accountantCommsActionBtn}>Escalate to supervisor</button>
              <button type="button" className={ui.accountantCommsActionBtn}>Send payment confirmation</button>
            </div>
          </section>
        </aside>
      </div>

      <section className={ui.accountantCommsActivityCard}>
        <div className={ui.accountantCommsSectionHead}>
          <h2 className={ui.accountantCommsSectionTitle}>Recent finance activity</h2>
        </div>
        <ActivityFeed logs={state.activity.filter((entry) => entry.actorId === actor?.id).slice(0, 6)} />
      </section>
    </div>
  );
}

export function AccountantPlaceholder({ title, body }) {
  return (
    <div className={ui.panel}>
      <h2 className={ui.panelTitle}>{title}</h2>
      <p className={ui.muted}>{body}</p>
    </div>
  );
}
