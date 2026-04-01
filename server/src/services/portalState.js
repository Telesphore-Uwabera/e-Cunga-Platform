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

const STATE_VERSION = 5;

function mapUser(u) {
  return {
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    team: u.team || 'Operations',
    location: u.location || 'HQ Kigali',
  };
}

function mapStock(s) {
  return {
    id: s._id,
    name: s.name,
    sku: s.sku,
    category: s.category,
    unit: s.unit,
    quantity: s.quantity,
    minThreshold: s.minThreshold,
    maxThreshold: s.maxThreshold,
    expiryDate: s.expiryDate || '',
    location: s.location,
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

export async function buildPortalState(companyId) {
  const [
    company,
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
    Company.findById(companyId).lean(),
    User.find({ companyId }).select('-passwordHash').lean(),
    StockItem.find({ companyId }).sort({ updatedAt: -1 }).lean(),
    Consumption.find({ companyId }).sort({ createdAt: -1 }).limit(500).lean(),
    Requisition.find({ companyId }).sort({ updatedAt: -1 }).limit(500).lean(),
    Invoice.find({ companyId }).sort({ updatedAt: -1 }).limit(500).lean(),
    SupplierCatalogItem.find({ companyId }).sort({ updatedAt: -1 }).lean(),
    PortalMessage.find({ companyId }).sort({ createdAt: -1 }).limit(200).lean(),
    PortalNotification.find({ companyId }).sort({ createdAt: -1 }).limit(300).lean(),
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

  return {
    version: STATE_VERSION,
    company: company
      ? {
          name: company.name,
          type: company.type,
          language: company.language,
          currency: company.currency,
          usersLimit: company.usersLimit,
        }
      : {
          name: 'Unknown',
          type: '',
          language: 'EN',
          currency: 'RWF',
          usersLimit: 10,
        },
    users: users.map(mapUser),
    stockItems: stockItems.map(mapStock),
    supplierCatalog: supplierCatalog.map(mapCatalog),
    consumptions: consumptions.map(mapConsumption),
    requisitions: requisitions.map(mapRequisition),
    invoices: invoices.map(mapInvoice),
    messages: messages.map(mapMessage),
    notifications: notifications.map(mapNotification),
    activity,
  };
}
