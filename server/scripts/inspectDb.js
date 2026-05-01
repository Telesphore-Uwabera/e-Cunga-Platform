/**
 * Read-only snapshot of MongoDB (uses MONGODB_URI from .env).
 *   node scripts/inspectDb.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

function redactUri(u) {
  try {
    const parsed = new URL(u);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return '(invalid uri)';
  }
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;
const name = db.databaseName;

console.log('Database:', name);
console.log('URI (redacted):', redactUri(uri));
console.log('');

const cols = (await db.listCollections().toArray())
  .map((c) => c.name)
  .filter((n) => !n.startsWith('system.'))
  .sort();

const counts = [];
for (const collection of cols) {
  const n = await db.collection(collection).countDocuments();
  counts.push({ collection, n });
}

console.log('Collections & document counts:');
for (const { collection, n } of counts) {
  console.log(`  ${collection}: ${n}`);
}

const User = (await import('../src/models/User.js')).default;
const Company = (await import('../src/models/Company.js')).default;

const companies = await Company.find({}).select('name registrationStatus isPlatformTenant logoUrl currency').lean();
console.log('\nCompanies (' + companies.length + '):');
for (const c of companies) {
  console.log(
    `  _id=${c._id} name=${JSON.stringify(c.name)} status=${c.registrationStatus} platform=${Boolean(c.isPlatformTenant)} currency=${c.currency || ''}`
  );
  if (c.logoUrl) console.log(`    logoUrl=${c.logoUrl}`);
}

const users = await User.find({})
  .select('email fullName role companyId companyName isActive incrementalId logoUrl')
  .sort({ incrementalId: 1 })
  .lean();
console.log('\nUsers (' + users.length + '):');
for (const u of users) {
  console.log(
    `  #${u.incrementalId ?? '?'} ${u.email} | ${u.fullName} | ${u.role} | company=${u.companyId} active=${u.isActive !== false}`
  );
  if (u.logoUrl) console.log(`    logoUrl=${u.logoUrl}`);
}

await mongoose.disconnect();
console.log('\nDone.');
