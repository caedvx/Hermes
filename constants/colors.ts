export interface Colors {
  primary: string;
  primaryDark: string;
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

export const LIGHT: Colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  background: '#f8f8f8',
  surface: '#ffffff',
  surfaceAlt: '#f0f0f0',
  surfaceOverlay: 'rgba(255,255,255,0.9)',
  primaryTint: '#EFF6FF',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textMuted: '#999999',
  border: '#e0e0e0',
  success: '#27ae60',
  danger: '#e74c3c',
  warning: '#f39c12',
  mapBackground: '#e8e4d9',
};

export const DARK: Colors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  background: '#000000',
  surface: '#1c1c1e',
  surfaceAlt: '#2c2c2e',
  surfaceOverlay: 'rgba(28,28,30,0.9)',
  primaryTint: 'rgba(59,130,246,0.15)',
  text: '#ffffff',
  textSecondary: '#ababab',
  textMuted: '#636366',
  border: '#38383a',
  success: '#30d158',
  danger: '#ff453a',
  warning: '#ffd60a',
  mapBackground: '#1a1a2e',
};

export const COLORS = LIGHT;
