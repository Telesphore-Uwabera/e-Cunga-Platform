import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KinyMaintenanceModal } from './KinyMaintenanceModal.jsx';
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
  const [kinyMaintenanceOpen, setKinyMaintenanceOpen] = useState(false);
  const [language, setLanguageInternal] = useState(() => {
    if (typeof window === 'undefined') return 'eng';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Kinyarwanda copy is not complete — default to English (migrate saved `kiny`).
    if (stored === 'kiny') return 'eng';
    return stored === 'eng' ? 'eng' : 'eng';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY) === 'kiny') {
      window.localStorage.setItem(STORAGE_KEY, 'eng');
    }
  }, []);

  const setLanguage = useCallback((next) => {
    if (next === 'kiny') {
      setKinyMaintenanceOpen(true);
      return;
    }
    if (next === 'eng') {
      setLanguageInternal('eng');
    }
  }, []);

  const dismissKinyMaintenance = useCallback(() => setKinyMaintenanceOpen(false), []);

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

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return (
    <I18nContext.Provider value={value}>
      {children}
      <KinyMaintenanceModal open={kinyMaintenanceOpen} onClose={dismissKinyMaintenance} t={t} />
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
