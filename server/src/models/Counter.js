import mongoose from 'mongoose';

/** Atomic sequence for auto-incrementing numeric IDs (e.g. user record numbers). */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: 'counters' }
);

export default mongoose.models.Counter || mongoose.model('Counter', counterSchema);
