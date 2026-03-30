import { Outlet, Link } from 'react-router-dom';
import '../theme.css';
import styles from './SplitAuthLayout.module.css';

/** Split login: single rounded card, warehouse hero + form (design spec). */
export default function SplitAuthLayout() {
  return (
    <div className={styles.page}>
      <div className={styles.shell} role="presentation">
        <div className={styles.hero}>
          <div className={styles.heroInner}>
            <header className={styles.heroTop}>
              <Link to="/" className={styles.heroBrand}>
                <span className={styles.heroBrandEc}>e</span>-CUNGA
              </Link>
              <p className={styles.heroTagline}>Inventory intelligence for teams that need precision and control.</p>
            </header>
            <footer className={styles.heroBottom}>
              <h1 className={styles.heroTitle}>Curate your inventory with precision.</h1>
              <p className={styles.heroCopy}>
                e-CUNGA helps operational teams monitor stock, reduce approval delays, and keep supplier workflow visible in
                one place.
              </p>
              <div className={styles.metricCard} aria-hidden>
                <p className={styles.metricLabel}>Live workspace signal</p>
                <div className={styles.metricValueRow}>
                  <strong className={styles.metricValue}>94%</strong>
                  <span className={styles.metricBadge}>Healthy</span>
                </div>
                <div className={styles.metricBars}>
                  <span />
                  <span />
                  <span />
                </div>
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
      <div className={styles.cornerMeta}>
        <span>e-CUNGA</span>
        <Link to="/contact">Contact Us</Link>
      </div>
    </div>
  );
}
