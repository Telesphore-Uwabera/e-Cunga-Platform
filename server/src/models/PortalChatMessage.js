import mongoose from 'mongoose';

const mediaItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    resourceType: { type: String, default: 'image' },
    /** Stored encoding when image was normalized to WebP before upload (`webp` or `original`). */
    format: { type: String, default: '' },
    bytes: { type: Number, default: 0 },
    originalName: { type: String, default: '' },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    emoji: { type: String, required: true },
  },
  { _id: false }
);

const replySnapshotSchema = new mongoose.Schema(
  {
    messageId: { type: String, default: '' },
    senderName: { type: String, default: '' },
    bodySnippet: { type: String, default: '' },
  },
  { _id: false }
);

const portalChatMessageSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    threadId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    body: { type: String, default: '' },
    media: { type: [mediaItemSchema], default: [] },
    replyToId: { type: String, default: null },
    replyToSnapshot: { type: replySnapshotSchema, default: null },
    reactions: { type: [reactionSchema], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

portalChatMessageSchema.index({ threadId: 1, createdAt: 1 });

export default mongoose.models.PortalChatMessage || mongoose.model('PortalChatMessage', portalChatMessageSchema);
