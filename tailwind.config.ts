import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/content/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
    './src/design/**/*.{ts,tsx}'
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.25rem',
        lg: '1.5rem',
        xl: '2rem'
      }
    },
    extend: {
      fontSize: {
        'display-xl': ['clamp(3.5rem, 6vw, 5.75rem)', { lineHeight: '1.02', letterSpacing: '-0.04em' }],
        'display-l': ['clamp(3rem, 5vw, 4.5rem)', { lineHeight: '1.04', letterSpacing: '-0.035em' }],
        'display-m': ['clamp(2.25rem, 4vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        h1: ['clamp(2rem, 3vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
        h2: ['clamp(1.5rem, 2.5vw, 2rem)', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
        h3: ['clamp(1.25rem, 2vw, 1.5rem)', { lineHeight: '1.14', letterSpacing: '-0.02em' }],
        'body-large': ['1.125rem', { lineHeight: '1.7' }],
        body: ['1rem', { lineHeight: '1.65' }],
        'body-small': ['0.9375rem', { lineHeight: '1.55' }],
        caption: ['0.8125rem', { lineHeight: '1.45' }]
      },
      colors: {
        background: 'hsl(var(--color-background) / <alpha-value>)',
        'background-muted': 'hsl(var(--color-background-muted) / <alpha-value>)',
        surface: 'hsl(var(--color-surface) / <alpha-value>)',
        'surface-elevated': 'hsl(var(--color-surface-elevated) / <alpha-value>)',
        'surface-subtle': 'hsl(var(--color-surface-subtle) / <alpha-value>)',
        border: 'hsl(var(--color-border) / <alpha-value>)',
        'border-strong': 'hsl(var(--color-border-strong) / <alpha-value>)',
        'text-primary': 'hsl(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'hsl(var(--color-text-secondary) / <alpha-value>)',
        'text-tertiary': 'hsl(var(--color-text-tertiary) / <alpha-value>)',
        'text-inverse': 'hsl(var(--color-text-inverse) / <alpha-value>)',
        brand: 'hsl(var(--color-brand) / <alpha-value>)',
        'brand-subtle': 'hsl(var(--color-brand-subtle) / <alpha-value>)',
        'brand-strong': 'hsl(var(--color-brand-strong) / <alpha-value>)',
        'brand-warm': 'hsl(var(--color-brand-warm) / <alpha-value>)',
        success: 'hsl(var(--color-success) / <alpha-value>)',
        warning: 'hsl(var(--color-warning) / <alpha-value>)',
        error: 'hsl(var(--color-error) / <alpha-value>)',
        info: 'hsl(var(--color-info) / <alpha-value>)',
        'product-scriptia': 'hsl(var(--color-product-scriptia) / <alpha-value>)',
        'product-padelco': 'hsl(var(--color-product-padelco) / <alpha-value>)',
        'product-voice-agents': 'hsl(var(--color-product-voice-agents) / <alpha-value>)',
        'product-speaklio': 'hsl(var(--color-product-speaklio) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: '9999px'
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        low: 'var(--shadow-low)',
        medium: 'var(--shadow-medium)',
        high: 'var(--shadow-high)',
        focus: 'var(--shadow-focus)'
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
        36: '9rem',
        42: '10.5rem',
        54: '13.5rem'
      },
      maxWidth: {
        content: '72rem',
        reading: '44rem',
        hero: '80rem'
      },
      opacity: {
        8: '0.08',
        12: '0.12',
        16: '0.16',
        24: '0.24',
        32: '0.32',
        40: '0.4'
      },
      transitionTimingFunction: {
        'out-standard': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-emphasized': 'cubic-bezier(0.2, 0.8, 0.2, 1)'
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;