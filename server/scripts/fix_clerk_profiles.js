import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not found');
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const emails = [
    'ayinkachriss@gmail.com',
    'donathauwineza899@gmail.com',
    'irenefiston16@gmail.com',
    'fiacre@ivuriro.rw'
  ];
  const users = await User.find({ email: { $in: emails } });
  
  console.log('--- Current Users ---');
  users.forEach(u => {
    console.log(`${u.email}: ${u.fullName} | Role: ${u.role} | Dept: ${u.department} | Loc: ${u.location}`);
  });

  const updates = [
    {
      email: 'ayinkachriss@gmail.com',
      fullName: 'Ayinkamiye Christine',
      jobTitle: 'Laboratory Technician',
      department: 'Laboratory',
      location: 'Silverback Mall'
    },
    {
      email: 'donathauwineza899@gmail.com',
      fullName: 'Donatha Uwineza',
      jobTitle: 'Laboratory Technician',
      department: 'Laboratory',
      location: 'Silverback Mall'
    },
    {
      email: 'irenefiston16@gmail.com',
      fullName: 'Irene Fiston',
      jobTitle: 'Nursing Officer',
      department: 'Nursing',
      location: 'Silverback Mall'
    },
    {
      email: 'fiacre@ivuriro.rw',
      fullName: 'Fiacre',
      jobTitle: 'Nursing Officer',
      department: 'Nursing',
      location: 'Silverback Mall'
    }
  ];

  console.log('\n--- Applying Updates ---');
  for (const update of updates) {
    const res = await User.updateOne(
      { email: update.email },
      { $set: {
        fullName: update.fullName,
        jobTitle: update.jobTitle,
        department: update.department,
        team: update.department, // syncing both for safety
        location: update.location
      }}
    );
    console.log(`${update.email}: ${res.modifiedCount} updated`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
