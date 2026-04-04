import mongoose from 'mongoose';

const inviteCredentialSetupSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.InviteCredentialSetup ||
  mongoose.model('InviteCredentialSetup', inviteCredentialSetupSchema);
