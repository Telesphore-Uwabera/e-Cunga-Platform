import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { apiFetch } from '../api/client.js';
import styles from './auth/AuthForms.module.css';
import fp from './ForgotPasswordPage.module.css';

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
      />
      <path fill="none" stroke="currentColor" strokeWidth="2" d="m22 6-10 7L2 6" />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const { user, bootstrapping } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (bootstrapping) {
    return <p className={fp.wait}>{t('auth.checking')}</p>;
  }
  if (user) {
    return <Navigate to={`/app/${user.role}/dashboard`} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus(null);
    setLoading(true);
    try {
      const data = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (data?.sent === true) {
        setStatus('sent');
      } else {
        setStatus('no_account');
      }
    } catch (err) {
      setError(err.message || t('auth.wentWrong'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className={fp.title}>{t('auth.forgotTitle')}</h1>
      <p className={fp.lead}>{t('auth.forgotLead')}</p>
      {error ? (
        <p className={`${fp.banner} ${fp.bannerError}`} role="alert">
          {error}
        </p>
      ) : null}
      {status === 'sent' ? (
        <p className={`${fp.banner} ${fp.bannerOk}`} role="status">
          {t('auth.forgotSent')}
        </p>
      ) : null}
      {status === 'no_account' ? (
        <div className={`${fp.banner} ${fp.bannerInfo}`} role="status">
          <p className={fp.bannerInfoP}>{t('auth.forgotNoAccount')}</p>
          <Link to="/register" className={fp.bannerInfoLink}>
            {t('auth.createAccount')}
          </Link>
        </div>
      ) : null}
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={fp.field}>
          <label className={fp.labelCaps} htmlFor="forgot-email">
            {t('auth.emailAddress')}
          </label>
          <div className={fp.inputRow}>
            <span className={fp.inputIcon}>
              <IconMail />
            </span>
            <input
              id="forgot-email"
              className={fp.inputField}
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="curator@ecunga.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className={fp.btnSend} disabled={loading}>
          {loading ? t('auth.sending') : t('auth.sendReset')}
          {!loading ? <span className={fp.arrow}>→</span> : null}
        </button>
      </form>
      <Link to="/login" className={fp.backLink}>
        {t('auth.backLogin')}
      </Link>
    </>
  );
}
