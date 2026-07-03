import { routing } from '@/lib/i18n/routing';

export const supportedLocales = routing.locales;
export type SupportedLocale = (typeof supportedLocales)[number];

export const localeDefault = routing.defaultLocale;

export const canonicalRoutes = {
  home: '/',
  scriptia: '/scriptia',
  padelco: '/padelco',
  voiceAgents: '/voice-agents',
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  contact: '/contact',
  security: '/security',
  aiPolicy: '/ai-policy',
  products: '/products',
  about: '/about',
  careers: '/careers',
  blog: '/blog',
  press: '/press'
} as const;
