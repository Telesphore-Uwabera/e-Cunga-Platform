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
  ariaLabel = 'e-CUNGA',
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
