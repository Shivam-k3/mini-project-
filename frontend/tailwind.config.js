/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        eco: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e14',
        },
        ocean: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        earth: {
          100: '#f5f0e8',
          200: '#e6dcc4',
          300: '#c9b896',
          400: '#a68f65',
          500: '#8b7340',
          600: '#6d5a32',
        },
        surface: {
          0: '#ffffff',
          1: '#f2f9f4',
          2: '#e6f2ea',
          3: '#d4e6db',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-up': 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s infinite',
        'spin-slow': 'spin 2s linear infinite',
        'bounce-subtle': 'bounceSub 2s ease-in-out infinite',
        'count-up': 'fadeSlideUp 0.6s ease-out both',
        'leaf': 'leafDrift 4s ease-in-out infinite',
        'green-pulse': 'greenPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleUp: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceSub: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        leafDrift: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '0.6' },
          '100%': { transform: 'translateY(-30px) rotate(15deg)', opacity: '0' },
        },
        greenPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(34, 197, 94, .2)' },
          '50%': { boxShadow: '0 0 20px rgba(34, 197, 94, .4)' },
        },
      },
    },
  },
  plugins: [],
};
