const TOKEN_KEY = 'ecunga_token';
const USER_KEY = 'ecunga_user';

/** Production (Netlify): set VITE_API_URL to Render API origin, e.g. https://e-cunga-platform.onrender.com — no trailing slash. */
function apiOrigin() {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const base = raw.replace(/\/+$/, '');
  /**
   * Vite dev: `client/vite.config.js` proxies `/api` → localhost:5000. If `.env` sets VITE_API_URL to that origin
   * but only the Vite dev server is running, the browser hits :5000 directly → ERR_CONNECTION_REFUSED.
   * Same-origin `/api` goes through the proxy and yields a 502 JSON hint when the API is down.
   */
  if (import.meta.env.DEV && /^https?:\/\/(127\.0\.0\.1|localhost):5000$/i.test(base)) {
    return '';
  }
  return base;
}

/** Resolve `/api/...` or `http(s)://...` for fetch. */
export function resolveApiUrl(path) {
  if (typeof path !== 'string') return '/api';
  if (/^https?:\/\//i.test(path)) return path;
  // Optional sub-path prefix (e.g. VITE_API_BASE = '/ecunga')
  const base = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
  const suffix = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  // Insert base between /api and the rest: /api/ecunga/admin/... 
  const withBase = base ? suffix.replace(/^\/api/, `/api${base}`) : suffix;
  const origin = apiOrigin();
  if (!origin) return withBase;
  return `${origin}${withBase}`;
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

function parseUploadResponse(xhr) {
  const text = xhr.responseText || '';
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid response' };
  }
  if (xhr.status < 200 || xhr.status >= 300) {
    const err = new Error(data?.error || xhr.statusText || 'Upload failed');
    err.status = xhr.status;
    throw err;
  }
  return data;
}

/** Multipart upload to `/api/media/upload` (Cloudinary). Optional `onProgress(0–100)`. */
export function apiUploadMedia(file, options = {}) {
  const { onProgress } = options;
  const token = getToken();
  const url = resolveApiUrl('/media/upload');

  if (typeof onProgress === 'function') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          resolve(parseUploadResponse(xhr));
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed — network error'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  }

  const fd = new FormData();
  fd.append('file', file);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { method: 'POST', headers, body: fd }).then(async (res) => {
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
  });
}
