const THEME_STORAGE_KEY = 'ecunga-theme-mode';

export function getStoredThemeMode() {
  if (typeof window === 'undefined') return 'system';
  return window.localStorage.getItem(THEME_STORAGE_KEY) || 'system';
}

export function resolveThemeMode(themeMode) {
  if (typeof window === 'undefined') return 'light';
  if (themeMode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return themeMode === 'dark' ? 'dark' : 'light';
}

/** Sets data-ec-theme and color-scheme on documentElement; returns resolved 'light' | 'dark'. */
export function syncDocumentTheme(themeMode) {
  if (typeof window === 'undefined') return 'light';
  const resolved = resolveThemeMode(themeMode);
  document.documentElement.setAttribute('data-ec-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}
