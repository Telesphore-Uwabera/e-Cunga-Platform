import crypto from 'node:crypto';
import PortalNotification from '../models/PortalNotification.js';
import PortalMessage from '../models/PortalMessage.js';

export async function notifyRole(companyId, role, title, body, severity = 'neutral') {
  const id = `ntf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalNotification.create({ _id: id, companyId, role, title, body, severity });
}

export async function messageRole(companyId, role, title, body, from = 'System') {
  const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await PortalMessage.create({ _id: id, companyId, role, title, body, from });
}
