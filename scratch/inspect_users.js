const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI).then(async () => {
  const users = await mongoose.connection.db.collection('users').find({ 
    role: 'supplier'
  }).toArray();
  console.log('SUPPLIER USERS:');
  users.forEach(u => console.log({ 
    _id: u._id, 
    fullName: u.fullName, 
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    companyName: u.companyName,
    isActive: u.isActive
  }));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
