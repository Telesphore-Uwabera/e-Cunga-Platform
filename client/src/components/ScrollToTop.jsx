import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollPageToTop } from '../utils/hashNavigation.js';

/**
 * Reset scroll on marketing layout route changes. Preserves "/" + hash in-page jumps (handled on HomePage).
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (pathname === '/' && hash) return;
    scrollPageToTop();
  }, [pathname, hash]);

  return null;
}
