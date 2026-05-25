const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI).then(async () => {
  const user = await mongoose.connection.db.collection('users').findOne({ 
    email: 'hr@ivuriro.rw'
  });
  console.log('FABRICE USER DETAILS:');
  console.log(user);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
