
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#0f766e',
          800: '#065f46',
          900: '#064e3b',
        },
        volt: {
          400: '#a3e635',
          500: '#84cc16',
        },
        surface: {
          light: '#f8fafc',
          dark: '#0b1220',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(16, 185, 129, 0.45)',
      },
      keyframes: {
        pulseSlow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 },
        },
        chargeFlow: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '200% 0%' },
        },
      },
      animation: {
        'pulse-slow': 'pulseSlow 2.5s ease-in-out infinite',
        'charge-flow': 'chargeFlow 2s linear infinite',
      },
    },
  },
  plugins: [],
};


