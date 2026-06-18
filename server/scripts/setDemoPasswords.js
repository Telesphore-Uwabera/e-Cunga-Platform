/**
 * Align demo role passwords for E2E testing (explicit email list only).
 *   node scripts/setDemoPasswords.js --password "Masangano@16" --confirm
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

const DEMO_EMAILS = [
  't.uwabera@alustudent.com',
  'telesphore91073@gmail.com',
  'uwaberatelesphore@gmail.com',
  'benithehirwa@gmail.com',
];

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const password = args[args.indexOf('--password') + 1] || process.env.DEMO_PASSWORD || 'Masangano@16';

async function main() {
  if (!confirm) {
    console.error('Pass --confirm to update demo user passwords.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const hash = await bcrypt.hash(String(password), 10);
  for (const email of DEMO_EMAILS) {
    const u = await User.findOne({ email: email.toLowerCase() });
    if (!u) {
      console.log(`skip ${email} (not found)`);
      continue;
    }
    u.passwordHash = hash;
    u.invitePending = false;
    await u.save();
    console.log(`updated ${email} (${u.role})`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
