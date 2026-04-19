import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TRANSLATIONS } from './translations.jsx';

const STORAGE_KEY = 'ecunga-language';

const I18nContext = createContext(null);

function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : ''));
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'eng';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'kiny' || stored === 'eng' ? stored : 'eng';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const t = useCallback(
    (key, vars) => {
      const bundle = TRANSLATIONS[language] || TRANSLATIONS.eng;
      let str = getNested(bundle, key);
      if (str === undefined || str === null) {
        str = getNested(TRANSLATIONS.eng, key);
      }
      if (str === undefined || str === null) return key;
      return interpolate(str, vars);
    },
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
