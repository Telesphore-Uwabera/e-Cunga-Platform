import crypto from 'node:crypto';
import { Router } from 'express';
import PortalMessage from '../models/PortalMessage.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyRole } from '../services/notify.js';

const router = Router();

const RECIPIENT_ROLES = new Set(['clerk', 'supervisor', 'accountant', 'admin', 'supplier']);

router.use(requireAuth);

router.get('/', async (req, res) => {
  const role = req.user.role;
  const messages = await PortalMessage.find({ companyId: req.user.companyId, role })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({
    messages: messages.map((m) => ({
      id: m._id,
      role: m.role,
      title: m.title,
      body: m.body,
      from: m.from,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    })),
  });
});

router.post('/', async (req, res) => {
  try {
    const { toRole, title, body } = req.body || {};
    if (!toRole || typeof toRole !== 'string' || !RECIPIENT_ROLES.has(toRole)) {
      return res.status(400).json({ error: 'Invalid recipient role.' });
    }
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text.length) {
      return res.status(400).json({ error: 'Message body is required.' });
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: 'Message is too long.' });
    }
    const rawTitle = typeof title === 'string' ? title.trim().slice(0, 200) : '';
    const msgTitle = rawTitle || 'Message';
    const from =
      (typeof req.user.fullName === 'string' && req.user.fullName.trim()) ||
      req.user.email ||
      'Portal user';

    const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await PortalMessage.create({
      _id: id,
      companyId: req.user.companyId,
      role: toRole,
      title: msgTitle,
      body: text,
      from,
    });

    const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
    await notifyRole(req.user.companyId, toRole, `Message from ${from}`, preview, 'neutral');

    return res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

export default router;
