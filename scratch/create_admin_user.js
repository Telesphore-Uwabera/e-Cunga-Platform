import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const envPath = path.join(process.cwd(), 'server', '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

import User from '../server/src/models/User.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const email = 'info.teletech.rw@gmail.com';
const password = '91073@Tecy';
const fullName = 'Telesphore Admin'; // Changed name to reflect role
const role = 'admin';

const passwordHash = await bcrypt.hash(password, 10);

const existingUser = await User.findOne({ email }).lean();

if (existingUser) {
  console.log(`User ${email} already exists. Updating to admin role and setting password...`);
  await User.updateOne(
    { email },
    { 
      $set: { 
        role, 
        passwordHash,
        fullName // Update name too
      } 
    }
  );
  console.log('Update successful.');
} else {
  console.log(`Creating new admin user ${email}...`);
  const newUser = new User({
    _id: uuidv4(),
    companyId: 'company_demo_1', // Using the teletech company ID
    companyName: 'e-Cunga Portal',
    fullName,
    email,
    passwordHash,
    role,
    isActive: true
  });
  await newUser.save();
  console.log('Creation successful.');
}

await mongoose.disconnect();
