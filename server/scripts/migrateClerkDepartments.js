/**
 * One-time / maintenance: align department labels with workspace rules.
 * - Clerks at Silverback (any common spelling) with empty department+team → department "Laboratory"
 * - Clerks with department or team exactly "Nurse" (case-insensitive) → department "Nursing"
 * - Stock items with department exactly "Nurse" (case-insensitive) → "Nursing"
 *
 *   npm run db:migrate-clerk-depts -w server
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import StockItem from '../src/models/StockItem.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

function isSilverbackLocation(loc) {
  const v = String(loc || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return (
    v.includes('silverback') ||
    v === 'silver back' ||
    v.includes('sliverback')
  );
}

function isEmptyScopeField(v) {
  return !String(v ?? '').trim();
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

let labClerks = 0;
let nurseClerks = 0;

const clerkCandidates = await User.find({
  role: 'clerk',
  isActive: { $ne: false },
}).lean();

for (const u of clerkCandidates) {
  const dept = String(u.department || '').trim();
  const team = String(u.team || '').trim();
  const loc = u.location;

  const nurseDept = /^nurse$/i.test(dept);
  const nurseTeam = /^nurse$/i.test(team);
  if (nurseDept || nurseTeam) {
    const patch = { department: 'Nursing' };
    if (nurseTeam) patch.team = '';
    await User.updateOne({ _id: u._id }, { $set: patch });
    nurseClerks += 1;
    console.log(`Clerk → Nursing: ${u.fullName} <${u.email}>`);
    continue;
  }

  if (isEmptyScopeField(dept) && isEmptyScopeField(team) && isSilverbackLocation(loc)) {
    await User.updateOne({ _id: u._id }, { $set: { department: 'Laboratory' } });
    labClerks += 1;
    console.log(`Clerk → Laboratory (was empty @ Silverback): ${u.fullName} <${u.email}>`);
  }
}

const stockRes = await StockItem.updateMany(
  { department: { $regex: /^nurse$/i } },
  { $set: { department: 'Nursing' } }
);

console.log('\nSummary:');
console.log(`  Clerks set to Laboratory: ${labClerks}`);
console.log(`  Clerks set to Nursing: ${nurseClerks}`);
console.log(`  Stock lines Nurse→Nursing: ${stockRes.modifiedCount}`);

await mongoose.disconnect();
console.log('\nDone.');
