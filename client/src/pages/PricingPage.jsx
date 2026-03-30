import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../theme.css';
import styles from './MarketingPages.module.css';

export default function PricingPage() {
  const [billing, setBilling] = useState('monthly');

  const plans = useMemo(() => {
    if (billing === 'annual') {
      return [
        {
          name: 'Essential',
          price: '$290',
          suffix: '/yr',
          points: ['Up to 500 inventory items', 'Single warehouse ledger', 'Basic analytics reports'],
          cta: 'Start Free Trial',
          link: '/register',
          highlight: false,
        },
        {
          name: 'Professional',
          price: '$790',
          suffix: '/yr',
          points: ['Unlimited inventory items', 'Multi-location management', 'Advanced AI insights', 'Full access & integrations'],
          cta: 'Get Started Now',
          link: '/register',
          highlight: true,
        },
        {
          name: 'Enterprise',
          price: 'Custom',
          suffix: '',
          points: ['Dedicated support manager', 'Custom feature development', 'SLA & private instance', 'Single sign-on / RBAC+'],
          cta: 'Contact Sales',
          link: '/contact',
          highlight: false,
        },
      ];
    }

    return [
      {
        name: 'Essential',
        price: '$29',
        suffix: '/mo',
        points: ['Up to 500 inventory items', 'Single warehouse ledger', 'Basic analytics reports'],
        cta: 'Start Free Trial',
        link: '/register',
        highlight: false,
      },
      {
        name: 'Professional',
        price: '$79',
        suffix: '/mo',
        points: ['Unlimited inventory items', 'Multi-location management', 'Advanced AI insights', 'Full access & integrations'],
        cta: 'Get Started Now',
        link: '/register',
        highlight: true,
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        suffix: '',
        points: ['Dedicated support manager', 'Custom feature development', 'SLA & private instance', 'Single sign-on / RBAC+'],
        cta: 'Contact Sales',
        link: '/contact',
        highlight: false,
      },
    ];
  }, [billing]);

  return (
    <div className={styles.page}>
      <header className={styles.heroBand}>
        <div className={styles.containNarrow}>
          <h1 className={styles.heroTitle}>Precision Pricing for Digital Curators</h1>
          <p className={styles.heroSub}>
            Transform your inventory management from spreadsheets to an intelligent ledger. Choose the plan that scales
            with your ambition.
          </p>
          <div className={styles.pricingToggleRow} role="group" aria-label="Billing period">
            <button
              type="button"
              className={billing === 'monthly' ? styles.toggleOn : styles.toggleOff}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billing === 'annual' ? styles.toggleOn : styles.toggleOff}
              onClick={() => setBilling('annual')}
            >
              Annual
            </button>
            <span className={styles.saveBadge}>Save 20%</span>
          </div>
          <div className={styles.pricingGrid3}>
            {plans.map((plan) => (
              <article
                key={`${billing}-${plan.name}`}
                className={plan.highlight ? `${styles.priceCard} ${styles.priceCardHighlight}` : styles.priceCard}
              >
                {plan.highlight ? <span className={styles.planPill}>Most Popular</span> : null}
                <p className={styles.tier}>{plan.name}</p>
                <p className={styles.price}>
                  {plan.price}
                  {plan.suffix ? <span className={styles.priceSuffix}>{plan.suffix}</span> : null}
                </p>
                <ul className={styles.list}>
                  {plan.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <Link to={plan.link} className={plan.highlight ? styles.btnSolid : styles.btnOutline}>
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.contain}>
          <div className={styles.pricingFeatureGrid}>
            <div className={styles.featureShowcase}>
              <div className={styles.featureVisual} aria-hidden />
              <div className={styles.featureOverlay}>
                <strong>e-CUNGA reduced overstock by 42% in the first quarter.</strong>
                <span>Logistics Director, Global Retail Co</span>
              </div>
            </div>
            <div className={styles.featureCopy}>
              <h2>Curated Features for Modern Logistics</h2>
              <p>
                Every plan keeps your teams connected across inventory, approvals, replenishment, supplier paperwork,
                and executive reporting.
              </p>
              <div className={styles.featureMiniGrid}>
                <article className={styles.featureMiniCard}>
                  <h3>Centralized Hub</h3>
                  <p>Sync all your sales channels into one source of truth.</p>
                </article>
                <article className={styles.featureMiniCard}>
                  <h3>Predictive IQ</h3>
                  <p>Know what to reorder before you even run out.</p>
                </article>
              </div>
              <Link to="/contact" className={styles.featureLink}>
                Explore all 150+ features →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.sectionMuted}>
        <div className={styles.containNarrow}>
          <h2 className={styles.pricingFaqTitle}>Frequently Asked Questions</h2>
          <div className={styles.pricingFaqList}>
            <details className={styles.faqItem}>
              <summary>Can I switch plans anytime?</summary>
              <p>You can upgrade as your inventory operations grow, and our team will help migrate your workflows smoothly.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>Do you offer custom onboarding?</summary>
              <p>Yes. Professional and Enterprise rollouts include guided setup for roles, warehouses, approval routes, and reporting needs.</p>
            </details>
          </div>
          <div className={styles.backHomeRow}>
            <Link to="/" className={styles.backHomeBtn}>
              ← Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
