import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import '../theme.css';
import styles from './MarketingPages.module.css';

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="m5.5 7.5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <path
        d="M7.8 4.6h2l1.1 4.3-1.9 1.8a15.5 15.5 0 0 0 4.3 4.3l1.8-1.9 4.3 1.1v2a1.8 1.8 0 0 1-2 1.8c-7 0-12.6-5.7-12.6-12.6a1.8 1.8 0 0 1 1.8-1.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <path
        d="M12 20s6-4.9 6-10a6 6 0 1 0-12 0c0 5.1 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9h17M3.5 15h17M12 3c2.4 2.4 3.7 5.6 3.7 9s-1.3 6.6-3.7 9c-2.4-2.4-3.7-5.6-3.7-9S9.6 5.4 12 3Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" aria-hidden>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.3 11 7.1-4.1M8.3 13l7.1 4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const CONTACT_INDUSTRY_OPTIONS = [
  'Healthcare',
  'Hotel / hospitality',
  'Retail & wholesale',
  'Industry / manufacturing',
  'Agribusiness',
  'Government / NGO',
  'Other',
];

const CONTACT_INDUSTRY_KEY = {
  Healthcare: 'healthcare',
  'Hotel / hospitality': 'hotel',
  'Retail & wholesale': 'retail',
  'Industry / manufacturing': 'industry',
  Agribusiness: 'agri',
  'Government / NGO': 'gov',
  Other: 'other',
};

