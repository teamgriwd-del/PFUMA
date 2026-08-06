// Single source of truth for the API origin. Set VITE_API_URL at build
// time (e.g. in a .env.production file) to point a deployed build at the
// live backend; falls back to the local Flask dev server otherwise.
export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
