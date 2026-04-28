import mongoose from 'mongoose';
import MasterStockItem from '../models/MasterStockItem.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecunga';

const healthcareItems = [
  { name: 'Surgical Gloves', category: 'Medical consumables', unit: 'boxes', sector: 'Healthcare', suggestedMin: 50, suggestedMax: 200 },
  { name: 'N95 Respirator', category: 'Medical consumables', unit: 'boxes', sector: 'Healthcare', suggestedMin: 20, suggestedMax: 100 },
  { name: 'Sterile Gauze', category: 'Medical consumables', unit: 'packs', sector: 'Healthcare', suggestedMin: 100, suggestedMax: 500 },
  { name: 'IV Fluid (Normal Saline)', category: 'Pharmacy', unit: 'bags', sector: 'Healthcare', suggestedMin: 40, suggestedMax: 150 },
  { name: 'Paracetamol 500mg', category: 'Pharmacy', unit: 'packs', sector: 'Healthcare', suggestedMin: 200, suggestedMax: 1000 },
  { name: 'Hand Sanitizer 500ml', category: 'Sanitation', unit: 'bottles', sector: 'Healthcare', suggestedMin: 30, suggestedMax: 100 },
  { name: 'Disinfectant Spray', category: 'Sanitation', unit: 'bottles', sector: 'Healthcare', suggestedMin: 20, suggestedMax: 80 },
  { name: 'Microscope Slides', category: 'Laboratory', unit: 'boxes', sector: 'Healthcare', suggestedMin: 10, suggestedMax: 50 },
  { name: 'Centrifuge Tubes', category: 'Laboratory', unit: 'packs', sector: 'Healthcare', suggestedMin: 50, suggestedMax: 200 },
  { name: 'Blood Collection Tubes', category: 'Laboratory', unit: 'trays', sector: 'Healthcare', suggestedMin: 100, suggestedMax: 500 },
];

async function seedMasterCatalog() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for Master Catalog seeding');

    for (const item of healthcareItems) {
      const id = `m_stk_${item.name.toLowerCase().replace(/\s+/g, '_')}`;
      await MasterStockItem.updateOne(
        { _id: id },
        { $set: item },
        { upsert: true }
      );
    }

    console.log('Master Catalog seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Master Catalog:', error);
    process.exit(1);
  }
}

seedMasterCatalog();
