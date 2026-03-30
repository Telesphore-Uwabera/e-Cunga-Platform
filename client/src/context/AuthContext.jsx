import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, getToken, readStoredUser, setSession } from '../api/client.js';
import { isValidRole } from '../constants/rbac.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(getToken()));

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setBootstrapping(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setBootstrapping(true);
      try {
        const data = await apiFetch('/auth/me');
        if (cancelled) return;
        if (data?.user && isValidRole(data.user.role)) {
          setUser(data.user);
          setSession(token, data.user);
        } else {
          setSession(null, null);
          setUser(null);
        }
      } catch {
        if (!cancelled) {
          setSession(null, null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!data?.token || !data?.user) throw new Error('Invalid login response');
    setSession(data.token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async ({ companyName, fullName, email, password, industry }) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ companyName, fullName, email, password, industry }),
    });
    if (!data?.token || !data?.user) throw new Error('Invalid register response');
    setSession(data.token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setSession(null, null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, bootstrapping, login, register, logout }),
    [user, bootstrapping, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
