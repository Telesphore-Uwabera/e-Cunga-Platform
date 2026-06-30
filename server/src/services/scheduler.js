import { runBatchAutoRequisitions, autoSubmitDrafts } from './autoRequisition.js';
import Invoice from '../models/Invoice.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import { notifyUser, notifyRole } from './notify.js';

/**
 * Send overdue / due-soon payment reminders to accountants.
 * Runs daily. Fires when deadline is exactly 7 days away (1-week warning)
 * and when deadline is exactly 1 day away.
 */
async function sendPaymentDueReminders() {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find all unpaid / partially-paid invoices that have a paymentDeadline set
    const pending = await Invoice.find({
      status: { $in: ['proformaApproved', 'partiallyPaid', 'creditPurchase'] },
      paymentDeadline: { $exists: true, $ne: null },
    }).lean();

    for (const inv of pending) {
      const deadline = new Date(inv.paymentDeadline);
      deadline.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((deadline - now) / 86400000);

      // Only notify at exactly 7 days and 1 day remaining
      if (daysLeft !== 7 && daysLeft !== 1) continue;

      const company = await Company.findById(inv.companyId).select('name').lean();
      const companyName = company?.name || 'your organization';
      const balanceDue = Math.max(0, Number(inv.amount || 0) - Number(inv.amountPaid || 0));
      const currency = inv.currency || 'RWF';
      const when = daysLeft === 1 ? 'tomorrow' : 'in 7 days';
      const severity = daysLeft === 1 ? 'bad' : 'warn';

      const title = `Payment deadline ${when}: ${inv.reference}`;
      const body = `${inv.reference} — balance due: ${currency} ${balanceDue.toLocaleString()}. Deadline: ${deadline.toLocaleDateString()}.`;

      await notifyRole(inv.companyId, 'accountant', title, body, severity, { skipEmail: true });

      // Also notify the assigned supplier so they're aware
      if (inv.supplierId) {
        await notifyUser(
          inv.supplierId,
          title,
          `Your payment for ${inv.reference} is expected ${when}. Balance: ${currency} ${balanceDue.toLocaleString()}.`,
          severity,
          { skipEmail: true }
        );
      }

      console.log(`[scheduler] Due reminder sent for ${inv.reference} (${daysLeft} days left, company ${inv.companyId})`);
    }
  } catch (err) {
    console.error('[scheduler] sendPaymentDueReminders error:', err);
  }
}

/**
 * A simple internal scheduler that checks every hour to see if it's time to run
 * background tasks.
 * 
 * Scheduled tasks:
 * - Auto-Requisition Drafts: 14th and day-before-last at 02:00 AM.
 * - Auto-Requisition Submits: 15th and last day of every month at 02:00 AM.
 */
export function startInternalScheduler() {
  console.log('[scheduler] Internal background task scheduler started.');

  // Keep Render service awake by self-pinging every 14 minutes
  startKeepAlive();

  // Store the date of the last run to avoid multiple runs in the same hour window
  // (though checking hour === 2 is usually enough for a 1h interval).
  let lastRunDate = null;
  let lastReminderDate = null;

  setInterval(async () => {
    try {
      const now = new Date();
      const date = now.getDate();
      const hour = now.getHours();
      const todayStr = now.toDateString();

      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayBeforeLast = lastDay - 1;
      
      if (hour === 2) {
        if ((date === 14 || date === dayBeforeLast) && lastRunDate !== todayStr) {
          console.log(`[scheduler] Triggering scheduled auto-requisition draft generation for ${todayStr}...`);
          lastRunDate = todayStr;
          await runBatchAutoRequisitions();
        } else if ((date === 15 || date === lastDay) && lastRunDate !== todayStr) {
          console.log(`[scheduler] Triggering auto-requisition draft submission for ${todayStr}...`);
          lastRunDate = todayStr;
          await autoSubmitDrafts();
        }
      }

      // Send payment due-date reminders once per day at 08:00
      if (hour === 8 && lastReminderDate !== todayStr) {
        lastReminderDate = todayStr;
        console.log(`[scheduler] Running payment due-date reminder check for ${todayStr}...`);
        await sendPaymentDueReminders();
      }
    } catch (error) {
      console.error('[scheduler] Error in background task loop:', error);
    }
  }, 3600000); // Check once per hour
}

/**
 * Keeps the server awake by pinging itself every 14 minutes.
 * This prevents Render free instances from sleeping.
 */
function startKeepAlive() {
  const url = process.env.API_URL || process.env.RENDER_EXTERNAL_URL;
  if (!url) {
    console.log('[scheduler] Keep-alive self-ping skipped: no API_URL or RENDER_EXTERNAL_URL defined.');
    return;
  }

  const pingUrl = `${url.replace(/\/$/, '')}/api/health`;
  console.log(`[scheduler] Keep-alive self-ping initialized for URL: ${pingUrl}`);

  // Ping immediately on startup (after 5 seconds)
  setTimeout(pingSelf, 5000);

  // Ping every 14 minutes
  setInterval(pingSelf, 14 * 60 * 1000);

  async function pingSelf() {
    try {
      console.log(`[scheduler] Sending keep-alive self-ping to ${pingUrl}...`);
      const res = await fetch(pingUrl);
      console.log(`[scheduler] Keep-alive self-ping response status: ${res.status}`);
    } catch (err) {
      console.error('[scheduler] Keep-alive self-ping error:', err.message);
    }
  }
}

