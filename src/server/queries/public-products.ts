import 'server-only';

import { unstable_cache } from 'next/cache';
import { and, asc, eq, isNotNull, ne } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { productFeatures, productLegalDocs, productLegalSections, products } from '@/server/db/schema';
import type { LocalizedParagraphs, LocalizedText, ProductPageCopy } from '@/server/db/schema';
import type { Locale } from '@/lib/i18n/routing';
import type {
  LegalDocView,
  ProductCardView,
  ProductFaqView,
  ProductLegalUrlView,
  ProductPageSectionsView,
  ProductPageView,
  ProductStepView
} from '@/server/content/product-view';

// THE publication predicate for the public site, written once.
//
// Every listing, every nav menu, every generateStaticParams, the sitemap and the
// resolver's own notFound() derive from the queries in this file. Nothing public
// may query `products` directly. Two predicates in two places is exactly how a
// product ends up linked from the products index and 404ing when you click it —
// so there is only one, and it lives here.
//
// A row is public iff it has a publishedAt and is not archived. A bet sitting in
// `backlog` has no row at all, so it is unlistable and unroutable by
// construction rather than by a filter someone has to remember to write.

export const PRODUCTS_TAG = 'public-products';
export const productTag = (slug: string) => `public-product:${slug}`;
export const productLegalTag = (slug: string) => `public-product-legal:${slug}`;

// One hour is a backstop for a missed tag purge, not the mechanism: correctness
// comes from revalidateTag, which lands in seconds. It also bounds the damage if
// a revalidation is ever dropped.
const REVALIDATE_SECONDS = 3600;

const isPublic = () => and(isNotNull(products.publishedAt), ne(products.status, 'archived'));

// unstable_cache rather than a bare query: Next only auto-caches `fetch`, and an
// uncached Drizzle call inside a layout opts that whole subtree into dynamic
// rendering — which would turn every public route from ● into ƒ and quietly
// undo the static-site guarantee docs/deployment.md checks for on every deploy.
const loadProductRows = unstable_cache(
  async () =>
    db
      .select({
        slug: products.slug,
        status: products.status,
        accent: products.accent,
        indexable: products.indexable,
        liveUrl: products.liveUrl,
        externalUrl: products.externalUrl,
        badges: products.badges,
        name: products.name,
        tagline: products.tagline,
        cardDescription: products.cardDescription,
        createdAt: products.createdAt
      })
      .from(products)
      .where(isPublic())
      // Stable ordering, and it happens to preserve the hand-written registry's
      // order for the migrated products since the seed writes them in that order.
      .orderBy(asc(products.createdAt), asc(products.slug)),
  ['public-products-list'],
  { tags: [PRODUCTS_TAG], revalidate: REVALIDATE_SECONDS }
);

const pick = (value: LocalizedText, locale: Locale) => value[locale];

function toCardView(row: Awaited<ReturnType<typeof loadProductRows>>[number], locale: Locale): ProductCardView {
  return {
    id: row.slug,
    slug: row.slug,
    status: row.status,
    accent: row.accent,
    canonical: `/${row.slug}`,
    name: pick(row.name, locale),
    cardDescription: pick(row.cardDescription, locale),
    tagline: pick(row.tagline, locale),
    liveUrl: row.liveUrl ?? undefined,
    externalUrl: row.externalUrl ?? undefined,
    indexable: row.indexable
  };
}

export async function listProductCardsFromDb(locale: Locale): Promise<ProductCardView[]> {
  const rows = await loadProductRows();
  return rows.map((row) => toCardView(row, locale));
}

export async function listProductSlugsFromDb(): Promise<string[]> {
  const rows = await loadProductRows();
  return rows.map((row) => row.slug);
}

const loadProductDetail = (slug: string) =>
  unstable_cache(
    async () => {
      const [row] = await db
        .select()
        .from(products)
        .where(and(isPublic(), eq(products.slug, slug)))
        .limit(1);

      if (!row) return null;

      const features = await db
        .select({ key: productFeatures.key, title: productFeatures.title, description: productFeatures.description })
        .from(productFeatures)
        .where(eq(productFeatures.productId, row.id))
        .orderBy(asc(productFeatures.sortOrder), asc(productFeatures.key));

      const legal = await db
        .select({ docKey: productLegalDocs.docKey, slug: productLegalDocs.slug, labelKey: productLegalDocs.labelKey })
        .from(productLegalDocs)
        .where(eq(productLegalDocs.productId, row.id))
        .orderBy(asc(productLegalDocs.sortOrder), asc(productLegalDocs.docKey));

      return { row, features, legal };
    },
    ['public-product-detail', slug],
    { tags: [PRODUCTS_TAG, productTag(slug), productLegalTag(slug)], revalidate: REVALIDATE_SECONDS }
  )();

