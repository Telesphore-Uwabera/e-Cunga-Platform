import 'dotenv/config';
import mongoose from 'mongoose';
import StockItem from '../src/models/StockItem.js';
import Consumption from '../src/models/Consumption.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const companyId = 'company_22533735-c82a-48ce-95d4-f26e1f710417';

const items = await StockItem.find({ companyId }).lean();
console.log(`--- STOCK ITEMS (${items.length}) ---`);
const deptCounts = {};
items.forEach(i => {
  const key = `${i.location} | ${i.department}`;
  deptCounts[key] = (deptCounts[key] || 0) + i.quantity;
});
console.log('Stock Totals by Scope:', deptCounts);

const consumptions = await Consumption.find({ companyId }).lean();
console.log(`\n--- CONSUMPTIONS (${consumptions.length}) ---`);
const conDeptCounts = {};
consumptions.forEach(c => {
  const key = `${c.location} | ${c.department}`;
  conDeptCounts[key] = (conDeptCounts[key] || 0) + 1;
});
console.log('Consumption Counts by Scope:', conDeptCounts);

await mongoose.disconnect();
