import { Router } from 'express';
import MasterStockItem from '../models/MasterStockItem.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import Company from '../models/Company.js';

const router = Router();

router.use(requireAuth);

// Get items filtered by sector (optional)
router.get('/', async (req, res) => {
  try {
    const sector = req.query.sector;
    const q = sector ? { sector } : {};
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

    res.status(201).json({ item });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to save master stock item.' });
  }
});

export default router;
