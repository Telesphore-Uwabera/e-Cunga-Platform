import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Requisition from '../server/src/models/Requisition.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const count = await Requisition.countDocuments({ 
    $or: [
      { companyId: { $in: [null, ''] } },
      { companyId: { $exists: false } }
    ]
  });
  console.log('Requisitions with empty companyId:', count);

  await mongoose.disconnect();
}
run();
