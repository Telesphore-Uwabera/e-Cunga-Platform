/**
 * Read-only: clerks vs stock — raw and normalized location::department (Lab/Nurse/Silverback rules).
 *   npm run db:check-clerk-scope -w server
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import StockItem from '../src/models/StockItem.js';
import { normalizeOrgScopePart, userOrgScopeKey } from '../src/services/orgScope.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

function scopeKey(userLike) {
  return userOrgScopeKey(userLike) || '(incomplete — personal-owner view only)';
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

const clerks = await User.find({ role: 'clerk', isActive: true })
  .select('fullName email companyId location department team')
  .sort({ companyId: 1, fullName: 1 })
  .lean();

const stock = await StockItem.find({})
  .select('name companyId location department quantity ownerId')
  .lean();

console.log('=== Active clerks (raw profile → normalized scope key) ===\n');
for (const c of clerks) {
  const rawDept = String(c.department || c.team || '').trim() || '—';
  const rawLoc = String(c.location || '').trim() || '—';
  const key = scopeKey(c);
  const labish =
    /\blab\b/i.test(rawDept) ||
    /laboratory/i.test(rawDept) ||
    /^nurse$/i.test(rawDept);
  const tag = labish ? ' [nurse/lab-ish]' : '';
  console.log(`${c.fullName} <${c.email}> company=${c.companyId}${tag}`);
  console.log(`  location(raw)=${rawLoc} department(raw)=${rawDept}`);
  console.log(`  normalized key: ${key}\n`);
}

const labStock = stock.filter(
  (s) =>
    /lab/i.test(String(s.department || '')) ||
    /laboratory/i.test(String(s.department || '')) ||
    /nurse/i.test(String(s.department || ''))
);

console.log('=== Stock lines with Nurse/Lab/Laboratory in department (sample up to 40) ===\n');
console.log(`Total stock lines: ${stock.length}; nurse/lab-ish dept: ${labStock.length}\n`);
for (const s of labStock.slice(0, 40)) {
  const d = String(s.department || '').trim() || '—';
  const loc = String(s.location || '').trim() || '—';
  const nd = normalizeOrgScopePart(d);
  const nl = normalizeOrgScopePart(loc);
  console.log(`${s.name} | qty=${s.quantity} | loc(raw)=${loc} dept(raw)=${d}`);
  console.log(`  normalized: ${nl}::${nd}\n`);
}

/** Cross-check: for each clerk with complete key, count stock lines matching same key */
console.log('=== Match counts: clerk normalized key → stock lines at that key ===\n');
const stockByNorm = new Map();
for (const s of stock) {
  const k = userOrgScopeKey({ location: s.location, department: s.department, team: '' });
  if (!k) continue;
  stockByNorm.set(k, (stockByNorm.get(k) || 0) + 1);
}

for (const c of clerks) {
  const k = userOrgScopeKey(c);
  if (!k || k.includes('incomplete')) continue;
  const n = stockByNorm.get(k) ?? 0;
  if (/lab/i.test(String(c.department || c.team || '')) || /laboratory/i.test(String(c.department || c.team || ''))) {
    console.log(`Lab-related clerk ${c.fullName}: key=${k} → ${n} stock line(s) at this key`);
  }
}

await mongoose.disconnect();
console.log('\nDone.');
