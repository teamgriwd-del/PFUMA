// Single source of truth for the backend URL.
//
// Local development needs nothing — it falls back to the Flask dev server.
// For a deployed build set VITE_API_BASE at build time, e.g.
//   VITE_API_BASE=https://pfuma-api.onrender.com npm run build
// or add it in the hosting provider's environment settings.
//
// Never hardcode localhost in a component again: on a deployed site that
// resolves to the visitor's own machine, not ours, so every request fails.
export const API = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export default API;
