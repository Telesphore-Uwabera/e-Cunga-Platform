import { Router } from 'express';
import { requireAuth, requireRoles, requirePermission } from '../middleware/auth.js';
import { companyId } from '../lib/utils.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import { emailSupplierLinkedByBuyer } from '../services/supplierLinkNotifications.js';

const router = Router();

// Apply auth to all routes
router.use(requireAuth);

// Get all available suppliers (for supervisors to browse)
router.get('/', requireRoles('supervisor', 'admin'), requirePermission('suppliers:all'), async (req, res) => {
  try {
    const { search, industry, location } = req.query || {};
    const buyerCompanyId = companyId(req);
    const buyerCompany = await Company.findById(buyerCompanyId).select('linkedSupplierCompanyIds').lean();
    const linkedIdSet = new Set((buyerCompany?.linkedSupplierCompanyIds || []).map((id) => String(id)));

    // Build filter for supplier companies
    const companyFilter = { 
      registrationStatus: 'active',
      $or: [
        { isSupplierCompany: true },
        { type: 'Supplier' }
      ]
    };
    
    if (industry) {
      companyFilter.industry = new RegExp(industry, 'i');
    }
    
    // Find supplier companies
    const supplierCompanies = await Company.find(companyFilter)
      .select('name industry location createdAt')
      .sort({ name: 1 })
      .lean();
    
    // Get supplier users for these companies
    const supplierCompanyIds = supplierCompanies.map(c => c._id);
    const supplierUsers = await User.find({
      companyId: { $in: supplierCompanyIds },
      role: 'supplier',
      isActive: true
    })
    .select('companyId fullName email phone location')
    .lean();
    
    // Combine company and user info
    const suppliers = supplierCompanies.map(company => {
      const supplierUser = supplierUsers.find(u => u.companyId.toString() === company._id.toString());
      return {
        id: company._id,
        companyName: company.name,
        industry: company.industry,
        location: company.location || supplierUser?.location || 'Rwanda',
        contactPerson: supplierUser?.fullName || '',
        contactEmail: supplierUser?.email || '',
        contactPhone: supplierUser?.phone || '',
        createdAt: company.createdAt,
        catalogSize: 0, // Will be populated below
        linked: linkedIdSet.has(String(company._id)),
      };
    });
    
    // Filter by search term if provided
    let filteredSuppliers = suppliers;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredSuppliers = suppliers.filter(s => 
        s.companyName.toLowerCase().includes(searchLower) ||
        s.industry.toLowerCase().includes(searchLower) ||
        s.contactPerson.toLowerCase().includes(searchLower) ||
        s.location.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by location if provided
    if (location) {
      filteredSuppliers = filteredSuppliers.filter(s => 
        s.location.toLowerCase().includes(location.toLowerCase())
      );
    }
    
    // Get catalog sizes for each supplier
    const supplierIds = filteredSuppliers.map(s => s.id);
    const catalogCounts = await SupplierCatalogItem.aggregate([
      { $match: { companyId: { $in: supplierIds } } },
      { $group: { _id: '$companyId', count: { $sum: 1 } } }
    ]);
    
    const catalogSizeMap = {};
    catalogCounts.forEach(item => {
      catalogSizeMap[item._id.toString()] = item.count;
    });
    
    // Add catalog sizes to response
    filteredSuppliers = filteredSuppliers.map(supplier => ({
      ...supplier,
      catalogSize: catalogSizeMap[supplier.id.toString()] || 0
    }));
    
    // Also include individual supplier users (not tied to a supplier company)
    // e.g. demo suppliers seeded under the hospital company
    const individualSuppliers = await User.find({
      role: 'supplier',
      isActive: true,
      companyId: { $nin: supplierCompanyIds } // avoid double-counting
    }).select('_id companyId fullName email phone location companyName').lean();

    const individualSupplierEntries = individualSuppliers.map(u => ({
      id: u._id,
      companyName: u.companyName || u.fullName,
      industry: 'Supplier',
      location: u.location || 'Rwanda',
      contactPerson: u.fullName,
      contactEmail: u.email,
      contactPhone: u.phone || '',
      createdAt: u.createdAt,
      catalogSize: 0,
      linked: linkedIdSet.has(String(u.companyId)),
    }));

    // Combine company-based and individual suppliers
    let allSuppliers = [...filteredSuppliers, ...individualSupplierEntries];

    // Apply search filter to combined list
    if (search) {
      const searchLower = search.toLowerCase();
      allSuppliers = allSuppliers.filter(s =>
        (s.companyName || '').toLowerCase().includes(searchLower) ||
        (s.contactPerson || '').toLowerCase().includes(searchLower) ||
        (s.contactEmail || '').toLowerCase().includes(searchLower)
      );
    }

    res.json({
      suppliers: allSuppliers,
      total: allSuppliers.length
    });
  } catch (error) {
    console.error('[supplier-directory] Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch supplier directory.' });
  }
});

