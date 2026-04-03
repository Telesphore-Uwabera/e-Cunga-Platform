import mongoose from 'mongoose';
import ActivityLog from '../models/ActivityLog.js';
import ContactInquiry from '../models/ContactInquiry.js';
import Company from '../models/Company.js';
import Consumption from '../models/Consumption.js';
import Invoice from '../models/Invoice.js';
import PasswordReset from '../models/PasswordReset.js';
import PortalMessage from '../models/PortalMessage.js';
import PortalChatMessage from '../models/PortalChatMessage.js';
import PortalChatThread from '../models/PortalChatThread.js';
import PortalNotification from '../models/PortalNotification.js';
import Requisition from '../models/Requisition.js';
import StockItem from '../models/StockItem.js';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import User from '../models/User.js';

/** All registered schemas — import order ensures models are registered on mongoose. */
const MODELS = [
  Company,
  User,
  StockItem,
  Consumption,
  Requisition,
  Invoice,
  SupplierCatalogItem,
  PortalMessage,
  PortalChatThread,
  PortalChatMessage,
  PortalNotification,
  ActivityLog,
  PasswordReset,
  ContactInquiry,
];

/**
 * Ensures each model's collection exists and indexes match the schema (Atlas / standalone).
 */
export async function syncDatabaseCollections() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not ready.');
  }

  const results = [];

  for (const Model of MODELS) {
    const collectionName = Model.collection.collectionName;

    try {
      await Model.createCollection();
    } catch (err) {
      const msg = String(err?.message || err);
      if (!/already exists|namespace exists/i.test(msg)) {
        throw err;
      }
    }

    await Model.syncIndexes();

    let estimatedCount = 0;
    try {
      estimatedCount = await Model.estimatedDocumentCount();
    } catch {
      estimatedCount = 0;
    }

    results.push({
      model: Model.modelName,
      collection: collectionName,
      estimatedCount,
    });
  }

  return {
    database: db.databaseName,
    collections: results,
  };
}

/**
 * Lists native collection names (includes any legacy/extra collections).
 */
export async function listDatabaseCollectionsMeta() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not ready.');
  }

  const native = await db.listCollections().toArray();
  const names = native.map((c) => c.name).sort();

  const modelCollections = new Set(MODELS.map((M) => M.collection.collectionName));

  return {
    database: db.databaseName,
    collectionNames: names,
    modelCollections: [...modelCollections].sort(),
    extraCollections: names.filter((n) => !modelCollections.has(n)),
  };
}
