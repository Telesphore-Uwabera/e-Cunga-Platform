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

const OVERVIEW_FALLBACK = {
  trackedItems: 128,
  pendingApprovals: 4,
  supplierActions: 3,
  trendPercent: 12.8,
  queueHealth: 'stable',
  supplierDocPercent: 94,
};

export default function HomePage() {
  const { t } = useI18n();
  const { hash, pathname } = useLocation();
  const [sectorFilter, setSectorFilter] = useState('all');
  const [homePricingBilling, setHomePricingBilling] = useState('monthly');
  const [overview, setOverview] = useState(OVERVIEW_FALLBACK);
  const [overviewLive, setOverviewLive] = useState(false);

  const featureCards = useMemo(
    () => [
      { icon: 'stock', title: t('home.featureTrackingTitle'), copy: t('home.featureTrackingCopy') },
      { icon: 'workflow', title: t('home.featureWorkflowTitle'), copy: t('home.featureWorkflowCopy') },
      { icon: 'control', title: t('home.featureAnalyticsTitle'), copy: t('home.featureAnalyticsCopy') },
    ],
    [t]
  );

  const reportPoints = useMemo(
    () => [
      { title: t('home.report1Title'), body: t('home.report1Body') },
      { title: t('home.report2Title'), body: t('home.report2Body') },
      { title: t('home.report3Title'), body: t('home.report3Body') },
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
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(resolveApiUrl('/api/public/home-stats'));
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || typeof data !== 'object' || data == null) return;
        setOverview({
          trackedItems: Number(data.trackedItems) || 0,
          pendingApprovals: Number(data.pendingApprovals) || 0,
          supplierActions: Number(data.supplierActions) || 0,
          trendPercent: typeof data.trendPercent === 'number' ? data.trendPercent : null,
          queueHealth: ['stable', 'busy', 'elevated'].includes(data.queueHealth) ? data.queueHealth : 'stable',
          supplierDocPercent: typeof data.supplierDocPercent === 'number' ? data.supplierDocPercent : null,
        });
        setOverviewLive(true);
      } catch {
        /* keep fallback when API is off or unreachable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const queueHealthLabel = useMemo(() => {
    const key =
      overview.queueHealth === 'busy'
        ? 'home.queueHealthBusy'
        : overview.queueHealth === 'elevated'
          ? 'home.queueHealthElevated'
          : 'home.queueHealthStable';
    return t(key);
  }, [overview.queueHealth, t]);

  const trendLabel = useMemo(() => {
    if (overview.trendPercent == null) {
      return overviewLive ? t('home.rowTrendNoData') : t('home.rowTrendMeta');
    }
    const p = overview.trendPercent;
    const sign = p > 0 ? '+' : '';
    return `${sign}${p}%`;
  }, [overview.trendPercent, overviewLive, t]);

  const docCompletionLabel = useMemo(() => {
    if (overview.supplierDocPercent == null) {
      return overviewLive ? t('home.rowDocsNoData') : t('home.rowDocsMeta');
    }
    return `${overview.supplierDocPercent}%`;
  }, [overview.supplierDocPercent, overviewLive, t]);

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
  }, []);

  const visibleSectors = useMemo(() => {
    if (sectorFilter === 'all') return sectorCards;
    return sectorCards.filter((card) => card.sector === sectorFilter);
  }, [sectorFilter, sectorCards]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.wrap}>
          <div className={styles.heroCopy} data-reveal="hero-left">
            <p className={styles.eyebrow}>{t('home.heroEyebrow')}</p>
            <h1 className={styles.title}>{t('home.heroTitle')}</h1>
            <p className={styles.lead}>{t('home.heroLead')}</p>
            <div className={styles.heroActions}>
              <Link to="/register" className={styles.actionSolid}>
                {t('home.registerCompany')}
              </Link>
              <Link to="/login" className={styles.actionGhost}>
                {t('home.logIn')}
              </Link>
              <Link to="/contact" className={styles.actionGhost}>
                {t('home.bookDemo')}
              </Link>
            </div>
            <div className={styles.heroMeta}>
              <strong>{t('home.heroMetaStrong')}</strong>
              <span>{t('home.heroMeta')}</span>
            </div>
          </div>
          <div className={styles.heroPanel} data-reveal="hero-right">
            <div className={`${styles.workspaceCard} ${styles.workspaceCardAnimated}`}>
              <div className={styles.workspaceHead}>
                <div>
                  <p className={styles.workspaceLabel}>{t('home.panelLabel')}</p>
                  <h2 className={styles.workspaceTitle}>{t('home.panelTitle')}</h2>
                </div>
                <span className={styles.workspaceTag}>{t('home.panelLive')}</span>
              </div>
              <div className={styles.workspaceStats} aria-live={overviewLive ? 'polite' : undefined}>
                <article>
                  <strong>{overview.trackedItems}</strong>
                  <span>{t('home.panelTracked')}</span>
                </article>
                <article>
                  <strong>{overview.pendingApprovals}</strong>
                  <span>{t('home.panelPending')}</span>
                </article>
                <article>
                  <strong>{overview.supplierActions}</strong>
                  <span>{t('home.panelSupplier')}</span>
                </article>
              </div>
              <div className={styles.workspaceRows}>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>{t('home.rowTrend')}</span>
                  <span className={styles.rowMeta}>{trendLabel}</span>
                </div>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>{t('home.rowQueue')}</span>
                  <span className={styles.rowMeta}>{queueHealthLabel}</span>
                </div>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>{t('home.rowDocs')}</span>
                  <span className={styles.rowMeta}>{docCompletionLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead} data-reveal="heading">
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

      <section id="analytics" className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={styles.wrap}>
          <div className={styles.analytics}>
            <div data-reveal="zoom-in">
              <div className={`${styles.analyticsImage} ${styles.analyticsImageAnimated}`} aria-hidden />
            </div>
            <div data-reveal="slide-right">
              <p className={styles.eyebrow}>{t('home.analyticsEyebrow')}</p>
              <h2>{t('home.analyticsTitle')}</h2>
              <p className={styles.copy}>{t('home.analyticsCopy')}</p>
              <ul className={styles.pointList}>
                {reportPoints.map((item, index) => (
                  <li
                    key={item.title}
                    className={`${styles.pointItem} ${styles.pointItemAnimated}`}
                    data-reveal="card-up"
                    style={{ '--reveal-delay': `${index * 120}ms` }}
                  >
                    <span className={styles.pointIcon}>
                      <FeatureIcon kind="control" />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="reports" className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead} data-reveal="heading">
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
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <Link to="/register" className={styles.sectorCardCta} aria-label={t('home.registerCompany')}>
                  {t('marketing.getStarted')}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ecosystem" className={`${pricingStyles.heroBand} ${styles.homePricingBand}`}>
        <div className={pricingStyles.containNarrow}>
          <h2 className={pricingStyles.heroTitle} data-reveal="heading">
            {t('pricing.heroTitle')}
          </h2>
          <p className={pricingStyles.heroSub}>{t('pricing.heroSub')}</p>
          <div className={pricingStyles.pricingToggleRow} role="group" aria-label={t('pricing.billingAria')}>
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
                  aria-label={plan.isCustom ? plan.cta : t('home.registerCompany')}
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
