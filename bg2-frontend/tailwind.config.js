/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core palette (from design reference)
        gold:       '#d4af37',
        'gold-dim': '#c5a028',
        cream:      '#f5f0e1',
        muted:      '#a0a8b8',
        surface:    '#0d121f',
        background: '#0a0e1a',

        // Material-style aliases kept for existing components
        primary:              '#d4af37',
        'primary-fixed':      '#ffe088',
        'on-primary':         '#3c2f00',
        'on-background':      '#f5f0e1',
        'on-surface':         '#f5f0e1',
        'on-surface-variant': '#a0a8b8',
        'outline-variant':    '#ffffff1a',   // white/10
        outline:              '#ffffff33',   // white/20
        error:                '#ffb4ab',
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
        serif:    ['Playfair Display', 'Georgia', 'serif'],
        body:     ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Playfair Display', 'Georgia', 'serif'],
        label:    ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'respiratory-entrainment': {
          '0%, 100%': { transform: 'scale(1)',    opacity: '0.2', filter: 'blur(40px)' },
          '21%':       { transform: 'scale(1.15)', opacity: '0.4', filter: 'blur(20px)' },
          '58%':       { transform: 'scale(1.15)', opacity: '0.4', filter: 'blur(20px)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        breathe:    'respiratory-entrainment 19s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      backdropBlur: {
        sm: '4px',
      },
    },
  },
  plugins: [],
}
