/**
 * FlashMessage — lightweight in-app toast notification.
 * Usage:
 *   const { flash, FlashBanner } = useFlash();
 *   flash('Saved successfully!', 'ok');   // 'ok' | 'error' | 'warn'
 *   return <><FlashBanner /><YourForm /></>
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './FlashMessage.module.css';

export function FlashMessage({ message, tone = 'ok', onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`${styles.flash} ${tone === 'error' ? styles.flashError : tone === 'warn' ? styles.flashWarn : styles.flashOk}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.flashIcon}>
        {tone === 'error' ? '✕' : tone === 'warn' ? '⚠' : '✓'}
      </span>
      <span className={styles.flashText}>{message}</span>
      <button type="button" className={styles.flashClose} onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

export function useFlash() {
  const [state, setState] = useState({ message: '', tone: 'ok' });
  const timerRef = useRef(null);

  const flash = useCallback((message, tone = 'ok') => {
    clearTimeout(timerRef.current);
    setState({ message, tone });
  }, []);

  const dismiss = useCallback(() => setState({ message: '', tone: 'ok' }), []);

  const FlashBanner = useCallback(
    () => <FlashMessage message={state.message} tone={state.tone} onDismiss={dismiss} />,
    [state, dismiss]
  );

  return { flash, showFlash: flash, FlashBanner, dismiss };
}
