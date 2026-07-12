import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './providers/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '475px',
      },
      colors: {
        app: {
          bg: '#f8fafc',
          sidebar: 'rgba(255, 255, 255, 0.95)',
          card: 'rgba(255, 255, 255, 0.9)',
          'card-border': '#e2e8f0',
        },
        navy: {
          DEFAULT: '#0f172a',
          strong: '#020617',
        },
        primary: {
          DEFAULT: '#3b82f6',
          dark: '#1e40af',
        },
        success: {
          DEFAULT: '#10b981',
        },
        warning: {
          DEFAULT: '#f59e0b',
        },
        error: {
          DEFAULT: '#ef4444',
        },
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          tertiary: '#64748b',
        },
        border: {
          DEFAULT: '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Geist', 'Inter', 'sans-serif'],
      },
      fontSize: {
        eyebrow: ['0.75rem', { lineHeight: '1rem', fontWeight: '700', letterSpacing: '0.08em' }],
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideInDown 250ms ease-out',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        float: 'floatSlow 6s ease-in-out infinite',
        pulse: 'pulseGently 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInDown: {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseGently: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.15)', opacity: '0' },
        },
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
