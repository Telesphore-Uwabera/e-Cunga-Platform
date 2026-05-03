import Company from '../models/Company.js';
import StockItem from '../models/StockItem.js';
import Consumption from '../models/Consumption.js';
import Requisition from '../models/Requisition.js';
import Invoice from '../models/Invoice.js';
import SupplierCatalogItem from '../models/SupplierCatalogItem.js';
import PortalMessage from '../models/PortalMessage.js';
import PortalNotification from '../models/PortalNotification.js';
import ActivityLog from '../models/ActivityLog.js';
import PortalChatMessage from '../models/PortalChatMessage.js';
import PortalChatThread from '../models/PortalChatThread.js';

/**
 * Deletes all workspace data tied to a company (non–platform-tenant orgs only).
 * Used when the last user for that company is removed by a platform admin.
 */
export async function purgeTenantCompanyData(companyId) {
  const cid = String(companyId || '').trim();
  if (!cid) return { ok: false, reason: 'missing_companyId' };

  const company = await Company.findById(cid).select('isPlatformTenant').lean();
  if (!company) return { ok: false, reason: 'company_not_found' };
  if (company.isPlatformTenant) {
    return { ok: false, reason: 'platform_tenant_refused' };
  }

  await Promise.all([
    StockItem.deleteMany({ companyId: cid }),
    Consumption.deleteMany({ companyId: cid }),
    Requisition.deleteMany({ companyId: cid }),
    Invoice.deleteMany({ companyId: cid }),
    SupplierCatalogItem.deleteMany({ companyId: cid }),
    PortalMessage.deleteMany({ companyId: cid }),
    PortalNotification.deleteMany({ companyId: cid }),
    ActivityLog.deleteMany({ companyId: cid }),
    PortalChatMessage.deleteMany({ companyId: cid }),
    PortalChatThread.deleteMany({ companyId: cid }),
  ]);

  await Company.deleteOne({ _id: cid });
  return { ok: true };
}
