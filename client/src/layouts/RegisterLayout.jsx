import { Link, Outlet } from 'react-router-dom';
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
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.promo}>
            <Link to="/" className={styles.logo}>
              <span className={styles.logoEc}>e</span>-CUNGA
            </Link>
            <h1 className={styles.promoTitle}>Scale your inventory with intelligence.</h1>
            <p className={styles.promoLead}>
              Join over 2,000 businesses using e-CUNGA to automate their supply chain and master their ledger.
            </p>
            <div className={styles.promoMock} aria-hidden>
              <div className={styles.mockChrome}>
                <div className={styles.mockHeader}>
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.mockBody}>
                  <div className={styles.metricBox}>
                    <p>Workspace rollout</p>
                    <strong>Company onboarding ready</strong>
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
        <span>HELP CENTER</span>
      </Link>
    </div>
  );
}
