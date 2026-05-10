import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const companyId = 'company_22533735-c82a-48ce-95d4-f26e1f710417';
const users = await User.find({ companyId }).lean();
console.log(`--- USERS IN ${companyId} ---`);
users.forEach(u => {
  console.log(`${u.email} | ${u.fullName}: role=${u.role}, loc="${u.location}", dept="${u.department}", team="${u.team}"`);
});

await mongoose.disconnect();
