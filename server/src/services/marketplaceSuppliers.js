import User from '../models/User.js';
import Company from '../models/Company.js';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import {
  resolveBuyerIndustry,
  resolveCompanyIndustry,
  normalizeIndustry,
  industryDisplayLabel,
  buyerIndustryDisplay,
} from '../lib/industry.js';

function matchesSearch(s, searchLower) {
  const hay = [
    s.companyName,
    s.industry,
    s.contactPerson,
    s.contactEmail,
    s.location,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return hay.includes(searchLower);
}

/**
 * Shared marketplace listing for GET /supplier-directory and portal state counts.
 */
export async function listMarketplaceSuppliers({
  buyerCompanyId,
  buyerCompany,
  authUser,
  search = '',
  industry: industryQuery = '',
  location = '',
}) {
  const linkedIds = Array.isArray(buyerCompany?.linkedSupplierCompanyIds)
    ? buyerCompany.linkedSupplierCompanyIds.filter(Boolean)
    : [];
  const linkedIdSet = new Set(linkedIds.map((id) => String(id)));
  const buyerNorm = resolveBuyerIndustry(buyerCompany, authUser);
  const buyerIndustryLabel = buyerIndustryDisplay(buyerCompany, authUser);
  const queryIndustryNorm =
    industryQuery && String(industryQuery).trim() !== 'All'
      ? normalizeIndustry(industryQuery)
      : '';

  const supplierCompanies = await Company.find({
    registrationStatus: 'active',
    _id: { $ne: buyerCompanyId },
    $or: [{ isSupplierCompany: true }, { type: 'Supplier' }],
  })
    .select('name industry location createdAt')
    .sort({ name: 1 })
    .lean();

  const supplierCompanyIds = supplierCompanies.map((c) => c._id);
  const supplierUsers = await User.find({
    companyId: { $in: supplierCompanyIds },
    role: 'supplier',
    isActive: true,
  })
    .select('companyId fullName email phone location industry')
    .lean();

  const userByCompanyId = new Map();
  for (const u of supplierUsers) {
    const cid = String(u.companyId);
    if (!userByCompanyId.has(cid)) userByCompanyId.set(cid, u);
  }

  let suppliers = [];
  for (const company of supplierCompanies) {
    const supplierUser = userByCompanyId.get(String(company._id));
    if (!supplierUser) continue;

    const resolvedNorm = resolveCompanyIndustry(company, supplierUser);
    const displayIndustry =
      industryDisplayLabel(resolvedNorm) ||
      industryDisplayLabel(company.industry) ||
      industryDisplayLabel(supplierUser.industry) ||
      '';

    if (buyerNorm) {
      if (resolvedNorm !== buyerNorm) continue;
    } else if (queryIndustryNorm && resolvedNorm !== queryIndustryNorm) {
      continue;
    }

    suppliers.push({
      id: company._id,
      companyName: company.name,
      industry: displayIndustry,
      location: company.location || supplierUser.location || 'Rwanda',
      contactPerson: supplierUser.fullName || '',
      contactEmail: supplierUser.email || '',
      contactPhone: supplierUser.phone || '',
      createdAt: company.createdAt,
      catalogSize: 0,
      linked: linkedIdSet.has(String(company._id)),
      connectable: true,
    });
  }

  const searchTrim = String(search || '').trim();
  if (searchTrim) {
    const searchLower = searchTrim.toLowerCase();
    suppliers = suppliers.filter((s) => matchesSearch(s, searchLower));
  }

  const locationTrim = String(location || '').trim();
  if (locationTrim && locationTrim !== 'All') {
    const locLower = locationTrim.toLowerCase();
    suppliers = suppliers.filter((s) =>
      String(s.location || '').toLowerCase().includes(locLower)
    );
  }

  const supplierIds = suppliers.map((s) => s.id);
  if (supplierIds.length) {
    const catalogCounts = await SupplierCatalogItem.aggregate([
      { $match: { companyId: { $in: supplierIds } } },
      { $group: { _id: '$companyId', count: { $sum: 1 } } },
    ]);
    const catalogSizeMap = Object.fromEntries(
      catalogCounts.map((item) => [String(item._id), item.count])
    );
    suppliers = suppliers.map((s) => ({
      ...s,
      catalogSize: catalogSizeMap[String(s.id)] || 0,
    }));
  }

  return {
    suppliers,
    total: suppliers.length,
    buyerIndustry: buyerIndustryLabel,
    buyerIndustryLocked: Boolean(buyerNorm),
    linkedCount: linkedIds.length,
  };
}

export async function countMarketplaceSuppliers(buyerCompanyId, buyerCompany, authUser) {
  const { total } = await listMarketplaceSuppliers({
    buyerCompanyId,
    buyerCompany,
    authUser,
  });
  return total;
}
