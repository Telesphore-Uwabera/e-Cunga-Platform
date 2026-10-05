import mongoose from 'mongoose';

const trustedPartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    websiteUrl: { type: String, trim: true, default: '', maxlength: 500 },
    logoUrl: { type: String, required: true, trim: true, maxlength: 800 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

trustedPartnerSchema.index({ isActive: 1, sortOrder: 1, name: 1 });

export default mongoose.model('TrustedPartner', trustedPartnerSchema);
