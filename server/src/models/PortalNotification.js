import mongoose from 'mongoose';

const portalNotificationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    role: { type: String, required: true, index: true },
    userId: { type: String, ref: 'User', index: true },
    severity: { type: String, enum: ['ok', 'warn', 'bad', 'neutral'], default: 'neutral' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    /** When both set, only users in this facility department+location see the role broadcast. */
    scopeDepartment: { type: String, default: '' },
    scopeLocation: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.PortalNotification || mongoose.model('PortalNotification', portalNotificationSchema);
