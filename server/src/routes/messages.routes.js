import crypto from 'node:crypto';
import { Router } from 'express';
import PortalMessage from '../models/PortalMessage.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyRole } from '../services/notify.js';
import { compactNotifyScope, portalRowVisibleToUser } from '../services/orgScope.js';

const router = Router();

const RECIPIENT_ROLES = new Set(['clerk', 'supervisor', 'accountant', 'admin', 'supplier']);

router.use(requireAuth);

router.get('/', async (req, res) => {
  const role = req.user.role;
  const userId = req.user.id;
  /** Role inbox (no userId) plus messages addressed to this user only. */
  const messages = await PortalMessage.find({
    companyId: req.user.companyId,
    $or: [
      {
        role,
        $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }],
      },
      { userId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const visible = messages.filter((m) => portalRowVisibleToUser(m, req.user));

  res.json({
    messages: visible.map((m) => ({
      id: m._id,
      role: m.role,
      title: m.title,
      body: m.body,
      from: m.from,
      isRead: Boolean(m.isRead),
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

    const sender = await User.findById(req.user.id).select('department team location').lean();
    const scopeOpts = compactNotifyScope({
      scopeDepartment: String(sender?.department || sender?.team || '').trim(),
      scopeLocation: String(sender?.location || '').trim(),
    });

    const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await PortalMessage.create({
      _id: id,
      companyId: req.user.companyId,
      role: toRole,
      title: msgTitle,
      body: text,
      from,
      ...scopeOpts,
    });

    const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
    await notifyRole(req.user.companyId, toRole, `Message from ${from}`, preview, 'neutral', scopeOpts);

    return res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const m = await PortalMessage.findById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (!portalRowVisibleToUser(m, req.user)) return res.status(404).json({ error: 'Not found' });
    m.isRead = true;
    await m.save();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const m = await PortalMessage.findById(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (!portalRowVisibleToUser(m, req.user)) return res.status(404).json({ error: 'Not found' });
    await PortalMessage.deleteOne({ _id: m._id });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
