import styles from './EcungaLogo.module.css';

/** Full wordmark for dark UI surfaces (app sidebar, split-login hero). */
const SRC_LIGHT_ON_DARK_BG = '/images/light-logo.png';

/** Full wordmark for light UI surfaces (marketing header, auth cards on light bg). */
const SRC_DARK_ON_LIGHT_BG = '/images/dark-logo.png';

export function EcungaWordmarkSidebar({ className = '' }) {
  return (
    <img
      src={SRC_LIGHT_ON_DARK_BG}
      alt="e-CUNGA"
      className={[styles.sidebarWordmark, className].filter(Boolean).join(' ')}
      decoding="async"
    />
  );
}

/** Switches with `document.documentElement` `data-ec-theme` (light → dark-on-light asset; dark → light-on-dark asset). */
export function EcungaWordmarkAdaptive({ className = '', footer = false, size }) {
  return (
    <span
      className={[styles.adaptiveWrap, footer ? styles.footerWordmark : '', size === 'lg' ? styles.adaptiveLg : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <img src={SRC_DARK_ON_LIGHT_BG} alt="" aria-hidden className={styles.onLightBg} decoding="async" />
      <img src={SRC_LIGHT_ON_DARK_BG} alt="" aria-hidden className={styles.onDarkBg} decoding="async" />
    </span>
  );
}

export function EcungaWordmarkOnDarkPanel({ className = '' }) {
  return (
    <img
      src={SRC_LIGHT_ON_DARK_BG}
      alt="e-CUNGA"
      className={[styles.panelWordmark, className].filter(Boolean).join(' ')}
      decoding="async"
    />
  );
}
