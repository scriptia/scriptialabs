import { contentSite } from '@/content/site';
import { products, type ProductStatus } from '@/content/products';
import { legalDocuments } from '@/content/legal';
import type { ProductAccent } from '@/design/theme';

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
  status: ProductStatus;
  accent: ProductAccent;
  external?: boolean;
};

export const navigationModel = {
  primary: [{ labelKey: 'navigation.products', href: '/products' }] as NavigationItem[],
  products: products
    .filter((product) => product.status !== 'archived')
    .map(
      (product) =>
        ({
          id: product.id,
          labelKey: product.nameKey,
          descriptionKey: product.descriptionKey,
          href: product.links.external ?? product.links.canonical,
          status: product.status,
          accent: product.accent,
          external: Boolean(product.links.external)
        }) satisfies ProductNavigationItem
    ),
  footer: {
    company: {
      titleKey: 'navigation.company',
      items: [
        // Products index + Contact are the only company pages that exist today.
        // (`/press`, `/about`, … are declared in the route registry but have no
        // page yet — don't link them until they do.)
        { labelKey: 'navigation.products', href: '/products' },
        { labelKey: 'navigation.contact', href: '/contact' }
      ] as NavigationItem[]
    } satisfies NavigationGroup,
    products: {
      titleKey: 'navigation.products',
      items: products
        .filter((product) => product.status !== 'archived')
        .map(
          (product) =>
            ({
              labelKey: product.nameKey,
              href: product.links.external ?? product.links.canonical,
              external: Boolean(product.links.external)
            }) satisfies NavigationItem
        )
    } satisfies NavigationGroup,
    legal: {
      titleKey: 'navigation.legal',
      // Derived from the legal document registry rather than hardcoded, so
      // a 7th legal page needs a registry entry, not a footer edit. Contact
      // is excluded here — it already lives in the Company group above.
      items: Object.entries(legalDocuments)
        .filter(([key]) => key !== 'contact')
        .map(([key, document]) => ({
          labelKey: `navigation.${key}`,
          href: `/${document.slug}`
        })) as NavigationItem[]
    } satisfies NavigationGroup,
    socials: {
      titleKey: 'navigation.socials',
      items: [
        { labelKey: 'social.x', href: contentSite.social.x, external: true },
        { labelKey: 'social.linkedin', href: contentSite.social.linkedin, external: true }
      ] as NavigationItem[]
    } satisfies NavigationGroup
  }
};