// Get supplier details and catalog
router.get('/:supplierId', requireRoles('supervisor', 'admin'), requirePermission('suppliers:all'), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const buyerCompanyId = companyId(req);
    const buyerCo = await Company.findById(buyerCompanyId).select('linkedSupplierCompanyIds').lean();
    const linked = (buyerCo?.linkedSupplierCompanyIds || []).some((id) => String(id) === String(supplierId));

    // Get supplier company info
    const supplierCompany = await Company.findById(supplierId).lean();
    if (!supplierCompany) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    
    // Verify this is a supplier company
    if (!supplierCompany.isSupplierCompany && supplierCompany.type !== 'Supplier') {
      return res.status(404).json({ error: 'Not a supplier company.' });
    }
    
    // Get supplier user info
    const supplierUser = await User.findOne({
      companyId: supplierId,
      role: 'supplier',
      isActive: true
    }).lean();
    
    // Get supplier catalog
    const catalog = await SupplierCatalogItem.find({ companyId: supplierId })
      .sort({ name: 1 })
      .lean();
    
    const supplier = {
      id: supplierCompany._id,
      companyName: supplierCompany.name,
      industry: supplierCompany.industry,
      location: supplierCompany.location || supplierUser?.location || 'Rwanda',
      contactPerson: supplierUser?.fullName || '',
      contactEmail: supplierUser?.email || '',
      contactPhone: supplierUser?.phone || '',
      createdAt: supplierCompany.createdAt,
      catalog,
      linked,
    };

    res.json({ supplier });
  } catch (error) {
    console.error('[supplier-directory] Error fetching supplier details:', error);
    res.status(500).json({ error: 'Failed to fetch supplier details.' });
  }
});

// Connect with a supplier (add to company's preferred suppliers)
router.post('/:supplierId/connect', requireRoles('supervisor', 'admin'), requirePermission('suppliers:all'), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const myCompanyId = companyId(req);

    if (supplierId === myCompanyId) {
      return res.status(400).json({ error: 'Cannot connect your own organization as a supplier.' });
    }

    // Verify supplier exists and is active
    const supplierCompany = await Company.findById(supplierId).lean();
    if (!supplierCompany || supplierCompany.registrationStatus !== 'active') {
      return res.status(404).json({ error: 'Supplier not found or not active.' });
    }
    if (!supplierCompany.isSupplierCompany && supplierCompany.type !== 'Supplier') {
      return res.status(400).json({ error: 'Selected company is not a supplier account.' });
    }

    const buyerCompany = await Company.findById(myCompanyId)
      .select('linkedSupplierCompanyIds name industry')
      .lean();
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
        buyerIndustry: buyerCompany?.industry,
        linkedByName,
      });
    }

    res.json({
      message: `Successfully connected with ${supplierCompany.name}`,
      supplierId,
      supplierName: supplierCompany.name
    });
  } catch (error) {
    console.error('[supplier-directory] Error connecting with supplier:', error);
    res.status(500).json({ error: 'Failed to connect with supplier.' });
  }
});

export default router;
