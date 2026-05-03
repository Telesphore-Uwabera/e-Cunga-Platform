import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: 'units' },
    estimatedCost: { type: Number, default: 0 },
    dateValue: { type: String, default: '' },
  },
  { _id: false }
);

export const REQUISITION_STATUSES = [
  'submitted',
  'sentToSupplier',
  'proformaAwaitingClerk',
  'proformaReceived',
  'proformaApproved',
  'rejected',
  'paid',
  'creditPurchase',
  'creditAndPaid',
  'deliveryNoteAttached',
  'closed',
];

const requisitionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    clerkId: { type: String, ref: 'User', required: true },
    clerkName: { type: String, default: '' },
    location: { type: String, default: '' },
    status: { type: String, enum: REQUISITION_STATUSES, default: 'submitted' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
    supervisorNote: { type: String, default: '' },
    requestingDepartment: { type: String, default: '' },
    deliveryNote: { type: String, default: '' },
    clerkJustification: { type: String, default: '' },
    supplierId: { type: String, ref: 'User', default: '' },
    supplierName: { type: String, default: '' },
    /** Set when a supervisor or admin approves or rejects (for PDF / audit). */
    reviewedById: { type: String, ref: 'User', default: '' },
    reviewedByName: { type: String, default: '' },
    reviewedByRole: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    stockUpdated: { type: Boolean, default: false },
    lines: { type: [lineSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.Requisition || mongoose.model('Requisition', requisitionSchema);
