import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    userId: { type: String, ref: 'User', required: true },
    action: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

activityLogSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
