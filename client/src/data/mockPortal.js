import { useEffect, useState } from 'react';

const STATE_VERSION = 7;
const STORAGE_KEY = 'ecunga_mock_portal_v2';

const TENANTS = {
  hospital: 'tenant_hospital_1',
  center: 'tenant_center_1',
  medic: 'tenant_medic_1',
  teletech: 'tenant_teletech_rw',
};

const USER_IDS = {
  admin: 'user_admin_1',
  clerkA: 'user_clerk_1',
  clerkB: 'user_clerk_2',
  supervisor: 'user_supervisor_1',
  accountant: 'user_accountant_1',
  supplier: 'user_supplier_1',
  supplierTeletech: 'user_supplier_teletech',
};

function iso(daysOffset = 0, hoursOffset = 0, minutesOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(date.getHours() + hoursOffset);
  date.setMinutes(date.getMinutes() + minutesOffset);
  return date.toISOString();
}

function requisitionMonthTag(d = new Date()) {
  return new Date(d).toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(/\s/g, '');
}

function nextReqId(state, kind) {
  const mid = kind === 'auto' ? 'Auto' : 'Manu';
  const prefix = `Req-${mid}-${requisitionMonthTag()}-`;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d{4})$`);
  const existing = state.requisitions || [];
  let max = 0;
  for (const r of existing) {
    const m = String(r.id).match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function nextMockUserIncrementalId(users) {
  const nums = (users || []).map((u) => (typeof u.incrementalId === 'number' ? u.incrementalId : 0));
  return Math.max(0, ...nums) + 1;
}

/** Administrator-published catalog (ecosystem / landing). Supervisors & clerks add inventory from these templates. */
/** category = ecosystem slug (see client/src/constants/ecosystemCatalog.js); sector matches marketing filter labels. */
const DEFAULT_MASTER_STOCK = [
  { _id: 'mstk_demo_1', name: 'Surgical gloves', category: 'healthcare', unit: 'boxes', sector: 'Healthcare', suggestedMin: 30, suggestedMax: 120, description: 'Nitrile examination gloves' },
  { _id: 'mstk_demo_2', name: 'Disinfectant 500ml', category: 'healthcare', unit: 'bottles', sector: 'Healthcare', suggestedMin: 12, suggestedMax: 80, description: 'Buffered surface disinfectant' },
  { _id: 'mstk_demo_3', name: 'Face masks (3-ply)', category: 'healthcare', unit: 'boxes', sector: 'Healthcare', suggestedMin: 20, suggestedMax: 200, description: 'Procedure masks' },
  { _id: 'mstk_demo_4', name: 'Paracetamol 500mg', category: 'healthcare', unit: 'boxes', sector: 'Healthcare', suggestedMin: 10, suggestedMax: 60, description: 'Analgesic tablets' },
  { _id: 'mstk_demo_5', name: 'Syringes 5ml', category: 'healthcare', unit: 'pcs', sector: 'Healthcare', suggestedMin: 200, suggestedMax: 5000, description: 'Sterile single-use' },
  { _id: 'mstk_demo_6', name: 'Cold chain vaccine carrier', category: 'healthcare', unit: 'units', sector: 'Healthcare', suggestedMin: 2, suggestedMax: 15, description: 'Validated transport box' },
];

function createInitialState() {
  const companies = [
    {
      id: TENANTS.hospital,
      name: 'Demo Regional Hospital',
      type: 'Healthcare / enterprise',
      industry: 'Hospital',
      language: 'EN',
      currency: 'RWF',
      usersLimit: 20,
      isPlatformTenant: true,
      linkedSupplierCompanyIds: [],
    },
    {
      id: TENANTS.center,
      name: 'Kigali Health Center',
      type: 'Clinic',
      industry: 'Healthcare',
      language: 'EN',
      currency: 'RWF',
      usersLimit: 10,
      isPlatformTenant: false,
    },
    {
      id: TENANTS.medic,
      name: 'Medic Rwanda',
      type: 'Wholesale',
      industry: 'Pharma',
      language: 'KINY',
      currency: 'RWF',
      usersLimit: 15,
      isPlatformTenant: false,
    },
    {
      id: TENANTS.teletech,
      name: 'Teletech Rwanda',
      type: 'Supplier',
      industry: 'Technology',
      language: 'EN',
      currency: 'RWF',
      usersLimit: 5,
      isPlatformTenant: false,
      isSupplierCompany: true,
      location: 'HQ Kigali',
    },
  ];

  const users = [
    {
      id: USER_IDS.admin,
      incrementalId: 1,
      fullName: 'Aline Uwimana',
      email: 'admin@ecunga.com',
      role: 'admin',
      isActive: true,
      team: 'Executive',
      location: 'HQ Kigali',
      companyId: TENANTS.hospital,
    },
    {
      id: USER_IDS.clerkA,
      incrementalId: 2,
      fullName: 'Didier Nsengiyumva',
      email: 'clerk.one@ecunga.com',
      role: 'clerk',
      isActive: true,
      team: 'Warehouse A',
      location: 'Gasabo',
      companyId: TENANTS.hospital,
    },
    {
      id: USER_IDS.clerkB,
      incrementalId: 3,
      fullName: 'Josiane Mukamana',
      email: 'clerk.two@ecunga.com',
      role: 'clerk',
      isActive: true,
      team: 'Warehouse B',
      location: 'Kicukiro',
      companyId: TENANTS.hospital,
    },
    {
      id: USER_IDS.supervisor,
      incrementalId: 4,
      fullName: 'Patrick Ndagijimana',
      email: 'supervisor@ecunga.com',
      role: 'supervisor',
      isActive: true,
      team: 'Operations',
      location: 'HQ Kigali',
      companyId: TENANTS.hospital,
    },
    {
      id: USER_IDS.accountant,
      incrementalId: 5,
      fullName: 'Claudine Mukeshimana',
      email: 'accountant@ecunga.com',
      role: 'accountant',
      isActive: true,
      team: 'Finance',
      location: 'HQ Kigali',
      companyId: TENANTS.hospital,
    },
    {
      id: USER_IDS.supplier,
      incrementalId: 6,
      fullName: 'MediSupply Rwanda',
      companyName: 'MediSupply Rwanda',
      email: 'supplier@ecunga.com',
      role: 'supplier',
      isActive: true,
      team: 'External',
      location: 'Nyarugenge',
      companyId: TENANTS.hospital,
    },
    {
      id: USER_IDS.supplierTeletech,
      incrementalId: 7,
      fullName: 'Teletech Info',
      companyName: 'Teletech Rwanda',
      email: 'info.teletech.rw@gmail.com',
      role: 'supplier',
      isActive: true,
      team: 'Sales',
      location: 'HQ Kigali',
      companyId: TENANTS.teletech,
    },
  ];

  const stockItems = [
    {
      id: 'stk_001',
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
      id: 'stk_002',
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
      id: 'stk_003',
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
      id: 'stk_004',
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
      id: 'stk_005',
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
      id: 'stk_006',
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
      id: 'stk_007',
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
    {
      id: 'stk_008',
      name: 'Petri dishes (pk 50)',
      sku: 'LAB-PET-050',
      category: 'Laboratory',
      unit: 'packs',
      quantity: 12,
      minThreshold: 10,
      maxThreshold: 40,
      expiryDate: '',
      location: 'Lab A - Shelf 2',
      ownerId: USER_IDS.clerkA,
    },
  ];

  const consumptions = [
    {
      id: 'con_001',
      itemId: 'stk_001',
      itemName: 'Surgical gloves',
      quantity: 8,
      unit: 'boxes',
      clerkId: USER_IDS.clerkA,
      purpose: 'Maternity wing weekly allocation',
      createdAt: iso(-4),
    },
    {
      id: 'con_002',
      itemId: 'stk_003',
      itemName: 'IV fluid',
      quantity: 14,
      unit: 'bags',
      clerkId: USER_IDS.clerkB,
      purpose: 'Emergency stock issue',
      createdAt: iso(-2),
    },
    {
      id: 'con_003',
      itemId: 'stk_002',
      itemName: 'Disinfectant',
      quantity: 5,
      unit: 'bottles',
      clerkId: USER_IDS.clerkA,
      purpose: 'Ward sanitation',
      createdAt: iso(-1),
    },
  ];

  const requisitions = [
    {
      id: 'Req-Manu-Apr2026-0001',
      title: 'Restock sanitation essentials',
      clerkId: USER_IDS.clerkA,
      clerkName: 'Didier Nsengiyumva',
      location: 'Gasabo',
      status: 'submitted',
      priority: 'high',
      requestedAt: iso(-3),
      updatedAt: iso(-3),
      supervisorNote: '',
      lines: [
        { description: 'Disinfectant', quantity: 30, unit: 'bottles', estimatedCost: 180000 },
        { description: 'Hand sanitizer', quantity: 20, unit: 'bottles', estimatedCost: 95000 },
      ],
    },
    {
      id: 'Req-Manu-Apr2026-0002',
      title: 'Cold chain replenishment',
      clerkId: USER_IDS.clerkB,
      clerkName: 'Josiane Mukamana',
      location: 'Kicukiro',
      status: 'sentToSupplier',
      priority: 'critical',
      requestedAt: iso(-6),
      updatedAt: iso(-5),
      supervisorNote: 'Approved immediately due to low safety stock.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [{ description: 'Cold chain vaccine box', quantity: 4, unit: 'units', estimatedCost: 1280000 }],
    },
    {
      id: 'Req-Manu-Apr2026-0003',
      title: 'Weekly theatre consumables',
      clerkId: USER_IDS.clerkA,
      clerkName: 'Didier Nsengiyumva',
      location: 'Gasabo',
      status: 'proformaAwaitingClerk',
      priority: 'normal',
      requestedAt: iso(-8),
      updatedAt: iso(-7),
      supervisorNote: 'Approved with theatre forecast.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [
        { description: 'Surgical gloves', quantity: 40, unit: 'boxes', estimatedCost: 420000 },
        { description: 'Syringes 10ml', quantity: 15, unit: 'packs', estimatedCost: 210000 },
      ],
    },
    {
      id: 'Req-Manu-Apr2026-0004',
      title: 'Clinic office restock',
      clerkId: USER_IDS.clerkB,
      clerkName: 'Josiane Mukamana',
      location: 'Kicukiro',
      status: 'paid',
      priority: 'normal',
      requestedAt: iso(-12),
      updatedAt: iso(-9),
      supervisorNote: 'Approved in weekly review.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [{ description: 'Printer paper', quantity: 18, unit: 'reams', estimatedCost: 90000 }],
    },
    {
      id: 'Req-Manu-Apr2026-0005',
      title: 'Maternity ward monthly pack',
      clerkId: USER_IDS.clerkA,
      clerkName: 'Didier Nsengiyumva',
      location: 'Gasabo',
      status: 'closed',
      priority: 'normal',
      requestedAt: iso(-18),
      updatedAt: iso(-11),
      supervisorNote: 'Closed after delivery and invoice verification.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [
        { description: 'Surgical gloves', quantity: 25, unit: 'boxes', estimatedCost: 260000 },
        { description: 'IV fluid', quantity: 20, unit: 'bags', estimatedCost: 340000 },
      ],
    },
    {
      id: 'Req-Manu-Apr2026-0006',
      title: 'Oxygen cylinder service carts',
      clerkId: USER_IDS.clerkA,
      clerkName: 'Didier Nsengiyumva',
      location: 'Gasabo',
      status: 'proformaApproved',
      priority: 'normal',
      requestedAt: iso(-9),
      updatedAt: iso(-4),
      supervisorNote: 'Approved for theatre expansion.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [
        { description: 'Service cart frame', quantity: 6, unit: 'units', estimatedCost: 280000 },
        { description: 'Oxygen bracket kit', quantity: 6, unit: 'kits', estimatedCost: 170000 },
      ],
    },
    {
      id: 'Req-Manu-Apr2026-0007',
      title: 'Disposable gowns bulk order',
      clerkId: USER_IDS.clerkB,
      clerkName: 'Josiane Mukamana',
      location: 'Kicukiro',
      status: 'rejected',
      priority: 'normal',
      requestedAt: iso(-14),
      updatedAt: iso(-6),
      supervisorNote: 'Finance rejected supplier proforma.',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      lines: [{ description: 'Disposable isolation gowns', quantity: 2000, unit: 'units', estimatedCost: 2400000 }],
    },
  ];

  const invoices = [
    {
      id: 'inv_001',
      requisitionId: 'Req-Manu-Apr2026-0003',
      reference: 'PRO-2026-0041',
      type: 'proforma',
      status: 'proformaReceived',
      amount: 630000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-theatre-consumables.pdf',
      deliveryNoteUrl: '',
      finalInvoiceUrl: '',
      createdAt: iso(-7),
      updatedAt: iso(-7),
      paidAt: '',
      notes: 'Awaiting accountant review',
    },
    {
      id: 'inv_002',
      requisitionId: 'Req-Manu-Apr2026-0004',
      reference: 'PRO-2026-0037',
      type: 'proforma',
      status: 'paid',
      amount: 90000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-clinic-paper.pdf',
      deliveryNoteUrl: 'delivery-clinic-paper.pdf',
      finalInvoiceUrl: '',
      createdAt: iso(-10),
      updatedAt: iso(-9),
      paidAt: iso(-9),
      notes: 'Paid and waiting final invoice',
    },
    {
      id: 'inv_003',
      requisitionId: 'Req-Manu-Apr2026-0005',
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
      createdAt: iso(-16),
      updatedAt: iso(-11),
      paidAt: iso(-12),
      notes: 'Fully closed workflow',
    },
    {
      id: 'inv_004',
      requisitionId: 'Req-Manu-Apr2026-0006',
      reference: 'PRO-2026-0188',
      type: 'proforma',
      status: 'proformaApproved',
      amount: 450000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-oxygen-carts.pdf',
      deliveryNoteUrl: '',
      finalInvoiceUrl: '',
      createdAt: iso(-5),
      updatedAt: iso(-4),
      paidAt: '',
      notes: 'Approved by finance — awaiting payment release.',
    },
    {
      id: 'inv_005',
      requisitionId: 'Req-Manu-Apr2026-0007',
      reference: 'PRO-2026-0201',
      type: 'proforma',
      status: 'rejected',
      amount: 2400000,
      currency: 'RWF',
      supplierId: USER_IDS.supplier,
      supplierName: 'MediSupply Rwanda',
      attachmentUrl: 'proforma-gowns-bulk.pdf',
      deliveryNoteUrl: '',
      finalInvoiceUrl: '',
      createdAt: iso(-7),
      updatedAt: iso(-6),
      paidAt: '',
      notes: 'Rejected: unit price exceeds contracted ceiling for gowns.',
    },
  ];

  const messages = [
    {
      id: 'msg_001',
      role: 'clerk',
      title: 'Supervisor requested justification',
      body: 'Add unit cost notes for sanitation requisition before 3 PM review.',
      createdAt: iso(-1),
      from: 'Supervisor desk',
    },
    {
      id: 'msg_002',
      role: 'supervisor',
      title: 'Critical stock threshold reached',
      body: 'Cold chain vaccine box dropped below minimum stock in Kicukiro.',
      createdAt: iso(-2),
      from: 'Auto alert',
    },
    {
      id: 'msg_003',
      role: 'accountant',
      title: 'Supplier uploaded proforma',
      body: 'Theatre consumables proforma is waiting for approval and payment.',
      createdAt: iso(-1),
      from: 'Supplier portal',
    },
    {
      id: 'msg_004',
      role: 'supplier',
      title: 'Payment released',
      body: 'Clinic office restock payment was marked as paid. Prepare dispatch documents.',
      createdAt: iso(-8),
      from: 'Finance',
    },
    {
      id: 'msg_005',
      role: 'admin',
      title: 'Weekly executive digest',
      body: '3 requisitions are open, 1 paid, and 2 items need restock attention.',
      createdAt: iso(-1),
      from: 'System digest',
    },
  ];

  const notifications = [
    {
      id: 'ntf_001',
      role: 'clerk',
      severity: 'warn',
      title: 'Near expiry alert',
      body: 'Disinfectant expires within 19 days.',
      createdAt: iso(-1),
    },
    {
      id: 'ntf_002',
      role: 'supervisor',
      severity: 'neutral',
      title: 'Approval queue updated',
      body: 'A new requisition was submitted from Warehouse A.',
      createdAt: iso(-1),
    },
    {
      id: 'ntf_003',
      role: 'accountant',
      severity: 'ok',
      title: 'Payment confirmed',
      body: 'Clinic office restock payment cleared successfully.',
      createdAt: iso(-9),
    },
    {
      id: 'ntf_004',
      role: 'supplier',
      severity: 'neutral',
      title: 'Delivery note required',
      body: 'Upload delivery note for PRO-2026-0037.',
      createdAt: iso(-9),
    },
    {
      id: 'ntf_admin_001',
      role: 'admin',
      severity: 'bad',
      title: 'Unauthorized Login Attempt',
      body: 'A sign-in was attempted from Kyiv, UA using your admin credentials. If this was not you, secure the account immediately.',
      createdAt: iso(0, 0, -2),
    },
    {
      id: 'ntf_admin_002',
      role: 'admin',
      severity: 'warn',
      title: 'Low Stock: Gasket-X9',
      body: 'Current on-hand 42 units vs. minimum 80. Velocity suggests stockout in ~6 days at current consumption.',
      createdAt: iso(0, 0, -45),
    },
    {
      id: 'ntf_admin_003',
      role: 'admin',
      severity: 'warn',
      title: 'Delayed Shipment',
      body: 'Shipment SHP-2026-4412 is 2 days behind schedule. Revised ETA: Thursday 14:00 (Kigali).',
      createdAt: iso(0, -2),
    },
    {
      id: 'ntf_admin_004',
      role: 'admin',
      severity: 'ok',
      title: 'System Backup Complete',
      body: 'Nightly backup finished successfully. 2.4 TB archived to cold storage (KGL-DR-01).',
      createdAt: iso(0, -5),
    },
    ...Array.from({ length: 20 }, (_, i) => ({
      id: `ntf_admin_info_${i}`,
      role: 'admin',
      severity: 'neutral',
      title: ['Digest posted', 'API quota healthy', 'Certificate renewed', 'Sync job OK', 'Report exported'][i % 5],
      body: 'No action required. This is an informational system notice.',
      createdAt: iso(-1, -(i % 12) - 1),
    })),
  ];

  const activity = [
    {
      id: 'act_001',
      action: 'stock.request.created',
      actorId: USER_IDS.clerkA,
      actorName: 'Didier Nsengiyumva',
      meta: { requisitionId: 'Req-Manu-Apr2026-0001', location: 'Gasabo' },
      createdAt: iso(-3),
    },
    {
      id: 'act_002',
      action: 'stock.request.approved',
      actorId: USER_IDS.supervisor,
      actorName: 'Patrick Ndagijimana',
      meta: { requisitionId: 'Req-Manu-Apr2026-0002' },
      createdAt: iso(-5),
    },
    {
      id: 'act_003',
      action: 'invoice.proforma.received',
      actorId: USER_IDS.supplier,
      actorName: 'MediSupply Rwanda',
      meta: { invoiceId: 'inv_001' },
      createdAt: iso(-7),
    },
    {
      id: 'act_004',
      action: 'invoice.paid',
      actorId: USER_IDS.accountant,
      actorName: 'Claudine Mukeshimana',
      meta: { invoiceId: 'inv_002', amount: 90000 },
      createdAt: iso(-9),
    },
    {
      id: 'act_005',
      action: 'workflow.closed',
      actorId: USER_IDS.admin,
      actorName: 'Aline Uwimana',
      meta: { requisitionId: 'Req-Manu-Apr2026-0005', invoiceId: 'inv_003' },
      createdAt: iso(-11),
    },
  ];

  const supplierCatalog = [
    {
      id: 'sl_01',
      name: 'Cold brew concentrate',
      sku: 'CR-9042',
      category: 'Beverages',
      price: 22500,
      quantity: 240,
      minThreshold: 40,
      maxThreshold: 300,
      unit: 'cases',
    },
    {
      id: 'sl_02',
      name: 'Heritage quinoa grain',
      sku: 'PN-2210',
      category: 'Pantry',
      price: 8900,
      quantity: 72,
      minThreshold: 120,
      maxThreshold: 500,
      unit: 'bags',
    },
    {
      id: 'sl_03',
      name: 'Organic spice medley',
      sku: 'SP-7731',
      category: 'Spices',
      price: 14200,
      quantity: 0,
      minThreshold: 30,
      maxThreshold: 180,
      unit: 'jars',
    },
    {
      id: 'sl_04',
      name: 'Nitrile exam gloves',
      sku: 'MED-GLV-204',
      category: 'Medical consumables',
      price: 18500,
      quantity: 1180,
      minThreshold: 200,
      maxThreshold: 1400,
      unit: 'boxes',
    },
    {
      id: 'sl_05',
      name: 'Buffered disinfectant',
      sku: 'MED-DIS-088',
      category: 'Sanitation',
      price: 6200,
      quantity: 44,
      minThreshold: 50,
      maxThreshold: 200,
      unit: 'bottles',
    },
    {
      id: 'sl_06',
      name: 'IV fluid lactated ringers',
      sku: 'MED-IV-220',
      category: 'Pharmacy',
      price: 3100,
      quantity: 800,
      minThreshold: 120,
      maxThreshold: 1000,
      unit: 'bags',
    },
    {
      id: 'sl_07',
      name: 'Sterile syringes 10ml',
      sku: 'MED-SYR-010',
      category: 'Medical consumables',
      price: 9500,
      quantity: 18,
      minThreshold: 25,
      maxThreshold: 120,
      unit: 'packs',
    },
    {
      id: 'sl_08',
      name: 'Premium copier stock',
      sku: 'OPS-PAP-500',
      category: 'Office supplies',
      price: 5200,
      quantity: 96,
      minThreshold: 24,
      maxThreshold: 100,
      unit: 'reams',
    },
    {
      id: 'sl_09',
      name: 'Cold chain transport box',
      sku: 'MED-CBOX-090',
      category: 'Cold chain',
      price: 320000,
      quantity: 2,
      minThreshold: 4,
      maxThreshold: 12,
      unit: 'units',
    },
    {
      id: 'sl_10',
      name: 'Wound dressing kit',
      sku: 'MED-WND-441',
      category: 'Medical consumables',
      price: 12800,
      quantity: 340,
      minThreshold: 80,
      maxThreshold: 400,
      unit: 'kits',
    },
    {
      id: 'sl_11',
      name: 'Electrolyte mix sachets',
      sku: 'PN-ELT-902',
      category: 'Pantry',
      price: 4100,
      quantity: 600,
      minThreshold: 100,
      maxThreshold: 800,
      unit: 'boxes',
    },
    {
      id: 'sl_12',
      name: 'Smoked paprika bulk',
      sku: 'SP-991-W',
      category: 'Spices',
      price: 7600,
      quantity: 8,
      minThreshold: 20,
      maxThreshold: 150,
      unit: 'kg',
    },
  ];

  return {
    version: STATE_VERSION,
    companies,
    selectedCompanyId: TENANTS.hospital,
    users,
    stockItems,
    supplierCatalog,
    consumptions,
    requisitions,
    invoices,
    messages,
    notifications,
    activity,
    masterStock: DEFAULT_MASTER_STOCK,
  };
}

function readStorage() {
  if (typeof window === 'undefined') return createInitialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed?.version === 6) {
      parsed.version = 7;
      parsed.companies = (parsed.companies || []).map((c) => ({
        ...c,
        linkedSupplierCompanyIds: Array.isArray(c.linkedSupplierCompanyIds) ? c.linkedSupplierCompanyIds : [],
      }));
      if (!parsed.users?.some((u) => u.id === USER_IDS.supplierTeletech)) {
        parsed.users = [
          ...(parsed.users || []),
          {
            id: USER_IDS.supplierTeletech,
            incrementalId: 7,
            fullName: 'Teletech Info',
            companyName: 'Teletech Rwanda',
            email: 'info.teletech.rw@gmail.com',
            role: 'supplier',
            isActive: true,
            team: 'Sales',
            location: 'HQ Kigali',
            companyId: TENANTS.teletech,
          },
        ];
      }
      if (!parsed.companies?.some((c) => c.id === TENANTS.teletech)) {
        parsed.companies = [
          ...(parsed.companies || []),
          {
            id: TENANTS.teletech,
            name: 'Teletech Rwanda',
            type: 'Supplier',
            industry: 'Technology',
            language: 'EN',
            currency: 'RWF',
            usersLimit: 5,
            isPlatformTenant: false,
            isSupplierCompany: true,
            location: 'HQ Kigali',
          },
        ];
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    if (parsed?.version !== STATE_VERSION) return createInitialState();
    if (!Array.isArray(parsed.masterStock) || parsed.masterStock.length === 0) {
      parsed.masterStock = DEFAULT_MASTER_STOCK.slice();
    }
    return parsed;
  } catch {
    return createInitialState();
  }
}

let portalState = readStorage();
const listeners = new Set();

function persist(next) {
  portalState = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener(portalState));
}

function updateState(updater) {
  const next = typeof updater === 'function' ? updater(portalState) : updater;
  persist(next);
}

function addActivity(next, action, actorId, actorName, meta = {}) {
  next.activity = [
    {
      id: `act_${Date.now()}`,
      action,
      actorId,
      actorName,
      meta,
      createdAt: new Date().toISOString(),
    },
    ...next.activity,
  ];
}

function addNotification(next, role, title, body, severity = 'neutral') {
  next.notifications = [
    {
      id: `ntf_${Date.now()}_${role}`,
      role,
      title,
      body,
      severity,
      createdAt: new Date().toISOString(),
    },
    ...next.notifications,
  ];
}

function addMessage(next, role, title, body, from) {
  next.messages = [
    {
      id: `msg_${Date.now()}_${role}`,
      role,
      title,
      body,
      from,
      createdAt: new Date().toISOString(),
    },
    ...next.messages,
  ];
}

function withUserName(userId) {
  const user = portalState.users.find((item) => item.id === userId);
  return user?.fullName || user?.email || 'System';
}

export function usePortalState() {
  const [state, setState] = useState(portalState);

  useEffect(() => {
    const listener = (next) => setState(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}

export function resetPortalState() {
  persist(createInitialState());
}

export function getPortalState() {
  return portalState;
}

export function getMessagesForRole(role) {
  return portalState.messages.filter((message) => message.role === role);
}

export function getNotificationsForRole(role) {
  return portalState.notifications.filter((note) => note.role === role);
}

export function getUserName(userId) {
  return withUserName(userId);
}

/** Admin-only: append a catalog template (name + category). Clerks/supervisors pick from here when adding stock. */
export function addMasterCatalogItem(payload, actorId = USER_IDS.admin) {
  updateState((state) => {
    const next = structuredClone(state);
    next.masterStock = Array.isArray(next.masterStock) ? next.masterStock : [];
    const company = next.companies.find((c) => c.id === next.selectedCompanyId);
    const sector =
      (payload && payload.sector) ||
      company?.industry ||
      (typeof company?.type === 'string' ? company.type.split('/')[0].trim() : '') ||
      'General';
    const row = {
      _id: `mstk_${Date.now()}`,
      name: String(payload.name || '').trim(),
      category: String(payload.category || 'Laboratory').trim(),
      unit: payload.unit || 'units',
      sector,
      suggestedMin: Number(payload.suggestedMin) || 10,
      suggestedMax: Number(payload.suggestedMax) || 100,
      description: String(payload.description || ''),
    };
    if (!row.name || !row.category) return state;
    next.masterStock.unshift(row);
    addActivity(next, 'masterStock.item.added', actorId, withUserName(actorId), { name: row.name });
    return next;
  });
}

export function addStockItem(payload, actorId = USER_IDS.clerkA) {
  updateState((state) => {
    const next = structuredClone(state);
    next.stockItems.unshift({
      id: `stk_${Date.now()}`,
      name: payload.name,
      sku: payload.sku || '',
      category: payload.category || 'Uncategorized',
      subcategory: String(payload.subcategory || '').trim(),
      unit: payload.unit || 'units',
      quantity: Number(payload.quantity || 0),
      minThreshold: Number(payload.minThreshold || 0),
      maxThreshold: Number(payload.maxThreshold || 0),
      expiryDate: payload.expiryDate || '',
      location: payload.location || 'Warehouse A',
      department: String(payload.department || '').trim(),
      ownerId: actorId,
      companyId: state.selectedCompanyId,
    });
    addActivity(next, 'stock.item.added', actorId, withUserName(actorId), { name: payload.name });
    const newItem = next.stockItems[0];
    if (newItem.quantity <= newItem.minThreshold) {
      const existingReq = next.requisitions.find(r => r.title === `Auto restock: ${newItem.name}` && r.status === 'submitted');
      if (!existingReq) {
        const qtyToOrder = Math.max(newItem.maxThreshold > 0 ? newItem.maxThreshold - newItem.quantity : newItem.minThreshold || 1, 1);
        next.requisitions.unshift({
          id: nextReqId(next, 'auto'),
          title: `Auto restock: ${newItem.name}`,
          clerkId: actorId,
          clerkName: withUserName(actorId),
          location: newItem.location || 'Warehouse',
          status: 'submitted',
          priority: 'high',
          requestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          supervisorNote: 'Created automatically when stock fell to or below minimum.',
          lines: [{ description: newItem.name, quantity: qtyToOrder, unit: newItem.unit || 'units', estimatedCost: 0 }]
        });
        addNotification(next, 'supervisor', 'Auto requisition created', `Auto restock: ${newItem.name} — please review.`, 'warn');
      }
    }
    return next;
  });
}

export function consumeStockItem(
  { itemId, quantity, purpose, consumptionKind, relatedRequisitionId },
  actorId = USER_IDS.clerkA
) {
  updateState((state) => {
    const next = structuredClone(state);
    const item = next.stockItems.find((entry) => entry.id === itemId);
    if (!item) return next;
    item.quantity = Math.max(0, Number(item.quantity) - Number(quantity || 0));
    const kindRaw = String(consumptionKind || '').toLowerCase();
    const kind = kindRaw === 'usage' || kindRaw === 'bill' ? kindRaw : 'general';
    next.consumptions.unshift({
      id: `con_${Date.now()}`,
      itemId,
      itemName: item.name,
      quantity: Number(quantity || 0),
      unit: item.unit,
      clerkId: actorId,
      purpose: purpose || 'Consumption entry',
      consumptionKind: kind,
      relatedRequisitionId: String(relatedRequisitionId || '').trim(),
      createdAt: new Date().toISOString(),
    });
    addActivity(next, 'stock.item.consumed', actorId, withUserName(actorId), { itemId, quantity: Number(quantity || 0) });
    if (item.quantity <= item.minThreshold) {
      addNotification(next, 'clerk', 'Low stock warning', `${item.name} dropped to ${item.quantity} ${item.unit}.`, 'warn');
      addNotification(next, 'supervisor', 'Stock threshold reached', `${item.name} is now at or below minimum level.`, 'warn');
      
      const existingReq = next.requisitions.find(r => r.title === `Auto restock: ${item.name}` && r.status === 'submitted');
      if (!existingReq) {
        const qtyToOrder = Math.max(item.maxThreshold > 0 ? item.maxThreshold - item.quantity : item.minThreshold || 1, 1);
        next.requisitions.unshift({
          id: nextReqId(next, 'auto'),
          title: `Auto restock: ${item.name}`,
          clerkId: actorId,
          clerkName: withUserName(actorId),
          location: item.location || 'Warehouse',
          status: 'submitted',
          priority: 'high',
          requestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          supervisorNote: 'Created automatically when stock fell to or below minimum.',
          lines: [{ description: item.name, quantity: qtyToOrder, unit: item.unit || 'units', estimatedCost: 0 }]
        });
        addNotification(next, 'supervisor', 'Auto requisition created', `Auto restock: ${item.name} — please review.`, 'warn');
      }
    }
    return next;
  });
}

export function createRequisition(
  { title, lines, priority, location, requestingDepartment, deliveryNote, clerkJustification },
  actorId = USER_IDS.clerkA
) {
  updateState((state) => {
    const next = structuredClone(state);
    const actor = next.users.find((entry) => entry.id === actorId);
    const requisition = {
      id: nextReqId(next, 'manu'),
      title,
      clerkId: actorId,
      clerkName: actor?.fullName || 'Inventory clerk',
      location: location || actor?.location || 'Warehouse',
      status: 'submitted',
      priority: priority || 'normal',
      requestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      supervisorNote: '',
      requestingDepartment: String(requestingDepartment || '').trim(),
      deliveryNote: String(deliveryNote || '').trim(),
      clerkJustification: String(clerkJustification || '').trim(),
      lines: lines.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity || 0),
        unit: line.unit || 'units',
        estimatedCost: Number(line.estimatedCost || 0),
        dateValue: String(line.dateValue || '').trim(),
      })),
    };
    next.requisitions.unshift(requisition);
    addActivity(next, 'stock.request.created', actorId, withUserName(actorId), { requisitionId: requisition.id });
    addNotification(next, 'supervisor', 'New requisition submitted', `${requisition.clerkName} submitted ${requisition.title}.`, 'neutral');
    addMessage(next, 'supervisor', 'Approval needed', `${requisition.title} is waiting in the approval queue.`, requisition.clerkName);
    return next;
  });
}

export function reviewRequisition(requisitionId, decision, note, supplierId) {
  const supervisorActorId = USER_IDS.supervisor;
  updateState((state) => {
    const next = structuredClone(state);
    const req = next.requisitions.find((entry) => entry.id === requisitionId);
    if (!req) return next;
    req.status = decision === 'approved' ? 'sentToSupplier' : 'rejected';
    req.updatedAt = new Date().toISOString();
    req.supervisorNote = note || '';
    if (decision === 'approved') {
      const supId = supplierId || USER_IDS.supplier;
      const supUser = next.users.find((u) => u.id === supId);
      req.supplierId = supId;
      req.supplierName = supUser?.companyName || supUser?.fullName || 'Supplier';
      addNotification(next, 'supplier', 'Approved requisition available', `${req.title} is ready for proforma creation.`, 'neutral');
      addNotification(next, 'accountant', 'Approved request entered workflow', `${req.title} is expected to receive a proforma.`, 'neutral');
      addMessage(
        next,
        'clerk',
        'Requisition approved',
        `${req.title} moved to supplier processing (${req.supplierName}).`,
        'Supervisor'
      );
      addActivity(next, 'stock.request.approved', supervisorActorId, withUserName(supervisorActorId), { requisitionId });
    } else {
      const reason = note?.trim() ? ` ${note.trim()}` : '';
      addNotification(next, 'clerk', 'Requisition rejected', `${req.title} was rejected by the supervisor.${reason}`, 'bad');
      addMessage(
        next,
        'clerk',
        'Requisition rejected',
        note?.trim() || 'No reason was provided. Open Request materials to view the PDF.',
        'Supervisor'
      );
      addActivity(next, 'stock.request.rejected', supervisorActorId, withUserName(supervisorActorId), { requisitionId });
    }
    return next;
  });
}

export function submitSupplierProforma(requisitionId, payload, actorId = USER_IDS.supplier) {
  updateState((state) => {
    const next = structuredClone(state);
    const req = next.requisitions.find((entry) => entry.id === requisitionId);
    if (!req) return next;
    req.status = 'proformaAwaitingClerk';
    req.updatedAt = new Date().toISOString();
    const existing = next.invoices.find((invoice) => invoice.requisitionId === requisitionId && invoice.type === 'proforma');
    if (existing) {
      existing.reference = payload.reference;
      existing.amount = Number(payload.amount || 0);
      existing.attachmentUrl = payload.attachmentUrl || existing.attachmentUrl;
      existing.status = 'proformaReceived';
      existing.updatedAt = new Date().toISOString();
      existing.notes = payload.notes || '';
    } else {
      next.invoices.unshift({
        id: `inv_${Date.now()}`,
        requisitionId,
        reference: payload.reference,
        type: 'proforma',
        status: 'proformaReceived',
        amount: Number(payload.amount || 0),
        currency: 'RWF',
        supplierId: USER_IDS.supplier,
        supplierName: 'MediSupply Rwanda',
        attachmentUrl: payload.attachmentUrl || 'proforma-upload.pdf',
        deliveryNoteUrl: '',
        finalInvoiceUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paidAt: '',
        notes: payload.notes || '',
      });
    }
    addActivity(next, 'invoice.proforma.received', actorId, withUserName(actorId), { requisitionId, reference: payload.reference });
    return next;
  });
}

export function clerkProformaReview(requisitionId, decision, note = '') {
  updateState((state) => {
    const next = structuredClone(state);
    const req = next.requisitions.find((entry) => entry.id === requisitionId);
    if (!req || req.status !== 'proformaAwaitingClerk') return next;
    const inv = next.invoices.find((i) => i.requisitionId === requisitionId && i.type === 'proforma');
    if (decision === 'rejected') {
      req.status = 'rejected';
      req.supervisorNote = String(note || '').trim() || 'Clerk declined the supplier proforma.';
      req.updatedAt = new Date().toISOString();
      if (inv) {
        inv.status = 'rejected';
        inv.updatedAt = new Date().toISOString();
      }
      addNotification(
        next,
        'supplier',
        'Proforma declined by hospital',
        `${req.title}: the clerk declined the proforma.`,
        'bad'
      );
      addActivity(next, 'requisition.clerk_proforma.rejected', req.clerkId, withUserName(req.clerkId), {
        requisitionId,
        invoiceId: inv?.id,
      });
      return next;
    }
    req.status = 'proformaReceived';
    req.updatedAt = new Date().toISOString();
    addNotification(
      next,
      'accountant',
      'Proforma ready for finance',
      `${req.title} was accepted by the clerk — finance can review ${inv?.reference || 'the proforma'}.`,
      'warn'
    );
    addMessage(
      next,
      'accountant',
      'Clerk accepted supplier proforma',
      `${req.title} is ready for finance approval.`,
      req.clerkName || 'Clerk'
    );
    addNotification(
      next,
      'supervisor',
      'Clerk accepted proforma',
      `${req.title} — finance can review ${inv?.reference || 'the supplier proforma'}.`,
      'neutral'
    );
    addActivity(next, 'requisition.clerk_proforma.accepted', req.clerkId, withUserName(req.clerkId), {
      requisitionId,
      invoiceId: inv?.id,
    });
    return next;
  });
}

export function upsertSupplierCatalogItem(payload, actorId = USER_IDS.supplier) {
  updateState((state) => {
    const next = structuredClone(state);
    if (!Array.isArray(next.supplierCatalog)) next.supplierCatalog = [];
    const cat = next.supplierCatalog;
    let id = payload.id || '';
    let idx = id ? cat.findIndex((x) => x.id === id) : -1;
    const isUpdate = idx >= 0;
    if (!isUpdate) {
      id = `sl_${Date.now()}`;
      idx = -1;
    }
    const name = String(payload.name || '').trim() || 'Untitled listing';
    const sku = String(payload.sku || '').trim() || `SKU-${id.replace(/\D/g, '').slice(-6) || 'NEW'}`;
    const maxT = Math.max(1, Math.floor(Number(payload.maxThreshold) || 100));
    let minT = Math.max(0, Math.floor(Number(payload.minThreshold) || 0));
    if (minT > maxT) minT = maxT;
    const row = {
      id,
      name,
      sku,
      category: String(payload.category || 'General').trim() || 'General',
      price: Math.max(0, Number(payload.price) || 0),
      quantity: Math.max(0, Math.floor(Number(payload.quantity) || 0)),
      minThreshold: minT,
      maxThreshold: maxT,
      unit: String(payload.unit || 'units').trim() || 'units',
      description: String(payload.description || ''),
      storageLocation: String(payload.storageLocation || ''),
      listed: payload.listed !== false,
    };
    if (isUpdate) {
      cat[idx] = { ...cat[idx], ...row };
    } else {
      cat.unshift(row);
    }
    addActivity(
      next,
      isUpdate ? 'supplier.catalog.updated' : 'supplier.catalog.created',
      actorId,
      withUserName(actorId),
      { listingId: id, name: row.name }
    );
    return next;
  });
}

export function accountantReviewInvoice(invoiceId, decision, actorId = USER_IDS.accountant) {
  updateState((state) => {
    const next = structuredClone(state);
    const invoice = next.invoices.find((entry) => entry.id === invoiceId);
    if (!invoice) return next;
    invoice.status = decision === 'approved' ? 'proformaApproved' : 'rejected';
    invoice.updatedAt = new Date().toISOString();
    const req = next.requisitions.find((entry) => entry.id === invoice.requisitionId);
    if (req) {
      req.status = decision === 'approved' ? 'proformaApproved' : 'rejected';
      req.updatedAt = new Date().toISOString();
    }
    addNotification(
      next,
      'supplier',
      decision === 'approved' ? 'Proforma approved' : 'Proforma rejected',
      `${invoice.reference} was ${decision} by finance.`,
      decision === 'approved' ? 'ok' : 'bad'
    );
    addActivity(next, `invoice.${decision}`, actorId, withUserName(actorId), { invoiceId });
    return next;
  });
}

export function markInvoicePaid(invoiceId, actorId = USER_IDS.accountant) {
  updateState((state) => {
    const next = structuredClone(state);
    const invoice = next.invoices.find((entry) => entry.id === invoiceId);
    if (!invoice) return next;
    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();
    invoice.updatedAt = new Date().toISOString();
    const req = next.requisitions.find((entry) => entry.id === invoice.requisitionId);
    if (req) {
      req.status = 'paid';
      req.updatedAt = new Date().toISOString();
    }
    addNotification(next, 'supplier', 'Payment received', `${invoice.reference} is marked as paid. Upload delivery documents next.`, 'ok');
    addMessage(next, 'supplier', 'Finance released payment', `${invoice.reference} is cleared for fulfilment.`, 'Finance');
    addActivity(next, 'invoice.paid', actorId, withUserName(actorId), { invoiceId, amount: invoice.amount });
    return next;
  });
}

export function attachDeliveryNote(invoiceId, deliveryNoteUrl, actorId = USER_IDS.supplier) {
  updateState((state) => {
    const next = structuredClone(state);
    const invoice = next.invoices.find((entry) => entry.id === invoiceId);
    if (!invoice) return next;
    invoice.deliveryNoteUrl = deliveryNoteUrl || 'delivery-note.pdf';
    invoice.status = 'deliveryNoteAttached';
    invoice.updatedAt = new Date().toISOString();
    const req = next.requisitions.find((entry) => entry.id === invoice.requisitionId);
    if (req) {
      req.status = 'deliveryNoteAttached';
      req.updatedAt = new Date().toISOString();
    }
    addNotification(next, 'accountant', 'Delivery note uploaded', `${invoice.reference} now has a delivery note attached.`, 'neutral');
    addActivity(next, 'delivery.note.attached', actorId, withUserName(actorId), { invoiceId });
    return next;
  });
}

export function attachFinalInvoice(invoiceId, finalInvoiceUrl, actorId = USER_IDS.supplier) {
  updateState((state) => {
    const next = structuredClone(state);
    const invoice = next.invoices.find((entry) => entry.id === invoiceId);
    if (!invoice) return next;
    invoice.finalInvoiceUrl = finalInvoiceUrl || 'final-invoice.pdf';
    invoice.status = 'closed';
    invoice.type = 'final';
    invoice.updatedAt = new Date().toISOString();
    const req = next.requisitions.find((entry) => entry.id === invoice.requisitionId);
    if (req) {
      req.status = 'closed';
      req.updatedAt = new Date().toISOString();
    }
    addNotification(next, 'admin', 'Workflow closed', `${invoice.reference} completed the full requisition-to-invoice cycle.`, 'ok');
    addActivity(next, 'workflow.closed', actorId, withUserName(actorId), { invoiceId });
    return next;
  });
}

export function inviteUser(payload, actorId = USER_IDS.admin) {
  updateState((state) => {
    const next = structuredClone(state);
    const company = next.companies?.find(c => c.id === state.selectedCompanyId) || next.company;
    const companyUsers = next.users.filter(u => u.companyId === state.selectedCompanyId);
    if (companyUsers.length >= company.usersLimit) return next;
    next.users.push({
      id: `user_${Date.now()}`,
      incrementalId: nextMockUserIncrementalId(next.users),
      fullName: payload.fullName || payload.email,
      email: payload.email,
      role: payload.role,
      isActive: true,
      team: payload.team || 'Operations',
      location: payload.location || 'HQ Kigali',
      department: payload.department || 'General Stores',
      companyId: state.selectedCompanyId,
    });
    addActivity(next, 'user.invited', actorId, withUserName(actorId), { email: payload.email, role: payload.role });
    addNotification(next, 'admin', 'Team updated', `${payload.email} was added as ${payload.role}.`, 'neutral');
    return next;
  });
}

export function toggleUserActive(userId, actorId = USER_IDS.admin) {
  updateState((state) => {
    const next = structuredClone(state);
    const user = next.users.find((entry) => entry.id === userId);
    if (!user || user.role === 'admin') return next;
    user.isActive = !user.isActive;
    addActivity(next, 'user.toggled', actorId, withUserName(actorId), { userId, isActive: user.isActive });
    return next;
  });
}

export function patchWorkspaceUser(userId, patch, actorId = USER_IDS.admin) {
  updateState((state) => {
    const next = structuredClone(state);
    const user = next.users.find((entry) => entry.id === userId);
    if (!user || user.role === 'admin') return next;
    if (patch.fullName !== undefined) user.fullName = String(patch.fullName || '').trim();
    if (patch.team !== undefined) user.team = String(patch.team || '');
    if (patch.location !== undefined) user.location = String(patch.location || '');
    if (patch.role !== undefined) {
      const r = String(patch.role);
      if (['clerk', 'supervisor', 'accountant', 'supplier', 'admin'].includes(r)) user.role = r;
    }
    addActivity(next, 'user.updated', actorId, withUserName(actorId), { userId });
    return next;
  });
}

export function removeWorkspaceUser(userId, actorId = USER_IDS.admin) {
  updateState((state) => {
    const next = structuredClone(state);
    const user = next.users.find((entry) => entry.id === userId);
    if (!user || user.role === 'admin') return next;
    next.users = next.users.filter((u) => u.id !== userId);
    addActivity(next, 'user.deleted', actorId, withUserName(actorId), { deletedUserId: userId });
    return next;
  });
}

export function updateCompanySettings(patch, actorId = USER_IDS.admin) {
  updateState((state) => {
    const next = structuredClone(state);
    const activeIdx = next.companies?.findIndex(c => c.id === state.selectedCompanyId);
    if (activeIdx !== -1) {
      next.companies[activeIdx] = { ...next.companies[activeIdx], ...patch };
    } else {
      next.company = { ...next.company, ...patch };
    }
    addActivity(next, 'company.settings.updated', actorId, withUserName(actorId), patch);
    return next;
  });
}

export function selectCompany(companyId) {
  updateState((state) => {
    return { ...state, selectedCompanyId: companyId };
  });
}

/** Mock Marketplace “Connect”: link a supplier company to the active buyer org (Suppliers + approval dropdown). */
export function connectMarketplaceSupplier(supplierCompanyId) {
  const sid = String(supplierCompanyId || '').trim();
  if (!sid) return;
  updateState((state) => {
    const next = structuredClone(state);
    const cid = next.selectedCompanyId;
    const comp = next.companies.find((c) => c.id === cid);
    if (!comp) return next;
    const cur = Array.isArray(comp.linkedSupplierCompanyIds) ? comp.linkedSupplierCompanyIds : [];
    comp.linkedSupplierCompanyIds = [...new Set([...cur, sid])];
    return next;
  });
}

export function markNotificationRead(notificationId) {
  updateState((state) => {
    const next = structuredClone(state);
    const n = next.notifications.find((entry) => entry.id === notificationId);
    if (n) n.isRead = true;
    return next;
  });
}

