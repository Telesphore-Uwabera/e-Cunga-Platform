import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { I18nProvider } from './i18n/I18nContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RoleHomeRedirect from './components/RoleHomeRedirect.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import SplitAuthLayout from './layouts/SplitAuthLayout.jsx';
import RegisterLayout from './layouts/RegisterLayout.jsx';
import CenteredAuthLayout from './layouts/CenteredAuthLayout.jsx';
import ResetPasswordLayout from './layouts/ResetPasswordLayout.jsx';
import AppShell from './layouts/AppShell.jsx';
import HomePage from './pages/HomePage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import LegalNoticePage from './pages/LegalNoticePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ActivateAccountPage from './pages/ActivateAccountPage.jsx';
import RoleDashboard from './pages/app/RoleDashboard.jsx';
import ThemeDocumentSync from './components/ThemeDocumentSync.jsx';

function AppNotFound() {
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
      <BrowserRouter>
        <ThemeDocumentSync />
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="privacy" element={<LegalNoticePage doc="privacy" />} />
            <Route path="terms" element={<LegalNoticePage doc="terms" />} />
            <Route path="cookies" element={<LegalNoticePage doc="cookies" />} />
          </Route>

          <Route path="login" element={<SplitAuthLayout />}>
            <Route index element={<LoginPage />} />
          </Route>

          <Route path="register" element={<RegisterLayout />}>
            <Route index element={<RegisterPage />} />
          </Route>

          <Route path="forgot-password" element={<CenteredAuthLayout />}>
            <Route index element={<ForgotPasswordPage />} />
          </Route>

          <Route path="reset-password" element={<ResetPasswordLayout />}>
            <Route index element={<ResetPasswordPage />} />
          </Route>

          <Route path="activate-account" element={<CenteredAuthLayout />}>
            <Route index element={<ActivateAccountPage />} />
          </Route>

          <Route path="app" element={<ProtectedRoute />}>
            <Route index element={<RoleHomeRedirect />} />
            <Route path=":role/:segment" element={<AppShell />}>
              <Route index element={<RoleDashboard />} />
            </Route>
          </Route>

          <Route path="*" element={<AppNotFound />} />
        </Routes>
      </BrowserRouter>
      </I18nProvider>
    </AuthProvider>
  );
}
