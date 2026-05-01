import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    /** Monotonic display / business key (global sequence). Distinct from `_id`. */
    incrementalId: { type: Number, index: true, unique: true, sparse: true },
    companyId: { type: String, required: true, index: true },
    companyName: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'clerk', 'supervisor', 'accountant', 'supplier'],
    },
    industry: { type: String, default: '' },
    team: { type: String, default: '' },
    location: { type: String, default: '' },
    phone: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    timeZone: { type: String, default: 'Africa/Kigali' },
    notifyEmailDigest: { type: Boolean, default: true },
    notifySecurityAlerts: { type: Boolean, default: true },
    notifyProductUpdates: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    logoUrl: { type: String, default: '' },
    /** Clerk/accountant/supplier must complete OTP activation before signing in (when invited without a manual password). */
    invitePending: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
