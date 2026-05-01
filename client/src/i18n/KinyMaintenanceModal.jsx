import { useEffect } from 'react';
import styles from './KinyMaintenanceModal.module.css';

/**
 * Shown when the user chooses Kinyarwanda while that locale is still being completed.
 */
export function KinyMaintenanceModal({ open, onClose, t }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kiny-maint-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="kiny-maint-title" className={styles.title}>
          {t('shell.kinyMaintenanceTitle')}
        </h2>
        <p className={styles.body}>{t('shell.kinyMaintenanceBody')}</p>
        <button type="button" className={styles.btn} onClick={onClose}>
          {t('shell.kinyMaintenanceOk')}
        </button>
      </div>
    </div>
  );
}
