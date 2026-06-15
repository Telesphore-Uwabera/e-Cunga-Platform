import mongoose from 'mongoose';

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'proformaReceived',
  'proformaApproved',
  'rejected',
  'paid',
  'partiallyPaid',
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
    supplierId: { type: String, ref: 'User', default: '', index: true },
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
    amountPaid: { type: Number, default: 0 },
    paymentProofUrl: { type: String, default: '' },
    invoiceNumber: { type: String, default: '' },
    paymentChannel: { type: String, enum: ['bank_transfer', 'mobile_money', 'cash', 'check', 'credit_card', 'other'], default: '' },
    dueDate: { type: Date },
    paymentDeadline: { type: Date },
    installments: [{
      amount: { type: Number, required: true },
      paid: { type: Boolean, default: false },
      paidAt: { type: Date },
      paymentProofUrl: { type: String, default: '' },
      dueDate: { type: Date },
    }],
  },
  { timestamps: true }
);

invoiceSchema.index({ companyId: 1, updatedAt: -1 });
invoiceSchema.index({ supplierId: 1, updatedAt: -1 });

invoiceSchema.pre('save', function syncStockRequestId(next) {
  if (this.requisitionId && !this.stockRequestId) {
    this.stockRequestId = this.requisitionId;
  }
  
  // Auto-generate invoice number when final invoice is attached
  if (this.finalInvoiceUrl && !this.invoiceNumber) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.invoiceNumber = `INV-${year}${month}${day}-${random}`;
  }
  
  next();
});

export default mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
