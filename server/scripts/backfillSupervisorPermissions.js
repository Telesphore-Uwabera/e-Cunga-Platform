/**
 * Backfill supervisor permissions to include marketplace access (suppliers:all).
 * Usage: node server/scripts/backfillSupervisorPermissions.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { getDefaultPermissions } from '../src/lib/permissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const companies = db.collection('companies');

  const supervisors = await users.find({ role: 'supervisor' }).toArray();
  let updated = 0;

  for (const u of supervisors) {
    const co = u.companyId ? await companies.findOne({ _id: u.companyId }) : null;
    const plan = co?.plan || 'essential';
    const defaults = getDefaultPermissions('supervisor', plan);
    const current = Array.isArray(u.permissions) ? u.permissions : [];
    const merged = [...new Set([...defaults, ...current])];
    if (merged.length === current.length && merged.every((p) => current.includes(p))) continue;
    await users.updateOne({ _id: u._id }, { $set: { permissions: merged } });
    console.log(`Updated ${u.email || u._id}: ${merged.join(', ')}`);
    updated += 1;
  }

  console.log(`Done. Updated ${updated} supervisors.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
