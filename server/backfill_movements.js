import { MongoClient } from 'mongodb';
const uri = 'mongodb+srv://e-CUNGA:91073%40Tecy@cluster0.sybcb.mongodb.net/ecunga?retryWrites=true&w=majority&appName=Cluster0';
async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('ecunga');
  
  const companyId = 'company_demo_1';
  const clerkId = 'f75a4019-4b5a-4d1a-b0bf-4b39308375e2';

  // Find closed requisitions for this company
  const closedReqs = await db.collection('requisitions').find({ companyId, status: 'closed' }).toArray();
  console.log('Found ' + closedReqs.length + ' closed requisitions.');

  for (const req of closedReqs) {
    // Check if we already have consumption records for this requisition
    const existing = await db.collection('consumptions').countDocuments({ relatedRequisitionId: String(req._id) });
    if (existing > 0) {
      console.log('Skipping ' + req._id + ' (already tracked)');
      continue;
    }

    for (const line of req.lines) {
      const stockItem = await db.collection('stockitems').findOne({ 
        companyId, 
        name: new RegExp('^' + line.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
        ownerId: clerkId
      });

      if (stockItem) {
        const cid = 'con_fulfillment_' + Date.now() + '_' + Math.random().toString(16).slice(2, 6);
        await db.collection('consumptions').insertOne({
          _id: cid,
          companyId,
          itemId: stockItem._id,
          itemName: stockItem.name,
          quantity: line.quantity,
          unit: stockItem.unit,
          clerkId,
          purpose: 'Requisition fulfillment (historical fix)',
          consumptionKind: 'general',
          relatedRequisitionId: String(req._id),
          createdAt: req.updatedAt || new Date(),
          updatedAt: req.updatedAt || new Date()
        });
        console.log('Added movement for ' + stockItem.name + ' (' + line.quantity + ')');
      }
    }
  }

  await client.close();
}
main().catch(console.error);
