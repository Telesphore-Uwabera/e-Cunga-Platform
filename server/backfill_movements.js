import { MongoClient } from 'mongodb';
const uri = 'mongodb+srv://e-CUNGA:91073%40Tecy@cluster0.sybcb.mongodb.net/ecunga?retryWrites=true&w=majority&appName=Cluster0';
async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('ecunga');
  
  const companyId = 'company_demo_1';

  // 1. Backfill from closed requisitions
  const closedReqs = await db.collection('requisitions').find({ companyId, status: 'closed' }).toArray();
  console.log('Found ' + closedReqs.length + ' closed requisitions.');

  for (const req of closedReqs) {
    const existing = await db.collection('consumptions').countDocuments({ relatedRequisitionId: String(req._id) });
    if (existing > 0) continue;

    for (const line of req.lines) {
      const stockItem = await db.collection('stockitems').findOne({ 
        companyId, 
        name: new RegExp('^' + line.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
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
          clerkId: 'system_backfill',
          purpose: 'Requisition fulfillment (historical fix)',
          consumptionKind: 'general',
          relatedRequisitionId: String(req._id),
          createdAt: req.updatedAt || req.createdAt || new Date(),
          updatedAt: req.updatedAt || req.createdAt || new Date()
        });
        console.log('Added movement for ' + stockItem.name + ' (' + line.quantity + ') from Req ' + req._id);
      }
    }
  }

  // 2. Backfill initial stock creation if no movements exist
  const allStock = await db.collection('stockitems').find({ companyId }).toArray();
  console.log('Checking ' + allStock.length + ' stock items for initial movements...');
  for (const item of allStock) {
    const movementCount = await db.collection('consumptions').countDocuments({ itemId: item._id });
    if (movementCount === 0 && item.quantity > 0) {
      const cid = 'con_initial_' + Date.now() + '_' + Math.random().toString(16).slice(2, 6);
      await db.collection('consumptions').insertOne({
        _id: cid,
        companyId,
        itemId: item._id,
        itemName: item.name,
        quantity: item.quantity,
        unit: item.unit,
        clerkId: item.ownerId || 'system_backfill',
        purpose: 'Initial inventory registration (backfill)',
        consumptionKind: 'general',
        createdAt: item.createdAt || new Date(),
        updatedAt: item.createdAt || new Date()
      });
      console.log('Added initial movement for ' + item.name + ' (' + item.quantity + ') at ' + (item.createdAt || 'now'));
    }
  }

  await client.close();
}
main().catch(console.error);
