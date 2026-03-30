import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    companyName: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'clerk', 'supervisor', 'accountant', 'supplier'],
    },
    industry: { type: String, default: 'Other' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
