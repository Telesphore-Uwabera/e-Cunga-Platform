import Company from '../models/Company.js';
import User from '../models/User.js';
import StockItem from '../models/StockItem.js';
import Consumption from '../models/Consumption.js';
import Requisition from '../models/Requisition.js';
import Invoice from '../models/Invoice.js';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import PortalMessage from '../models/PortalMessage.js';
import PortalNotification from '../models/PortalNotification.js';
import ActivityLog from '../models/ActivityLog.js';
import { portalRowVisibleToUser } from './orgScope.js';

const STATE_VERSION = 9;

/** Buyer facilities linked to a supplier company, with active supervisors (supplier portal). */
async function buildBuyerSupervisorDirectory(supplierCompanyId) {
  const sid = supplierCompanyId != null ? String(supplierCompanyId).trim() : '';
  if (!sid) return [];

  const buyers = await Company.find({ linkedSupplierCompanyIds: sid })
    .select('_id name logoUrl industry type')
    .sort({ name: 1 })
    .lean();
  if (!buyers.length) return [];

  const buyerIds = buyers.map((b) => b._id);
  const supervisors = await User.find({
    companyId: { $in: buyerIds },
    role: 'supervisor',
    isActive: true,
  })
    .select('_id fullName email companyId team location phone jobTitle')
    .sort({ fullName: 1 })
    .lean();

  const byCompany = new Map();
  for (const b of buyers) {
    byCompany.set(String(b._id), {
      buyerCompanyId: String(b._id),
      buyerCompanyName: String(b.name || '').trim() || 'Facility',
      buyerLogoUrl: String(b.logoUrl || '').trim(),
      buyerIndustry: String(b.industry || '').trim(),
      supervisors: [],
    });
  }
  for (const s of supervisors) {
    const row = byCompany.get(String(s.companyId));
    if (!row) continue;
    row.supervisors.push({
      id: String(s._id),
      fullName: s.fullName || '',
      email: s.email || '',
      team: s.team || '',
      location: s.location || '',
      phone: s.phone || '',
      jobTitle: s.jobTitle || '',
    });
  }
  return [...byCompany.values()];
}

/** Role inbox (no userId) or personal (userId matches). Avoids user-targeted rows leaking to everyone with the same role. */
function portalRoleOrPersonalFilter(companyId, role, userId) {
  const uid = userId != null ? String(userId).trim() : '';
  const roleBroadcast = {
    role,
    $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }],
  };
  if (!uid) {
    return { companyId, ...roleBroadcast };
  }
  return {
    companyId,
    $or: [{ userId: uid }, roleBroadcast],
  };
}

function mapUser(u) {
  return {
    id: u._id,
    incrementalId: u.incrementalId ?? null,
    companyId: u.companyId,
    companyName: u.companyName || '',
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    team: u.team || '',
    location: u.location || '',
    department: u.department || '',
    jobTitle: u.jobTitle || '',
    phone: u.phone || '',
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
  };
}

function mapStock(s) {
  return {
    id: s._id,
    name: s.name,
    sku: s.sku,
    category: s.category,
    subcategory: s.subcategory || '',
    unit: s.unit,
    quantity: s.quantity,
    minThreshold: s.minThreshold,
    maxThreshold: s.maxThreshold,
    expiryDate: s.expiryDate || '',
    batchNumber: s.batchNumber || '',
    location: s.location,
    department: s.department || '',
    ownerId: s.ownerId,
  };
}

function mapConsumption(c) {
  return {
    id: c._id,
    itemId: c.itemId,
    itemName: c.itemName,
    quantity: c.quantity,
    unit: c.unit,
    clerkId: c.clerkId,
    purpose: c.purpose,
    consumptionKind: c.consumptionKind || 'general',
    relatedRequisitionId: c.relatedRequisitionId || '',
    location: c.location || '',
    department: c.department || '',
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  };
}

