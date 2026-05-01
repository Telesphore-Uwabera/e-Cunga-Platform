/**
 * Fallback when the API is offline: no fabricated threads, directory entries, or attachments.
 * With MongoDB, messaging uses LiveMessagingPanel and workspace users from the API.
 */

export function getPortalThreads() {
  return [];
}

export function getPortalAttachments() {
  return [];
}

export const DIRECTORY = {
  supervisors: [],
  clerks: [],
  accountants: [],
  suppliers: [],
};
