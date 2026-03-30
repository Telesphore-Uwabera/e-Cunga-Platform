import { Link, Outlet } from 'react-router-dom';
import '../theme.css';
import styles from './ResetPasswordLayout.module.css';

export default function ResetPasswordLayout() {
  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.brandRow}>
          <Link to="/" className={styles.footerLogo}>
            <span className={styles.logoEc}>e</span>-CUNGA
          </Link>
        </div>
        <div className={styles.card}>
          <Outlet />
        </div>
        <div className={styles.supportRow}>
          <p className={styles.support}>
            Having trouble?{' '}
            <Link to="/contact" className={styles.supportLink}>
              Contact Support
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
