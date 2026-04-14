import ActivityLog from '../models/ActivityLog.js';
import Invoice from '../models/Invoice.js';
import Requisition from '../models/Requisition.js';
import StockItem from '../models/StockItem.js';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import User from '../models/User.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MS_DAY = 86400000;

/** Percentage 0–100 with one decimal; safe for division by zero. */
export function pct(part, whole) {
  const w = Number(whole);
  const p = Number(part);
  if (!w || w <= 0 || Number.isNaN(w)) return 0;
  if (Number.isNaN(p)) return 0;
  return Math.round((1000 * p) / w) / 10;
}

function sumMapValues(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  return Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);
}

function sumStatuses(map, keys) {
  return keys.reduce((s, k) => s + (Number(map[k]) || 0), 0);
}

function scopeNarrative(scope) {
  switch (scope) {
    case 'clerk':
      return 'Focus on stock levels, expiry pressure, and requisitions. Be practical for warehouse clerks.';
    case 'supervisor':
      return 'Focus on approval queues, requisition status mix, and bottlenecks.';
    case 'accountant':
      return 'Focus on invoice amounts by status, proforma pipeline value, and payment discipline.';
    case 'admin':
      return 'Focus on workspace health: stock risk share, pipeline mix, activity trend, and team size by role.';
    case 'supplier':
      return 'Focus on this supplier’s open buyer invoices vs their total and catalog footprint.';
    default:
      return 'Give concise operational guidance.';
  }
}

