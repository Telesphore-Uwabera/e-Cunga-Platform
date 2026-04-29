/** Requisitions still waiting on the supervisor (clerk submitted, not yet routed). */
export const REQUISITION_PENDING_SUPERVISOR = 'submitted';

/**
 * Statuses after supervisor approval — assigned to supplier and through fulfillment.
 * Excludes `submitted` (pre-approval) and `rejected`.
 */
export const REQUISITION_AFTER_SUPERVISOR_APPROVAL = [
  'sentToSupplier',
  'proformaReceived',
  'proformaApproved',
  'paid',
  'creditPurchase',
  'creditAndPaid',
  'deliveryNoteAttached',
  'closed',
];

export function isAwaitingSupervisorApproval(status) {
  return status === REQUISITION_PENDING_SUPERVISOR;
}

export function isSentToSupplierWorkflow(status) {
  return REQUISITION_AFTER_SUPERVISOR_APPROVAL.includes(status);
}

export function isRejectedRequisition(status) {
  return status === 'rejected';
}
