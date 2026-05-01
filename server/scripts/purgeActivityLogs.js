/**
 * Deletes all ActivityLog documents (audit trail used for home-stats trends and activity feeds).
 * Does not remove users, stock, or invoices.
 *
 * Usage: CONFIRM_PURGE_ACTIVITY=YES node scripts/purgeActivityLogs.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import ActivityLog from '../src/models/ActivityLog.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}
if (process.env.CONFIRM_PURGE_ACTIVITY !== 'YES') {
  console.error('Refusing to run: set CONFIRM_PURGE_ACTIVITY=YES to delete all activity logs.');
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const r = await ActivityLog.deleteMany({});
await mongoose.disconnect();
console.log(`[purge-activity] Removed ${r.deletedCount} activity log document(s).`);
