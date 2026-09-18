import 'server-only';

import { asc, desc, eq, sql } from 'drizzle-orm';

import { productAssetKinds, productDocumentKinds, singletonProductAssetKinds } from '@/content/internal';
import { contentSite } from '@/content/site';
import { routing } from '@/lib/i18n/routing';
import { db } from '@/server/db/client';
import { bets, productAssets, productDocuments, productFeatures, productLegalDocs, products } from '@/server/db/schema';

// Panel-side product reads.
//
// Deliberately NOT the cached helpers in queries/public-products.ts: those bake
// in the publication predicate and sit behind unstable_cache, which is exactly
// wrong here. The panel must see unpublished products (that is most of what it
// is for) and must see a write the instant it lands, not up to an hour later.

export async function getProductForBet(betId: string) {
  const [row] = await db
    .select({
      id: products.id,
      slug: products.slug,
      status: products.status,
      publishedAt: products.publishedAt,
      indexable: products.indexable,
      updatedAt: products.updatedAt,
      sourceExternalRunId: products.sourceExternalRunId
    })
    .from(products)
    .where(eq(products.betId, betId))
    .orderBy(desc(products.createdAt))
    .limit(1);

  return row ?? null;
}

export async function listProductsForPanel() {
  return db
    .select({
      id: products.id,
      slug: products.slug,
      status: products.status,
      publishedAt: products.publishedAt,
      indexable: products.indexable,
      updatedAt: products.updatedAt,
      betSlug: bets.slug,
      betTitle: bets.title
    })
    .from(products)
    .leftJoin(bets, eq(bets.id, products.betId))
    .orderBy(desc(products.updatedAt));
}

export async function getProductBySlugForPanel(slug: string) {
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!product) return null;

  // Assets and documents are not here: they come from getProductArtifactsBySlug,
  // which the bet page uses too, so the two pages cannot drift on what an
  // artifact list contains.
  const [features, legal] = await Promise.all([
    db.select().from(productFeatures).where(eq(productFeatures.productId, product.id)).orderBy(asc(productFeatures.sortOrder)),
    db.select().from(productLegalDocs).where(eq(productLegalDocs.productId, product.id)).orderBy(asc(productLegalDocs.sortOrder))
  ]);

  return { product, features, legal };
}

/**
 * Everything the product stage produced for a bet, for the bet page's Product tab.
 *
 * Counts are not enough here (that is what getBuildSummary is for): the point is
 * to read the identity document and download the logo without opening the run
 * directory on the machine that produced them.
 *
 * Document bodies are deliberately absent. There can be forty of them at up to
 * 256 KB each (see validation/products.ts), so the list carries a byte length and
 * the panel pulls one body when it is actually opened — the same split
 * getBetDocuments makes, and the reason loadProductDocument exists.
 */
export async function getProductArtifactsForBet(betId: string) {
  const [product] = await db
    .select({ id: products.id, slug: products.slug })
    .from(products)
    .where(eq(products.betId, betId))
    .orderBy(desc(products.createdAt))
    .limit(1);

  return product ? loadArtifacts(product) : null;
}

/** The same artifacts, addressed by product slug — for /internal/products/[slug]. */
export async function getProductArtifactsBySlug(slug: string) {
  const [product] = await db.select({ id: products.id, slug: products.slug }).from(products).where(eq(products.slug, slug)).limit(1);

  return product ? loadArtifacts(product) : null;
}

async function loadArtifacts(product: { id: string; slug: string }) {
  const [assets, documents] = await Promise.all([
    db.select().from(productAssets).where(eq(productAssets.productId, product.id)).orderBy(asc(productAssets.sortOrder)),
    db
      .select({
        id: productDocuments.id,
        kind: productDocuments.kind,
        path: productDocuments.path,
        name: productDocuments.name,
        checksum: productDocuments.checksum,
        sortOrder: productDocuments.sortOrder,
        updatedAt: productDocuments.updatedAt,
        size: sql<number>`length(${productDocuments.content})`
      })
      .from(productDocuments)
      .where(eq(productDocuments.productId, product.id))
      .orderBy(asc(productDocuments.sortOrder), asc(productDocuments.path))
  ]);

  // Ordered by the content layer's kind lists, not alphabetically by `kind`.
  // Alphabetical puts three Android icons ahead of the logo and the App Store
  // keyword file ahead of the identity — the declaration order in
  // product-assets.ts and product-document-kinds.ts is already the order someone
  // wants to read these in, so use it.
  return {
    productId: product.id,
    slug: product.slug,
    assets: byKind(assets, productAssetKinds),
    documents: byKind(documents, productDocumentKinds)
  };
}

function byKind<Kind extends string, Row extends { kind: Kind }>(rows: Row[], order: readonly Kind[]): Row[] {
  const rank = (kind: Kind) => {
    const index = order.indexOf(kind);
    // An unknown kind sorts last rather than first, which is what a -1 would do.
    return index === -1 ? order.length : index;
  };

  return [...rows].sort((a, b) => rank(a.kind) - rank(b.kind));
}

export type ProductArtifacts = NonNullable<Awaited<ReturnType<typeof getProductArtifactsForBet>>>;
export type ProductAssetRow = ProductArtifacts['assets'][number];
export type ProductDocumentRow = ProductArtifacts['documents'][number];

/**
 * What a build job would expose, for the confirmation modal.
 *
 * Counts rather than contents: the point is to let someone see at a glance that
 * the icon set is incomplete or the legal documents never landed, before a
 * builder scaffolds an app on top of them.
 */
export async function getBuildSummary(betId: string) {
  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      publishedAt: products.publishedAt,
      storeMetadata: products.storeMetadata
    })
    .from(products)
    .where(eq(products.betId, betId))
    .orderBy(desc(products.createdAt))
    .limit(1);

  if (!product) return null;

  const [features, legal, assets] = await Promise.all([
    db.select({ key: productFeatures.key }).from(productFeatures).where(eq(productFeatures.productId, product.id)),
    db.select({ docKey: productLegalDocs.docKey }).from(productLegalDocs).where(eq(productLegalDocs.productId, product.id)),
    db.select({ kind: productAssets.kind }).from(productAssets).where(eq(productAssets.productId, product.id))
  ]);

  const present = new Set(assets.map((asset) => asset.kind));
  const store = (product.storeMetadata ?? null) as Record<string, unknown> | null;
  const pending = store && typeof store.fields_pending === 'number' ? store.fields_pending : null;

  return {
    slug: product.slug,
    published: Boolean(product.publishedAt),
    featureCount: features.length,
    assetCount: assets.length,
    legalDocumentCount: legal.length,
    hasStore: Boolean(store && Object.keys(store).length > 0),
    storeFieldsPending: pending,
    // Only the one-per-product kinds; a missing screenshot is not the same class
    // of problem as a missing app icon.
    missingAssetKinds: singletonProductAssetKinds.filter((kind) => !present.has(kind)),
    liveUrl: `${contentSite.url}/${routing.defaultLocale}/${product.slug}`
  };
}
