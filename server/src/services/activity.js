import ActivityLog from '../models/ActivityLog.js';

export async function logActivity(companyId, userId, action, payload = {}) {
  try {
    await ActivityLog.create({
      companyId,
      userId,
      action,
      payload,
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
}
