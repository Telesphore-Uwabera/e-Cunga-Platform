import ui from './DashboardUi.module.css';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { describeActivityEntry } from '../../utils/activityLabels.js';

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function formatCompactDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()}–${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatIsoDateOnly(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function formatMoney(value, currency = 'RWF') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString()}\u00A0${currency}`;
}

export function MoneyFigure({ value, currency = 'RWF', amountClassName, currencyClassName }) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return (
    <>
      <span className={amountClassName}>{Number(value).toLocaleString()}</span>
      <span className={currencyClassName}>{'\u00A0'}{currency}</span>
    </>
  );
}

export function stockStatus(item) {
  if (!item) return 'Unknown';
  if (Number(item.quantity) <= 0) return 'Out of stock';
  if (Number(item.quantity) <= Number(item.minThreshold || 0)) return 'Low stock';
  return 'In stock';
}

export function workflowLabel(status) {
  const labels = {
    submitted: 'Submitted',
    rejected: 'Rejected',
    sentToSupplier: 'Sent to supplier',
    proformaAwaitingClerk: 'Proforma — clerk review',
    proformaReceived: 'Proforma received',
    proformaApproved: 'Proforma approved',
    paid: 'Paid',
    partiallyPaid: 'Partially Paid',
    creditPurchase: 'Credit purchase',
    creditAndPaid: 'Credit & Paid',
    deliveryNoteAttached: 'Delivery note attached',
    closed: 'Closed',
  };
  return labels[status] || status || 'Unknown';
}

export function StatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase();
  let cls = ui.badgeNeutral;
  if (
    normalized.includes('approved') ||
    normalized.includes('paid') ||
    normalized.includes('closed') ||
    normalized.includes('stock')
  ) {
    cls = ui.badgeOk;
  } else if (
    normalized.includes('pending') ||
    normalized.includes('submitted') ||
    normalized.includes('received') ||
    normalized.includes('sent') ||
    normalized.includes('alert') ||
    normalized.includes('low')
  ) {
    cls = ui.badgeWarn;
  } else if (normalized.includes('rejected') || normalized.includes('out')) {
    cls = ui.badgeBad;
  }
  return <span className={`${ui.badge} ${cls}`}>{status}</span>;
}

export function PageIntro({ eyebrow, title, description, children }) {
  return (
    <div className={ui.pageIntro}>
      <div>
        {eyebrow ? <p className={ui.eyebrow}>{eyebrow}</p> : null}
        <h1 className={ui.pageTitle}>{title}</h1>
        {description ? <p className={ui.pageLead}>{description}</p> : null}
      </div>
      {children ? <div className={ui.actionRow}>{children}</div> : null}
    </div>
  );
}

export function ActivityFeed({ logs, emptyText = 'No activity yet.' }) {
  const { t } = useI18n();
  if (!logs?.length) return <p className={ui.empty}>{emptyText}</p>;
  return (
    <div className={ui.timeline}>
      {logs.map((entry) => (
        <div key={entry.id} className={ui.timelineRow}>
          <p className={ui.timelineTitle}>{describeActivityEntry(entry, t)}</p>
          <p className={ui.timelineMeta}>
            {entry.actorName || 'System'} · {formatDateTime(entry.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Icon-only reset for filter toolbars; pass translated `title` for `aria-label` / tooltip. */
export function ClearFiltersIconButton({ onClick, title, className = '' }) {
  return (
    <button
      type="button"
      className={`${ui.portalFilterClearIcon} ${className}`.trim()}
      onClick={onClick}
      aria-label={title}
      title={title}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
