// The single source of truth this app displays — the PFUMA web app.
// This is the whole point of app-webview: one UI, not two codebases.
//
// Defaults to the real production HTTPS deployment, so a build shipped as-is
// works off any network and never sends logins/tokens in the clear. For
// local development on a physical device, override with EXPO_PUBLIC_WEB_URL
// set to your PC's LAN IP (not localhost/127.0.0.1 — the phone is a
// separate device on the network; find it with `ipconfig`, look for "IPv4
// Address"). For an emulator/simulator, localhost usually works.
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://38-247-146-172.sslip.io:8443';
