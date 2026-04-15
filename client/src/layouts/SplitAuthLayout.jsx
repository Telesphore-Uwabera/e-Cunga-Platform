import { Outlet, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import AuthHeroSocial from '../components/AuthHeroSocial.jsx';
import { EcungaWordmarkLight } from '../components/EcungaLogo.jsx';
import '../theme.css';
import styles from './SplitAuthLayout.module.css';

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

  return (
    <div className={styles.page}>
      <div className={styles.shell} role="presentation">
        <div className={styles.hero}>
          <div className={styles.heroInner}>
            <header className={styles.heroTop}>
              <Link to="/" className={styles.heroBrand} aria-label="e-Cunga Portal home">
                <EcungaWordmarkLight />
              </Link>
              <p className={styles.heroTagline}>{t('auth.layoutSplitTagline')}</p>
            </header>
            <footer className={styles.heroBottom}>
              <AuthHeroSocial railClass={styles.socialRail} linkClass={styles.socialLink} />
              <h1 className={styles.heroTitle}>Bill, request, report,<br />approve, supplier connection<br />in your workplace</h1>
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
