import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setSession } from '../api/client.js';

/**
 * Google/Microsoft OAuth redirects here with ?token= (see server auth.routes).
 * Store JWT in session (same as email login) and hard-navigate so Auth bootstraps cleanly.
 */
export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');
    if (token) {
      setSession(token, null);
      window.location.replace(`${window.location.origin}/app`);
      return;
    }
    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }
    navigate('/login', { replace: true });
  }, [params, navigate]);

  return <p style={{ padding: '2rem', textAlign: 'center' }}>Signing you in…</p>;
}
