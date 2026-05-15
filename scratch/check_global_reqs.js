import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Requisition from '../server/src/models/Requisition.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const all = await Requisition.find({ _id: /^Req-Manu-May2026-/ }).select('_id companyId').lean();
  console.log('All May 2026 Requisitions:', JSON.stringify(all, null, 2));

  await mongoose.disconnect();
}
run();
