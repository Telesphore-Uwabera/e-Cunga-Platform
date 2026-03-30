import { Link, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import '../theme.css';
import styles from './RegisterLayout.module.css';

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 4.2 2c-.7.58-1.3 1-1.3 2.05" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" />
    </svg>
  );
}

export default function RegisterLayout() {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.promo}>
            <Link to="/" className={styles.logo}>
              <span className={styles.logoEc}>e</span>-CUNGA
            </Link>
            <h1 className={styles.promoTitle}>{t('auth.layoutRegisterPromo')}</h1>
            <p className={styles.promoLead}>{t('auth.layoutRegisterLead')}</p>
            <div className={styles.promoMock} aria-hidden>
              <div className={styles.mockChrome}>
                <div className={styles.mockHeader}>
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.mockBody}>
                  <div className={styles.metricBox}>
                    <p>{t('auth.layoutRegisterRollout')}</p>
                    <strong>{t('auth.layoutRegisterReady')}</strong>
                  </div>
                  <div className={styles.mockLines}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.mockAvatars}>
                    <span className={styles.mockAvatar} />
                    <span className={styles.mockAvatar} />
                    <span className={styles.mockAvatar} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.formColumn}>
            <div className={styles.formInner}>
              <Outlet />
            </div>
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
