import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { resolveApiUrl } from '../api/client.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { buildPricingPlans } from '../utils/buildPricingPlans.js';
import { scrollToAnchorById } from '../utils/hashNavigation.js';
import '../theme.css';
import pricingStyles from './MarketingPages.module.css';
import styles from './HomePage.module.css';

function FeatureIcon({ kind }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'stock') {
    return (
      <svg {...common}>
        <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M18 15v4m-2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'workflow') {
    return (
      <svg {...common}>
        <circle cx="6" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 11 15.8 7.1M8 13l7.8 3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M12 3 4 7v6c0 4.7 3.1 8.8 8 10 4.9-1.2 8-5.3 8-10V7l-8-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function HeroSupplierCompare({ t }) {
  return (
    <div className={`${styles.workspaceCard} ${styles.mockupContainer}`}>
      <div className={styles.mockupLaptop}>
        <div className={styles.mockupLaptopInner}>
          <img src="/ecunga-supplier-laptop.png" alt={t('shell.seo.richAltSupplier')} />
        </div>
      </div>
      <div className={styles.mockupPhone}>
        <div className={styles.mockupPhoneInner}>
          <img src="/ecunga-supplier-phone.png" alt="Supplier Mobile App View" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const { hash, pathname } = useLocation();
  const [sectorFilter, setSectorFilter] = useState('all');
  const [homePricingBilling, setHomePricingBilling] = useState('monthly');
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroMotionOk, setHeroMotionOk] = useState(true);

  const featureCards = useMemo(
    () => [
      { icon: 'stock', title: t('home.featureTrackingTitle'), copy: t('home.featureTrackingCopy') },
      { icon: 'workflow', title: t('home.featureWorkflowTitle'), copy: t('home.featureWorkflowCopy') },
      { icon: 'control', title: t('home.featureAnalyticsTitle'), copy: t('home.featureAnalyticsCopy') },
      { icon: 'workflow', title: t('home.featureConnectTitle'), copy: t('home.featureConnectCopy') },
    ],
    [t]
  );

  const sectorOptions = useMemo(
    () => [
      { id: 'all', label: t('home.sectorAll') },
      { id: 'healthcare', label: t('home.sectorHealthcare') },
      { id: 'hospitality', label: t('home.sectorHospitality') },
      { id: 'retail', label: t('home.sectorRetail') },
      { id: 'public', label: t('home.sectorPublic') },
    ],
    [t]
  );

  const sectorCards = useMemo(
    () => [
      { sector: 'healthcare', title: t('home.cardHealthTitle'), body: t('home.cardHealthBody') },
      { sector: 'hospitality', title: t('home.cardHotelTitle'), body: t('home.cardHotelBody') },
      { sector: 'retail', title: t('home.cardRetailTitle'), body: t('home.cardRetailBody') },
      { sector: 'public', title: t('home.cardPublicTitle'), body: t('home.cardPublicBody') },
    ],
    [t]
  );

  const homePricingPlans = useMemo(() => buildPricingPlans(t, homePricingBilling), [t, homePricingBilling]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setHeroMotionOk(!mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!heroMotionOk) return undefined;
    const id = window.setInterval(() => setHeroSlide((s) => (s + 1) % 2), 15000);
    return () => window.clearInterval(id);
  }, [heroMotionOk]);

  useEffect(() => {
    if (!heroMotionOk) setHeroSlide(0);
  }, [heroMotionOk]);


  useLayoutEffect(() => {
    if (pathname !== '/') return;
    const id = hash.replace(/^#/, '').trim();
    if (!id) return;
    if (document.getElementById(id)) {
      scrollToAnchorById(id);
      return undefined;
    }
    const retry = window.setTimeout(() => scrollToAnchorById(id), 120);
    return () => window.clearTimeout(retry);
  }, [hash, pathname]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!nodes.length) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      nodes.forEach((node) => node.setAttribute('data-visible', 'true'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.setAttribute('data-visible', entry.isIntersecting ? 'true' : 'false');
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sectorFilter, homePricingBilling, t]);

  const visibleSectors = useMemo(() => {
    if (sectorFilter === 'all') return sectorCards;
    return sectorCards.filter((card) => card.sector === sectorFilter);
  }, [sectorFilter, sectorCards]);

  const workspaceHeroPanel = (
    <div className={`${styles.workspaceCard} ${styles.mockupContainer}`}>
      <div className={styles.mockupLaptop}>
        <div className={styles.mockupLaptopInner}>
          <img src="/ecunga-stock-laptop.png" alt={t('shell.seo.richAltStock')} />
        </div>
      </div>
      <div className={styles.mockupPhone}>
        <div className={styles.mockupPhoneInner}>
          <img src="/ecunga-stock-phone.png" alt="Stock Mobile App View" />
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.wrap}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{t('home.heroEyebrow')}</p>
            <div className={styles.heroSliderViewport} aria-live={heroMotionOk ? 'polite' : undefined}>
              <div
                className={styles.heroSliderTrack}
                data-motion={heroMotionOk ? 'on' : 'off'}
                style={{ transform: `translateX(-${(heroMotionOk ? heroSlide : 0) * 50}%)` }}
              >
                <div className={styles.heroSlide} aria-hidden={heroSlide !== 0}>
                  <div className={styles.heroSlideGrid}>
                    <div className={styles.heroSlideCopy}>
                      <h2 className={styles.heroMainTitle}>
                        {t('home.heroTitleLine1')}<br />
                        {t('home.heroTitleLine2')}<br />
                        {t('home.heroTitleLine3')}
                      </h2>
                      <p className={styles.heroLead}>{t('home.heroLead')}</p>
                    </div>
                    <HeroSupplierCompare t={t} />
                  </div>
                </div>
                <div className={styles.heroSlide} aria-hidden={heroSlide !== 1}>
                  <div className={styles.heroSlideGrid}>
                    <div className={styles.heroSlideCopy}>
                      <h1 className={styles.heroMainTitle}>
                        {t('home.heroAltTitleLine1')}<br />
                        {t('home.heroAltTitleLine2')}<br />
                        {t('home.heroAltTitleLine3')}
                      </h1>
                      <p className={styles.heroLead}>{t('home.heroAltLead')}</p>
                    </div>
                    {workspaceHeroPanel}
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.heroSlideGrid}>
              <div className={styles.ctaActions}>
                <Link
                  to="/register"
                  className={styles.actionSolid}
                  aria-label={t('home.registerCompany').replace(/\n/g, ' ')}
                >
                  <span className={styles.registerCompanyLabel}>{t('home.registerCompany')}</span>
                </Link>
                <Link to="/login" className={styles.actionGhost}>
                  {t('home.logIn')}
                </Link>
                <Link to="/contact" className={styles.actionGhost}>
                  {t('home.bookDemo')}
                </Link>
              </div>
              <div aria-hidden="true" />
            </div>
            <div className={styles.trustedCompanies}>
              <div className={styles.trustedTrack}>
                {[
                  'Global Logistics',
                  'Apex Pharmacy',
                  'Swift Retail',
                  'HealthCore',
                  'Oceanic Supplies',
                  'Visionary Hotels',
                  'Global Logistics',
                  'Apex Pharmacy',
                  'Swift Retail',
                  'HealthCore',
                  'Oceanic Supplies',
                  'Visionary Hotels',
                ].map((name, i) => (
                  <span key={i} className={styles.trustedLogo}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about-us" className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={styles.wrap}>
          <div className={styles.analytics}>
            <div data-reveal="zoom-in">
              <div className={`${styles.analyticsImage} ${styles.analyticsImageAnimated}`} aria-hidden />
            </div>
            <div data-reveal="slide-right">
              <p className={styles.eyebrow}>{t('home.aboutEyebrow')}</p>
              <p className={styles.copy}>{t('home.aboutP1')}</p>
              <p className={styles.copy}>{t('home.aboutP2')}</p>
              <p className={styles.copy}>{t('home.aboutP3')}</p>
              <p className={styles.copy}>{t('home.aboutP4')}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="stock" className={styles.section}>
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.sectionHeadJustify}`} data-reveal="heading">
            <p className={styles.eyebrow}>{t('home.featuresEyebrow')}</p>
            <h2>{t('home.featuresTitle')}</h2>
          </div>
          <div className={styles.grid3}>
            {featureCards.map((card, index) => (
              <article
                key={card.title}
                className={`${styles.featureCard} ${styles.featureCardAnimated}`}
                data-reveal="card-up"
                style={{ '--reveal-delay': `${index * 130}ms` }}
              >
                <div className={styles.iconBadge}>
                  <FeatureIcon kind={card.icon} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="sectors" className={styles.section}>
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.sectionHeadJustifyEyebrow}`} data-reveal="heading">
            <p className={styles.eyebrow}>{t('home.sectorsEyebrow')}</p>
            <h2>{t('home.sectorsTitle')}</h2>
            <p className={styles.copy}>{t('home.sectorsCopy')}</p>
          </div>
          <div className={styles.filterRow} role="tablist" aria-label="Sector filters" data-reveal="fade-soft">
            {sectorOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={sectorFilter === option.id ? styles.filterActive : styles.filterBtn}
                onClick={() => setSectorFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className={styles.reportRow}>
            {visibleSectors.map((item, index) => (
              <article
                key={`${sectorFilter}-${item.title}`}
                className={`${styles.reportCard} ${styles.reportCardAnimated}`}
                data-reveal="zoom-in"
                style={{ '--reveal-delay': `${index * 110}ms` }}
              >
                <Link to={`/ecosystem/${item.sector}`} className={styles.sectorCardContent}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </Link>
                <Link
                  to={`/register?industry=${item.sector}`}
                  className={styles.sectorCardCta}
                  aria-label={t('home.registerCompany').replace(/\n/g, ' ')}
                >
                  {t('marketing.getStarted')}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ecosystem" className={`${pricingStyles.heroBand} ${styles.homePricingBand}`}>
        <div className={`${pricingStyles.contain} ${styles.homePricingIntro}`}>
          <h2 className={pricingStyles.heroTitle} data-reveal="heading">
            {t('pricing.heroTitle')}
          </h2>
          <p className={pricingStyles.heroSub}>{t('pricing.heroSub')}</p>
          <div
            className={`${pricingStyles.pricingToggleRow} ${pricingStyles.pricingToggleRowOnPrimary}`}
            role="group"
            aria-label={t('pricing.billingAria')}
          >
            <button
              type="button"
              className={homePricingBilling === 'monthly' ? pricingStyles.toggleOn : pricingStyles.toggleOff}
              onClick={() => setHomePricingBilling('monthly')}
            >
              {t('pricing.monthly')}
            </button>
            <button
              type="button"
              className={homePricingBilling === 'annual' ? pricingStyles.toggleOn : pricingStyles.toggleOff}
              onClick={() => setHomePricingBilling('annual')}
            >
              {t('pricing.annual')}
            </button>
            <span className={pricingStyles.saveBadge}>{t('pricing.saveBadge')}</span>
          </div>
        </div>
        <div className={pricingStyles.contain}>
          <div className={pricingStyles.pricingGrid3}>
            {homePricingPlans.map((plan, index) => (
              <article
                key={`${homePricingBilling}-${plan.name}`}
                className={
                  plan.highlight ? `${pricingStyles.priceCard} ${pricingStyles.priceCardHighlight}` : pricingStyles.priceCard
                }
                data-reveal={index === 0 ? 'slide-left' : index === 2 ? 'slide-right' : 'card-up'}
                style={{ '--reveal-delay': `${index * 120}ms` }}
              >
                {plan.highlight ? <span className={pricingStyles.planPill}>{t('pricing.mostPopular')}</span> : null}
                <p className={pricingStyles.tier}>{plan.name}</p>
                <p className={pricingStyles.price}>
                  {plan.isCustom ? (
                    t('pricing.custom')
                  ) : (
                    <span className={pricingStyles.priceMain}>
                      <span className={pricingStyles.priceAmount}>{plan.amount}</span>{' '}
                      <span className={pricingStyles.priceCurrency}>{t('pricing.currencyFrw')}</span>
                    </span>
                  )}
                  {plan.suffix ? <span className={pricingStyles.priceSuffix}>{plan.suffix}</span> : null}
                </p>
                <ul className={pricingStyles.list}>
                  {plan.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <Link
                  to={plan.link}
                  className={`${plan.highlight ? pricingStyles.btnSolid : pricingStyles.btnOutline} ${pricingStyles.priceCardCta}`}
                  aria-label={plan.isCustom ? plan.cta : t('home.registerCompany').replace(/\n/g, ' ')}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
