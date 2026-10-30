/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0B0D11',
        surface: {
          DEFAULT: '#101319',
          elevated: '#12151A',
          overlay: 'rgba(16, 19, 25, 0.75)',
          glass: 'rgba(255, 255, 255, 0.03)',
          glassHover: 'rgba(255, 255, 255, 0.06)',
          border: 'rgba(255, 255, 255, 0.08)',
          borderActive: 'rgba(245, 158, 11, 0.3)',
        },
        focus: {
          DEFAULT: '#F59E0B', // Warm amber
          glow: 'rgba(245, 158, 11, 0.15)',
          dark: '#B45309',
          light: '#FDE68A',
        },
        break: {
          DEFAULT: '#14B8A6', // Cool teal
          glow: 'rgba(20, 184, 166, 0.15)',
          dark: '#0F766E',
          light: '#99F6E4',
        },
        alert: {
          DEFAULT: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.15)',
        },
        success: {
          DEFAULT: '#10B981',
          glow: 'rgba(16, 185, 129, 0.15)',
        },
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'focus-glow': '0 0 40px -10px rgba(245, 158, 11, 0.25)',
        'break-glow': '0 0 40px -10px rgba(20, 184, 166, 0.25)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      animation: {
        pulseGlow: 'pulseGlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px',
      },
    },
  },
  plugins: [],
};
