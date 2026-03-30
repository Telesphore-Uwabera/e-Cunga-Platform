import { Navigate, useParams } from 'react-router-dom';
import { allowedSegmentForRole } from '../../constants/rbac.js';
import {
  ClerkDashboard,
  ClerkInventory,
  ClerkExpiry,
  ClerkMaterials,
  ClerkRequests,
  ClerkAlerts,
  ClerkUsage,
  ClerkDocuments,
  ClerkMessages,
} from './clerkPages.jsx';
import {
  SupervisorDashboard,
  SupervisorApprovals,
  SupervisorVisibility,
  SupervisorInvoices,
  SupervisorReports,
  SupervisorMessages,
} from './supervisorPages.jsx';
import {
  AccountantDashboard,
  AccountantApprovals,
  AccountantInvoices,
  AccountantPayments,
  AccountantReports,
  AccountantMessages,
} from './accountantPages.jsx';
import {
  SupplierDashboard,
  SupplierInbox,
  SupplierApprovedProforma,
  SupplierRejectedProforma,
  SupplierDocuments,
  SupplierHistory,
  SupplierMessages,
} from './supplierPages.jsx';
import {
  AdminDashboard,
  AdminUsers,
  AdminActivity,
  AdminSettings,
  AdminRbac,
  AdminReports,
  AdminHelpCenter,
} from './adminPages.jsx';

export default function RoleDashboard() {
  const { role, segment } = useParams();

  if (!allowedSegmentForRole(role, segment)) {
    return <Navigate to={`/app/${role}/dashboard`} replace />;
  }

  if (role === 'clerk') {
    if (segment === 'dashboard') return <ClerkDashboard />;
    if (segment === 'inventory') return <ClerkInventory />;
    if (segment === 'expiry') return <ClerkExpiry />;
    if (segment === 'materials') return <ClerkMaterials />;
    if (segment === 'requests') return <ClerkRequests />;
    if (segment === 'alerts') return <ClerkAlerts />;
    if (segment === 'usage') return <ClerkUsage />;
    if (segment === 'documents') return <ClerkDocuments />;
    if (segment === 'messages') return <ClerkMessages />;
  }

  if (role === 'supervisor') {
    if (segment === 'dashboard') return <SupervisorDashboard />;
    if (segment === 'approvals') return <SupervisorApprovals />;
    if (segment === 'visibility') return <SupervisorVisibility />;
    if (segment === 'invoices') return <SupervisorInvoices />;
    if (segment === 'reports') return <SupervisorReports />;
    if (segment === 'messages') return <SupervisorMessages />;
  }

  if (role === 'accountant') {
    if (segment === 'dashboard') return <AccountantDashboard />;
    if (segment === 'approvals') return <AccountantApprovals />;
    if (segment === 'invoices') return <AccountantInvoices />;
    if (segment === 'payments') return <AccountantPayments />;
    if (segment === 'reports') return <AccountantReports />;
    if (segment === 'messages') return <AccountantMessages />;
  }

  if (role === 'supplier') {
    if (segment === 'dashboard') return <SupplierDashboard />;
    if (segment === 'inbox') return <SupplierInbox />;
    if (segment === 'approved-proforma') return <SupplierApprovedProforma />;
    if (segment === 'rejected-proforma') return <SupplierRejectedProforma />;
    if (segment === 'documents') return <SupplierDocuments />;
    if (segment === 'history') return <SupplierHistory />;
    if (segment === 'messages') return <SupplierMessages />;
  }

  if (role === 'admin') {
    if (segment === 'dashboard') return <AdminDashboard />;
    if (segment === 'users') return <AdminUsers />;
    if (segment === 'rbac') return <AdminRbac />;
    if (segment === 'activity') return <AdminActivity />;
    if (segment === 'reports') return <AdminReports />;
    if (segment === 'settings') return <AdminSettings />;
    if (segment === 'help') return <AdminHelpCenter />;
  }

  return <Navigate to={`/app/${role}/dashboard`} replace />;
}
