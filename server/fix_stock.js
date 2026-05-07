import { MongoClient } from 'mongodb';
const uri = 'mongodb+srv://e-CUNGA:91073%40Tecy@cluster0.sybcb.mongodb.net/ecunga?retryWrites=true&w=majority&appName=Cluster0';
async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('ecunga');
  
  const uid = 'f75a4019-4b5a-4d1a-b0bf-4b39308375e2';
  const result = await db.collection('stockitems').updateMany(
    { ownerId: uid },
    { $set: { location: 'HQ Kigali', department: 'Operation' } }
  );
  console.log('Updated ' + result.modifiedCount + ' items.');

  await client.close();
}
main().catch(console.error);
