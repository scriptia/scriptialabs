'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { isProductStatus } from '@/content/products';
import { recordAudit } from '@/server/audit';
import { requireUser } from '@/server/auth/guard';
import { db } from '@/server/db/client';
import { products } from '@/server/db/schema';
import { revalidateAllProducts, revalidateProduct } from '@/server/products/revalidate';

export type ProductActionState = { error?: string; ok?: boolean };

// The manual controls over what the public site shows.
//
// These ship in the same phase as the publish route on purpose. That route is
// the first thing in this project that can break the live site, and shipping it
// without an unpublish button would mean the only remedy for a bad
// machine-written page was another hours-long pipeline run.

async function loadProduct(id: string) {
  const [row] = await db
    .select({ id: products.id, slug: products.slug, status: products.status, publishedAt: products.publishedAt, indexable: products.indexable })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return row ?? null;
}

function refresh(slug: string) {
  revalidateProduct(slug);
  revalidatePath('/internal/products');
  revalidatePath(`/internal/products/${slug}`);
}

export async function publishProduct(formData: FormData): Promise<ProductActionState> {
  const user = await requireUser();
  const product = await loadProduct(String(formData.get('id') ?? ''));
  if (!product) return { error: 'That product no longer exists.' };
  if (product.publishedAt) return { ok: true };

  const now = new Date();
  await db.update(products).set({ publishedAt: now, updatedAt: now }).where(eq(products.id, product.id));
  await recordAudit({ actorId: user.id, entity: 'product', entityId: product.id, action: 'update', diff: { publishedAt: { from: null, to: now.toISOString() } } });

  refresh(product.slug);
  return { ok: true };
}

/**
 * Takes a product off the public site.
 *
 * Clearing `publishedAt` removes it from the resolver, every listing, the navbar,
 * the footer and the sitemap in one move — because all of those read the same
 * predicate. That is the whole reason there is only one predicate: unpublishing
 * cannot leave a link pointing at a page that now 404s.
 */
export async function unpublishProduct(formData: FormData): Promise<ProductActionState> {
  const user = await requireUser();
  const product = await loadProduct(String(formData.get('id') ?? ''));
  if (!product) return { error: 'That product no longer exists.' };

  await db.update(products).set({ publishedAt: null, updatedAt: new Date() }).where(eq(products.id, product.id));
  await recordAudit({
    actorId: user.id,
    entity: 'product',
    entityId: product.id,
    action: 'update',
    diff: { publishedAt: { from: product.publishedAt?.toISOString() ?? null, to: null } }
  });

  refresh(product.slug);
  return { ok: true };
}

/** Whether search engines are told about this page. Drives both the sitemap and its robots meta. */
export async function setProductIndexable(formData: FormData): Promise<ProductActionState> {
  const user = await requireUser();
  const product = await loadProduct(String(formData.get('id') ?? ''));
  if (!product) return { error: 'That product no longer exists.' };

  const indexable = formData.get('indexable') === 'on' || formData.get('indexable') === 'true';
  if (indexable === product.indexable) return { ok: true };

  await db.update(products).set({ indexable, updatedAt: new Date() }).where(eq(products.id, product.id));
  await recordAudit({ actorId: user.id, entity: 'product', entityId: product.id, action: 'update', diff: { indexable: { from: product.indexable, to: indexable } } });

  refresh(product.slug);
  return { ok: true };
}

export async function setProductStatus(formData: FormData): Promise<ProductActionState> {
  const user = await requireUser();
  const product = await loadProduct(String(formData.get('id') ?? ''));
  if (!product) return { error: 'That product no longer exists.' };

  const status = String(formData.get('status') ?? '');
  if (!isProductStatus(status)) return { error: 'Unknown status.' };
  if (status === product.status) return { ok: true };

  await db.update(products).set({ status, updatedAt: new Date() }).where(eq(products.id, product.id));
  await recordAudit({ actorId: user.id, entity: 'product', entityId: product.id, action: 'update', diff: { status: { from: product.status, to: status } } });

  refresh(product.slug);
  return { ok: true };
}

/**
 * Manual cache purge.
 *
 * Correctness comes from revalidateProduct being called on every write, and
 * `revalidate: 3600` bounds the worst case anyway — but when a page looks stale
 * the useful thing is a button, not an hour of waiting to find out whether it
 * was going to fix itself.
 */
export async function revalidateProductNow(formData: FormData): Promise<ProductActionState> {
  await requireUser();
  const slug = String(formData.get('slug') ?? '');

  if (slug) {
    revalidateProduct(slug);
    revalidatePath(`/internal/products/${slug}`);
  } else {
    revalidateAllProducts();
  }
  revalidatePath('/internal/products');

  return { ok: true };
}
