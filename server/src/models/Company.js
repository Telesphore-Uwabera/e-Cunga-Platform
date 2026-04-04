import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, default: 'Healthcare / enterprise' },
    industry: { type: String, default: 'Healthcare' },
    language: { type: String, default: 'EN' },
    currency: { type: String, default: 'RWF' },
    usersLimit: { type: Number, default: 10 },
    /** New self-serve signups stay pending until a platform-tenant supervisor approves. */
    registrationStatus: {
      type: String,
      enum: ['pending', 'active'],
      default: 'active',
    },
    /** Supervisors in this company can approve pending company registrations (e-CUNGA operations workspace). */
    isPlatformTenant: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Company || mongoose.model('Company', companySchema);
