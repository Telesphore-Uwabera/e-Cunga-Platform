/**
 * Scroll the window to the top of the page (route changes). Respects reduced motion.
 */
export function scrollPageToTop() {
  if (typeof window === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
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
