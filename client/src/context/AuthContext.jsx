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
      // Wake up the backend API from cold sleep in the background
      apiFetch('/health').catch(() => {});
      return;
    }
    let cancelled = false;
    (async () => {
      setBootstrapping(true);
      try {
        const data = await apiFetch('/auth/me');
        if (cancelled) return;
        if (data?.user && isValidRole(data.user.role)) {
          const next = { ...data.user, canApproveRegistrations: Boolean(data.user.canApproveRegistrations) };
          setUser(next);
          setSession(token, next);
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
    const next = { ...data.user, canApproveRegistrations: Boolean(data.user.canApproveRegistrations) };
    setSession(data.token, next);
    setUser(next);
    return next;
  }, []);

  const register = useCallback(async (payload) => {
    const isFile = payload.logo instanceof File;
    let body;
    let headers = {};

    if (isFile) {
      body = new FormData();
      Object.keys(payload).forEach((key) => {
        if (payload[key] !== undefined && payload[key] !== null) {
          body.append(key, payload[key]);
        }
      });
      // Do NOT set Content-Type header; browser handles boundary
    } else {
      body = JSON.stringify(payload);
      headers['Content-Type'] = 'application/json';
    }

    const data = await apiFetch('/auth/register', {
      method: 'POST',
      headers,
      body,
    });

    if (data?.pendingApproval) {
      return {
        pendingApproval: true,
        message: data.message,
        companyName: data.companyName,
        email: data.email,
        role: data.role,
      };
    }
    if (!data?.token || !data?.user) throw new Error('Invalid register response');
    const next = { ...data.user, canApproveRegistrations: Boolean(data.user.canApproveRegistrations) };
    setSession(data.token, next);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    setSession(null, null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const data = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify(patch) });
    if (!data?.user || !isValidRole(data.user.role)) throw new Error('Invalid profile response');
    const next = { ...data.user, canApproveRegistrations: Boolean(data.user.canApproveRegistrations) };
    const token = getToken();
    if (token) setSession(token, next);
    setUser(next);
    return next;
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword, otp }) => {
    await apiFetch('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword, otp }),
    });
  }, []);

  const requestPasswordOtp = useCallback(async ({ currentPassword, newPassword }) => {
    return await apiFetch('/auth/me/password-otp', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }, []);

  const value = useMemo(
    () => ({ user, bootstrapping, login, register, logout, updateProfile, changePassword, requestPasswordOtp }),
    [user, bootstrapping, login, register, logout, updateProfile, changePassword, requestPasswordOtp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
