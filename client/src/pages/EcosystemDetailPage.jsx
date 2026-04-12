import { useParams, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import styles from './MarketingPages.module.css';

const ECO_DETAILS = {
  healthcare: {
    title: 'Hospitals & clinics',
    desc: 'Full supply chain visibility for medicines, consumables, and surgical equipment.',
    points: [
      'Expiry date tracking and automated alerts.',
      'Departmental requisition workflows.',
      'Verified medicinal supplier directory.',
    ],
  },
  hotel: {
    title: 'Hotels & service operations',
    desc: 'Keep housekeeping, maintenance, and back-of-house supply flow visible across teams.',
    points: [
      'Real-time linen and guest amenity tracking.',
      'Procurement automation for recurring orders.',
      'Internal requisition system for staff.',
    ],
  },
  retail: {
    title: 'Retail & wholesale',
    desc: 'Improve stock movement visibility, reorder discipline, and branch-level accountability.',
    points: [
      'Multi-branch stock consolidation.',
      'B2B supplier connection and price comparison.',
      'Loss tracking and audit trails.',
    ],
  },
  gov: {
    title: 'Government & institutions',
    desc: 'Standardize requisition approvals, reporting, and supplier documentation in one secure portal.',
    points: [
      'Digital sign-off for budgetary control.',
      'Auditable reporting for compliance.',
      'Centralized vendor management.',
    ],
  },
};

export default function EcosystemDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const detail = ECO_DETAILS[id] || ECO_DETAILS.healthcare;

  return (
    <div className={styles.page}>
      <div className={styles.heroBand}>
        <div className={styles.containNarrow}>
          <Link to="/" className={styles.backHomeBtn} style={{ marginBottom: '2rem' }}>
            {t('pricing.backHome')}
          </Link>
          <h1 className={styles.heroTitle}>{detail.title}</h1>
          <p className={styles.heroSub}>{detail.desc}</p>
        </div>
      </div>
      <section className={styles.section}>
        <div className={styles.containNarrow}>
          <ul className={styles.list} style={{ fontSize: '1.1rem', gap: '1rem', display: 'flex', flexDirection: 'column' }}>
            {detail.points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <div style={{ marginTop: '3rem', textAlign: 'center' }}>
            <Link to={`/register?industry=${id}`} className={styles.btnSolid} style={{ padding: '1rem 3rem' }}>
              {t('marketing.getStarted')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
