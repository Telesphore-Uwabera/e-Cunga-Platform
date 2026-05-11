import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({ companyId: 'company_22533735-c82a-48ce-95d4-f26e1f710417', role: 'clerk' });
  console.log(JSON.stringify(users.map(u => ({ email: u.email, fullName: u.fullName, dept: u.department, loc: u.location })), null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
