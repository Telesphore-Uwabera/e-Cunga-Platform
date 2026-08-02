import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();
import User from '../src/models/User.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Update supervisor profile so orgScope matching works
  const result = await User.updateOne(
    { email: 't.uwabera@alustudent.com' },
    { $set: { location: 'HQ Kigali', department: 'Management', team: 'Management' } }
  );
  console.log('Updated supervisor profile:', result);

  const u = await User.findOne({ email: 't.uwabera@alustudent.com' }).lean();
  console.log('User now:', { email: u.email, role: u.role, location: u.location, department: u.department, team: u.team });

  process.exit(0);
}
run().catch((err) => { console.error(err); process.exit(1); });
