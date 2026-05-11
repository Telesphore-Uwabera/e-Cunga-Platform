import 'dotenv/config';
import mongoose from 'mongoose';
import Company from '../src/models/Company.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const company = await Company.findById('company_22533735-c82a-48ce-95d4-f26e1f710417');
  console.log(JSON.stringify(company, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
