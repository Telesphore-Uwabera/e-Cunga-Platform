import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import { scrollToAnchorById } from '../utils/hashNavigation.js';
import '../theme.css';
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

export default function HomePage() {
  const { t } = useI18n();
  const { hash, pathname } = useLocation();
  const [sectorFilter, setSectorFilter] = useState('all');

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

  const pricingPreview = useMemo(
    () => [
      {
        name: t('home.planStarter'),
        price: '$299',
        note: t('home.planStarterNote'),
        points: [t('home.planPt1'), t('home.planPt2'), t('home.planPt3')],
        accent: 'light',
      },
      {
        name: t('home.planPro'),
        price: '$899',
        note: t('home.planProNote'),
        points: [t('home.planPt4'), t('home.planPt5'), t('home.planPt6')],
        accent: 'strong',
      },
    ],
    [t]
  );

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
              <div className={styles.workspaceStats}>
                <article>
                  <strong>128</strong>
                  <span>{t('home.panelTracked')}</span>
                </article>
                <article>
                  <strong>04</strong>
                  <span>{t('home.panelPending')}</span>
                </article>
                <article>
                  <strong>03</strong>
                  <span>{t('home.panelSupplier')}</span>
                </article>
              </div>
              <div className={styles.workspaceRows}>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>{t('home.rowTrend')}</span>
                  <span className={styles.rowMeta}>{t('home.rowTrendMeta')}</span>
                </div>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>{t('home.rowQueue')}</span>
                  <span className={styles.rowMeta}>{t('home.rowQueueMeta')}</span>
                </div>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>{t('home.rowDocs')}</span>
                  <span className={styles.rowMeta}>{t('home.rowDocsMeta')}</span>
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
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ecosystem" className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead} data-reveal="heading">
            <p className={styles.eyebrow}>{t('home.plansEyebrow')}</p>
            <h2>{t('home.plansTitle')}</h2>
            <p className={styles.copy}>{t('home.plansCopy')}</p>
          </div>
          <div className={styles.pricingPreview}>
            {pricingPreview.map((plan, index) => (
              <article
                key={plan.name}
                className={
                  plan.accent === 'strong'
                    ? `${styles.planCard} ${styles.planCardStrong} ${styles.planCardAnimated}`
                    : `${styles.planCard} ${styles.planCardAnimated}`
                }
                data-reveal={index === 0 ? 'slide-left' : 'slide-right'}
                style={{ '--reveal-delay': `${index * 120}ms` }}
              >
                <p className={styles.planName}>{plan.name}</p>
                <h3 className={styles.planPrice}>{plan.price}</h3>
                <p className={styles.planNote}>{plan.note}</p>
                <ul className={styles.planList}>
                  {plan.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <Link to="/pricing" className={plan.accent === 'strong' ? styles.planSolid : styles.planGhost}>
                  {t('home.viewPlan')}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
