import { routing, type Locale } from './routing';

export function isSupportedLocale(value: string): value is Locale {
  return routing.locales.includes(value as Locale);
}

export function resolveLocale(value: string | undefined | null): Locale {
  if (value && isSupportedLocale(value)) {
    return value;
  }

  return routing.defaultLocale;
}
