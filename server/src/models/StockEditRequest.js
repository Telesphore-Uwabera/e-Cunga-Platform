import mongoose from 'mongoose';

const stockEditRequestSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    stockItemId: { type: String, required: true, index: true },
    stockItemName: { type: String, required: true },
    requestedBy: { type: String, ref: 'User', required: true },
    requestedByName: { type: String, required: true },
    changedFields: {
      quantity: { type: Number },
      minThreshold: { type: Number },
      maxThreshold: { type: Number },
    },
    previousValues: {
      quantity: { type: Number },
      minThreshold: { type: Number },
      maxThreshold: { type: Number },
    },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedById: { type: String, ref: 'User', default: '' },
    reviewerNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.StockEditRequest || mongoose.model('StockEditRequest', stockEditRequestSchema);