/** Resolves the stored page copy for one locale, skipping absent sections. */
function toPageSections(pageCopy: ProductPageCopy | null, locale: Locale): ProductPageSectionsView {
  if (!pageCopy) return {};
  const one = (value: LocalizedText | undefined) => (value ? value[locale] : undefined);

  const steps: ProductStepView[] = (pageCopy.howItWorks?.steps ?? []).map((step) => ({
    title: step.title[locale],
    description: step.description[locale]
  }));
  const items: ProductFaqView[] = (pageCopy.faq?.items ?? []).map((item) => ({
    question: item.question[locale],
    answer: item.answer[locale]
  }));

  const ctaSecondary = one(pageCopy.cta?.secondary);
  const brandCta = one(pageCopy.brandCta);

  return {
    ...(pageCopy.overview ? { overview: { title: pageCopy.overview.title[locale], body: pageCopy.overview.body[locale] } } : {}),
    ...(pageCopy.capabilitiesTitle ? { capabilitiesTitle: pageCopy.capabilitiesTitle[locale] } : {}),
    ...(pageCopy.howItWorks
      ? { howItWorks: { title: pageCopy.howItWorks.title[locale], description: pageCopy.howItWorks.description[locale], steps } }
      : {}),
    ...(pageCopy.why ? { why: { title: pageCopy.why.title[locale], body: pageCopy.why.body[locale] } } : {}),
    ...(pageCopy.statusBlock ? { statusBlock: { title: pageCopy.statusBlock.title[locale], body: pageCopy.statusBlock.body[locale] } } : {}),
    ...(pageCopy.faq ? { faq: { title: pageCopy.faq.title[locale], items } } : {}),
    ...(pageCopy.cta
      ? {
          cta: {
            title: pageCopy.cta.title[locale],
            description: pageCopy.cta.description[locale],
            primary: pageCopy.cta.primary[locale],
            ...(ctaSecondary ? { secondary: ctaSecondary } : {})
          }
        }
      : {}),
    ...(brandCta ? { brandCta } : {})
  };
}

export async function getProductPageFromDb(locale: Locale, slug: string): Promise<ProductPageView | null> {
  const detail = await loadProductDetail(slug);
  if (!detail) return null;

  const { row, features, legal } = detail;

  return {
    id: row.slug,
    slug: row.slug,
    status: row.status,
    accent: row.accent,
    canonical: `/${row.slug}`,
    name: pick(row.name, locale),
    cardDescription: pick(row.cardDescription, locale),
    tagline: pick(row.tagline, locale),
    liveUrl: row.liveUrl ?? undefined,
    externalUrl: row.externalUrl ?? undefined,
    indexable: row.indexable,
    heroTitle: pick(row.heroTitle, locale),
    heroDescription: pick(row.heroDescription, locale),
    seoTitle: pick(row.seoTitle, locale),
    seoDescription: pick(row.seoDescription, locale),
    badges: row.badges,
    features: features.map((feature) => ({
      key: feature.key,
      title: pick(feature.title, locale),
      description: pick(feature.description, locale)
    })),
    page: toPageSections(row.pageCopy, locale),
    legalLinks: legal.map((document) => ({
      docKey: document.docKey,
      slug: document.slug,
      labelKey: document.labelKey ?? document.docKey
    }))
  };
}

const loadLegalDoc = (slug: string, legalSlug: string) =>
  unstable_cache(
    async () => {
      const [document] = await db
        .select({
          id: productLegalDocs.id,
          docKey: productLegalDocs.docKey,
          slug: productLegalDocs.slug,
          lastUpdated: productLegalDocs.lastUpdated,
          title: productLegalDocs.title,
          description: productLegalDocs.description
        })
        .from(productLegalDocs)
        .innerJoin(products, eq(products.id, productLegalDocs.productId))
        // The publication predicate again, joined through: an unpublished
        // product's legal documents must 404 with the product, not outlive it.
        .where(and(isPublic(), eq(products.slug, slug), eq(productLegalDocs.slug, legalSlug)))
        .limit(1);

      if (!document) return null;

      const sections = await db
        .select({ key: productLegalSections.key, title: productLegalSections.title, body: productLegalSections.body })
        .from(productLegalSections)
        .where(eq(productLegalSections.documentId, document.id))
        .orderBy(asc(productLegalSections.sortOrder), asc(productLegalSections.key));

      return { document, sections };
    },
    ['public-product-legal-doc', slug, legalSlug],
    { tags: [PRODUCTS_TAG, productTag(slug), productLegalTag(slug)], revalidate: REVALIDATE_SECONDS }
  )();

export async function getProductLegalDocFromDb(locale: Locale, slug: string, legalSlug: string): Promise<LegalDocView | null> {
  const result = await loadLegalDoc(slug, legalSlug);
  if (!result) return null;

  const { document, sections } = result;

  return {
    docKey: document.docKey,
    slug: document.slug,
    lastUpdated: document.lastUpdated,
    title: pick(document.title, locale),
    description: pick(document.description, locale),
    sections: sections.map((section) => ({
      id: section.key,
      title: pick(section.title, locale),
      body: (section.body as LocalizedParagraphs)[locale]
    }))
  };
}

export const listProductLegalUrlsFromDb = unstable_cache(
  async (): Promise<ProductLegalUrlView[]> =>
    db
      .select({ productSlug: products.slug, docSlug: productLegalDocs.slug, indexable: products.indexable })
      .from(productLegalDocs)
      .innerJoin(products, eq(products.id, productLegalDocs.productId))
      .where(isPublic())
      .orderBy(asc(products.slug), asc(productLegalDocs.sortOrder), asc(productLegalDocs.slug)),
  ['public-product-legal-urls'],
  { tags: [PRODUCTS_TAG], revalidate: REVALIDATE_SECONDS }
);

/** Every (product, legal) param pair, for generateStaticParams. */
export async function listProductLegalParams(): Promise<Array<{ slug: string; legalSlug: string }>> {
  const urls = await listProductLegalUrlsFromDb();
  return urls.map(({ productSlug, docSlug }) => ({ slug: productSlug, legalSlug: docSlug }));
}
