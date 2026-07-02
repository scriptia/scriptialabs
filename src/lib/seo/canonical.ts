import { contentSite } from '@/content/site';
import { routing, type Locale } from '@/lib/i18n/routing';

export function buildCanonicalPath(locale: Locale, pathname = '/') {
  return `${contentSite.url}/${locale}${pathname === '/' ? '' : pathname}`;
}

export function buildLanguageAlternates(pathname = '/') {
  return Object.fromEntries(routing.locales.map((locale) => [locale, buildCanonicalPath(locale, pathname)]));
}
