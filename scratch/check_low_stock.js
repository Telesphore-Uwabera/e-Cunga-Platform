import mongoose from 'mongoose';
import dotenv from 'dotenv';
import StockItem from '../server/src/models/StockItem.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const lowItems = await StockItem.find({
    $expr: { $lte: ['$quantity', '$minThreshold'] }
  }).lean();
  
  console.log('Low Stock Items:', JSON.stringify(lowItems.map(i => ({
    name: i.name,
    quantity: i.quantity,
    minThreshold: i.minThreshold,
    companyId: i.companyId
  })), null, 2));

  await mongoose.disconnect();
}
run();
