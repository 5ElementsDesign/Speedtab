import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{vue,ts,tsx,html}',
    './src/newtab.html',
  ],
  theme: {
    extend: {
      // Design tokens – dense, dark-first dashboard aesthetic
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        // Compact scale for dense UI
        '2xs': ['0.8rem', { lineHeight: '1rem' }],
        xs:    ['0.9rem', { lineHeight: '1.14rem' }],
        sm:    ['1rem', { lineHeight: '1.4rem' }],
      },
      colors: {
        // Surface scale – stacked translucent blacks layered over the page bg
        surface: {
          // Solid fallback (body background)
          base: '#000000',
          // Legacy slate aliases kept for any non-restyled spots
          950: '#000000',
          900: '#0a0a0a',
          800: '#141414',
          700: '#1c1c1c',
          600: '#242424',
        },
        // Brand accents per the original Speedtab look
        accent: {
          primary:   '#00d2ff',
          secondary: '#2e7d32',
        },
      },
      spacing: {
        // Compact gap tokens
        0.75: '0.1875rem',
        1.25: '0.3125rem',
      },
      backdropBlur: {
        xs: '4px',
      },
      borderRadius: {
        // Spec calls for sharp edges (0px max)
        none: '0',
        sm:   '0px',
      },
    },
  },
  plugins: [],
} satisfies Config
