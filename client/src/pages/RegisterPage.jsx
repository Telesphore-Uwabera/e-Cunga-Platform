import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import PasswordEyeIcon from '../components/PasswordEyeIcon.jsx';
import auth from './auth/AuthForms.module.css';
import rp from './RegisterPage.module.css';

const INDUSTRY_VALUES = [
  'Healthcare',
  'Laboratory',
  'Hotel / hospitality',
  'Retail & wholesale',
  'Industry / manufacturing',
  'Agribusiness',
  'Government / NGO',
  'Other',
];

const INDUSTRY_LABEL_KEY = {
  Healthcare: 'healthcare',
  Laboratory: 'lab',
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

function IconPhone() {
  return (
    <svg className={rp.svgIcon} viewBox="0 0 24 24" width={18} height={18} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
      />
    </svg>
  );
}

function IconImage() {
  return (
    <svg className={rp.svgIcon} viewBox="0 0 24 24" width={18} height={18} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg className={rp.svgIcon} viewBox="0 0 24 24" width={18} height={18} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const { t } = useI18n();
  const { user, bootstrapping, register } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    role: 'supervisor', // Default to supervisor
    industry: INDUSTRY_VALUES[0],
    position: '',
    phone: '',
    logo: null,
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const ind = params.get('industry');
    if (ind) {
      const match = INDUSTRY_VALUES.find(v => INDUSTRY_LABEL_KEY[v] === ind);
      if (match) {
        setForm(prev => ({ ...prev, industry: match }));
      }
    }
  }, [search]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(null);

  if (bootstrapping) return <p className={auth.wait}>{t('auth.checking')}</p>;
  if (user && !pendingNotice) return <Navigate to={`/app/${user.role}/dashboard`} replace />;

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
      const result = await register({
        companyName: form.companyName,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        password: form.password,
        role: form.role,
        industry: form.industry,
        position: form.position,
        phone: form.phone,
        logo: form.logo,
        location: form.role === 'supplier' ? 'Rwanda' : '', // Default location for suppliers
      });
      if (result?.pendingApproval) {
        setPendingNotice(result.message || 'Your registration is pending approval.');
        return;
      }
      navigate(`/app/${result.role}/dashboard`, { replace: true });
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
      {pendingNotice ? (
        <div className={auth.success} role="status">
          <strong>{t('auth.registrationSubmitted')}</strong>
          <p className={auth.subtitle}>{pendingNotice}</p>
          <p className={auth.subtitle}>{t('auth.signInAfterApproval')}</p>
          <p className={rp.footerRegister}>
            <Link to="/login">{t('auth.backLogin')}</Link>
          </p>
        </div>
      ) : null}
      {!pendingNotice && error ? (
        <p className={auth.error} role="alert">
          {error}
        </p>
      ) : null}
      {!pendingNotice ? (
        <>
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

          <div className={`${rp.field} ${rp.fieldWide}`}>
            <label className={rp.labelCaps} htmlFor="role">
              Account Type
            </label>
            <div className={rp.roleSelection}>
              <div className={rp.roleOption}>
                <input
                  type="radio"
                  id="role-supervisor"
                  name="role"
                  value="supervisor"
                  checked={form.role === 'supervisor'}
                  onChange={(event) => updateField('role', event.target.value)}
                />
                <label htmlFor="role-supervisor" className={rp.roleLabel}>
                  <div className={rp.roleIcon}>
                    <IconBuilding />
                  </div>
                  <div className={rp.roleContent}>
                    <div className={rp.roleTitle}>Supervisor</div>
                    <div className={rp.roleDescription}>Healthcare facility or organization</div>
                  </div>
                </label>
              </div>
              <div className={rp.roleOption}>
                <input
                  type="radio"
                  id="role-supplier"
                  name="role"
                  value="supplier"
                  checked={form.role === 'supplier'}
                  onChange={(event) => updateField('role', event.target.value)}
                />
                <label htmlFor="role-supplier" className={rp.roleLabel}>
                  <div className={rp.roleIcon}>
                    <IconBriefcase />
                  </div>
                  <div className={rp.roleContent}>
                    <div className={rp.roleTitle}>Supplier</div>
                    <div className={rp.roleDescription}>Independent supplier or vendor</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className={`${rp.field} ${rp.fieldWide}`}>
            <label className={rp.labelCaps} htmlFor="companyLogo">
              Company Logo
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconImage />
              </span>
              <input
                id="companyLogo"
                className={rp.inputField}
                type="file"
                accept="image/*"
                onChange={(event) => updateField('logo', event.target.files[0])}
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
                required
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
              {t('auth.emailOrPhone') || 'Email or Phone Number'}
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconMail />
              </span>
              <input
                id="email"
                className={rp.inputField}
                type="text"
                autoComplete="username"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder={t('auth.phEmailOrPhone') || 'name@company.com or +250...'}
                required
              />
            </div>
          </div>

          <div className={rp.field}>
            <label className={rp.labelCaps} htmlFor="position">
              {t('auth.positionLabel')}
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconBriefcase />
              </span>
              <input
                id="position"
                className={rp.inputField}
                type="text"
                value={form.position}
                onChange={(event) => updateField('position', event.target.value)}
                placeholder={t('auth.phPosition')}
                required
              />
            </div>
          </div>

          <div className={rp.field}>
            <label className={rp.labelCaps} htmlFor="phone">
              {t('auth.phoneLabel')}
            </label>
            <div className={rp.inputRow}>
              <span className={rp.inputIcon}>
                <IconPhone />
              </span>
              <input
                id="phone"
                className={rp.inputField}
                type="tel"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="+250..."
                required
              />
            </div>
          </div>
        </div>

        <div className={rp.passwordGrid}>
          <label className={rp.field}>
            <span className={rp.labelCaps}>{t('auth.password')}</span>
            <div className={rp.passwordWrap}>
              <input
                className={`${rp.passwordInput} ${rp.passwordInputWithToggle}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder={t('auth.phPwd')}
                required
              />
              <button
                type="button"
                className={rp.togglePw}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                <PasswordEyeIcon open={showPassword} size={18} className={rp.eyeSvg} />
              </button>
            </div>
          </label>
          <label className={rp.field}>
            <span className={rp.labelCaps}>{t('auth.confirmPassword')}</span>
            <div className={rp.passwordWrap}>
              <input
                className={`${rp.passwordInput} ${rp.passwordInputWithToggle}`}
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                placeholder={t('auth.phRepeat')}
                required
              />
              <button
                type="button"
                className={rp.togglePw}
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                <PasswordEyeIcon open={showConfirmPassword} size={18} className={rp.eyeSvg} />
              </button>
            </div>
          </label>
        </div>

        <label className={auth.checkboxRow}>
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
          <span style={{ fontSize: '0.9rem' }}>
            {t('auth.agreeTerms').replace('Terms & Regulations', '')}
            <Link to="/terms" style={{ color: 'var(--ec-primary)', fontWeight: 700, textDecoration: 'underline' }}>
              Terms & Regulations
            </Link>
          </span>
        </label>

        <button type="submit" className={auth.btnPrimary} disabled={loading}>
          {loading ? t('auth.creating') : t('auth.createWorkspace')}
        </button>
      </form>
      <Link to="/login" className={`${auth.footerNavBox} ${auth.footerNavBoxFull}`}>
        {t('auth.haveAccount')} {t('auth.signInLink')}
      </Link>
      <p className={rp.footerRegister}>
        <Link to="/terms">{t('shell.termsAndConditions')}</Link>
        {' · '}
        <Link to="/privacy">{t('shell.privacyPolicy')}</Link>
      </p>
      <div className={auth.footerNavGrid}>
        <Link to="/contact" className={auth.footerNavBox}>{t('shell.helpCenter')}</Link>
        <Link to="/" className={auth.footerNavBox}>{t('shell.backHome')}</Link>
      </div>
        </>
      ) : null}
    </>
  );
}
