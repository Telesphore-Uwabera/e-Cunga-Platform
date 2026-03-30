import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { accountantReviewInvoice, getMessagesForRole, getNotificationsForRole, markInvoicePaid, usePortalState } from '../../data/mockPortal.js';
import ui from './DashboardUi.module.css';
import { ActivityFeed, PageIntro, StatusBadge, formatDateTime, formatMoney, workflowLabel } from './roleUi.jsx';

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

export function AccountantDashboard() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);
  const approvedMaterials = state.requisitions.filter((entry) => ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid', 'closed'].includes(entry.status)).length;
  const pendingMaterials = state.requisitions.filter((entry) => ['submitted', 'proformaReceived'].includes(entry.status)).length;
  const rejectedMaterials = state.requisitions.filter((entry) => entry.status === 'rejected').length;
  const paidTotal = state.invoices.filter((entry) => entry.status === 'paid' || entry.status === 'closed').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const payable = state.invoices.filter((entry) => entry.status === 'proformaApproved');
  const pendingProformas = state.invoices.filter((entry) => entry.status === 'proformaReceived');
  const recentFinance = state.activity.filter((entry) => entry.actorId === actor?.id).slice(0, 5);

  return (
    <>
      <PageIntro
        eyebrow="Accountant"
        title="Accountant dashboard"
        description="Control approvals, invoice validation, and payment execution from one finance workspace that matches the new design direction."
      />

      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.heroHeader}>
            <div>
              <p className={ui.panelSub}>Finance overview</p>
              <h2 className={ui.panelTitle}>Operational accounting snapshot</h2>
            </div>
            <span className={ui.heroBadge}>Finance view</span>
          </div>
          <div className={ui.heroStatGrid}>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{approvedMaterials}</p>
              <p className={ui.heroStatLabel}>Workflow approved</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{pendingMaterials}</p>
              <p className={ui.heroStatLabel}>Need finance action</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{formatMoney(paidTotal)}</p>
              <p className={ui.heroStatLabel}>Paid this cycle</p>
            </div>
          </div>
        </div>

        <div className={ui.panel}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Quick ledger</p>
              <p className={ui.queueMeta}>A compact status rail similar to the reference dashboard.</p>
            </div>
            <span className={ui.iconTile}>
              <AccountantIcon kind="payment" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Pending proformas</span>
              <span>{pendingProformas.length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Ready to pay</span>
              <span>{payable.length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Rejected requests</span>
              <span>{rejectedMaterials}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Monthly spend</h2>
          <p className={ui.panelSub}>Recent spend rhythm across the latest finance windows.</p>
          <div className={ui.chart}>
            {[30, 45, 40, 52, 48, 60, 58, 63].map((height, index) => (
              <div key={index} className={ui.bar} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Recent finance activity</h2>
          <ActivityFeed logs={recentFinance} />
        </div>
      </div>
    </>
  );
}

export function AccountantApprovals() {
  const state = usePortalState();
  const [filter, setFilter] = useState('pending');
  const allInvoices = state.invoices.filter((entry) => entry.type === 'proforma' && ['proformaReceived', 'rejected', 'proformaApproved'].includes(entry.status));
  const invoices =
    filter === 'pending'
      ? allInvoices.filter((entry) => entry.status === 'proformaReceived')
      : filter === 'reviewed'
      ? allInvoices.filter((entry) => entry.status !== 'proformaReceived')
      : allInvoices;

  return (
    <>
      <PageIntro
        eyebrow="Pending requests"
        title="Review finance requests and proformas"
        description="Move supplier proformas through the accountant review queue and keep the finance decision trail visible."
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
        {invoices.slice(0, 2).map((invoice) => (
          <div key={invoice.id} className={ui.queueCard}>
            <div className={ui.queueCardHead}>
              <div>
                <p className={ui.queueTitle}>{invoice.reference}</p>
                <p className={ui.queueMeta}>{invoice.supplierName} · {formatMoney(invoice.amount, invoice.currency)}</p>
              </div>
              <StatusBadge status={workflowLabel(invoice.status)} />
            </div>
            <div className={ui.kvList}>
              <div className={ui.kvRow}>
                <span>Document type</span>
                <span>{invoice.type}</span>
              </div>
              <div className={ui.kvRow}>
                <span>Attachments</span>
                <span>{invoiceDocsCount(invoice)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Proforma approval queue</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Supplier</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.reference}</td>
                  <td>{invoice.supplierName}</td>
                  <td>{formatMoney(invoice.amount, invoice.currency)}</td>
                  <td>
                    <StatusBadge status={workflowLabel(invoice.status)} />
                  </td>
                  <td>
                    {invoice.status === 'proformaReceived' ? (
                      <div className={ui.formRow}>
                        <button type="button" className={`${ui.btn} ${ui.btnSm}`} onClick={() => accountantReviewInvoice(invoice.id, 'approved')}>
                          Approve
                        </button>
                        <button type="button" className={`${ui.btnOutline} ${ui.btn} ${ui.btnSm}`} onClick={() => accountantReviewInvoice(invoice.id, 'rejected')}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className={ui.mutedSm}>Already actioned</span>
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

export function AccountantInvoices() {
  const state = usePortalState();
  const [filter, setFilter] = useState('all');
  const invoices =
    filter === 'final'
      ? state.invoices.filter((entry) => entry.type === 'final')
      : filter === 'proforma'
      ? state.invoices.filter((entry) => entry.type === 'proforma')
      : state.invoices;

  return (
    <>
      <PageIntro
        eyebrow="Invoice management"
        title="Manage proformas, delivery notes, and final invoices"
        description="Track every supplier document and keep the invoice register aligned with payment and delivery progress."
      />

      <div className={ui.toolbar}>
        <div className={ui.segmented}>
          {[
            ['all', 'All docs'],
            ['proforma', 'Proformas'],
            ['final', 'Final invoices'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? ui.segBtnActive : ui.segBtn} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Invoice register</h2>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.reference}</td>
                    <td>{invoice.type}</td>
                    <td>{formatMoney(invoice.amount, invoice.currency)}</td>
                    <td>
                      <StatusBadge status={workflowLabel(invoice.status)} />
                    </td>
                    <td>{invoiceDocsCount(invoice) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={ui.panel}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Document health</p>
              <p className={ui.queueMeta}>A compact right-side summary like the reference invoice management screen.</p>
            </div>
            <span className={ui.iconTile}>
              <AccountantIcon kind="invoice" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Total documents</span>
              <span>{state.invoices.length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>With delivery note</span>
              <span>{state.invoices.filter((entry) => entry.deliveryNoteUrl).length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>With final invoice</span>
              <span>{state.invoices.filter((entry) => entry.finalInvoiceUrl).length}</span>
            </div>
          </div>
          <ul className={ui.listPlain}>
            {state.invoices.slice(0, 3).map((invoice) => (
              <li key={invoice.id} className={ui.listItem}>
                <p className={ui.itemTitle}>{invoice.reference}</p>
                <p className={ui.itemMeta}>{invoice.supplierName}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export function AccountantPayments() {
  const state = usePortalState();
  const payable = state.invoices.filter((entry) => entry.status === 'proformaApproved');
  const [selectedId, setSelectedId] = useState(payable[0]?.id || '');
  const selectedInvoice = payable.find((entry) => entry.id === selectedId) || payable[0] || null;

  return (
    <>
      <PageIntro
        eyebrow="Payment processing"
        title="Process payments and release supplier action"
        description="Select an approved proforma, confirm the amount, and mark payment to continue the supplier workflow."
      />

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Disbursement workspace</h2>
          <div className={ui.formRow}>
            <label className={ui.searchField}>
              <select className={ui.select} value={selectedInvoice?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>
                {payable.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.reference}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedInvoice ? (
            <div className={ui.stack}>
              <div className={ui.softCard}>
                <p className={ui.softTitle}>{selectedInvoice.reference}</p>
                <p className={ui.softBody}>
                  {selectedInvoice.supplierName} · {formatMoney(selectedInvoice.amount, selectedInvoice.currency)}
                </p>
              </div>
              <div className={ui.kvList}>
                <div className={ui.kvRow}>
                  <span>Status</span>
                  <span>{workflowLabel(selectedInvoice.status)}</span>
                </div>
                <div className={ui.kvRow}>
                  <span>Document count</span>
                  <span>{invoiceDocsCount(selectedInvoice)}</span>
                </div>
              </div>
              <button type="button" className={ui.btn} onClick={() => markInvoicePaid(selectedInvoice.id)}>
                Mark as paid
              </button>
            </div>
          ) : (
            <p className={ui.empty}>No invoices are currently waiting for payment.</p>
          )}
        </div>

        <div className={ui.panel}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Payment summary</p>
              <p className={ui.queueMeta}>Mirrors the compact right-side summary panel in the reference.</p>
            </div>
            <span className={ui.iconTile}>
              <AccountantIcon kind="payment" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Ready to pay</span>
              <span>{payable.length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Paid invoices</span>
              <span>{state.invoices.filter((entry) => entry.status === 'paid' || entry.status === 'closed').length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Total settled</span>
              <span>{formatMoney(state.invoices.filter((entry) => entry.status === 'paid' || entry.status === 'closed').reduce((sum, entry) => sum + Number(entry.amount || 0), 0))}</span>
            </div>
          </div>
          <h2 className={ui.panelTitle} style={{ marginTop: '1rem' }}>Paid history</h2>
          <ul className={ui.listPlain}>
            {state.invoices
              .filter((entry) => entry.status === 'paid' || entry.status === 'closed')
              .map((invoice) => (
                <li key={invoice.id} className={ui.listItem}>
                  <p className={ui.itemTitle}>{invoice.reference}</p>
                  <p className={ui.itemMeta}>
                    {formatMoney(invoice.amount, invoice.currency)} · {formatDateTime(invoice.paidAt)}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export function AccountantReports() {
  const state = usePortalState();
  const spendByStage = [
    ['Pending', state.invoices.filter((entry) => entry.status === 'proformaReceived').reduce((sum, entry) => sum + entry.amount, 0)],
    ['Approved', state.invoices.filter((entry) => entry.status === 'proformaApproved').reduce((sum, entry) => sum + entry.amount, 0)],
    ['Paid', state.invoices.filter((entry) => ['paid', 'closed'].includes(entry.status)).reduce((sum, entry) => sum + entry.amount, 0)],
  ];

  return (
    <>
      <PageIntro
        eyebrow="Supplier transactions"
        title="Supplier transactions and payment ledger"
        description="Follow every supplier transaction from proforma to final settlement with a finance-friendly ledger surface."
      />

      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.heroHeader}>
            <div>
              <p className={ui.panelSub}>Supplier ledger</p>
              <h2 className={ui.panelTitle}>Transaction pipeline</h2>
            </div>
            <span className={ui.heroBadge}>Live summary</span>
          </div>
          <div className={ui.progressGroup}>
            {spendByStage.map(([label, total]) => (
              <div key={label} className={ui.progressRow}>
                <span className={ui.muted}>{label}</span>
                <div className={ui.progressTrack}>
                  <div className={ui.progressFill} style={{ width: `${Math.max(12, total / 12000)}%` }} />
                </div>
                <span className={ui.mutedSm}>{formatMoney(total)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={ui.panel}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Supplier overview</p>
              <p className={ui.queueMeta}>Compact totals shown beside the transaction ledger.</p>
            </div>
            <span className={ui.iconTile}>
              <AccountantIcon kind="analytics" />
            </span>
          </div>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Suppliers tracked</span>
              <span>{new Set(state.invoices.map((entry) => entry.supplierName)).size}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Closed invoices</span>
              <span>{state.invoices.filter((entry) => entry.status === 'closed').length}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Total docs</span>
              <span>{state.invoices.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Vendor ledger</h2>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Supplier</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.reference}</td>
                    <td>{invoice.supplierName}</td>
                    <td>{formatMoney(invoice.amount, invoice.currency)}</td>
                    <td>
                      <StatusBadge status={workflowLabel(invoice.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Audit activity</h2>
          <ActivityFeed logs={state.activity.filter((entry) => entry.action.includes('invoice')).slice(0, 6)} />
        </div>
      </div>
    </>
  );
}

export function AccountantMessages() {
  const state = usePortalState();
  const messages = getMessagesForRole('accountant');
  const notifications = getNotificationsForRole('accountant');
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);

  return (
    <>
      <PageIntro
        eyebrow="Messages"
        title="Finance notifications and supplier communication"
        description="Stay aligned with supplier uploads, supervisor approvals, and payment events inside the same workspace."
      />
      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Inbox</h2>
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
        <h2 className={ui.panelTitle}>Recent finance activity</h2>
        <ActivityFeed logs={state.activity.filter((entry) => entry.actorId === actor?.id).slice(0, 6)} />
      </div>
    </>
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
