import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: 'units' },
    estimatedCost: { type: Number, default: 0 },
  },
  { _id: false }
);

export const REQUISITION_STATUSES = [
  'submitted',
  'sentToSupplier',
  'proformaReceived',
  'proformaApproved',
  'rejected',
  'paid',
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
    supplierId: { type: String, ref: 'User', default: '' },
    supplierName: { type: String, default: '' },
    lines: { type: [lineSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.Requisition || mongoose.model('Requisition', requisitionSchema);
