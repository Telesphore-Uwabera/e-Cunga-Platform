import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import auth from './auth/AuthForms.module.css';
import rp from './RegisterPage.module.css';

const INDUSTRY_VALUES = [
  'Healthcare',
  'Hotel / hospitality',
  'Retail & wholesale',
  'Industry / manufacturing',
  'Agribusiness',
  'Government / NGO',
  'Other',
];

const INDUSTRY_LABEL_KEY = {
  Healthcare: 'healthcare',
  'Hotel / hospitality': 'hotel',
  'Retail & wholesale': 'retail',
  'Industry / manufacturing': 'industry',
  Agribusiness: 'agri',
  'Government / NGO': 'gov',
  Other: 'other',
};

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
  const { t } = useI18n();
  const { user, bootstrapping, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    industry: INDUSTRY_VALUES[0],
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(true);

  if (bootstrapping) return <p className={auth.wait}>{t('auth.checking')}</p>;
  if (user) return <Navigate to={`/app/${user.role}/dashboard`} replace />;

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError(t('auth.pwdShort'));
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError(t('auth.pwdMismatch'));
      return;
    }

    if (!agree) {
      setError(t('auth.agreeRequired'));
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
      setError(err.body?.error || err.message || t('auth.registerFail'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className={auth.title}>{t('auth.registerTitle')}</h1>
      <p className={auth.subtitle}>{t('auth.registerSubtitle')}</p>
      {error ? (
        <p className={auth.error} role="alert">
          {error}
        </p>
      ) : null}
      <form className={rp.formStack} onSubmit={handleSubmit}>
        <div className={rp.formGrid}>
          <div className={`${rp.field} ${rp.fieldWide}`}>
            <label className={rp.labelCaps} htmlFor="companyName">
              {t('auth.company')}
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
                placeholder={t('auth.phCompany')}
                required
              />
            </div>
          </div>

          <div className={rp.field}>
            <label className={rp.labelCaps} htmlFor="firstName">
              {t('auth.firstName')}
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
                placeholder={t('auth.phName')}
                required
              />
            </div>
          </div>

          <div className={rp.field}>
            <label className={rp.labelCaps} htmlFor="lastName">
              {t('auth.lastName')}
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
                placeholder={t('auth.phLast')}
                required
              />
            </div>
          </div>

          <div className={rp.field}>
            <label className={rp.labelCaps} htmlFor="industry">
              {t('auth.industry')}
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
                {INDUSTRY_VALUES.map((industry) => (
                  <option key={industry} value={industry}>
                    {t(`auth.industryLabels.${INDUSTRY_LABEL_KEY[industry] || 'other'}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${rp.field} ${rp.fieldWide}`}>
            <label className={rp.labelCaps} htmlFor="email">
              {t('auth.workEmail')}
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
                placeholder={t('auth.phEmail')}
                required
              />
            </div>
          </div>
        </div>

        <div className={rp.passwordGrid}>
          <label className={rp.field}>
            <span className={rp.labelCaps}>{t('auth.password')}</span>
            <input
              className={rp.passwordInput}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder={t('auth.phPwd')}
              required
            />
          </label>
          <label className={rp.field}>
            <span className={rp.labelCaps}>{t('auth.confirmPassword')}</span>
            <input
              className={rp.passwordInput}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              placeholder={t('auth.phRepeat')}
              required
            />
          </label>
        </div>

        <label className={auth.checkboxRow}>
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
          {t('auth.agreeTerms')}
        </label>

        <button type="submit" className={auth.btnPrimary} disabled={loading}>
          {loading ? t('auth.creating') : t('auth.createWorkspace')}
        </button>
      </form>
      <p className={rp.footerRegister}>
        {t('auth.haveAccount')} <Link to="/login">{t('auth.signInLink')}</Link>
      </p>
    </>
  );
}
