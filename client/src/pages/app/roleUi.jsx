import ui from './DashboardUi.module.css';

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function formatMoney(value, currency = 'RWF') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString()} ${currency}`;
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
    proformaReceived: 'Proforma received',
    proformaApproved: 'Proforma approved',
    paid: 'Paid',
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
  if (!logs?.length) return <p className={ui.empty}>{emptyText}</p>;
  return (
    <div className={ui.timeline}>
      {logs.map((entry) => (
        <div key={entry.id} className={ui.timelineRow}>
          <p className={ui.timelineTitle}>{entry.action}</p>
          <p className={ui.timelineMeta}>
            {entry.actorName || 'System'} · {formatDateTime(entry.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
