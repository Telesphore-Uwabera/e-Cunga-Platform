import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformRegistrationAdmin } from '../middleware/platformRegistrationAdmin.js';
import { emailSupervisorCompanyApproved } from '../services/registrationNotifications.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

router.get('/pending-companies', requirePlatformRegistrationAdmin, async (_req, res) => {
  try {
    const companies = await Company.find({ registrationStatus: 'pending' }).sort({ createdAt: -1 }).lean();
    const out = await Promise.all(
      companies.map(async (c) => {
        const u = await User.findOne({ companyId: c._id }).sort({ createdAt: 1 }).select('email fullName').lean();
        return {
          id: c._id,
          name: c.name,
          industry: c.industry,
          createdAt: c.createdAt,
          contactEmail: u?.email || '',
          contactName: u?.fullName || '',
        };
      })
    );
    res.json({ companies: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Unable to load pending registrations.' });
  }
});

router.post('/approve-company', requirePlatformRegistrationAdmin, async (req, res) => {
  try {
    const companyId = String(req.body?.companyId || '').trim();
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required.' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found.' });
    if (company.registrationStatus !== 'pending') {
      return res.status(400).json({ error: 'This company is not awaiting approval.' });
    }

    company.registrationStatus = 'active';
    await company.save();

    await User.updateMany({ companyId }, { $set: { isActive: true } });

    await logActivity(req.user.companyId, req.user.id, 'company.registration.approved', {
      meta: { approvedCompanyId: companyId },
    });

    await emailSupervisorCompanyApproved({ companyId, companyName: company.name }).catch((e) =>
      console.error('[registration] supervisor approval email:', e)
    );

    res.json({ ok: true, companyId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Unable to approve company.' });
  }
});

router.post('/reject-company', requirePlatformRegistrationAdmin, async (req, res) => {
  try {
    const companyId = String(req.body?.companyId || '').trim();
    if (!companyId) return res.status(400).json({ error: 'companyId is required.' });

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found.' });
    if (company.registrationStatus !== 'pending') {
      return res.status(400).json({ error: 'This company is not awaiting approval.' });
    }

    company.registrationStatus = 'rejected';
    await company.save();

    await logActivity(req.user.companyId, req.user.id, 'company.registration.rejected', {
      meta: { rejectedCompanyId: companyId },
    });

    res.json({ ok: true, companyId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Unable to reject company.' });
  }
});

router.patch('/update-company', requirePlatformRegistrationAdmin, async (req, res) => {
  try {
    const { companyId, name, industry } = req.body || {};
    if (!companyId) return res.status(400).json({ error: 'companyId is required.' });

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    if (name) company.name = String(name).trim();
    if (industry) company.industry = String(industry).trim();
    await company.save();

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Unable to update company.' });
  }
});

export default router;
