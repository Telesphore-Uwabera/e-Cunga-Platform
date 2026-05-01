/**
 * Creates / updates company_demo_1 and the admin user from DEMO_* env vars.
 * Use after db:reset or on an empty database. Does not drop data.
 *
 *   node scripts/seedDemoWorkspaceOnce.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { seedDemoWorkspace } from '../src/seed/seedDemoWorkspace.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
try {
  await seedDemoWorkspace();
} finally {
  await mongoose.disconnect();
}
