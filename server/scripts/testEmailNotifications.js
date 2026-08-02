/**
 * Email notification integration test
 * Tests the complete email flow for all roles in company ALU
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

import User from '../src/models/User.js';
import { notifyRole, messageRole, notifyUser } from '../src/services/notify.js';
import { portalBroadcastMatchesUser } from '../src/services/orgScope.js';
import { sendMail, isMailConfigured } from '../src/services/mail.js';

const COMPANY_ID = 'supplier_company_b2caa9e8-bcb1-425d-8811-9ad427521a2c';
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\n=== E-Cunga Email Notification Integration Test ===\n');

  // 1. Mail configured?
  console.log('--- 1. Mail Configuration ---');
  assert(isMailConfigured(), 'Brevo SMTP is configured');

  // 2. Load all company users
  const users = await User.find({ companyId: COMPANY_ID, isActive: true }).lean();
  console.log('\n--- 2. Company Users ---');
  for (const u of users) {
    console.log(`  [${u.role}] ${u.fullName} <${u.email}> | loc:${u.location} dept:${u.department}`);
  }

  const supervisor = users.find(u => u.role === 'supervisor');
  const clerk = users.find(u => u.role === 'clerk');
  const accountant = users.find(u => u.role === 'accountant');

  assert(!!supervisor, 'Supervisor found');
  assert(!!clerk, 'Clerk found');
  assert(!!accountant, 'Accountant found');

  // 3. Org scope: supervisor should always match broadcasts (after fix)
  console.log('\n--- 3. Org Scope Matching ---');
  const scopedEvent = { scopeLocation: 'HQ Kigali', scopeDepartment: 'Operation' };
  assert(portalBroadcastMatchesUser(scopedEvent, supervisor), 'Supervisor matches scoped broadcast (role bypass)');
  assert(portalBroadcastMatchesUser(scopedEvent, accountant), 'Accountant matches scoped broadcast (role bypass)');
  assert(portalBroadcastMatchesUser(scopedEvent, clerk), 'Clerk matches own scope');
  assert(!portalBroadcastMatchesUser(scopedEvent, { role: 'clerk', location: 'Remera', department: 'Nursing' }), 'Clerk mismatched scope is excluded');

  // 4. Live email test to supervisor
  console.log('\n--- 4. Live Email Delivery Tests ---');
  const mailResult = await sendMail({
    to: supervisor.email,
    subject: '[e-Cunga Test] Supervisor Email Notification Check',
    text: `Hi ${supervisor.fullName},\n\nThis is a system test email confirming supervisor email notifications are now active.\n\nTest timestamp: ${new Date().toISOString()}`,
    html: `<p>Hi <strong>${supervisor.fullName}</strong>,</p><p>Supervisor email notifications are now active in e-Cunga.</p><p>Timestamp: ${new Date().toISOString()}</p>`,
  });
  assert(mailResult.ok, `Email delivered to supervisor: ${supervisor.email}`);

  // 5. Live email test to accountant
  const mailResult2 = await sendMail({
    to: accountant.email,
    subject: '[e-Cunga Test] Accountant Email Notification Check',
    text: `Hi ${accountant.fullName},\n\nThis is a system test email confirming accountant email notifications are now active.\n\nTest timestamp: ${new Date().toISOString()}`,
    html: `<p>Hi <strong>${accountant.fullName}</strong>,</p><p>Accountant email notifications are now active in e-Cunga.</p><p>Timestamp: ${new Date().toISOString()}</p>`,
  });
  assert(mailResult2.ok, `Email delivered to accountant: ${accountant.email}`);

  // 6. Live email test to clerk
  const mailResult3 = await sendMail({
    to: clerk.email,
    subject: '[e-Cunga Test] Clerk Email Notification Check',
    text: `Hi ${clerk.fullName},\n\nThis is a system test email confirming clerk email notifications are now active.\n\nTest timestamp: ${new Date().toISOString()}`,
    html: `<p>Hi <strong>${clerk.fullName}</strong>,</p><p>Clerk email notifications are now active in e-Cunga.</p><p>Timestamp: ${new Date().toISOString()}</p>`,
  });
  assert(mailResult3.ok, `Email delivered to clerk: ${clerk.email}`);

  // 7. notifyRole — supervisor (previously blocked, now enabled)
  console.log('\n--- 5. notifyRole Supervisor (was blocked) ---');
  try {
    await notifyRole(COMPANY_ID, 'supervisor', '[Test] Stock threshold reached', 'Item X is below minimum level.', 'warn', {});
    assert(true, 'notifyRole supervisor succeeded without error');
  } catch (e) {
    assert(false, `notifyRole supervisor threw: ${e.message}`);
  }

  // 8. notifyRole — accountant
  console.log('\n--- 6. notifyRole Accountant ---');
  try {
    await notifyRole(COMPANY_ID, 'accountant', '[Test] Finance review needed', 'Proforma ready for review.', 'neutral', {});
    assert(true, 'notifyRole accountant succeeded without error');
  } catch (e) {
    assert(false, `notifyRole accountant threw: ${e.message}`);
  }

  // 9. notifyRole — clerk (scoped)
  console.log('\n--- 7. notifyRole Clerk (scoped) ---');
  try {
    await notifyRole(COMPANY_ID, 'clerk', '[Test] Stock received', 'Items replenished.', 'ok', { scopeLocation: 'HQ Kigali', scopeDepartment: 'Operation' });
    assert(true, 'notifyRole clerk succeeded without error');
  } catch (e) {
    assert(false, `notifyRole clerk threw: ${e.message}`);
  }

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) console.error('Some tests failed — check the output above.');
  else console.log('All tests passed! Email notifications are working correctly.');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
