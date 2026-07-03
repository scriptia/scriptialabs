export const themeNames = ['light', 'dark'] as const;

export type ThemeName = (typeof themeNames)[number];

export const productAccentMap = {
  scriptia: 'product-scriptia',
  padelco: 'product-padelco',
  'voice-agents': 'product-voice-agents'
} as const;

export type ProductAccent = keyof typeof productAccentMap;

// Tailwind's JIT scanner needs full literal class names in source, so this
// stays a literal record rather than `bg-${productAccentMap[accent]}`
// built at runtime — that string would never be generated.
export const productAccentBackgroundClassName: Record<ProductAccent, string> = {
  scriptia: 'bg-product-scriptia',
  padelco: 'bg-product-padelco',
  'voice-agents': 'bg-product-voice-agents'
};

export const productAccentTextClassName: Record<ProductAccent, string> = {
  scriptia: 'text-product-scriptia',
  padelco: 'text-product-padelco',
  'voice-agents': 'text-product-voice-agents'
};
