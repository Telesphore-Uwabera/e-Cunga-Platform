/**
 * Recreate / repair the demo accountant user in MongoDB (stable id user_accountant_1).
 * Uses DEMO_EMAIL_ACCOUNTANT, DEMO_PASSWORD, and company from getDemoUserDefinitions().
 *
 * Usage (from server/): node scripts/upsertDemoAccountant.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Company from '../src/models/Company.js';
import User from '../src/models/User.js';
import { getDemoPassword, getDemoUserDefinitions } from '../src/config/demoEnv.js';

const ACCOUNTANT_ID = 'user_accountant_1';

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error('Set MONGODB_URI in server/.env');
    process.exit(1);
  }

  const defs = getDemoUserDefinitions();
  const acc = defs.find((d) => d.role === 'accountant');
  if (!acc) {
    console.error('No accountant entry in demo user definitions.');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const company = await Company.findById(acc.companyId).lean();
  if (!company) {
    console.error(
      `Company "${acc.companyId}" not found. Seed the workspace (SEED_DEMO_WORKSPACE=true or AUTO_SEED_DEMO_IF_EMPTY) or create the company first.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(getDemoPassword(), 10);

  const otherWithEmail = await User.findOne({ email: acc.email, _id: { $ne: ACCOUNTANT_ID } }).select('_id').lean();
  if (otherWithEmail) {
    await User.deleteOne({ _id: otherWithEmail._id });
    console.log('[upsert-accountant] Removed conflicting user with same email:', otherWithEmail._id);
  }

  await User.findOneAndUpdate(
    { _id: ACCOUNTANT_ID },
    {
      _id: ACCOUNTANT_ID,
      companyId: acc.companyId,
      companyName: company.name || acc.companyName,
      fullName: acc.fullName,
      email: acc.email,
      passwordHash,
      role: 'accountant',
      industry: acc.industry,
      team: acc.team,
      location: acc.location,
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('[upsert-accountant] OK');
  console.log('  Email:', acc.email);
  console.log('  User id:', ACCOUNTANT_ID);
  console.log('  Password: (from DEMO_PASSWORD in .env, default Demo@1234)');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
