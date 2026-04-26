import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { sendMail } from '../services/mail.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const usersToNotify = [
  { email: 'info.teletech.rw@gmail.com', role: 'supplier', name: 'Teletech Rwanda' },
  { email: 'telesphore91073@gmail.com', role: 'supervisor', name: 'Telesphore Solutions' },
  { email: 'uwaberatelesphore@gmail.com', role: 'clerk', name: 'Telesphore Clerk' },
  { email: 't.uwabera@alustudent.com', role: 'accountant', name: 'Telesphore Accountant' }
];

async function dispatch() {
  console.log('Starting credential dispatch...');
  const password = '91073@Tecy';

  for (const user of usersToNotify) {
    console.log(`Sending email to ${user.email}...`);
    const subject = `Your e-Cunga Platform Credentials - ${user.name}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden;">
        <div style="background: #780b23; color: white; padding: 2rem; text-align: center;">
          <h1 style="margin: 0; font-size: 1.5rem;">e-Cunga Platform</h1>
          <p style="margin: 0.5rem 0 0; opacity: 0.8;">Account Provisioned</p>
        </div>
        <div style="padding: 2rem; color: #121c2a; line-height: 1.6;">
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Your account has been created on the e-Cunga Platform. Below are your login credentials:</p>
          
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 1rem; margin: 1.5rem 0;">
            <p style="margin: 0;"><strong>Role:</strong> ${user.role.toUpperCase()}</p>
            <p style="margin: 0.5rem 0 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 0.5rem 0 0;"><strong>Password:</strong> <code style="background: #e2e8f0; padding: 2px 4px; border-radius: 4px;">${password}</code></p>
          </div>

          <p>You can sign in to your dashboard here:</p>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="https://ecunga.netlify.app/login" style="background: #780b23; color: white; padding: 0.8rem 2rem; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Log In to Dashboard</a>
          </div>

          <p style="font-size: 0.85rem; color: #64748b;">If you have any questions, please contact our support team.</p>
        </div>
        <div style="background: #f1f5f9; padding: 1rem; text-align: center; font-size: 0.75rem; color: #64748b;">
          &copy; 2026 e-Cunga Platform. All rights reserved.
        </div>
      </div>
    `;

    try {
      const result = await sendMail({
        to: user.email,
        subject,
        text: `Hello ${user.name}, your e-Cunga account has been created. Email: ${user.email}, Password: ${password}`,
        html
      });
      if (result.ok) {
        console.log(`Successfully sent to ${user.email}`);
      } else {
        console.error(`Failed to send to ${user.email}:`, result.error);
      }
    } catch (err) {
      console.error(`Error sending to ${user.email}:`, err.message);
    }
  }

  console.log('Dispatch complete.');
  process.exit(0);
}

dispatch().catch(err => {
  console.error('Fatal error during dispatch:', err);
  process.exit(1);
});
