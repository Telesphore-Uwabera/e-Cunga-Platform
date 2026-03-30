import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './auth/AuthForms.module.css';

const demoAccounts = [
  { label: 'Admin', email: 'admin@ecunga.com' },
  { label: 'Clerk', email: 'clerk.one@ecunga.com' },
  { label: 'Supervisor', email: 'supervisor@ecunga.com' },
  { label: 'Accountant', email: 'accountant@ecunga.com' },
  { label: 'Supplier', email: 'supplier@ecunga.com' },
];

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden className={styles.eyeSvg} fill="none">
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
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden className={styles.eyeSvg} fill="none">
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

export default function LoginPage() {
  const { user, bootstrapping, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@ecunga.com');
  const [password, setPassword] = useState('Demo@1234');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = useMemo(() => location.state?.from || null, [location.state]);

  if (bootstrapping) return <p className={styles.wait}>Checking session…</p>;
  if (user) return <Navigate to={`/app/${user.role}/dashboard`} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const nextUser = await login({ email, password });
      navigate(from || `/app/${nextUser.role}/dashboard`, { replace: true });
    } catch (err) {
      setError(err.body?.error || err.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.subtitle}>Log in to continue managing your inventory workflow.</p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>
          Work email
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@ecunga.com"
            required
          />
        </label>

        <div className={styles.passwordBlock}>
          <div className={styles.passwordLabelRow}>
            <span className={styles.passwordLabel}>Password</span>
            <Link to="/forgot-password" className={styles.forgotLinkBlue}>
              Forgot password?
            </Link>
          </div>
          <div className={styles.inputWrap}>
            <input
              className={`${styles.input} ${styles.inputPassword}`}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className={styles.togglePw}
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className={styles.dividerAuth}>Quick access</div>
      <div className={styles.socialRow}>
        {demoAccounts.map((account) => (
          <button
            key={account.email}
            type="button"
            className={styles.btnSocial}
            onClick={() => {
              setEmail(account.email);
              setPassword('Demo@1234');
            }}
          >
            {account.label}
          </button>
        ))}
      </div>
      <p className={styles.footerLink}>
        Demo password: <strong>Demo@1234</strong>
      </p>
      <p className={styles.footerLink}>
        Don&apos;t have an account? <Link to="/register">Register here</Link>
      </p>
    </>
  );
}
