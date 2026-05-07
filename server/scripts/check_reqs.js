import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Requisition from '../src/models/Requisition.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ fullName: /Telesphore/i });
  const companyId = user.companyId;

  const reqs = await Requisition.find({ companyId }).lean();
  console.log(`Found ${reqs.length} requisitions for company ${companyId}`);
  reqs.forEach(r => {
    console.log(` - ID: ${r._id}, Status: ${r.status}, CreatedAt: ${r.createdAt}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
