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

// Warm agricultural identity — the same palette as the web app's
// src/index.css (@theme block): deep bark browns, terracotta, ivory paper,
// olive and gold. Kept as plain named tokens here (React Native has no
// Tailwind/CSS-variable layer to hook into), but every value below is
// pulled directly from the web app's ramp so the two platforms match.
export const COLORS = {
  primary:   '#7A3F0B',  // bark-500 — deep agricultural brown, the primary identity
  medium:    '#A6763C',  // bark-400
  light:     '#F0E6D9',  // bark-100
  sprout:    '#C99A4A',  // pfuma-sprout — bright-on-dark accent (was neon green, now warm gold)
  sproutBg:  '#F6E9CF',  // amber-100
  gold:      '#C99A4A',  // amber-500 — pfuma-gold
  goldBg:    '#F6E9CF',  // amber-100
  yellow:    '#C99A4A',  // amber-500 (was a bright MD yellow; muted gold now carries this role)
  yellowBg:  '#F6E9CF',  // amber-100
  danger:    '#B5342C',  // red-500 — kept genuinely red so alerts never blend into brand brown
  dangerBg:  '#FBEEEC',  // red-50
  orange:    '#A65312',  // terra/orange-500 — attention / in-progress
  orangeBg:  '#F7E1CE',  // terra/orange-100
  purple:    '#7B5873',  // purple-500 — aubergine, trade/buyer accent
  purpleBg:  '#E9DEE7',  // purple-100
  teal:      '#3F706B',  // teal-500 — veterinary/clinical accent
  tealBg:    '#DAE7E5',  // teal-100
  slate:     '#2B1404',  // bark-900 — pfuma-slate, deepest bark
  bg:        '#F7F3ED',  // ivory — the warm ground everything sits on
  card:      '#ffffff',
  text:      '#29231E',  // gray-900 (warm taupe ramp, not cold black)
  muted:     '#7C7268',  // gray-500
  border:    '#E0D6C7',  // gray-200

  // Dark-panel tokens — used by the mobile-first dashboard surfaces. Warm
  // bark-dark instead of the neutral near-black these were before, so a
  // "dark" panel on mobile still reads as the same brand, not a bolted-on
  // dark mode.
  bgDark:     '#1A0C02',  // bark-950
  cardDark:   '#2B1404',  // bark-900
  cardDark2:  'rgba(247,243,237,0.04)',
  borderDark: 'rgba(247,243,237,0.08)',
  textDark:   '#F7F3ED',  // ivory
  mutedDark:  'rgba(247,243,237,0.45)',
  mutedDark2: 'rgba(247,243,237,0.28)',
};
