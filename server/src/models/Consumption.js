import mongoose from 'mongoose';

const consumptionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    itemId: { type: String, required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'units' },
    location: { type: String, default: '' },
    department: { type: String, default: '' },
    clerkId: { type: String, ref: 'User', required: true },
    purpose: { type: String, default: '' },
    /** Distinguishes chargeable bills from operational usage logs (both reduce on-hand). */
    consumptionKind: { type: String, enum: ['usage', 'bill', 'general'], default: 'general' },
    relatedRequisitionId: { type: String, default: '' },
  },
  { timestamps: true }
);

// Optimize for dashboard trends and historical reports
consumptionSchema.index({ companyId: 1, location: 1, department: 1, createdAt: -1 });
consumptionSchema.index({ itemId: 1, createdAt: -1 });
consumptionSchema.index({ clerkId: 1, createdAt: -1 });

export default mongoose.models.Consumption || mongoose.model('Consumption', consumptionSchema);
