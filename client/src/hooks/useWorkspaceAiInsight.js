import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Fetches /api/insights/workspace (auth). Empty body + source disabled when GEMINI_API_KEY is off server-side.
 */
export function useWorkspaceAiInsight(scope, language) {
  const { user, bootstrapping } = useAuth();
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState(null);
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
      setSource(data.source || null);
      setRefreshedAt(data.refreshedAt || null);
      setCached(Boolean(data.cached));
      setMetrics(data.metrics && typeof data.metrics === 'object' ? data.metrics : null);
    } catch (e) {
      setBody(null);
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
      setSource(null);
      setError(null);
      return;
    }
    load();
  }, [load, bootstrapping, user?.id]);

  return {
    loading,
    body,
    source,
    error,
    refreshedAt,
    cached,
    metrics,
    refresh: () => load({ refresh: true }),
    reload: load,
  };
}
