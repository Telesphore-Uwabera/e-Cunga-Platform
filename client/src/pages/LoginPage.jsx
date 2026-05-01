import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { setSession } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import PasswordEyeIcon from '../components/PasswordEyeIcon.jsx';
import styles from './auth/AuthForms.module.css';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden className={styles.providerIcon}>
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-0.9 6.7-2.4l-3.2-2.6c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.2V7.7H2.9a10 10 0 0 0 0 8.6l3.3-2.7Z" />
      <path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.8-2.8A9.7 9.7 0 0 0 12 2 10 10 0 0 0 2.9 7.7l3.3 2.7C7 7.8 9.3 6 12 6Z" />
    </svg>
  );
}



export default function LoginPage() {
  const { t } = useI18n();
  const { user, bootstrapping, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  const from = useMemo(() => location.state?.from || null, [location.state]);

  // Handle OAuth login
  const handleOAuthLogin = (provider) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    window.location.href = `${apiUrl}/api/auth/${provider}`;
  };

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    
    if (token) {
      setSession(token, null);
      window.history.replaceState({}, document.title, window.location.pathname);
      const dest =
        from && typeof from === 'string' && from.startsWith('/') && !from.startsWith('/login')
          ? from
          : '/app';
      window.location.assign(dest.startsWith('http') ? dest : `${window.location.origin}${dest}`);
    } else if (error) {
      setError(error);
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [from, navigate]);

  if (bootstrapping) return <p className={styles.wait}>{t('auth.checking')}</p>;
  if (user) return <Navigate to={`/app/${user.role}/dashboard`} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const nextUser = await login({ email, password });
      navigate(from || `/app/${nextUser.role}/dashboard`, { replace: true });
    } catch (err) {
      if (err.body?.code === 'PENDING_COMPANY_APPROVAL') {
        setError(err.body?.error || t('auth.loginPendingCompany'));
        return;
      }
      if (err.body?.code === 'ACCOUNT_INACTIVE') {
        setError(err.body?.error || t('auth.accountInactive'));
        return;
      }
      if (err.body?.code === 'INVITE_ACTIVATION_REQUIRED') {
        setError(err.body?.error || t('auth.loginInviteSetup'));
        return;
      }
      const base = err.body?.error || err.message || t('auth.loginFail');
      const hint = err.body?.hint ? ` ${err.body.hint}` : '';
      setError(`${base}${hint}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className={styles.title}>{t('auth.loginTitle')}</h1>
      <p className={styles.subtitle}>{t('auth.loginSubtitle')}</p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>
          {t('auth.email')}
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
          />
        </label>

        <div className={styles.passwordBlock}>
          <div className={styles.passwordLabelRow}>
            <span className={styles.passwordLabel}>{t('auth.password')}</span>
            <Link to="/forgot-password" className={styles.forgotLinkBlue}>
              {t('auth.forgotPassword')}
            </Link>
          </div>
          <div className={styles.inputWrap}>
            <input
              className={`${styles.input} ${styles.inputPassword}`}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className={styles.togglePw}
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <PasswordEyeIcon open={showPassword} className={styles.eyeSvg} />
            </button>
          </div>
        </div>

        <label className={styles.rememberRow}>
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>{t('auth.remember')}</span>
        </label>

        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? t('auth.loggingIn') : t('auth.loginCta')}
        </button>
      </form>

      <div className={styles.dividerAuth}>{t('auth.orProviders')}</div>
      <div className={styles.providerRow}>
        <button 
          type="button" 
          className={styles.providerBtn}
          onClick={() => handleOAuthLogin('google')}
        >
          <GoogleIcon />
          <span>{t('auth.google')}</span>
        </button>
        <button 
          type="button" 
          className={styles.providerBtn}
          onClick={() => document.querySelector('input[type="email"]')?.focus()}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden className={styles.providerIcon}>
            <path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
          <span>{t('auth.useEmail')}</span>
        </button>
      </div>

      <p className={styles.footerLink}>
        {t('auth.invitedFooter')}{' '}
        <Link to="/activate-account">{t('auth.activateAccountLink')}</Link>
      </p>
      <p className={styles.footerLink}>
        {t('auth.noAccount')} <Link to="/register">{t('auth.createAccount')}</Link>
      </p>
      <p className={styles.footerLink}>
        <Link to="/terms">{t('shell.termsAndConditions')}</Link>
        {' · '}
        <Link to="/privacy">{t('shell.privacyPolicy')}</Link>
      </p>
      <p className={styles.footerLink}>
        <Link to="/contact">{t('shell.helpCenter')}</Link>
      </p>
    </>
  );
}
