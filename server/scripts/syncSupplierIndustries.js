/**
 * One-time backfill: align Company.industry with active supplier User.industry
 * when company still has legacy "Supplier" or empty industry.
 *
 * Usage: node server/scripts/syncSupplierIndustries.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { canonicalIndustryFromInput, industryDisplayLabel } from '../src/lib/industry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

const PLACEHOLDER = new Set(['', 'supplier']);

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const companies = db.collection('companies');
  const users = db.collection('users');

  const supplierCos = await companies
    .find({
      $or: [{ isSupplierCompany: true }, { type: 'Supplier' }],
    })
    .toArray();

  let updated = 0;
  for (const co of supplierCos) {
    const coIndustry = String(co.industry || '').trim();
    if (coIndustry && !PLACEHOLDER.has(coIndustry.toLowerCase())) continue;

    const supplierUser = await users.findOne({
      companyId: co._id,
      role: 'supplier',
      isActive: true,
    });

    const userIndustry = supplierUser?.industry;
    if (!userIndustry || PLACEHOLDER.has(String(userIndustry).toLowerCase())) continue;

    const synced = canonicalIndustryFromInput(industryDisplayLabel(userIndustry) || userIndustry);
    await companies.updateOne({ _id: co._id }, { $set: { industry: synced } });
    await users.updateMany({ companyId: co._id, role: 'supplier' }, { $set: { industry: synced } });
    console.log(`Synced ${co.name} (${co._id}) -> ${synced}`);
    updated += 1;
  }

  console.log(`Done. Updated ${updated} supplier companies.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
