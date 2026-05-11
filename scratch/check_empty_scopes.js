import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Consumption from '../server/src/models/Consumption.js';
import StockItem from '../server/src/models/StockItem.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const badCons = await Consumption.find({ 
    $or: [
      { location: { $in: [null, ''] } }, 
      { department: { $in: [null, ''] } }
    ] 
  }).lean();
  
  console.log('Bad Consumptions:', JSON.stringify(badCons, null, 2));

  const badItems = await StockItem.find({ 
    $or: [
      { location: { $in: [null, ''] } }, 
      { department: { $in: [null, ''] } }
    ] 
  }).lean();
  
  console.log('Bad Stock Items:', JSON.stringify(badItems, null, 2));

  await mongoose.disconnect();
}
run();
