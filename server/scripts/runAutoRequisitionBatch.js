import 'dotenv/config';
import mongoose from 'mongoose';
import { runBatchAutoRequisitions } from '../src/services/autoRequisition.js';

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('Error: MONGODB_URI not found in environment.');
  process.exit(1);
}

console.log('Connecting to database...');
await mongoose.connect(mongoUri);
console.log('Connected.');

console.log('--- STARTING MANUAL BATCH AUTO-REQUISITION ---');
try {
  await runBatchAutoRequisitions();
  console.log('--- BATCH COMPLETE ---');
} catch (error) {
  console.error('--- BATCH FAILED ---');
  console.error(error);
}

await mongoose.disconnect();
console.log('Disconnected.');
process.exit(0);
