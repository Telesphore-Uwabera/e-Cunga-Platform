import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(process.cwd(), 'server', '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

import User from '../server/src/models/User.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const users = await User.find({ 
  $or: [
    { email: /teletech/i },
    { role: 'admin' }
  ]
}).limit(5).lean();

console.log('--- USERS FOUND ---');
users.forEach(u => {
  console.log(`${u.email} | ${u.fullName}: role=${u.role}, companyId=${u.companyId}, companyName=${u.companyName}`);
});

await mongoose.disconnect();
