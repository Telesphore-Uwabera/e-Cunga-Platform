import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Requisition from '../server/src/models/Requisition.js';
import User from '../server/src/models/User.js';
import { allocateRequisitionId } from '../server/src/lib/requisitionIds.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const actor = await User.findOne({ role: 'clerk' }).lean();
  if (!actor) {
    console.log('No clerk found');
    return;
  }

  const cid = actor.companyId;
  const id = await allocateRequisitionId(cid, 'manu');
  console.log('Allocated ID:', id);

  try {
    const doc = await Requisition.create({
      _id: id,
      companyId: cid,
      title: 'Test Requisition ' + Date.now(),
      clerkId: actor._id,
      clerkName: actor.fullName,
      status: 'submitted',
      priority: 'normal',
      location: actor.location || 'Warehouse',
      requestingDepartment: actor.department || actor.team || '',
      lines: [
        {
          description: 'Test Item',
          quantity: 1,
          unit: 'units',
          estimatedCost: 0,
          dateValue: '',
        }
      ],
    });
    console.log('Requisition created:', doc._id);
    
    // Clean up
    await Requisition.deleteOne({ _id: doc._id });
    console.log('Test requisition deleted.');
  } catch (err) {
    console.error('Failed to create requisition:', err);
  }

  await mongoose.disconnect();
}
run();
