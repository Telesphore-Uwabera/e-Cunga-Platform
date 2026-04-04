import { sendMail } from './mail.js';
import { getPlatformAdminNotifyTargets } from '../lib/platformTenant.js';
import User from '../models/User.js';

function clientBaseUrl() {
  return String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

export async function emailNewCompanyRegistrationToAdmins(payload) {
  const {
    companyId,
    companyName,
    industry,
    supervisorName,
    supervisorEmail,
    registeredAt,
  } = payload;
  const targets = await getPlatformAdminNotifyTargets();
  const lines = [
    'A new company signed up on e-CUNGA. Please review it.',
    '',
    `Company: ${companyName}`,
    `ID: ${companyId}`,
    `Industry: ${industry || '—'}`,
    `Contact name: ${supervisorName}`,
    `Contact email: ${supervisorEmail}`,
    `Time: ${registeredAt || new Date().toISOString()}`,
    '',
    'Sign in as a platform admin. Open Company registrations to approve.',
    `${clientBaseUrl()}/login`,
  ];
  const text = lines.join('\n');
  const subject = `[e-CUNGA] New company: ${companyName}`;
  for (const t of targets) {
    await sendMail({ to: t.email, subject, text });
  }
  if (!targets.length) {
    console.log('[registration] No platform admins to notify for new registration.');
  }
}

export async function emailSupervisorCompanyApproved({ companyId, companyName }) {
  const supervisors = await User.find({
    companyId,
    role: 'supervisor',
    isActive: true,
  })
    .select('email fullName')
    .lean();
  const base = clientBaseUrl();
  const text = [
    `Your company "${companyName}" is now approved on e-CUNGA.`,
    '',
    'Sign in with the same email and password you used when you registered.',
    `${base}/login`,
    '',
    'Then open Team to add clerks, accountants, and suppliers.',
  ].join('\n');
  const subject = `[e-CUNGA] Approved: ${companyName}`;
  for (const s of supervisors) {
    await sendMail({ to: s.email, subject, text });
  }
}

export async function emailInviteOtp({ to, fullName, companyName, role, otp, activateUrl }) {
  const text = [
    `Hello ${fullName || to},`,
    '',
    `You are invited to join ${companyName} on e-CUNGA as a ${role}.`,
    '',
    `Your 6-digit code is: ${otp}`,
    '',
    'Go to this page, enter the code, and choose your password:',
    activateUrl,
    '',
    'The code works for 30 minutes. If this was a mistake, you can delete this email.',
  ].join('\n');
  return sendMail({
    to,
    subject: `[e-CUNGA] Set up your ${role} account`,
    text,
  });
}
