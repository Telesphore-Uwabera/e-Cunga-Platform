import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import ContactInquiry from '../models/ContactInquiry.js';
import NewsletterSubscription from '../models/NewsletterSubscription.js';
import NewsCampaign from '../models/NewsCampaign.js';
import Company from '../models/Company.js';
import {
  configureCloudinary,
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
} from '../lib/cloudinaryClient.js';
import { isMailConfigured } from '../services/mail.js';
import {
  getBulkAudience,
  sendNewsCampaign,
  sendSingleCampaignEmail,
} from '../services/bulkNewsEmail.js';

const CAMPAIGN_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const CAMPAIGN_MAX_ATTACHMENTS = 3;

const campaignUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CAMPAIGN_UPLOAD_MAX_BYTES },
  fileFilter(_req, file, cb) {
    const m = file.mimetype || '';
    if (/^image\/|^application\/pdf/.test(m)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only images or PDF files are allowed.'));
  },
});

const router = Router();

// Middleware to ensure only platform tenant admins can access these routes
async function requirePlatformAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const company = await Company.findById(req.user.companyId).select('isPlatformTenant').lean();
    if (!company?.isPlatformTenant) {
      return res.status(403).json({ error: 'Platform admin access required.' });
    }

    next();
  } catch (err) {
    console.error('Platform admin check error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

router.use(requireAuth, requireRoles('admin'), requirePlatformAdmin);

// ===== CONTACT INQUIRIES =====

// Get all contact inquiries with pagination and filters
router.get('/contact-inquiries', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.industry) {
      filter.industry = { $regex: req.query.industry, $options: 'i' };
    }
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { message: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [inquiries, total] = await Promise.all([
      ContactInquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ContactInquiry.countDocuments(filter)
    ]);

    return res.json({
      inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get contact inquiries error:', err);
    return res.status(500).json({ error: 'Could not fetch contact inquiries.' });
  }
});

// Get single contact inquiry
router.get('/contact-inquiries/:id', async (req, res) => {
  try {
    const inquiry = await ContactInquiry.findById(req.params.id).lean();
    if (!inquiry) {
      return res.status(404).json({ error: 'Contact inquiry not found.' });
    }
    return res.json(inquiry);
  } catch (err) {
    console.error('Get contact inquiry error:', err);
    return res.status(500).json({ error: 'Could not fetch contact inquiry.' });
  }
});

// Delete contact inquiry
router.delete('/contact-inquiries/:id', async (req, res) => {
  try {
    const inquiry = await ContactInquiry.findByIdAndDelete(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ error: 'Contact inquiry not found.' });
    }
    return res.json({ ok: true, message: 'Contact inquiry deleted.' });
  } catch (err) {
    console.error('Delete contact inquiry error:', err);
    return res.status(500).json({ error: 'Could not delete contact inquiry.' });
  }
});

// ===== NEWSLETTER SUBSCRIPTIONS =====

// Get all newsletter subscriptions with pagination and filters
router.get('/newsletter-subscriptions', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      filter.email = { $regex: req.query.search, $options: 'i' };
    }

    const [subscriptions, total, activeCount, unsubscribedCount] = await Promise.all([
      NewsletterSubscription.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NewsletterSubscription.countDocuments(filter),
      NewsletterSubscription.countDocuments({ status: 'active' }),
      NewsletterSubscription.countDocuments({ status: 'unsubscribed' })
    ]);

    return res.json({
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        active: activeCount,
        unsubscribed: unsubscribedCount,
        total: activeCount + unsubscribedCount
      }
    });
  } catch (err) {
    console.error('Get newsletter subscriptions error:', err);
    return res.status(500).json({ error: 'Could not fetch newsletter subscriptions.' });
  }
});

// Get single newsletter subscription
router.get('/newsletter-subscriptions/:id', async (req, res) => {
  try {
    const subscription = await NewsletterSubscription.findById(req.params.id).lean();
    if (!subscription) {
      return res.status(404).json({ error: 'Newsletter subscription not found.' });
    }
    return res.json(subscription);
  } catch (err) {
    console.error('Get newsletter subscription error:', err);
    return res.status(500).json({ error: 'Could not fetch newsletter subscription.' });
  }
});

// Delete newsletter subscription
router.delete('/newsletter-subscriptions/:id', async (req, res) => {
  try {
    const subscription = await NewsletterSubscription.findByIdAndDelete(req.params.id);
    if (!subscription) {
      return res.status(404).json({ error: 'Newsletter subscription not found.' });
    }
    return res.json({ ok: true, message: 'Newsletter subscription deleted.' });
  } catch (err) {
    console.error('Delete newsletter subscription error:', err);
    return res.status(500).json({ error: 'Could not delete newsletter subscription.' });
  }
});

// ===== NEWS CAMPAIGNS =====

router.get('/news-campaigns/audience', async (_req, res) => {
  try {
    const { stats } = await getBulkAudience();
    return res.json({ stats });
  } catch (err) {
    console.error('News campaign audience error:', err);
    return res.status(500).json({ error: 'Could not load audience stats.' });
  }
});

