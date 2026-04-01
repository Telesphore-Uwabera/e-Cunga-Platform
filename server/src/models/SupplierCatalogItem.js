import mongoose from 'mongoose';

const supplierCatalogItemSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    supplierId: { type: String, ref: 'User', required: true },
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    category: { type: String, default: 'General' },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    minThreshold: { type: Number, default: 0 },
    maxThreshold: { type: Number, default: 100 },
    unit: { type: String, default: 'units' },
    description: { type: String, default: '' },
    storageLocation: { type: String, default: '' },
    listed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.SupplierCatalogItem || mongoose.model('SupplierCatalogItem', supplierCatalogItemSchema);
