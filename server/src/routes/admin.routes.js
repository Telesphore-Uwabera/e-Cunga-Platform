import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import ContactInquiry from '../models/ContactInquiry.js';
import NewsletterSubscription from '../models/NewsletterSubscription.js';
import Company from '../models/Company.js';

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
