/**
 * One-off: inspect Teletech supplier user vs requisition supplierId linkage.
 * Run: node scripts/inspectTeletechRequisitions.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Requisition from '../src/models/Requisition.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(uri);

const teletechUsers = await User.find({
  $or: [
    { fullName: /teletech/i },
    { companyName: /teletech/i },
    { email: /teletech/i },
  ],
})
  .select('_id email role companyId companyName fullName')
  .lean();

console.log('\n=== Users matching Teletech ===');
console.log(JSON.stringify(teletechUsers, null, 2));

const supplierUsers = teletechUsers.filter((u) => u.role === 'supplier');
const keys = [...new Set(supplierUsers.flatMap((u) => [u._id, u.companyId].filter(Boolean)))];

console.log('\n=== Requisitions where supplierId matches Teletech user _id or companyId ===');
if (keys.length) {
  const reqs = await Requisition.find({ supplierId: { $in: keys } })
    .select('_id companyId title status supplierId supplierName updatedAt')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  console.log('count:', reqs.length);
  console.log(JSON.stringify(reqs, null, 2));
} else {
  console.log('No supplier users found for Teletech pattern.');
}

console.log('\n=== Requisitions with supplierName containing Teletech (any supplierId) ===');
const byName = await Requisition.find({ supplierName: /teletech/i })
  .select('_id companyId title status supplierId supplierName updatedAt')
  .sort({ updatedAt: -1 })
  .limit(100)
  .lean();
console.log('count:', byName.length);
console.log(JSON.stringify(byName, null, 2));

if (supplierUsers.length && byName.length) {
  const uid = supplierUsers[0]._id;
  const cid = supplierUsers[0].companyId;
  const mismatched = byName.filter((r) => r.supplierId && r.supplierId !== uid && r.supplierId !== cid);
  if (mismatched.length) {
    console.log('\n=== MISMATCH: supplierName says Teletech but supplierId is not this supplier user/company ===');
    console.log(JSON.stringify(mismatched, null, 2));
  }
}

console.log('\n=== Recent requisitions with any supplierId set (last 40) ===');
const withSupplier = await Requisition.find({
  supplierId: { $exists: true, $nin: ['', null] },
})
  .select('_id companyId title status supplierId supplierName updatedAt')
  .sort({ updatedAt: -1 })
  .limit(40)
  .lean();
console.log('count:', withSupplier.length);
console.log(JSON.stringify(withSupplier, null, 2));

console.log('\n=== Requisitions with status sentToSupplier+ (sample 30) ===');
const sent = await Requisition.find({
  status: {
    $in: [
      'sentToSupplier',
      'proformaAwaitingClerk',
      'proformaReceived',
      'proformaApproved',
      'paid',
      'creditPurchase',
      'creditAndPaid',
      'deliveryNoteAttached',
      'closed',
    ],
  },
})
  .select('_id companyId title status supplierId supplierName updatedAt')
  .sort({ updatedAt: -1 })
  .limit(30)
  .lean();
console.log(JSON.stringify(sent, null, 2));

console.log('\n=== Requisitions NOT in demo company (companyId != company_demo_1), sample 50 ===');
const nonDemo = await Requisition.find({ companyId: { $ne: 'company_demo_1' } })
  .select('_id companyId title status supplierId supplierName updatedAt')
  .sort({ updatedAt: -1 })
  .limit(50)
  .lean();
console.log('count:', nonDemo.length);
console.log(JSON.stringify(nonDemo, null, 2));

console.log('\n=== All supplier-role users (id, email, companyName) — max 80 ===');
const allSuppliers = await User.find({ role: 'supplier' })
  .select('_id email companyId companyName fullName')
  .sort({ companyName: 1 })
  .limit(80)
  .lean();
console.log(JSON.stringify(allSuppliers, null, 2));

await mongoose.disconnect();
console.log('\nDone.');
