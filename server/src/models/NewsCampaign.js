import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    contentType: { type: String, trim: true, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const newsCampaignSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    headline: { type: String, required: true, trim: true, maxlength: 200 },
    bodyHtml: { type: String, required: true, maxlength: 50000 },
    bodyText: { type: String, default: '', maxlength: 50000 },
    heroImageUrl: { type: String, trim: true, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'sending', 'sent', 'failed'],
      default: 'draft',
    },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    sentAt: { type: Date },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

newsCampaignSchema.index({ createdAt: -1 });
newsCampaignSchema.index({ status: 1 });

export default mongoose.model('NewsCampaign', newsCampaignSchema);
