import { useEffect } from 'react';
import { getStoredThemeMode, syncDocumentTheme } from '../utils/documentTheme.js';

/** Keeps <html data-ec-theme> in sync for public routes (login/register) that never mount AppShell. */
export default function ThemeDocumentSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function apply() {
      syncDocumentTheme(getStoredThemeMode());
    }
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return null;
}
