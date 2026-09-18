export const themeNames = ['light', 'dark'] as const;

export type ThemeName = (typeof themeNames)[number];

export const productAccentMap = {
  scriptia: 'product-scriptia',
  padelco: 'product-padelco',
  'voice-agents': 'product-voice-agents',
  speaklio: 'product-speaklio',
  accento: 'product-accento',
  nailio: 'product-nailio',
  bravo: 'product-bravo',
  // Auto-provisioned pool for programmatically created products — see
  // ADR-012. A new app is assigned one of these six rather than getting a
  // bespoke hue picked for it; the six CSS custom properties already exist
  // in src/styles/global.css, so adding a product never requires a style
  // change, only a data change.
  'auto-1': 'product-auto-1',
  'auto-2': 'product-auto-2',
  'auto-3': 'product-auto-3',
  'auto-4': 'product-auto-4',
  'auto-5': 'product-auto-5',
  'auto-6': 'product-auto-6'
} as const;

export type ProductAccent = keyof typeof productAccentMap;

// Tailwind's JIT scanner needs full literal class names in source, so this
// stays a literal record rather than `bg-${productAccentMap[accent]}`
// built at runtime — that string would never be generated.
export const productAccentBackgroundClassName: Record<ProductAccent, string> = {
  scriptia: 'bg-product-scriptia',
  padelco: 'bg-product-padelco',
  'voice-agents': 'bg-product-voice-agents',
  speaklio: 'bg-product-speaklio',
  accento: 'bg-product-accento',
  nailio: 'bg-product-nailio',
  bravo: 'bg-product-bravo',
  'auto-1': 'bg-product-auto-1',
  'auto-2': 'bg-product-auto-2',
  'auto-3': 'bg-product-auto-3',
  'auto-4': 'bg-product-auto-4',
  'auto-5': 'bg-product-auto-5',
  'auto-6': 'bg-product-auto-6'
};

export const productAccentTextClassName: Record<ProductAccent, string> = {
  scriptia: 'text-product-scriptia',
  padelco: 'text-product-padelco',
  'voice-agents': 'text-product-voice-agents',
  speaklio: 'text-product-speaklio',
  accento: 'text-product-accento',
  nailio: 'text-product-nailio',
  bravo: 'text-product-bravo',
  'auto-1': 'text-product-auto-1',
  'auto-2': 'text-product-auto-2',
  'auto-3': 'text-product-auto-3',
  'auto-4': 'text-product-auto-4',
  'auto-5': 'text-product-auto-5',
  'auto-6': 'text-product-auto-6'
};

// Per-product theme scope class (defined in src/styles/global.css). A product
// page wraps its content in this class so shared components re-theme to that
// product's identity. voice-agents, accento, nailio and bravo have no bespoke
// scope yet, so they render on the base Scriptia/Labs theme — represented by an
// empty string; they still carry their own accent tint above. Auto-slotted
// products follow the same pattern: an accent tint, no bespoke theme scope.
export const productThemeClassName: Record<ProductAccent, string> = {
  scriptia: 'theme-scriptia',
  padelco: 'theme-padelco',
  'voice-agents': '',
  speaklio: 'theme-speaklio',
  accento: '',
  nailio: '',
  bravo: '',
  'auto-1': '',
  'auto-2': '',
  'auto-3': '',
  'auto-4': '',
  'auto-5': '',
  'auto-6': ''
};
