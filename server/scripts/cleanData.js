import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import StockItem from '../src/models/StockItem.js';
import Consumption from '../src/models/Consumption.js';
import Requisition from '../src/models/Requisition.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

function isSilverback(loc) {
  const v = String(loc || '').toLowerCase();
  return (
    v.includes('silverback') ||
    v.includes('silver back') ||
    v.includes('sliverback') ||
    v.includes('siliverback') ||
    v.includes('silverbacl')
  );
}

// 1. Fix User Locations
const users = await User.find({ companyId: 'company_22533735-c82a-48ce-95d4-f26e1f710417' });
for (const u of users) {
  if (isSilverback(u.location) && u.location !== 'Silverback Mall') {
    console.log(`Fixing user ${u.email}: ${u.location} -> Silverback Mall`);
    await User.updateOne({ _id: u._id }, { $set: { location: 'Silverback Mall' } });
  }
}

// 2. Fix StockItem Locations
const items = await StockItem.find({ companyId: 'company_22533735-c82a-48ce-95d4-f26e1f710417' });
for (const i of items) {
  if (isSilverback(i.location) && i.location !== 'Silverback Mall') {
    console.log(`Fixing item ${i.name}: ${i.location} -> Silverback Mall`);
    await StockItem.updateOne({ _id: i._id }, { $set: { location: 'Silverback Mall' } });
  }
}

// 3. Fix Consumption Locations/Departments (re-sync with items)
const consumptions = await Consumption.find({ companyId: 'company_22533735-c82a-48ce-95d4-f26e1f710417' });
for (const con of consumptions) {
  const item = await StockItem.findById(con.itemId).lean();
  if (item) {
    const patch = { location: item.location, department: item.department };
    await Consumption.updateOne({ _id: con._id }, { $set: patch });
  } else if (isSilverback(con.location) && con.location !== 'Silverback Mall') {
     await Consumption.updateOne({ _id: con._id }, { $set: { location: 'Silverback Mall' } });
  }
}

// 4. Fix Requisition Locations
const reqs = await Requisition.find({ companyId: 'company_22533735-c82a-48ce-95d4-f26e1f710417' });
for (const r of reqs) {
  if (isSilverback(r.location) && r.location !== 'Silverback Mall') {
    console.log(`Fixing requisition ${r._id}: ${r.location} -> Silverback Mall`);
    await Requisition.updateOne({ _id: r._id }, { $set: { location: 'Silverback Mall' } });
  }
}

console.log('Cleanup Done.');
await mongoose.disconnect();
