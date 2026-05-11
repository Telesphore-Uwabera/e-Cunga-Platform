import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({ email: { $in: [
    'ayinkachriss@gmail.com',
    'donathauwineza899@gmail.com',
    'irenefiston16@gmail.com',
    'fiacre@ivuriro.rw'
  ] } });
  
  users.forEach(u => {
    console.log(`${u.email}: Company: ${u.companyId} | Dept: ${u.department} | Team: ${u.team}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
