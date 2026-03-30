import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../theme.css';
import styles from './MarketingPages.module.css';

export default function PricingPage() {
  const [billing, setBilling] = useState('monthly');
  const { hash } = useLocation();

  useEffect(() => {
    if (hash === '#faq') {
      document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash]);

  return (
    <div className={styles.page}>
      <header className={styles.heroBand}>
        <div className={styles.contain}>
          <h1 className={styles.heroTitle}>Flexible Pricing for Automated Inventory Control</h1>
          <p className={styles.heroSub}>
            Affordable plans for businesses, hospitals, hotels, clinics, agribusinesses, and institutions that want
            fewer stock errors, real-time visibility, and connected staff workflow.
          </p>
          <div className={styles.toggleRow} role="group" aria-label="Billing period">
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
            <article className={styles.priceCard}>
              <p className={styles.tier}>Starter</p>
              <p className={styles.price}>
                $29<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ec-muted)' }}>/mo</span>
              </p>
              <ul className={styles.list}>
                <li>1 location with stock registration</li>
                <li>Auto alerts and activity history</li>
                <li>Email onboarding support</li>
              </ul>
              <Link to="/register" className={styles.btnOutline}>
                Get started
              </Link>
            </article>
            <article className={`${styles.priceCard} ${styles.priceCardHighlight}`}>
              <p className={styles.tier}>Professional</p>
              <p className={styles.price}>
                $79<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ec-muted)' }}>/mo</span>
              </p>
              <ul className={styles.list}>
                <li>Up to 5 warehouses or departments</li>
                <li>Full RBAC for clerk, supervisor, accountant, supplier</li>
                <li>Auto alerts, auto requisitions, and workflow visibility</li>
              </ul>
              <Link to="/register" className={styles.btnSolid}>
                Start implementation
              </Link>
            </article>
            <article className={styles.priceCard}>
              <p className={styles.tier}>Enterprise</p>
              <p className={styles.price} style={{ fontSize: '1.5rem', paddingTop: '0.5rem' }}>
                Let&apos;s talk
              </p>
              <ul className={styles.list}>
                <li>Unlimited scale for multi-branch institutions</li>
                <li>Custom reporting and governance support</li>
                <li>Dedicated supplier and finance workflow setup</li>
              </ul>
              <Link to="/contact" className={styles.btnOutline}>
                Contact Us
              </Link>
            </article>
          </div>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.contain}>
          <div className={styles.splitFeature}>
            <div className={styles.featureVisual} aria-hidden />
            <div className={styles.featureCopy}>
              <h2>Built for Real Inventory Pressure</h2>
              <p>
                From stock registration to final invoice attachment, e-CUNGA reduces manual workload, improves
                transparency, and keeps every stage of the channel workflow visible to the right staff member.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className={styles.sectionMuted}>
        <div className={styles.containNarrow}>
          <h2 className={styles.heroTitle} style={{ textAlign: 'center' }}>
            Frequently Asked Questions
          </h2>
          <div className={styles.faq}>
            <details className={styles.faqItem}>
              <summary>Who is e-CUNGA built for?</summary>
              <p>It is designed for medium and large enterprises, hospitals, clinics, hotels, industries, and agribusiness teams managing high stock volume.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>What problems does the platform solve?</summary>
              <p>It reduces human error, delayed restocking, poor expiry tracking, theft concerns, and manual reporting workload through one connected portal.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>Does e-CUNGA support multiple companies?</summary>
              <p>Each registration is its own company workspace with isolated users, stock, and audit logs.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>How does the role workflow work?</summary>
              <p>Inventory Clerk creates requests, Supervisor approves, Accountant handles payment approval, and Supplier attaches delivery and invoice documents inside the same channel.</p>
            </details>
          </div>
          <p style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/">← Back to home</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
