/** Stroke icons for supplier messaging quick actions (match AppShell nav icon style). */

const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };

export function IconTalkRequest(props) {
  return (
    <svg {...common} {...props}>
      <path d="M5 6h14v9H9l-4 3V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTalkAccountant(props) {
  return (
    <svg {...common} {...props}>
      <path
        d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 9h6M9 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconCompanyEnquiry(props) {
  return (
    <svg {...common} {...props}>
      <path
        d="M4 22V11l8-4 8 4v11M4 22h16M10 22v-5h4v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 14h1.5M14 14h1.5M9 17h1.5M14 17h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
