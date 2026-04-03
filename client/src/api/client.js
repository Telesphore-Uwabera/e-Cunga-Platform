const TOKEN_KEY = 'ecunga_token';
const USER_KEY = 'ecunga_user';

/** Production (Netlify): set VITE_API_URL to Render API origin, e.g. https://e-cunga-platform.onrender.com — no trailing slash. */
function apiOrigin() {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  return raw.replace(/\/+$/, '');
}

/** Resolve `/api/...` or `http(s)://...` for fetch. */
export function resolveApiUrl(path) {
  if (typeof path !== 'string') return '/api';
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  const origin = apiOrigin();
  if (!origin) return suffix;
  return `${origin}${suffix}`;
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(token, user) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(USER_KEY);
}

export function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (!headers['Content-Type'] && options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid response' };
  }

  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/** Multipart upload to `/api/media/upload` (Cloudinary). Do not set Content-Type — browser sets boundary. */
export async function apiUploadMedia(file) {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(resolveApiUrl('/media/upload'), {
    method: 'POST',
    headers,
    body: fd,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid response' };
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Upload failed');
    err.status = res.status;
    throw err;
  }
  return data;
}
