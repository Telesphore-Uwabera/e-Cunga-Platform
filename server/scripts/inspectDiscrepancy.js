import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import StockItem from '../src/models/StockItem.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const users = await User.find({ 
  email: { $in: ['uwaberatelesphore@gmail.com', 'info.teletech.rw@gmail.com'] } 
}).lean();

console.log('--- USERS ---');
users.forEach(u => {
  console.log(`${u.email}: role=${u.role}, location="${u.location}", department="${u.department}", team="${u.team}", companyId=${u.companyId}`);
});

if (users.length > 0) {
  const companyId = users[0].companyId;
  const stockCount = await StockItem.countDocuments({ companyId });
  console.log(`\nTotal StockItems for company ${companyId}: ${stockCount}`);
  
  const items = await StockItem.find({ companyId }).lean();
  const locations = [...new Set(items.map(i => i.location))];
  const departments = [...new Set(items.map(i => i.department))];
  console.log('Locations found in StockItems:', locations);
  console.log('Departments found in StockItems:', departments);
}

await mongoose.disconnect();
