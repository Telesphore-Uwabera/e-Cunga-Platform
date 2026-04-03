import { useEffect, useState } from 'react';

/**
 * Subscribes to the app shell top-bar search (debounced). Pages can AND this with local filters.
 */
export function useShellSearchQuery() {
  const [q, setQ] = useState('');

  useEffect(() => {
    function onSearch(e) {
      setQ(typeof e.detail?.query === 'string' ? e.detail.query : '');
    }
    window.addEventListener('ecunga-shell-search', onSearch);
    return () => window.removeEventListener('ecunga-shell-search', onSearch);
  }, []);

  return q;
}
