import EcungaWordmarkSvg from './EcungaWordmarkSvg.jsx';
import styles from './EcungaLogo.module.css';

/** Light-on-dark wordmark (sidebar, dark hero panels). */
export function EcungaWordmarkSidebar({ className = '' }) {
  return <EcungaWordmarkAdaptive className={className} size="lg" centered />;
}

export function EcungaWordmarkLight({ className = '', size, footer = false }) {
  return (
    <EcungaWordmarkSvg
      variant="onDark"
      decorative
      className={[
        styles.wordmarkSvg,
        footer ? styles.wordmarkSvgFooter : '',
        size === 'lg' ? styles.wordmarkSvgLg : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

/** Dark-on-light wordmark (marketing header, auth on paper). */
export function EcungaWordmarkOnLightSurface({ className = '', size, footer = false }) {
  return (
    <EcungaWordmarkSvg
      variant="onLight"
      decorative
      className={[
        styles.wordmarkSvg,
        footer ? styles.wordmarkSvgFooter : '',
        size === 'lg' ? styles.wordmarkSvgLg : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

/** Theme-aware: light surfaces vs dark chrome (`data-ec-theme`). */
export function EcungaWordmarkAdaptive({
  className = '',
  footer = false,
  size,
  centered = false,
  ariaLabel = 'e-Cunga Portal',
}) {
  const wrapA11y = centered ? { role: 'img', 'aria-label': ariaLabel } : {};

  const cls = [
    styles.adaptiveWrap,
    centered ? styles.adaptiveCentered : '',
    footer ? styles.footerWordmark : '',
    size === 'lg' ? styles.adaptiveLg : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span {...wrapA11y} className={cls}>
      <EcungaWordmarkSvg
        variant="onLight"
        decorative
        className={[styles.wordmarkSvg, styles.onLightBg].filter(Boolean).join(' ')}
      />
      <EcungaWordmarkSvg
        variant="onDark"
        decorative
        className={[styles.wordmarkSvg, styles.onDarkBg].filter(Boolean).join(' ')}
      />
    </span>
  );
}

export function EcungaWordmarkOnDarkPanel({ className = '' }) {
  return (
    <EcungaWordmarkSvg
      variant="onDark"
      decorative
      className={[styles.wordmarkSvg, styles.panelWordmark, className].filter(Boolean).join(' ')}
    />
  );
}

/** Sidebar: lettermark only (no word text, no monogram box). Uses `currentColor`. */
export function EcungaSidebarIcon({ className = '' }) {
  return (
    <svg
      className={className}
      width={36}
      height={36}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="e-Cunga Portal"
    >
      <path
        fill="currentColor"
        d="M10 9L22 9 22 11.5 13 11.5 13 14.25 20 14.25 20 16.75 13 16.75 13 19.5 22 19.5 22 22 10 22Z"
      />
    </svg>
  );
}
