import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import '../theme.css';
import styles from './MarketingPages.module.css';

const LEGAL_KEYS = {
  privacy: {
    title: 'legal.privacyTitle',
    updated: 'legal.privacyUpdated',
    paragraphs: ['legal.privacyP1', 'legal.privacyP2', 'legal.privacyP3'],
  },
  terms: {
    title: 'legal.termsTitle',
    updated: 'legal.termsUpdated',
    paragraphs: ['legal.termsP1', 'legal.termsP2', 'legal.termsP3'],
  },
  cookies: {
    title: 'legal.cookiesTitle',
    updated: 'legal.cookiesUpdated',
    paragraphs: ['legal.cookiesP1', 'legal.cookiesP2', 'legal.cookiesP3'],
  },
};

export default function LegalNoticePage({ doc }) {
  const { t } = useI18n();
  const cfg = LEGAL_KEYS[doc] || LEGAL_KEYS.privacy;

  return (
    <div className={styles.page}>
      <section className={styles.heroBand}>
        <div className={styles.containNarrow}>
          <p className={styles.contactEyebrow}>e-CUNGA</p>
          <h1 className={styles.contactTitle}>{t(cfg.title)}</h1>
          <p className={styles.heroSub} style={{ textAlign: 'center' }}>
            {t(cfg.updated)}
          </p>
        </div>
      </section>
      <div className={styles.contain} style={{ maxWidth: '42rem', margin: '0 auto 3rem' }}>
        <div className={styles.formLead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', lineHeight: 1.6 }}>
          {cfg.paragraphs.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
        </div>
        <div className={styles.backHomeRow} style={{ marginTop: '1.5rem' }}>
          <Link to="/" className={styles.backHomeBtn}>
            {t('pricing.backHome')}
          </Link>
          <Link to="/contact" className={styles.backHomeBtn} style={{ marginLeft: '0.75rem' }}>
            {t('marketing.navContact')}
          </Link>
        </div>
      </div>
    </div>
  );
}