export default function ContactPage() {
  const { t } = useI18n();
  const [formStatus, setFormStatus] = useState('idle');
  const [formMessage, setFormMessage] = useState('');
  const [shareTip, setShareTip] = useState('');

  async function handleContactSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: String(fd.get('firstName') || '').trim(),
      lastName: String(fd.get('lastName') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      industry: String(fd.get('industry') || '').trim(),
      message: String(fd.get('message') || '').trim(),
    };
    setFormStatus('sending');
    setFormMessage('');
    try {
      await apiFetch('/contact', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setFormStatus('success');
      setFormMessage(t('contact.formSuccess'));
      e.currentTarget.reset();
    } catch (err) {
      setFormStatus('error');
      setFormMessage(err?.message || t('contact.formError'));
    }
  }

  async function handleShare() {
    setShareTip('');
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'e-Cunga', text: 'Contact e-Cunga', url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareTip(t('contact.linkCopied'));
        setTimeout(() => setShareTip(''), 2800);
      }
    } catch {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          setShareTip(t('contact.linkCopied'));
          setTimeout(() => setShareTip(''), 2800);
        } catch {
          setShareTip(t('contact.shareFailed'));
        }
      } else {
        setShareTip(t('contact.shareFailed'));
      }
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.heroBandPrimary}>
        <div className={styles.containNarrow}>
          <p className={styles.contactEyebrow}>{t('contact.eyebrow')}</p>
          <h1 className={styles.contactTitle}>{t('contact.title')}</h1>
          <p className={styles.heroSub} style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            {t('contact.lead')}
          </p>
        </div>
      </section>

      <div className={styles.contain}>
        <div className={styles.contactGrid}>
          <div className={styles.contactPanel}>
            <div className={styles.contactPanelTop}>
              <span className={styles.contactChip}>{t('contact.chip')}</span>
              <h2 className={styles.contactPanelTitle}>{t('contact.panelTitle')}</h2>
              <p className={styles.contactPanelCopy}>{t('contact.panelCopy')}</p>
            </div>

            <div className={styles.contactInfoCard}>
              <div className={styles.contactBlock}>
                <div className={`${styles.contactIconBox} ${styles.contactIconMail}`}>
                  <MailIcon />
                </div>
                <div className={styles.contactBlockBody}>
                  <p className={styles.contactLabel}>{t('contact.labelSupport')}</p>
                  <a href="mailto:hello@ecunga.com" className={styles.contactValue}>
                    concierge@e-cunga.tech
                  </a>
                  <p className={styles.contactMuted}>{t('contact.mutedSupport')}</p>
                </div>
              </div>
              <div className={styles.contactBlock}>
                <div className={`${styles.contactIconBox} ${styles.contactIconPhone}`}>
                  <PhoneIcon />
                </div>
                <div className={styles.contactBlockBody}>
                  <p className={styles.contactLabel}>{t('contact.labelHq')}</p>
                  <p className={styles.contactValue}>+250 788 000 000</p>
                  <p className={styles.contactMuted}>{t('contact.mutedHq')}</p>
                </div>
              </div>
              <div className={styles.contactBlock}>
                <div className={`${styles.contactIconBox} ${styles.contactIconPin}`}>
                  <PinIcon />
                </div>
                <div className={styles.contactBlockBody}>
                  <p className={styles.contactLabel}>{t('contact.labelCenter')}</p>
                  <p className={styles.contactValue}>{t('contact.valueAddr')}</p>
                  <p className={styles.contactMuted}>{t('contact.mutedAddr')}</p>
                </div>
              </div>
            </div>

            <div className={styles.mapCard}>
              <div className={styles.mapStub} role="img" aria-label={t('contact.mapAria')} />
              <div className={styles.mapMeta}>
                <strong>{t('contact.mapStrong')}</strong>
                <span>{t('contact.mapSpan')}</span>
              </div>
            </div>

            <div className={styles.backHomeRow} style={{ justifyContent: 'flex-start', marginTop: '1.2rem' }}>
              <Link to="/" className={styles.backHomeBtn}>
                {t('pricing.backHome')}
              </Link>
            </div>
          </div>

          <div className={styles.formWrap}>
            <div className={styles.formIntro}>
              <span className={styles.formKicker}>{t('contact.formKicker')}</span>
              <h2 className={styles.formTitle}>{t('contact.formTitle')}</h2>
              <p className={styles.formLead}>{t('contact.formLead')}</p>
            </div>

            <form className={styles.form} onSubmit={handleContactSubmit}>
              <div className={styles.formRow2}>
                <label className={styles.field}>
                  {t('contact.firstName')}
                  <input type="text" name="firstName" required className={styles.input} placeholder="Aline" />
                </label>
                <label className={styles.field}>
                  {t('contact.lastName')}
                  <input type="text" name="lastName" required className={styles.input} placeholder="Uwimana" />
                </label>
              </div>
              <label className={styles.field}>
                {t('contact.workEmail')}
                <input type="email" name="email" required className={styles.input} placeholder="hello@company.com" />
              </label>
              <label className={styles.field}>
                {t('contact.institutionType')}
                <select name="industry" className={styles.select}>
                  {CONTACT_INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {t(`auth.industryLabels.${CONTACT_INDUSTRY_KEY[opt] || 'other'}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldGrow}`}>
                {t('contact.message')}
                <textarea
                  name="message"
                  rows={4}
                  required
                  className={styles.textarea}
                  placeholder={t('contact.msgPlaceholder')}
                />
              </label>
              {formMessage ? (
                <p
                  className={styles.formLead}
                  style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    color: formStatus === 'error' ? '#b91c1c' : 'var(--ec-primary, #692751)',
                  }}
                  role="status"
                >
                  {formMessage}
                </p>
              ) : null}
              <button type="submit" className={styles.btnSolid} disabled={formStatus === 'sending'}>
                {formStatus === 'sending' ? t('contact.sending') : t('contact.send')}
              </button>
            </form>
            <div className={styles.formFooter}>
              <div className={styles.formSocialProof}>
                <div className={styles.avatarStack} aria-hidden>
                  <span className={styles.avatarDot} />
                  <span className={styles.avatarDot} />
                  <span className={styles.avatarDot} />
                </div>
                <span>{t('contact.socialProof')}</span>
              </div>
              <div className={styles.formFooterActions}>
                <a href="https://ecunga.com" className={styles.formFooterBtn} aria-label="Visit e-Cunga website">
                  <GlobeIcon />
                </a>
                <button type="button" className={styles.formFooterBtn} aria-label="Share contact page" onClick={handleShare}>
                  <ShareIcon />
                </button>
              </div>
            </div>
            {shareTip ? (
              <p className={styles.formLead} style={{ marginTop: '0.5rem', fontSize: '0.85rem' }} role="status">
                {shareTip}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
