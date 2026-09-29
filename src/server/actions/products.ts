'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { isProductStatus } from '@/content/products';
import { recordAudit } from '@/server/audit';
import { requireUser } from '@/server/auth/guard';
import { db } from '@/server/db/client';
import { productDocuments, products } from '@/server/db/schema';
import { clearAppStoreListing, importAppStoreListing } from '@/server/products/app-store-import';
import { revalidateAllProducts, revalidateProduct } from '@/server/products/revalidate';
import { isPlayStoreUrl, parseAppStoreUrl } from '@/server/products/store-urls';

export type ProductActionState = { error?: string; ok?: boolean; warning?: string; message?: string };

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

// Document bodies run to hundreds of KB across a product, so the artifact lists
// carry no content and one body is pulled when it is actually opened — same
// split as loadBetDocument in actions/bet-details.ts, and an action rather than
// a route handler for the same reason: this is a panel read behind the guard the
// page already uses. Downloading is the route handler's job, because that needs
// a Content-Disposition an action cannot set.
export async function loadProductDocument(id: string): Promise<{ content?: string; error?: string }> {
  await requireUser();

  const [row] = await db.select({ content: productDocuments.content }).from(productDocuments).where(eq(productDocuments.id, id)).limit(1);

  if (!row) {
    return { error: 'That document no longer exists.' };
  }

  return { content: row.content };
}

// The store listings. Saved by hand once the app is live: the App Store link
// triggers an import of the listing's icon and iPhone screenshots onto the
// product page, the Play link is only ever a badge (Google has no public lookup
// API to import from).

function describeImport(result: Extract<Awaited<ReturnType<typeof importAppStoreListing>>, { ok: true }>) {
  const parts = [result.iconImported ? 'icon' : null, `${result.screenshotCount} screenshot${result.screenshotCount === 1 ? '' : 's'}`].filter(Boolean);
  return `Imported ${parts.join(' and ')} from the App Store.`;
}

export async function setProductStoreLinks(formData: FormData): Promise<ProductActionState> {
  const user = await requireUser();
  const [product] = await db
    .select({ id: products.id, slug: products.slug, appStoreUrl: products.appStoreUrl, playStoreUrl: products.playStoreUrl })
    .from(products)
    .where(eq(products.id, String(formData.get('id') ?? '')))
    .limit(1);
  if (!product) return { error: 'That product no longer exists.' };

  const appStoreUrl = String(formData.get('appStoreUrl') ?? '').trim() || null;
  const playStoreUrl = String(formData.get('playStoreUrl') ?? '').trim() || null;

  if (appStoreUrl && !parseAppStoreUrl(appStoreUrl)) {
    return { error: 'The App Store link should look like https://apps.apple.com/es/app/name/id123456789.' };
  }
  if (playStoreUrl && !isPlayStoreUrl(playStoreUrl)) {
    return { error: 'The Google Play link should look like https://play.google.com/store/apps/details?id=com.example.app.' };
  }

  // Compared by app id, not string: the importer canonicalises the stored URL,
  // so pasting the same listing with a `?l=en` must not re-import it.
  const appStoreChanged = parseAppStoreUrl(appStoreUrl ?? '')?.id !== parseAppStoreUrl(product.appStoreUrl ?? '')?.id;

  // The id is stored here as well as by the importer, so the Smart App Banner
  // works from the moment the link is saved even if the image import fails.
  const appStoreId = parseAppStoreUrl(appStoreUrl ?? '')?.id ?? null;
  await db.update(products).set({ appStoreUrl, appStoreId, playStoreUrl, updatedAt: new Date() }).where(eq(products.id, product.id));
  await recordAudit({
    actorId: user.id,
    entity: 'product',
    entityId: product.id,
    action: 'update',
    diff: {
      ...(appStoreUrl !== product.appStoreUrl ? { appStoreUrl: { from: product.appStoreUrl, to: appStoreUrl } } : {}),
      ...(playStoreUrl !== product.playStoreUrl ? { playStoreUrl: { from: product.playStoreUrl, to: playStoreUrl } } : {})
    }
  });

  let state: ProductActionState = { ok: true, message: 'Saved.' };
  if (appStoreChanged) {
    if (appStoreUrl) {
      const result = await importAppStoreListing({ id: product.id, slug: product.slug, appStoreUrl });
      // The link is kept even when the import fails: the badge still works, and
      // Re-import can fetch the images once whatever went wrong is fixed.
      state = result.ok ? { ok: true, message: describeImport(result), warning: result.warning } : { error: `Link saved, but the import failed: ${result.error}` };
    } else {
      await clearAppStoreListing(product.id);
      state = { ok: true, message: 'App Store link removed, along with its imported images.' };
    }
  }

  refresh(product.slug);
  return state;
}

/** Re-reads the App Store listing, for when a new version ships new screenshots. */
export async function reimportFromAppStore(formData: FormData): Promise<ProductActionState> {
  const user = await requireUser();
  const [product] = await db
    .select({ id: products.id, slug: products.slug, appStoreUrl: products.appStoreUrl })
    .from(products)
    .where(eq(products.id, String(formData.get('id') ?? '')))
    .limit(1);
  if (!product) return { error: 'That product no longer exists.' };
  if (!product.appStoreUrl) return { error: 'Save an App Store link first.' };

  const result = await importAppStoreListing({ id: product.id, slug: product.slug, appStoreUrl: product.appStoreUrl });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    actorId: user.id,
    entity: 'product',
    entityId: product.id,
    action: 'update',
    diff: { storeListing: { from: null, to: `reimported ${result.screenshotCount} screenshots` } }
  });

  refresh(product.slug);
  return { ok: true, message: describeImport(result), warning: result.warning };
}
