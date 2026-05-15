import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Requisition from '../server/src/models/Requisition.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const cid = 'company_22533735-c82a-48ce-95d4-f26e1f710417';
  const count = await Requisition.countDocuments({ companyId: cid });
  console.log(`Total Requisitions for Donatha's company (${cid}):`, count);

  if (count > 0) {
    const list = await Requisition.find({ companyId: cid }).select('_id title status createdAt').lean();
    console.log('Requisitions:', JSON.stringify(list, null, 2));
  }

  await mongoose.disconnect();
}
run();
