import styles from './EcungaLogo.module.css';

/** Full wordmark for dark UI surfaces (app sidebar, split-login hero). */
const SRC_LIGHT_ON_DARK_BG = '/images/light-logo.png';

/** Full wordmark for light UI surfaces (marketing header, auth cards on light bg). */
const SRC_DARK_ON_LIGHT_BG = '/images/dark-logo.png';

export function EcungaWordmarkSidebar({ className = '' }) {
  return <EcungaWordmarkAdaptive className={className} size="lg" centered />;
}

export function EcungaWordmarkLight({ className = '', size, footer = false }) {
  return (
    <img
      src={SRC_LIGHT_ON_DARK_BG}
      alt=""
      aria-hidden
      decoding="async"
      className={[
        styles.landingLightWordmark,
        footer ? styles.landingLightWordmarkFooter : '',
        size === 'lg' ? styles.landingLightWordmarkLg : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

/** Switches with `document.documentElement` `data-ec-theme` (light → dark-on-light asset; dark → light-on-dark asset). */
export function EcungaWordmarkAdaptive({ className = '', footer = false, size, centered = false, ariaLabel = 'e-CUNGA' }) {
  const a11y = centered ? { role: 'img', 'aria-label': ariaLabel } : {};
  return (
    <span
      {...a11y}
      className={[
        styles.adaptiveWrap,
        centered ? styles.adaptiveCentered : '',
        footer ? styles.footerWordmark : '',
        size === 'lg' ? styles.adaptiveLg : '',
        className,
      ]
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
