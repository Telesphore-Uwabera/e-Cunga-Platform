const THEME_STORAGE_KEY = 'ecunga-theme-mode';

/** Stored preference is only `light` or `dark`. Legacy `system` is migrated once to match OS. */
export function getStoredThemeMode() {
  if (typeof window === 'undefined') return 'light';
  let raw = window.localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  if (raw === 'system') {
    raw = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, raw);
  }
  return raw === 'dark' ? 'dark' : 'light';
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
