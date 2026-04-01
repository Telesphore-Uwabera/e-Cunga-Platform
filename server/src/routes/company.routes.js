import { Router } from 'express';
import Company from '../models/Company.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const company = await Company.findById(req.user.companyId).lean();
  if (!company) return res.status(404).json({ error: 'Company not found.' });
  res.json({
    company: {
      id: company._id,
      name: company.name,
      type: company.type,
      industry: company.industry,
      language: company.language,
      currency: company.currency,
      usersLimit: company.usersLimit,
    },
  });
});

router.patch('/', requireRoles('admin'), async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    const b = req.body || {};
    const patch = {};
    if (b.name !== undefined) patch.name = String(b.name).trim();
    if (b.type !== undefined) patch.type = String(b.type);
    if (b.language !== undefined) patch.language = String(b.language);
    if (b.currency !== undefined) patch.currency = String(b.currency);
    if (b.usersLimit !== undefined) {
      const n = Math.max(1, Math.min(500, Number(b.usersLimit) || 10));
      patch.usersLimit = n;
    }
    if (b.industry !== undefined) patch.industry = String(b.industry);

    Object.assign(company, patch);
    await company.save();

    await logActivity(req.user.companyId, req.user.id, 'company.settings.updated', { meta: patch });

    res.json({
      company: {
        id: company._id,
        name: company.name,
        type: company.type,
        industry: company.industry,
        language: company.language,
        currency: company.currency,
        usersLimit: company.usersLimit,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Unable to update company.' });
  }
});

export default router;
