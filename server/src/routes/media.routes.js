import { Router } from 'express';
import multer from 'multer';
import PortalChatThread from '../models/PortalChatThread.js';
import PortalChatMessage from '../models/PortalChatMessage.js';
import { requireAuth } from '../middleware/auth.js';
import { configureCloudinary, isCloudinaryConfigured, uploadBufferToCloudinary } from '../lib/cloudinaryClient.js';
import { rasterImageToWebpIfNeeded } from '../lib/imageToWebp.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const m = file.mimetype || '';
    if (/^image\/|^video\/|^application\/pdf/.test(m)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only images, video, or PDF are allowed.'));
  },
});

function mediaUnavailable(_req, res) {
  res.status(503).json({
    error: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
  });
}

router.post('/upload', (req, res, next) => {
  if (!isCloudinaryConfigured()) {
    return mediaUnavailable(req, res);
  }
  configureCloudinary();
  next();
}, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.message || 'Upload failed.';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'No file.' });
    }

    const companyId = String(req.user.companyId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const userId = String(req.user.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const folder = `ecunga/${companyId}/${userId}`;

    let resourceType = 'auto';
    if (req.file.mimetype.startsWith('image/')) resourceType = 'image';
    else if (req.file.mimetype.startsWith('video/')) resourceType = 'video';
    else if (req.file.mimetype === 'application/pdf') resourceType = 'raw';

    let uploadBuffer = req.file.buffer;
    let storedFormat = 'original';
    if (resourceType === 'image') {
      const { buffer: webpBuf, format } = await rasterImageToWebpIfNeeded(uploadBuffer, req.file.mimetype);
      uploadBuffer = webpBuf;
      storedFormat = format;
    }

    const result = await uploadBufferToCloudinary(uploadBuffer, { folder, resourceType });

    res.status(201).json({
      url: result.secure_url,
      secure_url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type || resourceType,
      format: storedFormat,
      bytes: result.bytes || uploadBuffer.length,
      originalName: req.file.originalname || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload to Cloudinary failed.' });
  }
});

router.get('/library', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const threads = await PortalChatThread.find({
      companyId: req.user.companyId,
      participantIds: userId,
    })
      .select('_id')
      .lean();
    const threadIds = threads.map((t) => t._id);
    if (!threadIds.length) {
      return res.json({ items: [] });
    }

    const limit = Math.min(Number(req.query.limit) || 60, 120);
    const messages = await PortalChatMessage.find({
      threadId: { $in: threadIds },
      companyId: req.user.companyId,
      deletedAt: null,
      'media.0': { $exists: true },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const items = [];
    for (const m of messages) {
      for (const med of m.media || []) {
        items.push({
          messageId: m._id,
          threadId: m.threadId,
          url: med.url,
          resourceType: med.resourceType,
          originalName: med.originalName || '',
          createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : '',
        });
      }
    }

    res.json({ items: items.slice(0, limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load media library.' });
  }
});

export default router;
