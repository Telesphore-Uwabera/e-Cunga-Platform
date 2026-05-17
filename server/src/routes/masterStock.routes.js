import { Router } from 'express';
import MasterStockItem from '../models/MasterStockItem.js';
import Requisition from '../models/Requisition.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import Company from '../models/Company.js';
import { cacheMiddleware, clearCache } from '../middleware/cacheMiddleware.js';

const router = Router();

router.use(requireAuth);

/** Buyer orgs treated as healthcare workspace (aligned with client `isHealthcareCompany`). */
function isHealthcareBuyerType(type) {
  const t = String(type ?? 'Healthcare').trim().toLowerCase();
  if (['hospitality', 'retail', 'public', 'public institutions'].includes(t)) return false;
  if (t.startsWith('hospitality') || t.startsWith('retail') || t === 'public institutions') return false;
  return true;
}

/**
 * Healthcare-ecosystem master catalog sorted by how often lines appear on buyer requisitions.
 * Same item shape as GET / — used by healthcare suppliers to mirror clerk-style catalog with demand ranking.
 */
router.get('/trending', cacheMiddleware(120), async (req, res) => {
  try {
    const sector = req.query.sector;
    const days = Math.min(365, Math.max(30, Number(req.query.days) || 120));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const q =
      sector && sector !== 'General'
        ? { sector: { $regex: sector.split('/')[0].trim(), $options: 'i' } }
        : {};
    const items = await MasterStockItem.find(q).sort({ name: 1 }).lean();

    const buyers = await Company.find({ isSupplierCompany: { $ne: true } }).select('_id type').lean();
    const healthcareCompanyIds = buyers.filter((c) => isHealthcareBuyerType(c.type)).map((c) => c._id);

    if (!healthcareCompanyIds.length) {
      return res.json({ masterStock: items });
    }

    const lineAgg = await Requisition.aggregate([
      {
        $match: {
          companyId: { $in: healthcareCompanyIds },
          createdAt: { $gte: since },
          status: { $ne: 'rejected' },
        },
      },
      { $unwind: '$lines' },
      {
        $group: {
          _id: { $toLower: { $trim: { input: { $ifNull: ['$lines.description', ''] } } } },
          requests: { $sum: 1 },
          units: { $sum: { $toDouble: { $ifNull: ['$lines.quantity', 0] } } },
        },
      },
      { $sort: { requests: -1, units: -1 } },
      { $limit: 250 },
    ]);

    const topDesc = lineAgg
      .map((row) => {
        const k = row._id;
        if (!k) return null;
        const sc =
          Number(row.requests || 0) * 2 + Math.min(Number(row.units || 0), 1000) * 0.02;
        return { k, sc };
      })
      .filter(Boolean);

    const descToScore = new Map(topDesc.map((x) => [x.k, x.sc]));

    function scoreItem(m) {
      const name = String(m.name || '').trim().toLowerCase();
      if (!name) return 0;
      let s = descToScore.get(name) || 0;
      for (const { k: d, sc } of topDesc) {
        if (!d || d === name) continue;
        if (d.length >= 3 && name.length >= 3 && (d.includes(name) || name.includes(d))) {
          s += sc * 0.2;
        }
      }
      return s;
    }

    const scored = items.map((m) => ({ m, score: scoreItem(m) }));
    scored.sort((a, b) => b.score - a.score || String(a.m.name).localeCompare(String(b.m.name)));
    res.json({ masterStock: scored.map(({ m }) => m) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch trending master stock.' });
  }
});

// Get items filtered by sector (optional, case-insensitive partial match)
router.get('/', cacheMiddleware(120), async (req, res) => {
  try {
    const sector = req.query.sector;
    // Build query: if sector provided, do a case-insensitive partial match
    // so 'Healthcare / enterprise' matches items with sector 'Healthcare'
    const q = sector && sector !== 'General'
      ? { sector: { $regex: sector.split('/')[0].trim(), $options: 'i' } }
      : {};
    const items = await MasterStockItem.find(q).sort({ name: 1 }).lean();
    res.json({ masterStock: items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch master stock items.' });
  }
});

// Admin only: Add/Update master items
router.post('/', requireRoles('admin'), async (req, res) => {
  try {
    const b = req.body || {};
    const id = b.id || `m_stk_${Date.now()}`;
    
    const fields = {
      name: b.name,
      category: b.category,
      unit: b.unit || 'units',
      sector: b.sector || 'General',
      description: b.description || '',
      suggestedMin: Number(b.suggestedMin) || 10,
      suggestedMax: Number(b.suggestedMax) || 100,
    };

    const item = await MasterStockItem.findOneAndUpdate(
      { _id: id },
      { $set: fields },
      { upsert: true, new: true }
    );

    clearCache('master-stock');
    res.status(201).json({ item });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to save master stock item.' });
  }
});

export default router;
