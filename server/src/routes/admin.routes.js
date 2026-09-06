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
  MEDIA_UPLOAD_MAX_BYTES,
  uploadBufferToCloudinary,
} from '../lib/cloudinaryClient.js';
import { isMailConfigured, sendMail } from '../services/mail.js';
import {
  getBulkAudience,
  sendNewsCampaign,
  sendSingleCampaignEmail,
} from '../services/bulkNewsEmail.js';
import { rasterImageToWebpIfNeeded } from '../lib/imageToWebp.js';

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

// ===== REPLY TO CONTACT INQUIRY =====

const replyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_UPLOAD_MAX_BYTES, files: 5 },
  fileFilter(_req, file, cb) {
    const m = file.mimetype || '';
    if (/^image\/|^video\/|^application\/pdf|^application\/msword|^application\/vnd\.|^text\//.test(m)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: images, video, PDF, Word, text.'));
    }
  },
});

// Mark inquiry as read
router.patch('/contact-inquiries/:id/read', async (req, res) => {
  try {
    const inquiry = await ContactInquiry.findByIdAndUpdate(
      req.params.id,
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Could not mark as read.' });
  }
});

// Reply to contact inquiry — accepts multipart/form-data (htmlBody + optional files)
router.post('/contact-inquiries/:id/reply', (req, res, next) => {
  replyUpload.array('files', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload error.' });
    next();
  });
}, async (req, res) => {
  try {
    const inquiry = await ContactInquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found.' });

    const htmlBody = String(req.body?.htmlBody || '').trim();
    const textBody = String(req.body?.textBody || '').trim();
    if (!htmlBody) return res.status(400).json({ error: 'Reply body is required.' });

    const attachments = [];

    // 1. Pre-uploaded attachments from client (already on Cloudinary)
    if (req.body?.uploadedAttachments) {
      try {
        const pre = JSON.parse(req.body.uploadedAttachments);
        if (Array.isArray(pre)) {
          pre.forEach((a) => {
            if (a?.url) {
              attachments.push({
                url: a.url,
                publicId: a.publicId || '',
                originalName: a.originalName || '',
                resourceType: a.resourceType || 'raw',
                bytes: a.bytes || 0,
              });
            }
          });
        }
      } catch { /* ignore malformed JSON */ }
    }

    // 2. Files uploaded directly in the multipart form (legacy path)
    const files = req.files || [];
    if (files.length > 0) {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({ error: 'File storage is not configured (Cloudinary).' });
      }
      configureCloudinary();
      for (const file of files) {
        let resourceType = file.mimetype.startsWith('image/') ? 'image'
          : file.mimetype.startsWith('video/') ? 'video' : 'raw';
        let uploadBuffer = file.buffer;
        if (resourceType === 'image') {
          const { buffer: webpBuf } = await rasterImageToWebpIfNeeded(uploadBuffer, file.mimetype);
          uploadBuffer = webpBuf;
        }
        const folder = `ecunga/inquiries/${String(inquiry._id)}`;
        const result = await uploadBufferToCloudinary(uploadBuffer, {
          folder, resourceType,
          public_id: resourceType === 'raw'
            ? `${(file.originalname || 'file').replace(/\.[^/.]+$/, '')}_${Date.now()}`
            : undefined,
        });
        attachments.push({
          url: result.secure_url,
          publicId: result.public_id || '',
          originalName: file.originalname || '',
          resourceType: result.resource_type || resourceType,
          bytes: result.bytes || file.size || 0,
        });
      }
    }

    const adminId = String(req.user?.id || '');
    const adminName = String(req.user?.fullName || req.user?.email || 'Admin');

    inquiry.replies.push({ adminId, adminName, htmlBody, textBody, attachments });
    inquiry.status = 'replied';
    await inquiry.save();

    // Send the reply to the inquirer via email
    const attachmentNodes = attachments.map((a) => ({
      filename: a.originalName || 'attachment',
      path: a.url,
    }));

    // Build a plain-text fallback from htmlBody
    const plainFallback = textBody || htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #334155; margin: 0; padding: 0; background: #f4f4f5; }
    .wrap { max-width: 640px; margin: 0 auto; background: #fff; }
    .header { background: linear-gradient(135deg, #692751 0%, #8b3a62 100%); padding: 32px 24px; text-align: center; }
    .logo { color: #fff; font-size: 26px; font-weight: 800; margin: 0; }
    .body { padding: 32px 28px; }
    .body h2 { font-size: 20px; color: #1e293b; margin: 0 0 16px; }
    .reply-box { padding: 20px; background: #f8fafc; border-left: 4px solid #692751; border-radius: 4px; line-height: 1.7; font-size: 15px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1 class="logo">e-Cunga Portal</h1></div>
    <div class="body">
      <h2>Hello ${inquiry.firstName},</h2>
      <p style="color:#475569;margin:0 0 20px;">Thank you for your patience. Here is our response to your inquiry:</p>
      <div class="reply-box">${htmlBody}</div>
      ${attachments.length ? `<p style="margin:20px 0 0;font-size:13px;color:#64748b;">${attachments.length} attachment${attachments.length > 1 ? 's' : ''} included — view them online via the links you'll receive.</p>` : ''}
      <p style="margin:24px 0 0;color:#475569;">If you have further questions, feel free to reply directly to this email or reach us at <a href="mailto:hello.ecunga@gmail.com" style="color:#692751;">hello.ecunga@gmail.com</a>.</p>
    </div>
    <div class="footer">
      <strong>e-Cunga Portal</strong> · Smart procurement &amp; inventory management · Kigali, Rwanda<br>
      © ${new Date().getFullYear()} e-Cunga Portal. All rights reserved.
    </div>
  </div>
</body>
</html>`;

    sendMail({
      to: inquiry.email,
      subject: `Re: Your inquiry to e-Cunga Portal`,
      text: plainFallback,
      html: emailHtml,
      attachments: attachmentNodes.length ? attachmentNodes : undefined,
    }).catch((err) => console.error('[admin reply mail]', err));

    const saved = inquiry.toObject();
    return res.status(201).json({ ok: true, inquiry: saved });
  } catch (err) {
    console.error('Reply to inquiry error:', err);
    return res.status(500).json({ error: 'Could not save reply.' });
  }
});



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

    // If sendNow is requested, verify mail is configured before creating the document
    if (sendNow && !isMailConfigured()) {
      return res.status(503).json({ error: 'Mail is not configured. Set BREVO_API_KEY or SMTP_HOST.' });
    }

    const campaign = await NewsCampaign.create({
      subject: subject.trim(),
      headline: headline.trim(),
      bodyHtml: bodyHtml.trim(),
      bodyText: bodyText?.trim() || '',
      heroImageUrl: heroImageUrl?.trim() || '',
      attachments: Array.isArray(attachments) ? attachments.slice(0, CAMPAIGN_MAX_ATTACHMENTS) : [],
      status: 'draft',
      sentBy: req.user?.id ?? null,
    });

    if (sendNow) {
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
    console.error('Create news campaign error:', err?.message || err);
    const detail = err?.code === 11000 ? 'Duplicate campaign detected.' : err?.message || 'Could not create news campaign.';
    return res.status(500).json({ error: detail });
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
