import type { MetadataRoute } from 'next';

import { legalDocuments } from '@/content/legal';
import { productLegalDocuments } from '@/content/legal/product-legal';
import { products } from '@/content/products';
import { routing } from '@/lib/i18n/routing';
import { canonicalRoutes } from '@/lib/routing/routes';
import { buildCanonicalPath, buildLanguageAlternates } from '@/lib/seo/canonical';

export default function sitemap(): MetadataRoute.Sitemap {
  const companyRoutes = [canonicalRoutes.home, canonicalRoutes.products, canonicalRoutes.about, canonicalRoutes.careers, canonicalRoutes.blog, canonicalRoutes.press, canonicalRoutes.contact];
  const legalRoutes = Object.values(legalDocuments).map((document) => `/${document.slug}`);
  const productRoutes = products.filter((product) => product.status !== 'archived').map((product) => `/${product.slug}`);
  const productLegalRoutes = Object.entries(productLegalDocuments).flatMap(([productId, documents]) => {
    const product = products.find((candidate) => candidate.id === productId);
    return product ? Object.values(documents).map((document) => `${product.links.canonical}/legal/${document.slug}`) : [];
  });
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
