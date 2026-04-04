import { useId } from 'react';

/**
 * Corporate wordmark: navy monogram + plum accent bar + e-CUNGA type.
 * On dark UI, monogram uses plum so it reads on navy chrome.
 */
export default function EcungaWordmarkSvg({
  variant = 'onLight',
  className = '',
  decorative = true,
  ariaLabel = 'e-CUNGA',
}) {
  const clipId = useId().replace(/:/g, '');
  const onDark = variant === 'onDark';
  const plum = '#692751';
  const navy = '#121c2a';
  const paper = '#f8fafc';
  const markFace = onDark ? plum : navy;
  const markE = paper;
  const accentBar = plum;
  const tspanAccent = onDark ? paper : plum;
  const tspanBody = onDark ? paper : navy;

  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': ariaLabel };

  return (
    <svg
      className={className}
      viewBox="0 0 192 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
    >
      {!decorative ? <title>{ariaLabel}</title> : null}
      <defs>
        <clipPath id={clipId}>
          <rect width="32" height="32" rx="7" />
        </clipPath>
      </defs>
      <g transform="translate(0 4)" clipPath={`url(#${clipId})`}>
        <rect width="32" height="32" rx="7" fill={markFace} />
        <rect x="0" y="27" width="32" height="5" fill={accentBar} />
        <path
          fill={markE}
          d="M10 9L22 9 22 11.5 13 11.5 13 14.25 20 14.25 20 16.75 13 16.75 13 19.5 22 19.5 22 22 10 22Z"
        />
      </g>
      <text
        x="42"
        y="27"
        fontFamily="Inter, system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="16.5"
        fontWeight="800"
        letterSpacing="0.06em"
      >
        <tspan fill={tspanAccent} letterSpacing="-0.01em">
          e-
        </tspan>
        <tspan fill={tspanBody}>CUNGA</tspan>
      </text>
    </svg>
  );
}
