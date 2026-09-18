import type { MetadataRoute } from 'next';

import { legalDocuments } from '@/content/legal';
import { routing } from '@/lib/i18n/routing';
import { canonicalRoutes } from '@/lib/routing/routes';
import { buildCanonicalPath, buildLanguageAlternates } from '@/lib/seo/canonical';
import { listProductCards, listProductLegalUrls } from '@/server/content/products';

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
  const companyRoutes = [canonicalRoutes.home, canonicalRoutes.products, canonicalRoutes.contact];
  const legalRoutes = Object.values(legalDocuments).map((document) => `/${document.slug}`);

  const [productCards, productLegalUrls] = await Promise.all([listProductCards(routing.defaultLocale), listProductLegalUrls()]);

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

  return routing.locales.flatMap((locale) =>
    routes.map((path) => ({
      url: buildCanonicalPath(locale, path),
      lastModified: new Date(),
      alternates: {
        languages: buildLanguageAlternates(path)
      }
    }))
  );
}
