import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { sendMail } from '../server/src/services/mail.js';

dotenv.config({ path: './server/.env' });

async function run() {
  console.log('Sending test email via Brevo...');
  const result = await sendMail({
    to: 'donathauwineza899@gmail.com',
    subject: 'e-Cunga Portal - Mail Functionality Test',
    text: 'Hello, this is a test email from the e-Cunga platform to verify that email notifications are working correctly.',
    html: '<p>Hello,</p><p>This is a <strong>test email</strong> from the <strong>e-Cunga platform</strong> to verify that email notifications are working correctly.</p>'
  });
  
  if (result.ok) {
    console.log('Test email SENT successfully!');
  } else {
    console.error('Test email FAILED:', result.error);
  }
}
run();
