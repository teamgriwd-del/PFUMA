// Change this to your PC's local IP when testing on a physical device.
// Find it by running `ipconfig` and looking for IPv4 Address.
// Example: 'http://192.168.1.42:5000'
// For browser/emulator, localhost works fine.
export const API = 'http://10.94.167.78:5000';

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
};
