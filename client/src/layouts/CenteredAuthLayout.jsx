import { Link, Outlet } from 'react-router-dom';
import '../theme.css';
import styles from './CenteredAuthLayout.module.css';

function BrandIcon() {
  return (
    <div className={styles.brandIcon} aria-hidden>
      <svg viewBox="0 0 24 24" width={21} height={21} fill="none">
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
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <div className={styles.brandCluster}>
          <BrandIcon />
          <Link to="/" className={styles.brandName}>
            <span className={styles.brandEc}>e</span>-CUNGA
          </Link>
          <p className={styles.tagline}>Intelligent Ledger System</p>
        </div>
        <div className={styles.card}>
          <Outlet />
        </div>
        <div className={styles.belowCard}>
          <p className={styles.meta}>Digital Curator Mode • Version 2.4.0</p>
          <nav className={styles.legal} aria-label="Legal and support">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <Link to="/contact">Support</Link>
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
          <strong>Secure Session</strong>
          <span>256-bit encrypted ledger verification active.</span>
        </div>
      </div>
      <Link to="/contact" className={styles.helpCenter}>
        <HelpIcon />
        <span>HELP CENTER</span>
      </Link>
    </div>
  );
}
