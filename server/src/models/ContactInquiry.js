import mongoose from 'mongoose';

const contactInquirySchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 120 },
    lastName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    industry: { type: String, default: '', trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 8000 },
  },
  { timestamps: true }
);

contactInquirySchema.index({ createdAt: -1 });

export default mongoose.models.ContactInquiry || mongoose.model('ContactInquiry', contactInquirySchema);
