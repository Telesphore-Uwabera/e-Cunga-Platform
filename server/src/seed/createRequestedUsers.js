import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Company from '../models/Company.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecunga';

async function createUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const password = '91073@Tecy';
    const passwordHash = await bcrypt.hash(password, 10);

    // 1. Create Supplier Account
    const supplierEmail = 'info.teletech.rw@gmail.com';
    const supplierCompanyId = 'comp_teletech_1';
    
    await Company.updateOne(
      { _id: supplierCompanyId },
      {
        $set: {
          name: 'Teletech Rwanda',
          type: 'Supplier',
          industry: 'Technology',
          language: 'EN',
          currency: 'RWF',
          registrationStatus: 'active'
        }
      },
      { upsert: true }
    );

    const supplierUserId = 'user_teletech_supplier_1';
    await User.findOneAndUpdate(
      { email: supplierEmail },
      {
        $set: {
          companyId: supplierCompanyId,
          companyName: 'Teletech Rwanda',
          fullName: 'Teletech Info',
          email: supplierEmail,
          passwordHash: passwordHash,
          role: 'supplier',
          isActive: true,
        },
        $setOnInsert: { _id: supplierUserId },
      },
      { upsert: true }
    );
    console.log('Supplier account created/updated:', supplierEmail);

    // 2. Create Supervisor, Clerk, and Accountant under a new company
    const supervisorEmail = 'telesphore91073@gmail.com';
    const clerkEmail = 'uwaberatelesphore@gmail.com';
    const accountantEmail = 't.uwabera@alustudent.com';
    const orgCompanyId = 'comp_telesphore_org';

    await Company.updateOne(
      { _id: orgCompanyId },
      {
        $set: {
          name: 'Telesphore Solutions',
          type: 'Healthcare / enterprise',
          industry: 'Healthcare',
          language: 'EN',
          currency: 'RWF',
          registrationStatus: 'active',
          isPlatformTenant: true
        }
      },
      { upsert: true }
    );

    // Supervisor
    await User.updateOne(
      { email: supervisorEmail },
      {
        $set: {
          companyId: orgCompanyId,
          companyName: 'Telesphore Solutions',
          fullName: 'Telesphore Supervisor',
          email: supervisorEmail,
          passwordHash: passwordHash,
          role: 'supervisor',
          isActive: true
        }
      },
      { upsert: true }
    );
    console.log('Supervisor account created/updated:', supervisorEmail);

    // Clerk
    await User.updateOne(
      { email: clerkEmail },
      {
        $set: {
          companyId: orgCompanyId,
          companyName: 'Telesphore Solutions',
          fullName: 'Telesphore Clerk',
          email: clerkEmail,
          passwordHash: passwordHash,
          role: 'clerk',
          isActive: true
        }
      },
      { upsert: true }
    );
    console.log('Clerk account created/updated:', clerkEmail);

    // Accountant
    await User.updateOne(
      { email: accountantEmail },
      {
        $set: {
          companyId: orgCompanyId,
          companyName: 'Telesphore Solutions',
          fullName: 'Telesphore Accountant',
          email: accountantEmail,
          passwordHash: passwordHash,
          role: 'accountant',
          isActive: true
        }
      },
      { upsert: true }
    );
    console.log('Accountant account created/updated:', accountantEmail);

    process.exit(0);
  } catch (error) {
    console.error('Error creating users:', error);
    process.exit(1);
  }
}

createUsers();
