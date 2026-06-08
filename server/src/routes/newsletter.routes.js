import { Router } from 'express';
import { isDatabaseReady } from '../lib/db.js';
import NewsletterSubscription from '../models/NewsletterSubscription.js';
import { sendMail } from '../services/mail.js';

const router = Router();

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length > 0 && 
         trimmed.length <= 254 && 
         /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

async function sendNewsletterWelcomeEmail(email) {
  const subject = 'Welcome to e-Cunga Portal Newsletter!';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #692751 0%, #8b3a62 100%); padding: 40px 20px; text-align: center; }
    .logo { color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 24px; font-weight: 600; color: #1e293b; margin: 0 0 20px 0; }
    .message { font-size: 16px; color: #475569; margin: 0 0 20px 0; line-height: 1.7; }
    .benefits { margin: 25px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #692751; }
    .benefits h3 { margin: 0 0 15px 0; color: #1e293b; font-size: 16px; }
    .benefits ul { margin: 0; padding-left: 20px; }
    .benefits li { margin: 8px 0; color: #475569; font-size: 14px; }
    .cta-button { display: inline-block; padding: 14px 32px; background-color: #692751; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0; }
    .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer-text { font-size: 14px; color: #64748b; margin: 5px 0; }
    .unsubscribe { font-size: 12px; color: #94a3b8; margin-top: 15px; }
    .unsubscribe a { color: #64748b; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">e-Cunga Portal</h1>
    </div>
    
    <div class="content">
      <h2 class="greeting">Welcome to Our Newsletter! 🎉</h2>
      
      <p class="message">
        Thank you for subscribing to the e-Cunga Portal newsletter! You're now part of our community and will receive the latest updates, insights, and features directly to your inbox.
      </p>
      
      <div class="benefits">
        <h3>Here's what you can expect:</h3>
        <ul>
          <li><strong>Product Updates:</strong> Be the first to know about new features and improvements</li>
          <li><strong>Industry Insights:</strong> Tips and best practices for procurement and inventory management</li>
          <li><strong>Exclusive Content:</strong> Access to webinars, case studies, and success stories</li>
          <li><strong>Special Offers:</strong> Early access to promotions and partner benefits</li>
        </ul>
      </div>
      
      <p class="message">
        We're committed to sending you valuable, relevant content. Our newsletters typically go out twice a month, so you won't be overwhelmed with emails.
      </p>
      
      <center>
        <a href="https://ecunga.com" class="cta-button">Explore e-Cunga Portal</a>
      </center>
      
      <p class="message" style="margin-top: 30px; font-size: 14px; color: #64748b;">
        Have questions or feedback? We'd love to hear from you! Reply to this email or contact us at hello.ecunga@gmail.com
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text"><strong>e-Cunga Portal</strong></p>
      <p class="footer-text">Smart procurement and inventory management for healthcare and businesses</p>
      <p class="footer-text">Kigali, Rwanda</p>
      <p class="unsubscribe">
        You received this email because you subscribed to our newsletter.<br>
        If you wish to unsubscribe, please <a href="mailto:hello.ecunga@gmail.com?subject=Unsubscribe">contact us</a>.
      </p>
      <p class="footer-text" style="margin-top: 15px;">
        © ${new Date().getFullYear()} e-Cunga Portal. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Welcome to Our Newsletter!

Thank you for subscribing to the e-Cunga Portal newsletter! You're now part of our community and will receive the latest updates, insights, and features directly to your inbox.

Here's what you can expect:
• Product Updates: Be the first to know about new features and improvements
• Industry Insights: Tips and best practices for procurement and inventory management
• Exclusive Content: Access to webinars, case studies, and success stories
• Special Offers: Early access to promotions and partner benefits

We're committed to sending you valuable, relevant content. Our newsletters typically go out twice a month, so you won't be overwhelmed with emails.

Have questions or feedback? We'd love to hear from you! Reply to this email or contact us at hello.ecunga@gmail.com

Visit our website: https://ecunga.com

---
e-Cunga Portal
Smart procurement and inventory management for healthcare and businesses
Kigali, Rwanda

You received this email because you subscribed to our newsletter.
If you wish to unsubscribe, please contact us at hello.ecunga@gmail.com

© ${new Date().getFullYear()} e-Cunga Portal. All rights reserved.
  `;

  return sendMail({ to: email, subject, text, html });
}

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ error: 'Database not ready. Please try again later.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already subscribed
    const existing = await NewsletterSubscription.findOne({ email: normalizedEmail });
    
    if (existing) {
      if (existing.status === 'active') {
        return res.status(200).json({ 
          ok: true, 
          message: 'You are already subscribed to our newsletter.' 
        });
      } else {
        // Reactivate subscription
        existing.status = 'active';
        existing.subscribedAt = new Date();
        existing.unsubscribedAt = undefined;
        await existing.save();
        
        // Send welcome email
        sendNewsletterWelcomeEmail(normalizedEmail).catch(err => {
          console.error('Failed to send newsletter welcome email:', err);
        });
        
        return res.status(200).json({ 
          ok: true, 
          message: 'Welcome back! Your subscription has been reactivated.' 
        });
      }
    }

    // Create new subscription
    await NewsletterSubscription.create({
      email: normalizedEmail,
      status: 'active',
      source: 'website_footer'
    });

    // Send welcome email (don't block response if email fails)
    sendNewsletterWelcomeEmail(normalizedEmail).catch(err => {
      console.error('Failed to send newsletter welcome email:', err);
    });

    return res.status(201).json({ 
      ok: true, 
      message: 'Successfully subscribed! Check your email for confirmation.' 
    });
  } catch (err) {
    console.error('Newsletter subscription error:', err);
    return res.status(500).json({ 
      error: 'Could not process subscription. Please try again later.' 
    });
  }
});

// Unsubscribe from newsletter
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!isDatabaseReady()) {
      return res.status(503).json({ error: 'Database not ready. Please try again later.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const subscription = await NewsletterSubscription.findOne({ email: normalizedEmail });

    if (!subscription) {
      return res.status(404).json({ error: 'Email not found in our subscription list.' });
    }

    if (subscription.status === 'unsubscribed') {
      return res.status(200).json({ 
        ok: true, 
        message: 'You are already unsubscribed.' 
      });
    }

    subscription.status = 'unsubscribed';
    subscription.unsubscribedAt = new Date();
    await subscription.save();

    return res.status(200).json({ 
      ok: true, 
      message: 'Successfully unsubscribed from our newsletter.' 
    });
  } catch (err) {
    console.error('Newsletter unsubscribe error:', err);
    return res.status(500).json({ 
      error: 'Could not process unsubscription. Please try again later.' 
    });
  }
});

export default router;
