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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#25D366" />
      <path d="M8 17.3 8.75 14.95A5.25 5.25 0 1 1 17.2 12a5.25 5.25 0 0 1-7.52 4.73L8 17.3Z" fill="#fff" />
      <path
        d="M10.28 9.2c.15-.33.32-.34.47-.35h.4c.13 0 .34.05.5.23.17.19.64.64.64 1.55 0 .9-.66 1.8-.75 1.93-.09.13-1.31 2.1-3.25 2.86-1.61.63-1.94.52-2.28.48-.35-.03-1.13-.46-1.29-.89-.17-.44-.17-.82-.11-.9.05-.07.18-.12.39-.22.2-.1.33-.17.45-.26.13-.09.22-.14.33.02.11.16.45.57.56.68.1.12.2.13.38.05.18-.09.73-.28 1.39-.87.51-.46.86-1.03.96-1.22.1-.18.01-.27-.08-.36-.08-.09-.18-.22-.27-.32s-.12-.18-.17-.31c-.06-.13-.03-.24.02-.33.04-.1.4-.97.54-1.33Z"
        fill="#25D366"
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
    const form = e.currentTarget;
    const fd = new FormData(form);
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
      form.reset();
    } catch (err) {
      setFormStatus('error');
      const msg = String(err?.message || '');
      const friendly =
        msg.includes('Failed to fetch') || msg.includes('NetworkError') || err?.status === 0
          ? t('contact.formNetworkError')
          : msg || t('contact.formError');
      setFormMessage(friendly);
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
                  <a href="mailto:hello.ecunga@gmail.com" className={styles.contactValue}>
                    hello.ecunga@gmail.com
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
                  <p className={styles.contactValue}>+250 781 975 074</p>
                  <p className={styles.contactMuted} style={{ marginTop: '0.25rem' }}>+250 789 060 629</p>
                  <p className={styles.contactMuted}>{t('contact.mutedHq')}</p>
                </div>
              </div>
              <div className={styles.contactBlock}>
                <div className={`${styles.contactIconBox} ${styles.contactIconWhatsApp}`}>
                  <WhatsAppIcon />
                </div>
                <div className={styles.contactBlockBody}>
                  <p className={styles.contactLabel}>WhatsApp</p>
                  <a href="https://wa.me/250781975074" target="_blank" rel="noreferrer" className={styles.contactValue}>
                    +250 781 975 074
                  </a>
                  <p className={styles.contactMuted} style={{ marginTop: '0.25rem' }}>Quick support and demo coordination</p>
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
                  <input
                    type="text"
                    name="firstName"
                    required
                    className={styles.input}
                    placeholder={t('auth.phName')}
                  />
                </label>
                <label className={styles.field}>
                  {t('contact.lastName')}
                  <input
                    type="text"
                    name="lastName"
                    required
                    className={styles.input}
                    placeholder={t('auth.phLast')}
                  />
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
