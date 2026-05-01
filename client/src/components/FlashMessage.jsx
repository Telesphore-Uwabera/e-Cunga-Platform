/**
 * Toast UI — driven by FlashProvider + useFlash() / GlobalFlashBanner in AppShell.
 * Tones: ok (green), warn (amber), error (red), loading (amber + spinner).
 */
import styles from './FlashMessage.module.css';

export function FlashMessage({ message, tone = 'ok', onDismiss }) {
  if (!message) return null;

  const t = tone === 'error' ? 'error' : tone === 'warn' ? 'warn' : tone === 'loading' ? 'loading' : 'ok';
  const cls =
    t === 'error' ? styles.flashError : t === 'warn' ? styles.flashWarn : t === 'loading' ? styles.flashLoading : styles.flashOk;

  return (
    <div className={`${styles.flash} ${cls}`} role="status" aria-live="polite">
      <span className={styles.flashIcon} aria-hidden>
        {t === 'loading' ? <span className={styles.flashSpinner} /> : t === 'error' ? '✕' : t === 'warn' ? '⚠' : '✓'}
      </span>
      <span className={styles.flashText}>{message}</span>
      <button type="button" className={styles.flashClose} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
