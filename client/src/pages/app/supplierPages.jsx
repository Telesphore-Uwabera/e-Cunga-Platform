import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import {
  attachDeliveryNote,
  attachFinalInvoice,
  getMessagesForRole,
  getNotificationsForRole,
  submitSupplierProforma,
  usePortalState,
} from '../../data/mockPortal.js';
import ui from './DashboardUi.module.css';
import { ActivityFeed, PageIntro, StatusBadge, formatDate, formatMoney, formatDateTime, workflowLabel } from './roleUi.jsx';

function useSupplierActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'supplier'),
    [state.users, user?.email]
  );
}

function SupplierGlyph({ kind }) {
  const c = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'inbox') {
    return (
      <svg {...c}>
        <path d="M4 8h16v10H4z" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 8V5h8v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M9 13h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'doc') {
    return (
      <svg {...c}>
        <path d="M7 4h7l4 4v12H7z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M10 13h5M10 17h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg {...c}>
        <path d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'reject') {
    return (
      <svg {...c}>
        <path d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
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
  if (kind === 'history') {
    return (
      <svg {...c}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
        <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...c}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function supplierRequisitions(state, actorId) {
  return state.requisitions.filter(
    (entry) =>
      (!entry.supplierId || entry.supplierId === actorId) &&
      ['sentToSupplier', 'proformaReceived', 'proformaApproved', 'paid', 'deliveryNoteAttached', 'closed', 'rejected'].includes(entry.status)
  );
}

function supplierInvoices(state, actorId) {
  return state.invoices.filter((entry) => !entry.supplierId || entry.supplierId === actorId);
}

function requisitionById(state, id) {
  return state.requisitions.find((r) => r.id === id);
}

function linesSummary(lines) {
  if (!lines?.length) return '—';
  return lines.map((l) => `${l.quantity} ${l.unit} ${l.description}`).join(' · ');
}

const PIPELINE = [
  { step: 1, title: 'Order released', body: 'Supervisor sends an approved requisition to your queue.' },
  { step: 2, title: 'Proforma submitted', body: 'You attach pricing and the proforma PDF for finance.' },
  { step: 3, title: 'Finance decision', body: 'Accountant approves or rejects; approved items wait for payment.' },
  { step: 4, title: 'Fulfil & close', body: 'After payment, upload delivery note then the official final invoice.' },
];

export function SupplierDashboard() {
  const { t } = useI18n();
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const requisitions = supplierRequisitions(state, actor?.id);
  const invoices = supplierInvoices(state, actor?.id);
  const awaitingProforma = requisitions.filter((r) => r.status === 'sentToSupplier').length;
  const withFinance = invoices.filter((i) => i.status === 'proformaReceived').length;
  const approvedProforma = invoices.filter((i) => i.status === 'proformaApproved').length;
  const rejectedProforma = invoices.filter((i) => i.status === 'rejected').length;
  const readyDocs = invoices.filter((i) => ['paid', 'deliveryNoteAttached'].includes(i.status)).length;
  const closed = invoices.filter((i) => i.status === 'closed').length;
  const supplierLogs = state.activity.filter((entry) => entry.actorId === actor?.id || entry.actorName === actor?.fullName).slice(0, 5);

  return (
    <div className={ui.supplierBoard}>
      <header className={ui.supplierHero}>
        <div>
          <p className={ui.supplierEyebrow}>{t('app.supplier.eyebrow')}</p>
          <h1 className={ui.supplierTitle}>{t('app.supplier.heroTitle')}</h1>
          <p className={ui.supplierLead}>{t('app.supplier.heroLead')}</p>
        </div>
        <div className={ui.supplierHeroAside}>
          <span className={ui.supplierHeroIcon}>
            <SupplierGlyph kind="inbox" />
          </span>
          <p className={ui.supplierHeroMeta}>{actor?.fullName || user?.email}</p>
          <p className={ui.supplierHeroHint}>Partner portal · mock data</p>
        </div>
      </header>

      <div className={ui.supplierKpiStrip}>
        <article className={ui.supplierKpi}>
          <p className={ui.supplierKpiLabel}>Awaiting proforma</p>
          <strong className={ui.supplierKpiValue}>{awaitingProforma}</strong>
          <span className={ui.supplierKpiHint}>Action in inbox</span>
        </article>
        <article className={ui.supplierKpi}>
          <p className={ui.supplierKpiLabel}>With finance</p>
          <strong className={ui.supplierKpiValue}>{withFinance}</strong>
          <span className={ui.supplierKpiHint}>Proforma under review</span>
        </article>
        <article className={ui.supplierKpi}>
          <p className={ui.supplierKpiLabel}>Approved proformas</p>
          <strong className={ui.supplierKpiValue}>{approvedProforma}</strong>
          <span className={ui.supplierKpiHint}>Awaiting payment</span>
        </article>
        <article className={ui.supplierKpi}>
          <p className={ui.supplierKpiLabel}>Rejected</p>
          <strong className={ui.supplierKpiValue}>{rejectedProforma}</strong>
          <span className={ui.supplierKpiHint}>Needs revision</span>
        </article>
        <article className={`${ui.supplierKpi} ${ui.supplierKpiAccent}`}>
          <p className={ui.supplierKpiLabel}>Docs / closed</p>
          <strong className={ui.supplierKpiValue}>
            {readyDocs} / {closed}
          </strong>
          <span className={ui.supplierKpiHint}>Delivery &amp; official invoice</span>
        </article>
      </div>

      <section className={ui.supplierSection}>
        <h2 className={ui.supplierSectionTitle}>Shortcuts</h2>
        <div className={ui.supplierQuickGrid}>
          <NavLink to="/app/supplier/inbox" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="inbox" />
            <span>Orders &amp; proformas</span>
          </NavLink>
          <NavLink to="/app/supplier/approved-proforma" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="check" />
            <span>Approved proformas</span>
          </NavLink>
          <NavLink to="/app/supplier/rejected-proforma" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="reject" />
            <span>Rejected proformas</span>
          </NavLink>
          <NavLink to="/app/supplier/documents" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="truck" />
            <span>Delivery &amp; official invoice</span>
          </NavLink>
          <NavLink to="/app/supplier/history" className={({ isActive }) => (isActive ? ui.supplierQuickActive : ui.supplierQuick)}>
            <SupplierGlyph kind="history" />
            <span>Supply history</span>
          </NavLink>
        </div>
      </section>

      <div className={ui.supplierSplit}>
        <section className={ui.supplierPanel}>
          <h2 className={ui.supplierPanelTitle}>Workflow you own</h2>
          <ol className={ui.supplierPipeline}>
            {PIPELINE.map((row) => (
              <li key={row.step} className={ui.supplierPipeStep}>
                <span className={ui.supplierPipeNum}>{row.step}</span>
                <div>
                  <p className={ui.supplierPipeTitle}>{row.title}</p>
                  <p className={ui.supplierPipeBody}>{row.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className={ui.supplierPanel}>
          <h2 className={ui.supplierPanelTitle}>Recent activity</h2>
          {supplierLogs.length ? (
            <ActivityFeed logs={supplierLogs} emptyText="No supplier actions yet." />
          ) : (
            <ActivityFeed logs={state.activity.slice(0, 4)} />
          )}
        </section>
      </div>
    </div>
  );
}

export function SupplierInbox() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const available = supplierRequisitions(state, actor?.id).filter((entry) =>
    ['sentToSupplier', 'proformaReceived'].includes(entry.status)
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
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Orders & proformas"
        title="Price approved requests and send proformas"
        description="Orders released to you appear here. Submit reference, amount, and a proforma attachment so finance can approve or reject."
      />

      <div className={ui.supplierToolbar}>
        <p className={ui.supplierToolbarMeta}>
          <strong>{available.length}</strong> requisition{available.length === 1 ? '' : 's'} need your input or are waiting on finance after submission.
        </p>
      </div>

      <div className={ui.supplierCardGrid}>
        {available.slice(0, 3).map((entry) => (
          <article key={entry.id} className={ui.supplierHighlightCard}>
            <div className={ui.supplierHighlightTop}>
              <span className={ui.supplierHighlightIcon}>
                <SupplierGlyph kind="doc" />
              </span>
              <StatusBadge status={workflowLabel(entry.status)} />
            </div>
            <h3 className={ui.supplierHighlightTitle}>{entry.title}</h3>
            <p className={ui.supplierHighlightMeta}>
              {entry.location} · {entry.priority} priority · {entry.lines?.length || 0} line items
            </p>
            <p className={ui.supplierLines}>{linesSummary(entry.lines)}</p>
            <div className={ui.supplierHighlightFoot}>
              <span>Clerk: {entry.clerkName}</span>
              <span>Updated {formatDate(entry.updatedAt)}</span>
            </div>
          </article>
        ))}
      </div>

      <section className={ui.supplierTableCard}>
        <div className={ui.supplierTableHead}>
          <h2 className={ui.supplierTableTitle}>Supplier queue</h2>
          <p className={ui.supplierTableLead}>Send proforma pushes the requisition to finance review.</p>
        </div>
        <div className={ui.supplierTableScroll}>
          <table className={ui.supplierTable}>
            <thead>
              <tr>
                <th>Requisition</th>
                <th>Materials</th>
                <th>Status</th>
                <th>Proforma ref</th>
                <th>Amount (RWF)</th>
                <th>Attachment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {available.length === 0 ? (
                <tr>
                  <td colSpan={7} className={ui.supplierTableEmpty}>
                    Nothing in your inbox. New orders appear when supervisors release them to suppliers.
                  </td>
                </tr>
              ) : (
                available.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong className={ui.supplierCellStrong}>{entry.title}</strong>
                      <div className={ui.supplierCellMuted}>{entry.location}</div>
                    </td>
                    <td className={ui.supplierCellLines}>{linesSummary(entry.lines)}</td>
                    <td>
                      <StatusBadge status={workflowLabel(entry.status)} />
                    </td>
                    <td>
                      <input
                        className={ui.supplierInput}
                        placeholder="PRO-2026-…"
                        value={drafts[entry.id]?.reference || ''}
                        onChange={(e) => updateDraft(entry.id, { reference: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={ui.supplierInput}
                        type="number"
                        placeholder="Amount"
                        value={drafts[entry.id]?.amount || ''}
                        onChange={(e) => updateDraft(entry.id, { amount: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={ui.supplierInput}
                        placeholder="proforma.pdf"
                        value={drafts[entry.id]?.attachmentUrl || ''}
                        onChange={(e) => updateDraft(entry.id, { attachmentUrl: e.target.value })}
                      />
                    </td>
                    <td>
                      <button type="button" className={ui.supplierPrimaryBtn} onClick={() => sendProforma(entry.id)}>
                        Send proforma
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SupplierApprovedProforma() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const rows = supplierInvoices(state, actor?.id).filter((i) => i.status === 'proformaApproved');

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Approved proformas"
        title="Finance accepted your pricing"
        description="These proformas are cleared by the accountant and are waiting for payment. After payment appears, move to Delivery & official invoice to attach dispatch proof and the final tax invoice."
      />
      <div className={ui.supplierToolbar}>
        <span className={ui.supplierPillOk}>{rows.length} approved</span>
        <NavLink to="/app/supplier/documents" className={ui.supplierLinkBtn}>
          Go to delivery &amp; invoice →
        </NavLink>
      </div>
      <section className={ui.supplierTableCard}>
        <div className={ui.supplierTableScroll}>
          <table className={ui.supplierTable}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Requisition</th>
                <th>Materials supplied</th>
                <th>Amount</th>
                <th>Proforma file</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={ui.supplierTableEmpty}>
                    No approved proformas yet. Approved items land here after accountant sign-off.
                  </td>
                </tr>
              ) : (
                rows.map((inv) => {
                  const req = requisitionById(state, inv.requisitionId);
                  return (
                    <tr key={inv.id}>
                      <td>
                        <strong className={ui.supplierCellStrong}>{inv.reference}</strong>
                        <div className={ui.supplierCellMuted}>Updated {formatDate(inv.updatedAt)}</div>
                      </td>
                      <td>{req?.title || '—'}</td>
                      <td className={ui.supplierCellLines}>{linesSummary(req?.lines)}</td>
                      <td>{formatMoney(inv.amount, inv.currency)}</td>
                      <td>
                        <span className={ui.supplierFilePill}>{inv.attachmentUrl || '—'}</span>
                      </td>
                      <td className={ui.supplierCellMuted}>{inv.notes || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SupplierRejectedProforma() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const rows = supplierInvoices(state, actor?.id).filter((i) => i.status === 'rejected');

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Rejected proformas"
        title="Revise and resubmit when ready"
        description="Finance returned these proformas. Read the notes, adjust pricing or attachments, and coordinate with the clerk if the underlying requisition must change."
      />
      <div className={ui.supplierToolbar}>
        <span className={ui.supplierPillBad}>{rows.length} rejected</span>
      </div>
      <div className={ui.supplierRejectGrid}>
        {rows.length === 0 ? (
          <p className={ui.supplierEmpty}>No rejected proformas on file.</p>
        ) : (
          rows.map((inv) => {
            const req = requisitionById(state, inv.requisitionId);
            return (
              <article key={inv.id} className={ui.supplierRejectCard}>
                <div className={ui.supplierRejectTop}>
                  <span className={ui.supplierRejectIcon}>
                    <SupplierGlyph kind="reject" />
                  </span>
                  <StatusBadge status="Rejected" />
                </div>
                <h3 className={ui.supplierRejectTitle}>{inv.reference}</h3>
                <p className={ui.supplierRejectReq}>{req?.title || 'Requisition'}</p>
                <p className={ui.supplierRejectLines}>{linesSummary(req?.lines)}</p>
                <p className={ui.supplierRejectReason}>{inv.notes || 'No detailed reason captured.'}</p>
                <div className={ui.supplierRejectFoot}>
                  <span>{formatMoney(inv.amount, inv.currency)}</span>
                  <span>File: {inv.attachmentUrl || '—'}</span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
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
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Delivery & official invoice"
        title="Attach proof of dispatch, then the official invoice"
        description="After finance marks payment, upload the delivery note first. The final attachment should be your official tax invoice that closes the requisition in e-CUNGA."
      />

      <div className={ui.supplierDocBannerGrid}>
        <article className={ui.supplierDocBanner}>
          <SupplierGlyph kind="truck" />
          <div>
            <h3 className={ui.supplierDocBannerTitle}>1. Delivery note</h3>
            <p className={ui.supplierDocBannerText}>Proof of fulfilment—packing list, signed waybill, or GRN reference.</p>
          </div>
        </article>
        <article className={`${ui.supplierDocBanner} ${ui.supplierDocBannerAccent}`}>
          <SupplierGlyph kind="doc" />
          <div>
            <h3 className={ui.supplierDocBannerTitle}>2. Official final invoice</h3>
            <p className={ui.supplierDocBannerText}>Tax-compliant invoice matching the paid proforma; closes the workflow.</p>
          </div>
        </article>
      </div>

      <section className={ui.supplierTableCard}>
        <div className={ui.supplierTableHead}>
          <h2 className={ui.supplierTableTitle}>Attachments</h2>
          <p className={ui.supplierTableLead}>Use filenames your finance team expects (PDF recommended).</p>
        </div>
        <div className={ui.supplierTableScroll}>
          <table className={ui.supplierTable}>
            <thead>
              <tr>
                <th>Reference &amp; order</th>
                <th>Status</th>
                <th>Delivery note</th>
                <th>Official final invoice</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className={ui.supplierTableEmpty}>
                    Paid orders appear here. Until payment is released, work from Approved proformas.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const req = requisitionById(state, invoice.requisitionId);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <strong className={ui.supplierCellStrong}>{invoice.reference}</strong>
                        <div className={ui.supplierCellMuted}>{formatMoney(invoice.amount, invoice.currency)}</div>
                        <div className={ui.supplierCellLinesSmall}>{req?.title}</div>
                      </td>
                      <td>
                        <StatusBadge status={workflowLabel(invoice.status)} />
                      </td>
                      <td>
                        <input
                          className={ui.supplierInput}
                          placeholder="delivery-note.pdf"
                          value={docs[invoice.id]?.deliveryNoteUrl || invoice.deliveryNoteUrl || ''}
                          onChange={(e) => updateDocs(invoice.id, { deliveryNoteUrl: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={ui.supplierInput}
                          placeholder="final-invoice-official.pdf"
                          value={docs[invoice.id]?.finalInvoiceUrl || invoice.finalInvoiceUrl || ''}
                          onChange={(e) => updateDocs(invoice.id, { finalInvoiceUrl: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className={ui.supplierBtnRow}>
                          <button
                            type="button"
                            className={ui.supplierGhostBtn}
                            onClick={() =>
                              attachDeliveryNote(invoice.id, docs[invoice.id]?.deliveryNoteUrl || invoice.deliveryNoteUrl, actor?.id)
                            }
                          >
                            Save delivery note
                          </button>
                          <button
                            type="button"
                            className={ui.supplierPrimaryBtn}
                            onClick={() =>
                              attachFinalInvoice(invoice.id, docs[invoice.id]?.finalInvoiceUrl || invoice.finalInvoiceUrl, actor?.id)
                            }
                          >
                            Attach official invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SupplierHistory() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const [histQ, setHistQ] = useState('');
  const closedAll = supplierInvoices(state, actor?.id).filter((entry) => entry.status === 'closed');
  const q = histQ.trim().toLowerCase();
  const closed = closedAll.filter((invoice) => {
    if (!q) return true;
    const req = requisitionById(state, invoice.requisitionId);
    return (
      invoice.reference.toLowerCase().includes(q) ||
      (req?.title || '').toLowerCase().includes(q) ||
      formatMoney(invoice.amount, invoice.currency).toLowerCase().includes(q)
    );
  });
  const totalClosedValue = closed.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Supply history"
        title="Materials you supplied and documents on record"
        description="Completed workflows list the requisition, line items, settlement value, and the official invoice file attached at close."
      />
      <div className={ui.supplierKpiStrip}>
        <article className={ui.supplierKpi}>
          <p className={ui.supplierKpiLabel}>Closed cycles</p>
          <strong className={ui.supplierKpiValue}>{closedAll.length}</strong>
        </article>
        <article className={`${ui.supplierKpi} ${ui.supplierKpiAccent}`}>
          <p className={ui.supplierKpiLabel}>Settled value (filtered)</p>
          <strong className={ui.supplierKpiValue}>{formatMoney(totalClosedValue)}</strong>
        </article>
      </div>
      <div className={ui.portalFilterBar} role="search">
        <label className={ui.portalFilterField} style={{ flex: '1 1 16rem', maxWidth: '28rem' }}>
          <span className={ui.portalFilterLabel}>Search history</span>
          <input
            className={ui.portalFilterSearch}
            placeholder="Reference, order title, amount…"
            value={histQ}
            onChange={(e) => setHistQ(e.target.value)}
          />
        </label>
        <button type="button" className={ui.portalFilterClear} onClick={() => setHistQ('')}>
          Clear
        </button>
        <span className={ui.portalFilterMeta}>{closed.length} rows</span>
      </div>
      <section className={ui.supplierTableCard}>
        <div className={ui.supplierTableScroll}>
          <table className={ui.supplierTable}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Order &amp; materials</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Delivery note</th>
                <th>Official invoice</th>
              </tr>
            </thead>
            <tbody>
              {closed.length === 0 ? (
                <tr>
                  <td colSpan={6} className={ui.supplierTableEmpty}>
                    Completed supplies will appear after final invoice attachment.
                  </td>
                </tr>
              ) : (
                closed.map((invoice) => {
                  const req = requisitionById(state, invoice.requisitionId);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <strong className={ui.supplierCellStrong}>{invoice.reference}</strong>
                      </td>
                      <td>
                        <div className={ui.supplierCellStrong}>{req?.title || '—'}</div>
                        <div className={ui.supplierCellLines}>{linesSummary(req?.lines)}</div>
                      </td>
                      <td>{formatMoney(invoice.amount, invoice.currency)}</td>
                      <td className={ui.supplierCellMuted}>{invoice.paidAt ? formatDate(invoice.paidAt) : '—'}</td>
                      <td>
                        <span className={ui.supplierFilePill}>{invoice.deliveryNoteUrl || '—'}</span>
                      </td>
                      <td>
                        <span className={ui.supplierFilePill}>{invoice.finalInvoiceUrl || '—'}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SupplierMessages() {
  const state = usePortalState();
  const { user } = useAuth();
  const actor = useSupplierActor(state, user);
  const messages = getMessagesForRole('supplier');
  const notifications = getNotificationsForRole('supplier');
  const supplierLogs = state.activity.filter((entry) => entry.actorId === actor?.id || entry.actorName === actor?.fullName).slice(0, 6);

  return (
    <div className={ui.supplierBoard}>
      <PageIntro
        eyebrow="Messages & notices"
        title="Everything finance and operations send you"
        description="Notifications are short system signals; messages carry richer context. The top bar also mirrors alerts for quick access."
      />
      <div className={ui.supplierMsgGrid}>
        <section className={ui.supplierMsgCard}>
          <h2 className={ui.supplierMsgTitle}>Messages</h2>
          <ul className={ui.supplierMsgList}>
            {messages.map((message) => (
              <li key={message.id} className={ui.supplierMsgItem}>
                <p className={ui.supplierMsgItemTitle}>{message.title}</p>
                <p className={ui.supplierMsgItemBody}>{message.body}</p>
                <p className={ui.supplierMsgItemMeta}>
                  {message.from} · {formatDateTime(message.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section className={ui.supplierMsgCard}>
          <h2 className={ui.supplierMsgTitle}>Notifications</h2>
          <ul className={ui.supplierMsgList}>
            {notifications.map((entry) => (
              <li key={entry.id} className={ui.supplierMsgItem}>
                <p className={ui.supplierMsgItemTitle}>{entry.title}</p>
                <p className={ui.supplierMsgItemBody}>{entry.body}</p>
                <p className={ui.supplierMsgItemMeta}>{formatDateTime(entry.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className={ui.supplierPanel}>
        <h2 className={ui.supplierPanelTitle}>Activity log</h2>
        <ActivityFeed logs={supplierLogs.length ? supplierLogs : state.activity.slice(0, 6)} />
      </section>
    </div>
  );
}
