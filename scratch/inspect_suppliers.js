const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const MONGODB_URI = process.env.MONGODB_URI;
console.log('Using MONGODB_URI:', MONGODB_URI);

mongoose.connect(MONGODB_URI).then(async () => {
  const companies = await mongoose.connection.db.collection('companies').find({ 
    $or: [{ isSupplierCompany: true }, { type: 'Supplier' }] 
  }).toArray();
  console.log('SUPPLIERS:');
  companies.forEach(c => console.log({ 
    _id: c._id, 
    name: c.name, 
    type: c.type, 
    industry: c.industry, 
    registrationStatus: c.registrationStatus, 
    isSupplierCompany: c.isSupplierCompany 
  }));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
