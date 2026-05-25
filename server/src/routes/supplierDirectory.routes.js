import { Router } from 'express';
import { requireAuth, requireRoles, requirePermission } from '../middleware/auth.js';
import { companyId } from '../lib/utils.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import { emailSupplierLinkedByBuyer } from '../services/supplierLinkNotifications.js';
import { listMarketplaceSuppliers } from '../services/marketplaceSuppliers.js';
import {
  resolveBuyerIndustry,
  resolveCompanyIndustry,
  buyerIndustryDisplay,
  industryDisplayLabel,
} from '../lib/industry.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireRoles('supervisor', 'admin'), requirePermission('suppliers:all'), async (req, res) => {
  try {
    const { search, industry, location } = req.query || {};
    const buyerCompanyId = companyId(req);
    const buyerCompany = await Company.findById(buyerCompanyId)
      .select('linkedSupplierCompanyIds industry name')
      .lean();

    const result = await listMarketplaceSuppliers({
      buyerCompanyId,
      buyerCompany,
      authUser: req.user,
      search,
      industry,
      location,
    });

    res.json(result);
  } catch (error) {
    console.error('[supplier-directory] Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch supplier directory.' });
  }
});

router.get('/:supplierId', requireRoles('supervisor', 'admin'), requirePermission('suppliers:all'), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const buyerCompanyId = companyId(req);
    const buyerCo = await Company.findById(buyerCompanyId).select('linkedSupplierCompanyIds industry').lean();
    const linked = (buyerCo?.linkedSupplierCompanyIds || []).some((id) => String(id) === String(supplierId));
    const buyerNorm = resolveBuyerIndustry(buyerCo, req.user);

    const supplierCompany = await Company.findById(supplierId).lean();
    if (!supplierCompany) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    if (!supplierCompany.isSupplierCompany && supplierCompany.type !== 'Supplier') {
      return res.status(404).json({ error: 'Not a supplier company.' });
    }

    const supplierUser = await User.findOne({
      companyId: supplierId,
      role: 'supplier',
      isActive: true,
    }).lean();

    if (!supplierUser) {
      return res.status(404).json({ error: 'Supplier has no active contact account.' });
    }

    const supplierNorm = resolveCompanyIndustry(supplierCompany, supplierUser);
    if (buyerNorm && supplierNorm !== buyerNorm) {
      return res.status(403).json({ error: 'Access denied. Supplier is in a different industry.' });
    }

    const catalog = await SupplierCatalogItem.find({ companyId: supplierId }).sort({ name: 1 }).lean();

    const supplier = {
      id: supplierCompany._id,
      companyName: supplierCompany.name,
      industry:
        industryDisplayLabel(supplierNorm) ||
        industryDisplayLabel(supplierCompany.industry) ||
        industryDisplayLabel(supplierUser.industry) ||
        '',
      location: supplierCompany.location || supplierUser?.location || 'Rwanda',
      contactPerson: supplierUser?.fullName || '',
      contactEmail: supplierUser?.email || '',
      contactPhone: supplierUser?.phone || '',
      createdAt: supplierCompany.createdAt,
      catalog,
      linked,
    };

    res.json({ supplier, buyerIndustry: buyerIndustryDisplay(buyerCo, req.user) });
  } catch (error) {
    console.error('[supplier-directory] Error fetching supplier details:', error);
    res.status(500).json({ error: 'Failed to fetch supplier details.' });
  }
});

router.post('/:supplierId/connect', requireRoles('supervisor', 'admin'), requirePermission('suppliers:all'), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const myCompanyId = companyId(req);

    if (supplierId === myCompanyId) {
      return res.status(400).json({ error: 'Cannot connect your own organization as a supplier.' });
    }

    const supplierCompany = await Company.findById(supplierId).lean();
    if (!supplierCompany || supplierCompany.registrationStatus !== 'active') {
      return res.status(404).json({ error: 'Supplier not found or not active.' });
    }
    if (!supplierCompany.isSupplierCompany && supplierCompany.type !== 'Supplier') {
      return res.status(400).json({ error: 'Selected company is not a supplier account.' });
    }

    const supplierUser = await User.findOne({
      companyId: supplierId,
      role: 'supplier',
      isActive: true,
    }).lean();

    if (!supplierUser) {
      return res.status(400).json({ error: 'Supplier has no active contact account to connect with.' });
    }

    const buyerCompany = await Company.findById(myCompanyId)
      .select('linkedSupplierCompanyIds name industry')
      .lean();

    const buyerNorm = resolveBuyerIndustry(buyerCompany, req.user);
    const supplierNorm = resolveCompanyIndustry(supplierCompany, supplierUser);

    if (buyerNorm && supplierNorm !== buyerNorm) {
      return res.status(400).json({ error: 'Cannot connect to a supplier from a different industry.' });
    }

    if (!buyerNorm && supplierNorm) {
      return res.status(400).json({
        error: 'Set your organization industry in company settings before connecting to suppliers.',
      });
    }

    const alreadyLinked = buyerCompany?.linkedSupplierCompanyIds?.some(
      (id) => String(id) === String(supplierId)
    );

    await Company.updateOne(
      { _id: myCompanyId },
      { $addToSet: { linkedSupplierCompanyIds: supplierId } }
    );

    if (!alreadyLinked) {
      const supplierUsers = await User.find({
        companyId: supplierId,
        role: 'supplier',
        isActive: true,
      })
        .select('email fullName')
        .lean();

      const seen = new Set();
      const recipients = [];
      for (const u of supplierUsers) {
        const e = String(u.email || '').trim().toLowerCase();
        if (!e || seen.has(e)) continue;
        seen.add(e);
        recipients.push({ email: String(u.email).trim(), fullName: u.fullName });
      }

      const linkedByName = req.user?.fullName ? String(req.user.fullName).trim() : '';
      await emailSupplierLinkedByBuyer({
        recipients,
        supplierCompanyName: supplierCompany.name || 'Your organization',
        buyerCompanyName: buyerCompany?.name || 'A buyer organization',
        buyerIndustry: buyerIndustryDisplay(buyerCompany, req.user) || buyerCompany?.industry,
        linkedByName,
      });
    }

    res.json({
      message: `Successfully connected with ${supplierCompany.name}`,
      supplierId,
      supplierName: supplierCompany.name,
    });
  } catch (error) {
    console.error('[supplier-directory] Error connecting with supplier:', error);
    res.status(500).json({ error: 'Failed to connect with supplier.' });
  }
});

export default router;
