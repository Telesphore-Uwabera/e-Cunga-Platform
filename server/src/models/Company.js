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
  },
  { timestamps: true }
);

export default mongoose.models.Company || mongoose.model('Company', companySchema);
