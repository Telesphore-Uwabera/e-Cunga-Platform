import crypto from 'node:crypto';
import PortalNotification from '../models/PortalNotification.js';
import PortalMessage from '../models/PortalMessage.js';
import User from '../models/User.js';
import { sendMail } from './mail.js';

export async function notifyRole(companyId, role, title, body, severity = 'neutral') {
  const id = `ntf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalNotification.create({ _id: id, companyId, role, title, body, severity });

  // Send email for all notifications to ensure "all roles email-needs" are met
  try {
    const users = await User.find({ companyId, role, isActive: true }).select('email').lean();
    for (const u of users) {
      const isCritical = ['warn', 'bad'].includes(severity);
      const accentColor = severity === 'bad' ? '#991b1b' : (severity === 'warn' ? '#d97706' : '#692751');
      
      sendMail({
        to: u.email,
        subject: `[e-Cunga ${severity.toUpperCase()}] ${title}`,
        text: body,
        html: `
          <div style="font-family: sans-serif; border-left: 4px solid ${accentColor}; padding-left: 1.5rem; margin: 1rem 0;">
            <h2 style="color: ${accentColor}; margin-top: 0; font-size: 1.25rem;">${title}</h2>
            <p style="color: #121c2a; line-height: 1.6;">${body}</p>
            <div style="margin-top: 2rem; border-top: 1px solid #e4e4e7; padding-top: 1rem;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="color: ${accentColor}; font-weight: bold; text-decoration: none;">Open e-Cunga Dashboard →</a>
            </div>
            <p style="font-size: 0.75rem; color: #83737a; margin-top: 2rem;">
              This is an automated notification from your e-Cunga Workspace. You received this because your role is: ${role}.
            </p>
          </div>
        `
      }).catch(err => console.error(`[notify] email failed for ${u.email}:`, err));
    }
  } catch (err) {
    console.error('[notify] failed to fetch users for email:', err);
  }
}

export async function messageRole(companyId, role, title, body, from = 'System') {
  const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalMessage.create({ _id: id, companyId, role, title, body, from });

  // Send email notification for the message
  try {
    const users = await User.find({ companyId, role, isActive: true }).select('email').lean();
    for (const u of users) {
      sendMail({
        to: u.email,
        subject: `[e-Cunga Message] ${title} (from ${from})`,
        text: body,
        html: `
          <div style="font-family: sans-serif; border-top: 4px solid #692751; padding: 1.5rem; background: #fdfafd; border-radius: 8px;">
            <h2 style="color: #692751; margin-top: 0;">New Message Received</h2>
            <p style="font-size: 1.1rem; color: #121c2a;"><strong>From:</strong> ${from}</p>
            <div style="background: white; border: 1px solid #e4e4e7; padding: 1rem; border-radius: 6px; margin: 1.5rem 0;">
              <h3 style="margin-top: 0; font-size: 0.9rem; color: #83737a;">${title}</h3>
              <p style="white-space: pre-wrap; margin-bottom: 0;">${body}</p>
            </div>
            <p style="font-size: 0.8rem; color: #83737a;">
              Log in to the portal to reply to this message.
            </p>
          </div>
        `
      }).catch(err => console.error(`[message] email failed for ${u.email}:`, err));
    }
  } catch (err) {
    console.error('[message] failed to fetch users for email:', err);
  }
}
