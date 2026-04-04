import { Link, NavLink, Outlet } from 'react-router-dom';
import HashSectionLink from '../components/HashSectionLink.jsx';
import LangFlag from '../components/LangFlag.jsx';
import { EcungaWordmarkLight, EcungaWordmarkOnLightSurface } from '../components/EcungaLogo.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import '../theme.css';
import styles from './MainLayout.module.css';

const year = new Date().getFullYear();

function navClass({ isActive }) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

export default function MainLayout() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.bar}>
          <div className={styles.brandCluster}>
            <Link to="/" className={styles.logo} aria-label="e-CUNGA home">
              <EcungaWordmarkOnLightSurface size="lg" />
            </Link>
          </div>
          <nav className={styles.nav} aria-label="Primary">
            <NavLink to="/" className={navClass} title="Back to the homepage">
              {t('marketing.navHome')}
            </NavLink>
            <HashSectionLink to="/#features" className={styles.navLink} title="See stock monitoring features">
              {t('marketing.navStockFeatures')}
            </HashSectionLink>
            <HashSectionLink to="/#analytics" className={styles.navLink} title="See analytics and forecasting insights">
              {t('marketing.navAnalytics')}
            </HashSectionLink>
            <HashSectionLink to="/#reports" className={styles.navLink} title="See supported sectors and use cases">
              {t('marketing.navSectors')}
            </HashSectionLink>
            <NavLink to="/pricing" className={navClass} title="Compare pricing and FAQ">
              {t('marketing.navPricing')}
            </NavLink>
            <NavLink to="/contact" className={navClass} title="Reach the e-CUNGA team">
              {t('marketing.navContact')}
            </NavLink>
          </nav>
          <div className={styles.actions}>
            <div className={styles.langSwitch} role="group" aria-label={t('shell.langAria')}>
              <button
                type="button"
                className={language === 'eng' ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn}
                onClick={() => setLanguage('eng')}
                title="English"
              >
                <LangFlag lang="eng" className={styles.langFlag} />
                ENG
              </button>
              <button
                type="button"
                className={language === 'kiny' ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn}
                onClick={() => setLanguage('kiny')}
                title="Kinyarwanda"
              >
                <LangFlag lang="kiny" className={styles.langFlag} />
                KINY
              </button>
            </div>
            <Link to="/login" className={styles.actionGhost}>
              {t('marketing.signIn')}
            </Link>
            <Link to="/register" className={styles.actionSolid}>
              {t('marketing.getStarted')}
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
            <span className={styles.footerBadge}>{t('marketing.footerBadge')}</span>
            <Link to="/" className={styles.footerLogo} aria-label="e-CUNGA home">
              <EcungaWordmarkLight footer />
            </Link>
            <p className={styles.footerText}>{t('marketing.footerBlurb')}</p>
          </div>
          <div className={styles.footerCols}>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerPlatform')}</p>
              <nav className={styles.footerNav} aria-label="Product links">
                <Link to="/">{t('marketing.footerLanding')}</Link>
                <HashSectionLink to="/#features">{t('marketing.navStockFeatures')}</HashSectionLink>
                <HashSectionLink to="/#analytics">{t('marketing.navAnalytics')}</HashSectionLink>
                <HashSectionLink to="/#reports">{t('marketing.footerEcosystem')}</HashSectionLink>
              </nav>
            </div>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerSolutions')}</p>
              <nav className={styles.footerNav} aria-label="Solution links">
                <Link to="/pricing">{t('marketing.navPricing')}</Link>
                <Link to="/contact">{t('marketing.footerBookDemo')}</Link>
                <Link to="/register">{t('marketing.footerCreateWorkspace')}</Link>
              </nav>
            </div>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerCompany')}</p>
              <nav className={styles.footerNav} aria-label="Company links">
                <Link to="/contact">{t('marketing.navContact')}</Link>
                <Link to="/login">{t('marketing.signIn')}</Link>
                <Link to="/register">{t('marketing.getStarted')}</Link>
              </nav>
            </div>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerContactBlock')}</p>
              <div className={styles.footerMeta}>
                <span>hello@ecunga.com</span>
                <span>Kigali, Rwanda</span>
                <span>{t('marketing.footerHours')}</span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.footerBase}>
          <div className={styles.footerBaseInner}>
            <span>
              © {year} e-CUNGA. {t('marketing.footerRights')}
            </span>
            <div className={styles.footerLegal}>
              <Link to="/privacy">{t('marketing.privacy')}</Link>
              <Link to="/terms">{t('marketing.terms')}</Link>
              <Link to="/cookies">{t('marketing.cookies')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
