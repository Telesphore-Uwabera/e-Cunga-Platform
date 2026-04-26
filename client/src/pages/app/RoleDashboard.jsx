import { Navigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { allowedSegmentForRole } from '../../constants/rbac.js';
import {
  ClerkDashboard,
  ClerkInventory,
  ClerkExpiry,
  ClerkMaterials,
  ClerkAlerts,
  ClerkUsage,
  ClerkDocuments,
  ClerkMessages,
} from './clerkPages.jsx';
import {
  SupervisorDashboard,
  SupervisorClerksManagement,
  SupervisorApprovals,
  SupervisorVisibility,
  SupervisorInvoices,
  SupervisorReports,
  SupervisorMessages,
} from './supervisorPages.jsx';
import SupplierDirectoryPage from './SupplierDirectoryPage.jsx';
import { SupervisorTeam, SupervisorCompanyRegistrations } from './supervisorWorkspacePages.jsx';
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
  SupplierDelivery,
  SupplierHistory,
  SupplierProductEdit,
  SupplierPayments,
  SupplierMessages,
  SupplierSettings,
} from './supplierPages.jsx';
import {
  AdminDashboard,
  AdminUsers,
  AdminActivity,
  AdminSettings,
  AdminRbac,
  AdminReports,
  AdminHelpCenter,
  AdminMessages,
} from './adminPages.jsx';
import { PortalMyProfile, PortalAccountSettings, PortalNotificationsCenter } from './portalAccountPages.jsx';

export default function RoleDashboard() {
  const { role, segment } = useParams();
  const { user } = useAuth();
  const { setRailSlot } = useOutletContext() || {};

  if (role === 'clerk' && segment === 'requests') {
    return <Navigate to="/app/clerk/materials" replace />;
  }

  // Handle singular redirects for better UX
  if (role === 'supervisor' && (segment === 'accountant' || segment === 'supplier')) {
    return <Navigate to={`/app/${role}/${segment}s`} replace />;
  }

  if (!allowedSegmentForRole(role, segment, user)) {
    return <Navigate to={`/app/${role}/dashboard`} replace />;
  }

  if (role === 'supplier' && segment === 'history') {
    return <Navigate to="/app/supplier/products" replace />;
  }

  if (role === 'clerk') {
    if (segment === 'dashboard') return <ClerkDashboard />;
    if (segment === 'inventory') return <ClerkInventory />;
    if (segment === 'expiry') return <ClerkExpiry />;
    if (segment === 'materials') return <ClerkMaterials setRailSlot={setRailSlot} />;
    if (segment === 'alerts') return <ClerkAlerts />;
    if (segment === 'usage') return <ClerkUsage />;
    if (segment === 'documents') return <ClerkDocuments setRailSlot={setRailSlot} />;
    if (segment === 'messages') return <ClerkMessages />;
  }

  if (role === 'supervisor') {
    if (segment === 'dashboard') return <SupervisorDashboard />;
    if (segment === 'clerks') return <SupervisorClerksManagement />;
    if (segment === 'approvals') return <SupervisorApprovals />;
    if (segment === 'visibility') return <SupervisorVisibility />;
    if (segment === 'invoices') return <SupervisorInvoices />;
    if (segment === 'reports') return <SupervisorReports />;
    if (segment === 'team') return <SupervisorTeam />;
    if (segment === 'accountants') return <SupervisorTeam manageFocus="accountant" />;
    if (segment === 'suppliers') return <SupervisorTeam manageFocus="supplier" />;
    if (segment === 'supplier-directory') return <SupplierDirectoryPage />;
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
    if (segment === 'delivery') return <SupplierDelivery />;
    if (segment === 'product-edit') return <SupplierProductEdit />;
    if (segment === 'products') return <SupplierHistory />;
    if (segment === 'payments') return <SupplierPayments />;
    if (segment === 'messages') return <SupplierMessages />;
    if (segment === 'settings') return <SupplierSettings />;
  }

  if (role === 'admin') {
    if (segment === 'dashboard') return <AdminDashboard />;
    if (segment === 'company-registrations') return <SupervisorCompanyRegistrations />;
    if (segment === 'users') return <AdminUsers />;
    if (segment === 'rbac') return <AdminRbac />;
    if (segment === 'activity') return <AdminActivity />;
    if (segment === 'reports') return <AdminReports />;
    if (segment === 'settings') return <AdminSettings />;
    if (segment === 'messages') return <AdminMessages />;
    if (segment === 'help') return <AdminHelpCenter />;
  }

  if (segment === 'profile') return <PortalMyProfile />;
  if (segment === 'notifications') return <PortalNotificationsCenter />;
  if (segment === 'account-settings') return <PortalAccountSettings />;

  return <Navigate to={`/app/${role}/dashboard`} replace />;
}
