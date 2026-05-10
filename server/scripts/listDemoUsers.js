import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const users = await User.find({ companyId: 'company_demo_1' }).lean();
console.log('--- USERS IN company_demo_1 ---');
users.forEach(u => {
  console.log(`${u.email} | ${u.fullName}: role=${u.role}, loc="${u.location}", dept="${u.department}", team="${u.team}"`);
});

await mongoose.disconnect();
