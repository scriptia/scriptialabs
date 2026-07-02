export const themeNames = ['light', 'dark'] as const;

export type ThemeName = (typeof themeNames)[number];

export const productAccentMap = {
  scriptia: 'product-scriptia',
  padelco: 'product-padelco',
  'voice-agents': 'product-voice-agents'
} as const;
