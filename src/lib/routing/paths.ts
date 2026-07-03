import type { Locale } from '@/lib/i18n/routing';

export function stripLocalePrefix(pathname: string, locale: Locale) {
  const prefix = `/${locale}`;

  if (pathname === prefix) {
    return '/';
  }

  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length);
  }

  return pathname;
}

export function localizePath(locale: Locale, href: string) {
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

export function isPathActive(pathname: string, href: string, locale: Locale) {
  const normalizedPath = stripLocalePrefix(pathname, locale);
  return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
}
