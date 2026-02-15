import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E85D4C',
          hover: '#d14d3d',
          light: '#FEF2F2',
        },
        secondary: '#4B5563',
        accent: {
          DEFAULT: '#F8B500',
          light: '#FFFBEB',
        },
        success: {
          DEFAULT: '#00B894',
          light: '#ECFDF5',
        },
        background: '#F9FAFB',
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F3F4F6',
          raised: '#E5E7EB',
        },
        border: {
          DEFAULT: '#E5E7EB',
          light: '#D1D5DB',
        },
        muted: '#6B7280',
        foreground: '#111827',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
