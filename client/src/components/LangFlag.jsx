/** Decorative flag for language toggles (GB = English, RW = Kinyarwanda). */
export default function LangFlag({ lang, className }) {
  const emoji = lang === 'eng' ? '🇬🇧' : '🇷🇼';
  return (
    <span className={className} aria-hidden>
      {emoji}
    </span>
  );
}
