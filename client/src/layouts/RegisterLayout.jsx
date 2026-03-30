import { Link, Outlet } from 'react-router-dom';
import '../theme.css';
import styles from './RegisterLayout.module.css';

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
              Register your company workspace and start coordinating stock, approvals, finance, and supplier fulfilment in
              one platform.
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
                    <strong>4 teams live</strong>
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
      <div className={styles.cornerMeta}>
        <span>e-CUNGA</span>
        <Link to="/login">Sign In</Link>
      </div>
    </div>
  );
}
