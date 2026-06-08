import { Router } from 'express';
import { isDatabaseReady } from '../lib/db.js';
import ContactInquiry from '../models/ContactInquiry.js';
import { sendMail } from '../services/mail.js';

const router = Router();

function isNonEmptyString(v, max) {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  return t.length > 0 && t.length <= max;
}

async function sendContactConfirmationEmail(contactData) {
  const { firstName, lastName, email } = contactData;
  
  const subject = 'We received your message - e-Cunga Portal';
  
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
    .cta-button { display: inline-block; padding: 14px 32px; background-color: #692751; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0; }
    .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer-text { font-size: 14px; color: #64748b; margin: 5px 0; }
    .contact-info { margin: 20px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #692751; }
    .contact-info h3 { margin: 0 0 12px 0; color: #1e293b; font-size: 16px; }
    .contact-info p { margin: 8px 0; color: #475569; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">e-Cunga Portal</h1>
    </div>
    
    <div class="content">
      <h2 class="greeting">Hello ${firstName}!</h2>
      
      <p class="message">
        Thank you for reaching out to e-Cunga Portal. We have received your message and our team will review it shortly.
      </p>
      
      <p class="message">
        We typically respond within 1-2 business days. One of our team members will get back to you at <strong>${email}</strong> with a detailed response to your inquiry.
      </p>
      
      <div class="contact-info">
        <h3>In the meantime, here's how you can reach us:</h3>
        <p><strong>📧 Email:</strong> hello.ecunga@gmail.com</p>
        <p><strong>📞 Phone:</strong> +250 781 975 074</p>
        <p><strong>💬 WhatsApp:</strong> +250 781 975 074</p>
        <p><strong>📍 Location:</strong> Kigali, Rwanda</p>
      </div>
      
      <p class="message">
        If you need immediate assistance, feel free to contact us directly via phone or WhatsApp.
      </p>
      
      <center>
        <a href="https://ecunga.com" class="cta-button">Visit Our Website</a>
      </center>
    </div>
    
    <div class="footer">
      <p class="footer-text"><strong>e-Cunga Portal</strong></p>
      <p class="footer-text">Smart procurement and inventory management for healthcare and businesses</p>
      <p class="footer-text">Kigali, Rwanda</p>
      <p class="footer-text" style="margin-top: 15px;">
        © ${new Date().getFullYear()} e-Cunga Portal. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hello ${firstName}!

Thank you for reaching out to e-Cunga Portal. We have received your message and our team will review it shortly.

We typically respond within 1-2 business days. One of our team members will get back to you at ${email} with a detailed response to your inquiry.

In the meantime, here's how you can reach us:
📧 Email: hello.ecunga@gmail.com
📞 Phone: +250 781 975 074
💬 WhatsApp: +250 781 975 074
📍 Location: Kigali, Rwanda

If you need immediate assistance, feel free to contact us directly via phone or WhatsApp.

Visit our website: https://ecunga.com

---
e-Cunga Portal
Smart procurement and inventory management for healthcare and businesses
Kigali, Rwanda
© ${new Date().getFullYear()} e-Cunga Portal. All rights reserved.
  `;

  return sendMail({ to: email, subject, text, html });
}

router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, industry, message } = req.body || {};

    if (!isNonEmptyString(firstName, 120) || !isNonEmptyString(lastName, 120)) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }
    if (!isNonEmptyString(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid work email is required.' });
    }
    if (!isNonEmptyString(message, 8000)) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const ind = typeof industry === 'string' ? industry.trim().slice(0, 120) : '';

    if (isDatabaseReady()) {
      await ContactInquiry.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        industry: ind,
        message: message.trim(),
      });
      
      // Send confirmation email (don't block response if email fails)
      sendContactConfirmationEmail({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      }).catch(err => {
        console.error('Failed to send contact confirmation email:', err);
      });
      
      return res.status(201).json({ ok: true, persisted: true });
    }

    return res.status(201).json({ ok: true, persisted: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not send your message. Try again later.' });
  }
});

export default router;
