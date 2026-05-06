import crypto from 'node:crypto';
import { Router } from 'express';
import User from '../models/User.js';
import PortalChatThread from '../models/PortalChatThread.js';
import PortalChatMessage from '../models/PortalChatMessage.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyUser } from '../services/notify.js';
import { canOpenDirectMessage } from '../services/orgScope.js';

const router = Router();
router.use(requireAuth);

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_BODY = 8000;

function makeThreadId(companyId, userA, userB) {
  const pair = [String(userA), String(userB)].sort().join('|');
  const h = crypto.createHash('sha256').update(`${companyId}|${pair}`).digest('hex').slice(0, 32);
  return `thr_${h}`;
}

function snippetFromMessage(body, media) {
  if (body && String(body).trim()) {
    const t = String(body).trim();
    return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  }
  if (media && media.length) {
    const r = media[0].resourceType || 'file';
    if (r === 'image') return 'Photo';
    if (r === 'video') return 'Video';
    return 'File';
  }
  return 'Message';
}

async function loadNameMap(companyId, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const rows = await User.find({ companyId, _id: { $in: unique } })
    .select('fullName')
    .lean();
  return Object.fromEntries(rows.map((u) => [u._id, u.fullName || 'User']));
}

function assertParticipant(thread, userId) {
  return thread.participantIds.includes(String(userId));
}

