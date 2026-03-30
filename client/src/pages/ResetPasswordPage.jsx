import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { apiFetch } from '../api/client.js';
import rp from './ResetPasswordPage.module.css';

function IconLock() {
  return (
    <svg className={rp.svgIcon} viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"
      />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg className={rp.svgIcon} viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 2v6h-6M3 22v-6h6M3 12a9 9 0 0 1 15.5-6.36M21 12a9 9 0 0 1-15.5 6.36"
      />
    </svg>
  );
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden className={rp.eyeSvg} fill="none">
        <path
          d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden className={rp.eyeSvg} fill="none">
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function passwordStrength(password) {
  if (!password) return { count: 0, weakFirst: false };
  if (password.length < 8) return { count: 1, weakFirst: true };
  let n = 1;
  if (/[0-9]/.test(password)) n += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) n += 1;
  if (/[^a-zA-Z0-9]/.test(password)) n += 1;
  return { count: Math.min(4, n), weakFirst: false };
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const { user, bootstrapping } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  if (bootstrapping) {
    return <p className={rp.wait}>{t('auth.checking')}</p>;
  }
  if (user) {
    return <Navigate to={`/app/${user.role}/dashboard`} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 8) {
      setError(t('auth.resetPwdShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.pwdMismatch'));
      return;
    }
    if (!tokenFromUrl.trim()) {
      setError(t('auth.resetTokenMissing'));
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: tokenFromUrl.trim(), password }),
      });
      setSuccess(data?.message || 'Password updated.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(err.body?.error || err.message || t('auth.resetFail'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className={rp.title}>{t('auth.resetTitle')}</h1>
      <p className={rp.lead}>{t('auth.resetLead')}</p>
      {error ? (
        <p className={`${rp.banner} ${rp.error}`} role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className={`${rp.banner} ${rp.success}`} role="status">
          {success} {t('auth.redirecting')}
        </p>
      ) : null}
      <form className={rp.form} onSubmit={onSubmit}>
        {!tokenFromUrl ? (
          <p className={rp.tokenNote}>
            {t('auth.tokenNotePrefix')} <code>?token=…</code> {t('auth.tokenNoteMid')}{' '}
            <Link to="/forgot-password">{t('auth.requestNew')}</Link>.
          </p>
        ) : null}
        <div className={rp.field}>
          <label className={rp.labelCaps} htmlFor="reset-password">
            {t('auth.newPassword')}
          </label>
          <div className={rp.inputRow}>
            <span className={rp.inputIcon}>
              <IconLock />
            </span>
            <input
              id="reset-password"
              className={rp.inputField}
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="........"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className={rp.togglePw}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          <div className={rp.meter} role="status" aria-label="Password strength">
            {[0, 1, 2, 3].map((i) => {
              const filled = i < strength.count;
              const weakTone = strength.weakFirst && filled && i === 0;
              const plumTone = filled && !strength.weakFirst;
              return (
                <span
                  key={i}
                  className={`${rp.meterSeg}${weakTone ? ` ${rp.meterSegWeak}` : ''}${plumTone ? ` ${rp.meterSegPlum}` : ''}`}
                />
              );
            })}
          </div>
          <p className={rp.helper}>{t('auth.pwdHelper')}</p>
        </div>

        <div className={rp.field}>
          <label className={rp.labelCaps} htmlFor="reset-confirm">
            {t('auth.confirmNew')}
          </label>
          <div className={rp.inputRow}>
            <span className={rp.inputIcon}>
              <IconRefresh />
            </span>
            <input
              id="reset-confirm"
              className={rp.inputField}
              type="password"
              name="confirm"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="........"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className={rp.btnSubmit} disabled={loading || !!success}>
          {loading ? t('auth.saving') : t('auth.resetCta')}
          {!loading && !success ? <span className={rp.arrow}>→</span> : null}
        </button>
      </form>
      <Link to="/login" className={rp.backLink}>
        {t('auth.backLogin')}
      </Link>
    </>
  );
}
