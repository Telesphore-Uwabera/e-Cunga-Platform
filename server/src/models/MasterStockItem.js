import mongoose from 'mongoose';

const masterStockItemSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    unit: { type: String, default: 'units' },
    sector: { type: String, default: 'General' }, // e.g., 'Healthcare', 'Enterprise', 'Hospitality'
    description: { type: String, default: '' },
    suggestedMin: { type: Number, default: 10 },
    suggestedMax: { type: Number, default: 100 },
  },
  { timestamps: true }
);

export default mongoose.models.MasterStockItem || mongoose.model('MasterStockItem', masterStockItemSchema);
