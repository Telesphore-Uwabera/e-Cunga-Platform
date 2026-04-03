import mongoose from 'mongoose';

const portalChatThreadSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    /** Exactly two user ids, sorted ascending (stable thread key). */
    participantIds: { type: [String], required: true },
    lastMessageAt: { type: Date, default: () => new Date() },
    lastPreview: { type: String, default: '' },
  },
  { timestamps: true }
);

portalChatThreadSchema.index({ companyId: 1, participantIds: 1 });

export default mongoose.models.PortalChatThread || mongoose.model('PortalChatThread', portalChatThreadSchema);
