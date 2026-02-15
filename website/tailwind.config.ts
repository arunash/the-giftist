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
          light: '#2a1a17',
        },
        secondary: '#E5E5E5',
        accent: {
          DEFAULT: '#F8B500',
          light: '#2a2410',
        },
        success: {
          DEFAULT: '#00B894',
          light: '#0d2920',
        },
        background: '#0A0A0B',
        surface: {
          DEFAULT: '#141416',
          hover: '#1A1A1D',
          raised: '#1E1E21',
        },
        border: {
          DEFAULT: '#222225',
          light: '#2A2A2E',
        },
        muted: '#71717A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
