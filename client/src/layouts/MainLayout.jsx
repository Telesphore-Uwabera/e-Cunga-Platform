import { Link, NavLink, Outlet } from 'react-router-dom';
import '../theme.css';
import styles from './MainLayout.module.css';

const year = new Date().getFullYear();

function navClass({ isActive }) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

export default function MainLayout() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.bar}>
          <div className={styles.brandCluster}>
            <Link to="/" className={styles.logo}>
              <span className={styles.logoMark}>e</span>-CUNGA
            </Link>
            <span className={styles.brandTag}>AI inventory workflow</span>
          </div>
          <nav className={styles.nav} aria-label="Primary">
            <NavLink to="/" className={navClass} title="Back to the homepage">
              Home
            </NavLink>
            <Link to="/#features" className={styles.navLink} title="Explore platform features">
              Features
            </Link>
            <Link to="/#analytics" className={styles.navLink} title="See analytics and forecasting">
              Solutions
            </Link>
            <Link to="/#reports" className={styles.navLink} title="Review reports and control insights">
              Ecosystem
            </Link>
            <NavLink to="/pricing" className={navClass} title="Compare pricing and FAQ">
              Pricing
            </NavLink>
            <NavLink to="/contact" className={navClass} title="Reach the e-CUNGA team">
              Contact Us
            </NavLink>
          </nav>
          <div className={styles.actions}>
            <Link to="/login" className={styles.actionGhost}>
              Sign In
            </Link>
            <Link to="/register" className={styles.actionSolid}>
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBar}>
          <div className={styles.footerBrand}>
            <Link to="/" className={styles.footerLogo}>
              <span className={styles.logoMark}>e</span>-CUNGA
            </Link>
            <p className={styles.footerText}>
              Automated inventory control with real-time visibility for operations, finance, and supplier workflow.
            </p>
          </div>
          <div className={styles.footerCols}>
            <div>
              <p className={styles.footerHeading}>Product</p>
              <nav className={styles.footerNav} aria-label="Product links">
                <Link to="/#features">Features</Link>
                <Link to="/#analytics">Analytics</Link>
                <Link to="/pricing">Pricing</Link>
              </nav>
            </div>
            <div>
              <p className={styles.footerHeading}>Company</p>
              <nav className={styles.footerNav} aria-label="Company links">
                <Link to="/contact">Contact Us</Link>
                <Link to="/register">Create workspace</Link>
                <Link to="/login">Sign In</Link>
              </nav>
            </div>
            <div>
              <p className={styles.footerHeading}>Support</p>
              <div className={styles.footerMeta}>
                <span>hello@ecunga.com</span>
                <span>Kigali, Rwanda</span>
                <span>Mon - Fri, 8am - 6pm</span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.footerBase}>
          <div className={styles.footerBaseInner}>
            <span>© {year} e-CUNGA. All rights reserved.</span>
            <div className={styles.footerLegal}>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
