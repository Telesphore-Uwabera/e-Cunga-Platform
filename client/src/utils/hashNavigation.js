/**
 * Scroll the window to the top of the page (route changes). Respects reduced motion.
 */
export function scrollPageToTop() {
  if (typeof window === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

/**
 * Portal (AppShell): main column scrolls inside `.contentMain` on desktop; window scrolls on mobile.
 * Optionally reset the context rail scroll position. Uses smooth scroll unless reduced motion.
 *
 * @param {HTMLElement | null} contentMainEl
 * @param {HTMLElement | null} [contentRailEl]
 */
export function scrollAppShellContentToTop(contentMainEl, contentRailEl) {
  if (typeof window === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reduceMotion ? 'auto' : 'smooth';

  const scrollEl = (el) => {
    if (!el) return;
    try {
      el.scrollTo({ top: 0, left: 0, behavior });
    } catch {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  };

  scrollEl(contentMainEl);
  scrollEl(contentRailEl);
  window.scrollTo({ top: 0, left: 0, behavior });
}

/**
 * When already on home with no hash, a plain Link to "/" does not change location — scroll to top instead.
 */
export function handleMarketingHomeNavClick(e, location) {
  const { pathname, hash } = location;
  if (pathname === '/' && !hash) {
    e.preventDefault();
    scrollPageToTop();
  }
}

/**
 * Scroll to an element by id (e.g. in-page sections). Uses smooth behavior unless reduced motion is preferred.
 */
export function scrollToAnchorById(id) {
  if (typeof document === 'undefined' || !id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  });
}
