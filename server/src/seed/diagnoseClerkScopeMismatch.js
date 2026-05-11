/**
 * diagnoseClerkScopeMismatch.js
 *
 * Diagnostic: shows exactly what each clerk's dashboard pool contains,
 * why two clerks in the same dept/location might see different numbers,
 * and which stock items are causing the divergence.
 *
 * Run:
 *   node server/src/seed/diagnoseClerkScopeMismatch.js
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

function clerkVisibleItems(allItems, actor) {
  const actorId = String(actor._id).trim();
  const actorLocation   = normalizeMembershipScope(actor.location);
  const actorDepartment = normalizeMembershipScope(actor.department || actor.team);

  if (!actorLocation || !actorDepartment) {
    return allItems.filter((item) => String(item.ownerId || '').trim() === actorId);
  }

  return allItems.filter((item) => {
    if (String(item.ownerId || '').trim() === actorId) return true;
    const itemLoc  = normalizeMembershipScope(item.location);
    const itemDept = normalizeMembershipScope(item.department || '');
    return itemLoc === actorLocation && itemDept === actorDepartment;
  });
}

function clerkVisibleConsumptions(allCons, actor) {
  const actorId = String(actor._id).trim();
  const actorLocation   = normalizeMembershipScope(actor.location);
  const actorDepartment = normalizeMembershipScope(actor.department || actor.team);

  if (!actorLocation || !actorDepartment) {
    return allCons.filter((c) => String(c.clerkId || '').trim() === actorId);
  }

  return allCons.filter((c) => {
    if (String(c.clerkId || '').trim() === actorId) return true;
    const cLoc  = normalizeMembershipScope(c.location);
    const cDept = normalizeMembershipScope(c.department || '');
    return cLoc === actorLocation && cDept === actorDepartment;
  });
}

// The 4 accounts we want to check
const TARGET_EMAILS = [
  'ayinkachriss@gmail.com',
  'donathauwineza899@gmail.com',
  'irenefiston16@gmail.com',
  'fiacre@ivuriro.rw',
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const clerks = await User.find({ email: { $in: TARGET_EMAILS } })
    .select('_id email fullName location department team role')
    .lean();

  const clerkIds = clerks.map((c) => String(c._id));

  // Load ALL stock items for this company (companyId from first clerk's records)
  const allItems = await StockItem.find({}).lean();
  const allCons  = await Consumption.find({}).lean();

  console.log(`Total stock items in DB: ${allItems.length}`);
  console.log(`Total consumptions in DB: ${allCons.length}\n`);

  const groups = {};

  for (const clerk of clerks) {
    const key = `${normalizeMembershipScope(clerk.location)}::${normalizeMembershipScope(clerk.department || clerk.team)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(clerk);
  }

  for (const [scopeKey, members] of Object.entries(groups)) {
    console.log('═'.repeat(70));
    console.log(`SCOPE: ${scopeKey}`);
    console.log('═'.repeat(70));

    const perMemberItems = members.map((clerk) => {
      const visible = clerkVisibleItems(allItems, clerk);
      const ownedOnly = visible.filter((i) => String(i.ownerId) === String(clerk._id));
      const sharedPool = visible.filter((i) => String(i.ownerId) !== String(clerk._id));
      const totalUnits = visible.reduce((s, i) => s + Number(i.quantity || 0), 0);

      const cons = clerkVisibleConsumptions(allCons, clerk);

      return { clerk, visible, ownedOnly, sharedPool, totalUnits, cons };
    });

    for (const { clerk, visible, ownedOnly, sharedPool, totalUnits, cons } of perMemberItems) {
      console.log(`\n  ▶ ${clerk.email} (${clerk.fullName})`);
      console.log(`    Profile location  : "${clerk.location}" → "${normalizeMembershipScope(clerk.location)}"`);
      console.log(`    Profile department: "${clerk.department || clerk.team}" → "${normalizeMembershipScope(clerk.department || clerk.team)}"`);
      console.log(`    Visible items     : ${visible.length}  (${ownedOnly.length} personal + ${sharedPool.length} shared)`);
      console.log(`    Total units       : ${totalUnits.toLocaleString()}`);
      console.log(`    Visible consump.  : ${cons.length}`);
    }

    // Show divergence
    if (members.length >= 2) {
      const [a, b] = perMemberItems;
      const aIds = new Set(a.visible.map((i) => i._id));
      const bIds = new Set(b.visible.map((i) => i._id));
      const onlyInA = a.visible.filter((i) => !bIds.has(i._id));
      const onlyInB = b.visible.filter((i) => !aIds.has(i._id));

      if (onlyInA.length || onlyInB.length) {
        console.log(`\n  ⚠  DIVERGENCE DETECTED between ${a.clerk.email} and ${b.clerk.email}:`);
        if (onlyInA.length) {
          console.log(`\n  Items only in ${a.clerk.email}'s view (${onlyInA.length}):`);
          for (const item of onlyInA.slice(0, 10)) {
            console.log(`    - "${item.name}" qty=${item.quantity} location="${item.location}" dept="${item.department}" owner=${item.ownerId}`);
          }
          if (onlyInA.length > 10) console.log(`    ... and ${onlyInA.length - 10} more`);
        }
        if (onlyInB.length) {
          console.log(`\n  Items only in ${b.clerk.email}'s view (${onlyInB.length}):`);
          for (const item of onlyInB.slice(0, 10)) {
            console.log(`    - "${item.name}" qty=${item.quantity} location="${item.location}" dept="${item.department}" owner=${item.ownerId}`);
          }
          if (onlyInB.length > 10) console.log(`    ... and ${onlyInB.length - 10} more`);
        }

        // Suggest fix
        console.log(`\n  SUGGESTED FIX: Run fixStockItemScopes.js then re-check`);
        console.log(`  Or bulk-patch items in the diverged sets to have the shared scope fields.`);
      } else {
        console.log(`\n  ✓ Both clerks see exactly the same set of items — no divergence.`);
        console.log(`    (If totals still differ, the dashboard is cached — have clerks refresh.)`);
      }
    }
    console.log();
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
