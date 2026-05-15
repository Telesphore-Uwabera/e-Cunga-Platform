import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Requisition from '../server/src/models/Requisition.js';
import User from '../server/src/models/User.js';
import { allocateRequisitionId } from '../server/src/lib/requisitionIds.js';

dotenv.config({ path: './server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const actor = await User.findOne({ email: 'donathauwineza899@gmail.com' }).lean();
  if (!actor) {
    console.log('No user found for Donatha');
    return;
  }

  const cid = actor.companyId;
  const id = await allocateRequisitionId(cid, 'manu');
  console.log('Allocated ID for Donatha:', id);

  try {
    const doc = await Requisition.create({
      _id: id,
      companyId: cid,
      title: 'Material Request for Laboratory',
      clerkId: actor._id,
      clerkName: actor.fullName,
      status: 'submitted',
      priority: 'low',
      location: 'Silver Back Mall',
      requestingDepartment: 'Laboratory',
      deliveryNote: 'N/A',
      clerkJustification: 'Highly needed',
      lines: [
        { description: 'HIV tests', quantity: 2, unit: 'boxes', dateValue: '15/05/2026' },
        { description: 'Diluent', quantity: 1, unit: 'pack', dateValue: '15/05/2026' },
        { description: 'HbA1C', quantity: 2, unit: 'boxes', dateValue: '15/05/2026' },
        { description: 'Malaria rapid test', quantity: 3, unit: 'boxes', dateValue: '15/05/2026' },
        { description: 'Printer Cartridge - ink', quantity: 1, unit: 'pack', dateValue: '15/05/2026' },
        { description: 'Stool step', quantity: 1, unit: 'item', dateValue: '15/05/2026' }
      ],
    });
    console.log('Requisition created successfully:', doc._id);
    
    // Clean up
    await Requisition.deleteOne({ _id: doc._id });
    console.log('Cleaned up test requisition.');
  } catch (err) {
    console.error('FAILED to create requisition for Donatha:', err);
  }

  await mongoose.disconnect();
}
run();
