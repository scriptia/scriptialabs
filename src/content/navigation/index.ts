import { contentSite } from '@/content/site';
import { products } from '@/content/products';
import type { Locale } from '@/lib/i18n/routing';

export type NavigationItem = {
  labelKey: string;
  href: string;
  external?: boolean;
};

export type NavigationGroup = {
  titleKey: string;
  items: NavigationItem[];
};

export type ProductNavigationItem = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  href: string;
  status: string;
  accent: string;
  external?: boolean;
};

export const navigationModel = {
  primary: [
    { labelKey: 'navigation.products', href: '/products' },
    { labelKey: 'navigation.about', href: '/about' },
    { labelKey: 'navigation.careers', href: '/careers' },
    { labelKey: 'navigation.blog', href: '/blog' },
    { labelKey: 'navigation.contact', href: '/contact' }
  ] satisfies NavigationItem[],
  products: products
    .filter((product) => product.status !== 'archived')
    .map(
      (product) =>
        ({
          id: product.id,
          labelKey: product.nameKey,
          descriptionKey: product.descriptionKey,
          href: product.links.canonical,
          status: product.status,
          accent: product.accent,
          external: Boolean(product.links.external)
        }) satisfies ProductNavigationItem
    ),
  footer: {
    company: {
      titleKey: 'navigation.company',
      items: [
        { labelKey: 'navigation.about', href: '/about' },
        { labelKey: 'navigation.careers', href: '/careers' },
        { labelKey: 'navigation.blog', href: '/blog' },
        { labelKey: 'navigation.press', href: '/press' },
        { labelKey: 'navigation.contact', href: '/contact' }
      ] satisfies NavigationItem[]
    } satisfies NavigationGroup,
    products: {
      titleKey: 'navigation.products',
      items: products
        .filter((product) => product.status !== 'archived')
        .map(
          (product) =>
            ({
              labelKey: product.nameKey,
              href: product.links.canonical,
              external: Boolean(product.links.external)
            }) satisfies NavigationItem
        )
    } satisfies NavigationGroup,
    legal: {
      titleKey: 'navigation.legal',
      items: [
        { labelKey: 'navigation.privacy', href: '/privacy' },
        { labelKey: 'navigation.terms', href: '/terms' },
        { labelKey: 'navigation.cookies', href: '/cookies' }
      ] satisfies NavigationItem[]
    } satisfies NavigationGroup,
    socials: {
      titleKey: 'navigation.socials',
      items: [
        { labelKey: 'social.x', href: contentSite.social.x, external: true },
        { labelKey: 'social.linkedin', href: contentSite.social.linkedin, external: true }
      ] satisfies NavigationItem[]
    } satisfies NavigationGroup
  }
} as const;

export function localizePath(locale: Locale, href: string) {
  return `/${locale}${href}`;
}
