import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { apiFetch } from '../api/client.js';
import styles from './auth/AuthForms.module.css';

export default function ActivateAccountPage() {
  const { t } = useI18n();
  const { user, bootstrapping } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  if (bootstrapping) return <p className={styles.wait}>{t('auth.checking')}</p>;
  if (user) return <Navigate to={`/app/${user.role}/dashboard`} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 8) {
      setError(t('auth.pwdShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.pwdMismatch'));
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/auth/complete-invite', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          password,
        }),
      });
      setSuccess(data?.message || t('auth.activateDone'));
      setOtp('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.body?.error || err.message || t('auth.activateFail'));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError('');
    setResendLoading(true);
    try {
      const data = await apiFetch('/auth/resend-invite-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSuccess(data?.message || t('auth.checkEmail'));
    } catch (err) {
      setError(err.body?.error || err.message || t('auth.wentWrong'));
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <>
      <h1 className={styles.title}>{t('auth.activateTitle')}</h1>
      <p className={styles.subtitle}>{t('auth.activateSubtitle')}</p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className={styles.success} role="status">
          {success}
        </p>
      ) : null}
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          {t('auth.workEmail')}
          <input className={styles.input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className={styles.label}>
          {t('auth.otpLabel')}
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
        </label>
        <label className={styles.label}>
          {t('auth.password')}
          <input className={styles.input} type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label className={styles.label}>
          {t('auth.confirmPassword')}
          <input className={styles.input} type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? t('auth.activateSaving') : t('auth.activateSubmit')}
        </button>
      </form>
      <p className={styles.checkboxRow}>
        <button type="button" className={styles.forgotLink} onClick={onResend} disabled={resendLoading || !email.trim()}>
          {resendLoading ? t('auth.activateResendSending') : t('auth.activateResend')}
        </button>
      </p>
      <p className={styles.subtitle}>
        <Link to="/login">{t('auth.backLogin')}</Link>
      </p>
    </>
  );
}
