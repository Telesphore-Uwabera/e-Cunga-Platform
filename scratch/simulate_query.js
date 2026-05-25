const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI).then(async () => {
  const Company = mongoose.connection.db.collection('companies');
  const User = mongoose.connection.db.collection('users');
  const SupplierCatalogItem = mongoose.connection.db.collection('suppliercatalogitems');

  const buyerCompanyId = 'company_22533735-c82a-48ce-95d4-f26e1f710417';
  const buyerCompany = await Company.findOne({ _id: buyerCompanyId });
  console.log('Buyer Company:', buyerCompany);

  const linkedIdSet = new Set((buyerCompany?.linkedSupplierCompanyIds || []).map((id) => String(id)));

  // Build filter for supplier companies
  const companyFilter = { 
    registrationStatus: 'active',
    $or: [
      { isSupplierCompany: true },
      { type: 'Supplier' }
    ]
  };

  const supplierCompanies = await Company.find(companyFilter).toArray();
  console.log('Supplier Companies found:', supplierCompanies.length);
  supplierCompanies.forEach(c => console.log(c.name, 'isSupplierCompany:', c.isSupplierCompany, 'type:', c.type));

  const supplierCompanyIds = supplierCompanies.map(c => c._id);
  const supplierUsers = await User.find({
    companyId: { $in: supplierCompanyIds },
    role: 'supplier',
    isActive: true
  }).toArray();
  console.log('Supplier Users found:', supplierUsers.length);
  supplierUsers.forEach(u => console.log(u.fullName, 'companyId:', u.companyId));

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
