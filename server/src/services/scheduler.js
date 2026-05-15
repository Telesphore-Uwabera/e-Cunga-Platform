import { runBatchAutoRequisitions } from './autoRequisition.js';

/**
 * A simple internal scheduler that checks every hour to see if it's time to run
 * background tasks.
 * 
 * Scheduled tasks:
 * - Auto-Requisition: 15th and 30th of every month at 02:00 AM.
 */
export function startInternalScheduler() {
  console.log('[scheduler] Internal background task scheduler started.');

  // Store the date of the last run to avoid multiple runs in the same hour window
  // (though checking hour === 2 is usually enough for a 1h interval).
  let lastRunDate = null;

  setInterval(async () => {
    try {
      const now = new Date();
      const date = now.getDate();
      const hour = now.getHours();
      const todayStr = now.toDateString();

      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      
      // Check for 15th or Last Day at 2:00 AM
      if ((date === 15 || date === lastDay) && hour === 2) {
        if (lastRunDate !== todayStr) {
          console.log(`[scheduler] Triggering scheduled auto-requisition batch for ${todayStr}...`);
          lastRunDate = todayStr;
          await runBatchAutoRequisitions();
        }
      }
    } catch (error) {
      console.error('[scheduler] Error in background task loop:', error);
    }
  }, 3600000); // Check once per hour
}
