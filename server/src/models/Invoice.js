import mongoose from 'mongoose';

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'proformaReceived',
  'proformaApproved',
  'rejected',
  'paid',
  'creditPurchase',
  'creditAndPaid',
  'deliveryNoteAttached',
  'closed',
];

const invoiceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    requisitionId: { type: String, default: '', index: true },
    /** Legacy field name kept for compatibility with older clients */
    stockRequestId: { type: String, default: '' },
    supplierId: { type: String, ref: 'User', default: '' },
    createdBy: { type: String, ref: 'User', default: '' },
    paidBy: { type: String, ref: 'User', default: '' },
    type: { type: String, enum: ['proforma', 'final'], default: 'proforma' },
    status: { type: String, enum: INVOICE_STATUSES, default: 'draft' },
    reference: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'RWF' },
    notes: { type: String, default: '' },
    attachmentUrl: { type: String, default: '' },
    deliveryNoteUrl: { type: String, default: '' },
    finalInvoiceUrl: { type: String, default: '' },
    supplierName: { type: String, default: '' },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

invoiceSchema.pre('save', function syncStockRequestId(next) {
  if (this.requisitionId && !this.stockRequestId) {
    this.stockRequestId = this.requisitionId;
  }
  next();
});

export default mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
