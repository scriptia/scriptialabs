import 'server-only';

import { asc, desc, eq } from 'drizzle-orm';

import { singletonProductAssetKinds } from '@/content/internal';
import { contentSite } from '@/content/site';
import { routing } from '@/lib/i18n/routing';
import { db } from '@/server/db/client';
import { bets, productAssets, productFeatures, productLegalDocs, products } from '@/server/db/schema';

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

  const [features, legal, assets] = await Promise.all([
    db.select().from(productFeatures).where(eq(productFeatures.productId, product.id)).orderBy(asc(productFeatures.sortOrder)),
    db.select().from(productLegalDocs).where(eq(productLegalDocs.productId, product.id)).orderBy(asc(productLegalDocs.sortOrder)),
    db.select().from(productAssets).where(eq(productAssets.productId, product.id)).orderBy(asc(productAssets.kind), asc(productAssets.sortOrder))
  ]);

  return { product, features, legal, assets };
}

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
