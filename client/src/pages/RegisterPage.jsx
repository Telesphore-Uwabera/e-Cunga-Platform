import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import auth from './auth/AuthForms.module.css';
import rp from './RegisterPage.module.css';

const industries = [
  'Healthcare',
  'Hotel / hospitality',
  'Retail & wholesale',
  'Industry / manufacturing',
  'Agribusiness',
  'Government / NGO',
  'Other',
];

function IconBuilding() {
  return (
    <svg className={rp.svgIcon} viewBox="0 0 24 24" width={18} height={18} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14M10 10h.01M10 14h.01M10 18h.01M14 10h.01M14 14h.01M14 18h.01M18 20V10a2 2 0 0 1 2-2h0v12"
      />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className={rp.svgIcon} viewBox="0 0 24 24" width={18} height={18} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className={rp.svgIcon} viewBox="0 0 24 24" width={18} height={18} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16v12H4z"
      />
      <path fill="none" stroke="currentColor" strokeWidth="2" d="m4 7 8 6 8-6" />
    </svg>
  );
}

export default function RegisterPage() {
  const { user, bootstrapping, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    industry: industries[0],
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(true);

  if (bootstrapping) return <p className={auth.wait}>Checking session…</p>;
  if (user) return <Navigate to={`/app/${user.role}/dashboard`} replace />;

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!agree) {
      setError('Please confirm you agree to the platform terms.');
      return;
    }

    setLoading(true);
    try {
      const nextUser = await register({
        companyName: form.companyName,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        password: form.password,
        industry: form.industry,
      });
      navigate(`/app/${nextUser.role}/dashboard`, { replace: true });
    } catch (err) {
      setError(err.body?.error || err.message || 'Unable to create workspace.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className={auth.title}>Register Company</h1>
      <p className={auth.subtitle}>Create your admin workspace and start rolling out e-CUNGA across your teams.</p>
      {error ? (
        <p className={auth.error} role="alert">
          {error}
        </p>
      ) : null}
      <form className={rp.formStack} onSubmit={handleSubmit}>
        <div className={rp.formGrid}>
          <div className={`${rp.field} ${rp.fieldWide}`}>
            <label className={rp.labelCaps} htmlFor="companyName">
              Company or institution
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconBuilding />
              </span>
              <input
                id="companyName"
                className={rp.inputField}
                type="text"
                value={form.companyName}
                onChange={(event) => updateField('companyName', event.target.value)}
                placeholder="Acme Health Services"
                required
              />
            </div>
          </div>

          <div className={rp.field}>
            <label className={rp.labelCaps} htmlFor="firstName">
              First name
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconUser />
              </span>
              <input
                id="firstName"
                className={rp.inputField}
                type="text"
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                placeholder="Aline"
                required
              />
            </div>
          </div>

          <div className={rp.field}>
            <label className={rp.labelCaps} htmlFor="lastName">
              Last name
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconUser />
              </span>
              <input
                id="lastName"
                className={rp.inputField}
                type="text"
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                placeholder="Uwimana"
                required
              />
            </div>
          </div>

          <div className={rp.field}>
            <label className={rp.labelCaps} htmlFor="industry">
              Industry
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconBuilding />
              </span>
              <select
                id="industry"
                className={rp.selectField}
                value={form.industry}
                onChange={(event) => updateField('industry', event.target.value)}
              >
                {industries.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${rp.field} ${rp.fieldWide}`}>
            <label className={rp.labelCaps} htmlFor="email">
              Work email
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconMail />
              </span>
              <input
                id="email"
                className={rp.inputField}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="admin@company.com"
                required
              />
            </div>
          </div>
        </div>

        <div className={rp.passwordGrid}>
          <label className={rp.field}>
            <span className={rp.labelCaps}>Password</span>
            <input
              className={rp.passwordInput}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </label>
          <label className={rp.field}>
            <span className={rp.labelCaps}>Confirm password</span>
            <input
              className={rp.passwordInput}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              placeholder="Repeat password"
              required
            />
          </label>
        </div>

        <label className={auth.checkboxRow}>
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
          I agree to the e-CUNGA platform terms and company setup policy.
        </label>

        <button type="submit" className={auth.btnPrimary} disabled={loading}>
          {loading ? 'Creating workspace…' : 'Create Workspace'}
        </button>
      </form>
      <p className={rp.footerRegister}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </>
  );
}
