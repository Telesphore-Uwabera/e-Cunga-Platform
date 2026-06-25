import ActivityLog from '../models/ActivityLog.js';
import Consumption from '../models/Consumption.js';
import Invoice from '../models/Invoice.js';
import Requisition from '../models/Requisition.js';
import StockEditRequest from '../models/StockEditRequest.js';
import StockItem from '../models/StockItem.js';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import User from '../models/User.js';

const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
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

function scopeSystemPrompt(scope, langNote) {
  const base = `You are Cunga AI, an expert operational advisor embedded inside e-Cunga — an inventory and procurement portal used by hospitals, clinics, and organisations in Rwanda and similar markets.
${langNote}

YOUR MISSION: Turn raw workspace data into SPECIFIC, ACTIONABLE advice that saves the user time or prevents a real problem TODAY. Never give generic management theory. Always anchor every recommendation to a concrete number from the snapshot.`;

  const focus = {
    clerk: `ROLE FOCUS — Inventory Clerk:
- Flag every low-stock item by name and how far below threshold it is.
- Highlight items expiring within 30 days — name them if available in lowStockItems.
- Point out pending stock edit requests that need supervisor approval.
- Note consumption velocity: if last-7-day usage jumped vs prior week, flag the top category.
- Recommend raising a requisition if critical items are below threshold.
- Keep tone: brief, direct, like a smart colleague handing over the shift.`,

    supervisor: `ROLE FOCUS — Supervisor:
- Lead with the approval queue: how many requisitions need internal review right now.
- Call out any critical-priority requisitions by count — these block the team.
- Flag requisitions stuck at supplier (sentToSupplier/deliveryNoteAttached) for more than expected.
- Mention pending stock edit requests awaiting your approval.
- Summarise team activity trend (up/down vs last week).
- End with the single most important action to unblock the team today.`,

    accountant: `ROLE FOCUS — Accountant:
- Open with total money in the open pipeline (amount outstanding).
- Flag overdue invoices (past due date) by count and total value — this is the top risk.
- Highlight partially-paid invoices that need follow-up.
- Summarise proforma pipeline: how many proformas are awaiting approval and their value.
- Note the paid/closed % as a measure of payment discipline.
- End with what to prioritise: pay, chase, or approve.`,

    admin: `ROLE FOCUS — Admin / Manager:
- Open with workspace health score: combine stock risk, pending approvals, and activity trend.
- Flag if low-stock % is high (>20%) or expiry pressure is elevated.
- Summarise requisition pipeline mix (internal vs at-supplier vs finished).
- Note financial pipeline: open invoice value and overdue invoice risk.
- Comment on team composition and whether the active user count matches expectations.
- Close with 2–3 prioritised actions for the week.`,

    supplier: `ROLE FOCUS — Supplier:
- State open invoice count and what % of your total that represents.
- Flag any invoices that may be stalled (sent but not yet proformaApproved).
- Comment on catalog footprint — is your product count competitive?
- Suggest next action: follow up on specific invoice stages or expand catalog.`,
  };

  return `${base}\n\n${focus[scope] || 'Give concise, actionable operational guidance.'}\n\nOUTPUT FORMAT RULES (CRITICAL — follow exactly):
- Return ONLY valid JSON. No markdown fences, no prose outside the JSON.
- Schema: { "sections": [ { "title": string, "points": [string] } ] }
- 2 to 4 sections. Each section: 1–4 bullet points (strings).
- Each bullet must start with an action verb or a specific metric. Example: "Reorder [Item X] — only 2 units left (threshold: 10)."
- Do NOT mention AI, models, Gemini, or prompts.
- Do NOT invent data. Use ONLY numbers from the provided JSON snapshot.
- If a metric is zero or the dataset is small, say so honestly instead of guessing.`;
}

