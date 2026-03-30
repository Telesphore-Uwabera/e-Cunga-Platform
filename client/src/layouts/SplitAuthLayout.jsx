import { Outlet, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import { EcungaWordmarkOnDarkPanel } from '../components/EcungaLogo.jsx';
import '../theme.css';
import styles from './SplitAuthLayout.module.css';

/** Split login: single rounded card, warehouse hero + form (design spec). */
function SocialIcon({ kind }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'facebook') {
    return (
      <svg {...common}>
        <path d="M14 8h2V4h-2.5A4.5 4.5 0 0 0 9 8.5V11H6v4h3v5h4v-5h3.2l.8-4H13V8.8c0-.5.3-.8 1-.8Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'instagram') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'x') {
    return (
      <svg {...common}>
        <path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M12 4a8 8 0 0 0-6.95 11.97L4 20l4.18-1.02A8 8 0 1 0 12 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 8.85c.2-.44.42-.45.62-.46h.53c.17 0 .45.06.68.31.23.25.88.86.88 2.09s-.9 2.41-1.03 2.58c-.13.17-1.8 2.88-4.45 3.92-2.2.86-2.65.69-3.13.65-.48-.04-1.55-.63-1.77-1.23-.22-.6-.22-1.12-.15-1.23.07-.1.25-.16.52-.3.27-.13.45-.23.63-.35.18-.13.3-.19.45.03.15.22.63.78.77.94.14.16.28.18.52.06.24-.12 1-.37 1.9-1.18.7-.63 1.17-1.42 1.31-1.66.14-.24.01-.37-.11-.5-.11-.12-.24-.3-.36-.45-.12-.15-.16-.25-.24-.42-.08-.17-.04-.33.02-.46.06-.13.54-1.33.75-1.81Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 4.2 2c-.7.58-1.3 1-1.3 2.05" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" />
    </svg>
  );
}

export default function SplitAuthLayout() {
  const { t } = useI18n();
  const socialLinks = [
    { id: 'facebook', label: 'Facebook', href: 'https://facebook.com/' },
    { id: 'instagram', label: 'Instagram', href: 'https://instagram.com/' },
    { id: 'x', label: 'X', href: 'https://x.com/' },
    { id: 'whatsapp', label: 'WhatsApp', href: 'https://web.whatsapp.com/' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.shell} role="presentation">
        <div className={styles.hero}>
          <div className={styles.heroInner}>
            <header className={styles.heroTop}>
              <Link to="/" className={styles.heroBrand} aria-label="e-CUNGA home">
                <EcungaWordmarkOnDarkPanel />
              </Link>
              <p className={styles.heroTagline}>{t('auth.layoutSplitTagline')}</p>
            </header>
            <footer className={styles.heroBottom}>
              <div className={styles.socialRail} aria-label="Social media links">
                {socialLinks.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className={styles.socialLink}
                  >
                    <SocialIcon kind={item.id} />
                  </a>
                ))}
              </div>
              <h1 className={styles.heroTitle}>Curate your inventory with precision.</h1>
              <div className={styles.proofRow} aria-hidden>
                <div className={styles.proofAvatars}>
                  <span className={styles.proofAvatar} />
                  <span className={styles.proofAvatar} />
                </div>
                <p className={styles.proofText}>{t('auth.layoutSplitProof')}</p>
              </div>
            </footer>
          </div>
        </div>
        <div className={styles.formPane}>
          <div className={styles.formInner}>
            <Outlet />
          </div>
        </div>
      </div>
      <Link to="/contact" className={styles.helpCenter}>
        <HelpIcon />
        <span>{t('shell.helpCenter')}</span>
      </Link>
    </div>
  );
}
