import mongoose from 'mongoose';

const replyAttachmentSchema = new mongoose.Schema(
  {
    url:          { type: String, required: true },
    publicId:     { type: String, default: '' },
    originalName: { type: String, default: '' },
    resourceType: { type: String, default: 'image' }, // image | video | raw (pdf/doc)
    bytes:        { type: Number, default: 0 },
  },
  { _id: false }
);

const replySchema = new mongoose.Schema(
  {
    adminId:     { type: String, default: '' },
    adminName:   { type: String, default: 'Admin' },
    htmlBody:    { type: String, required: true, maxlength: 100000 },
    textBody:    { type: String, default: '', maxlength: 20000 },
    attachments: { type: [replyAttachmentSchema], default: [] },
  },
  { timestamps: true }
);

const contactInquirySchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 120 },
    lastName:  { type: String, required: true, trim: true, maxlength: 120 },
    email:     { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    industry:  { type: String, default: '', trim: true, maxlength: 120 },
    message:   { type: String, required: true, trim: true, maxlength: 8000 },
    /** Attachments the visitor included when submitting (future-facing, currently unused by public form) */
    attachments: { type: [replyAttachmentSchema], default: [] },
    replies:   { type: [replySchema], default: [] },
    status:    { type: String, enum: ['open', 'replied', 'closed'], default: 'open' },
    readAt:    { type: Date, default: null },
  },
  { timestamps: true }
);

contactInquirySchema.index({ createdAt: -1 });
contactInquirySchema.index({ status: 1 });

export default mongoose.models.ContactInquiry || mongoose.model('ContactInquiry', contactInquirySchema);
