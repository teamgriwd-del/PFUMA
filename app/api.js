// Shared authenticated-fetch helper for every screen — every non-public
// PFUMA endpoint requires `Authorization: Bearer <token>` (see backend/app.py
// require_auth). Screens were previously calling fetch() directly without
// this header, which the real backend has always rejected with 401 — they
// only ever *looked* wired up because the 401 silently fell through to each
// screen's own hardcoded demo-data fallback.
import { File } from 'expo-file-system';

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

// Turns an expo-image-picker asset into something safe to pass to
// FormData.append(). SDK 56 made expo/fetch the default global fetch, and
// its native FormData only accepts real File/Blob parts — a plain
// { uri, name, type } object throws "Unsupported FormDataPart
// implementation" at request time. expo-file-system's File wraps a uri
// (file:// or content://) and resolves the real name/MIME type natively
// (via ContentResolver on Android), which also sidesteps the earlier bug
// where content:// picker URIs with no file extension in the path produced
// a garbage/invalid MIME type from naive uri string-parsing.
export function assetToFormFile(asset) {
  return new File(asset.uri);
}
