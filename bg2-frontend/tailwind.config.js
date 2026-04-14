/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm consultant palette
        gold:       '#C8603A',   // terracotta — primary accent
        'gold-dim': '#B5522E',   // darker terracotta for hover states
        cream:      '#2C2C2C',   // main body text (dark charcoal)
        muted:      '#8B7355',   // secondary warm brown
        surface:    '#FEFCF8',   // warm white card surface
        background: '#F5F1EB',   // warm parchment page background
        border:     '#E8E0D4',   // warm stone border

        // Semantic aliases
        primary:              '#C8603A',
        'primary-fixed':      '#F0C4B2',
        'on-primary':         '#FFFFFF',
        'on-background':      '#2C2C2C',
        'on-surface':         '#2C2C2C',
        'on-surface-variant': '#8B7355',
        'outline-variant':    '#E8E0D4',
        outline:              '#D4C8BB',
        error:                '#DC2626',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm:   '0.25rem',
        md:   '0.5rem',
        lg:   '0.75rem',
        xl:   '1rem',
        '2xl':'1.5rem',
        '3xl':'1.75rem',
        full: '9999px',
      },
      fontFamily: {
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        serif:    ['DM Serif Display', 'Georgia', 'serif'],
        body:     ['Inter', 'system-ui', 'sans-serif'],
        headline: ['DM Serif Display', 'Georgia', 'serif'],
        label:    ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'respiratory-entrainment': {
          '0%, 100%': { transform: 'scale(1)',    opacity: '0.15', filter: 'blur(40px)' },
          '21%':       { transform: 'scale(1.15)', opacity: '0.30', filter: 'blur(24px)' },
          '58%':       { transform: 'scale(1.15)', opacity: '0.30', filter: 'blur(24px)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        breathe:     'respiratory-entrainment 19s ease-in-out infinite',
        'spin-slow':  'spin 8s linear infinite',
      },
      backdropBlur: {
        sm: '4px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(44,44,44,0.06), 0 1px 2px -1px rgba(44,44,44,0.04)',
        'card-hover': '0 4px 12px 0 rgba(44,44,44,0.10)',
      },
    },
  },
  plugins: [],
}
