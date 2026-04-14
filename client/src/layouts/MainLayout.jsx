import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import HashSectionLink from '../components/HashSectionLink.jsx';
import HomeTopLink from '../components/HomeTopLink.jsx';
import ScrollToTop from '../components/ScrollToTop.jsx';
import { handleMarketingHomeNavClick } from '../utils/hashNavigation.js';
import LangFlag from '../components/LangFlag.jsx';
import { EcungaWordmarkLight, EcungaWordmarkOnLightSurface } from '../components/EcungaLogo.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import '../theme.css';
import styles from './MainLayout.module.css';

const year = new Date().getFullYear();

function FooterIcon({ kind }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'mail') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="m5.5 7.5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'phone') {
    return (
      <svg {...common}>
        <path
          d="M7.8 4.6h2l1.1 4.3-1.9 1.8a15.5 15.5 0 0 0 4.3 4.3l1.8-1.9 4.3 1.1v2a1.8 1.8 0 0 1-2 1.8c-7 0-12.6-5.7-12.6-12.6a1.8 1.8 0 0 1 1.8-1.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'pin') {
    return (
      <svg {...common}>
        <path d="M12 20s6-4.9 6-10a6 6 0 1 0-12 0c0 5.1 6 10 6 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === 'whatsapp') {
    return (
      <svg {...common}>
        <path
          d="M12 4a8 8 0 0 0-6.95 11.97L4 20l4.18-1.02A8 8 0 1 0 12 4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9.1 8.85c.2-.44.42-.45.62-.46h.53c.17 0 .45.06.68.31.23.25.88.86.88 2.09s-.9 2.41-1.03 2.58c-.13.17-1.8 2.88-4.45 3.92-2.2.86-2.65.69-3.13.65-.48-.04-1.55-.63-1.77-1.23-.22-.6-.22-1.12-.15-1.23.07-.1.25-.16.52-.3.27-.13.45-.23.63-.35.18-.13.3-.19.45.03.15.22.63.78.77.94.14.16.28.18.52.06.24-.12 1-.37 1.9-1.18.7-.63 1.17-1.42 1.31-1.66.14-.24.01-.37-.11-.5-.11-.12-.24-.3-.36-.45-.12-.15-.16-.25-.24-.42-.08-.17-.04-.33.02-.46.06-.13.54-1.33.75-1.81Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === 'facebook') {
    return (
      <svg {...common}>
        <path d="M14 8h2V4h-2.5A4.5 4.5 0 0 0 9 8.5V11H6v4h3v5h4v-5h3.2l.8-4H13V8.8c0-.5.3-.8 1-.8Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'instagram') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'linkedin') {
    return (
      <svg {...common}>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6ZM2 9h4v12H2V9Z" fill="currentColor" />
        <circle cx="4" cy="4" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'x') {
    return (
      <svg {...common}>
        <path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

function navClass({ isActive }) {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

function MenuIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function MainLayout() {
  const { language, setLanguage, t } = useI18n();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className={styles.page}>
      <ScrollToTop />
      <header className={styles.header}>
        <div className={styles.bar}>
          <div className={styles.brandCluster}>
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
            <HomeTopLink className={styles.logo} aria-label="e-Cunga home">
              <EcungaWordmarkOnLightSurface size="lg" />
            </HomeTopLink>
          </div>
          <nav className={styles.nav} aria-label="Primary">
            <NavLink
              to="/"
              end
              className={navClass}
              title="Back to the homepage"
              onClick={(e) => handleMarketingHomeNavClick(e, location)}
            >
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
            <NavLink to="/contact" className={navClass} title="Reach the e-Cunga team">
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

      {mobileMenuOpen && (
        <div className={styles.mobileDrawerOverlay}>
          <aside className={styles.mobileDrawer}>
            <div className={styles.mobileDrawerHead}>
              <EcungaWordmarkOnLightSurface size="md" />
              <button type="button" className={styles.drawerClose} onClick={() => setMobileMenuOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.mobileDrawerBody}>
              <nav className={styles.mobileNav}>
                <NavLink to="/" end className={navClass} onClick={() => setMobileMenuOpen(false)}>
                  {t('marketing.navHome')}
                </NavLink>
                <HashSectionLink to="/#features" className={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  {t('marketing.navStockFeatures')}
                </HashSectionLink>
                <HashSectionLink to="/#analytics" className={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  {t('marketing.navAnalytics')}
                </HashSectionLink>
                <HashSectionLink to="/#reports" className={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  {t('marketing.navSectors')}
                </HashSectionLink>
                <NavLink to="/pricing" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                  {t('marketing.navPricing')}
                </NavLink>
                <NavLink to="/contact" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                  {t('marketing.navContact')}
                </NavLink>
              </nav>
              <div className={styles.mobileDrawerActions}>
                <Link to="/login" className={styles.actionGhost} onClick={() => setMobileMenuOpen(false)}>
                  {t('marketing.signIn')}
                </Link>
                <Link to="/register" className={styles.actionSolid} onClick={() => setMobileMenuOpen(false)}>
                  {t('marketing.getStarted')}
                </Link>
              </div>
              <div className={styles.mobileLangSwitch}>
                <button
                  type="button"
                  className={language === 'eng' ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn}
                  onClick={() => setLanguage('eng')}
                >
                  <LangFlag lang="eng" className={styles.langFlag} /> ENG
                </button>
                <button
                  type="button"
                  className={language === 'kiny' ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn}
                  onClick={() => setLanguage('kiny')}
                >
                  <LangFlag lang="kiny" className={styles.langFlag} /> KINY
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBar}>
          <div className={styles.footerBrand}>
            <HomeTopLink className={styles.footerLogo} aria-label="e-Cunga home">
              <EcungaWordmarkLight footer />
            </HomeTopLink>
            <p className={styles.footerText}>{t('marketing.footerBlurb')}</p>
          </div>
          <div className={styles.footerCols}>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerPlatform')}</p>
              <nav className={styles.footerNav} aria-label="Product links">
                <HomeTopLink>{t('marketing.footerLanding')}</HomeTopLink>
                <HashSectionLink to="/#features">{t('marketing.navStockFeatures')}</HashSectionLink>
                <HashSectionLink to="/#analytics">{t('marketing.navAnalytics')}</HashSectionLink>
                <HashSectionLink to="/#reports">{t('marketing.footerEcosystem')}</HashSectionLink>
              </nav>
            </div>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerSolutions')}</p>
              <nav className={styles.footerNav} aria-label="Solution links">
                <Link to="/pricing">{t('marketing.navPricing')}</Link>
                <Link to="/pricing#faq">{t('pricing.faqTitle')}</Link>
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
                <a href="mailto:concierge@e-cunga.tech" className={styles.footerContactRow}>
                  <FooterIcon kind="mail" />
                  <span>concierge@e-cunga.tech</span>
                </a>
                <a href="tel:+250788000000" className={styles.footerContactRow}>
                  <FooterIcon kind="phone" />
                  <span>+250 788 000 000</span>
                </a>
                <a href="https://wa.me/250788000000" target="_blank" rel="noreferrer" className={styles.footerContactRow}>
                  <FooterIcon kind="whatsapp" />
                  <span>+250 788 000 000</span>
                </a>
                <div className={styles.footerContactRow}>
                  <FooterIcon kind="pin" />
                  <span>Kigali, Rwanda</span>
                </div>
                <p className={styles.footerHours}>{t('marketing.footerHours')}</p>

                <div className={styles.footerSocialIcons}>
                  <a href="https://facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook">
                    <FooterIcon kind="facebook" />
                  </a>
                  <a href="https://instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">
                    <FooterIcon kind="instagram" />
                  </a>
                  <a href="https://linkedin.com/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                    <FooterIcon kind="linkedin" />
                  </a>
                  <a href="https://x.com/" target="_blank" rel="noreferrer" aria-label="X">
                    <FooterIcon kind="x" />
                  </a>
                </div>
              </div>
              <div className={styles.newsletter}>
                <p className={styles.footerHeading}>Stay Updated</p>
                <form className={styles.newsletterForm} onSubmit={(e) => e.preventDefault()}>
                  <input type="email" placeholder="Your email" className={styles.newsletterInput} />
                  <button type="submit" className={styles.newsletterBtn}>Subscribe</button>
                </form>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.footerBase}>
          <div className={styles.footerBaseInner}>
            <span>
              © {year} e-Cunga. {t('marketing.footerRights')}
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
