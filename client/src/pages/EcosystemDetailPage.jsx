import { useParams, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import styles from './MarketingPages.module.css';

export default function EcosystemDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();

  const validIds = ['healthcare', 'hotel', 'retail', 'gov'];
  const ecoId = validIds.includes(id) ? id : 'healthcare';

  const title = t(`ecosystem.${ecoId}.title`);
  const desc = t(`ecosystem.${ecoId}.desc`);
  const points = [
    t(`ecosystem.${ecoId}.p1`),
    t(`ecosystem.${ecoId}.p2`),
    t(`ecosystem.${ecoId}.p3`),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.heroBand}>
        <div className={styles.containNarrow}>
          <Link to="/" className={styles.backHomeBtn} style={{ marginBottom: '2rem' }}>
            {t('pricing.backHome')}
          </Link>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroSub}>{desc}</p>
        </div>
      </div>
      <section className={styles.section}>
        <div className={styles.containNarrow}>
          <ul className={styles.list} style={{ fontSize: '1.1rem', gap: '1rem', display: 'flex', flexDirection: 'column' }}>
            {points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <div style={{ marginTop: '3rem', textAlign: 'center' }}>
            <Link to={`/register?industry=${ecoId}`} className={styles.btnSolid} style={{ padding: '1rem 3rem' }}>
              {t('marketing.getStarted')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
