import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useMatch, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { notificationsForRole, usePortalData } from '../../context/PortalStateContext.jsx';
import { ROLE_LABELS } from '../../constants/rbac.js';
import { apiUploadMedia } from '../../api/client.js';
import { PageIntro, formatDateTime } from './roleUi.jsx';
import { cleanRemoteLogoUrl, resolveWorkspaceAvatarUrl } from '../../utils/workspaceBranding.js';
import ui from './DashboardUi.module.css';
import PasswordEyeIcon from '../../components/PasswordEyeIcon.jsx';

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

export function Toggle({ checked, onChange, disabled }) {
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

/** Shared password change card (company settings, supplier settings, account settings). */
export function PortalPasswordChangeForm() {
  const { t } = useI18n();
  const { showFlash } = useFlash();
  const { changePassword } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [nextPw, setNextPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

  const submitPassword = useCallback(
    async (e) => {
      e.preventDefault();
      setPwErr(null);
      setPwMsg(null);
      if (nextPw !== confirmPw) {
        const msg = t('accountPages.passwordMismatch');
        setPwErr(msg);
        showFlash(msg, 'warn');
        return;
      }
      setPwSaving(true);
      showFlash(t('accountPages.changingPassword'), 'loading');
      try {
        await changePassword({ currentPassword: currentPw, newPassword: nextPw });
        const okMsg = t('accountPages.passwordChanged');
        setPwMsg(okMsg);
        showFlash(okMsg, 'ok');
        setCurrentPw('');
        setNextPw('');
        setConfirmPw('');
        setShowCurrentPw(false);
        setShowNewPw(false);
        setShowConfirmPw(false);
      } catch (err) {
        const errMsg = err?.body?.error || err?.message || t('accountPages.passwordChangeError');
        setPwErr(errMsg);
        showFlash(errMsg, 'error');
      } finally {
        setPwSaving(false);
      }
    },
    [currentPw, nextPw, confirmPw, changePassword, t, showFlash]
  );

  return (
    <form className={ui.adminSettingsCard} onSubmit={submitPassword}>
      <h2 className={ui.adminSettingsSecurityTitle}>{t('accountPages.changePasswordCardTitle')}</h2>
      <p className={ui.adminSettingsSecurityMeta}>{t('accountPages.changePasswordCardLead')}</p>
      <div className={ui.adminSettingsFormGrid} style={{ marginTop: '0.75rem' }}>
        <label className={`${ui.adminSettingsField} ${ui.adminSettingsFieldWide}`}>
          <span>{t('accountPages.currentPasswordLabel')}</span>
          <div className={ui.adminSettingsPasswordWrap}>
            <input
              className={`${ui.adminSettingsInput} ${ui.adminSettingsInputWithToggle}`}
              type={showCurrentPw ? 'text' : 'password'}
              value={currentPw}
              onChange={(ev) => setCurrentPw(ev.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={ui.adminSettingsTogglePw}
              onClick={() => setShowCurrentPw((v) => !v)}
              aria-label={showCurrentPw ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <PasswordEyeIcon open={showCurrentPw} size={18} className={ui.adminSettingsEyeSvg} />
            </button>
          </div>
        </label>
        <label className={ui.adminSettingsField}>
          <span>{t('accountPages.newPasswordLabel')}</span>
          <div className={ui.adminSettingsPasswordWrap}>
            <input
              className={`${ui.adminSettingsInput} ${ui.adminSettingsInputWithToggle}`}
              type={showNewPw ? 'text' : 'password'}
              value={nextPw}
              onChange={(ev) => setNextPw(ev.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
            <button
              type="button"
              className={ui.adminSettingsTogglePw}
              onClick={() => setShowNewPw((v) => !v)}
              aria-label={showNewPw ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <PasswordEyeIcon open={showNewPw} size={18} className={ui.adminSettingsEyeSvg} />
            </button>
          </div>
        </label>
        <label className={ui.adminSettingsField}>
          <span>{t('accountPages.confirmPasswordLabel')}</span>
          <div className={ui.adminSettingsPasswordWrap}>
            <input
              className={`${ui.adminSettingsInput} ${ui.adminSettingsInputWithToggle}`}
              type={showConfirmPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={(ev) => setConfirmPw(ev.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
            <button
              type="button"
              className={ui.adminSettingsTogglePw}
              onClick={() => setShowConfirmPw((v) => !v)}
              aria-label={showConfirmPw ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <PasswordEyeIcon open={showConfirmPw} size={18} className={ui.adminSettingsEyeSvg} />
            </button>
          </div>
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
  );
}

/** Email / security / product notification toggles + save. */
export function PortalNotificationPrefsCard() {
  const { t } = useI18n();
  const { showFlash } = useFlash();
  const { user, updateProfile } = useAuth();
  const { refreshPortalState } = usePortalData();
  const [digest, setDigest] = useState(true);
  const [security, setSecurity] = useState(true);
  const [product, setProduct] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState(null);
  const [prefsErr, setPrefsErr] = useState(null);

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
    showFlash(t('accountPages.saving'), 'loading');
    try {
      await updateProfile({
        notifyEmailDigest: digest,
        notifySecurityAlerts: security,
        notifyProductUpdates: product,
      });
      await refreshPortalState();
      const okMsg = t('accountPages.prefsSaved');
      setPrefsMsg(okMsg);
      showFlash(okMsg, 'ok');
    } catch (err) {
      const errMsg = err?.body?.error || err?.message || t('accountPages.prefsSaveError');
      setPrefsErr(errMsg);
      showFlash(errMsg, 'error');
    } finally {
      setPrefsSaving(false);
    }
  }, [digest, security, product, updateProfile, refreshPortalState, t, showFlash]);

  return (
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
        {prefsSaving ? t('accountPages.saving') : t('accountPages.saveChanges')}
      </button>
    </div>
  );
}

function usePortalActor(state, user) {
  return useMemo(
    () => state.users?.find((entry) => entry.email === user?.email) ?? null,
    [state.users, user?.email]
  );
}

/** Clerk, accountant, supervisor — profile, org context, notifications, password (sidebar Settings / My account / account-settings). */
export function PortalStaffSettings() {
  const { role } = useParams();
  const { t } = useI18n();
  const { showFlash, FlashBanner } = useFlash();
  const { user, updateProfile } = useAuth();
  const { state, refreshPortalState } = usePortalData();
  const actor = usePortalActor(state, user);
  const accountVariant = Boolean(useMatch('/app/:role/account-settings'));
  const base = `/app/${role}`;
  const company = state.company;

  const [name, setName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setName(String(actor?.fullName || user?.fullName || '').trim());
  }, [actor?.fullName, user?.fullName]);

  const initials = (name || user?.email || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const checklist = useMemo(
    () => [t('accountPages.securityTip1'), t('accountPages.securityTip2'), t('accountPages.securityTip3')],
    [t]
  );

  const staffAvatarDisplayUrl = useMemo(
    () => resolveWorkspaceAvatarUrl(company, user),
    [company?.logoUrl, user?.logoUrl]
  );

  async function saveProfile() {
    setSavingProfile(true);
    showFlash(t('accountPages.saving'), 'loading');
    try {
      await updateProfile({ fullName: name.trim() });
      await refreshPortalState();
      showFlash(t('accountPages.profileSaved'), 'ok');
    } catch (e) {
      showFlash(e?.body?.error || e?.message || t('accountPages.profileSaveError'), 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className={ui.adminSettingsBoard}>
      <FlashBanner />
      {accountVariant ? (
        <>
          <PageIntro
            eyebrow={t('accountPages.settingsEyebrow')}
            title={t('accountPages.settingsTitle')}
            description={t('accountPages.settingsLead')}
          />
          <div className={ui.adminSettingsTop} style={{ marginTop: '0.5rem' }}>
            <div />
            <div className={ui.adminSettingsActions}>
              <Link to={`${base}/profile`} className={ui.adminSettingsGhostBtn} style={{ textDecoration: 'none' }}>
                {t('shell.myProfile')}
              </Link>
              <Link to={`${base}/notifications`} className={ui.adminSettingsGhostBtn} style={{ textDecoration: 'none' }}>
                {t('accountPages.notificationsTitle')}
              </Link>
              <button type="button" className={ui.adminSettingsPrimaryBtn} disabled={savingProfile} onClick={saveProfile}>
                {savingProfile ? t('accountPages.saving') : t('accountPages.saveChanges')}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className={ui.adminSettingsTop}>
          <div>
            <h1 className={ui.adminSettingsTitle}>{t('accountPages.workspacePageTitle')}</h1>
            <p className={ui.adminSettingsLead}>{t('accountPages.workspacePageLead')}</p>
          </div>
          <div className={ui.adminSettingsActions}>
            <Link to={`${base}/profile`} className={ui.adminSettingsGhostBtn} style={{ textDecoration: 'none' }}>
              {t('shell.myProfile')}
            </Link>
            <Link to={`${base}/notifications`} className={ui.adminSettingsGhostBtn} style={{ textDecoration: 'none' }}>
              {t('accountPages.notificationsTitle')}
            </Link>
            <button type="button" className={ui.adminSettingsPrimaryBtn} disabled={savingProfile} onClick={saveProfile}>
              {savingProfile ? t('accountPages.saving') : t('accountPages.saveChanges')}
            </button>
          </div>
        </div>
      )}

      <div className={ui.adminSettingsGrid}>
        <div className={ui.adminSettingsMain}>
          {accountVariant ? (
            <div className={ui.adminSettingsCard}>
              <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.appearanceTitle')}</h2>
              <p className={ui.adminSettingsProfileMeta}>{t('accountPages.themeHint')}</p>
              <p className={ui.adminSettingsProfileMeta}>{t('accountPages.languageHint')}</p>
            </div>
          ) : null}

          <div className={ui.adminSettingsCards2Col}>
          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.workspaceProfileSection')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.workspaceProfileLead')}</p>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.emailReadOnlyHint')}</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.85rem', alignItems: 'flex-start' }}>
              <span
                className={ui.adminSettingsLogoTile}
                aria-hidden
                style={staffAvatarDisplayUrl ? { borderRadius: '50%', overflow: 'hidden' } : undefined}
              >
                {staffAvatarDisplayUrl ? (
                  <img
                    src={staffAvatarDisplayUrl}
                    alt=""
                    className={ui.adminSettingsLogoImg}
                    style={{ borderRadius: '50%', width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  initials
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label className={`${ui.adminSettingsField} ${ui.adminSettingsFieldWide}`}>
                  <span>{t('accountPages.fullNameLabel')}</span>
                  <input className={ui.adminSettingsInput} value={name} onChange={(ev) => setName(ev.target.value)} />
                </label>
                <p className={ui.adminSettingsProfileMeta}>
                  {t('accountPages.emailLabel')}: {user?.email || '—'}
                </p>
                <p className={ui.adminSettingsProfileMeta}>
                  {t('accountPages.roleLabel')}: {t(`roles.${role}`)}
                </p>
                {actor?.team ? (
                  <p className={ui.adminSettingsProfileMeta}>
                    {t('accountPages.teamLabel')}: {actor.team}
                  </p>
                ) : null}
                {actor?.location ? (
                  <p className={ui.adminSettingsProfileMeta}>
                    {t('accountPages.locationLabel')}: {actor.location}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.workspaceOrgSection')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.workspaceOrgLead')}</p>
            <div className={ui.adminSettingsPreferenceGrid} style={{ marginTop: '0.85rem' }}>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('accountPages.companyLabel')}</p>
                <p className={ui.adminSettingsProfileMeta}>{company?.name || '—'}</p>
              </div>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('app.supplier.settingsTenantCurrency')}</p>
                <p className={ui.adminSettingsProfileMeta}>{company?.currency || '—'}</p>
              </div>
              <div>
                <p className={ui.adminSettingsThresholdTitle}>{t('app.supplier.settingsTenantLanguage')}</p>
                <p className={ui.adminSettingsProfileMeta}>{company?.language || '—'}</p>
              </div>
            </div>
            {role === 'supervisor' ? (
              <div style={{ marginTop: '1rem' }}>
                <p className={ui.adminSettingsProfileMeta}>{t('accountPages.workspaceCompanySettingsHint')}</p>
                <Link
                  to={`${base}/settings`}
                  className={ui.adminSettingsEnforceBtn}
                  style={{ display: 'inline-block', marginTop: '0.65rem', textAlign: 'center', textDecoration: 'none' }}
                >
                  {t('accountPages.workspaceCompanySettingsCta')}
                </Link>
              </div>
            ) : null}
          </section>
          </div>

          <div className={ui.adminSettingsCards2Col}>
            <PortalNotificationPrefsCard />
            <PortalPasswordChangeForm />
          </div>

          {accountVariant ? (
            <div className={ui.adminSettingsCard}>
              <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.dangerZoneTitle')}</h2>
              <p className={ui.adminSettingsProfileMeta}>{t('accountPages.dangerZoneLead')}</p>
              <Link to="/forgot-password" className={ui.adminSettingsGhostBtn} style={{ display: 'inline-block', marginTop: '0.75rem', textDecoration: 'none' }}>
                {t('accountPages.resetPasswordLink')}
              </Link>
            </div>
          ) : null}
        </div>

        <aside className={ui.adminSettingsRail}>
          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.sessionTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.sessionBody')}</p>
          </section>
          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.securityChecklistTitle')}</h2>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: 'var(--ec-muted)', fontSize: '0.78rem', lineHeight: 1.55 }}>
              {checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          <section className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.mfaTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.mfaBody')}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function PortalMyProfile() {
  const { user, updateProfile } = useAuth();
  const { state, refreshPortalState } = usePortalData();
  const { t } = useI18n();
  const { showFlash } = useFlash();
  const companyName = state?.company?.name || '—';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [team, setTeam] = useState('');
  const [location, setLocation] = useState('');
  const [timeZone, setTimeZone] = useState('Africa/Kigali');
  const [logoUrl, setLogoUrl] = useState('');
  const [profilePhotoBroken, setProfilePhotoBroken] = useState(false);
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

  useEffect(() => {
    setProfilePhotoBroken(false);
  }, [logoUrl]);

  /** Personal photo only here; org logo still wins in AppShell (see profilePhotoOrgTakesPriority). */
  const profileAvatarDisplayUrl = useMemo(() => cleanRemoteLogoUrl(logoUrl), [logoUrl]);

  async function handleLogoUpload(file) {
    if (!file) return;
    setUploadingLogo(true);
    showFlash(t('accountPages.profilePhotoUploading'), 'loading');
    try {
      const resp = await apiUploadMedia(file);
      const url = String(resp?.secure_url || resp?.url || '').trim();
      if (!url) throw new Error('Upload did not return an image URL.');
      setLogoUrl(url);
      showFlash(t('accountPages.profilePhotoUploaded'), 'ok');
    } catch (e) {
      const errMsg = e?.message ? `${t('accountPages.profilePhotoError')} ${e.message}` : t('accountPages.profilePhotoError');
      showFlash(errMsg, 'error');
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
      showFlash(t('accountPages.saving'), 'loading');
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
        await refreshPortalState();
        const okMsg = t('accountPages.profileSaved');
        setMessage(okMsg);
        showFlash(okMsg, 'ok');
      } catch (err) {
        const errMsg = err?.body?.error || err?.message || t('accountPages.profileSaveError');
        setError(errMsg);
        showFlash(errMsg, 'error');
      } finally {
        setSaving(false);
      }
    },
    [fullName, phone, jobTitle, team, location, timeZone, logoUrl, updateProfile, refreshPortalState, t, showFlash]
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
          <div className={ui.adminSettingsLogoTile} style={{ borderRadius: '50%', overflow: 'hidden' }}>
            {profileAvatarDisplayUrl && !profilePhotoBroken ? (
              <img
                src={profileAvatarDisplayUrl}
                alt=""
                className={ui.adminSettingsLogoImg}
                style={{ borderRadius: '50%', width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setProfilePhotoBroken(true)}
              />
            ) : (
              (fullName || user?.email || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className={ui.adminSettingsUploadTitle}>
              {uploadingLogo ? t('accountPages.profilePhotoUploading') : t('accountPages.profilePhotoTitle')}
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleLogoUpload(e.target.files[0])}
              disabled={uploadingLogo}
              style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}
            />
            <p className={ui.adminSettingsUploadMeta}>{t('accountPages.profilePhotoMeta')}</p>
            {state.company?.logoUrl ? (
              <p className={ui.adminSettingsUploadMeta}>{t('accountPages.profilePhotoOrgTakesPriority')}</p>
            ) : null}
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
            {saving ? t('accountPages.saving') : t('accountPages.saveChanges')}
          </button>
        </div>
      </form>
    </>
  );
}

export function PortalAccountSettings() {
  const { role } = useParams();
  const { t } = useI18n();

  if (role === 'clerk' || role === 'accountant' || role === 'supervisor') {
    return <PortalStaffSettings />;
  }

  const hasOrgSettings = role === 'admin';
  const hasPortalSettings = role === 'supplier';

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
      <p className={ui.adminSettingsProfileMeta} style={{ marginTop: '-0.25rem', marginBottom: '0.75rem', maxWidth: '44rem' }}>
        {t('accountPages.accountSettingsMultiSectionHint')}
      </p>
      <div className={ui.adminSettingsGrid}>
        <div className={ui.adminSettingsMain}>
          <div className={ui.adminSettingsCard}>
            <h2 className={ui.adminSettingsSectionTitle}>{t('accountPages.appearanceTitle')}</h2>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.themeHint')}</p>
            <p className={ui.adminSettingsProfileMeta}>{t('accountPages.languageHint')}</p>
          </div>

          <div className={ui.adminSettingsCards2Col}>
            <PortalNotificationPrefsCard />
            <PortalPasswordChangeForm />
          </div>

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
  const { user } = useAuth();
  const { t } = useI18n();
  const list = [...notificationsForRole(state, role, user?.id)].sort(
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
