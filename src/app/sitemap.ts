import type { MetadataRoute } from 'next';

import { articlesSegment } from '@/content/articles';
import { legalDocuments } from '@/content/legal';
import { routing, type Locale } from '@/lib/i18n/routing';
import { canonicalRoutes } from '@/lib/routing/routes';
import { buildCanonicalPath, buildLanguageAlternates } from '@/lib/seo/canonical';
import { listProductArticleUrls, listProductCards, listProductLegalUrls } from '@/server/content/products';

// Route handlers are not tag-aware, so this is purged by path from
// server/products/revalidate.ts whenever a product's publication state changes.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only routes that actually render. `canonicalRoutes` is a registry of
  // intended URLs, not of built pages: `/about`, `/careers`, `/blog` and
  // `/press` are declared there but have no page.tsx, so submitting them told
  // Google about 12 URLs (4 routes x 3 locales) that 404. The footer already
  // excludes them for the same reason — see src/content/navigation/index.ts.
  // Add one back here only when its page exists.
  const companyRoutes = [canonicalRoutes.home, canonicalRoutes.pipeline, canonicalRoutes.products, canonicalRoutes.contact];
  const legalRoutes = Object.values(legalDocuments).map((document) => `/${document.slug}`);

  const [productCards, productLegalUrls, articleUrls] = await Promise.all([listProductCards(routing.defaultLocale), listProductLegalUrls(), listProductArticleUrls()]);

  // The invariant: this sitemap contains exactly the URLs whose pages do not
  // say noindex. Before, it submitted every non-archived product while three of
  // them rendered `<meta name="robots" content="noindex">` — a page telling
  // Google to stay away from a URL the sitemap was advertising.
  //
  // A product page is noindex iff `indexable` is false, so it is listed iff
  // `indexable` is true. The practical effect: a product at `ready` is live and
  // linked from the navbar, the footer, the homepage and /products, but is not
  // submitted to search until a human flips `indexable` in the panel — normally
  // when it actually ships.
  const productRoutes = productCards.filter((product) => product.indexable).map((product) => product.canonical);

  // Legal pages are NOT filtered by `indexable`, and that is not an oversight.
  // They never render noindex, so excluding them would break the invariant above
  // in the opposite direction. They are also real, resolving, useful pages
  // regardless of whether the product has launched — and they are precisely the
  // URLs App Store review fetches, so they should be as discoverable as possible.
  const productLegalRoutes = productLegalUrls.map((url) => `/${url.productSlug}/legal/${url.docSlug}`);

  const routes = [...companyRoutes, ...legalRoutes, ...productRoutes, ...productLegalRoutes];

  const pages: MetadataRoute.Sitemap = routing.locales.flatMap((locale) =>
    routes.map((path) => ({
      url: buildCanonicalPath(locale, path),
      lastModified: new Date(),
      alternates: {
        languages: buildLanguageAlternates(path)
      }
    }))
  );

  return [...pages, ...articleEntries(articleUrls)];
}

// Articles (ADR-014) are NOT a routes x locales matrix: each exists only in the
// locales it was written for, so each gets its own entry, alternates only for
// the translations that exist, and a lastModified that is the real date its words
// last changed. Same `indexable` rule as the product page they belong to.
function articleEntries(urls: Awaited<ReturnType<typeof listProductArticleUrls>>): MetadataRoute.Sitemap {
  const indexable = urls.filter((url) => url.indexable);
  const articlePath = (productSlug: string, slug: string) => `/${productSlug}/${articlesSegment}/${slug}`;

  const articles = indexable.map((url) => {
    const translations = indexable.filter((other) => other.productSlug === url.productSlug && other.translationKey === url.translationKey);
    return {
      url: buildCanonicalPath(url.locale as Locale, articlePath(url.productSlug, url.slug)),
      lastModified: new Date(url.updatedAt),
      alternates: {
        languages: Object.fromEntries(translations.map((other) => [other.locale, buildCanonicalPath(other.locale as Locale, articlePath(other.productSlug, other.slug))]))
      }
    };
  });

  // One guides index per (product, locale) that has articles, dated by its newest article.
  const indexes = new Map<string, { productSlug: string; locale: Locale; lastModified: number }>();
  for (const url of indexable) {
    const key = `${url.productSlug}:${url.locale}`;
    const modified = new Date(url.updatedAt).getTime();
    const current = indexes.get(key);
    if (!current || current.lastModified < modified) indexes.set(key, { productSlug: url.productSlug, locale: url.locale as Locale, lastModified: modified });
  }
  const guideIndexes = [...indexes.values()].map((entry) => {
    const path = `/${entry.productSlug}/${articlesSegment}`;
    const locales = [...indexes.values()].filter((other) => other.productSlug === entry.productSlug).map((other) => other.locale);
    return {
      url: buildCanonicalPath(entry.locale, path),
      lastModified: new Date(entry.lastModified),
      alternates: { languages: Object.fromEntries(locales.map((locale) => [locale, buildCanonicalPath(locale, path)])) }
    };
  });

  return [...guideIndexes, ...articles];
}
