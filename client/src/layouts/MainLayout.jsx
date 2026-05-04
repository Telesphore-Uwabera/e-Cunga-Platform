import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import HashSectionLink from '../components/HashSectionLink.jsx';
import HomeTopLink from '../components/HomeTopLink.jsx';
import ScrollToTop from '../components/ScrollToTop.jsx';
import { handleMarketingHomeNavClick } from '../utils/hashNavigation.js';
import LangFlag from '../components/LangFlag.jsx';
import { EcungaWordmarkLight, EcungaWordmarkOnLightSurface } from '../components/EcungaLogo.jsx';
import HelpWidget from '../components/HelpWidget.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useEffect } from 'react';
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
      <svg {...common} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
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

function NavIcon({ kind }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true, stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'home') {
    return (
      <svg {...common}>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  }
  if (kind === 'analytics') {
    return (
      <svg {...common}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }
  if (kind === 'features') {
    return (
      <svg {...common}>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    );
  }
  if (kind === 'sectors') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        <path d="M14 3v5h5M16 13H8M16 17H8M10 9H8" />
      </svg>
    );
  }
  if (kind === 'pricing') {
    return (
      <svg {...common}>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    );
  }
  if (kind === 'contact') {
    return (
      <svg {...common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }
  return null;
}

export default function MainLayout() {
  const { language, setLanguage, t, locale } = useI18n();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const desc = t('shell.seo.richDescription');
    const updateMeta = (name, content) => {
      let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
      if (el) el.setAttribute('content', content);
    };
    updateMeta('description', desc);
    updateMeta('og:description', desc);
    updateMeta('twitter:description', desc);
  }, [t, locale]);

  return (
    <div className={styles.page}>
      <ScrollToTop />
      <header className={styles.header}>
        <div className={styles.bar}>
          <div className={styles.brandCluster}>
            <HomeTopLink className={styles.logo} aria-label="e-Cunga Portal home">
              <EcungaWordmarkOnLightSurface size="lg" />
            </HomeTopLink>
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <span className={styles.mobileMenuText}>Menu</span>
              <MenuIcon />
            </button>
          </div>
          <nav className={styles.nav} aria-label="Primary">
            <NavLink
              to="/"
              end
              className={navClass}
              title="Back to the homepage"
              onClick={(e) => handleMarketingHomeNavClick(e, location)}
            >
              <NavIcon kind="home" />
              {t('marketing.navHome')}
            </NavLink>
            <HashSectionLink to="/#about-us" className={styles.navLink} title="See analytics and forecasting insights">
              <NavIcon kind="analytics" />
              {t('marketing.navAnalytics')}
            </HashSectionLink>
            <HashSectionLink to="/#stock" className={styles.navLink} title="See stock monitoring features">
              <NavIcon kind="features" />
              {t('marketing.navStockFeatures')}
            </HashSectionLink>
            <HashSectionLink to="/#sectors" className={styles.navLink} title="See supported sectors and use cases">
              <NavIcon kind="sectors" />
              {t('marketing.navSectors')}
            </HashSectionLink>
            <NavLink to="/pricing" className={navClass} title="Compare pricing and FAQ">
              <NavIcon kind="pricing" />
              {t('marketing.navPricing')}
            </NavLink>
            <NavLink to="/contact" className={navClass} title="Reach the e-Cunga Portal team">
              <NavIcon kind="contact" />
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
                  <NavIcon kind="home" />
                  {t('marketing.navHome')}
                </NavLink>
                <HashSectionLink to="/#about-us" className={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  <NavIcon kind="analytics" />
                  {t('marketing.navAnalytics')}
                </HashSectionLink>
                <HashSectionLink to="/#stock" className={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  <NavIcon kind="features" />
                  {t('marketing.navStockFeatures')}
                </HashSectionLink>
                <HashSectionLink to="/#sectors" className={styles.navLink} onClick={() => setMobileMenuOpen(false)}>
                  <NavIcon kind="sectors" />
                  {t('marketing.navSectors')}
                </HashSectionLink>
                <NavLink to="/pricing" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                  <NavIcon kind="pricing" />
                  {t('marketing.navPricing')}
                </NavLink>
                <NavLink to="/contact" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                  <NavIcon kind="contact" />
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
            <HomeTopLink className={styles.footerLogo} aria-label="e-Cunga Portal home">
              <EcungaWordmarkLight footer />
            </HomeTopLink>
            <p className={styles.footerText}>{t('marketing.footerBlurb')}</p>
          </div>
          <div className={styles.footerCols}>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerPlatform')}</p>
              <nav className={styles.footerNav} aria-label="Product links">
                <HomeTopLink>{t('marketing.footerLanding')}</HomeTopLink>
                <HashSectionLink to="/#stock">{t('marketing.navStockFeatures')}</HashSectionLink>
                <HashSectionLink to="/#about-us">{t('marketing.navAnalytics')}</HashSectionLink>
                <HashSectionLink to="/#sectors">{t('marketing.footerEcosystem')}</HashSectionLink>
              </nav>
            </div>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerSolutions')}</p>
              <nav className={styles.footerNav} aria-label="Solution links">
                <Link to="/pricing">{t('marketing.navPricing')}</Link>
                <HashSectionLink to="/pricing#faq">{t('pricing.faqTitle')}</HashSectionLink>
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
              <div className={styles.newsletter}>
                <p className={styles.footerHeading}>{t('marketing.footerNewsletterTitle')}</p>
                <form className={styles.newsletterForm} onSubmit={(e) => e.preventDefault()}>
                  <input type="email" placeholder={t('marketing.footerNewsletterPh')} className={styles.newsletterInput} />
                  <button type="submit" className={styles.newsletterBtn}>{t('marketing.footerNewsletterCta')}</button>
                </form>
              </div>
            </div>
            <div>
              <p className={styles.footerHeading}>{t('marketing.footerContactBlock')}</p>
              <div className={styles.footerMeta}>
                <a href="mailto:hello.ecunga@gmail.com" className={styles.footerContactRow}>
                  <FooterIcon kind="mail" />
                  <span>hello.ecunga@gmail.com</span>
                </a>
                <a href="tel:+250781975074" className={styles.footerContactRow}>
                  <FooterIcon kind="phone" />
                  <span>+250 781 975 074</span>
                </a>
                <a href="https://wa.me/250781975074" target="_blank" rel="noreferrer" className={styles.footerContactRow}>
                  <FooterIcon kind="whatsapp" />
                  <span>+250 781 975 074</span>
                </a>
                <div className={styles.footerContactRow}>
                  <FooterIcon kind="pin" />
                  <span>Kigali, Rwanda</span>
                </div>
                <p className={styles.footerHours}>{t('marketing.footerHours')}</p>

                <div className={styles.footerSocialIcons}>
                  <a href="https://www.instagram.com/ecungaportal?igsh=d3FudDRhYnBwM3dq" target="_blank" rel="noreferrer" aria-label="Instagram">
                    <FooterIcon kind="instagram" />
                  </a>
                  <a href="https://www.linkedin.com/in/ecunga-portal-b143a5404?utm_source=share_via&utm_content=profile&utm_medium=member_android" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                    <FooterIcon kind="linkedin" />
                  </a>
                  <a href="https://x.com/eCungaPortal" target="_blank" rel="noreferrer" aria-label="X">
                    <FooterIcon kind="x" />
                  </a>
                  <a href="https://wa.me/250781975074" target="_blank" rel="noreferrer" aria-label="WhatsApp">
                    <FooterIcon kind="whatsapp" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.footerBase}>
          <div className={styles.footerBaseInner}>
            <div className={styles.footerLegal}>
              <Link to="/privacy">{t('marketing.privacy')}</Link>
              <Link to="/terms">{t('marketing.terms')}</Link>
              <Link to="/cookies">{t('marketing.cookies')}</Link>
            </div>
            <span>
              © {year} e-Cunga Portal. {t('marketing.footerRights')}
            </span>
          </div>
          <div className={styles.footerDevRow}>
            Contact <a href="https://uwaberatelesphore.netlify.app/" target="_blank" rel="noopener noreferrer" className={styles.footerDevLink}>&lt;/&gt;</a>
          </div>
        </div>
      </footer>
      <HelpWidget />
    </div>
  );
}
