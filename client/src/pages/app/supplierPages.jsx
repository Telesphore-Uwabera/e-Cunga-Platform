import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  attachDeliveryNote,
  attachFinalInvoice,
  getMessagesForRole,
  getNotificationsForRole,
  submitSupplierProforma,
  usePortalState,
} from '../../data/mockPortal.js';
import ui from './DashboardUi.module.css';
import { ActivityFeed, PageIntro, StatusBadge, formatDate, formatMoney, workflowLabel } from './roleUi.jsx';

function useSupplierActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'supplier'),
    [state.users, user?.email]
  );
}

function SupplierIcon({ kind }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'inbox') {
    return (
      <svg {...common}>
        <path d="M4 8h16v10H4z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 8V5h8v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'document') {
    return (
      <svg {...common}>
        <path d="M7 4h7l4 4v12H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 13h5M10 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function supplierRequisitions(state, actorId) {
  return state.requisitions.filter(
    (entry) =>
      (!entry.supplierId || entry.supplierId === actorId) &&
      ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid', 'deliveryNoteAttached', 'closed'].includes(entry.status)
  );
}

function supplierInvoices(state, actorId) {
  return state.invoices.filter((entry) => !entry.supplierId || entry.supplierId === actorId);
}

export function SupplierDashboard() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const requisitions = supplierRequisitions(state, actor?.id);
  const invoices = supplierInvoices(state, actor?.id);
  const inboxCount = requisitions.filter((entry) => entry.status === 'sentToSupplier').length;
  const awaitingFinance = invoices.filter((entry) => entry.status === 'proformaReceived').length;
  const paidWaitingDocs = invoices.filter((entry) => entry.status === 'paid').length;
  const deliveryStage = invoices.filter((entry) => entry.status === 'deliveryNoteAttached').length;
  const closedCount = invoices.filter((entry) => entry.status === 'closed').length;
  const nextActions = requisitions.filter((entry) => ['sentToSupplier', 'paid', 'deliveryNoteAttached', 'proformaReceived'].includes(entry.status)).slice(0, 4);
  const workflowStages = [
    {
      id: 'stage-1',
      title: 'Approved requisition',
      hint: 'Clerk and supervisor have finished internal approval. Supplier prepares the proforma.',
      count: inboxCount,
    },
    {
      id: 'stage-2',
      title: 'Finance review',
      hint: 'Proforma has been submitted and is waiting for accountant approval or payment release.',
      count: awaitingFinance,
    },
    {
      id: 'stage-3',
      title: 'Fulfilment and closing',
      hint: 'Payment is confirmed, then delivery note and final invoice complete the workflow.',
      count: paidWaitingDocs + deliveryStage,
    },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Supplier dashboard"
        title="Manage supplier responsibilities inside the universal e-CUNGA workflow"
        description="Handle only the supplier stages of the platform flow: receive approved requisitions, submit proformas, wait for payment, then upload delivery and final invoice documents."
      />

      <div className={ui.heroBand}>
        <div className={ui.heroCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.panelSub}>Supplier command center</p>
              <h2 className={ui.panelTitle}>Your live order workflow</h2>
            </div>
            <span className={ui.iconTile}>
              <SupplierIcon kind="inbox" />
            </span>
          </div>
          <div className={ui.heroStatGrid}>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{inboxCount}</p>
              <p className={ui.heroStatLabel}>Awaiting proforma</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{awaitingFinance}</p>
              <p className={ui.heroStatLabel}>With finance</p>
            </div>
            <div className={ui.heroStat}>
              <p className={ui.heroStatValue}>{paidWaitingDocs}</p>
              <p className={ui.heroStatLabel}>Ready for delivery docs</p>
            </div>
          </div>
        </div>

        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Next actions</h2>
          <ul className={ui.listPlain}>
            {nextActions.map((entry) => (
              <li key={entry.id} className={ui.listItem}>
                <p className={ui.itemTitle}>{entry.title}</p>
                <p className={ui.itemMeta}>
                  {workflowLabel(entry.status)} · {entry.location}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={ui.queueGrid}>
        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Supplier role in the platform flow</p>
              <p className={ui.queueMeta}>This dashboard stays focused on the stages the supplier actually owns.</p>
            </div>
            <span className={ui.iconTile}>
              <SupplierIcon kind="document" />
            </span>
          </div>
          <div className={ui.stack}>
            {workflowStages.map((stage) => (
              <div key={stage.id} className={ui.softCard}>
                <p className={ui.softTitle}>
                  {stage.title} <span className={ui.highlight}>{stage.count}</span>
                </p>
                <p className={ui.softBody}>{stage.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={ui.queueCard}>
          <div className={ui.queueCardHead}>
            <div>
              <p className={ui.queueTitle}>Recent activity</p>
              <p className={ui.queueMeta}>Latest supplier-side actions inside the platform.</p>
            </div>
            <span className={ui.iconTile}>
              <SupplierIcon kind="history" />
            </span>
          </div>
          <ActivityFeed logs={state.activity.filter((entry) => entry.actorName === 'MediSupply Rwanda').slice(0, 4)} />
        </div>
      </div>

      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Universal workflow handoff</h2>
          <ul className={ui.listPlain}>
            <li className={ui.listItem}>
              <p className={ui.itemTitle}>1. Internal approval complete</p>
              <p className={ui.itemMeta}>Clerk creates the requisition and supervisor approves it before it reaches the supplier queue.</p>
            </li>
            <li className={ui.listItem}>
              <p className={ui.itemTitle}>2. Supplier submits proforma</p>
              <p className={ui.itemMeta}>Your responsibility starts by pricing the order and attaching a proforma for accountant review.</p>
            </li>
            <li className={ui.listItem}>
              <p className={ui.itemTitle}>3. Finance releases payment</p>
              <p className={ui.itemMeta}>Once payment is marked as paid, dispatch can proceed and delivery evidence becomes required.</p>
            </li>
            <li className={ui.listItem}>
              <p className={ui.itemTitle}>4. Supplier closes the document loop</p>
              <p className={ui.itemMeta}>Upload the delivery note first, then the final invoice to complete the e-CUNGA supply cycle.</p>
            </li>
          </ul>
        </div>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Supplier completion snapshot</h2>
          <div className={ui.kvList}>
            <div className={ui.kvRow}>
              <span>Waiting payment</span>
              <span>{awaitingFinance}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Delivery note stage</span>
              <span>{deliveryStage}</span>
            </div>
            <div className={ui.kvRow}>
              <span>Closed supplies</span>
              <span>{closedCount}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SupplierInbox() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const available = supplierRequisitions(state, actor?.id).filter((entry) =>
    ['sentToSupplier', 'proformaReceived', 'proformaApproved'].includes(entry.status)
  );
  const [drafts, setDrafts] = useState({});

  function updateDraft(id, patch) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        reference: current[id]?.reference || '',
        amount: current[id]?.amount || '',
        attachmentUrl: current[id]?.attachmentUrl || '',
        notes: current[id]?.notes || '',
        ...patch,
      },
    }));
  }

  function sendProforma(requisitionId) {
    const draft = drafts[requisitionId];
    if (!draft?.reference || !draft?.amount) return;
    submitSupplierProforma(requisitionId, draft, actor?.id);
  }

  return (
    <>
      <PageIntro
        eyebrow="Orders inbox"
        title="Work through approved orders and prepare proformas"
        description="Every approved requisition appears here so the supplier can issue a proforma, update references, and keep finance moving."
      />

      <div className={ui.queueGrid}>
        {available.slice(0, 2).map((entry) => (
          <div key={entry.id} className={ui.queueCard}>
            <div className={ui.queueCardHead}>
              <div>
                <p className={ui.queueTitle}>{entry.title}</p>
                <p className={ui.queueMeta}>
                  {entry.location} · {entry.priority} priority
                </p>
              </div>
              <StatusBadge status={workflowLabel(entry.status)} />
            </div>
            <div className={ui.kvList}>
              <div className={ui.kvRow}>
                <span>Requested by</span>
                <span>{entry.clerkName}</span>
              </div>
              <div className={ui.kvRow}>
                <span>Items</span>
                <span>{entry.lines.length}</span>
              </div>
              <div className={ui.kvRow}>
                <span>Updated</span>
                <span>{formatDate(entry.updatedAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Supplier queue</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Requisition</th>
                <th>Status</th>
                <th>Draft reference</th>
                <th>Amount</th>
                <th>Attachment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {available.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.title}</strong>
                    <div className={ui.mutedSm}>{entry.location}</div>
                  </td>
                  <td>
                    <StatusBadge status={workflowLabel(entry.status)} />
                  </td>
                  <td>
                    <input
                      className={ui.input}
                      placeholder="PRO-2026-..."
                      value={drafts[entry.id]?.reference || ''}
                      onChange={(e) => updateDraft(entry.id, { reference: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className={ui.input}
                      type="number"
                      placeholder="Amount"
                      value={drafts[entry.id]?.amount || ''}
                      onChange={(e) => updateDraft(entry.id, { amount: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className={ui.input}
                      placeholder="proforma.pdf"
                      value={drafts[entry.id]?.attachmentUrl || ''}
                      onChange={(e) => updateDraft(entry.id, { attachmentUrl: e.target.value })}
                    />
                  </td>
                  <td>
                    <button type="button" className={`${ui.btn} ${ui.btnSm}`} onClick={() => sendProforma(entry.id)}>
                      Send proforma
                    </button>
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

export function SupplierDocuments() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const invoices = supplierInvoices(state, actor?.id).filter((entry) => ['paid', 'deliveryNoteAttached'].includes(entry.status));
  const [docs, setDocs] = useState({});

  function updateDocs(id, patch) {
    setDocs((current) => ({
      ...current,
      [id]: {
        deliveryNoteUrl: current[id]?.deliveryNoteUrl || '',
        finalInvoiceUrl: current[id]?.finalInvoiceUrl || '',
        ...patch,
      },
    }));
  }

  return (
    <>
      <PageIntro
        eyebrow="Delivery docs"
        title="Attach delivery note and final invoice"
        description="When payment is released, upload delivery evidence first and then close the workflow with the final invoice."
      />

      <div className={ui.docGrid}>
        <div className={ui.docCard}>
          <p className={ui.docName}>Delivery note stage</p>
          <p className={ui.docHint}>Attach dispatch proof immediately after fulfilment to keep finance and operations aligned.</p>
        </div>
        <div className={ui.docCard}>
          <p className={ui.docName}>Final invoice stage</p>
          <p className={ui.docHint}>The final invoice closes the workflow and preserves the full supply audit trail.</p>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Delivery and invoice attachments</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Status</th>
                <th>Delivery note</th>
                <th>Final invoice</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <strong>{invoice.reference}</strong>
                    <div className={ui.mutedSm}>{formatMoney(invoice.amount, invoice.currency)}</div>
                  </td>
                  <td>
                    <StatusBadge status={workflowLabel(invoice.status)} />
                  </td>
                  <td>
                    <input
                      className={ui.input}
                      placeholder="delivery-note.pdf"
                      value={docs[invoice.id]?.deliveryNoteUrl || invoice.deliveryNoteUrl || ''}
                      onChange={(e) => updateDocs(invoice.id, { deliveryNoteUrl: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className={ui.input}
                      placeholder="final-invoice.pdf"
                      value={docs[invoice.id]?.finalInvoiceUrl || invoice.finalInvoiceUrl || ''}
                      onChange={(e) => updateDocs(invoice.id, { finalInvoiceUrl: e.target.value })}
                    />
                  </td>
                  <td>
                    <div className={ui.formRow}>
                      <button
                        type="button"
                        className={`${ui.btnOutline} ${ui.btn} ${ui.btnSm}`}
                        onClick={() => attachDeliveryNote(invoice.id, docs[invoice.id]?.deliveryNoteUrl || invoice.deliveryNoteUrl, actor?.id)}
                      >
                        Attach delivery note
                      </button>
                      <button
                        type="button"
                        className={`${ui.btn} ${ui.btnSm}`}
                        onClick={() => attachFinalInvoice(invoice.id, docs[invoice.id]?.finalInvoiceUrl || invoice.finalInvoiceUrl, actor?.id)}
                      >
                        Attach final invoice
                      </button>
                    </div>
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

export function SupplierHistory() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const closed = supplierInvoices(state, actor?.id).filter((entry) => entry.status === 'closed');
  const totalClosedValue = closed.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  return (
    <>
      <PageIntro
        eyebrow="Supply history"
        title="Completed supplies and attached records"
        description="Review delivered orders, values, and closing documents for every requisition that has reached completion."
      />

      <div className={ui.gridKpi}>
        <div className={ui.kpi}>
          <p className={ui.kpiLabel}>Completed workflows</p>
          <p className={ui.kpiValue}>{closed.length}</p>
          <p className={ui.kpiHint}>Fully closed by the supplier</p>
        </div>
        <div className={ui.kpi}>
          <p className={ui.kpiLabel}>Closed value</p>
          <p className={ui.kpiValue}>{formatMoney(totalClosedValue)}</p>
          <p className={ui.kpiHint}>Total settled supplier volume</p>
        </div>
      </div>

      <div className={ui.panel}>
        <h2 className={ui.panelTitle}>Completed history</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Amount</th>
                <th>Paid at</th>
                <th>Final invoice</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.reference}</td>
                  <td>{formatMoney(invoice.amount, invoice.currency)}</td>
                  <td>{formatDate(invoice.paidAt)}</td>
                  <td>{invoice.finalInvoiceUrl || 'Attached'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function SupplierMessages() {
  const state = usePortalState();
  const messages = getMessagesForRole('supplier');
  const notifications = getNotificationsForRole('supplier');

  return (
    <>
      <PageIntro
        eyebrow="Messages"
        title="Supplier communication and workflow notices"
        description="Receive finance notices, fulfilment reminders, and workflow updates without leaving the supplier workspace."
      />
      <div className={ui.panelGrid2}>
        <div className={ui.panel}>
          <h2 className={ui.panelTitle}>Messages</h2>
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
        <h2 className={ui.panelTitle}>Recent supplier activity</h2>
        <ActivityFeed logs={state.activity.filter((entry) => entry.actorName === 'MediSupply Rwanda').slice(0, 6)} />
      </div>
    </>
  );
}

export function SupplierPlaceholder({ title, body }) {
  return (
    <div className={ui.panel}>
      <h2 className={ui.panelTitle}>{title}</h2>
      <p className={ui.muted}>{body}</p>
    </div>
  );
}
