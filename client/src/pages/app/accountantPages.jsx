import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePortalData } from '../../context/PortalStateContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import ListPageControls from '../../components/ListPageControls.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import WorkspaceAiInsight from '../../components/WorkspaceAiInsight.jsx';
import PortalMessagingHub from './messaging/PortalMessagingHub.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { CheckIcon, CloseIcon, FileIcon } from '../../components/Icons.jsx';
import {
  DocumentHoverPreview,
  DocumentViewerModal,
  InvoiceDocumentButtonGroup,
  resolvePortalDocumentUrl,
} from '../../components/InvoiceDocumentActions.jsx';
import { RequisitionPdfModal, downloadRequisitionPdf } from '../../components/RequisitionPdfModal.jsx';
import ui from './DashboardUi.module.css';
import { conicGradientFromSlices, REPORT_SLICE_COLORS } from '../../utils/reportCharts.js';
import { downloadAoAAsXlsx } from '../../utils/downloadXlsx.js';
import { ClearFiltersIconButton, MoneyFigure, StatusBadge, formatDate, formatMoney, workflowLabel } from './roleUi.jsx';
import jsPDF from 'jspdf';
import { InventoryFilterSelect } from '../../components/InventoryFilterSelect.jsx';


function useAccountantActor(state, user) {
  return useMemo(
    () => state.users.find((entry) => entry.email === user?.email) || state.users.find((entry) => entry.role === 'accountant'),
    [state.users, user?.email]
  );
}

function displayRequestRef(id) {
  if (!id) return '';
  if (String(id).startsWith('Req-')) return String(id).replace(/^Req/, 'REQ');
  return String(id).replace(/^req_/, 'REQ-');
}

function DeliveryNoteIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v7A1.5 1.5 0 0 0 6.5 12.5H12"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2.5V7h4.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 7.5h5.5M7.5 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M2 15h10.5v4H2v-4zM12.5 15h5.8l3.7 3.7V19H12.5v-4z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <circle cx="5.5" cy="21" r="1.35" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="17.8" cy="21" r="1.35" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function AcceptedProformaIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13.5 2.5H6.5A1.5 1.5 0 0 0 5 4v10.5A1.5 1.5 0 0 0 6.5 16H10.5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.5 2.5V7H18" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 8.5h5M7.5 11h4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path
        d="M15.8 13.8l2.4 2.4L22 12.5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PayNotifyIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Credit / deferred payment — supplier fulfils on terms without immediate disbursement. */
function CreditPurchaseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
      <path d="M8 15h4M14 15h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
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

function resolveDocUrlForPreview(url) {
  return resolvePortalDocumentUrl(url) || safeDocUrl(url);
}

