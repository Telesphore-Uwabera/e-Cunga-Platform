/** Social icons for split auth hero (login + register). */
function SocialIcon({ kind }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'facebook') {
    return (
      <svg {...common}>
        <path d="M14 8h2V4h-2.5A4.5 4.5 0 0 0 9 8.5V11H6v4h3v5h4v-5h3.2l.8-4H13V8.8c0-.5.3-.8 1-.8Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'instagram') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'x') {
    return (
      <svg {...common}>
        <path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'linkedin') {
    return (
      <svg {...common}>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6ZM2 9h4v12H2V9Z" fill="currentColor" />
        <circle cx="4" cy="4" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'whatsapp') {
    return (
      <svg {...common} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </svg>
    );
  }
  return null;
}

const SOCIAL = [
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/ecungaportal?igsh=d3FudDRhYnBwM3dq' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/ecunga-portal-b143a5404?utm_source=share_via&utm_content=profile&utm_medium=member_android' },
  { id: 'x', label: 'X', href: 'https://x.com/eCungaPortal' },
  { id: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/250781975074' },
];

export default function AuthHeroSocial({ railClass, linkClass }) {
  return (
    <div className={railClass} aria-label="Social media links">
      {SOCIAL.map((item) => (
        <a
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          aria-label={item.label}
          className={linkClass}
        >
          <SocialIcon kind={item.id} />
        </a>
      ))}
    </div>
  );
}
