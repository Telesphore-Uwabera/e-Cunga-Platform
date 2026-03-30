import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    stockRequestId: { type: String, default: '' },
    supplierId: { type: String, ref: 'User', default: '' },
    createdBy: { type: String, ref: 'User', required: true },
    paidBy: { type: String, ref: 'User', default: '' },
    type: { type: String, enum: ['proforma', 'final'], default: 'proforma' },
    status: { type: String, enum: ['draft', 'sent', 'approved', 'rejected', 'paid'], default: 'draft' },
    reference: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'RWF' },
    notes: { type: String, default: '' },
    attachmentUrl: { type: String, default: '' },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
