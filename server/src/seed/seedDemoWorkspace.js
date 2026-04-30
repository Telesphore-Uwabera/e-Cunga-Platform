/**
 * Idempotent seed for the demo company (company_demo_1) and rich portal data.
 * Enable with SEED_DEMO_WORKSPACE=true in server/.env when MONGODB_URI is set.
 */
import bcrypt from 'bcryptjs';
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
import Counter from '../models/Counter.js';
import { getDemoPassword, getDemoUserDefinitions, getDemoWorkspaceCompanyName } from '../config/demoEnv.js';

const COMPANY_ID = 'company_demo_1';

const USER_IDS = {
  admin: 'user_admin_1',
  clerkA: 'user_clerk_1',
  clerkB: 'user_clerk_2',
  supervisor: 'user_supervisor_1',
  accountant: 'user_accountant_1',
  supplier: 'user_supplier_1',
};

function iso(daysOffset = 0, hoursOffset = 0, minutesOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(date.getHours() + hoursOffset);
  date.setMinutes(date.getMinutes() + minutesOffset);
  return date.toISOString();
}

export async function seedDemoWorkspace() {
  const demoCompanyName = getDemoWorkspaceCompanyName();

  await Company.updateOne(
    { _id: COMPANY_ID },
    { 
      $set: { 
        name: demoCompanyName,
        type: 'Healthcare / enterprise',
        industry: 'Healthcare',
        language: 'EN',
        currency: 'RWF',
        usersLimit: 10,
        registrationStatus: 'active',
        isPlatformTenant: true
      } 
    },
    { upsert: true }
  );

  const existingUsers = await User.countDocuments({ companyId: COMPANY_ID });
  if (existingUsers > 0) {
    console.log('[seed] Demo users already present; skipping user injection.');
  } else {
    console.log('[seed] Creating demo users…');
    const passwordHash = await bcrypt.hash(getDemoPassword(), 10);
    const demoDefs = getDemoUserDefinitions();

    await User.insertMany(
      demoDefs.map((d) => ({
        _id: d.id,
        incrementalId: d.incrementalId,
        companyId: d.companyId,
        companyName: d.companyName,
        fullName: d.fullName,
        email: d.email,
        passwordHash,
        role: d.role,
        industry: d.industry,
        team: d.team,
        location: d.location,
        isActive: d.isActive,
        phone: d.phone ?? '',
        jobTitle: d.jobTitle ?? '',
        timeZone: d.timeZone ?? 'Africa/Kigali',
        notifyEmailDigest: d.notifyEmailDigest !== false,
        notifySecurityAlerts: d.notifySecurityAlerts !== false,
        notifyProductUpdates: Boolean(d.notifyProductUpdates),
      }))
    );
  }

  {
    const top = await User.findOne({ incrementalId: { $exists: true, $ne: null } })
      .sort({ incrementalId: -1 })
      .select('incrementalId')
      .lean();
    const seq = top?.incrementalId ?? 0;
    if (seq > 0) {
      await Counter.findByIdAndUpdate('user', { $max: { seq } }, { upsert: true, new: true });
    }
  }

  const existingStock = await StockItem.countDocuments({ companyId: COMPANY_ID });
  if (existingStock > 0) {
    console.log('[seed] Demo stock already present; skipping inventory injection.');
    return;
  }

  const stockItems = [
    {
      _id: 'stk_001',
      companyId: COMPANY_ID,
      name: 'Surgical gloves',
      sku: 'MED-GLV-001',
      category: 'Medical consumables',
      unit: 'boxes',
      quantity: 34,
      minThreshold: 30,
      maxThreshold: 120,
      expiryDate: iso(42),
      location: 'Warehouse A',
      ownerId: USER_IDS.clerkA,
    },
    {
      _id: 'stk_002',
      companyId: COMPANY_ID,
      name: 'Disinfectant',
      sku: 'MED-DIS-007',
      category: 'Sanitation',
      unit: 'bottles',
      quantity: 16,
      minThreshold: 22,
      maxThreshold: 70,
      expiryDate: iso(19),
      location: 'Warehouse A',
      ownerId: USER_IDS.clerkA,
    },
    {
      _id: 'stk_003',
      companyId: COMPANY_ID,
      name: 'IV fluid',
      sku: 'MED-IV-110',
      category: 'Pharmacy',
      subcategory: 'Medications',
      unit: 'bags',
      quantity: 58,
      minThreshold: 35,
      maxThreshold: 150,
      expiryDate: iso(90),
      location: 'Warehouse B',
      ownerId: USER_IDS.clerkB,
    },
    {
      _id: 'stk_004',
      companyId: COMPANY_ID,
      name: 'Syringes 10ml',
      sku: 'MED-SYR-010',
      category: 'Medical consumables',
      unit: 'packs',
      quantity: 9,
      minThreshold: 12,
      maxThreshold: 55,
      expiryDate: iso(120),
      location: 'Warehouse B',
      ownerId: USER_IDS.clerkB,
    },
    {
      _id: 'stk_005',
      companyId: COMPANY_ID,
      name: 'Printer paper',
      sku: 'OPS-PAP-500',
      category: 'Office supplies',
      unit: 'reams',
      quantity: 44,
      minThreshold: 12,
      maxThreshold: 60,
      expiryDate: '',
      location: 'HQ Kigali',
      ownerId: USER_IDS.clerkA,
    },
    {
      _id: 'stk_006',
      companyId: COMPANY_ID,
      name: 'Cold chain vaccine box',
      sku: 'MED-CBOX-090',
      category: 'Cold chain',
      unit: 'units',
      quantity: 3,
      minThreshold: 4,
      maxThreshold: 10,
      expiryDate: '',
      location: 'Warehouse B',
      ownerId: USER_IDS.clerkB,
    },
    {
      _id: 'stk_007',
      companyId: COMPANY_ID,
      name: 'Ceftriaxone',
      sku: 'PHM-CEF-500',
      category: 'Pharmacy',
      subcategory: 'Medications',
      unit: 'vials',
      quantity: 50,
      minThreshold: 20,
      maxThreshold: 200,
      expiryDate: iso(180),
      location: 'Warehouse A',
      ownerId: USER_IDS.clerkA,
    },
  ];
  await StockItem.insertMany(stockItems);

  await Consumption.insertMany([
    {
      _id: 'con_001',
      companyId: COMPANY_ID,
      itemId: 'stk_001',
      itemName: 'Surgical gloves',
      quantity: 8,
      unit: 'boxes',
      clerkId: USER_IDS.clerkA,
      purpose: 'Maternity wing weekly allocation',
      createdAt: new Date(iso(-4)),
    },
    {
      _id: 'con_002',
      companyId: COMPANY_ID,
      itemId: 'stk_003',
      itemName: 'IV fluid',
      quantity: 14,
      unit: 'bags',
      clerkId: USER_IDS.clerkB,
      purpose: 'Emergency stock issue',
      createdAt: new Date(iso(-2)),
    },
    {
      _id: 'con_003',
      companyId: COMPANY_ID,
      itemId: 'stk_002',
      itemName: 'Disinfectant',
      quantity: 5,
      unit: 'bottles',
      clerkId: USER_IDS.clerkA,
      purpose: 'Ward sanitation',
      createdAt: new Date(iso(-1)),
    },
  ]);

  const requisitions = [
    {
      _id: 'req_001',
      companyId: COMPANY_ID,
      title: 'Restock sanitation essentials',
      clerkId: USER_IDS.clerkA,
      clerkName: 'Didier Nsengiyumva',
      location: 'Gasabo',
      status: 'submitted',
      priority: 'high',
      supervisorNote: '',
      lines: [
        { description: 'Disinfectant', quantity: 30, unit: 'bottles', estimatedCost: 180000 },
        { description: 'Hand sanitizer', quantity: 20, unit: 'bottles', estimatedCost: 95000 },
      ],
      createdAt: new Date(iso(-3)),
      updatedAt: new Date(iso(-3)),
    },
    {
      _id: 'req_002',
      companyId: COMPANY_ID,
      title: 'Cold chain replenishment',
      clerkId: USER_IDS.clerkB,
      clerkName: 'Josiane Mukamana',
      location: 'Kicukiro',
      status: 'sentToSupplier',
      priority: 'critical',
      supervisorNote: 'Approved immediately due to low safety stock.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [{ description: 'Cold chain vaccine box', quantity: 4, unit: 'units', estimatedCost: 1280000 }],
      createdAt: new Date(iso(-6)),
      updatedAt: new Date(iso(-5)),
    },
    {
      _id: 'req_003',
      companyId: COMPANY_ID,
      title: 'Weekly theatre consumables',
      clerkId: USER_IDS.clerkA,
      clerkName: 'Didier Nsengiyumva',
      location: 'Gasabo',
      status: 'proformaReceived',
      priority: 'normal',
      supervisorNote: 'Approved with theatre forecast.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [
        { description: 'Surgical gloves', quantity: 40, unit: 'boxes', estimatedCost: 420000 },
        { description: 'Syringes 10ml', quantity: 15, unit: 'packs', estimatedCost: 210000 },
      ],
      createdAt: new Date(iso(-8)),
      updatedAt: new Date(iso(-7)),
    },
    {
      _id: 'req_004',
      companyId: COMPANY_ID,
      title: 'Clinic office restock',
      clerkId: USER_IDS.clerkB,
      clerkName: 'Josiane Mukamana',
      location: 'Kicukiro',
      status: 'paid',
      priority: 'normal',
      supervisorNote: 'Approved in weekly review.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [{ description: 'Printer paper', quantity: 18, unit: 'reams', estimatedCost: 90000 }],
      createdAt: new Date(iso(-12)),
      updatedAt: new Date(iso(-9)),
    },
    {
      _id: 'req_005',
      companyId: COMPANY_ID,
      title: 'Maternity ward monthly pack',
      clerkId: USER_IDS.clerkA,
      clerkName: 'Didier Nsengiyumva',
      location: 'Gasabo',
      status: 'closed',
      priority: 'normal',
      supervisorNote: 'Closed after delivery and invoice verification.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [
        { description: 'Surgical gloves', quantity: 25, unit: 'boxes', estimatedCost: 260000 },
        { description: 'IV fluid', quantity: 20, unit: 'bags', estimatedCost: 340000 },
      ],
      createdAt: new Date(iso(-18)),
      updatedAt: new Date(iso(-11)),
    },
    {
      _id: 'req_006',
      companyId: COMPANY_ID,
      title: 'Oxygen cylinder service carts',
      clerkId: USER_IDS.clerkA,
      clerkName: 'Didier Nsengiyumva',
      location: 'Gasabo',
      status: 'proformaApproved',
      priority: 'normal',
      supervisorNote: 'Approved for theatre expansion.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [
        { description: 'Service cart frame', quantity: 6, unit: 'units', estimatedCost: 280000 },
        { description: 'Oxygen bracket kit', quantity: 6, unit: 'kits', estimatedCost: 170000 },
      ],
      createdAt: new Date(iso(-9)),
      updatedAt: new Date(iso(-4)),
    },
    {
      _id: 'req_008',
      companyId: COMPANY_ID,
      title: 'Disposable gowns bulk order',
      clerkId: USER_IDS.clerkB,
      clerkName: 'Josiane Mukamana',
      location: 'Kicukiro',
      status: 'rejected',
      priority: 'normal',
      supervisorNote: 'Finance rejected supplier proforma.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [{ description: 'Disposable isolation gowns', quantity: 2000, unit: 'units', estimatedCost: 2400000 }],
      createdAt: new Date(iso(-14)),
      updatedAt: new Date(iso(-6)),
    },
  ];
  await Requisition.insertMany(requisitions);

  const paidAt2 = new Date(iso(-9));
  const paidAt3 = new Date(iso(-12));
  const invoices = [
    {
      _id: 'inv_001',
      companyId: COMPANY_ID,
      requisitionId: 'req_003',
      stockRequestId: 'req_003',
      reference: 'PRO-2026-0041',
      type: 'proforma',
      status: 'proformaReceived',
      amount: 630000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-theatre-consumables.pdf',
      createdBy: USER_IDS.supplier,
      notes: 'Awaiting accountant review',
      createdAt: new Date(iso(-7)),
      updatedAt: new Date(iso(-7)),
    },
    {
      _id: 'inv_002',
      companyId: COMPANY_ID,
      requisitionId: 'req_004',
      stockRequestId: 'req_004',
      reference: 'PRO-2026-0037',
      type: 'proforma',
      status: 'paid',
      amount: 90000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-clinic-paper.pdf',
      deliveryNoteUrl: 'delivery-clinic-paper.pdf',
      createdBy: USER_IDS.supplier,
      paidAt: paidAt2,
      paidBy: USER_IDS.accountant,
      notes: 'Paid and waiting final invoice',
      createdAt: new Date(iso(-10)),
      updatedAt: new Date(iso(-9)),
    },
    {
      _id: 'inv_003',
      companyId: COMPANY_ID,
      requisitionId: 'req_005',
      stockRequestId: 'req_005',
      reference: 'FIN-2026-0028',
      type: 'final',
      status: 'closed',
      amount: 600000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-maternity-pack.pdf',
      deliveryNoteUrl: 'delivery-maternity-pack.pdf',
      finalInvoiceUrl: 'final-maternity-pack.pdf',
      createdBy: USER_IDS.supplier,
      paidAt: paidAt3,
      paidBy: USER_IDS.accountant,
      notes: 'Fully closed workflow',
      createdAt: new Date(iso(-16)),
      updatedAt: new Date(iso(-11)),
    },
    {
      _id: 'inv_004',
      companyId: COMPANY_ID,
      requisitionId: 'req_006',
      stockRequestId: 'req_006',
      reference: 'PRO-2026-0188',
      type: 'proforma',
      status: 'proformaApproved',
      amount: 450000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-oxygen-carts.pdf',
      createdBy: USER_IDS.supplier,
      notes: 'Approved by finance — awaiting payment release.',
      createdAt: new Date(iso(-5)),
      updatedAt: new Date(iso(-4)),
    },
    {
      _id: 'inv_005',
      companyId: COMPANY_ID,
      requisitionId: 'req_008',
      stockRequestId: 'req_008',
      reference: 'PRO-2026-0201',
      type: 'proforma',
      status: 'rejected',
      amount: 2400000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-gowns-bulk.pdf',
      createdBy: USER_IDS.supplier,
      notes: 'Rejected: unit price exceeds contracted ceiling for gowns.',
      createdAt: new Date(iso(-7)),
      updatedAt: new Date(iso(-6)),
    },
  ];
  await Invoice.insertMany(invoices);

  const catalogRows = [
    ['sl_01', 'Cold brew concentrate', 'CR-9042', 'Beverages', 22500, 240, 40, 300, 'cases'],
    ['sl_04', 'Nitrile exam gloves', 'MED-GLV-204', 'Medical consumables', 18500, 1180, 200, 1400, 'boxes'],
    ['sl_05', 'Buffered disinfectant', 'MED-DIS-088', 'Sanitation', 6200, 44, 50, 200, 'bottles'],
    ['sl_06', 'IV fluid lactated ringers', 'MED-IV-220', 'Pharmacy', 3100, 800, 120, 1000, 'bags'],
    ['sl_07', 'Sterile syringes 10ml', 'MED-SYR-010', 'Medical consumables', 9500, 18, 25, 120, 'packs'],
    ['sl_09', 'Cold chain transport box', 'MED-CBOX-090', 'Cold chain', 320000, 2, 4, 12, 'units'],
  ];
  await SupplierCatalogItem.insertMany(
    catalogRows.map(([id, name, sku, category, price, quantity, minT, maxT, unit]) => ({
      _id: id,
      companyId: COMPANY_ID,
      supplierId: USER_IDS.supplier,
      name,
      sku,
      category,
      price,
      quantity,
      minThreshold: minT,
      maxThreshold: maxT,
      unit,
      listed: true,
    }))
  );

  await PortalMessage.insertMany([
    {
      _id: 'msg_001',
      companyId: COMPANY_ID,
      role: 'clerk',
      title: 'Supervisor requested justification',
      body: 'Add unit cost notes for sanitation requisition before 3 PM review.',
      from: 'Supervisor desk',
      createdAt: new Date(iso(-1)),
    },
    {
      _id: 'msg_002',
      companyId: COMPANY_ID,
      role: 'supervisor',
      title: 'Critical stock threshold reached',
      body: 'Cold chain vaccine box dropped below minimum stock in Kicukiro.',
      from: 'Auto alert',
      createdAt: new Date(iso(-2)),
    },
    {
      _id: 'msg_003',
      companyId: COMPANY_ID,
      role: 'accountant',
      title: 'Supplier uploaded proforma',
      body: 'Theatre consumables proforma is waiting for approval and payment.',
      from: 'Supplier portal',
      createdAt: new Date(iso(-1)),
    },
    {
      _id: 'msg_004',
      companyId: COMPANY_ID,
      role: 'supplier',
      title: 'Payment released',
      body: 'Clinic office restock payment was marked as paid. Prepare dispatch documents.',
      from: 'Finance',
      createdAt: new Date(iso(-8)),
    },
    {
      _id: 'msg_005',
      companyId: COMPANY_ID,
      role: 'admin',
      title: 'Weekly executive digest',
      body: '3 requisitions are open, 1 paid, and 2 items need restock attention.',
      from: 'System digest',
      createdAt: new Date(iso(-1)),
    },
  ]);

  await PortalNotification.insertMany([
    {
      _id: 'ntf_001',
      companyId: COMPANY_ID,
      role: 'clerk',
      severity: 'warn',
      title: 'Near expiry alert',
      body: 'Disinfectant expires within 19 days.',
      createdAt: new Date(iso(-1)),
    },
    {
      _id: 'ntf_002',
      companyId: COMPANY_ID,
      role: 'supervisor',
      severity: 'neutral',
      title: 'Approval queue updated',
      body: 'A new requisition was submitted from Warehouse A.',
      createdAt: new Date(iso(-1)),
    },
    {
      _id: 'ntf_003',
      companyId: COMPANY_ID,
      role: 'accountant',
      severity: 'ok',
      title: 'Payment confirmed',
      body: 'Clinic office restock payment cleared successfully.',
      createdAt: new Date(iso(-9)),
    },
    {
      _id: 'ntf_004',
      companyId: COMPANY_ID,
      role: 'supplier',
      severity: 'neutral',
      title: 'Delivery note required',
      body: 'Upload delivery note for PRO-2026-0037.',
      createdAt: new Date(iso(-9)),
    },
    {
      _id: 'ntf_admin_001',
      companyId: COMPANY_ID,
      role: 'admin',
      severity: 'bad',
      title: 'Unauthorized Login Attempt',
      body: 'A sign-in was attempted from Kyiv, UA using your admin credentials.',
      createdAt: new Date(iso(0, 0, -2)),
    },
  ]);

  await ActivityLog.insertMany([
    {
      companyId: COMPANY_ID,
      userId: USER_IDS.clerkA,
      action: 'stock.request.created',
      payload: { meta: { requisitionId: 'req_001', location: 'Gasabo' } },
      createdAt: new Date(iso(-3)),
    },
    {
      companyId: COMPANY_ID,
      userId: USER_IDS.supervisor,
      action: 'stock.request.approved',
      payload: { meta: { requisitionId: 'req_002' } },
      createdAt: new Date(iso(-5)),
    },
    {
      companyId: COMPANY_ID,
      userId: USER_IDS.supplier,
      action: 'invoice.proforma.received',
      payload: { meta: { invoiceId: 'inv_001' } },
      createdAt: new Date(iso(-7)),
    },
    {
      companyId: COMPANY_ID,
      userId: USER_IDS.accountant,
      action: 'invoice.paid',
      payload: { meta: { invoiceId: 'inv_002', amount: 90000 } },
      createdAt: new Date(iso(-9)),
    },
    {
      companyId: COMPANY_ID,
      userId: USER_IDS.admin,
      action: 'workflow.closed',
      payload: { meta: { requisitionId: 'req_005', invoiceId: 'inv_003' } },
      createdAt: new Date(iso(-11)),
    },
  ]);

  console.log('[seed] Demo workspace ready. Log in with DEMO_PASSWORD and emails from server/.env (see .env.example).');
}
