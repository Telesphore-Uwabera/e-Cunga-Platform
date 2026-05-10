import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import StockItem from '../src/models/StockItem.js';
import Consumption from '../src/models/Consumption.js';
import Requisition from '../src/models/Requisition.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

await mongoose.connect(uri);
console.log('Connected to DB');

// 1. Fix Consumption records (Add missing location/department)
const consumptions = await Consumption.find({ 
  $or: [
    { location: { $exists: false } }, 
    { location: '' }, 
    { department: { $exists: false } }, 
    { department: '' }
  ] 
});

console.log(`Found ${consumptions.length} consumptions needing scope fix.`);

for (const con of consumptions) {
  const item = await StockItem.findById(con.itemId).lean();
  if (item) {
    await Consumption.updateOne(
      { _id: con._id },
      { $set: { location: item.location, department: item.department } }
    );
  } else {
    // Fallback to clerk's info if item is deleted
    const clerk = await User.findById(con.clerkId).lean();
    if (clerk) {
      await Consumption.updateOne(
        { _id: con._id },
        { $set: { location: clerk.location, department: clerk.department || clerk.team || '' } }
      );
    }
  }
}

// 2. Fix StockItems (Default missing location/department from owner)
const stockItems = await StockItem.find({
  $or: [
    { location: { $exists: false } }, 
    { location: '' }, 
    { department: { $exists: false } }, 
    { department: '' }
  ]
});

console.log(`Found ${stockItems.length} stock items needing scope fix.`);

for (const item of stockItems) {
  const owner = await User.findById(item.ownerId).lean();
  if (owner) {
    const patch = {};
    if (!item.location) patch.location = owner.location || 'Warehouse A';
    if (!item.department) patch.department = owner.department || owner.team || '';
    
    if (Object.keys(patch).length > 0) {
      await StockItem.updateOne({ _id: item._id }, { $set: patch });
    }
  }
}

console.log('Done fixing scopes.');
await mongoose.disconnect();
