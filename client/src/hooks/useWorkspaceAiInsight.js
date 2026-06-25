import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Fetches /api/insights/workspace (auth).
 * Returns structured sections (array) when Gemini returns JSON, plus a flat body string for fallback.
 * Empty body + source "disabled" when GEMINI_API_KEY is not set server-side.
 */
export function useWorkspaceAiInsight(scope, language) {
  const { user, bootstrapping } = useAuth();
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState(null);
  const [sections, setSections] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [cached, setCached] = useState(false);
  const [metrics, setMetrics] = useState(null);

  const load = useCallback(async (opts = {}) => {
    const bust = Boolean(opts.refresh);
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        scope: String(scope || 'clerk'),
        language: language === 'kiny' ? 'kiny' : 'eng',
      });
      if (bust) q.set('refresh', '1');
      const data = await apiFetch(`/insights/workspace?${q}`);
      setBody(data.body || null);
      setSections(Array.isArray(data.sections) ? data.sections : null);
      setSource(data.source || null);
      setRefreshedAt(data.refreshedAt || null);
      setCached(Boolean(data.cached));
      setMetrics(data.metrics && typeof data.metrics === 'object' ? data.metrics : null);
    } catch (e) {
      setBody(null);
      setSections(null);
      setSource('error');
      setError(e?.message || 'Failed');
      setRefreshedAt(null);
      setCached(false);
      setMetrics(e?.body?.metrics && typeof e.body.metrics === 'object' ? e.body.metrics : null);
    } finally {
      setLoading(false);
    }
  }, [scope, language]);

  useEffect(() => {
    if (bootstrapping || !user?.id || !getToken()) {
      setLoading(false);
      setBody(null);
      setSections(null);
      setSource(null);
      setError(null);
      return;
    }
    load();
  }, [load, bootstrapping, user?.id]);

  return {
    loading,
    body,
    sections,
    source,
    error,
    refreshedAt,
    cached,
    metrics,
    refresh: () => load({ refresh: true }),
    reload: load,
  };
}
