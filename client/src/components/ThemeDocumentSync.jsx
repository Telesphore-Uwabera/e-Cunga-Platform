import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getStoredThemeMode, syncDocumentTheme } from '../utils/documentTheme.js';

/** Marketing site routes: always light so hero/footer tokens match MainLayout (light-surface art). */
const LANDING_PATHS = new Set(['/', '/pricing', '/contact']);

function isLandingMarketingPath(pathname) {
  return LANDING_PATHS.has(pathname);
}

/**
 * Keeps <html data-ec-theme> in sync when AppShell is not mounted.
 * Landing (home, pricing, contact) is always light; auth pages follow stored light/dark preference.
 */
export default function ThemeDocumentSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (isLandingMarketingPath(pathname)) {
      syncDocumentTheme('light');
      return undefined;
    }

    if (pathname.startsWith('/app')) {
      return undefined;
    }

    syncDocumentTheme(getStoredThemeMode());
  }, [pathname]);

  return null;
}
