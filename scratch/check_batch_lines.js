import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Requisition from '../server/src/models/Requisition.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const req = await Requisition.findById('Req-Auto-May2026-0004').lean();
  console.log('Lines in Batch Requisition:', JSON.stringify(req.lines, null, 2));

  await mongoose.disconnect();
}
run();