function toYmdLocal(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmdLocal(s) {
  if (!s || typeof s !== 'string') return null;
  const [y, m, d] = s.split('-').map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

const CHART_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** e.g. "from March to April 2026" or "January 2026" when single month */
function chartDurationPhrase(start, end) {
  const sm = start.getMonth();
  const sy = start.getFullYear();
  const em = end.getMonth();
  const ey = end.getFullYear();
  if (sm === em && sy === ey) {
    return `${CHART_MONTHS[sm]} ${sy}`;
  }
  if (sy === ey) {
    return `from ${CHART_MONTHS[sm]} to ${CHART_MONTHS[em]} ${ey}`;
  }
  return `from ${CHART_MONTHS[sm]} ${sy} to ${CHART_MONTHS[em]} ${ey}`;
}

/** Invoices awaiting accountant proforma review (approve / reject). Clerk must accept supplier proforma first. */
export function isInvoicePendingAccountantReview(status, requisitionStatus) {
  if (!['proformaReceived', 'sent', 'draft'].includes(status)) return false;
  if (requisitionStatus === 'proformaAwaitingClerk') return false;
  return true;
}

/** Proforma pipeline rows that should appear in accountant dashboards / vendor ledger (excludes pre–clerk-accept). */
export function isProformaVisibleToAccountantAfterClerk(invoice, requisitions) {
  if (invoice?.type !== 'proforma') return true;
  const rid = invoice.requisitionId || invoice.stockRequestId;
  const r = rid ? requisitions.find((q) => q.id === rid) : null;
  if (r?.status === 'proformaAwaitingClerk') return false;
  return true;
}

function invoiceTabBucket(status, requisitionStatus) {
  if (status === 'proformaApproved') return 'accepted';
  if (requisitionStatus === 'proformaAwaitingClerk' && ['proformaReceived', 'sent', 'draft'].includes(status)) {
    return 'awaiting_clerk';
  }
  if (isInvoicePendingAccountantReview(status, requisitionStatus)) return 'pending';
  if (status === 'rejected') return 'rejected';
  if (status === 'partiallyPaid') return 'partiallyPaid';
  if (status === 'creditPurchase') return 'creditPurchase';
  if (['paid', 'deliveryNoteAttached', 'closed', 'creditAndPaid'].includes(status)) return 'paid';
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

function accountantFinanceBucket(status, requisitionStatus) {
  if (status === 'rejected') return 'rejected';
  if (requisitionStatus === 'proformaAwaitingClerk' && ['proformaReceived', 'sent', 'draft'].includes(status)) {
    return 'awaiting_clerk';
  }
  if (isInvoicePendingAccountantReview(status, requisitionStatus)) return 'pending';
  return 'approved';
}

/** Final invoice (supplier) + delivery note URLs for a requisition (may span proforma + final invoice rows). */
function supportingDocumentsForInvoice(state, invoice) {
  const rid = String(invoice?.requisitionId || invoice?.stockRequestId || '').trim();
  if (!rid) {
    return {
      finalInvoiceUrl: String(invoice?.finalInvoiceUrl || '').trim(),
      deliveryNoteUrl: String(invoice?.deliveryNoteUrl || '').trim(),
    };
  }
  const related = state.invoices.filter((i) => {
    const ir = String(i.requisitionId || i.stockRequestId || '').trim();
    return ir === rid;
  });
  let finalInvoiceUrl = String(invoice?.finalInvoiceUrl || '').trim();
  let deliveryNoteUrl = String(invoice?.deliveryNoteUrl || '').trim();
  for (const inv of related) {
    if (String(inv.finalInvoiceUrl || '').trim()) {
      finalInvoiceUrl = finalInvoiceUrl || String(inv.finalInvoiceUrl).trim();
    }
    if (inv.type === 'final' && String(inv.attachmentUrl || '').trim()) {
      finalInvoiceUrl = finalInvoiceUrl || String(inv.attachmentUrl).trim();
    }
    if (String(inv.deliveryNoteUrl || '').trim()) {
      deliveryNoteUrl = deliveryNoteUrl || String(inv.deliveryNoteUrl).trim();
    }
  }
  return { finalInvoiceUrl, deliveryNoteUrl };
}

function accountantFinanceLabel(status, requisitionStatus) {
  if (requisitionStatus === 'proformaAwaitingClerk' && ['proformaReceived', 'sent', 'draft'].includes(status)) {
    return 'Awaiting clerk';
  }
  if (status === 'proformaApproved') return 'Accepted proforma';
  if (status === 'proformaReceived') return 'Pending approval';
  if (status === 'draft') return 'Draft';
  if (status === 'sent') return 'Awaiting review';
  if (status === 'rejected') return 'Rejected';
  if (status === 'paid') return 'Paid';
  if (status === 'creditPurchase') return 'Credit purchase';
  if (status === 'deliveryNoteAttached') return 'Delivery note attached';
  if (status === 'closed') return 'Closed';
  return workflowLabel(status);
}

export function AccountantDashboard() {
  const { t } = useI18n();
  const { state } = usePortalData();
  const navigate = useNavigate();
  const chartWrapRef = useRef(null);
  const [customFrom, setCustomFrom] = useState(() => {
    const end = new Date();
    const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const startD = new Date(endD);
    startD.setDate(startD.getDate() - 29);
    return toYmdLocal(startD);
  });
  const [customTo, setCustomTo] = useState(() => {
    const end = new Date();
    return toYmdLocal(new Date(end.getFullYear(), end.getMonth(), end.getDate()));
  });
  const [chartTip, setChartTip] = useState(null);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [pdfPreviewReq, setPdfPreviewReq] = useState(null);
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);
  
  const scopedInvoices = useMemo(() => {
    return state.invoices.filter(inv => {
      const d = inv.createdAt ? new Date(inv.createdAt) : new Date();
      return d >= currentMonthStart && d <= currentMonthEnd;
    });
  }, [state.invoices]);

  const readyToPayCount = scopedInvoices.filter((entry) => entry.status === 'proformaApproved').length;
  const pendingPaymentsAmount = scopedInvoices
    .filter((entry) => entry.status === 'proformaApproved')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const settledInvoices = scopedInvoices.filter((entry) => ['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status));
  const settledPaymentsAmount = settledInvoices.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalPaymentsAmount = pendingPaymentsAmount + settledPaymentsAmount;
  const creditPurchaseAmount = scopedInvoices
    .filter((entry) => !['paid', 'deliveryNoteAttached', 'closed', 'rejected'].includes(entry.status))
    .filter((entry) => {
      if (entry.type !== 'proforma') return true;
      const r = state.requisitions.find((q) => q.id === entry.requisitionId);
      return r?.status !== 'proformaAwaitingClerk';
    })
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const supportingDocsCount = scopedInvoices.filter(
    (entry) =>
      entry.status !== 'rejected' &&
      isProformaVisibleToAccountantAfterClerk(entry, state.requisitions) &&
      invoiceDocsCount(entry) < 3
  ).length;
  const proformasForReviewCount = scopedInvoices.filter((entry) => {
    const r = state.requisitions.find((q) => q.id === entry.requisitionId);
    return isInvoicePendingAccountantReview(entry.status, r?.status);
  }).length;

  const settledForChart = useMemo(
    () => state.invoices.filter((entry) => {
      if (!['paid', 'deliveryNoteAttached', 'closed'].includes(entry.status)) return false;
      if (invoiceStatusFilter !== 'all' && entry.status !== invoiceStatusFilter) return false;
      if (currencyFilter !== 'all' && entry.currency !== currencyFilter) return false;
      return true;
    }),
    [state.invoices, invoiceStatusFilter, currencyFilter]
  );
  const chartCurrency = settledForChart[0]?.currency || 'RWF';

  // Payment aging analysis
  const paymentAging = useMemo(() => {
    const now = new Date();
    const aging = {
      current: { count: 0, amount: 0 }, // 0-30 days
      overdue30: { count: 0, amount: 0 }, // 31-60 days
      overdue60: { count: 0, amount: 0 }, // 61-90 days
      overdue90: { count: 0, amount: 0 }, // 90+ days
    };

    state.invoices.forEach((inv) => {
      if (['paid', 'deliveryNoteAttached', 'closed'].includes(inv.status)) return;
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.createdAt);
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      const amount = Number(inv.amount || 0);

      if (daysOverdue <= 30) {
        aging.current.count += 1;
        aging.current.amount += amount;
      } else if (daysOverdue <= 60) {
        aging.overdue30.count += 1;
        aging.overdue30.amount += amount;
      } else if (daysOverdue <= 90) {
        aging.overdue60.count += 1;
        aging.overdue60.amount += amount;
      } else {
        aging.overdue90.count += 1;
        aging.overdue90.amount += amount;
      }
    });

    return aging;
  }, [state.invoices]);

  // Cash flow projection
  const cashFlowProjection = useMemo(() => {
    const now = new Date();
    const projection = [];
    const months = ['This Month', 'Next Month', 'Month +2', 'Month +3'];

    months.forEach((label, index) => {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + index, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + index + 1, 0);

      const expectedPayments = state.invoices
        .filter((inv) => {
          if (['paid', 'deliveryNoteAttached', 'closed'].includes(inv.status)) return false;
          const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.createdAt);
          return dueDate >= monthStart && dueDate <= monthEnd;
        })
        .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

      projection.push({ month: label, amount: expectedPayments });
    });

    return projection;
  }, [state.invoices]);
  const chartSeries = useMemo(() => {
    let startDay;
    let endDay;

    const a = parseYmdLocal(customFrom);
    const b = parseYmdLocal(customTo);
    if (!a || !b || a > b) {
      endDay = new Date();
      endDay = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate());
      startDay = new Date(endDay);
      startDay.setDate(startDay.getDate() - 29);
    } else {
      startDay = a;
      endDay = b;
    }

    let chartRangeDays = Math.floor((endDay - startDay) / (24 * 60 * 60 * 1000)) + 1;
    if (chartRangeDays > 365) {
      startDay = new Date(endDay);
      startDay.setDate(startDay.getDate() - 364);
      chartRangeDays = 365;
    }

    const dayKeys = [];
    for (let i = 0; i < chartRangeDays; i += 1) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      dayKeys.push(d);
    }

    const actualByDay = new Array(chartRangeDays).fill(0);
    for (const inv of settledForChart) {
      const ts = inv.paidAt || inv.updatedAt || inv.createdAt;
      if (!ts) continue;
      const dt = new Date(ts);
      const day = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      const idx = Math.floor((day - startDay) / (24 * 60 * 60 * 1000));
      if (idx < 0 || idx >= chartRangeDays) continue;
      actualByDay[idx] += Number(inv.amount || 0);
    }

    const avg = actualByDay.reduce((s, v) => s + v, 0) / Math.max(1, actualByDay.length);
    const dailyBudget = Math.round(avg * 1.05);
    const budgetByDay = actualByDay.map(() => dailyBudget);

    const maxYRaw = Math.max(1, ...actualByDay, ...budgetByDay);

    // Choose readable y-axis ticks (0, 5M, 10M, 15M...) instead of arbitrary halves.
    const niceStep = (maxValue, targetTicks = 4) => {
      const rough = maxValue / Math.max(1, targetTicks);
      const pow = 10 ** Math.floor(Math.log10(Math.max(1, rough)));
      const base = rough / pow;
      const mult = base <= 1 ? 1 : base <= 2 ? 2 : base <= 2.5 ? 2.5 : base <= 5 ? 5 : 10;
      return mult * pow;
    };
    const stepY = niceStep(maxYRaw, 4);
    const maxTick = Math.max(stepY, Math.ceil(maxYRaw / stepY) * stepY);
    const W = 1000;
    const H = 210;
    const PAD_L = 72;
    const PAD_R = 28;
    const PAD_TOP = 18;
    const PAD_BOT = 44;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_TOP - PAD_BOT;
    const step = chartRangeDays === 1 ? 0 : plotW / (chartRangeDays - 1);
    const yFor = (v) => PAD_TOP + (1 - Math.min(1, v / maxTick)) * plotH;
    const xFor = (i) => PAD_L + i * step;

    const toPoints = (arr) => arr.map((v, i) => `${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`).join(' ');

    const MAX_X_TICKS = 14;
    const tickStride = Math.max(1, Math.ceil(chartRangeDays / MAX_X_TICKS));
    const tickIdxSet = new Set([0, chartRangeDays - 1]);
    for (let i = 0; i < chartRangeDays; i += tickStride) tickIdxSet.add(i);
    const tickIndices = [...tickIdxSet].sort((a, b) => a - b);

    const labelDay = (d) => String(d.getDate());
    const labelFull = (d) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const durationPhrase = chartDurationPhrase(startDay, endDay);

    const yTicks = [];
    for (let v = 0; v <= maxTick + stepY / 2; v += stepY) yTicks.push(v);

    const pointsMeta = dayKeys.map((d, i) => {
      const actual = actualByDay[i];
      return {
        i,
        date: d,
        label: labelFull(d),
        x: xFor(i),
        yA: yFor(actual),
        yB: yFor(budgetByDay[i]),
        actual,
        budget: budgetByDay[i],
        hasAction: Number(actual) > 0,
      };
    });

    return {
      actualByDay,
      budgetByDay,
      pointsActual: toPoints(actualByDay),
      pointsBudget: toPoints(budgetByDay),
      pointsMeta,
      tickIndices,
      tickLabelDay: labelDay,
      durationPhrase,
      maxY: maxTick,
      startDay,
      endDay,
      chartRangeDays,
      viewW: W,
      viewH: H,
      yTicks,
      xFor,
      yFor,
      PAD_L,
      PAD_R,
      PAD_TOP,
      PAD_BOT,
      plotW,
      plotH,
    };
  }, [customFrom, customTo, settledForChart]);
  const recentTransactions = [...state.invoices]
    .filter((inv) => isProformaVisibleToAccountantAfterClerk(inv, state.requisitions))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 4);

  function transactionTone(status, requisitionStatus) {
    if (status === 'rejected') return ui.accountantTxnRejected;
    if (isInvoicePendingAccountantReview(status, requisitionStatus)) return ui.accountantTxnPending;
    if (requisitionStatus === 'proformaAwaitingClerk' && ['proformaReceived', 'sent', 'draft'].includes(status)) {
      return ui.accountantTxnPending;
    }
    return ui.accountantTxnApproved;
  }

  function transactionLabel(status, requisitionStatus) {
    if (status === 'rejected') return 'Rejected';
    if (requisitionStatus === 'proformaAwaitingClerk' && ['proformaReceived', 'sent', 'draft'].includes(status)) {
      return 'Awaiting clerk';
    }
    if (isInvoicePendingAccountantReview(status, requisitionStatus)) return 'Pending review';
    if (status === 'proformaApproved') return 'Accepted';
    if (['paid', 'creditPurchase', 'deliveryNoteAttached', 'closed'].includes(status)) return 'Settled';
    return 'In workflow';
  }

  function downloadChartXlsx() {
    const companyName = state.company?.name || 'Company';
    const generatedDate = new Date().toLocaleDateString();
    const rangeTag = `${toYmdLocal(chartSeries.startDay)}_${toYmdLocal(chartSeries.endDay)}`;

    const start = chartSeries.startDay;
    const n = chartSeries.chartRangeDays;
    const aoa = [
      ['e-Cunga Accountant Expenditure vs Budget Report'],
      [''],
      ['Company', companyName],
      ['Generated Date', generatedDate],
      ['Report Period', `${toYmdLocal(chartSeries.startDay)} to ${toYmdLocal(chartSeries.endDay)}`],
      [''],
      ['Payment Aging'],
      ['Category', 'Invoice Count', 'Amount'],
      ['Current (0-30 days)', paymentAging.current.count, Math.round(paymentAging.current.amount)],
      ['Overdue 31-60 days', paymentAging.overdue30.count, Math.round(paymentAging.overdue30.amount)],
      ['Overdue 61-90 days', paymentAging.overdue60.count, Math.round(paymentAging.overdue60.amount)],
      ['Overdue 90+ days', paymentAging.overdue90.count, Math.round(paymentAging.overdue90.amount)],
      [''],
      ['Cash Flow Projection'],
      ['Month', 'Expected Payments'],
      ...cashFlowProjection.map((proj) => [proj.month, Math.round(proj.amount)]),
      [''],
      ['Expenditure vs Budget Data'],
      ['Date', 'Actual', 'Budget'],
    ];
    for (let i = 0; i < n; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateText = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      aoa.push([dateText, Math.round(chartSeries.actualByDay[i] || 0), Math.round(chartSeries.budgetByDay[i] || 0)]);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadAoAAsXlsx(`expenditure-vs-budget-${rangeTag}-${stamp}`, aoa, 'Expenditure vs Budget');
  }

  function downloadChartPdf() {
    const companyName = state.company?.name || 'Company';
    const generatedDate = new Date().toLocaleDateString();
    const rangeTag = `${toYmdLocal(chartSeries.startDay)}_${toYmdLocal(chartSeries.endDay)}`;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('e-Cunga Accountant Expenditure vs Budget Report', 14, 18);
    doc.setFontSize(11);
    doc.text(`Company: ${companyName}`, 14, 28);
    doc.text(`Generated: ${generatedDate}`, 14, 36);
    doc.text(`Report Period: ${toYmdLocal(chartSeries.startDay)} to ${toYmdLocal(chartSeries.endDay)}`, 14, 44);

    const totalActual = chartSeries.actualByDay.reduce((sum, val) => sum + val, 0);
    const totalBudget = chartSeries.budgetByDay.reduce((sum, val) => sum + val, 0);
    doc.text(`Total Actual Expenditure: ${formatMoney(Math.round(totalActual), chartCurrency)}`, 14, 54);
    doc.text(`Total Budget: ${formatMoney(Math.round(totalBudget), chartCurrency)}`, 14, 62);
    doc.text(`Variance: ${formatMoney(Math.round(totalActual - totalBudget), chartCurrency)}`, 14, 70);

    doc.text('Payment Aging', 14, 84);
    doc.text(`Current (0-30 days): ${paymentAging.current.count} invoices, ${formatMoney(Math.round(paymentAging.current.amount), chartCurrency)}`, 18, 94);
    doc.text(`Overdue 31-60 days: ${paymentAging.overdue30.count} invoices, ${formatMoney(Math.round(paymentAging.overdue30.amount), chartCurrency)}`, 18, 102);
    doc.text(`Overdue 61-90 days: ${paymentAging.overdue60.count} invoices, ${formatMoney(Math.round(paymentAging.overdue60.amount), chartCurrency)}`, 18, 110);
    doc.text(`Overdue 90+ days: ${paymentAging.overdue90.count} invoices, ${formatMoney(Math.round(paymentAging.overdue90.amount), chartCurrency)}`, 18, 118);

    doc.text('Cash Flow Projection', 14, 132);
    cashFlowProjection.forEach((proj, index) => {
      doc.text(`${proj.month}: ${formatMoney(Math.round(proj.amount), chartCurrency)}`, 18, 142 + index * 8);
    });

    doc.text('Daily Breakdown', 14, 168);
    const start = chartSeries.startDay;
    const n = Math.min(chartSeries.chartRangeDays, 20);
    for (let i = 0; i < n; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateText = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      doc.text(`${dateText}: Actual ${formatMoney(Math.round(chartSeries.actualByDay[i] || 0), chartCurrency)} / Budget ${formatMoney(Math.round(chartSeries.budgetByDay[i] || 0), chartCurrency)}`, 18, 178 + i * 8);
    }

    doc.save(`expenditure-vs-budget-${rangeTag}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function moveChartTip(e, meta) {
    const wrap = chartWrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    setChartTip({
      left: e.clientX - r.left,
      top: e.clientY - r.top,
      label: meta.label,
      actual: meta.actual,
      budget: meta.budget,
    });
  }

  function onChartMouseMove(e) {
    const wrap = chartWrapRef.current;
    if (!wrap) return;
    const svg = e.currentTarget;
    if (!svg?.createSVGPoint) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM?.();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());

    let best = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const meta of chartSeries.pointsMeta) {
      const d = Math.abs(meta.x - local.x);
      if (d < bestD) {
        bestD = d;
        best = meta;
      }
    }
    if (!best) return;
    moveChartTip(e, best);
  }

  return (
    <div className={ui.accountantDash}>
      <div className={ui.accountantSummaryGrid}>
        <article
          className={`${ui.accountantSummaryCard} ${ui.accountantSummaryCardClickable}`}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/app/accountant/payments')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/app/accountant/payments');
          }}
        >
          <p className={ui.accountantSummaryLabel}>Total payment</p>
          <p className={ui.accountantSummaryValue}>
            <MoneyFigure
              value={totalPaymentsAmount}
              amountClassName={ui.accountantSummaryAmount}
              currencyClassName={ui.accountantSummaryCurrency}
            />
          </p>
          <div className={ui.accountantSummaryLinks}>
            <button
              type="button"
              className={ui.accountantSummaryLink}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/app/accountant/payments');
              }}
            >
              Pending payments
            </button>
            <button
              type="button"
              className={ui.accountantSummaryLink}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/app/accountant/invoices');
              }}
            >
              Settled payments
            </button>
          </div>
        </article>

        <article
          className={`${ui.accountantSummaryCard} ${ui.accountantSummaryCardClickable}`}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/app/accountant/invoices')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/app/accountant/invoices');
          }}
        >
          <p className={ui.accountantSummaryLabel}>Credit Purchase</p>
          <p className={ui.accountantSummaryValue}>
            <MoneyFigure
              value={creditPurchaseAmount}
              amountClassName={ui.accountantSummaryAmount}
              currencyClassName={ui.accountantSummaryCurrency}
            />
          </p>
          <span className={`${ui.accountantSummaryPill} ${creditPurchaseAmount > 0 ? ui.accountantSummaryPillInfo : ''}`}>
            Outstanding
          </span>
        </article>

        <article
          className={`${ui.accountantSummaryCard} ${ui.accountantSummaryCardClickable}`}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/app/accountant/invoices')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/app/accountant/invoices');
          }}
        >
          <p className={ui.accountantSummaryLabel}>Supporting documents</p>
          <p className={ui.accountantSummaryValue}>{supportingDocsCount}</p>
          <span className={`${ui.accountantSummaryPill} ${supportingDocsCount > 0 ? ui.accountantSummaryPillBad : ''}`}>
            Missing files
          </span>
        </article>

        <article
          className={`${ui.accountantSummaryCard} ${ui.accountantSummaryCardClickable}`}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/app/accountant/approvals')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/app/accountant/approvals');
          }}
        >
          <p className={ui.accountantSummaryLabel}>Proformas for review</p>
          <p className={ui.accountantSummaryValue}>{proformasForReviewCount}</p>
          <span className={`${ui.accountantSummaryPill} ${proformasForReviewCount > 0 ? ui.accountantSummaryPillInfo : ''}`}>
            {proformasForReviewCount > 0 ? 'Action required' : 'Up to date'}
          </span>
        </article>
      </div>

      <section className={`${ui.accountantChartCard} ${ui.accountantChartCardFullWidth}`}>
        <div className={ui.accountantChartCardTop}>
          <h1 className={ui.accountantTitle}>{t('app.accountant.dashTitle')}</h1>
          <p className={ui.accountantChartLead}>
            Expenditure vs. Budget — {chartSeries.durationPhrase}
          </p>
        </div>
        <div className={ui.accountantChartToolbar} role="toolbar" aria-label="Chart filters and export">
          <div className={ui.accountantChartToolbarDates} role="group" aria-label="Date range">
            <label className={ui.accountantChartDateField}>
              <span>From</span>
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label className={ui.accountantChartDateField}>
              <span>To</span>
              <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <InventoryFilterSelect
              value={invoiceStatusFilter}
              onChange={setInvoiceStatusFilter}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'proformaApproved', label: 'Ready to Pay' },
                { value: 'paid', label: 'Paid' },
                { value: 'pending', label: 'Pending' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
            <InventoryFilterSelect
              value={currencyFilter}
              onChange={setCurrencyFilter}
              options={[
                { value: 'all', label: 'All Currencies' },
                { value: 'RWF', label: 'RWF' },
                { value: 'USD', label: 'USD' },
                { value: 'EUR', label: 'EUR' },
              ]}
            />
          </div>
          <button type="button" className={ui.accountantChartExportBtn} onClick={downloadChartXlsx}>
            Download Excel
          </button>
          <button type="button" className={ui.accountantChartExportBtn} onClick={downloadChartPdf}>
            Download PDF
          </button>
          <div className={ui.accountantChartLegendKey} aria-label="Chart legend">
            <div className={ui.accountantChartKeyItem}>
              <span className={ui.accountantChartKeyMark} aria-hidden>
                <span className={ui.accountantChartKeyMarkLineActual} />
                <span className={ui.accountantChartKeyMarkDotActual} />
              </span>
              <span className={ui.accountantChartKeyLabel}>Actual</span>
            </div>
            <div className={ui.accountantChartKeyItem}>
              <span className={ui.accountantChartKeyMark} aria-hidden>
                <span className={ui.accountantChartKeyMarkLineBudget} />
                <span className={ui.accountantChartKeyMarkDotBudget} />
              </span>
              <span className={ui.accountantChartKeyLabel}>Budgeted</span>
            </div>
          </div>
        </div>
        <div
          className={ui.accountantChartSvgWrap}
          ref={chartWrapRef}
          onMouseLeave={() => setChartTip(null)}
        >
          <svg
            viewBox={`0 0 ${chartSeries.viewW} ${chartSeries.viewH}`}
            className={ui.accountantChartSvg}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Expenditure versus budget by day"
            onMouseMove={onChartMouseMove}
            onMouseLeave={() => setChartTip(null)}
          >
            <rect
              x={chartSeries.PAD_L}
              y={chartSeries.PAD_TOP}
              width={chartSeries.plotW}
              height={chartSeries.plotH}
              rx={10}
              className={ui.accountantChartPlotFill}
            />
            {chartSeries.yTicks.map((yv) => (
              <line
                key={`grid-${yv}`}
                x1={chartSeries.PAD_L}
                x2={chartSeries.viewW - chartSeries.PAD_R}
                y1={chartSeries.yFor(yv)}
                y2={chartSeries.yFor(yv)}
                className={ui.accountantChartGridLine}
              />
            ))}
            {chartSeries.yTicks.map((yv) => (
              <text
                key={`ylab-${yv}`}
                x={6}
                y={chartSeries.yFor(yv) + 4}
                className={ui.accountantChartAxisText}
              >
                {formatMoney(Math.round(yv), chartCurrency).replace(/\u00A0/g, ' ')}
              </text>
            ))}
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={chartSeries.pointsActual}
              className={ui.accountantChartActual}
            />
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={chartSeries.pointsBudget}
              className={`${ui.accountantChartBudget} ${ui.accountantChartBudgetDashed}`}
            />
            {chartSeries.tickIndices.map((i) => (
              <text
                key={`xlab-${i}`}
                x={chartSeries.xFor(i)}
                y={chartSeries.PAD_TOP + chartSeries.plotH + 28}
                textAnchor="middle"
                className={ui.accountantChartAxisTextX}
              >
                {chartSeries.tickLabelDay(chartSeries.pointsMeta[i].date)}
              </text>
            ))}
          </svg>
          {chartTip ? (
            <div
              className={ui.accountantChartTooltip}
              style={{ left: chartTip.left, top: chartTip.top }}
            >
              <p className={ui.accountantChartTooltipDate}>{chartTip.label}</p>
              <p className={ui.accountantChartTooltipRow}>
                <span>Actual</span>
                <strong>{formatMoney(Math.round(chartTip.actual), chartCurrency)}</strong>
              </p>
              <p className={ui.accountantChartTooltipRow}>
                <span>Budget</span>
                <strong>{formatMoney(Math.round(chartTip.budget), chartCurrency)}</strong>
              </p>
            </div>
          ) : null}
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

      <section className={ui.accountantLedgerCard}>
        <div className={ui.accountantCardHead}>
          <h2 className={ui.accountantLedgerTitle}>Recent Transactions</h2>
            <button type="button" className={ui.accountantLedgerLink} onClick={() => navigate('/app/accountant/invoices')}>
              View Full Ledger
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginLeft: '4px' }}>
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
        </div>

        <div className={ui.accountantTxnList}>
          {recentTransactions.map((invoice, index) => {
            const requisition = state.requisitions.find((q) => q.id === invoice.requisitionId);
            const reqSt = requisition?.status;
            return (
            <article key={invoice.id} className={ui.accountantTxnRow}>
              <div className={ui.accountantTxnIdentity}>
                <span className={index % 2 === 0 ? ui.accountantTxnIcon : `${ui.accountantTxnIcon} ${ui.accountantTxnIconAlt}`}>
                  <AccountantIcon kind={index % 3 === 0 ? 'payment' : 'invoice'} />
                </span>
                <div>
                  <p className={ui.accountantTxnTitle}>{invoice.supplierName}</p>
                  <p className={ui.accountantTxnMeta}>
                    {invoice.type === 'final' ? 'Final invoice' : 'Inventory restock'} ·{' '}
                    {requisition ? (
                      <button
                        type="button"
                        className={ui.accountantApprovalIdBtn}
                        title="Open requisition form"
                        onClick={() => setPdfPreviewReq(requisition)}
                      >
                        {displayRequestRef(requisition.id)}
                      </button>
                    ) : (
                      invoice.reference
                    )}
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
              <span className={`${ui.accountantTxnBadge} ${transactionTone(invoice.status, reqSt)}`}>{transactionLabel(invoice.status, reqSt)}</span>
            </article>
          );})}
        </div>
      </section>

      <RequisitionPdfModal
        isOpen={!!pdfPreviewReq}
        req={pdfPreviewReq}
        onClose={() => setPdfPreviewReq(null)}
        onDownload={downloadRequisitionPdf}
        users={state.users}
        company={state.company}
      />
    </div>
  );
}

export function AccountantApprovals() {
  const { t } = useI18n();
  const { state, accountantReviewInvoice, markInvoicePaid, markInvoiceCreditPurchase } = usePortalData();
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [filter, setFilter] = useState('approved');
  const [busyInvoiceId, setBusyInvoiceId] = useState(null);
  const [pdfPreviewReq, setPdfPreviewReq] = useState(null);
  const approvalRequests = useMemo(
    () =>
      state.invoices
        .filter((invoice) => invoice.type === 'proforma')
        .map((invoice) => {
          const requisition = state.requisitions.find((entry) => entry.id === invoice.requisitionId);
          const bucket = accountantFinanceBucket(invoice.status, requisition?.status);
          return {
            id: invoice.id,
            invoice,
            requisition,
            bucket,
            requestId: requisition ? displayRequestRef(requisition.id) : invoice.reference,
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
  const approvalRequestsVisible = useMemo(
    () => approvalRequests.filter((entry) => entry.bucket !== 'awaiting_clerk'),
    [approvalRequests]
  );
  const rows =
    filter === 'all'
      ? approvalRequestsVisible
      : filter === 'pending'
        ? approvalRequestsVisible.filter((entry) => entry.bucket === 'pending')
        : approvalRequestsVisible.filter((entry) => entry.bucket === filter);
  const approvalTablePager = usePagedList(rows, { resetKey: filter });
  const awaitingFinanceCount = approvalRequestsVisible.filter((entry) => entry.bucket === 'pending').length;
  /** Active proforma pipeline (excludes rejected and pre–clerk-accept proformas) for summary totals. */
  const fiscalSpend = approvalRequestsVisible
    .filter((entry) => entry.bucket !== 'rejected')
    .reduce((sum, entry) => sum + entry.totalCost, 0);

  async function onAccountantReview(invoiceId, decision) {
    let reason = '';
    if (decision === 'rejected') {
      reason = window.prompt('Decline with reason (required):', '');
      if (reason === null) return;
      if (!String(reason).trim()) {
        showFlash(t('app.accountant.toastDeclineReason') || 'Please enter a reason to decline.', 'warn');
        return;
      }
    }
    setBusyInvoiceId(invoiceId);
    showFlash(t('app.accountant.toastReviewProcessing'), 'loading');
    try {
      await accountantReviewInvoice(invoiceId, decision, reason);
      showFlash(
        decision === 'approved' ? t('app.accountant.toastReviewApproved') : t('app.accountant.toastReviewRejected'),
        decision === 'approved' ? 'ok' : 'warn'
      );
    } catch (e) {
      showFlash(e.message || t('app.accountant.toastErrorGeneric'), 'error');
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function onPayAndNotify(invoiceId) {
    setBusyInvoiceId(invoiceId);
    showFlash(t('app.accountant.toastPayProcessing'), 'loading');
    try {
      await markInvoicePaid(invoiceId, actor?.id);
      showFlash(t('app.accountant.toastPaySuccess'), 'ok');
    } catch (e) {
      showFlash(e.message || t('app.accountant.toastErrorGeneric'), 'error');
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function onCreditPurchaseNotify(invoiceId) {
    setBusyInvoiceId(invoiceId);
    showFlash(t('app.accountant.toastCreditProcessing'), 'loading');
    try {
      await markInvoiceCreditPurchase(invoiceId);
      showFlash(t('app.accountant.toastCreditSuccess'), 'ok');
    } catch (e) {
      showFlash(e.message || t('app.accountant.toastErrorGeneric'), 'error');
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function onDeclineWithReason(invoiceId) {
    const reason = window.prompt('Decline with reason (required):', '');
    if (reason === null) return;
    if (!String(reason).trim()) {
      showFlash(t('app.accountant.toastDeclineReason'), 'warn');
      return;
    }
    setBusyInvoiceId(invoiceId);
    showFlash(t('app.accountant.toastDeclineProcessing'), 'loading');
    try {
      await accountantReviewInvoice(invoiceId, 'rejected', reason);
      showFlash(t('app.accountant.toastDeclined'), 'warn');
    } catch (e) {
      showFlash(e.message || t('app.accountant.toastErrorGeneric'), 'error');
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
          <span>Awaiting finance review:</span>
          <strong>{awaitingFinanceCount}</strong>
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
                  <div className={ui.accountantApprovalId}>
                    {entry.requisition ? (
                      <button
                        type="button"
                        className={ui.accountantApprovalIdBtn}
                        title="Open requisition form"
                        onClick={() => setPdfPreviewReq(entry.requisition)}
                      >
                        {entry.requestId}
                      </button>
                    ) : (
                      entry.requestId
                    )}
                  </div>
                  <div>
                    <p className={ui.accountantApprovalItem}>{entry.item}</p>
                    <p className={ui.accountantApprovalMeta}>{entry.category}</p>
                  </div>
                  <div className={ui.accountantApprovalQty}>{entry.qty}</div>
                  <div className={ui.accountantApprovalCost}>{formatMoney(entry.totalCost, entry.currency)}</div>
                  <div className={ui.accountantApprovalRequester}>
                    <div>
                      <p className={ui.accountantApprovalRequesterName}>{entry.requester}</p>
                      <StatusBadge status={accountantFinanceLabel(entry.invoice.status, entry.requisition?.status)} />
                      {entry.requesterEmail ? (
                        <a
                          href={`mailto:${entry.requesterEmail}`}
                          className={ui.accountantLedgerLink}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.25rem' }}
                        >
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="m22 6-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Contact requester
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className={ui.accountantApprovalQty}>{entry.supplierName}</div>
                  <div className={ui.accountantApprovalActions}>
                    {entry.proformaUrl ? (
                      <DocumentHoverPreview url={entry.proformaUrl} title="Proforma" resolveUrl={resolveDocUrlForPreview}>
                        <button
                          type="button"
                          className={`${ui.accountantApprovalApprove} ${ui.accountantApprovalIconBtn}`}
                          title="Click to preview document"
                          aria-label="Preview proforma PDF"
                        >
                          <FileIcon size={16} />
                        </button>
                      </DocumentHoverPreview>
                    ) : (
                      <span className={ui.mutedSm}>No file</span>
                    )}
                  </div>
                  <div className={ui.accountantApprovalActions}>
                    {entry.bucket === 'pending' ? (
                      <div className={ui.accountantApprovalActionToolbar}>
                        <button
                          type="button"
                          className={`${ui.accountantApprovalReject} ${ui.accountantApprovalIconBtn}`}
                          title="Reject"
                          aria-label="Reject proforma"
                          aria-busy={busyInvoiceId === entry.invoice.id}
                          disabled={busyInvoiceId === entry.invoice.id}
                          onClick={() => onAccountantReview(entry.invoice.id, 'rejected')}
                        >
                          <CloseIcon size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${ui.accountantApprovalApprove} ${ui.accountantApprovalIconBtn}`}
                          title="Approve"
                          aria-label="Approve proforma"
                          aria-busy={busyInvoiceId === entry.invoice.id}
                          disabled={busyInvoiceId === entry.invoice.id}
                          onClick={() => onAccountantReview(entry.invoice.id, 'approved')}
                        >
                          {busyInvoiceId === entry.invoice.id ? '…' : <CheckIcon size={16} />}
                        </button>
                      </div>
                    ) : entry.invoice.status === 'proformaApproved' ? (
                      <div className={ui.accountantApprovalActionToolbar}>
                        <button
                          type="button"
                          className={`${ui.accountantApprovalApprove} ${ui.accountantApprovalIconBtn}`}
                          title={t('app.accountant.tooltipPayNotify')}
                          aria-label={t('app.accountant.tooltipPayNotify')}
                          aria-busy={busyInvoiceId === entry.invoice.id}
                          disabled={busyInvoiceId === entry.invoice.id}
                          onClick={() => onPayAndNotify(entry.invoice.id)}
                        >
                          {busyInvoiceId === entry.invoice.id ? '…' : <PayNotifyIcon size={16} />}
                        </button>
                        <button
                          type="button"
                          className={`${ui.accountantApprovalApprove} ${ui.accountantApprovalIconBtn}`}
                          title={t('app.accountant.tooltipCreditPurchase')}
                          aria-label={t('app.accountant.tooltipCreditPurchase')}
                          aria-busy={busyInvoiceId === entry.invoice.id}
                          disabled={busyInvoiceId === entry.invoice.id}
                          onClick={() => onCreditPurchaseNotify(entry.invoice.id)}
                        >
                          {busyInvoiceId === entry.invoice.id ? '…' : <CreditPurchaseIcon size={16} />}
                        </button>
                        <button
                          type="button"
                          className={`${ui.accountantApprovalReject} ${ui.accountantApprovalIconBtn}`}
                          title="Decline with reason"
                          aria-label="Decline with reason"
                          aria-busy={busyInvoiceId === entry.invoice.id}
                          disabled={busyInvoiceId === entry.invoice.id}
                          onClick={() => onDeclineWithReason(entry.invoice.id)}
                        >
                          <CloseIcon size={16} />
                        </button>
                      </div>
                    ) : ['paid', 'creditPurchase', 'deliveryNoteAttached', 'closed'].includes(entry.invoice.status) ? (
                      (() => {
                        const docs = supportingDocumentsForInvoice(state, entry.invoice);
                        const hasAcceptedProforma = Boolean(docs.finalInvoiceUrl);
                        const hasDn = Boolean(docs.deliveryNoteUrl);
                        return (
                          <div className={ui.accountantApprovalActionToolbar}>
                            {hasDn ? (
                              <DocumentHoverPreview url={docs.deliveryNoteUrl} title="Delivery note (clerk)" resolveUrl={resolveDocUrlForPreview}>
                                <button
                                  type="button"
                                  className={`${ui.accountantApprovalApprove} ${ui.accountantApprovalIconBtn}`}
                                  title="Click to preview document"
                                  aria-label="Preview delivery note from clerk"
                                >
                                  <DeliveryNoteIcon size={16} />
                                </button>
                              </DocumentHoverPreview>
                            ) : (
                              <DocumentHoverPreview awaiting title="View delivery note">
                                <button
                                  type="button"
                                  className={ui.accountantApprovalIconPending}
                                  title="View delivery note"
                                  aria-label="View delivery note — not yet available from clerk"
                                >
                                  <DeliveryNoteIcon size={16} />
                                </button>
                              </DocumentHoverPreview>
                            )}
                            {hasAcceptedProforma ? (
                              <DocumentHoverPreview
                                url={docs.finalInvoiceUrl}
                                title="Final invoice (supplier)"
                                resolveUrl={resolveDocUrlForPreview}
                              >
                                <button
                                  type="button"
                                  className={`${ui.accountantApprovalApprove} ${ui.accountantApprovalIconBtn}`}
                                  title="Click to preview document"
                                  aria-label="Preview final invoice from supplier"
                                >
                                  <AcceptedProformaIcon size={16} />
                                </button>
                              </DocumentHoverPreview>
                            ) : (
                              <DocumentHoverPreview awaiting title="View final invoice">
                                <button
                                  type="button"
                                  className={ui.accountantApprovalIconPending}
                                  title="View final invoice"
                                  aria-label="View final invoice — not yet available from supplier"
                                >
                                  <AcceptedProformaIcon size={16} />
                                </button>
                              </DocumentHoverPreview>
                            )}
                          </div>
                        );
                      })()
                    ) : entry.bucket === 'awaiting_clerk' ? (
                      <span className={ui.mutedSm}>Awaiting clerk</span>
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
            <span className={ui.accountantApprovalSummaryPill}>{awaitingFinanceCount} awaiting finance review</span>
          </section>
        </aside>
      </div>

      <RequisitionPdfModal
        isOpen={!!pdfPreviewReq}
        req={pdfPreviewReq}
        onClose={() => setPdfPreviewReq(null)}
        onDownload={downloadRequisitionPdf}
        users={state.users}
        company={state.company}
      />
    </div>
  );
}

