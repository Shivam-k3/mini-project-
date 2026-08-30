/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral ink / surface scale (light-first)
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Semantic: positive / improvement / emissions-aware accent.
        // Used as a data signal (reduction = good), not as decoration.
        eco: {
          50:  '#f0faf3',
          100: '#dcf3e3',
          200: '#b7e6c6',
          300: '#82d2a0',
          400: '#4cb576',
          500: '#2e9458',
          600: '#217648',
          700: '#1c5f3c',
          800: '#174c32',
          900: '#123b29',
          950: '#082318',
        },
        // Warning / caution signal
        warn: {
          50:  '#fff8e9',
          100: '#feeec6',
          200: '#fbd98c',
          300: '#f7be4e',
          400: '#f0a11a',
          500: '#d98806',
          600: '#b46b02',
          700: '#8f5205',
          800: '#6d400a',
          900: '#58350c',
        },
        // High / critical signal
        high: {
          50:  '#fdf3f2',
          100: '#fae3e2',
          200: '#f3c4c3',
          300: '#e79a98',
          400: '#d96662',
          500: '#c2413d',
          600: '#a92f2c',
          700: '#8d2624',
          800: '#6f211f',
          900: '#5a1f1d',
        },
        // Info / neutral data accent (used for neutral elements & some charts)
        ocean: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#b9e4fb',
          300: '#7cd0f5',
          400: '#38b6e8',
          500: '#0f9ad6',
          600: '#027bb4',
          700: '#036392',
          800: '#075278',
          900: '#0c4464',
        },
        earth: {
          100: '#f7f3ec',
          200: '#eadfce',
          300: '#d5c2a3',
          400: '#b89c72',
          500: '#9a7d50',
          600: '#7d6340',
        },
        surface: {
          0: '#ffffff',
          1: '#f7f9fa',
          2: '#eef2f4',
          3: '#e3e9ec',
        },
        // Categorical chart palette (mobility modes / data viz)
        graph: {
          primary:  '#2e9458',
          info:     '#0f9ad6',
          amber:    '#f0a11a',
          slate:    '#64748b',
          violet:   '#7c6cd6',
          teal:     '#2a9d8f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
      },
      fontSize: {
        // Compact, technical display scale
        'display-xl': ['clamp(2.25rem, 5vw, 3.25rem)', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(1.75rem, 3.2vw, 2.5rem)',  { lineHeight: '1.1',  letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.35rem, 2.4vw, 1.75rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        // Restrained radii — no balloons
        'md': '0.5rem',
        'lg': '0.625rem',
        'xl': '0.75rem',
        '2xl': '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
        'card-hover': '0 2px 4px rgba(15,23,42,.05), 0 8px 20px -8px rgba(15,23,42,.12)',
        pop: '0 6px 14px -4px rgba(15,23,42,.14), 0 2px 6px rgba(15,23,42,.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-up': 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleUp: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
