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
          light: '#f8e8e6',
        },
        secondary: '#2D3436',
        accent: {
          DEFAULT: '#F8B500',
          light: '#fef3cd',
        },
        success: {
          DEFAULT: '#00B894',
          light: '#d4edda',
        },
        background: '#FFF9F5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
