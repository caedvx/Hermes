export interface Colors {
  primary: string;       // electric cyan — active states, data, links
  primaryDark: string;
  secondary: string;     // aurora violet — elevation, streaks, earned moments only
  secondaryDim: string;  // soft lavender — secondary rings
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceOverlay: string;
  primaryTint: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  success: string;
  danger: string;
  warning: string;
  mapBackground: string;
}

export const DARK: Colors = {
  primary:        '#00BCD4',
  primaryDark:    '#0097A7',
  secondary:      '#CE93D8',
  secondaryDim:   '#9C88B8',
  background:     '#030A0C',
  surface:        '#050F14',
  surfaceAlt:     '#071920',
  surfaceOverlay: 'rgba(5,15,20,0.93)',
  primaryTint:    'rgba(0,188,212,0.12)',
  text:           '#FFFFFF',
  textSecondary:  'rgba(255,255,255,0.62)',
  textMuted:      'rgba(255,255,255,0.30)',
  border:         'rgba(0,188,212,0.16)',
  success:        '#30D158',
  danger:         '#FF453A',
  warning:        '#FFD60A',
  mapBackground:  '#030A0C',
};

export const LIGHT: Colors = {
  primary:        '#0097A7',
  primaryDark:    '#00838F',
  secondary:      '#AB47BC',
  secondaryDim:   '#7B5EA7',
  background:     '#F4F7F8',
  surface:        '#FFFFFF',
  surfaceAlt:     '#EEF2F5',
  surfaceOverlay: 'rgba(255,255,255,0.93)',
  primaryTint:    'rgba(0,151,167,0.10)',
  text:           '#0A1628',
  textSecondary:  '#3D5168',
  textMuted:      '#7A90A4',
  border:         'rgba(0,151,167,0.18)',
  success:        '#27AE60',
  danger:         '#E74C3C',
  warning:        '#F57F17',
  mapBackground:  '#E8EFF3',
};

export const COLORS = LIGHT;
