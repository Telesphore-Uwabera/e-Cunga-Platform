import { Link, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import { EcungaWordmarkAdaptive } from '../components/EcungaLogo.jsx';
import '../theme.css';
import styles from './CenteredAuthLayout.module.css';

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 4.2 2c-.7.58-1.3 1-1.3 2.05" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" />
    </svg>
  );
}

export default function CenteredAuthLayout() {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <div className={styles.brandCluster}>
          <Link to="/" className={styles.brandName} aria-label="e-Cunga home">
            <EcungaWordmarkAdaptive size="lg" />
          </Link>
          <p className={styles.tagline}>{t('auth.layoutCenteredTagline')}</p>
        </div>
        <div className={styles.card}>
          <Outlet />
        </div>
        <div className={styles.belowCard}>
          <p className={styles.meta}>{t('auth.layoutCenteredMeta')}</p>
          <nav className={styles.legal} aria-label="Legal and support">
            <Link to="/privacy">{t('marketing.privacy')}</Link>
            <Link to="/terms">{t('marketing.terms')}</Link>
            <Link to="/contact">{t('auth.layoutSupport')}</Link>
          </nav>
        </div>
      </div>
      <div className={styles.cornerMeta}>
        <div className={styles.cornerIcon} aria-hidden>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7.6v4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16.6" r="1.1" fill="currentColor" />
          </svg>
        </div>
        <div>
          <strong>{t('auth.layoutSecureSession')}</strong>
          <span>{t('auth.layoutSecureLedger')}</span>
        </div>
      </div>
      <Link to="/contact" className={styles.helpCenter}>
        <HelpIcon />
        <span>{t('shell.helpCenter')}</span>
      </Link>
    </div>
  );
}