function mapRequisition(r) {
  return {
    id: r._id,
    title: r.title,
    clerkId: r.clerkId,
    clerkName: r.clerkName,
    location: r.location,
    status: r.status,
    priority: r.priority,
    requestedAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    clerkJustification: r.clerkJustification || '',
    requestingDepartment: r.requestingDepartment || '',
    deliveryNote: r.deliveryNote || '',
    supervisorNote: r.supervisorNote || '',
    supplierId: r.supplierId != null ? String(r.supplierId) : '',
    supplierName: r.supplierName || '',
    reviewedById: r.reviewedById != null ? String(r.reviewedById) : '',
    reviewedByName: r.reviewedByName || '',
    reviewedByRole: r.reviewedByRole || '',
    reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : '',
    lines: (r.lines || []).map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      estimatedCost: l.estimatedCost,
      dateValue: l.dateValue || '',
    })),
  };
}

function mapInvoice(i) {
  return {
    id: i._id,
    requisitionId: String(i.requisitionId || i.stockRequestId || ''),
    reference: i.reference,
    type: i.type,
    status: i.status,
    amount: i.amount,
    currency: i.currency,
    supplierId: i.supplierId,
    supplierName: i.supplierName || '',
    attachmentUrl: i.attachmentUrl || '',
    deliveryNoteUrl: i.deliveryNoteUrl || '',
    finalInvoiceUrl: i.finalInvoiceUrl || '',
    createdAt: i.createdAt ? new Date(i.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: i.updatedAt ? new Date(i.updatedAt).toISOString() : new Date().toISOString(),
    paidAt: i.paidAt ? new Date(i.paidAt).toISOString() : '',
    notes: i.notes || '',
  };
}

function mapCatalog(row) {
  return {
    id: row._id,
    supplierId: row.supplierId || '',
    name: row.name,
    sku: row.sku,
    category: row.category,
    price: row.price,
    quantity: row.quantity,
    minThreshold: row.minThreshold,
    maxThreshold: row.maxThreshold,
    unit: row.unit,
    description: row.description || '',
    storageLocation: row.storageLocation || '',
    listed: row.listed !== false,
  };
}

function mapMessage(m) {
  return {
    id: m._id,
    role: m.role,
    title: m.title,
    body: m.body,
    from: m.from,
    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    companyId: m.companyId != null ? String(m.companyId) : '',
    userId: m.userId != null ? String(m.userId) : '',
    scopeDepartment: m.scopeDepartment != null ? String(m.scopeDepartment) : '',
    scopeLocation: m.scopeLocation != null ? String(m.scopeLocation) : '',
  };
}

function mapNotification(n) {
  return {
    id: n._id,
    role: n.role,
    severity: n.severity,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
    companyId: n.companyId != null ? String(n.companyId) : '',
    userId: n.userId != null ? String(n.userId) : '',
    isRead: Boolean(n.isRead),
    scopeDepartment: n.scopeDepartment != null ? String(n.scopeDepartment) : '',
    scopeLocation: n.scopeLocation != null ? String(n.scopeLocation) : '',
  };
}

export async function buildPortalState(companyId, authUser) {
  const company = await Company.findById(companyId).lean();
  const isGlobal = Boolean(company?.isPlatformTenant);
  const userFilter = isGlobal ? {} : { companyId };
  const userId = authUser?.id != null ? String(authUser.id).trim() : '';
  const role = authUser?.role || '';
  const supplierCompanyId = authUser?.companyId != null ? String(authUser.companyId).trim() : '';

  // Cross-tenant filtering:
  // - Hospital / internal: requisitions for this company OR assigned to this user as supplier (edge case).
  // - Supplier login: only rows where supervisor assigned this supplier (supplierId = user id, or legacy company id).
  let reqFilter;
  let invFilter;
  if (role === 'supplier') {
    const assigneeKeys = [...new Set([userId, supplierCompanyId].filter(Boolean))];
    reqFilter = assigneeKeys.length ? { supplierId: { $in: assigneeKeys } } : { _id: '__none__' };
    invFilter = assigneeKeys.length ? { supplierId: { $in: assigneeKeys } } : { _id: '__none__' };
  } else {
    reqFilter = { $or: [{ companyId }, { supplierId: userId }] };
    invFilter = { $or: [{ companyId }, { supplierId: userId }] };
  }
  const msgFilter = portalRoleOrPersonalFilter(companyId, role, userId);
  const ntfFilter = portalRoleOrPersonalFilter(companyId, role, userId);

  // Scope users:
  // - Global platform admin (in a platform tenant) sees all users.
  // - Independent Suppliers see only themselves.
  // - All other roles (supervisor, clerk, etc.) see only their company's internal team.
  const internalRoles = ['admin', 'supervisor', 'clerk', 'accountant'];
  const userQueryFilter = (isGlobal && role === 'admin')
    ? {}
    : role === 'supplier'
      ? { _id: userId }
      : { companyId, role: { $in: internalRoles } };


  const linkedSupplierIds = Array.isArray(company?.linkedSupplierCompanyIds)
    ? company.linkedSupplierCompanyIds.filter(Boolean)
    : [];

  const [
    users,
    stockItems,
    consumptions,
    requisitions,
    invoices,
    supplierCatalog,
    messages,
    notifications,
    logs,
    linkedSupplierUsers,
    buyerConnectionsCount,
    buyerSupervisorDirectory,
  ] = await Promise.all([
    User.find(userQueryFilter).select('-passwordHash').lean(),
    StockItem.find({ companyId }).sort({ updatedAt: -1 }).lean(),
    Consumption.find({ companyId }).sort({ createdAt: -1 }).limit(2000).lean(),
    Requisition.find(reqFilter).sort({ updatedAt: -1 }).limit(500).lean(),
    Invoice.find(invFilter).sort({ updatedAt: -1 }).limit(500).lean(),
    SupplierCatalogItem.find({ companyId }).sort({ updatedAt: -1 }).lean(),
    PortalMessage.find(msgFilter).sort({ createdAt: -1 }).limit(400).lean(),
    PortalNotification.find(ntfFilter).sort({ createdAt: -1 }).limit(500).lean(),
    ActivityLog.find({ companyId }).sort({ createdAt: -1 }).limit(500).lean(),
    linkedSupplierIds.length && !(isGlobal && role === 'admin')
      ? User.find({
          role: 'supplier',
          isActive: true,
          companyId: { $in: linkedSupplierIds },
        })
          .select('-passwordHash')
          .lean()
      : Promise.resolve([]),
    role === 'supplier' && companyId
      ? Company.countDocuments({ linkedSupplierCompanyIds: companyId })
      : Promise.resolve(0),
    role === 'supplier' && companyId ? buildBuyerSupervisorDirectory(companyId) : Promise.resolve([]),
  ]);

  const mergedUsers = [...users];
  const seenUser = new Set(users.map((u) => u._id));
  for (const u of linkedSupplierUsers || []) {
    if (!seenUser.has(u._id)) {
      mergedUsers.push(u);
      seenUser.add(u._id);
    }
  }

  /** Canonical org names for platform-wide user lists (registration-approved tenants). */
  let companyNameLookup = {};
  if (mergedUsers.length) {
    const tenantIds = [...new Set(mergedUsers.map((u) => u.companyId).filter(Boolean))];
    if (tenantIds.length) {
      const nameRows = await Company.find({ _id: { $in: tenantIds } }).select('_id name').lean();
      companyNameLookup = Object.fromEntries(nameRows.map((c) => [c._id, c.name]));
    }
  }

  const nameById = Object.fromEntries(mergedUsers.map((u) => [u._id, u.fullName]));

  const messagesScoped = messages.filter((m) => portalRowVisibleToUser(m, authUser));
  const notificationsScoped = notifications.filter((n) => portalRowVisibleToUser(n, authUser));

  const requisitionBuyerIds = [...new Set(requisitions.map((r) => r.companyId).filter(Boolean))];
  const buyerCompanyRows = requisitionBuyerIds.length
    ? await Company.find({ _id: { $in: requisitionBuyerIds } })
        .select('_id name logoUrl')
        .lean()
    : [];
  const buyerCompanyById = Object.fromEntries(
    buyerCompanyRows.map((b) => [
      String(b._id),
      { name: String(b.name || '').trim(), logoUrl: String(b.logoUrl || '').trim() },
    ])
  );

  const activity = logs.map((log) => {
    const p = log.payload || {};
    const meta = p.meta !== undefined ? p.meta : p;
    return {
      id: log._id.toString(),
      action: log.action,
      actorId: log.userId,
      actorName: nameById[log.userId] || p.actorName || 'System',
      meta: meta && typeof meta === 'object' ? meta : {},
      createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  const companyShape = company
    ? {
        id: company._id,
        name: company.name,
        type: company.type,
        industry: company.industry || '',
        language: company.language,
        currency: company.currency,
        usersLimit: company.usersLimit,
        isPlatformTenant: Boolean(company.isPlatformTenant),
        legalName: company.legalName || '',
        taxId: company.taxId || '',
        address: company.address || '',
        lowStockThreshold: company.lowStockThreshold || 15,
        anomalyDetection: company.anomalyDetection ?? true,
        auditRetention: company.auditRetention || '1 Year',
        sessionTimeout: company.sessionTimeout || '30 Minutes',
        logoUrl: company.logoUrl || '',
        linkedSupplierCompanyIds: linkedSupplierIds,
      }
    : {
        id: companyId,
        name: 'Unknown',
        type: '',
        industry: '',
        language: 'EN',
        currency: 'RWF',
        usersLimit: 10,
        isPlatformTenant: false,
        legalName: '',
        taxId: '',
        address: '',
        lowStockThreshold: 15,
        anomalyDetection: true,
        auditRetention: '1 Year',
        sessionTimeout: '30 Minutes',
        logoUrl: '',
        linkedSupplierCompanyIds: [],
      };

  return {
    version: STATE_VERSION,
    // Shape expected by PortalStateContext: companies array + selectedCompanyId
    companies: [companyShape],
    selectedCompanyId: companyId,
    // Flat company object kept for backward compatibility with components that read state.company directly
    company: companyShape,
    /** Buyer organizations that linked this supplier (marketplace); supplier role only. */
    buyerConnectionsCount: role === 'supplier' ? Number(buyerConnectionsCount) || 0 : 0,
    /** Grouped supervisors at linked buyer facilities; supplier role only. */
    buyerSupervisorDirectory: role === 'supplier' ? buyerSupervisorDirectory || [] : [],
    users: mergedUsers.map((u) =>
      mapUser({
        ...u,
        companyName: companyNameLookup[u.companyId] || u.companyName || '',
      })
    ),
    stockItems: stockItems.map((s) => ({ ...mapStock(s), companyId: s.companyId })),
    supplierCatalog: supplierCatalog.map((row) => ({ ...mapCatalog(row), companyId: row.companyId })),
    consumptions: consumptions.map((c) => ({ ...mapConsumption(c), companyId: c.companyId })),
    requisitions: requisitions.map((r) => {
      const bid = r.companyId != null ? String(r.companyId) : '';
      const buyer = bid ? buyerCompanyById[bid] : null;
      return {
        ...mapRequisition(r),
        companyId: r.companyId,
        buyerCompanyName: buyer?.name || '',
        buyerLogoUrl: buyer?.logoUrl || '',
      };
    }),
    invoices: invoices.map((i) => ({ ...mapInvoice(i), companyId: i.companyId })),
    messages: messagesScoped.map(mapMessage),
    notifications: notificationsScoped.map(mapNotification),
    activity,
  };
}
