import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import { buildPricingPlans } from '../utils/buildPricingPlans.js';
import { scrollToAnchorById } from '../utils/hashNavigation.js';
import '../theme.css';
import styles from './MarketingPages.module.css';

export default function PricingPage() {
  const { t } = useI18n();
  const location = useLocation();
  const [billing, setBilling] = useState('monthly');

  const plans = useMemo(() => buildPricingPlans(t, billing), [billing, t]);

  useEffect(() => {
    if (location.hash !== '#faq') return;
    const id = window.setTimeout(() => scrollToAnchorById('faq'), 0);
    return () => clearTimeout(id);
  }, [location.pathname, location.hash]);

  return (
    <div className={styles.page}>
      <header className={styles.heroBand}>
        <div className={styles.containNarrow}>
          <h1 className={styles.heroTitle}>{t('pricing.heroTitle')}</h1>
          <p className={styles.heroSub}>{t('pricing.heroSub')}</p>
          <div className={styles.pricingToggleRow} role="group" aria-label={t('pricing.billingAria')}>
            <button
              type="button"
              className={billing === 'monthly' ? styles.toggleOn : styles.toggleOff}
              onClick={() => setBilling('monthly')}
            >
              {t('pricing.monthly')}
            </button>
            <button
              type="button"
              className={billing === 'annual' ? styles.toggleOn : styles.toggleOff}
              onClick={() => setBilling('annual')}
            >
              {t('pricing.annual')}
            </button>
            <span className={styles.saveBadge}>{t('pricing.saveBadge')}</span>
          </div>
        </div>
        <div className={styles.contain}>
          <div className={styles.pricingGrid3}>
            {plans.map((plan) => (
              <article
                key={`${billing}-${plan.name}`}
                className={plan.highlight ? `${styles.priceCard} ${styles.priceCardHighlight}` : styles.priceCard}
              >
                {plan.highlight ? <span className={styles.planPill}>{t('pricing.mostPopular')}</span> : null}
                <p className={styles.tier}>{plan.name}</p>
                <p className={styles.price}>
                  {plan.isCustom ? (
                    t('pricing.custom')
                  ) : (
                    <span className={styles.priceMain}>
                      <span className={styles.priceAmount}>{plan.amount}</span>{' '}
                      <span className={styles.priceCurrency}>{t('pricing.currencyFrw')}</span>
                    </span>
                  )}
                  {plan.suffix ? <span className={styles.priceSuffix}>{plan.suffix}</span> : null}
                </p>
                <ul className={styles.list}>
                  {plan.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <Link
                  to={plan.link}
                  className={`${plan.highlight ? styles.btnSolid : styles.btnOutline} ${styles.priceCardCta}`}
                >
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
                <strong>{t('pricing.quoteStrong')}</strong>
                <span>{t('pricing.quoteMeta')}</span>
              </div>
            </div>
            <div className={styles.featureCopy}>
              <h2>{t('pricing.featureTitle')}</h2>
              <p>{t('pricing.featureCopy')}</p>
              <div className={styles.featureMiniGrid}>
                <article className={styles.featureMiniCard}>
                  <h3>{t('pricing.mini1Title')}</h3>
                  <p>{t('pricing.mini1Copy')}</p>
                </article>
                <article className={styles.featureMiniCard}>
                  <h3>{t('pricing.mini2Title')}</h3>
                  <p>{t('pricing.mini2Copy')}</p>
                </article>
              </div>
              <Link to="/contact" className={styles.featureLink}>
                {t('pricing.exploreLink')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className={styles.sectionMuted} aria-labelledby="pricing-faq-heading">
        <div className={styles.containNarrow}>
          <h2 id="pricing-faq-heading" className={styles.pricingFaqTitle}>
            {t('pricing.faqTitle')}
          </h2>
          <div className={styles.pricingFaqList}>
            <details className={styles.faqItem}>
              <summary>{t('pricing.faq1q')}</summary>
              <p>{t('pricing.faq1a')}</p>
            </details>
            <details className={styles.faqItem}>
              <summary>{t('pricing.faq2q')}</summary>
              <p>{t('pricing.faq2a')}</p>
            </details>
          </div>
          <div className={styles.backHomeRow}>
            <Link to="/" className={styles.backHomeBtn}>
              {t('pricing.backHome')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
