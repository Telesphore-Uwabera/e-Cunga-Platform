import { Link, Outlet } from 'react-router-dom';
import '../theme.css';
import styles from './CenteredAuthLayout.module.css';

function BrandIcon() {
  return (
    <div className={styles.brandIcon} aria-hidden>
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none">
        <path
          d="M5.2 9.5A7.5 7.5 0 0 1 12 4a7.4 7.4 0 0 1 5.2 2.2M19 6v3h-3M18.8 14.5A7.5 7.5 0 0 1 12 20a7.4 7.4 0 0 1-5.2-2.2M5 18v-3h3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 11V9a3 3 0 0 1 6 0v2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <rect x="7" y="11" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

export default function CenteredAuthLayout() {
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <div className={styles.brandCluster}>
          <Link to="/" className={styles.brandName}>
            <span className={styles.brandEc}>e</span>-CUNGA
          </Link>
          <BrandIcon />
          <p className={styles.tagline}>Secure account recovery</p>
        </div>
        <div className={styles.card}>
          <Outlet />
        </div>
        <div className={styles.belowCard}>
          <p className={styles.meta}>e-CUNGA Secure Access</p>
          <nav className={styles.legal} aria-label="Legal and support">
            <a href="#">Privacy Policy</a>
            <span className={styles.dot} aria-hidden>
              ·
            </span>
            <a href="#">Terms of Service</a>
            <span className={styles.dot} aria-hidden>
              ·
            </span>
            <Link to="/contact">Contact Us</Link>
          </nav>
        </div>
      </div>
      <div className={styles.cornerMeta}>Recovery flow protected</div>
    </div>
  );
}
