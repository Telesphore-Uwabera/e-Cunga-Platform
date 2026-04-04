import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import Company from '../models/Company.js';
import Invoice from '../models/Invoice.js';
import Requisition from '../models/Requisition.js';
import StockItem from '../models/StockItem.js';

const router = express.Router();

/** Actions that reflect inventory / procurement movement (for a simple activity trend). */
const INVENTORY_ACTIVITY_OR = {
  $or: [
    { action: { $regex: /^stock\./ } },
    { action: { $regex: /^invoice\./ } },
    { action: { $regex: /^stock\.request/ } },
    { action: { $regex: /^delivery\./ } },
    { action: { $regex: /^supplier\.catalog/ } },
    { action: { $regex: /^workflow\./ } },
  ],
};

/**
 * GET /api/public/home-stats
 * Aggregate snapshot for the marketing homepage (no auth). Scoped to non-pending companies.
 */
router.get('/home-stats', async (_req, res) => {
  try {
    const companyIds = await Company.find({ registrationStatus: { $ne: 'pending' } }).distinct('_id');
    if (!companyIds.length) {
      return res.json({
        trackedItems: 0,
        pendingApprovals: 0,
        supplierActions: 0,
        trendPercent: null,
        queueHealth: 'stable',
        supplierDocPercent: null,
      });
    }

    const inCompanies = { companyId: { $in: companyIds } };
    const now = Date.now();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const [
      trackedItems,
      pendingApprovals,
      supplierActions,
      activityRecent,
      activityPrior,
      invoiceEligible,
      invoiceWithDocs,
    ] = await Promise.all([
      StockItem.countDocuments(inCompanies),
      Requisition.countDocuments({
        ...inCompanies,
        status: { $in: ['submitted', 'proformaReceived'] },
      }),
      Requisition.countDocuments({
        ...inCompanies,
        status: { $in: ['sentToSupplier', 'deliveryNoteAttached'] },
      }),
      ActivityLog.countDocuments({
        ...inCompanies,
        createdAt: { $gte: d30 },
        ...INVENTORY_ACTIVITY_OR,
      }),
      ActivityLog.countDocuments({
        ...inCompanies,
        createdAt: { $gte: d60, $lt: d30 },
        ...INVENTORY_ACTIVITY_OR,
      }),
      Invoice.countDocuments({
        ...inCompanies,
        supplierId: { $nin: ['', null] },
        status: { $nin: ['draft', 'rejected'] },
      }),
      Invoice.countDocuments({
        ...inCompanies,
        supplierId: { $nin: ['', null] },
        status: { $nin: ['draft', 'rejected'] },
        $or: [
          { deliveryNoteUrl: { $regex: /\S/ } },
          { finalInvoiceUrl: { $regex: /\S/ } },
          { status: { $in: ['deliveryNoteAttached', 'closed', 'paid'] } },
        ],
      }),
    ]);

    let trendPercent = null;
    if (activityRecent + activityPrior > 0) {
      const base = Math.max(activityPrior, 1);
      trendPercent = Math.round(((activityRecent - activityPrior) / base) * 1000) / 10;
    }

    let queueHealth = 'stable';
    if (pendingApprovals > 15) queueHealth = 'elevated';
    else if (pendingApprovals > 5) queueHealth = 'busy';

    let supplierDocPercent = null;
    if (invoiceEligible > 0) {
      supplierDocPercent = Math.round((100 * invoiceWithDocs) / invoiceEligible);
    }

    res.json({
      trackedItems,
      pendingApprovals,
      supplierActions,
      trendPercent,
      queueHealth,
      supplierDocPercent,
    });
  } catch (error) {
    console.error('[public/home-stats]', error);
    res.status(500).json({ error: 'Unable to load stats.' });
  }
});

export default router;
