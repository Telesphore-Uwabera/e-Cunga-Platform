import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

const EMAILS = [
  't.uwabera@alustudent.com',
  'telesphore91073@gmail.com',
  'uwaberatelesphore@gmail.com',
  'benithehirwa@gmail.com',
];
const TEST_PASSWORD = process.argv[2] || process.env.DEMO_PASSWORD || 'Masangano@16';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const email of EMAILS) {
    const u = await User.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('+passwordHash');
    if (!u) {
      console.log(`${email}: NOT FOUND`);
      continue;
    }
    const match = await bcrypt.compare(TEST_PASSWORD, u.passwordHash || '');
    console.log(`${email}: role=${u.role} invitePending=${Boolean(u.invitePending)} passwordMatch=${match}`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