router.get('/news-campaigns', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      NewsCampaign.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sentBy', 'fullName email')
        .lean(),
      NewsCampaign.countDocuments(),
    ]);

    return res.json({
      campaigns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List news campaigns error:', err);
    return res.status(500).json({ error: 'Could not fetch news campaigns.' });
  }
});

router.post('/news-campaigns/upload', (req, res, next) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      error: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    });
  }
  configureCloudinary();
  next();
}, (req, res, next) => {
  campaignUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'No file provided.' });
    }

    const kind = String(req.body?.kind || 'attachment').toLowerCase();
    const folder = 'ecunga/news-campaigns';
    const resourceType = req.file.mimetype?.startsWith('image/') ? 'image' : 'raw';

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder,
      resourceType,
    });

    return res.json({
      ok: true,
      kind,
      url: result.secure_url,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error('News campaign upload error:', err);
    return res.status(500).json({ error: 'Could not upload file.' });
  }
});

router.post('/news-campaigns/preview', async (req, res) => {
  try {
    if (!isMailConfigured()) {
      return res.status(503).json({ error: 'Mail is not configured. Set BREVO_API_KEY or SMTP_HOST.' });
    }

    const { subject, headline, bodyHtml, bodyText, heroImageUrl, attachments } = req.body || {};
    if (!subject?.trim() || !headline?.trim() || !bodyHtml?.trim()) {
      return res.status(400).json({ error: 'Subject, headline, and body are required.' });
    }

    const adminEmail = req.user?.email;
    if (!adminEmail) {
      return res.status(400).json({ error: 'Admin email not found.' });
    }

    const campaign = {
      subject: subject.trim(),
      headline: headline.trim(),
      bodyHtml: bodyHtml.trim(),
      bodyText: bodyText?.trim() || '',
      heroImageUrl: heroImageUrl?.trim() || '',
      attachments: Array.isArray(attachments) ? attachments.slice(0, CAMPAIGN_MAX_ATTACHMENTS) : [],
    };

    const result = await sendSingleCampaignEmail(campaign, adminEmail);
    if (!result.ok) {
      return res.status(500).json({ error: result.error || 'Could not send preview email.' });
    }

    return res.json({ ok: true, message: `Preview sent to ${adminEmail}.` });
  } catch (err) {
    console.error('News campaign preview error:', err);
    return res.status(500).json({ error: 'Could not send preview email.' });
  }
});

router.post('/news-campaigns', async (req, res) => {
  try {
    const { subject, headline, bodyHtml, bodyText, heroImageUrl, attachments, sendNow } = req.body || {};

    if (!subject?.trim() || !headline?.trim() || !bodyHtml?.trim()) {
      return res.status(400).json({ error: 'Subject, headline, and body are required.' });
    }

    const campaign = await NewsCampaign.create({
      subject: subject.trim(),
      headline: headline.trim(),
      bodyHtml: bodyHtml.trim(),
      bodyText: bodyText?.trim() || '',
      heroImageUrl: heroImageUrl?.trim() || '',
      attachments: Array.isArray(attachments) ? attachments.slice(0, CAMPAIGN_MAX_ATTACHMENTS) : [],
      status: 'draft',
      sentBy: req.user.id,
    });

    if (sendNow) {
      if (!isMailConfigured()) {
        return res.status(503).json({ error: 'Mail is not configured. Set BREVO_API_KEY or SMTP_HOST.' });
      }

      sendNewsCampaign(campaign._id).catch((err) => {
        console.error('Background news campaign send error:', err);
      });

      return res.status(201).json({
        ok: true,
        campaign,
        message: 'Campaign created and sending started.',
      });
    }

    return res.status(201).json({ ok: true, campaign });
  } catch (err) {
    console.error('Create news campaign error:', err);
    return res.status(500).json({ error: 'Could not create news campaign.' });
  }
});

router.post('/news-campaigns/:id/send', async (req, res) => {
  try {
    if (!isMailConfigured()) {
      return res.status(503).json({ error: 'Mail is not configured. Set BREVO_API_KEY or SMTP_HOST.' });
    }

    const campaign = await NewsCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }
    if (campaign.status === 'sending') {
      return res.status(409).json({ error: 'Campaign is already sending.' });
    }
    if (campaign.status === 'sent') {
      return res.status(409).json({ error: 'Campaign was already sent.' });
    }

    sendNewsCampaign(campaign._id).catch((err) => {
      console.error('Background news campaign send error:', err);
    });

    return res.json({ ok: true, message: 'Campaign send started.' });
  } catch (err) {
    console.error('Send news campaign error:', err);
    return res.status(500).json({ error: 'Could not start campaign send.' });
  }
});

// Export newsletter subscriptions (CSV format)
router.get('/newsletter-subscriptions-export', async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const subscriptions = await NewsletterSubscription.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Create CSV content
    const csvHeader = 'Email,Status,Subscribed At,Unsubscribed At,Source\n';
    const csvRows = subscriptions.map(sub => 
      `${sub.email},${sub.status},${sub.subscribedAt || ''},${sub.unsubscribedAt || ''},${sub.source || ''}`
    ).join('\n');
    
    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=newsletter-subscriptions-${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error('Export newsletter subscriptions error:', err);
    return res.status(500).json({ error: 'Could not export newsletter subscriptions.' });
  }
});

export default router;
