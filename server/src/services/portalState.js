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

const STATE_VERSION = 6;

function mapUser(u) {
  return {
    id: u._id,
    incrementalId: u.incrementalId ?? null,
    companyId: u.companyId,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    team: u.team || 'Operations',
    location: u.location || 'HQ Kigali',
    jobTitle: u.jobTitle || '',
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
    supplierId: r.supplierId || '',
    supplierName: r.supplierName || '',
    lines: (r.lines || []).map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      estimatedCost: l.estimatedCost,
    })),
  };
}

function mapInvoice(i) {
  return {
    id: i._id,
    requisitionId: i.requisitionId || i.stockRequestId || '',
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
  };
}

export async function buildPortalState(companyId, authUser) {
  const company = await Company.findById(companyId).lean();
  const isGlobal = Boolean(company?.isPlatformTenant);
  const userFilter = isGlobal ? {} : { companyId };
  const userId = authUser?.id || '';
  const role = authUser?.role || '';

  // Cross-tenant filtering:
  // Requisitions & Invoices: Scoped to companyId (Hospital) OR supplierId (Supplier User)
  const reqFilter = { $or: [{ companyId }, { supplierId: userId }] };
  const invFilter = { $or: [{ companyId }, { supplierId: userId }] };
  const msgFilter = { $or: [{ companyId, role }, { userId }] };
  const ntfFilter = { $or: [{ companyId, role }, { userId }] };

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
  ] = await Promise.all([
    User.find(userQueryFilter).select('-passwordHash').lean(),
    StockItem.find({ companyId }).sort({ updatedAt: -1 }).lean(),
    Consumption.find({ companyId }).sort({ createdAt: -1 }).limit(500).lean(),
    Requisition.find(reqFilter).sort({ updatedAt: -1 }).limit(500).lean(),
    Invoice.find(invFilter).sort({ updatedAt: -1 }).limit(500).lean(),
    SupplierCatalogItem.find({ companyId }).sort({ updatedAt: -1 }).lean(),
    PortalMessage.find(msgFilter).sort({ createdAt: -1 }).limit(200).lean(),
    PortalNotification.find(ntfFilter).sort({ createdAt: -1 }).limit(300).lean(),
    ActivityLog.find({ companyId }).sort({ createdAt: -1 }).limit(500).lean(),
  ]);

  const nameById = Object.fromEntries(users.map((u) => [u._id, u.fullName]));

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
      };

  return {
    version: STATE_VERSION,
    // Shape expected by PortalStateContext: companies array + selectedCompanyId
    companies: [companyShape],
    selectedCompanyId: companyId,
    // Flat company object kept for backward compatibility with components that read state.company directly
    company: companyShape,
    users: users.map(mapUser),
    stockItems: stockItems.map((s) => ({ ...mapStock(s), companyId: s.companyId })),
    supplierCatalog: supplierCatalog.map((row) => ({ ...mapCatalog(row), companyId: row.companyId })),
    consumptions: consumptions.map((c) => ({ ...mapConsumption(c), companyId: c.companyId })),
    requisitions: requisitions.map((r) => ({ ...mapRequisition(r), companyId: r.companyId })),
    invoices: invoices.map((i) => ({ ...mapInvoice(i), companyId: i.companyId })),
    messages: messages.map(mapMessage),
    notifications: notifications.map(mapNotification),
    activity,
  };
}
