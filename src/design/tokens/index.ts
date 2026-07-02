export const primitiveTokens = {
  olive: {
    50: '71 38% 95%',
    100: '71 34% 90%',
    200: '71 30% 80%',
    300: '71 28% 66%',
    400: '71 26% 52%',
    500: '71 26% 30%',
    600: '71 30% 22%',
    700: '71 34% 17%',
    800: '71 38% 13%',
    900: '71 40% 9%'
  },
  neutral: {
    50: '45 25% 98%',
    100: '45 20% 96%',
    200: '38 13% 87%',
    300: '36 10% 75%',
    400: '220 8% 47%',
    500: '220 10% 32%',
    600: '220 12% 22%',
    700: '220 15% 16%',
    800: '220 18% 10%',
    900: '220 18% 8%'
  },
  sand: {
    50: '45 35% 98%',
    100: '45 32% 96%',
    200: '44 28% 90%',
    300: '42 22% 82%',
    400: '40 18% 72%',
    500: '38 14% 62%'
  },
  charcoal: {
    50: '220 15% 94%',
    100: '220 15% 88%',
    200: '220 14% 76%',
    300: '220 13% 58%',
    400: '220 12% 40%',
    500: '220 12% 28%'
  },
  white: '0 0% 100%',
  black: '0 0% 0%'
} as const;

export const semanticTokens = {
  background: 'var(--color-background)',
  'background-muted': 'var(--color-background-muted)',
  surface: 'var(--color-surface)',
  'surface-elevated': 'var(--color-surface-elevated)',
  'surface-subtle': 'var(--color-surface-subtle)',
  border: 'var(--color-border)',
  'border-strong': 'var(--color-border-strong)',
  'text-primary': 'var(--color-text-primary)',
  'text-secondary': 'var(--color-text-secondary)',
  'text-tertiary': 'var(--color-text-tertiary)',
  'text-inverse': 'var(--color-text-inverse)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  info: 'var(--color-info)',
  brand: 'var(--color-brand)',
  'brand-subtle': 'var(--color-brand-subtle)',
  'brand-strong': 'var(--color-brand-strong)'
} as const;

export const motionTokens = {
  duration: {
    fast: '120ms',
    normal: '220ms',
    slow: '360ms'
  },
  easing: {
    standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
    emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
  }
} as const;

export const spacingTokens = {
  page: '1.5rem',
  sectionSm: '4rem',
  sectionMd: '6rem',
  sectionLg: '8rem',
  containerSm: '40rem',
  containerMd: '72rem',
  containerLg: '80rem'
} as const;

export const breakpointTokens = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
} as const;

export const opacityTokens = {
  8: 0.08,
  12: 0.12,
  16: 0.16,
  24: 0.24,
  32: 0.32,
  40: 0.4
} as const;

export const radiusTokens = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  pill: '9999px'
} as const;

export const shadowTokens = {
  subtle: '0 1px 2px hsl(0 0% 0% / 0.04)',
  low: '0 2px 6px hsl(0 0% 0% / 0.06)',
  medium: '0 8px 24px hsl(0 0% 0% / 0.08)',
  high: '0 16px 40px hsl(0 0% 0% / 0.12)',
  focus: '0 0 0 3px hsl(71 26% 30% / 0.28)'
} as const;

export const typographyTokens = {
  font: {
    sans: 'var(--font-sans)',
    display: 'var(--font-display)',
    mono: 'var(--font-mono)'
  },
  size: {
    displayXl: 'clamp(3.5rem, 6vw, 5.75rem)',
    displayL: 'clamp(3rem, 5vw, 4.5rem)',
    displayM: 'clamp(2.25rem, 4vw, 3.5rem)',
    h1: 'clamp(2rem, 3vw, 2.75rem)',
    h2: 'clamp(1.5rem, 2.5vw, 2rem)',
    h3: 'clamp(1.25rem, 2vw, 1.5rem)',
    bodyLarge: '1.125rem',
    body: '1rem',
    bodySmall: '0.9375rem',
    caption: '0.8125rem'
  },
  lineHeight: {
    display: 1.02,
    heading: 1.1,
    bodyLarge: 1.7,
    body: 1.65,
    bodySmall: 1.55,
    caption: 1.45
  }
} as const;

export const componentTokens = {
  button: {
    radius: radiusTokens.pill,
    shadow: shadowTokens.subtle
  },
  card: {
    radius: radiusTokens.lg,
    shadow: shadowTokens.low
  },
  input: {
    radius: radiusTokens.md,
    shadow: shadowTokens.subtle
  },
  navbar: {
    radius: radiusTokens.xl,
    shadow: shadowTokens.low
  },
  footer: {
    radius: radiusTokens.lg,
    shadow: shadowTokens.subtle
  },
  section: {
    radius: radiusTokens.lg
  },
  hero: {
    radius: radiusTokens.xl
  }
} as const;
