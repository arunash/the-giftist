// Design tokens derived from web tailwind.config.ts CSS variables
export const colors = {
  primary: {
    DEFAULT: '#e84d3d',
    hover: '#d93d2e',
    light: '#fde8e5',
    foreground: '#ffffff',
  },
  secondary: '#4a5568',
  accent: {
    DEFAULT: '#e84d3d',
    light: '#f9d4cf',
  },
  success: {
    DEFAULT: '#3a9a6e',
    light: '#e5f5ed',
  },
  destructive: {
    DEFAULT: '#e53e3e',
    foreground: '#ffffff',
  },
  warning: {
    DEFAULT: '#ed8936',
    foreground: '#4a2800',
  },
  info: {
    DEFAULT: '#3b82f6',
    foreground: '#ffffff',
  },
  background: '#f9f9f9',
  foreground: '#1e2330',
  card: {
    DEFAULT: '#ffffff',
    foreground: '#1e2330',
  },
  surface: {
    DEFAULT: '#ffffff',
    hover: '#f7f7f7',
    raised: '#e5e7eb',
  },
  border: {
    DEFAULT: '#e2e4e9',
    light: '#c8ccd4',
  },
  muted: '#6b7280',
  ring: '#e84d3d',
} as const