router.get('/threads', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const threads = await PortalChatThread.find({
      companyId: req.user.companyId,
      participantIds: userId,
    })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();

    const otherIds = threads.map((t) => t.participantIds.find((id) => id !== userId)).filter(Boolean);
    const nameMap = await loadNameMap(req.user.companyId, otherIds);
    const peerRows = await User.find({ companyId: req.user.companyId, _id: { $in: otherIds } })
      .select('role department team location')
      .lean();
    const peerMap = Object.fromEntries(peerRows.map((u) => [String(u._id), u]));

    const allowed = threads.filter((t) => {
      const otherId = t.participantIds.find((id) => id !== userId);
      const peer = peerMap[String(otherId)];
      return peer && canOpenDirectMessage(req.user, peer);
    });

    res.json({
      threads: allowed.map((t) => {
        const otherId = t.participantIds.find((id) => id !== userId);
        const peer = peerMap[String(otherId)];
        return {
          id: t._id,
          peerUserId: otherId,
          peerName: nameMap[otherId] || 'Teammate',
          peerRole: peer?.role || '',
          lastPreview: t.lastPreview || '',
          lastMessageAt: t.lastMessageAt ? new Date(t.lastMessageAt).toISOString() : new Date().toISOString(),
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load threads.' });
  }
});

router.post('/threads/open', async (req, res) => {
  try {
    const peerUserId = String(req.body?.peerUserId || '').trim();
    if (!peerUserId) {
      return res.status(400).json({ error: 'peerUserId is required.' });
    }
    if (peerUserId === String(req.user.id)) {
      return res.status(400).json({ error: 'Cannot open a thread with yourself.' });
    }

    const peer = await User.findOne({
      _id: peerUserId,
      companyId: req.user.companyId,
      isActive: true,
    })
      .select('fullName role department team location')
      .lean();

    if (!peer) {
      return res.status(404).json({ error: 'User not found in your workspace.' });
    }
    if (!canOpenDirectMessage(req.user, peer)) {
      return res.status(403).json({
        error: 'Messaging is limited to your department and location (or approved role pairs).',
      });
    }

    const threadId = makeThreadId(req.user.companyId, req.user.id, peerUserId);
    const participantIds = [String(req.user.id), peerUserId].sort();

    await PortalChatThread.findOneAndUpdate(
      { _id: threadId },
      {
        $setOnInsert: {
          _id: threadId,
          companyId: req.user.companyId,
          participantIds,
          lastPreview: '',
          lastMessageAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      threadId,
      peer: {
        id: peerUserId,
        fullName: peer.fullName,
        role: peer.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to open thread.' });
  }
});

router.get('/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const thread = await PortalChatThread.findById(threadId).lean();
    if (!thread || thread.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Thread not found.' });
    }
    if (!assertParticipant(thread, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const peerId = thread.participantIds.find((id) => id !== String(req.user.id));
    if (peerId) {
      const peer = await User.findById(peerId).select('role department team location').lean();
      if (!peer || !canOpenDirectMessage(req.user, peer)) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
    }

    const limit = Math.min(Number(req.query.limit) || 200, 300);
    const rows = await PortalChatMessage.find({
      threadId,
      companyId: req.user.companyId,
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    const senderIds = rows.map((r) => r.senderId);
    const nameMap = await loadNameMap(req.user.companyId, senderIds);

    res.json({
      messages: rows.map((m) => ({
        id: m._id,
        threadId: m.threadId,
        senderId: m.senderId,
        senderName: nameMap[m.senderId] || 'User',
        body: m.body || '',
        media: m.media || [],
        replyToId: m.replyToId || null,
        replyToSnapshot: m.replyToSnapshot || null,
        reactions: (m.reactions || []).map((r) => ({ userId: r.userId, emoji: r.emoji })),
        editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : null,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

router.post('/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const thread = await PortalChatThread.findById(threadId).lean();
    if (!thread || thread.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Thread not found.' });
    }
    if (!assertParticipant(thread, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const otherParticipantId = thread.participantIds.find((x) => x !== String(req.user.id));
    if (otherParticipantId) {
      const peer = await User.findById(otherParticipantId).select('role department team location').lean();
      if (!peer || !canOpenDirectMessage(req.user, peer)) {
        return res.status(403).json({ error: 'You cannot message this user.' });
      }
    }

    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const replyToId = req.body?.replyToId ? String(req.body.replyToId).trim() : null;
    const media = Array.isArray(req.body?.media) ? req.body.media : [];

    const cleanedMedia = media
      .filter((x) => x && typeof x.url === 'string' && x.url.startsWith('http'))
      .slice(0, 6)
      .map((x) => ({
        url: String(x.url).slice(0, 2048),
        publicId: String(x.publicId || '').slice(0, 512),
        resourceType: String(x.resourceType || 'image').slice(0, 32),
        format: String(x.format || '').slice(0, 16),
        bytes: Number(x.bytes) || 0,
        originalName: String(x.originalName || '').slice(0, 260),
      }));

    if (!body.length && !cleanedMedia.length) {
      return res.status(400).json({ error: 'Message text or media is required.' });
    }
    if (body.length > MAX_BODY) {
      return res.status(400).json({ error: 'Message too long.' });
    }

    let replyToSnapshot = null;
    if (replyToId) {
      const parent = await PortalChatMessage.findOne({
        _id: replyToId,
        threadId,
        companyId: req.user.companyId,
        deletedAt: null,
      }).lean();
      if (parent) {
        const nm = await loadNameMap(req.user.companyId, [parent.senderId]);
        replyToSnapshot = {
          messageId: parent._id,
          senderName: nm[parent.senderId] || 'User',
          bodySnippet: snippetFromMessage(parent.body, parent.media),
        };
      }
    }

    const id = `pcm_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const from =
      (typeof req.user.fullName === 'string' && req.user.fullName.trim()) ||
      req.user.email ||
      'User';

    await PortalChatMessage.create({
      _id: id,
      threadId,
      companyId: req.user.companyId,
      senderId: String(req.user.id),
      body,
      media: cleanedMedia,
      replyToId,
      replyToSnapshot,
      reactions: [],
    });

    const preview = snippetFromMessage(body, cleanedMedia);
    await PortalChatThread.updateOne(
      { _id: threadId },
      { $set: { lastMessageAt: new Date(), lastPreview: `${from}: ${preview}` } }
    );

    const otherId = thread.participantIds.find((x) => x !== String(req.user.id));
    if (otherId) {
      await notifyUser(otherId, `Message from ${from}`, preview, 'neutral', { skipEmail: true });
    }

    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

router.patch('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const nextBody = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!nextBody.length) {
      return res.status(400).json({ error: 'body is required.' });
    }
    if (nextBody.length > MAX_BODY) {
      return res.status(400).json({ error: 'Message too long.' });
    }

    const msg = await PortalChatMessage.findOne({
      _id: messageId,
      companyId: req.user.companyId,
      deletedAt: null,
    }).lean();

    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    if (msg.senderId !== String(req.user.id)) {
      return res.status(403).json({ error: 'You can only edit your own messages.' });
    }

    const created = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
    if (Date.now() - created > EDIT_WINDOW_MS) {
      return res.status(400).json({ error: 'Edit window expired (15 minutes).' });
    }

    await PortalChatMessage.updateOne(
      { _id: messageId },
      { $set: { body: nextBody, editedAt: new Date() } }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to edit message.' });
  }
});

router.post('/messages/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji.trim() : '';
    if (!emoji || emoji.length > 16) {
      return res.status(400).json({ error: 'Invalid emoji.' });
    }

    const msg = await PortalChatMessage.findOne({
      _id: messageId,
      companyId: req.user.companyId,
      deletedAt: null,
    });

    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const thread = await PortalChatThread.findById(msg.threadId).lean();
    if (!thread || !assertParticipant(thread, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const uid = String(req.user.id);
    const list = [...(msg.reactions || [])];
    const idx = list.findIndex((r) => r.userId === uid);
    let next;
    if (idx >= 0 && list[idx].emoji === emoji) {
      next = list.filter((_, i) => i !== idx);
    } else {
      next = [...list.filter((r) => r.userId !== uid), { userId: uid, emoji }];
    }
    msg.reactions = next;
    await msg.save();
    res.json({
      ok: true,
      reactions: next.map((r) => ({ userId: r.userId, emoji: r.emoji })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update reaction.' });
  }
});

export default router;
