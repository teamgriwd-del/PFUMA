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

// Turns an expo-image-picker asset into a { uri, name, type } object safe
// to pass to FormData.append(). Parsing a filename/extension out of
// asset.uri is unreliable — Android's system Photo Picker (and some
// gallery apps) return content:// URIs with no file extension in the path
// at all, so `uri.split('/').pop().split('.').pop()` silently produces an
// extension-less or garbage "extension" (e.g. a raw numeric media id),
// which becomes an invalid MIME type the backend correctly rejects as an
// unsupported file type — the exact cause of some-but-not-all picked
// photos failing to upload. expo-image-picker already gives us the real
// mimeType (and often fileName); use those instead of guessing.
export function assetToFormFile(asset, fallbackBase = 'photo') {
  const mimeType = asset.mimeType || 'image/jpeg';
  const ext = mimeType.split('/')[1] || 'jpg';
  const name = asset.fileName || `${fallbackBase}_${Date.now()}.${ext}`;
  return { uri: asset.uri, name, type: mimeType };
}
