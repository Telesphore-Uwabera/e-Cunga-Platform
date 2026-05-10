import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const users = await User.find({ 
  $or: [
    { fullName: /Hirwa/i },
    { fullName: /Igiranaza/i },
    { email: /teletech/i },
    { email: /uwabera/i }
  ]
}).lean();

console.log('--- USERS SEARCH ---');
users.forEach(u => {
  console.log(`${u.email} | ${u.fullName}: role=${u.role}, loc="${u.location}", dept="${u.department}", team="${u.team}", companyId=${u.companyId}`);
});

await mongoose.disconnect();