export async function buildWorkspaceSnapshot(companyId, scope, userId) {
  const asOf = new Date();
  const asOfIso = asOf.toISOString();
  const t0 = asOf.getTime();
  const startLast7 = new Date(t0 - 7 * MS_DAY);
  const startPrev7 = new Date(t0 - 14 * MS_DAY);

  const [
    stockSkuCount,
    lowStockCount,
    lowStockSamples,
    expiringAgg,
    quantityAgg,
    reqAgg,
    invAgg,
    activityLast7,
    activityPrev7,
    userRoleAgg,
  ] = await Promise.all([
    StockItem.countDocuments({ companyId }),
    StockItem.countDocuments({ companyId, $expr: { $lte: ['$quantity', '$minThreshold'] } }),
    StockItem.find({ companyId, $expr: { $lte: ['$quantity', '$minThreshold'] } })
      .select('name sku quantity minThreshold location category expiryDate')
      .limit(8)
      .lean(),
    StockItem.aggregate([
      { $match: { companyId } },
      {
        $addFields: {
          exp: {
            $dateFromString: { dateString: '$expiryDate', onError: null, onNull: null },
          },
        },
      },
      {
        $match: {
          exp: { $ne: null, $gte: asOf, $lte: new Date(t0 + 30 * MS_DAY) },
        },
      },
      { $count: 'n' },
    ]),
    StockItem.aggregate([
      { $match: { companyId } },
      { $group: { _id: null, totalQty: { $sum: { $ifNull: ['$quantity', 0] } } } },
    ]),
    Requisition.aggregate([
      { $match: { companyId } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: '$status',
          n: { $sum: 1 },
          amountSum: { $sum: { $ifNull: ['$amount', 0] } },
        },
      },
    ]),
    ActivityLog.countDocuments({ companyId, createdAt: { $gte: startLast7 } }),
    ActivityLog.countDocuments({
      companyId,
      createdAt: { $gte: startPrev7, $lt: startLast7 },
    }),
    User.aggregate([
      { $match: { companyId, isActive: true } },
      { $group: { _id: '$role', n: { $sum: 1 } } },
    ]),
  ]);

  const expiringWithin30DaysCount = expiringAgg[0]?.n || 0;
  const totalQuantityOnHand = quantityAgg[0]?.totalQty ?? 0;

  const requisitionsByStatus = Object.fromEntries(reqAgg.map((x) => [String(x._id), x.n]));
  const requisitionTotal = sumMapValues(requisitionsByStatus);

  const invoicesByStatus = Object.fromEntries(invAgg.map((x) => [String(x._id), x.n]));
  const invoiceAmountByStatus = Object.fromEntries(invAgg.map((x) => [String(x._id), Math.round(x.amountSum * 100) / 100]));

  const invoiceTotalCount = sumMapValues(invoicesByStatus);
  const invoiceDraftCount = Number(invoicesByStatus.draft) || 0;
  const invoiceNonDraftCount = Math.max(0, invoiceTotalCount - invoiceDraftCount);
  const invoicePaidCount = Number(invoicesByStatus.paid) || 0;
  const invoiceClosedCount = Number(invoicesByStatus.closed) || 0;
  const invoiceOpenPipelineCount = sumStatuses(invoicesByStatus, [
    'sent',
    'proformaReceived',
    'proformaApproved',
    'deliveryNoteAttached',
  ]);

  const amountPaid = (invoiceAmountByStatus.paid || 0) + (invoiceAmountByStatus.closed || 0);
  const amountNonDraft = Object.entries(invoiceAmountByStatus).reduce((s, [st, amt]) => {
    if (st === 'draft') return s;
    return s + (Number(amt) || 0);
  }, 0);

  const pendingProformaRows = await Invoice.aggregate([
    {
      $match: {
        companyId,
        type: 'proforma',
        status: { $in: ['sent', 'proformaReceived', 'proformaApproved'] },
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
  ]);
  const pendingProformaTotalAmount = Math.round((pendingProformaRows[0]?.total || 0) * 100) / 100;

  const openPipelineAmount = sumStatuses(invoiceAmountByStatus, [
    'sent',
    'proformaReceived',
    'proformaApproved',
    'deliveryNoteAttached',
  ]);

  const usersByRole = Object.fromEntries(userRoleAgg.map((x) => [String(x._id), x.n]));
  const activeUserTotal = sumMapValues(usersByRole);

  const internalReviewReq = sumStatuses(requisitionsByStatus, ['submitted', 'proformaReceived']);
  const atSupplierReq = sumStatuses(requisitionsByStatus, ['sentToSupplier', 'deliveryNoteAttached']);
  const finishedReq = sumStatuses(requisitionsByStatus, ['closed', 'paid']);
  const rejectedReq = Number(requisitionsByStatus.rejected) || 0;

  const metrics = {
    note: 'All percentages below are computed server-side from the database at metrics.asOf; cite these exact values in your advice.',
    asOf: asOfIso,
    stock: {
      skuCount: stockSkuCount,
      lowStockLineCount: lowStockCount,
      lowStockPercentOfSkus: pct(lowStockCount, stockSkuCount),
      expiringWithin30DaysCount,
      expiringPercentOfSkus: pct(expiringWithin30DaysCount, stockSkuCount),
      totalQuantityOnHand: Math.round(totalQuantityOnHand * 100) / 100,
    },
    requisitions: {
      totalCount: requisitionTotal,
      internalReviewCount: internalReviewReq,
      internalReviewPercentOfTotal: pct(internalReviewReq, requisitionTotal),
      atSupplierCount: atSupplierReq,
      atSupplierPercentOfTotal: pct(atSupplierReq, requisitionTotal),
      finishedClosedOrPaidCount: finishedReq,
      finishedPercentOfTotal: pct(finishedReq, requisitionTotal),
      rejectedCount: rejectedReq,
      rejectedPercentOfTotal: pct(rejectedReq, requisitionTotal),
    },
    invoices: {
      totalCount: invoiceTotalCount,
      nonDraftCount: Math.max(0, invoiceNonDraftCount),
      paidOrClosedCount: invoicePaidCount + invoiceClosedCount,
      paidOrClosedPercentOfNonDraft: pct(invoicePaidCount + invoiceClosedCount, invoiceNonDraftCount || 1),
      openPipelineCount: invoiceOpenPipelineCount,
      openPipelinePercentOfNonDraft: pct(invoiceOpenPipelineCount, invoiceNonDraftCount || 1),
      amountPaidOrClosed: Math.round(amountPaid * 100) / 100,
      amountNonDraftTotal: Math.round(amountNonDraft * 100) / 100,
      openPipelineAmount: Math.round(openPipelineAmount * 100) / 100,
      pendingProformaTotalAmount,
      amountPaidShareOfNonDraftPercent: pct(amountPaid, amountNonDraft),
    },
    activity: {
      eventsLast7Days: activityLast7,
      eventsPrevious7Days: activityPrev7,
      percentChangeVsPriorWeek:
        activityPrev7 <= 0 && activityLast7 <= 0
          ? 0
          : activityPrev7 <= 0
            ? 100
            : pct(activityLast7 - activityPrev7, activityPrev7),
    },
    team: {
      activeUsersByRole: usersByRole,
      activeUsersTotal: activeUserTotal,
      adminPercentOfUsers: pct(usersByRole.admin || 0, activeUserTotal),
      clerkPercentOfUsers: pct(usersByRole.clerk || 0, activeUserTotal),
      supervisorPercentOfUsers: pct(usersByRole.supervisor || 0, activeUserTotal),
      accountantPercentOfUsers: pct(usersByRole.accountant || 0, activeUserTotal),
      supplierPercentOfUsers: pct(usersByRole.supplier || 0, activeUserTotal),
    },
  };

  const snapshot = {
    scope,
    asOf: asOfIso,
    metrics,
    lowStockItems: lowStockSamples.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      minThreshold: i.minThreshold,
      location: i.location || '',
      category: i.category || '',
    })),
    requisitionsByStatus,
    invoicesByStatus,
    invoiceAmountByStatus,
    activityEventsLast7Days: activityLast7,
    activityEventsPrevious7Days: activityPrev7,
  };

  if (scope === 'supplier' && userId) {
    const sid = String(userId);
    const [catalogCount, openInvoices, totalSupplierInvoices] = await Promise.all([
      SupplierCatalogItem.countDocuments({ companyId, supplierId: sid }),
      Invoice.countDocuments({
        companyId,
        supplierId: sid,
        status: { $nin: ['closed', 'rejected', 'draft'] },
      }),
      Invoice.countDocuments({ companyId, supplierId: sid }),
    ]);
    snapshot.supplierCatalogItems = catalogCount;
    snapshot.supplierOpenInvoices = openInvoices;
    snapshot.supplierInvoiceTotalCount = totalSupplierInvoices;
    snapshot.metrics.supplier = {
      catalogSkuCount: catalogCount,
      openInvoiceCount: openInvoices,
      totalInvoiceCount: totalSupplierInvoices,
      openInvoicePercentOfTheirs: pct(openInvoices, Math.max(1, totalSupplierInvoices)),
    };
  }

  return snapshot;
}

