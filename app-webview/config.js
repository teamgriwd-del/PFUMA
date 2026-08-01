// The single source of truth this app displays — the PFUMA web app.
// This is the whole point of app-webview: one UI, not two codebases.
//
// For local development on a physical device, this must be your PC's LAN
// IP (not localhost/127.0.0.1 — the phone is a separate device on the
// network). Find it with `ipconfig` (Windows, look for "IPv4 Address").
// For an emulator/simulator, localhost usually works.
// Before a real deployment, point this at the hosted production URL.
export const WEB_URL = 'http://10.156.175.78:5173';
