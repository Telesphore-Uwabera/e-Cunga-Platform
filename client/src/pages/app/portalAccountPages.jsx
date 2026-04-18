import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import { ROLE_LABELS } from '../../constants/rbac.js';
import { apiUploadMedia } from '../../api/client.js';
import { PageIntro, formatDateTime } from './roleUi.jsx';
import ui from './DashboardUi.module.css';

const TIMEZONE_OPTIONS = [
  { value: 'Africa/Kigali', label: 'Rwanda (CAT)' },
  { value: 'Africa/Nairobi', label: 'Kenya / Tanzania (EAT)' },
  { value: 'Africa/Lagos', label: 'West Africa (WAT)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST)' },
  { value: 'Europe/London', label: 'United Kingdom' },
  { value: 'Europe/Paris', label: 'Central Europe' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'UTC', label: 'UTC' },
];

function severityLabel(sev, t) {
  const s = String(sev || '').toLowerCase();
  if (s === 'ok') return t('accountPages.severityOk');
  if (s === 'warn') return t('accountPages.severityWarn');
  if (s === 'bad') return t('accountPages.severityBad');
  return t('accountPages.severityNeutral');
}

function severityBadgeClass(sev) {
  const s = String(sev || '').toLowerCase();
  if (s === 'ok') return ui.badgeOk;
  if (s === 'warn') return ui.badgeWarn;
  if (s === 'bad') return ui.badgeBad;
  return ui.badgeNeutral;
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={checked ? ui.adminSettingsToggleActive : ui.adminSettingsToggle}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function PortalMyProfile() {
  const { user, updateProfile } = useAuth();
  const { state } = usePortalData();
  const { t } = useI18n();
  const companyName = state?.company?.name || '—';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [team, setTeam] = useState('');
  const [location, setLocation] = useState('');
  const [timeZone, setTimeZone] = useState('Africa/Kigali');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setPhone(user.phone || '');
    setJobTitle(user.jobTitle || '');
    setTeam(user.team || '');
    setLocation(user.location || '');
    setTimeZone(user.timeZone || 'Africa/Kigali');
    setLogoUrl(user.logoUrl || '');
  }, [user]);

  async function handleLogoUpload(file) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const resp = await apiUploadMedia(file);
      setLogoUrl(resp.secure_url);
    } catch (e) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploadingLogo(false);
    }
  }

  const memberSince = user?.createdAt ? formatDateTime(user.createdAt) : '—';

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);
      setMessage(null);
      setSaving(true);
      try {
        await updateProfile({
          fullName: fullName.trim(),
          phone: phone.trim(),
          jobTitle: jobTitle.trim(),
          team: team.trim(),
          location: location.trim(),
          timeZone: timeZone.trim() || 'Africa/Kigali',
          logoUrl: logoUrl,
        });
        setMessage(t('accountPages.profileSaved'));
      } catch (err) {
        setError(err?.body?.error || err?.message || t('accountPages.profileSaveError'));
      } finally {
        setSaving(false);
      }
    },
    [fullName, phone, jobTitle, team, location, timeZone, updateProfile, t]
  );

  return (
    <>
      <PageIntro
        eyebrow={t('accountPages.profileEyebrow')}
        title={t('accountPages.profileTitle')}
        description={t('accountPages.profileLead')}
      />
      <form onSubmit={onSubmit} className={ui.adminSettingsCard}>
        <div className={ui.adminSettingsSectionHead} style={{ marginBottom: '0.5rem' }}>
          <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.workspaceUser')}</h2>
        </div>
        <div className={ui.adminSettingsLogoBlock} style={{ marginBottom: '1.5rem' }}>
          <div className={ui.adminSettingsLogoTile} style={{ borderRadius: '50%' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Avatar" className={ui.adminSettingsLogoImg} style={{ borderRadius: '50%' }} />
            ) : (
              (fullName || user?.email || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className={ui.adminSettingsUploadTitle}>{uploadingLogo ? 'Uploading…' : 'Profile Photo'}</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleLogoUpload(e.target.files[0])}
              disabled={uploadingLogo}
              style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}
            />
            <p className={ui.adminSettingsUploadMeta}>Recommended: 200x200, PNG or JPG.</p>
          </div>
        </div>
        <div className={ui.portalProfileFormStack}>
          <div className={ui.portalProfileRowFull}>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.emailLabel')}</span>
              <input className={ui.adminSettingsInput} value={user?.email || ''} readOnly disabled />
              <small>{t('accountPages.emailReadOnlyHint')}</small>
            </label>
          </div>
          <div className={ui.portalProfilePair}>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.roleLabel')}</span>
              <input
                className={ui.adminSettingsInput}
                value={ROLE_LABELS[user?.role] || user?.role || ''}
                readOnly
                disabled
              />
            </label>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.companyLabel')}</span>
              <input className={ui.adminSettingsInput} value={companyName} readOnly disabled />
            </label>
          </div>
          <div className={ui.portalProfilePair}>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.industryLabel')}</span>
              <input className={ui.adminSettingsInput} value={user?.industry || '—'} readOnly disabled />
            </label>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.memberSinceLabel')}</span>
              <input className={ui.adminSettingsInput} value={memberSince} readOnly disabled />
            </label>
          </div>
          <div className={ui.portalProfilePair}>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.fullNameLabel')}</span>
              <input
                className={ui.adminSettingsInput}
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.jobTitleLabel')}</span>
              <input
                className={ui.adminSettingsInput}
                value={jobTitle}
                onChange={(ev) => setJobTitle(ev.target.value)}
                autoComplete="organization-title"
              />
            </label>
          </div>
          <div className={ui.portalProfilePair}>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.phoneLabel')}</span>
              <input
                className={ui.adminSettingsInput}
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </label>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.teamLabel')}</span>
              <input className={ui.adminSettingsInput} value={team} onChange={(ev) => setTeam(ev.target.value)} />
            </label>
          </div>
          <div className={ui.portalProfilePair}>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.locationLabel')}</span>
              <input
                className={ui.adminSettingsInput}
                value={location}
                onChange={(ev) => setLocation(ev.target.value)}
                autoComplete="address-level2"
              />
            </label>
            <label className={ui.adminSettingsField}>
              <span>{t('accountPages.timeZoneLabel')}</span>
              <select
                className={ui.adminSettingsSelect}
                value={timeZone}
                onChange={(ev) => setTimeZone(ev.target.value)}
              >
                {timeZone && !TIMEZONE_OPTIONS.some((z) => z.value === timeZone) ? (
                  <option value={timeZone}>{timeZone}</option>
                ) : null}
                {TIMEZONE_OPTIONS.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {error ? (
          <p className={ui.adminSettingsProfileMeta} style={{ color: 'var(--ec-danger, #b42318)', marginTop: '0.75rem' }}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p className={ui.adminSettingsProfileMeta} style={{ color: 'var(--ec-ok, #3f6212)', marginTop: '0.75rem' }}>
            {message}
          </p>
        ) : null}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="submit" className={ui.adminSettingsPrimaryBtn} disabled={saving}>
            {saving ? t('accountPages.saving') : t('accountPages.saveProfile')}
          </button>
        </div>
      </form>
    </>
  );
}

export function PortalAccountSettings() {
  const { role } = useParams();
  const { t } = useI18n();
  const { user, updateProfile, changePassword } = useAuth();
  const hasOrgSettings = role === 'admin';
  const hasPortalSettings = role === 'supplier';

  const [digest, setDigest] = useState(true);
  const [security, setSecurity] = useState(true);
  const [product, setProduct] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState(null);
  const [prefsErr, setPrefsErr] = useState(null);

  const [currentPw, setCurrentPw] = useState('');
  const [nextPw, setNextPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

  useEffect(() => {
    if (!user) return;
    setDigest(user.notifyEmailDigest !== false);
    setSecurity(user.notifySecurityAlerts !== false);
    setProduct(Boolean(user.notifyProductUpdates));
  }, [user]);

  const savePrefs = useCallback(async () => {
    setPrefsErr(null);
    setPrefsMsg(null);
    setPrefsSaving(true);
    try {
      await updateProfile({
        notifyEmailDigest: digest,
        notifySecurityAlerts: security,
        notifyProductUpdates: product,
      });
      setPrefsMsg(t('accountPages.prefsSaved'));
    } catch (err) {
      setPrefsErr(err?.body?.error || err?.message || t('accountPages.prefsSaveError'));
    } finally {
      setPrefsSaving(false);
    }
  }, [digest, security, product, updateProfile, t]);

  const submitPassword = useCallback(
    async (e) => {
      e.preventDefault();
      setPwErr(null);
      setPwMsg(null);
      if (nextPw !== confirmPw) {
        setPwErr(t('accountPages.passwordMismatch'));
        return;
      }
      setPwSaving(true);
      try {
        await changePassword({ currentPassword: currentPw, newPassword: nextPw });
        setPwMsg(t('accountPages.passwordChanged'));
        setCurrentPw('');
        setNextPw('');
        setConfirmPw('');
      } catch (err) {
        setPwErr(err?.body?.error || err?.message || t('accountPages.passwordChangeError'));
      } finally {
        setPwSaving(false);
      }
    },
    [currentPw, nextPw, confirmPw, changePassword, t]
  );

  const checklist = useMemo(
    () => [t('accountPages.securityTip1'), t('accountPages.securityTip2'), t('accountPages.securityTip3')],
    [t]
  );

  return (
    <>
      <PageIntro
        eyebrow={t('accountPages.settingsEyebrow')}
        title={t('accountPages.settingsTitle')}
        description={t('accountPages.settingsLead')}
      />
      <div className={ui.adminSettingsGrid}>
        <div className={ui.adminSettingsMain}>
          <div className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.appearanceTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.themeHint')}</p>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.languageHint')}</p>
          </div>

          <div className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.notificationPrefsTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.notificationPrefsLead')}</p>
            <div className={ui.adminSettingsToggleRow} style={{ marginTop: '0.85rem' }}>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('accountPages.notifyDigestLabel')}</p>
                <p className={ui.adminSettingsProfileMeta}>{t('accountPages.notifyDigestHelp')}</p>
              </div>
              <Toggle checked={digest} onChange={setDigest} disabled={prefsSaving} />
            </div>
            <div className={ui.adminSettingsToggleRow}>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('accountPages.notifySecurityLabel')}</p>
                <p className={ui.adminSettingsProfileMeta}>{t('accountPages.notifySecurityHelp')}</p>
              </div>
              <Toggle checked={security} onChange={setSecurity} disabled={prefsSaving} />
            </div>
            <div className={ui.adminSettingsToggleRow}>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('accountPages.notifyProductLabel')}</p>
                <p className={ui.adminSettingsProfileMeta}>{t('accountPages.notifyProductHelp')}</p>
              </div>
              <Toggle checked={product} onChange={setProduct} disabled={prefsSaving} />
            </div>
            {prefsErr ? (
              <p className={ui.adminSettingsProfileMeta} style={{ color: 'var(--ec-danger, #b42318)', marginTop: '0.5rem' }}>
                {prefsErr}
              </p>
            ) : null}
            {prefsMsg ? (
              <p className={ui.adminSettingsProfileMeta} style={{ color: 'var(--ec-ok, #3f6212)', marginTop: '0.5rem' }}>
                {prefsMsg}
              </p>
            ) : null}
            <button
              type="button"
              className={ui.adminSettingsPrimaryBtn}
              style={{ marginTop: '0.85rem' }}
              disabled={prefsSaving}
              onClick={savePrefs}
            >
              {prefsSaving ? t('accountPages.saving') : t('accountPages.saveNotificationPrefs')}
            </button>
          </div>

          <form className={ui.adminSettingsCard} onSubmit={submitPassword}>
            <h2 className={ui.adminSettingsSecurityTitle}>{t('accountPages.changePasswordCardTitle')}</h2>
            <p className={ui.adminSettingsSecurityMeta}>{t('accountPages.changePasswordCardLead')}</p>
            <div className={ui.adminSettingsFormGrid} style={{ marginTop: '0.75rem' }}>
              <label className={`${ui.adminSettingsField} ${ui.adminSettingsFieldWide}`}>
                <span>{t('accountPages.currentPasswordLabel')}</span>
                <input
                  className={ui.adminSettingsInput}
                  type="password"
                  value={currentPw}
                  onChange={(ev) => setCurrentPw(ev.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className={ui.adminSettingsField}>
                <span>{t('accountPages.newPasswordLabel')}</span>
                <input
                  className={ui.adminSettingsInput}
                  type="password"
                  value={nextPw}
                  onChange={(ev) => setNextPw(ev.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </label>
              <label className={ui.adminSettingsField}>
                <span>{t('accountPages.confirmPasswordLabel')}</span>
                <input
                  className={ui.adminSettingsInput}
                  type="password"
                  value={confirmPw}
                  onChange={(ev) => setConfirmPw(ev.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </label>
            </div>
            {pwErr ? (
              <p className={ui.adminSettingsProfileMeta} style={{ color: 'var(--ec-danger, #b42318)', marginTop: '0.5rem' }}>
                {pwErr}
              </p>
            ) : null}
            {pwMsg ? (
              <p className={ui.adminSettingsProfileMeta} style={{ color: 'var(--ec-ok, #3f6212)', marginTop: '0.5rem' }}>
                {pwMsg}
              </p>
            ) : null}
            <div style={{ marginTop: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
              <button type="submit" className={ui.adminSettingsPrimaryBtn} disabled={pwSaving}>
                {pwSaving ? t('accountPages.changingPassword') : t('accountPages.changePasswordBtn')}
              </button>
              <Link to="/forgot-password" className={ui.adminSettingsGhostBtn} style={{ textDecoration: 'none' }}>
                {t('accountPages.resetPasswordLink')}
              </Link>
            </div>
          </form>

          <div className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.dangerZoneTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.dangerZoneLead')}</p>
          </div>

          {hasOrgSettings ? (
            <div className={ui.adminSettingsCard}>
              <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.orgSettingsCta')}</h2>
              <p className={ui.adminSettingsProfileMeta}>{t('accountPages.orgSettingsHint')}</p>
              <Link
                to={`/app/${role}/settings`}
                className={ui.adminSettingsEnforceBtn}
                style={{ display: 'inline-block', marginTop: '0.75rem', textAlign: 'center', textDecoration: 'none' }}
              >
                {t('accountPages.orgSettingsCta')}
              </Link>
            </div>
          ) : null}
          {hasPortalSettings ? (
            <div className={ui.adminSettingsCard}>
              <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.portalSettingsCta')}</h2>
              <p className={ui.adminSettingsProfileMeta}>{t('accountPages.portalSettingsHint')}</p>
              <Link
                to={`/app/${role}/settings`}
                className={ui.adminSettingsEnforceBtn}
                style={{ display: 'inline-block', marginTop: '0.75rem', textAlign: 'center', textDecoration: 'none' }}
              >
                {t('accountPages.portalSettingsCta')}
              </Link>
            </div>
          ) : null}
        </div>

        <aside className={ui.adminSettingsRail}>
          <div className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.accountSecuritySection')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.accountSecurityLead')}</p>
          </div>
          <div className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.sessionTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.sessionBody')}</p>
          </div>
          <div className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.securityChecklistTitle')}</h2>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: 'var(--ec-muted)', fontSize: '0.78rem', lineHeight: 1.55 }}>
              {checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.mfaTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.mfaBody')}</p>
          </div>
        </aside>
      </div>
    </>
  );
}

export function PortalNotificationsCenter() {
  const { role } = useParams();
  const { state } = usePortalData();
  const { t } = useI18n();
  const list = [...notificationsForRole(state, role)].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  return (
    <>
      <PageIntro
        eyebrow={t('accountPages.notificationsEyebrow')}
        title={t('accountPages.notificationsTitle')}
        description={t('accountPages.notificationsLead')}
      />
      {list.length === 0 ? (
        <div className={ui.adminSettingsCard}>
          <p className={ui.adminSettingsProfileMeta}>{t('accountPages.emptyNotifications')}</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
          {list.map((n) => (
            <li key={n.id} className={ui.adminSettingsCard}>
              <div className={ui.adminSettingsSectionHead}>
                <h2 className={ui.adminSettingsSectionTitle}>{n.title}</h2>
                <span className={`${ui.badge} ${severityBadgeClass(n.severity)}`}>{severityLabel(n.severity, t)}</span>
              </div>
              <p className={ui.adminSettingsProfileMeta}>{n.body}</p>
              <p className={ui.adminSettingsHealthMeta}>{formatDateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