export async function generateWorkspaceInsight({ snapshot, role, language }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { source: 'disabled', body: null };
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const langNote =
    language === 'kiny'
      ? 'Write the entire answer in Kinyarwanda. Keep professional tone suitable for workplace software.'
      : 'Write in clear, simple English.';

  const system = `You are an advisor inside e-Cunga, an inventory and procurement portal used in Rwanda and similar markets.
${langNote}
${scopeNarrative(snapshot.scope)}

Data rules (critical):
- The JSON includes "metrics": pre-computed counts, sums, and percentages from the live database at metrics.asOf.
- You MUST base quantitative statements ONLY on metrics and the raw count maps (requisitionsByStatus, invoicesByStatus, invoiceAmountByStatus) and sample lists (e.g. lowStockItems).
- When you mention a percentage or ratio, it must exactly match a field under metrics (e.g. metrics.stock.lowStockPercentOfSkus). Do not round differently or invent new percentages.
- If a denominator is zero, metrics percentages will be 0 — say that the dataset is still small instead of guessing.
- You may name specific items only from lowStockItems (sample); do not invent SKUs.
- Output 2–5 short paragraphs separated by a blank line, OR bullet lines starting with "• ". No markdown headings, no code fences.
- Do not mention OpenAI, models, or prompts.
- Role of the reader: ${role}.`;

  const user = `Workspace snapshot JSON:\n${JSON.stringify(snapshot)}`;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: 500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const body = data?.choices?.[0]?.message?.content?.trim() || '';
  if (!body) {
    throw new Error('Empty model response');
  }

  return { source: 'openai', body, model };
}
