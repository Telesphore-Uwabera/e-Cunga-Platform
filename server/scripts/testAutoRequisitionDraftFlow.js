import 'dotenv/config';
import mongoose from 'mongoose';
import Requisition from '../src/models/Requisition.js';
import User from '../src/models/User.js';
import StockItem from '../src/models/StockItem.js';
import { runBatchAutoRequisitions, autoSubmitDrafts } from '../src/services/autoRequisition.js';

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('Error: MONGODB_URI not found in environment.');
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTest() {
  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  // 1. Pick a company and setup supervisor permissions
  // Find any supervisor in the system
  let supervisor = await User.findOne({ role: 'supervisor' });
  if (!supervisor) {
    console.log('No supervisor found, creating one...');
    supervisor = new User({
      email: 'temp.supervisor@ecunga.com',
      fullName: 'Temp Supervisor',
      role: 'supervisor',
      companyId: 'company_demo_1',
      permissions: ['requisitions:auto'],
    });
    await supervisor.save();
  } else {
    console.log(`Using supervisor: ${supervisor.email}`);
    // Ensure they have 'requisitions:auto' permission
    if (!supervisor.permissions.includes('requisitions:auto')) {
      await User.updateOne({ _id: supervisor._id }, { $push: { permissions: 'requisitions:auto' } });
      // Fetch fresh
      supervisor = await User.findById(supervisor._id).lean();
    }
  }

  const companyId = supervisor.companyId;

  // Find a clerk for the ownerId
  const clerk = await User.findOne({ companyId, role: 'clerk' }) || supervisor;
  const ownerId = clerk._id;

  // Clean up any existing auto-drafts to make the test clean
  await Requisition.deleteMany({ companyId, title: { $regex: '^Auto restock:' } });

  // Update existing manual requisitions to be older than 48 hours so they don't block the auto-submit test
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await mongoose.connection.db.collection('requisitions').updateMany(
    { companyId, status: { $in: ['submitted', 'approved'] }, title: { $not: { $regex: '^Auto restock:' } } },
    { $set: { createdAt: threeDaysAgo } }
  );

  // 2. Create a temporary low-stock item
  console.log('Creating a low stock item...');
  const tempItem = new StockItem({
    _id: `temp_item_1_${Date.now()}`,
    companyId,
    ownerId,
    name: `Temp Low Stock Item ${Date.now()}`,
    category: 'Others',
    quantity: 2,
    minThreshold: 10,
    maxThreshold: 50,
    unit: 'pcs',
  });
  await tempItem.save();

  try {
    // 3. Run runBatchAutoRequisitions()
    console.log('Running runBatchAutoRequisitions()...');
    await runBatchAutoRequisitions();

    // Verify draft was created
    const draft = await Requisition.findOne({
      companyId,
      status: 'draft',
      title: { $regex: '^Auto restock:' },
    });
    assert(draft !== null, 'Should have created a draft requisition for low stock item.');
    console.log(`✓ Draft requisition successfully created with status: ${draft.status}`);

    // 4. Run autoSubmitDrafts() with NO recent manual requisitions
    console.log('Running autoSubmitDrafts() (no recent manual requisition)...');
    await autoSubmitDrafts();

    // Verify draft is now submitted
    const submitted = await Requisition.findById(draft._id);
    assert(submitted.status === 'submitted', `Expected status 'submitted', got '${submitted.status}'`);
    console.log('✓ Draft requisition successfully auto-submitted.');

    // 5. Test cancellation logic: create another low stock item, run draft gen again
    console.log('Creating second low stock item...');
    const tempItem2 = new StockItem({
      _id: `temp_item_2_${Date.now()}`,
      companyId,
      ownerId,
      name: `Temp Low Stock Item 2 ${Date.now()}`,
      category: 'Others',
      quantity: 1,
      minThreshold: 5,
      maxThreshold: 20,
      unit: 'pcs',
    });
    await tempItem2.save();

    console.log('Running runBatchAutoRequisitions() for second item...');
    await runBatchAutoRequisitions();

    const draft2 = await Requisition.findOne({
      companyId,
      status: 'draft',
      title: { $regex: '^Auto restock:' },
    });
    assert(draft2 !== null, 'Should have created second draft requisition.');
    console.log(`✓ Second draft requisition created with status: ${draft2.status}`);

    // Create a manual requisition within the past 48 hours
    console.log('Creating a recent manual requisition to trigger cancel override...');
    const manualReq = new Requisition({
      _id: `temp_req_manual_${Date.now()}`,
      companyId,
      clerkId: ownerId,
      clerkName: clerk.fullName,
      title: `Manual Order ${Date.now()}`,
      status: 'submitted',
      priority: 'normal',
      lines: [
        { description: 'Manual item', quantity: 5, unit: 'pcs' }
      ],
      requestedAt: new Date(),
    });
    await manualReq.save();

    // Run autoSubmitDrafts()
    console.log('Running autoSubmitDrafts() (recent manual requisition exists)...');
    await autoSubmitDrafts();

    // Verify draft is cancelled
    const cancelled = await Requisition.findById(draft2._id);
    assert(cancelled.status === 'cancelled', `Expected status 'cancelled', got '${cancelled.status}'`);
    console.log('✓ Draft requisition successfully cancelled due to recent manual requisition.');

    // Clean up second low stock item and manual requisition
    await StockItem.deleteOne({ _id: tempItem2._id });
    await Requisition.deleteOne({ _id: manualReq._id });

  } finally {
    // 6. Cleanup database records
    console.log('Cleaning up temporary records...');
    await StockItem.deleteOne({ _id: tempItem._id });
    await Requisition.deleteMany({ companyId, title: { $regex: '^Auto restock:' } });
    if (supervisor.email === 'temp.supervisor@ecunga.com') {
      await User.deleteOne({ _id: supervisor._id });
    }
  }

  await mongoose.disconnect();
  console.log('Disconnected.');
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
