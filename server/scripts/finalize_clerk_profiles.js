import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import { invalidatePortalCache } from '../src/services/portalState.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const updates = [
    {
      email: 'ayinkachriss@gmail.com',
      fullName: 'Ayinkamiye Christine',
      jobTitle: 'Laboratory Technician',
      department: 'Laboratory',
      team: 'Laboratory',
      location: 'Silverback Mall',
      phone: '+250786975700'
    },
    {
      email: 'donathauwineza899@gmail.com',
      fullName: 'Donatha Uwineza',
      jobTitle: 'Laboratory Technician',
      department: 'Laboratory',
      team: 'Laboratory',
      location: 'Silverback Mall'
    },
    {
      email: 'irenefiston16@gmail.com',
      fullName: 'Irene Fiston',
      jobTitle: 'Nursing Officer',
      department: 'Nursing',
      team: 'Nursing',
      location: 'Silverback Mall'
    },
    {
      email: 'fiacre@ivuriro.rw',
      fullName: 'Fiacre',
      jobTitle: 'Nursing Officer',
      department: 'Nursing',
      team: 'Nursing',
      location: 'Silverback Mall'
    }
  ];

  const companyIds = new Set();

  for (const update of updates) {
    const user = await User.findOne({ email: update.email });
    if (user) {
      if (user.companyId) companyIds.add(String(user.companyId));
      
      await User.updateOne(
        { _id: user._id },
        { $set: {
          fullName: update.fullName,
          jobTitle: update.jobTitle,
          department: update.department,
          team: update.team,
          location: update.location,
          phone: update.phone || user.phone || ''
        }}
      );
      console.log(`Updated ${update.email}`);
    } else {
      console.log(`User not found: ${update.email}`);
    }
  }

  // Invalidate cache for affected companies
  for (const cid of companyIds) {
    console.log(`Invalidating cache for company: ${cid}`);
    invalidatePortalCache(cid);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(console.error);
