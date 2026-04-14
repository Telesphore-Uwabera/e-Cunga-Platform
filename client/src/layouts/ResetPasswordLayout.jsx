import { Link, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import { EcungaWordmarkAdaptive } from '../components/EcungaLogo.jsx';
import '../theme.css';
import styles from './ResetPasswordLayout.module.css';

export default function ResetPasswordLayout() {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.brandRow}>
          <Link to="/" className={styles.footerLogo} aria-label="e-Cunga home">
            <EcungaWordmarkAdaptive />
          </Link>
        </div>
        <div className={styles.card}>
          <Outlet />
        </div>
        <div className={styles.supportRow}>
          <p className={styles.support}>
            {t('auth.layoutResetTrouble')}{' '}
            <Link to="/contact" className={styles.supportLink}>
              {t('auth.layoutResetContact')}
            </Link>
          </p>
        </div>
      </div>
      <div className={styles.cornerArt} aria-hidden>
        <div className={styles.cornerPlate}>
          <div className={styles.lockRing} />
          <div className={styles.lockBody}>
            <div className={styles.lockKeyhole} />
          </div>
        </div>
      </div>
    </div>
  );
}
