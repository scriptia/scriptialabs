export const themeNames = ['light', 'dark'] as const;

export type ThemeName = (typeof themeNames)[number];

export const productAccentMap = {
  scriptia: 'product-scriptia',
  padelco: 'product-padelco',
  'voice-agents': 'product-voice-agents',
  speaklio: 'product-speaklio'
} as const;

export type ProductAccent = keyof typeof productAccentMap;

// Tailwind's JIT scanner needs full literal class names in source, so this
// stays a literal record rather than `bg-${productAccentMap[accent]}`
// built at runtime — that string would never be generated.
export const productAccentBackgroundClassName: Record<ProductAccent, string> = {
  scriptia: 'bg-product-scriptia',
  padelco: 'bg-product-padelco',
  'voice-agents': 'bg-product-voice-agents',
  speaklio: 'bg-product-speaklio'
};

export const productAccentTextClassName: Record<ProductAccent, string> = {
  scriptia: 'text-product-scriptia',
  padelco: 'text-product-padelco',
  'voice-agents': 'text-product-voice-agents',
  speaklio: 'text-product-speaklio'
};

// Per-product theme scope class (defined in src/styles/global.css). A product
// page wraps its content in this class so shared components re-theme to that
// product's identity. voice-agents has no bespoke scope yet, so it renders on
// the base Scriptia/Labs theme — represented by an empty string.
export const productThemeClassName: Record<ProductAccent, string> = {
  scriptia: 'theme-scriptia',
  padelco: 'theme-padelco',
  'voice-agents': '',
  speaklio: 'theme-speaklio'
};