export async function buildWorkspaceSnapshot(companyId, scope, userId) {
  const asOf = new Date();
  const asOfIso = asOf.toISOString();
  const t0 = asOf.getTime();
  const startLast7 = new Date(t0 - 7 * MS_DAY);
  const startPrev7 = new Date(t0 - 14 * MS_DAY);
  const now = new Date();

  const user = await User.findById(userId).lean();
  const baseFilter = { companyId };
  if (scope === 'clerk' && user) {
    if (user.location) baseFilter.location = user.location;
    if (user.department || user.team) {
      baseFilter.$or = [
        { department: user.department || user.team },
        { team: user.department || user.team },
        { requestingDepartment: user.department || user.team },
      ];
    }
  }

  const [
    stockItems,
    reqAgg,
    reqPriorityAgg,
    invAgg,
    overdueInvoices,
    partialInvoiceAgg,
    activityLast7,
    activityPrev7,
    userRoleAgg,
    consumptionLast7,
    consumptionPrev7,
    pendingStockEdits,
  ] = await Promise.all([
    // Stock
    StockItem.find(baseFilter)
      .select('name sku quantity minThreshold location category expiryDate')
      .lean(),

    // Requisitions by status
    Requisition.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),

    // Requisitions by priority (critical count)
    Requisition.aggregate([
      { $match: { ...baseFilter, status: { $nin: ['closed', 'paid', 'cancelled', 'rejected'] } } },
      { $group: { _id: '$priority', n: { $sum: 1 } } },
    ]),

    // Invoices by status + amount
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

    // Overdue invoices (dueDate in the past, not yet paid/closed/rejected)
    Invoice.aggregate([
      {
        $match: {
          companyId,
          dueDate: { $lt: now },
          status: { $nin: ['paid', 'closed', 'rejected', 'draft', 'creditAndPaid'] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
        },
      },
    ]),

    // Partially paid invoices
    Invoice.aggregate([
      { $match: { companyId, status: 'partiallyPaid' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
          totalPaid: { $sum: { $ifNull: ['$amountPaid', 0] } },
        },
      },
    ]),

    // Activity
    ActivityLog.countDocuments({ companyId, createdAt: { $gte: startLast7 } }),
    ActivityLog.countDocuments({
      companyId,
      createdAt: { $gte: startPrev7, $lt: startLast7 },
    }),

    // Users by role
    User.aggregate([
      { $match: { companyId, isActive: true } },
      { $group: { _id: '$role', n: { $sum: 1 } } },
    ]),

    // Consumption last 7 days
    Consumption.aggregate([
      { $match: { companyId, createdAt: { $gte: startLast7 } } },
      { $group: { _id: null, totalQty: { $sum: '$quantity' }, count: { $sum: 1 } } },
    ]),

    // Consumption prev 7 days
    Consumption.aggregate([
      { $match: { companyId, createdAt: { $gte: startPrev7, $lt: startLast7 } } },
      { $group: { _id: null, totalQty: { $sum: '$quantity' }, count: { $sum: 1 } } },
    ]),

    // Pending stock edit requests
    StockEditRequest.countDocuments({ companyId, status: 'pending' }),
  ]);

  // ── Stock metrics ──────────────────────────────────────────────────────────
  const stockSkuCount = stockItems.length;
  const lowStockItems = stockItems.filter((i) => (i.quantity || 0) <= (i.minThreshold || 0));
  const lowStockCount = lowStockItems.length;
  const lowStockSamples = lowStockItems.slice(0, 10).map((i) => ({
    name: i.name,
    quantity: i.quantity,
    minThreshold: i.minThreshold,
    gap: (i.minThreshold || 0) - (i.quantity || 0),
    location: i.location || '',
    category: i.category || '',
  }));

  let expiringWithin30DaysCount = 0;
  let expiringWithin7DaysCount = 0;
  let totalQuantityOnHand = 0;
  const thirtyDaysFromNow = t0 + 30 * MS_DAY;
  const sevenDaysFromNow = t0 + 7 * MS_DAY;

  const expiringSoonSamples = [];
  for (const i of stockItems) {
    totalQuantityOnHand += i.quantity || 0;
    if (i.expiryDate) {
      const expDate = new Date(i.expiryDate);
      if (!isNaN(expDate.getTime()) && expDate >= asOf) {
        if (expDate.getTime() <= thirtyDaysFromNow) {
          expiringWithin30DaysCount++;
          if (expDate.getTime() <= sevenDaysFromNow && expiringSoonSamples.length < 5) {
            expiringSoonSamples.push({ name: i.name, expiresOn: expDate.toISOString().split('T')[0], qty: i.quantity });
          }
        }
      }
    }
  }

  // ── Requisition metrics ────────────────────────────────────────────────────
  const requisitionsByStatus = Object.fromEntries(reqAgg.map((x) => [String(x._id), x.n]));
  const requisitionTotal = sumMapValues(requisitionsByStatus);
  const reqByPriority = Object.fromEntries(reqPriorityAgg.map((x) => [String(x._id), x.n]));
  const criticalReqCount = Number(reqByPriority.critical) || 0;
  const highPriorityReqCount = Number(reqByPriority.high) || 0;

  const internalReviewReq = sumStatuses(requisitionsByStatus, ['submitted', 'proformaAwaitingClerk', 'proformaReceived']);
  const atSupplierReq = sumStatuses(requisitionsByStatus, ['sentToSupplier', 'deliveryNoteAttached']);
  const finishedReq = sumStatuses(requisitionsByStatus, ['closed', 'paid', 'creditAndPaid']);
  const rejectedReq = Number(requisitionsByStatus.rejected) || 0;
  const partiallyPaidReq = Number(requisitionsByStatus.partiallyPaid) || 0;
  const creditReq = sumStatuses(requisitionsByStatus, ['creditPurchase', 'creditAndPaid']);

  // ── Invoice metrics ────────────────────────────────────────────────────────
  const invoicesByStatus = Object.fromEntries(invAgg.map((x) => [String(x._id), x.n]));
  const invoiceAmountByStatus = Object.fromEntries(invAgg.map((x) => [String(x._id), Math.round(x.amountSum * 100) / 100]));

  const invoiceTotalCount = sumMapValues(invoicesByStatus);
  const invoiceDraftCount = Number(invoicesByStatus.draft) || 0;
  const invoiceNonDraftCount = Math.max(0, invoiceTotalCount - invoiceDraftCount);
  const invoicePaidCount = Number(invoicesByStatus.paid) || 0;
  const invoiceClosedCount = Number(invoicesByStatus.closed) || 0;
  const invoiceOpenPipelineCount = sumStatuses(invoicesByStatus, [
    'sent', 'proformaReceived', 'proformaApproved', 'deliveryNoteAttached',
  ]);

  const amountPaid = (invoiceAmountByStatus.paid || 0) + (invoiceAmountByStatus.closed || 0);
  const amountNonDraft = Object.entries(invoiceAmountByStatus).reduce((s, [st, amt]) => {
    if (st === 'draft') return s;
    return s + (Number(amt) || 0);
  }, 0);

  const openPipelineAmount = sumStatuses(invoiceAmountByStatus, [
    'sent', 'proformaReceived', 'proformaApproved', 'deliveryNoteAttached',
  ]);

  const pendingProformaRows = await Invoice.aggregate([
    {
      $match: {
        companyId,
        type: 'proforma',
        status: { $in: ['sent', 'proformaReceived', 'proformaApproved'] },
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } }, count: { $sum: 1 } } },
  ]);
  const pendingProformaTotalAmount = Math.round((pendingProformaRows[0]?.total || 0) * 100) / 100;
  const pendingProformaCount = pendingProformaRows[0]?.count || 0;

  const overdueCount = overdueInvoices[0]?.count || 0;
  const overdueAmount = Math.round((overdueInvoices[0]?.totalAmount || 0) * 100) / 100;
  const partialCount = partialInvoiceAgg[0]?.count || 0;
  const partialTotalAmount = Math.round((partialInvoiceAgg[0]?.totalAmount || 0) * 100) / 100;
  const partialPaidAmount = Math.round((partialInvoiceAgg[0]?.totalPaid || 0) * 100) / 100;

  // ── Consumption metrics ────────────────────────────────────────────────────
  const consumptionLast7Qty = consumptionLast7[0]?.totalQty || 0;
  const consumptionPrev7Qty = consumptionPrev7[0]?.totalQty || 0;
  const consumptionLast7Count = consumptionLast7[0]?.count || 0;
  const consumptionVelocityChange = consumptionPrev7Qty <= 0 && consumptionLast7Qty <= 0
    ? 0
    : consumptionPrev7Qty <= 0
      ? 100
      : pct(consumptionLast7Qty - consumptionPrev7Qty, consumptionPrev7Qty);

  // ── Team / activity ────────────────────────────────────────────────────────
  const usersByRole = Object.fromEntries(userRoleAgg.map((x) => [String(x._id), x.n]));
  const activeUserTotal = sumMapValues(usersByRole);

  // ── Compose metrics object ─────────────────────────────────────────────────
  const metrics = {
    note: 'All percentages are pre-computed server-side from the live database at metrics.asOf. Cite only these values.',
    asOf: asOfIso,
    stock: {
      skuCount: stockSkuCount,
      lowStockLineCount: lowStockCount,
      lowStockPercentOfSkus: pct(lowStockCount, stockSkuCount),
      expiringWithin7DaysCount,
      expiringWithin30DaysCount,
      expiringPercentOfSkus: pct(expiringWithin30DaysCount, stockSkuCount),
      totalQuantityOnHand: Math.round(totalQuantityOnHand * 100) / 100,
      pendingStockEditRequests: pendingStockEdits,
    },
    consumption: {
      last7DaysQty: Math.round(consumptionLast7Qty * 100) / 100,
      last7DaysEvents: consumptionLast7Count,
      prev7DaysQty: Math.round(consumptionPrev7Qty * 100) / 100,
      velocityChangePercent: consumptionVelocityChange,
    },
    requisitions: {
      totalCount: requisitionTotal,
      criticalCount: criticalReqCount,
      highPriorityCount: highPriorityReqCount,
      internalReviewCount: internalReviewReq,
      internalReviewPercentOfTotal: pct(internalReviewReq, requisitionTotal),
      atSupplierCount: atSupplierReq,
      atSupplierPercentOfTotal: pct(atSupplierReq, requisitionTotal),
      finishedClosedOrPaidCount: finishedReq,
      finishedPercentOfTotal: pct(finishedReq, requisitionTotal),
      rejectedCount: rejectedReq,
      rejectedPercentOfTotal: pct(rejectedReq, requisitionTotal),
      partiallyPaidCount: partiallyPaidReq,
      creditPurchaseCount: creditReq,
    },
    invoices: {
      totalCount: invoiceTotalCount,
      nonDraftCount: invoiceNonDraftCount,
      paidOrClosedCount: invoicePaidCount + invoiceClosedCount,
      paidOrClosedPercentOfNonDraft: pct(invoicePaidCount + invoiceClosedCount, invoiceNonDraftCount || 1),
      openPipelineCount: invoiceOpenPipelineCount,
      openPipelinePercentOfNonDraft: pct(invoiceOpenPipelineCount, invoiceNonDraftCount || 1),
      amountPaidOrClosed: Math.round(amountPaid * 100) / 100,
      amountNonDraftTotal: Math.round(amountNonDraft * 100) / 100,
      openPipelineAmount: Math.round(openPipelineAmount * 100) / 100,
      pendingProformaCount,
      pendingProformaTotalAmount,
      overdueCount,
      overdueAmount,
      partiallyPaidCount: partialCount,
      partiallyPaidTotalAmount: partialTotalAmount,
      partiallyPaidAmountAlreadyPaid: partialPaidAmount,
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
    lowStockItems: lowStockSamples,
    expiringSoon: expiringSoonSamples,
    requisitionsByStatus,
    requisitionsByPriority: reqByPriority,
    invoicesByStatus,
    invoiceAmountByStatus,
    activityEventsLast7Days: activityLast7,
    activityEventsPrevious7Days: activityPrev7,
  };

  // ── Supplier-specific enrichment ───────────────────────────────────────────
  if (scope === 'supplier' && userId) {
    const sid = String(userId);
    const [catalogCount, openInvoices, totalSupplierInvoices, supplierOverdue] = await Promise.all([
      SupplierCatalogItem.countDocuments({ companyId, supplierId: sid }),
      Invoice.countDocuments({
        companyId,
        supplierId: sid,
        status: { $nin: ['closed', 'rejected', 'draft'] },
      }),
      Invoice.countDocuments({ companyId, supplierId: sid }),
      Invoice.countDocuments({
        companyId,
        supplierId: sid,
        dueDate: { $lt: now },
        status: { $nin: ['paid', 'closed', 'rejected', 'draft', 'creditAndPaid'] },
      }),
    ]);
    snapshot.supplierCatalogItems = catalogCount;
    snapshot.supplierOpenInvoices = openInvoices;
    snapshot.supplierInvoiceTotalCount = totalSupplierInvoices;
    snapshot.supplierOverdueInvoices = supplierOverdue;
    snapshot.metrics.supplier = {
      catalogSkuCount: catalogCount,
      openInvoiceCount: openInvoices,
      totalInvoiceCount: totalSupplierInvoices,
      overdueInvoiceCount: supplierOverdue,
      openInvoicePercentOfTheirs: pct(openInvoices, Math.max(1, totalSupplierInvoices)),
    };
  }

  return snapshot;
}

export async function generateWorkspaceInsight({ snapshot, role, language }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { source: 'disabled', body: null, sections: null };
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';
  const langNote =
    language === 'kiny'
      ? 'Write ALL text (section titles and bullet points) in Kinyarwanda. Use professional workplace tone.'
      : 'Write in clear, direct English. Workplace professional tone.';

  const systemPrompt = scopeSystemPrompt(snapshot.scope, langNote);
  const userContent = `Workspace snapshot JSON:\n${JSON.stringify(snapshot)}`;

  const geminiUrl = `${GEMINI_URL_BASE}/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  if (!rawText) throw new Error('Empty model response');

  // Parse structured JSON from Gemini
  let sections = null;
  let body = '';
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed?.sections)) {
      sections = parsed.sections;
      // Also build a flat text body for backward compat / fallback rendering
      body = sections
        .map((s) => `${s.title}\n${(s.points || []).map((p) => `• ${p}`).join('\n')}`)
        .join('\n\n');
    } else {
      body = rawText;
    }
  } catch {
    // Gemini returned plain text despite the mime type — use as-is
    body = rawText;
  }

  return { source: 'gemini', body, sections, model };
}
