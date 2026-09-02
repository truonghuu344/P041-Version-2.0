/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app.js',
    './admin-portal.js',
  ],
  corePlugins: { preflight: false },
  theme: {
    // Unified app breakpoints (synced with app/styles/responsive.css):
    //   < 768px            → mobile  (base utilities)
    //   768px – 1199.98px  → tablet  (sm: / md:)
    //   ≥ 1200px           → desktop (lg: / xl:)
    screens: {
      sm: '768px',
      md: '768px',
      lg: '1200px',
      xl: '1200px',
      '2xl': '1520px',
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#059669',
          hover: '#047857',
          soft: '#ECFDF5',
          border: '#A7F3D0',
          container: '#10B981',
          fixed: '#85F8C4',
        },
        semantic: {
          success: {
            DEFAULT: '#047857',
            hover: '#065F46',
            soft: '#ECFDF5',
            border: '#A7F3D0',
          },
          info: {
            DEFAULT: '#2563EB',
            hover: '#1D4ED8',
            soft: '#EFF6FF',
            border: '#BFDBFE',
          },
          warning: {
            DEFAULT: '#D97706',
            hover: '#B45309',
            soft: '#FFFBEB',
            border: '#FDE68A',
          },
          danger: {
            DEFAULT: '#DC2626',
            hover: '#B91C1C',
            soft: '#FEF2F2',
            border: '#FECACA',
          },
          neutral: {
            DEFAULT: '#64748B',
            hover: '#475569',
            soft: '#F1F5F9',
            border: '#E2E8F0',
          },
        },
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F8FAFC',
          tint: '#059669',
          dim: '#D5DCD6',
          bright: '#F5FBF5',
          container: {
            lowest: '#FFFFFF',
            low: '#EFF5EF',
            DEFAULT: '#E9EFE9',
            high: '#E4EAE4',
            highest: '#DEE4DE',
          },
        },
        'text-primary': '#0F172A',
        'text-secondary': '#475569',
        'text-muted': '#64748B',
        'border-subtle': '#E2E8F0',
        'input-border': '#CBD5E1',
        'tag-neutral': '#F1F5F9',
        'warning-amber': '#D97706',
        'error-red': '#DC2626',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        headline: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(15, 23, 42, 0.04)',
        modal: '0 16px 36px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
