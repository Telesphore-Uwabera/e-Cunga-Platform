/**
 * Drops all collections in the database named by MONGODB_URI.
 * Safety: set CONFIRM_DB_RESET=YES in the environment.
 *
 * Usage (PowerShell): $env:CONFIRM_DB_RESET='YES'; node scripts/resetWorkspaceDb.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}
if (process.env.CONFIRM_DB_RESET !== 'YES') {
  console.error('Refusing to run: set CONFIRM_DB_RESET=YES to drop all collections.');
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const cols = await db.listCollections().toArray();
for (const { name } of cols) {
  if (name.startsWith('system.')) continue;
  await db.dropCollection(name);
  console.log('Dropped collection:', name);
}
await mongoose.disconnect();
console.log('Database reset complete.');
