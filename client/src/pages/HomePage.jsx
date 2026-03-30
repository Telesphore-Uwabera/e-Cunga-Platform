import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

const featureCards = [
  {
    icon: 'stock',
    title: 'Smart tracking',
    copy: 'Monitor quantities, low-stock pressure, and movement updates without disconnected files.',
  },
  {
    icon: 'workflow',
    title: 'Role workflow',
    copy: 'Move every request across clerk, supervisor, accountant, admin, and supplier with accountability.',
  },
  {
    icon: 'control',
    title: 'Actionable analytics',
    copy: 'Use reporting, alerts, and supplier status visibility to make better operational decisions.',
  },
];

const reportPoints = [
  {
    title: 'Forecast demand using historical movement',
    body: 'See which locations are consuming faster and which items are getting close to critical minimum.',
  },
  {
    title: 'Reduce approval bottlenecks',
    body: 'Keep requisitions, proformas, and payment visibility inside one decision channel.',
  },
  {
    title: 'Protect audit readiness',
    body: 'Every approval note, delivery file, and final invoice stays attached to the same lifecycle.',
  },
];

const sectorOptions = [
  { id: 'all', label: 'All sectors' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'retail', label: 'Retail' },
  { id: 'public', label: 'Public institutions' },
];

const sectorCards = [
  {
    sector: 'healthcare',
    title: 'Hospitals & clinics',
    body: 'Track medicines, consumables, and departmental requests with better expiry and replenishment control.',
  },
  {
    sector: 'hospitality',
    title: 'Hotels & service operations',
    body: 'Keep housekeeping, maintenance, and back-of-house supply flow visible across teams and branches.',
  },
  {
    sector: 'retail',
    title: 'Retail & wholesale',
    body: 'Improve stock movement visibility, reorder discipline, and branch-level accountability.',
  },
  {
    sector: 'public',
    title: 'Government & institutions',
    body: 'Standardize requisition approvals, reporting, and supplier documentation in one secure platform.',
  },
];

const pricingPreview = [
  {
    name: 'Starter',
    price: '$299',
    note: 'For one location or one warehouse team',
    points: ['Stock registration and low-stock alerts', 'Role-based access for core staff', 'Onboarding and reporting setup'],
    accent: 'light',
  },
  {
    name: 'Professional',
    price: '$899',
    note: 'For multi-location institutions with deeper workflow needs',
    points: ['Full requisition-to-supplier workflow', 'Advanced analytics and reporting', 'Broader rollout across operations and finance'],
    accent: 'strong',
  },
];

export default function HomePage() {
  const { hash, pathname } = useLocation();
  const [sectorFilter, setSectorFilter] = useState('all');

  useEffect(() => {
    if (pathname !== '/') return;
    const id = hash.replace(/^#/, '').trim();
    if (!id) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 32);
    return () => window.clearTimeout(timer);
  }, [hash, pathname]);

  const visibleSectors = useMemo(() => {
    if (sectorFilter === 'all') return sectorCards;
    return sectorCards.filter((card) => card.sector === sectorFilter);
  }, [sectorFilter]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.wrap}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AI-powered inventory platform</p>
            <h1 className={styles.title}>AI-Powered Inventory at Your Fingertips</h1>
            <p className={styles.lead}>
              e-CUNGA gives modern institutions one place to monitor stock, coordinate approvals, follow supplier
              actions, and keep every inventory workflow visible in real time.
            </p>
            <div className={styles.heroActions}>
              <Link to="/register" className={styles.actionSolid}>
                Get Started
              </Link>
              <Link to="/contact" className={styles.actionGhost}>
                Book Demo
              </Link>
            </div>
            <div className={styles.heroMeta}>
              <strong>600+</strong>
              <span>workflow events tracked weekly in active demo operations</span>
            </div>
          </div>
          <div className={styles.heroPanel}>
            <div className={styles.workspaceCard}>
              <div className={styles.workspaceHead}>
                <div>
                  <p className={styles.workspaceLabel}>Inventory overview</p>
                  <h2 className={styles.workspaceTitle}>Control board snapshot</h2>
                </div>
                <span className={styles.workspaceTag}>Live</span>
              </div>
              <div className={styles.workspaceStats}>
                <article>
                  <strong>128</strong>
                  <span>Tracked items</span>
                </article>
                <article>
                  <strong>04</strong>
                  <span>Pending approvals</span>
                </article>
                <article>
                  <strong>03</strong>
                  <span>Supplier actions</span>
                </article>
              </div>
              <div className={styles.workspaceRows}>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>Inventory value trend</span>
                  <span className={styles.rowMeta}>+12.8%</span>
                </div>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>Approval queue health</span>
                  <span className={styles.rowMeta}>Stable</span>
                </div>
                <div className={styles.workspaceRow}>
                  <span className={styles.rowLabel}>Supplier document completion</span>
                  <span className={styles.rowMeta}>94%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Everything you need</p>
            <h2>Everything you need to monitor your stock</h2>
          </div>
          <div className={styles.grid3}>
            {featureCards.map((card) => (
              <article key={card.title} className={styles.featureCard}>
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
            <div>
              <div className={styles.analyticsImage} aria-hidden />
            </div>
            <div>
              <p className={styles.eyebrow}>Precision analytics</p>
              <h2>Precision Analytics for Smarter Operations</h2>
              <p className={styles.copy}>
                Turn inventory activity into practical intelligence for planning, replenishment, operational control, and
                leadership reporting.
              </p>
              <ul className={styles.pointList}>
                {reportPoints.map((item) => (
                  <li key={item.title} className={styles.pointItem}>
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
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Built for the ecosystem</p>
            <h2>Built for the Whole Ecosystem</h2>
            <p className={styles.copy}>
              Filter the view by sector and see how the platform supports different operating environments.
            </p>
          </div>
          <div className={styles.filterRow} role="tablist" aria-label="Sector filters">
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
            {visibleSectors.map((item) => (
              <article key={item.title} className={styles.reportCard}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ecosystem" className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Flexible plans</p>
            <h2>Flexible Plans for Growth</h2>
            <p className={styles.copy}>Choose the rollout that matches your current stock complexity and team size.</p>
          </div>
          <div className={styles.pricingPreview}>
            {pricingPreview.map((plan) => (
              <article
                key={plan.name}
                className={plan.accent === 'strong' ? `${styles.planCard} ${styles.planCardStrong}` : styles.planCard}
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
                  View plan
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
