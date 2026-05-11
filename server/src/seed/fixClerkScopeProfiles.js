/**
 * fixClerkScopeProfiles.js
 *
 * One-time migration: sets `location` and `department` on the four clerk
 * accounts at Silverback Mall so they share the correct dashboard pool.
 *
 * WHY THIS IS NEEDED:
 * The clerk dashboard uses clerkVisibleRecords() which merges stock data
 * across all clerks that share the same (location, department) pair.
 * If either field is blank the function falls back to personal-only
 * visibility — so each clerk sees different totals and trends even though
 * they work in the same room on the same inventory.
 *
 * Run once:
 *   node server/src/seed/fixClerkScopeProfiles.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecunga';

// ─────────────────────────────────────────────────────────────────────────────
// Edit these entries to match your actual database records.
// location  → must match the location stored on stock items they manage.
// department → must match the department stored on stock items they manage.
// Both values are normalised to lowercase before comparison, so capitalisation
// here does not matter — use whatever looks best in the UI.
// ─────────────────────────────────────────────────────────────────────────────
const CLERK_PROFILES = [
  // Laboratory Technicians ─ Silverback Mall
  {
    email: 'ayinkachriss@gmail.com',
    location: 'Silverback Mall',
    department: 'Laboratory',
  },
  {
    email: 'donathauwineza899@gmail.com',
    location: 'Silverback Mall',
    department: 'Laboratory',
  },
  // Nursing ─ Silverback Mall
  {
    email: 'irenefiston16@gmail.com',
    location: 'Silverback Mall',
    department: 'Nursing',
  },
  {
    email: 'fiacre@ivuriro.rw',
    location: 'Silverback Mall',
    department: 'Nursing',
  },
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB:', MONGODB_URI.replace(/\/\/[^@]+@/, '//***@'));

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const profile of CLERK_PROFILES) {
    const existing = await User.findOne({ email: profile.email.toLowerCase() })
      .select('email role location department fullName')
      .lean();

    if (!existing) {
      console.warn(`⚠  User not found: ${profile.email}`);
      notFound += 1;
      continue;
    }

    const alreadySet =
      existing.location === profile.location &&
      existing.department === profile.department;

    if (alreadySet) {
      console.log(`✓  ${profile.email} — already correct (${profile.location} / ${profile.department})`);
      skipped += 1;
      continue;
    }

    await User.updateOne(
      { email: profile.email.toLowerCase() },
      { $set: { location: profile.location, department: profile.department } }
    );

    console.log(
      `✔  ${profile.email} (${existing.fullName})\n` +
      `   location:   "${existing.location || '(empty)'}" → "${profile.location}"\n` +
      `   department: "${existing.department || '(empty)'}" → "${profile.department}"`
    );
    updated += 1;
  }

  console.log(`\nDone. Updated: ${updated}  Skipped: ${skipped}  Not found: ${notFound}`);
  console.log('\nNext steps:');
  console.log('  1. Verify the changes in the Admin → Users panel.');
  console.log('  2. Ask each clerk to refresh their browser (or re-login).');
  console.log('  3. Their dashboards will now show the shared pool for their dept/location.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
