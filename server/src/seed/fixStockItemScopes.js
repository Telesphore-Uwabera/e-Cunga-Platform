/**
 * fixStockItemScopes.js
 *
 * One-time migration: synchronizes stock item location/department with the 
 * owner's profile scope. This ensures that whatever a clerk adds is 
 * immediately shared with their team (colleagues in the same location/department).
 *
 * WHY THIS IS NEEDED:
 * clerkVisibleRecords() shares stock items across clerks at the same
 * (location, department). If an item was created with a different location 
 * string (e.g. "Warehouse A") than the clerk's profile ("Silverback Mall"),
 * it won't be shared with colleagues, causing split dashboards.
 *
 * Run once:
 *   node server/src/seed/fixStockItemScopes.js
 *
 * Add --dry-run to preview without writing:
 *   node server/src/seed/fixStockItemScopes.js --dry-run
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import StockItem from '../models/StockItem.js';
import Consumption from '../models/Consumption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecunga';

// ── Mirrors the client-side normalization exactly ───────────────────────────
function normalizeMembershipScope(value) {
  const v = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (v === 'nurse' || v === 'nurses') return 'nursing';
  if (v === 'lab' || v === 'labs' || v === 'laboratory') return 'laboratory';
  if (
    v.includes('silverback') ||
    v.includes('silver back') ||
    v.includes('sliverback') ||
    v.includes('siliverback') ||
    v.includes('silverbacl')
  ) return 'silverback mall';
  return v;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB:', MONGODB_URI.replace(/\/\/[^@]+@/, '//***@'));
  if (DRY_RUN) console.log('--- DRY RUN — no writes ---\n');

  // Load all clerk users that have both location and department set.
  const clerks = await User.find({ role: 'clerk', isActive: true })
    .select('_id email fullName location department team')
    .lean();

  const clerkById = new Map(clerks.map((c) => [String(c._id), c]));

  console.log(`Loaded ${clerks.length} active clerk(s).\n`);

  const allItems = await StockItem.find({}).lean();
  console.log(`Analyzing ${allItems.length} stock items...\n`);

  let fixed = 0;
  let skipped = 0;
  let noOwner = 0;
  let alreadyCorrect = 0;

  for (const item of allItems) {
    const owner = clerkById.get(String(item.ownerId || ''));
    if (!owner) {
      noOwner += 1;
      continue;
    }

    const ownerLocationNormalized   = normalizeMembershipScope(owner.location);
    const ownerDepartmentNormalized = normalizeMembershipScope(owner.department || owner.team);
    
    const itemLocationNormalized    = normalizeMembershipScope(item.location);
    const itemDepartmentNormalized  = normalizeMembershipScope(item.department);

    const needsFix = 
      itemLocationNormalized !== ownerLocationNormalized || 
      itemDepartmentNormalized !== ownerDepartmentNormalized;

    if (!needsFix) {
      alreadyCorrect += 1;
      continue;
    }

    const newLocation   = owner.location || '';
    const newDepartment = owner.department || owner.team || '';

    if (!newLocation || !newDepartment) {
      skipped += 1;
      continue;
    }

    console.log(`  ✔  "${item.name}" (${item._id})`);
    console.log(`      Owned by: ${owner.email}`);
    console.log(`      Current:  location="${item.location || '(empty)'}", dept="${item.department || '(empty)'}"`);
    console.log(`      Target:   location="${newLocation}", dept="${newDepartment}"`);

    if (!DRY_RUN) {
      // Fix the stock item
      await StockItem.updateOne(
        { _id: item._id },
        { $set: { location: newLocation, department: newDepartment } }
      );
      // Also fix any consumption records for this item
      await Consumption.updateMany(
        { itemId: item._id },
        { $set: { location: newLocation, department: newDepartment } }
      );
    }
    fixed += 1;
  }

  console.log(`\nSummary:`);
  console.log(`  Already Correct: ${alreadyCorrect}`);
  console.log(`  Fixed:           ${fixed}`);
  console.log(`  Skipped (Profile Issue): ${skipped}`);
  console.log(`  No Clerk Owner:  ${noOwner}`);

  if (fixed > 0 && !DRY_RUN) {
    console.log('\nNext steps:');
    console.log('  1. Have each clerk refresh their browser.');
    console.log('  2. Dashboards should now show the full shared pool.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
