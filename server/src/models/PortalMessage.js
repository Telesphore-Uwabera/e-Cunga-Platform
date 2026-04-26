import mongoose from 'mongoose';

const portalMessageSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    role: { type: String, required: true, index: true },
    userId: { type: String, ref: 'User', index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    from: { type: String, default: 'System' },
  },
  { timestamps: true }
);

export default mongoose.models.PortalMessage || mongoose.model('PortalMessage', portalMessageSchema);
