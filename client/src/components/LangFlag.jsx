import styles from './LangFlag.module.css';

function FlagUk({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 60 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="9" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="5" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="15" />
      <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="9" />
    </svg>
  );
}

function FlagRw({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 3 2"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="3" height="0.667" y="0" fill="#00A1DE" />
      <rect width="3" height="0.667" y="0.667" fill="#FAD201" />
      <rect width="3" height="0.666" y="1.334" fill="#20603D" />
    </svg>
  );
}

/** SVG flags for language toggles (UK ≈ English, Rwanda ≈ Kinyarwanda). */
export default function LangFlag({ lang, className = '' }) {
  const Flag = lang === 'eng' ? FlagUk : FlagRw;
  return (
    <span className={[styles.wrap, className].filter(Boolean).join(' ')} aria-hidden>
      <Flag className={styles.flag} />
    </span>
  );
}