export function AccountantInvoices() {
  const { t } = useI18n();
  const { state, accountantReviewInvoice, markInvoicePaid, markInvoiceCreditPurchase } = usePortalData();
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);
  const workspaceCurrency = state.company?.currency || 'RWF';
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [acctDocPreview, setAcctDocPreview] = useState(null);
  const [pdfPreviewReq, setPdfPreviewReq] = useState(null);
  const invoices = useMemo(
    () =>
      [...state.invoices]
        .sort((a, b) => {
          const tb = new Date(b.createdAt || 0).getTime();
          const ta = new Date(a.createdAt || 0).getTime();
          if (tb !== ta) return tb - ta;
          return String(b.id || '').localeCompare(String(a.id || ''));
        })
        .map((invoice) => {
          const requisition = state.requisitions.find((entry) => entry.id === invoice.requisitionId);
          const docs = supportingDocumentsForInvoice(state, invoice);
          const hasFinalInvoice = Boolean(docs.finalInvoiceUrl);
          const uiStatus = hasFinalInvoice ? 'closed' : invoice.status;
          return {
            ...invoice,
            requisition,
            deliveryNoteUrl: docs.deliveryNoteUrl || invoice.deliveryNoteUrl || '',
            finalInvoiceUrl: docs.finalInvoiceUrl || invoice.finalInvoiceUrl || '',
            supplier: invoice.supplierName,
            email:
              state.users.find((u) => String(u.id) === String(invoice.supplierId))?.email ||
              '',
            dateIssued: new Date(invoice.createdAt).toLocaleDateString(),
            initials: initialsFor(invoice.supplierName),
            requisitionStatus: requisition?.status,
            financeLabel: hasFinalInvoice ? 'Closed' : accountantFinanceLabel(invoice.status, requisition?.status),
            bucket: hasFinalInvoice ? 'paid' : invoiceTabBucket(invoice.status, requisition?.status),
            status: uiStatus,
            requisitionTitle: requisition?.title || 'Inventory workflow',
          };
        })
        .filter((entry) => entry.bucket !== 'awaiting_clerk'),
    [state.invoices, state.requisitions, state.users]
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
    .filter((entry) => !(entry.requisitionStatus === 'proformaAwaitingClerk' && entry.type === 'proforma'))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const pendingApprovals = invoices.filter((entry) =>
    isInvoicePendingAccountantReview(entry.status, entry.requisitionStatus)
  ).length;
  const settledThisMonth = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return invoices
      .filter((entry) => {
        if (!['paid', 'closed'].includes(entry.status)) return false;
        const ts = new Date(entry.paidAt || entry.updatedAt || entry.createdAt || 0).getTime();
        return ts >= start;
      })
      .reduce((acc, entry) => acc + Number(entry.amount || 0), 0);
  }, [invoices]);
  const cashFlowInsight = useMemo(() => {
    if (invoices.length === 0) return { kind: 'quiet' };
    if (pendingApprovals === 0) return { kind: 'clear' };
    const pct = Math.min(92, Math.max(62, 90 - pendingApprovals * 4));
    return { kind: 'busy', count: pendingApprovals, pct };
  }, [invoices.length, pendingApprovals]);

  function invoiceStatusTone(status, requisitionStatus) {
    if (status === 'rejected') return ui.accountantInvoiceBadgeRejected;
    if (status === 'proformaApproved') return ui.accountantInvoiceBadgeAccepted;
    if (status === 'partiallyPaid') return ui.accountantInvoiceBadgePartial;
    if (['creditPurchase', 'deliveryNoteAttached'].includes(status)) return ui.accountantInvoiceBadgeWarning;
    if (['paid', 'closed'].includes(status)) return ui.accountantInvoiceBadgePaid;
    if (requisitionStatus === 'proformaAwaitingClerk' && ['proformaReceived', 'sent', 'draft'].includes(status)) {
      return ui.accountantInvoiceBadgePending;
    }
    return ui.accountantInvoiceBadgePending;
  }

  function invoiceStatusLabel(status, requisitionStatus) {
    return accountantFinanceLabel(status, requisitionStatus);
  }

  async function onInvoiceApprove(id) {
    setBusyId(id);
    showFlash(t('app.accountant.toastInvoiceApproveProcessing'), 'loading');
    try {
      await accountantReviewInvoice(id, 'approved', actor?.id);
      showFlash(t('app.accountant.toastInvoiceApproved'), 'ok');
    } catch (e) {
      showFlash(e.message || t('app.accountant.toastErrorGeneric'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onInvoiceReject(id) {
    const reason = window.prompt('Decline with reason (required):', '');
    if (reason === null) return;
    if (!String(reason).trim()) {
      showFlash(t('app.accountant.toastDeclineReason') || 'Please enter a reason to decline.', 'warn');
      return;
    }
    setBusyId(id);
    showFlash(t('app.accountant.toastInvoiceRejectProcessing'), 'loading');
    try {
      await accountantReviewInvoice(id, 'rejected', reason);
      showFlash(t('app.accountant.toastInvoiceRejected'), 'warn');
    } catch (e) {
      showFlash(e.message || t('app.accountant.toastErrorGeneric'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onInvoicePay(id) {
    setBusyId(id);
    showFlash(t('app.accountant.toastInvoicePayProcessing'), 'loading');
    try {
      await markInvoicePaid(id, actor?.id);
      showFlash(t('app.accountant.toastInvoicePaySuccess'), 'ok');
    } catch (e) {
      showFlash(e.message || t('app.accountant.toastErrorGeneric'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onInvoiceCredit(id) {
    setBusyId(id);
    showFlash(t('app.accountant.toastCreditProcessing'), 'loading');
    try {
      await markInvoiceCreditPurchase(id);
      showFlash(t('app.accountant.toastCreditSuccess'), 'ok');
    } catch (e) {
      showFlash(e.message || t('app.accountant.toastErrorGeneric'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={ui.accountantInvoiceBoard}>
      <div className={ui.accountantInvoiceTop}>
        <div>
          <h1 className={ui.accountantInvoiceTitle}>{t('app.accountant.invoiceTitle')}</h1>
          <p className={ui.accountantInvoiceLead}>{t('app.accountant.invoiceLead')}</p>
        </div>
      </div>

      <div className={ui.accountantInvoiceStats}>
        <section className={ui.accountantInvoiceStatCard}>
          <p className={ui.accountantInvoiceStatLabel}>{t('app.accountant.invoiceStatOutstanding')}</p>
          <strong className={ui.accountantInvoiceStatValue}>
            <MoneyFigure
              value={totalOutstanding}
              currency={workspaceCurrency}
              amountClassName={ui.accountantInvoiceStatAmount}
              currencyClassName={ui.accountantInvoiceStatCurrency}
            />
          </strong>
          <span className={ui.accountantInvoiceMutedMeta}>{t('app.accountant.invoiceStatOutstandingMeta')}</span>
        </section>

        <section className={ui.accountantInvoiceStatCard}>
          <p className={ui.accountantInvoiceStatLabel}>{t('app.accountant.invoiceStatPending')}</p>
          <strong className={ui.accountantInvoiceStatValue}>{pendingApprovals}</strong>
          <span className={ui.accountantInvoiceMutedMeta}>{t('app.accountant.invoiceStatPendingMeta')}</span>
        </section>

        <section className={ui.accountantInvoiceStatCard}>
          <p className={ui.accountantInvoiceStatLabel}>{t('app.accountant.invoiceStatSettledMonth')}</p>
          <strong className={ui.accountantInvoiceStatValue}>
            <MoneyFigure
              value={settledThisMonth}
              currency={workspaceCurrency}
              amountClassName={ui.accountantInvoiceStatAmount}
              currencyClassName={ui.accountantInvoiceStatCurrency}
            />
          </strong>
          <span className={ui.accountantInvoiceMutedMeta}>{t('app.accountant.invoiceStatSettledMonthMeta')}</span>
        </section>

        <section className={ui.accountantInvoicePrediction} aria-label={t('app.accountant.invoiceInsightTitle')}>
          <div className={ui.accountantInvoicePredictionMain}>
            <p className={ui.accountantInvoicePredictionEyebrow}>{t('app.accountant.invoiceInsightEyebrow')}</p>
            <p className={ui.accountantInvoicePredictionTitle}>{t('app.accountant.invoiceInsightTitle')}</p>
            <p className={ui.accountantInvoicePredictionText}>
              {cashFlowInsight.kind === 'quiet'
                ? t('app.accountant.invoiceInsightQuiet')
                : cashFlowInsight.kind === 'clear'
                  ? t('app.accountant.invoiceInsightClear')
                  : t('app.accountant.invoiceInsightBusy', {
                      count: cashFlowInsight.count,
                      pct: cashFlowInsight.pct,
                    })}
            </p>
          </div>
          <div className={ui.accountantInvoicePredictionVisual}>
            <span className={ui.accountantInvoicePredictionIcon}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 18V6M9 18v-5m5 5V9m5 9V3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </section>
      </div>

      <div className={ui.accountantInvoiceToolbar}>
        <div className={ui.accountantInvoiceTabs}>
          {[
            ['all', t('app.accountant.invoiceTabAll')],
            ['accepted', t('app.accountant.invoiceTabAccepted')],
            ['pending', t('app.accountant.invoiceTabPending')],
            ['rejected', t('app.accountant.invoiceTabRejected')],
            ['paid', t('app.accountant.invoiceTabFullyPaid')],
            ['partiallyPaid', t('app.accountant.invoiceTabPartiallyPaid')],
            ['creditPurchase', t('app.accountant.invoiceTabCreditPurchase')],
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
            <span className={ui.portalFilterLabel}>{t('common.search')}</span>
            <input
              className={ui.portalFilterSearch}
              placeholder={t('app.accountant.invoiceSearchPh')}
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
            />
          </label>
          <ClearFiltersIconButton title={t('common.clearSearchAria')} onClick={() => setInvSearch('')} />
          <button type="button" className={ui.accountantInvoiceDateBtn}>
            {t('app.accountant.invoiceDateRange')}
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
            <span>{t('app.accountant.invoiceSelectAll')}</span>
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
                    <p className={ui.accountantInvoiceSupplierMeta}>
                      {entry.requisition ? (
                        <>
                          <button
                            type="button"
                            className={ui.accountantApprovalIdBtn}
                            title="Open requisition form"
                            onClick={() => setPdfPreviewReq(entry.requisition)}
                          >
                            {displayRequestRef(entry.requisition.id)}
                          </button>
                          {' · '}
                        </>
                      ) : null}
                      {entry.requisitionTitle}
                    </p>
                  </div>
                </div>
                <div className={ui.accountantInvoiceDate}>{entry.dateIssued}</div>
                <div className={ui.accountantInvoiceAmount}>{formatMoney(entry.amount, entry.currency)}</div>
                <div>
                  <span className={`${ui.accountantInvoiceBadge} ${invoiceStatusTone(entry.status, entry.requisitionStatus)}`}>
                    {invoiceStatusLabel(entry.status, entry.requisitionStatus)}
                  </span>
                </div>
                <div className={ui.accountantInvoiceActions}>
                  <InvoiceDocumentButtonGroup
                    invoice={entry}
                    onPreview={(url, title) => setAcctDocPreview({ url, title })}
                  />
                  {isInvoicePendingAccountantReview(entry.status, entry.requisitionStatus) ? (
                    <>
                      <button
                        type="button"
                        className={ui.accountantInvoiceIconBtn}
                        aria-label="Reject proforma"
                        aria-busy={busyId === entry.id}
                        disabled={busyId === entry.id}
                        onClick={() => onInvoiceReject(entry.id)}
                      >
                        <CloseIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className={ui.accountantInvoiceIconBtn}
                        aria-label="Approve proforma"
                        aria-busy={busyId === entry.id}
                        disabled={busyId === entry.id}
                        onClick={() => onInvoiceApprove(entry.id)}
                      >
                        <CheckIcon size={16} />
                      </button>
                    </>
                  ) : null}
                  {entry.status === 'proformaApproved' ? (
                    <>
                      <button
                        type="button"
                        className={ui.accountantInvoiceIconBtn}
                        title={t('app.accountant.tooltipPayNotify')}
                        aria-label={t('app.accountant.tooltipPayNotify')}
                        aria-busy={busyId === entry.id}
                        disabled={busyId === entry.id}
                        onClick={() => onInvoicePay(entry.id)}
                      >
                        {busyId === entry.id ? '…' : <PayNotifyIcon size={16} />}
                      </button>
                      <button
                        type="button"
                        className={ui.accountantInvoiceIconBtn}
                        title={t('app.accountant.tooltipCreditPurchase')}
                        aria-label={t('app.accountant.tooltipCreditPurchase')}
                        aria-busy={busyId === entry.id}
                        disabled={busyId === entry.id}
                        onClick={() => onInvoiceCredit(entry.id)}
                      >
                        {busyId === entry.id ? '…' : <CreditPurchaseIcon size={16} />}
                      </button>
                    </>
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
            <div className={ui.accountantInvoiceEmpty}>
              <div className={ui.accountantInvoiceEmptyIcon} aria-hidden>
                <svg viewBox="0 0 24 24" width="40" height="40">
                  <path
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className={ui.accountantInvoiceEmptyTitle}>{t('app.accountant.invoiceEmptyTitle')}</h3>
              <p className={ui.accountantInvoiceEmptyText}>
                {invSearch.trim() || filter !== 'all'
                  ? t('app.accountant.invoiceEmptyFiltered')
                  : t('app.accountant.invoiceEmptyNone')}
              </p>
              {invSearch.trim() ? (
                <button type="button" className={ui.accountantInvoiceEmptyBtn} onClick={() => setInvSearch('')}>
                  {t('app.accountant.invoiceEmptyClearSearch')}
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className={ui.accountantInvoiceFooter}>
          <ListPageControls
            className={ui.accountantInvoiceListPager}
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

      <DocumentViewerModal
        open={Boolean(acctDocPreview?.url)}
        title={acctDocPreview?.title}
        url={acctDocPreview?.url}
        onClose={() => setAcctDocPreview(null)}
      />

      <RequisitionPdfModal
        isOpen={!!pdfPreviewReq}
        req={pdfPreviewReq}
        onClose={() => setPdfPreviewReq(null)}
        onDownload={downloadRequisitionPdf}
        users={state.users}
        company={state.company}
      />
    </div>
  );
}

export function AccountantPayments() {
  const { t } = useI18n();
  const { state, markInvoicePaid } = usePortalData();
  const { user } = useAuth();
  const actor = useAccountantActor(state, user);
  const { showFlash } = useFlash();
  const payable = useMemo(
    () =>
      state.invoices
        .filter((entry) => entry.type === 'proforma' && ['proformaApproved', 'partiallyPaid', 'creditPurchase'].includes(entry.status))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)),
    [state.invoices]
  );
  const suppliers = useMemo(() => [...new Set(payable.map((entry) => entry.supplierName))], [payable]);
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ach');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [partialPaymentModal, setPartialPaymentModal] = useState(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('bank_transfer');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentDeadline, setPaymentDeadline] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [acctDocPreview, setAcctDocPreview] = useState(null);
  const invoices = useMemo(
    () =>
      payable
        .filter((entry) => !supplier || entry.supplierName === supplier)
        .filter((entry) => paymentStatusFilter === 'all' || entry.status === paymentStatusFilter)
        .map((entry) => ({
          id: entry.id,
          ref: entry.reference,
          dueDate: new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(),
          amount: entry.amount,
          currency: entry.currency,
          amountPaid: entry.amountPaid || 0,
          balanceDue: entry.amount - (entry.amountPaid || 0),
          status: entry.status,
          installments: entry.installments || [],
          paymentChannel: entry.paymentChannel || '',
          paymentDeadline: entry.paymentDeadline ? new Date(entry.paymentDeadline).toLocaleDateString() : '',
        })),
    [payable, supplier, paymentStatusFilter]
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
    showFlash(t('app.accountant.toastBatchPayProcessing'), 'loading');
    try {
      for (const invoiceId of selectedInvoiceIds) {
        await markInvoicePaid(invoiceId, actor?.id);
      }
      showFlash(t('app.accountant.toastBatchPaySuccess'), 'ok');
    } catch (e) {
      const msg = e.message || t('app.accountant.toastErrorGeneric');
      setPayError(msg);
      showFlash(msg, 'error');
    } finally {
      setPaying(false);
    }
  }

  async function handlePartialPayment() {
    if (!partialPaymentModal || !partialAmount || Number(partialAmount) <= 0) {
      showFlash('Please enter a valid payment amount', 'error');
      return;
    }

    setPaying(true);
    showFlash('Processing partial payment...', 'loading');
    try {
      let uploadedProofUrl = paymentProofUrl;
      
      // Upload payment proof file if provided
      if (paymentProofFile) {
        setUploadingProof(true);
        try {
          uploadedProofUrl = await apiUploadMedia(paymentProofFile);
          showFlash('Payment proof uploaded successfully', 'ok');
        } catch (uploadError) {
          showFlash('Failed to upload payment proof: ' + uploadError.message, 'error');
          throw new Error('Payment proof upload failed');
        } finally {
          setUploadingProof(false);
        }
      }

      const response = await fetch(`/api/invoices/${partialPaymentModal.invoiceId}/partial-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaid: Number(partialAmount),
          paymentChannel,
          dueDate: paymentDueDate,
          paymentDeadline: paymentDeadline,
          paymentProofUrl: uploadedProofUrl,
          installment: {
            amount: Number(partialAmount),
            paymentProofUrl: uploadedProofUrl,
            dueDate: paymentDueDate,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to process partial payment');

      showFlash('Partial payment recorded successfully', 'ok');
      setPartialPaymentModal(null);
      setPartialAmount('');
      setPaymentChannel('bank_transfer');
      setPaymentDueDate('');
      setPaymentDeadline('');
      setPaymentProofUrl('');
      setPaymentProofFile(null);
    } catch (e) {
      const msg = e.message || 'Failed to process partial payment';
      showFlash(msg, 'error');
    } finally {
      setPaying(false);
    }
  }

  function openPartialPaymentModal(invoice) {
    setPartialPaymentModal(invoice);
    setPartialAmount('');
    setPaymentChannel('bank_transfer');
    setPaymentDueDate('');
    setPaymentDeadline('');
    setPaymentProofUrl('');
    setPaymentProofFile(null);
  }

  return (
    <>
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
                <InventoryFilterSelect
                  value={supplier}
                  onChange={setSupplier}
                  disabled={!suppliers.length}
                  options={[
                    ...suppliers.map((entry) => ({ value: entry, label: entry })),
                  ]}
                />
              </label>

              <label className={ui.accountantPaymentField}>
                <span className={ui.accountantPaymentLabel}>Payment status</span>
                <InventoryFilterSelect
                  value={paymentStatusFilter}
                  onChange={setPaymentStatusFilter}
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'proformaApproved', label: 'Approved' },
                    { value: 'partiallyPaid', label: 'Partially Paid' },
                    { value: 'creditPurchase', label: 'Credit Purchase' },
                  ]}
                />
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
          </section>

          <div className={ui.accountantPaymentInvoiceBlock}>
            <p className={ui.accountantPaymentLabel}>Select invoices to pay</p>
            <div className={ui.accountantPaymentInvoiceHead}>
              <span>Ref number</span>
              <span>Due date</span>
              <span>Total / Paid</span>
              <span>Balance Due</span>
              <span>Actions</span>
              <span>Select</span>
            </div>
            <div className={ui.accountantPaymentInvoiceList}>
              {invoices.length ? (
                payInvPager.pageSlice.map((invoice) => (
                  <div key={invoice.id} className={ui.accountantPaymentInvoiceRow}>
                    <div className={ui.accountantPaymentInvoiceRef}>{invoice.ref}</div>
                    <div className={ui.accountantPaymentInvoiceDate}>{invoice.dueDate}</div>
                    <div className={ui.accountantPaymentInvoiceAmount}>
                      {formatMoney(invoice.amountPaid, invoice.currency)} / {formatMoney(invoice.amount, invoice.currency)}
                    </div>
                    <div className={ui.accountantPaymentInvoiceAmount}>{formatMoney(invoice.balanceDue, invoice.currency)}</div>
                    <div className={ui.accountantPaymentInvoiceActions}>
                      {invoice.status !== 'paid' && (
                        <button
                          type="button"
                          className={ui.accountantPaymentInstallmentBtn}
                          onClick={() => openPartialPaymentModal(invoice)}
                        >
                          💳 Pay Partial
                        </button>
                      )}
                      {invoice.installments && invoice.installments.length > 0 && (
                        <button
                          type="button"
                          className={ui.accountantPaymentInstallmentBtn}
                          style={{ marginLeft: '0.5rem' }}
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          📋 History
                        </button>
                      )}
                    </div>
                    <span className={ui.accountantPaymentInvoiceCheck}>
                      <input type="checkbox" checked={selectedInvoiceIds.includes(invoice.id)} onChange={() => toggleInvoiceSelection(invoice.id)} />
                    </span>
                  </div>
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
              aria-busy={paying}
              disabled={!selectedInvoiceIds.length || paying}
              onClick={() => authorizeSelectedPayments()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l7 3v6c0 4.4-3 8.4-7 9-4-0.6-7-4.6-7-9V6l7-3zm-2.2 9.2l1.6 1.6 3.4-3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {paying ? 'Processing…' : 'Pay and Notify Supplier'}
            </button>
          </div>
          </div>

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

      {/* Partial Payment Modal */}
      {partialPaymentModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '0.5rem', 
            maxWidth: '600px', 
            width: '90%', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            padding: '2rem' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Partial Payment</h2>
              <button 
                type="button" 
                onClick={() => setPartialPaymentModal(null)}
                style={{ 
                  padding: '0.5rem 1rem', 
                  background: 'var(--ec-bg)', 
                  border: '1px solid var(--ec-border)', 
                  borderRadius: '0.25rem', 
                  cursor: 'pointer' 
                }}
              >
                Close
              </button>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <strong>Invoice Reference:</strong> {partialPaymentModal.ref}
              </div>
              <div>
                <strong>Total Amount:</strong> {formatMoney(partialPaymentModal.amount, partialPaymentModal.currency)}
              </div>
              <div>
                <strong>Amount Paid:</strong> {formatMoney(partialPaymentModal.amountPaid, partialPaymentModal.currency)}
              </div>
              <div>
                <strong>Balance Due:</strong> {formatMoney(partialPaymentModal.balanceDue, partialPaymentModal.currency)}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Payment Amount
                </label>
                <input
                  type="number"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  max={partialPaymentModal.balanceDue}
                  min="0"
                  step="0.01"
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    border: '1px solid var(--ec-border)', 
                    borderRadius: '0.25rem' 
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Payment Channel
                </label>
                <InventoryFilterSelect
                  value={paymentChannel}
                  onChange={setPaymentChannel}
                  options={[
                    { value: 'bank_transfer', label: 'Bank Transfer' },
                    { value: 'mobile_money', label: 'Mobile Money' },
                    { value: 'cash', label: 'Cash' },
                    { value: 'check', label: 'Check' },
                    { value: 'credit_card', label: 'Credit Card' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    border: '1px solid var(--ec-border)', 
                    borderRadius: '0.25rem' 
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Payment Deadline
                </label>
                <input
                  type="date"
                  value={paymentDeadline}
                  onChange={(e) => setPaymentDeadline(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    border: '1px solid var(--ec-border)', 
                    borderRadius: '0.25rem' 
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Payment Proof (PDF/Image)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setPaymentProofFile(e.target.files?.[0])}
                  disabled={uploadingProof}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    border: '1px solid var(--ec-border)', 
                    borderRadius: '0.25rem' 
                  }}
                />
                {paymentProofFile && (
                  <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--ec-muted)' }}>
                    Selected: {paymentProofFile.name}
                  </p>
                )}
                {uploadingProof && (
                  <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--ec-primary)' }}>
                    Uploading payment proof...
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePartialPayment}
                disabled={paying || !partialAmount || Number(partialAmount) <= 0}
                style={{ 
                  padding: '0.75rem 1.5rem', 
                  background: 'var(--ec-primary)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '0.25rem', 
                  cursor: paying ? 'not-allowed' : 'pointer',
                  opacity: paying || !partialAmount || Number(partialAmount) <= 0 ? 0.5 : 1,
                  fontWeight: 600
                }}
              >
                {paying ? 'Processing...' : 'Process Partial Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <DocumentViewerModal
        open={Boolean(acctDocPreview?.url)}
        title={acctDocPreview?.title}
        url={acctDocPreview?.url}
        onClose={() => setAcctDocPreview(null)}
      />
    </>
  );
}

function vendorReportStatusFromInvoice(inv) {
  if (inv.status === 'rejected') return 'rejected';
  if (inv.status === 'partiallyPaid') return 'partial';
  if (inv.status === 'creditPurchase') return 'creditPurchase';
  if (['paid', 'deliveryNoteAttached', 'closed'].includes(inv.status)) return 'paid';
  return 'pending';
}

function invoicesToVendorReportRows(invoices, users, requisitions) {
  const byId = new Map(users.map((u) => [String(u.id), u]));
  const reqById = new Map((requisitions || []).map((r) => [String(r.id), r]));
  return (invoices || [])
    .filter((inv) => inv.type === 'proforma' && isProformaVisibleToAccountantAfterClerk(inv, requisitions || []))
    .map((inv) => {
      const supplierUser = byId.get(String(inv.supplierId || ''));
      const reqDoc = reqById.get(String(inv.requisitionId || ''));
      const status = vendorReportStatusFromInvoice(inv);
      const amt = Number(inv.amount || 0);
      const amtPaid = Number(inv.amountPaid || 0);
      const balanceDue = status === 'paid' ? 0 : ['partial', 'creditPurchase'].includes(status) ? Math.max(0, amt - amtPaid) : status === 'pending' ? amt : 0;
      const atMs = new Date(inv.updatedAt || inv.createdAt || Date.now()).getTime();
      return {
        id: inv.id,
        initials: initialsFor(inv.supplierName),
        vendor: inv.supplierName || supplierUser?.companyName || 'Supplier',
        type: 'Proforma',
        transactionId: inv.reference || inv.id,
        date: new Date(atMs).toLocaleDateString(),
        atMs,
        amount: amt,
        amountPaid: amtPaid,
        status,
        balanceDue,
        location: reqDoc?.location || '',
        supplierEmail: supplierUser?.email || '',
        proformaUrl: inv.attachmentUrl || '',
        deliveryNoteUrl: inv.deliveryNoteUrl || '',
        finalInvoiceUrl: inv.finalInvoiceUrl || '',
        invoiceId: inv.id,
      };
    });
}

export function AccountantReports() {
  const { t } = useI18n();
  const { state, recordPartialPayment } = usePortalData();
  const { flash } = useFlash();
  const [filter, setFilter] = useState('all');
  const [vendorSearch, setVendorSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Set default date range to current month (1st to last day)
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(firstDay.toISOString().split('T')[0]);
    setDateTo(lastDay.toISOString().split('T')[0]);
  }, []);
  const [showFinancialSummary, setShowFinancialSummary] = useState(false);
  const [showPaymentTracking, setShowPaymentTracking] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showAdvancedReports, setShowAdvancedReports] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const sourceRows = useMemo(
    () => invoicesToVendorReportRows(state.invoices, state.users, state.requisitions),
    [state.invoices, state.users, state.requisitions]
  );

  // Derive available branches from requisitions
  const branches = useMemo(
    () => ['all', ...new Set((state.requisitions || []).map((r) => r.location).filter(Boolean)).values()],
    [state.requisitions]
  );

  const spendTypes = useMemo(() => [...new Set(sourceRows.map((x) => x.type))].sort(), [sourceRows]);

  const rows = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
    return sourceRows.filter((entry) => {
      if (filter !== 'all' && entry.status !== filter) return false;
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      if (branchFilter !== 'all' && entry.location !== branchFilter) return false;
      if (entry.atMs < fromMs || entry.atMs > toMs) return false;
      if (q && !`${entry.vendor} ${entry.transactionId} ${entry.type} ${entry.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sourceRows, filter, typeFilter, vendorSearch, branchFilter, dateFrom, dateTo]);

  const vendorPager = usePagedList(rows, { resetKey: `${filter}|${typeFilter}|${vendorSearch}|${branchFilter}|${dateFrom}|${dateTo}` });

  // Payment category summaries (across ALL invoices, not just filtered)
  const paidRows = useMemo(() => sourceRows.filter((r) => r.status === 'paid'), [sourceRows]);
  const unpaidRows = useMemo(() => sourceRows.filter((r) => r.status === 'pending'), [sourceRows]);
  const partialRows = useMemo(() => sourceRows.filter((r) => r.status === 'partial'), [sourceRows]);
  const creditRows = useMemo(() => sourceRows.filter((r) => r.status === 'creditPurchase'), [sourceRows]);

  // Filter rows by selected card and date range
  const cardFilteredRows = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
    
    let filtered = [];
    if (selectedCard === 'paid') {
      filtered = paidRows.filter((r) => r.atMs >= fromMs && r.atMs <= toMs);
    } else if (selectedCard === 'unpaid') {
      filtered = unpaidRows.filter((r) => r.atMs >= fromMs && r.atMs <= toMs);
    } else if (selectedCard === 'partial') {
      filtered = partialRows.filter((r) => r.atMs >= fromMs && r.atMs <= toMs);
    } else if (selectedCard === 'credit') {
      filtered = creditRows.filter((r) => r.atMs >= fromMs && r.atMs <= toMs);
    } else {
      filtered = [];
    }
    return filtered;
  }, [selectedCard, paidRows, unpaidRows, partialRows, creditRows, dateFrom, dateTo]);

  const paidTotal = useMemo(() => paidRows.reduce((s, r) => s + r.amount, 0), [paidRows]);
  const unpaidTotal = useMemo(() => unpaidRows.reduce((s, r) => s + r.amount, 0), [unpaidRows]);
  const partialTotal = useMemo(() => partialRows.reduce((s, r) => s + r.balanceDue, 0), [partialRows]);
  const creditTotal = useMemo(() => creditRows.reduce((s, r) => s + r.balanceDue, 0), [creditRows]);



  const rowSum = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);
  const paidN = useMemo(() => rows.filter((r) => r.status === 'paid').length, [rows]);
  const paidPct = rows.length ? Math.round((paidN / rows.length) * 100) : 0;
  const statusSlices = useMemo(() => {
    const m = { paid: 0, partial: 0, creditPurchase: 0, pending: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status === 'paid') m.paid += 1;
      else if (r.status === 'partial') m.partial += 1;
      else if (r.status === 'creditPurchase') m.creditPurchase += 1;
      else if (r.status === 'pending') m.pending += 1;
      else if (r.status === 'rejected') m.rejected += 1;
    }
    return [
      { name: 'Paid', value: m.paid, color: '#16a34a' },
      { name: 'Partial', value: m.partial, color: '#2563eb' },
      { name: 'Credit Purchase', value: m.creditPurchase, color: '#8b5cf6' },
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

  const outstandingTotal = useMemo(() => rows.reduce((s, r) => s + Number(r.balanceDue || 0), 0), [rows]);
  const mtdPaidTotal = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return rows.reduce((s, r) => {
      if (r.status !== 'paid') return s;
      if ((r.atMs || 0) < start) return s;
      return s + Number(r.amount || 0);
    }, 0);
  }, [rows]);
  const outstandingMtdCombined = outstandingTotal + mtdPaidTotal;
  const outstandingSharePct = outstandingMtdCombined > 0 ? Math.round((outstandingTotal / outstandingMtdCombined) * 100) : 0;

  // Financial summary data
  const financialSummary = useMemo(() => {
    const totalInvoices = state.invoices.length;
    const totalAmount = state.invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const paidAmount = state.invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const pendingAmount = state.invoices.filter((inv) => inv.status === 'pending').reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const rejectedAmount = state.invoices.filter((inv) => inv.status === 'rejected').reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    
    return {
      totalInvoices,
      totalAmount,
      paidAmount,
      pendingAmount,
      rejectedAmount,
      paymentRate: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0,
    };
  }, [state.invoices]);

  // Monthly financial data
  const monthlyFinancialData = useMemo(() => {
    const monthMap = new Map();
    state.invoices.forEach((inv) => {
      const date = new Date(inv.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          invoiceCount: 0,
        });
      }
      const data = monthMap.get(monthKey);
      data.totalAmount += Number(inv.amount || 0);
      data.invoiceCount += 1;
      if (inv.status === 'paid') {
        data.paidAmount += Number(inv.amount || 0);
      } else if (inv.status === 'pending') {
        data.pendingAmount += Number(inv.amount || 0);
      }
    });
    return [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [state.invoices]);

  const filteredMonthlyData = useMemo(() => {
    if (selectedMonth === 'all') return monthlyFinancialData;
    return monthlyFinancialData.filter((m) => m.month === selectedMonth);
  }, [monthlyFinancialData, selectedMonth]);

  // Payment tracking data
  const paymentTracking = useMemo(() => {
    return state.invoices
      .filter((inv) => inv.status === 'pending')
      .map((inv) => {
        const req = state.requisitions.find((r) => r.id === inv.requisitionId);
        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber || 'N/A',
          amount: Number(inv.amount || 0),
          dueDate: inv.dueDate || 'N/A',
          supplierName: req?.supplierName || 'Unknown',
          createdAt: inv.createdAt,
        };
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [state.invoices, state.requisitions]);

  const filteredPaymentTracking = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return paymentTracking;
    return paymentTracking.filter((p) => 
      `${p.invoiceNumber} ${p.supplierName}`.toLowerCase().includes(q)
    );
  }, [paymentTracking, paymentSearch]);

  function downloadPaidInvoices() {
    const aoa = [
      ['Transaction ID', 'Supplier', 'Branch / Location', 'Amount (RWF)', 'Amount Paid (RWF)', 'Date'],
      ...paidRows.map((r) => [r.transactionId, r.vendor, r.location || '—', r.amount, r.amountPaid, r.date]),
    ];
    downloadAoAAsXlsx(`paid-invoices-${new Date().toISOString().slice(0, 10)}`, aoa, 'Paid Invoices');
  }

  function downloadUnpaidInvoices() {
    const aoa = [
      ['Transaction ID', 'Supplier', 'Branch / Location', 'Amount (RWF)', 'Balance Due (RWF)', 'Date'],
      ...unpaidRows.map((r) => [r.transactionId, r.vendor, r.location || '—', r.amount, r.balanceDue, r.date]),
    ];
    downloadAoAAsXlsx(`unpaid-invoices-${new Date().toISOString().slice(0, 10)}`, aoa, 'Unpaid Invoices');
  }

  function downloadPartialInvoices() {
    const aoa = [
      ['Transaction ID', 'Supplier', 'Branch / Location', 'Total Amount (RWF)', 'Amount Paid (RWF)', 'Balance Remaining (RWF)', 'Date'],
      ...partialRows.map((r) => [r.transactionId, r.vendor, r.location || '—', r.amount, r.amountPaid, r.balanceDue, r.date]),
    ];
    downloadAoAAsXlsx(`partial-payments-${new Date().toISOString().slice(0, 10)}`, aoa, 'Partial Payments');
  }

  function downloadCreditInvoices() {
    const aoa = [
      ['Transaction ID', 'Supplier', 'Branch / Location', 'Amount (RWF)', 'Date'],
      ...creditRows.map((r) => [r.transactionId, r.vendor, r.location || '—', r.amount, r.date]),
    ];
    downloadAoAAsXlsx(`credit-purchases-${new Date().toISOString().slice(0, 10)}`, aoa, 'Credit Purchases');
  }

  async function handlePartialPay(entry) {
    const input = window.prompt(
      `Record a partial payment for ${entry.vendor}\n(${entry.transactionId})\nInvoice total: ${formatMoney(entry.amount)}\nAlready paid: ${formatMoney(entry.amountPaid)}\nBalance due: ${formatMoney(entry.balanceDue)}\n\nEnter amount paid now (RWF):`
    );
    if (!input) return;
    const amount = Number(input.replace(/[^0-9.]/g, ''));
    if (!amount || amount <= 0) {
      flash('Please enter a valid positive amount.', 'error');
      return;
    }
    try {
      await recordPartialPayment(entry.invoiceId, amount);
      flash(`Payment of ${formatMoney(amount)} recorded.`, 'ok');
    } catch (err) {
      flash(err?.message || 'Failed to record payment.', 'error');
    }
  }

  function downloadFinancialSummary() {

    const aoa = [
      ['Metric', 'Value'],
      ['Total Invoices', financialSummary.totalInvoices],
      ['Total Amount (RWF)', financialSummary.totalAmount.toLocaleString()],
      ['Paid Amount (RWF)', financialSummary.paidAmount.toLocaleString()],
      ['Pending Amount (RWF)', financialSummary.pendingAmount.toLocaleString()],
      ['Rejected Amount (RWF)', financialSummary.rejectedAmount.toLocaleString()],
      ['Payment Rate', `${financialSummary.paymentRate}%`],
    ];
    downloadAoAAsXlsx(`financial-summary-${new Date().toISOString().slice(0, 10)}`, aoa, 'Financial Summary');
  }

  function downloadMonthlyReport() {
    const aoa = [
      ['Month', 'Total Amount (RWF)', 'Paid Amount (RWF)', 'Pending Amount (RWF)', 'Invoice Count'],
      ...filteredMonthlyData.map((m) => [
        m.month,
        m.totalAmount.toLocaleString(),
        m.paidAmount.toLocaleString(),
        m.pendingAmount.toLocaleString(),
        m.invoiceCount,
      ]),
    ];
    downloadAoAAsXlsx(`monthly-financial-report-${new Date().toISOString().slice(0, 10)}`, aoa, 'Monthly Financial Report');
  }

  function downloadPaymentTracking() {
    const aoa = [
      ['Invoice ID', 'Invoice Number', 'Amount (RWF)', 'Due Date', 'Supplier Name', 'Created Date'],
      ...paymentTracking.map((p) => [
        p.invoiceId,
        p.invoiceNumber,
        p.amount.toLocaleString(),
        p.dueDate,
        p.supplierName,
        formatDate(p.createdAt),
      ]),
    ];
    downloadAoAAsXlsx(`payment-tracking-${new Date().toISOString().slice(0, 10)}`, aoa, 'Payment Tracking');
  }

  function vendorStatusLabel(status) {
    if (status === 'paid') return 'Paid';
    if (status === 'partial') return 'Partial';
    if (status === 'approved') return 'Approved';
    if (status === 'pending') return 'Pending';
    return 'Rejected';
  }

  function vendorStatusTone(status) {
    if (status === 'paid') return ui.accountantVendorBadgeApproved;
    if (status === 'partial') return ui.accountantVendorBadgePartial;
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
              <strong>{paidPct}%</strong>
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

      {/* Payment Status Overview */}
      <div className={ui.reportPaymentOverview}>
        <section 
          className={ui.reportPaymentCard} 
          style={{ borderLeft: '4px solid #16a34a', cursor: 'pointer' }}
          onClick={() => setSelectedCard(selectedCard === 'paid' ? null : 'paid')}
        >
          <div className={ui.reportPaymentCardTop}>
            <span className={ui.reportPaymentCardLabel}>Paid Invoices</span>
            <button type="button" className={ui.analyticsDownloadBtn} onClick={(e) => { e.stopPropagation(); downloadPaidInvoices(); }}>
              ↓ Download
            </button>
          </div>
          <strong className={ui.reportPaymentCardAmount}>{formatMoney(paidTotal)}</strong>
          <span className={ui.reportPaymentCardCount}>{paidRows.length} invoice{paidRows.length !== 1 ? 's' : ''}</span>
        </section>

        <section 
          className={ui.reportPaymentCard} 
          style={{ borderLeft: '4px solid #ca8a04', cursor: 'pointer' }}
          onClick={() => setSelectedCard(selectedCard === 'unpaid' ? null : 'unpaid')}
        >
          <div className={ui.reportPaymentCardTop}>
            <span className={ui.reportPaymentCardLabel}>Outstanding / Unpaid</span>
            <button type="button" className={ui.analyticsDownloadBtn} onClick={(e) => { e.stopPropagation(); downloadUnpaidInvoices(); }}>
              ↓ Download
            </button>
          </div>
          <strong className={ui.reportPaymentCardAmount}>{formatMoney(unpaidTotal)}</strong>
          <span className={ui.reportPaymentCardCount}>{unpaidRows.length} invoice{unpaidRows.length !== 1 ? 's' : ''}</span>
        </section>

        <section 
          className={ui.reportPaymentCard} 
          style={{ borderLeft: '4px solid #2563eb', cursor: 'pointer' }}
          onClick={() => setSelectedCard(selectedCard === 'partial' ? null : 'partial')}
        >
          <div className={ui.reportPaymentCardTop}>
            <span className={ui.reportPaymentCardLabel}>Partially Paid</span>
            <button type="button" className={ui.analyticsDownloadBtn} onClick={(e) => { e.stopPropagation(); downloadPartialInvoices(); }}>
              ↓ Download
            </button>
          </div>
          <strong className={ui.reportPaymentCardAmount}>{formatMoney(partialTotal)}</strong>
          <span className={ui.reportPaymentCardCount}>{partialRows.length} invoice{partialRows.length !== 1 ? 's' : ''} · remaining balance</span>
        </section>

        <section 
          className={ui.reportPaymentCard} 
          style={{ borderLeft: '4px solid #8b5cf6', cursor: 'pointer' }}
          onClick={() => setSelectedCard(selectedCard === 'credit' ? null : 'credit')}
        >
          <div className={ui.reportPaymentCardTop}>
            <span className={ui.reportPaymentCardLabel}>Credit Purchase</span>
            <button type="button" className={ui.analyticsDownloadBtn} onClick={(e) => { e.stopPropagation(); downloadCreditInvoices(); }}>
              ↓ Download
            </button>
          </div>
          <strong className={ui.reportPaymentCardAmount}>{formatMoney(creditTotal)}</strong>
          <span className={ui.reportPaymentCardCount}>{creditRows.length} invoice{creditRows.length !== 1 ? 's' : ''}</span>
        </section>
      </div>

      {/* Card Detail View */}
      {selectedCard && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--ec-bg)', borderRadius: '0.5rem', border: '1px solid var(--ec-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>
              {selectedCard === 'paid' ? 'Paid Invoices' : selectedCard === 'unpaid' ? 'Outstanding / Unpaid' : selectedCard === 'partial' ? 'Partially Paid' : 'Credit Purchase'}
            </h3>
            <button type="button" onClick={() => setSelectedCard(null)} style={{ padding: '0.5rem 1rem', background: 'var(--ec-bg)', border: '1px solid var(--ec-border)', borderRadius: '0.25rem', cursor: 'pointer' }}>
              Close
            </button>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--ec-muted)' }}>
            Showing {cardFilteredRows.length} invoices from {dateFrom} to {dateTo}
          </p>
          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: '0.375rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                <tr>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Invoice Number</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Supplier</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Amount (RWF)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Date</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid var(--ec-border)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {cardFilteredRows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--ec-border)' }}>
                    <td style={{ padding: '0.5rem' }}>{row.transactionId}</td>
                    <td style={{ padding: '0.5rem' }}>{row.vendor}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{row.amount.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem' }}>{row.date}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '0.25rem', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        backgroundColor: selectedCard === 'paid' ? 'rgb(34 197 94)' : selectedCard === 'unpaid' ? 'rgb(202 138 4)' : selectedCard === 'partial' ? 'rgb(37 99 235)' : 'rgb(139 92 246)',
                        color: 'white'
                      }}>
                        {selectedCard === 'paid' ? 'Paid' : selectedCard === 'unpaid' ? 'Outstanding' : selectedCard === 'partial' ? 'Partially Paid' : 'Credit Purchase'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advanced Reports Section */}
      <section className={ui.analyticsLogCard}>
        <div className={ui.analyticsSectionHead}>
          <h2 className={ui.analyticsSectionTitle}>Advanced Reports</h2>
          <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowAdvancedReports(!showAdvancedReports)}>
            {showAdvancedReports ? 'Hide' : 'Show'}
          </button>
        </div>
        {showAdvancedReports && (
          <div className={ui.accountantVendorStats}>
        {/* Financial Summary Section */}
        <section className={ui.accountantVendorStatCard}>
          <div className={ui.analyticsSectionHead}>
            <p className={ui.accountantVendorStatLabel}>Financial Summary</p>
            <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowFinancialSummary(!showFinancialSummary)}>
              {showFinancialSummary ? 'Hide' : 'Show'}
            </button>
          </div>
          {showFinancialSummary && (
            <div style={{ marginTop: '1rem' }}>
              <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadFinancialSummary}>
                Download Summary
              </button>
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Total Invoices</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem' }}>{financialSummary.totalInvoices}</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Total Amount</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem' }}>{financialSummary.totalAmount.toLocaleString()} RWF</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Paid Amount</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem', color: 'rgb(34 197 94)' }}>{financialSummary.paidAmount.toLocaleString()} RWF</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Pending Amount</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem', color: 'rgb(234 179 8)' }}>{financialSummary.pendingAmount.toLocaleString()} RWF</strong>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--ec-bg)', borderRadius: '0.375rem', border: '1px solid var(--ec-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ec-muted)' }}>Payment Rate</span>
                  <strong style={{ display: 'block', fontSize: '1.25rem' }}>{financialSummary.paymentRate}%</strong>
                </div>
              </div>
            </div>
          )}
        </section>

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
            />
            <div className={ui.analyticsDonutLabel}>
              <strong>{paidPct}%</strong>
              <span>approved</span>
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
            />
            <div className={ui.analyticsDonutLabel}>
              <strong>{typeSlices[0]?.pct ?? 0}%</strong>
              <span>top type</span>
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
          <div className={ui.accountantVendorOutstandingStack}>
            <div
              className={`${ui.analyticsDonut} ${ui.analyticsDonutLg}`}
              style={{
                background:
                  outstandingMtdCombined > 0
                    ? `conic-gradient(var(--ec-primary) 0% ${outstandingSharePct}%, rgb(226 232 240) ${outstandingSharePct}% 100%)`
                    : 'rgb(226 232 240)',
              }}
              role="img"
              aria-label={`Outstanding share ${outstandingSharePct} percent of outstanding plus month-to-date paid`}
            />
            <div className={ui.analyticsDonutLabel}>
              <strong>{outstandingMtdCombined > 0 ? `${outstandingSharePct}%` : '0%'}</strong>
              <span>share</span>
            </div>
            <div className={ui.accountantVendorOutstandingCopy}>
              <strong className={ui.accountantVendorStatValue}>
                <MoneyFigure
                  value={outstandingTotal}
                  amountClassName={ui.accountantVendorStatAmount}
                  currencyClassName={ui.accountantVendorStatCurrency}
                />
              </strong>
              <p className={ui.accountantVendorStatMeta}>Outstanding · MTD paid below</p>
              <strong className={`${ui.accountantVendorStatValue} ${ui.accountantVendorOutstandingMtd}`}>
                <MoneyFigure
                  value={mtdPaidTotal}
                  amountClassName={ui.accountantVendorStatAmount}
                  currencyClassName={ui.accountantVendorStatCurrency}
                />
              </strong>
            </div>
          </div>
        </section>

        {/* Monthly Financial Report Section */}
        <section className={ui.analyticsLogCard}>
          <div className={ui.analyticsSectionHead}>
            <h2 className={ui.analyticsSectionTitle}>Monthly Financial Report</h2>
            <button type="button" className={ui.analyticsLinkBtn} onClick={() => setShowPaymentTracking(!showPaymentTracking)}>
              {showPaymentTracking ? 'Hide' : 'Show'}
            </button>
          </div>
          {showPaymentTracking && (
            <div style={{ marginTop: '1rem' }}>
              <div className={ui.analyticsFilterToolbar}>
                <InventoryFilterSelect
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  options={[
                    { value: 'all', label: 'All Months' },
                    ...monthlyFinancialData.map((m) => ({ value: m.month, label: m.month })),
                  ]}
                />
                <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadMonthlyReport}>
                  Download Monthly Report
                </button>
              </div>
              <div style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Month</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Total Amount (RWF)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Paid Amount (RWF)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Pending Amount (RWF)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Invoice Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMonthlyData.map((m) => (
                      <tr key={m.month} style={{ borderBottom: '1px solid var(--ec-border)' }}>
                        <td style={{ padding: '0.5rem' }}>{m.month}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.totalAmount.toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: 'rgb(34 197 94)' }}>{m.paidAmount.toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: 'rgb(234 179 8)' }}>{m.pendingAmount.toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.invoiceCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Payment Tracking Section */}
        <section className={ui.analyticsLogCard}>
          <div className={ui.analyticsSectionHead}>
            <h2 className={ui.analyticsSectionTitle}>Payment Tracking (Pending Invoices)</h2>
            <button type="button" className={ui.analyticsDownloadBtn} onClick={downloadPaymentTracking}>
              Download Payment Tracking
            </button>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <div className={ui.analyticsFilterToolbar}>
              <input
                className={ui.portalFilterSearch}
                placeholder="Search invoices..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
              />
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--ec-muted)' }}>
              {filteredPaymentTracking.length} pending invoices
            </p>
            <div style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--ec-border)', borderRadius: '0.375rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--ec-bg)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Invoice Number</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Supplier</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--ec-border)' }}>Amount (RWF)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Due Date</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--ec-border)' }}>Created Date</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid var(--ec-border)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                {filteredPaymentTracking.map((p) => {
                  const dueDate = new Date(p.dueDate);
                  const today = new Date();
                  const isOverdue = dueDate < today;
                  const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={p.invoiceId} style={{ borderBottom: '1px solid var(--ec-border)', backgroundColor: isOverdue ? 'rgba(220, 38, 38, 0.05)' : daysUntilDue <= 7 ? 'rgba(234, 179, 8, 0.05)' : '' }}>
                      <td style={{ padding: '0.5rem' }}>{p.invoiceNumber}</td>
                      <td style={{ padding: '0.5rem' }}>{p.supplierName}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{p.amount.toLocaleString()}</td>
                      <td style={{ padding: '0.5rem', color: isOverdue ? 'rgb(220 38 38)' : daysUntilDue <= 7 ? 'rgb(234 179 8)' : 'inherit' }}>{p.dueDate}</td>
                      <td style={{ padding: '0.5rem' }}>{formatDate(p.createdAt)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        {isOverdue ? (
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgb(220 38 38)', color: 'white', fontSize: '0.7rem', fontWeight: 600 }}>OVERDUE</span>
                        ) : daysUntilDue <= 7 ? (
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgb(234 179 8)', color: 'white', fontSize: '0.7rem', fontWeight: 600 }}>DUE SOON</span>
                        ) : (
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'rgb(34 197 94)', color: 'white', fontSize: '0.7rem', fontWeight: 600 }}>{daysUntilDue} DAYS</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      </div>
      )}
      </section>

      <section className={ui.accountantVendorLedgerCard}>
        <div className={ui.accountantVendorLedgerHead}>
          <h2 className={ui.accountantVendorLedgerTitle}>Recent Transactions</h2>
        </div>

        <div className={ui.accountantVendorFiltersGrid}>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>Search vendors &amp; IDs</span>
            <input
              className={ui.portalFilterSearch}
              placeholder="Vendor, transaction ID, branch…"
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
            />
          </label>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>Status</span>
            <InventoryFilterSelect
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All Transactions' },
                { value: 'paid', label: 'Paid' },
                { value: 'partial', label: 'Partially Paid' },
                { value: 'creditPurchase', label: 'Credit Purchase' },
                { value: 'pending', label: 'Pending / Outstanding' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </label>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>Branch / Location</span>
            <InventoryFilterSelect
              value={branchFilter}
              onChange={setBranchFilter}
              options={branches.map((b) => ({ value: b, label: b === 'all' ? 'All Branches' : b }))}
            />
          </label>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>Spend type</span>
            <InventoryFilterSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'All types' },
                ...spendTypes.map((ty) => ({ value: ty, label: ty })),
              ]}
            />
          </label>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>From date</span>
            <input
              type="date"
              className={ui.accountantVendorSelect}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className={ui.portalFilterField}>
            <span className={ui.portalFilterLabel}>To date</span>
            <input
              type="date"
              className={ui.accountantVendorSelect}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <div className={ui.accountantVendorFilterActions}>
            <ClearFiltersIconButton
              title={t('common.clearFiltersAria')}
              onClick={() => {
                setVendorSearch('');
                setTypeFilter('all');
                setFilter('all');
                setBranchFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
            />
            <span className={ui.portalFilterMeta}>{rows.length} transactions</span>
          </div>
        </div>

        <div className={ui.accountantVendorTableHead}>
          <span>Supplier</span>
          <span>Transaction ID</span>
          <span>Branch</span>
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
                <div className={ui.accountantVendorTransactionId}>
                  <button 
                    type="button" 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--ec-primary)', 
                      cursor: 'pointer', 
                      textDecoration: 'underline', 
                      padding: 0, 
                      font: 'inherit' 
                    }}
                    onClick={() => setSelectedInvoice(entry)}
                  >
                    {entry.invoiceNumber || entry.transactionId}
                  </button>
                </div>
                <div className={ui.accountantVendorDate}>{entry.location || <span style={{color:'var(--ec-muted)',fontStyle:'italic'}}>—</span>}</div>
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
                    <button type="button" className={ui.invoiceDocBtn} onClick={() => openDoc(entry.finalInvoiceUrl)}>
                      Final invoice
                    </button>
                  ) : (
                    <span className={ui.mutedSm}>Not uploaded</span>
                  )}
                </div>
                <div className={ui.invoiceDocBtnRow}>
                  <button type="button" className={ui.invoiceDocBtn} onClick={() => openDoc(entry.proformaUrl)}>
                    Proforma
                  </button>
                  {entry.deliveryNoteUrl ? (
                    <button
                      type="button"
                      className={ui.invoiceDocBtn}
                      onClick={() => openDoc(entry.deliveryNoteUrl)}
                    >
                      Delivery note
                    </button>
                  ) : (
                    <span className={ui.invoiceDocBtnDisabled}>No delivery note</span>
                  )}
                </div>
                <a href={`mailto:${entry.supplierEmail}`} className={ui.accountantVendorLinkBtn}>
                  Contact supplier
                </a>
                {(entry.status === 'pending' || entry.status === 'partial') && (
                  <button
                    type="button"
                    className={ui.analyticsDownloadBtn}
                    style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}
                    onClick={() => handlePartialPay(entry)}
                  >
                    💳 Record Payment
                  </button>
                )}
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

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '0.5rem', 
            maxWidth: '800px', 
            width: '90%', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            padding: '2rem' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Invoice Details</h2>
              <button 
                type="button" 
                onClick={() => setSelectedInvoice(null)}
                style={{ 
                  padding: '0.5rem 1rem', 
                  background: 'var(--ec-bg)', 
                  border: '1px solid var(--ec-border)', 
                  borderRadius: '0.25rem', 
                  cursor: 'pointer' 
                }}
              >
                Close
              </button>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <strong>Invoice Number:</strong> {selectedInvoice.invoiceNumber || selectedInvoice.transactionId}
              </div>
              <div>
                <strong>Supplier:</strong> {selectedInvoice.vendor}
              </div>
              <div>
                <strong>Amount:</strong> {formatMoney(selectedInvoice.amount)} {selectedInvoice.currency}
              </div>
              <div>
                <strong>Status:</strong> {vendorStatusLabel(selectedInvoice.status)}
              </div>
              <div>
                <strong>Date:</strong> {selectedInvoice.date}
              </div>
              <div>
                <strong>Balance Due:</strong> {formatMoney(selectedInvoice.balanceDue)}
              </div>
              {selectedInvoice.paymentChannel && (
                <div>
                  <strong>Payment Channel:</strong> {selectedInvoice.paymentChannel}
                </div>
              )}
              {selectedInvoice.paymentDeadline && (
                <div>
                  <strong>Payment Deadline:</strong> {selectedInvoice.paymentDeadline}
                </div>
              )}
              {selectedInvoice.proformaUrl && (
                <div>
                  <strong>Proforma Invoice:</strong>
                  <button
                    type="button"
                    onClick={() => setAcctDocPreview({ title: 'Proforma Invoice', url: selectedInvoice.proformaUrl })}
                    style={{ marginLeft: '0.5rem', color: 'var(--ec-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    View Document
                  </button>
                </div>
              )}
              {selectedInvoice.finalInvoiceUrl && (
                <div>
                  <strong>Final Invoice:</strong>
                  <button
                    type="button"
                    onClick={() => setAcctDocPreview({ title: 'Final Invoice', url: selectedInvoice.finalInvoiceUrl })}
                    style={{ marginLeft: '0.5rem', color: 'var(--ec-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    View Document
                  </button>
                </div>
              )}
              {selectedInvoice.deliveryNoteUrl && (
                <div>
                  <strong>Delivery Note:</strong>
                  <button
                    type="button"
                    onClick={() => setAcctDocPreview({ title: 'Delivery Note', url: selectedInvoice.deliveryNoteUrl })}
                    style={{ marginLeft: '0.5rem', color: 'var(--ec-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    View Document
                  </button>
                </div>
              )}
              {selectedInvoice.installments && selectedInvoice.installments.length > 0 && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--ec-border)', paddingTop: '1rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Payment History</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ec-border)' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Amount</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Paid Date</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Due Date</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Payment Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.installments.map((inst, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--ec-border)' }}>
                          <td style={{ padding: '0.5rem' }}>{formatMoney(inst.amount, selectedInvoice.currency)}</td>
                          <td style={{ padding: '0.5rem' }}>
                            {inst.paid ? (
                              <span style={{ color: 'rgb(34 197 94)', fontWeight: 600 }}>Paid</span>
                            ) : (
                              <span style={{ color: 'rgb(234 179 8)', fontWeight: 600 }}>Pending</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {inst.paidAt ? new Date(inst.paidAt).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {inst.paymentProofUrl ? (
                              <button
                                type="button"
                                onClick={() => setAcctDocPreview({ title: 'Payment Proof', url: inst.paymentProofUrl })}
                                style={{ 
                                  padding: '0.25rem 0.5rem', 
                                  background: 'var(--ec-primary)', 
                                  color: 'white', 
                                  border: 'none', 
                                  borderRadius: '0.25rem', 
                                  cursor: 'pointer',
                                  fontSize: '0.75rem'
                                }}
                              >
                                View Proof
                              </button>
                            ) : (
                              <span style={{ color: 'var(--ec-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    <DocumentViewerModal
      open={Boolean(acctDocPreview?.url)}
      title={acctDocPreview?.title}
      url={acctDocPreview?.url}
      onClose={() => setAcctDocPreview(null)}
    />
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
