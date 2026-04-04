import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import InviteCredentialSetup from '../models/InviteCredentialSetup.js';
import { emailInviteOtp } from '../services/registrationNotifications.js';
import { isSmtpConfigured } from '../services/mail.js';

function clientBaseUrl() {
  return String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

export function generateInviteOtp6() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Creates OTP setup for invited operational users. When SMTP is off, skips invitePending (caller uses temp password path).
 */
export async function createAndEmailInviteOtp({ userId, email, fullName, companyName, role }) {
  const otp = generateInviteOtp6();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await InviteCredentialSetup.deleteMany({ userId, used: false });
  await InviteCredentialSetup.create({
    userId,
    email: String(email).toLowerCase().trim(),
    otpHash,
    expiresAt,
    used: false,
    attempts: 0,
  });

  const activateUrl = `${clientBaseUrl()}/activate-account`;
  const result = await emailInviteOtp({
    to: email,
    fullName,
    companyName,
    role,
    otp,
    activateUrl,
  });

  if (!isSmtpConfigured()) {
    console.log(`[invite] OTP for ${email} (not emailed — configure SMTP): ${otp}`);
  }

  return { otpDevLog: !isSmtpConfigured() ? otp : undefined, mailOk: result.ok };
}
