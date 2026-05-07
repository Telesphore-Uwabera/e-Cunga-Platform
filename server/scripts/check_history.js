import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Consumption from '../src/models/Consumption.js';
import StockItem from '../src/models/StockItem.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ fullName: /Telesphore/i });
  if (!user) {
    console.log('User not found');
    process.exit(0);
  }
  const companyId = user.companyId;
  console.log('Company ID:', companyId);

  const counts = await Consumption.aggregate([
    { $match: { companyId: String(companyId) } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        totalQty: { $sum: { $abs: '$quantity' } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  console.log('Consumption summary by date:');
  console.log(JSON.stringify(counts, null, 2));

  // Check earliest item added
  const earliestItem = await StockItem.findOne({ companyId }).sort({ createdAt: 1 });
  console.log('Earliest stock item created at:', earliestItem ? earliestItem.createdAt : 'N/A');

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
