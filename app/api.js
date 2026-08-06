// Shared authenticated-fetch helper for every screen — every non-public
// PFUMA endpoint requires `Authorization: Bearer <token>` (see backend/app.py
// require_auth). Screens were previously calling fetch() directly without
// this header, which the real backend has always rejected with 401 — they
// only ever *looked* wired up because the 401 silently fell through to each
// screen's own hardcoded demo-data fallback.
import { API } from './config';

export async function authFetch(currentUser, path, opts = {}) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${currentUser?.token}`,
    },
  });
}

export async function authJson(currentUser, path, opts = {}) {
  const res = await authFetch(currentUser, path, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
