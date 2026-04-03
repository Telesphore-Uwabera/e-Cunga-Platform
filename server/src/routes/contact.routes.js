import { Router } from 'express';
import { isDatabaseReady } from '../lib/db.js';
import ContactInquiry from '../models/ContactInquiry.js';

const router = Router();

function isNonEmptyString(v, max) {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  return t.length > 0 && t.length <= max;
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
      return res.status(201).json({ ok: true, persisted: true });
    }

    return res.status(201).json({ ok: true, persisted: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not send your message. Try again later.' });
  }
});

export default router;
