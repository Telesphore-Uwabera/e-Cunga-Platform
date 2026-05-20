/**
 * Normalize "Silver Back Mall" (any spacing between words) → "Silverback Mall"
 * across location-like fields. Safe to re-run (idempotent for already-correct values).
 *
 *   npm run db:fix-silverback-mall-label -w server
 *
 * Requires MONGODB_URI in .env (or environment).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Company from '../src/models/Company.js';
import StockItem from '../src/models/StockItem.js';
import Consumption from '../src/models/Consumption.js';
import Requisition from '../src/models/Requisition.js';
import PortalNotification from '../src/models/PortalNotification.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

/** Matches "Silver Back Mall", "Silver  Back Mall", case variations; not "Silverback Mall". */
const BAD_LOCATION = /^Silver\s+Back\s+Mall$/i;
const CANONICAL = 'Silverback Mall';

async function reportUpdate(Model, label, filter, update) {
  const res = await Model.updateMany(filter, update);
  if (res.matchedCount > 0) {
    console.log(`${label}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }
  return res;
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  console.log(`Replacing location text matching ${BAD_LOCATION} → "${CANONICAL}"\n`);

  await reportUpdate(User, 'users.location', { location: BAD_LOCATION }, { $set: { location: CANONICAL } });
  await reportUpdate(Company, 'companies.location', { location: BAD_LOCATION }, { $set: { location: CANONICAL } });
  await reportUpdate(StockItem, 'stockitems.location', { location: BAD_LOCATION }, { $set: { location: CANONICAL } });
  await reportUpdate(Consumption, 'consumptions.location', { location: BAD_LOCATION }, { $set: { location: CANONICAL } });
  await reportUpdate(Requisition, 'requisitions.location', { location: BAD_LOCATION }, { $set: { location: CANONICAL } });
  await reportUpdate(
    PortalNotification,
    'portalnotifications.scopeLocation',
    { scopeLocation: BAD_LOCATION },
    { $set: { scopeLocation: CANONICAL } }
  );

  console.log('\nDone.');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
