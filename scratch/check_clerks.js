import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../server/src/models/User.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const users = await User.find({ role: 'clerk' }).lean();
  console.log('Clerk Users:', JSON.stringify(users, null, 2));

  await mongoose.disconnect();
}
run();
