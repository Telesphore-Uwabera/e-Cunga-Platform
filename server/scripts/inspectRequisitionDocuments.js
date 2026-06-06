import 'dotenv/config';
import mongoose from 'mongoose';
import Requisition from '../src/models/Requisition.js';
import Invoice from '../src/models/Invoice.js';

const requisitionId = process.argv[2];
if (!requisitionId) {
  console.error('Usage: node scripts/inspectRequisitionDocuments.js <requisitionId>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

const req = await Requisition.findById(requisitionId).lean();
console.log('=== Requisition ===');
console.log(
  req
    ? JSON.stringify(
        {
          _id: req._id,
          companyId: req.companyId,
          title: req.title,
          status: req.status,
          supplierId: req.supplierId,
          supplierName: req.supplierName,
          reviewedAt: req.reviewedAt,
          updatedAt: req.updatedAt,
        },
        null,
        2
      )
    : 'Not found'
);

const invoices = await Invoice.find({
  $or: [{ requisitionId }, { stockRequestId: requisitionId }],
})
  .select('_id companyId requisitionId stockRequestId supplierId supplierName type status reference attachmentUrl finalInvoiceUrl deliveryNoteUrl createdAt updatedAt')
  .sort({ updatedAt: -1 })
  .lean();

console.log('\n=== Related invoices ===');
console.log('count:', invoices.length);
console.log(JSON.stringify(invoices, null, 2));

await mongoose.disconnect();
