import mongoose from 'mongoose';

const stockItemSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    category: { type: String, default: 'Uncategorized' },
    unit: { type: String, default: 'units' },
    quantity: { type: Number, default: 0 },
    minThreshold: { type: Number, default: 0 },
    maxThreshold: { type: Number, default: 0 },
    expiryDate: { type: String, default: '' },
    location: { type: String, default: '' },
    ownerId: { type: String, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.models.StockItem || mongoose.model('StockItem', stockItemSchema);
