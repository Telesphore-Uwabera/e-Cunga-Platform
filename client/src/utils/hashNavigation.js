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
