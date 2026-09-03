// Live production API (VPS, HTTPS via Caddy) — works from anywhere,
// which is the whole point for the show: nobody's phone is on the same
// LAN as a laptop hotspot. For local-only testing against a Flask dev
// server instead, temporarily swap this back to your PC's LAN IP
// (ipconfig → IPv4 Address), e.g. 'http://192.168.1.42:5000'.
export const API = 'https://38-247-146-172.sslip.io:8443/api';

// RN registers each weight of a custom font as its own distinct font
// family (no CSS-style weight cascade within one family name) — loaded
// via expo-font in App.js. Use these names directly as `fontFamily`
// instead of `fontWeight` wherever this typeface is applied.
export const FONTS = {
  regular:   'PlusJakartaSans_400Regular',
  semibold:  'PlusJakartaSans_600SemiBold',
  bold:      'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const COLORS = {
  primary:   '#1b5e20',
  medium:    '#2e7d32',
  light:     '#e8f5e9',
  sprout:    '#22c55e',
  sproutBg:  '#dcfce7',
  gold:      '#ca8a04',
  goldBg:    '#fef9c3',
  yellow:    '#fbc02d',
  yellowBg:  '#fff8e1',
  danger:    '#c62828',
  dangerBg:  '#ffebee',
  orange:    '#e65100',
  orangeBg:  '#fff3e0',
  purple:    '#7c3aed',
  purpleBg:  '#f3e5f5',
  slate:     '#0f172a',
  bg:        '#f6faf6',
  card:      '#ffffff',
  text:      '#1a1a1a',
  muted:     '#666666',
  border:    '#e0e0e0',

  // Dark-theme dashboard tokens (mobile-first redesign) — applied across
  // all role dashboards in this app, matching the web app's mobile view.
  bgDark:     '#121212',
  cardDark:   '#1E1E1E',
  cardDark2:  'rgba(255,255,255,0.03)',
  borderDark: 'rgba(255,255,255,0.06)',
  textDark:   '#ffffff',
  mutedDark:  'rgba(255,255,255,0.4)',
  mutedDark2: 'rgba(255,255,255,0.25)',
};
