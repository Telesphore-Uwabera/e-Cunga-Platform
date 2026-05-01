/**
 * Maps server ActivityLog.action values to user-facing sentences (with i18n).
 */

function metaLine(meta, ...keys) {
  if (!meta || typeof meta !== 'object') return '';
  for (const k of keys) {
    const v = meta[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function roleLabel(role) {
  const r = String(role || '').toLowerCase();
  if (!r) return 'team member';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/**
 * @param {{ action?: string; meta?: object }} entry
 * @param {(key: string, vars?: object) => string} t — useI18n().t
 */
export function describeActivityEntry(entry, t) {
  const action = String(entry?.action || '');
  const meta = entry?.meta && typeof entry.meta === 'object' ? entry.meta : {};
  const itemHint = metaLine(meta, 'name', 'itemName', 'sku');
  const withItem = (key) => {
    const base = t(key);
    return itemHint ? `${base} (${itemHint})` : base;
  };

  switch (action) {
    case 'company.settings.updated':
      return t('app.activity.companySettingsUpdated');
    case 'user.invited': {
      const name = metaLine(meta, 'fullName') || metaLine(meta, 'email') || t('app.activity.teamMemberFallback');
      const email = metaLine(meta, 'email') || '—';
      const rl = roleLabel(meta.role);
      const inviteLoc = metaLine(meta, 'location');
      const locSuffix = inviteLoc ? `. ${t('app.activity.locationSuffix', { location: inviteLoc })}` : '';
      return t('app.activity.userInvited', { name, email, role: rl, locSuffix });
    }
    case 'user.deleted': {
      const name =
        metaLine(meta, 'deletedUserFullName', 'fullName') ||
        metaLine(meta, 'deletedUserEmail', 'email') ||
        t('app.activity.teamMemberFallback');
      const email = metaLine(meta, 'deletedUserEmail', 'email') || '—';
      const delLoc = metaLine(meta, 'deletedUserLocation', 'location');
      const locSuffix = delLoc ? `. ${t('app.activity.locationSuffix', { location: delLoc })}` : '';
      return t('app.activity.userDeleted', { name, email, locSuffix });
    }
    case 'user.toggled':
      return meta.isActive === false ? t('app.activity.userAccessDisabled') : t('app.activity.userAccessEnabled');
    case 'user.profile.updated':
      return t('app.activity.userProfileUpdated');
    case 'user.password.changed':
      return t('app.activity.userPasswordChanged');
    case 'stock.request.created':
      return t('app.activity.stockRequestCreated');
    case 'stock.request.approved':
      return t('app.activity.stockRequestApproved');
    case 'stock.request.rejected':
      return t('app.activity.stockRequestRejected');
    case 'stock.item.added':
      return withItem('app.activity.stockItemAdded');
    case 'stock.item.updated':
      return withItem('app.activity.stockItemUpdated');
    case 'stock.item.deleted':
      return withItem('app.activity.stockItemDeleted');
    case 'stock.item.consumed':
      return withItem('app.activity.stockItemConsumed');
    case 'stock.auto_requisition':
      return withItem('app.activity.stockAutoRequisition');
    case 'stock.fulfilled_from_requisition':
      return t('app.activity.stockFulfilledFromRequisition');
    case 'invoice.created':
      return t('app.activity.invoiceCreated');
    case 'invoice.supplier_update':
      return t('app.activity.invoiceSupplierUpdate');
    case 'invoice.accountant_update':
      return t('app.activity.invoiceAccountantUpdate');
    case 'invoice.approved':
      return t('app.activity.invoiceApproved');
    case 'invoice.rejected':
      return t('app.activity.invoiceRejected');
    case 'invoice.paid':
      return t('app.activity.invoicePaid');
    case 'delivery.note.attached':
      return t('app.activity.deliveryNoteAttached');
    case 'workflow.closed':
      return t('app.activity.workflowClosed');
    case 'invoice.proforma.received':
      return t('app.activity.invoiceProformaReceived');
    case 'requisition.clerk_proforma.accepted':
      return t('app.activity.clerkProformaAccepted');
    case 'requisition.clerk_proforma.rejected':
      return t('app.activity.clerkProformaRejected');
    case 'supplier.catalog.created':
      return t('app.activity.supplierCatalogCreated');
    case 'supplier.catalog.updated':
      return t('app.activity.supplierCatalogUpdated');
    case 'company.registration.approved':
      return t('app.activity.companyRegistrationApproved');
    case 'company.registration.rejected':
      return t('app.activity.companyRegistrationRejected');
    default: {
      const human = action.replace(/\./g, ' ').replace(/_/g, ' ').trim() || 'activity';
      return t('app.activity.unknownAction', { action: human });
    }
  }
}
