import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Requisition from '../server/src/models/Requisition.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const AUTO_TITLE_PREFIX = 'Auto restock: ';
  const deleted = await Requisition.deleteMany({
    title: new RegExp('^' + AUTO_TITLE_PREFIX),
    status: 'submitted'
  });
  
  console.log(`Deleted ${deleted.deletedCount} individual auto-requisitions.`);

  await mongoose.disconnect();
}
run();
