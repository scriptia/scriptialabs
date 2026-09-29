import 'server-only';

import { del } from '@vercel/blob';
import { and, eq, gte, inArray } from 'drizzle-orm';

import { storeListingAssetKinds } from '@/content/internal';
import { db } from '@/server/db/client';
import { productAssets, products } from '@/server/db/schema';
import { uploadProductAsset } from '@/server/storage/blob';

import { readImageSize } from './image-size';
import { parseAppStoreUrl, upscaleArtworkUrl, upscaleScreenshotUrl } from './store-urls';

// Pulls a shipped app's icon and iPhone screenshots off its public App Store
// listing and stores them as `storeIcon` / `storeScreenshot` assets, so the
// product page shows the real app instead of the letter placeholder.
//
// The source is the iTunes Lookup API: public, unauthenticated, and the same
// data apps.apple.com renders. It is NOT App Store Connect — that integration
// (integrations/app-store-connect.ts) reads metrics for the content engine and
// needs a key; this needs nothing but the listing URL.
//
// The images are copied into our own blob store rather than hotlinked. mzstatic
// URLs change with every app version, and a product page that silently loses
// its screenshots the day an update ships is worse than one that is a version
// behind until someone presses Re-import.

const LOOKUP_URL = 'https://itunes.apple.com/lookup';
const MAX_SCREENSHOTS = 8;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

type LookupResult = {
  trackId?: number;
  trackName?: string;
  trackViewUrl?: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  screenshotUrls?: string[];
};

export type AppStoreImportResult =
  | { ok: true; appStoreId: string; appStoreUrl: string; iconImported: boolean; screenshotCount: number; warning?: string }
  | { ok: false; error: string };

async function lookup(id: string, country: string): Promise<LookupResult | null> {
  const response = await fetch(`${LOOKUP_URL}?id=${encodeURIComponent(id)}&country=${encodeURIComponent(country)}&entity=software`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`The App Store lookup answered HTTP ${response.status}.`);
  const body = (await response.json()) as { resultCount?: number; results?: LookupResult[] };
  return body.results?.[0] ?? null;
}

type Downloaded = { bytes: Buffer; contentType: string; extension: string; width: number | null; height: number | null };

async function download(url: string): Promise<Downloaded> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new Error(`Unexpected size (${bytes.length} bytes) for ${url}`);

  const isPng = bytes.readUInt32BE(0) === 0x89504e47;
  const size = readImageSize(bytes);
  return {
    bytes,
    contentType: isPng ? 'image/png' : 'image/jpeg',
    extension: isPng ? 'png' : 'jpg',
    width: size?.width ?? null,
    height: size?.height ?? null
  };
}

/** The larger rendition when mzstatic serves it, the URL as Apple returned it when not. */
async function downloadPreferring(preferred: string, original: string): Promise<Downloaded> {
  if (preferred !== original) {
    try {
      return await download(preferred);
    } catch {
      // Fall through: the rewritten size is a nicety, not a requirement.
    }
  }
  return download(original);
}

/** Deletes blobs no row points at any more. Best effort: an orphaned file costs pennies, a thrown import costs the page. */
async function deleteBlobs(pathnames: string[]) {
  if (pathnames.length === 0 || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(pathnames);
  } catch (error) {
    console.warn('[app-store-import] could not delete replaced blobs:', error);
  }
}

export async function importAppStoreListing(product: Readonly<{ id: string; slug: string; appStoreUrl: string }>): Promise<AppStoreImportResult> {
  const parsed = parseAppStoreUrl(product.appStoreUrl);
  if (!parsed) return { ok: false, error: 'That is not an App Store app URL (expected apps.apple.com/…/id123456789).' };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: 'BLOB_READ_WRITE_TOKEN is not configured on this deployment, so the listing images cannot be stored.' };
  }

  let listing: LookupResult | null;
  try {
    listing = await lookup(parsed.id, parsed.country);
  } catch (error) {
    return { ok: false, error: `Could not reach the App Store: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!listing) {
    return {
      ok: false,
      error: `The App Store has no app ${parsed.id} in the "${parsed.country}" storefront. If the app is only sold elsewhere, use that country's link.`
    };
  }

  const artwork = listing.artworkUrl512 ?? listing.artworkUrl100;
  const screenshotUrls = (listing.screenshotUrls ?? []).slice(0, MAX_SCREENSHOTS);

  const [icon, ...screenshots] = await Promise.allSettled([
    artwork ? downloadPreferring(upscaleArtworkUrl(artwork), artwork) : Promise.reject(new Error('The listing has no artwork.')),
    ...screenshotUrls.map((url) => downloadPreferring(upscaleScreenshotUrl(url), url))
  ]);

  // Upload before touching any row: the driver has no transactions, so the
  // only safe order is "new files exist, then rows point at them, then old
  // files go". A failure part-way leaves the page showing the previous import.
  const uploads: Array<{ kind: (typeof storeListingAssetKinds)[number]; sortOrder: number; image: Downloaded }> = [];
  if (icon.status === 'fulfilled') uploads.push({ kind: 'storeIcon', sortOrder: 0, image: icon.value });
  screenshots.forEach((result) => {
    if (result.status === 'fulfilled') uploads.push({ kind: 'storeScreenshot', sortOrder: uploads.filter((u) => u.kind === 'storeScreenshot').length, image: result.value });
  });

  let stored: Array<(typeof uploads)[number] & { url: string; pathname: string; checksum: string }>;
  try {
    stored = await Promise.all(
      uploads.map(async (upload) => ({
        ...upload,
        ...(await uploadProductAsset({
          slug: product.slug,
          name: `store/${upload.kind}-${upload.sortOrder}.${upload.image.extension}`,
          bytes: upload.image.bytes,
          contentType: upload.image.contentType
        }))
      }))
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const previous = await db
    .select({ pathname: productAssets.pathname })
    .from(productAssets)
    .where(and(eq(productAssets.productId, product.id), inArray(productAssets.kind, [...storeListingAssetKinds])));

  for (const asset of stored) {
    const values = {
      productId: product.id,
      kind: asset.kind,
      url: asset.url,
      pathname: asset.pathname,
      contentType: asset.image.contentType,
      width: asset.image.width,
      height: asset.image.height,
      bytes: asset.image.bytes.length,
      checksum: asset.checksum,
      sortOrder: asset.sortOrder
    };
    await db
      .insert(productAssets)
      .values(values)
      .onConflictDoUpdate({ target: [productAssets.productId, productAssets.kind, productAssets.sortOrder], set: values });
  }

  // A new version with fewer screenshots than the last import must not keep
  // showing the old tail. But zero is not "fewer": the Lookup API sometimes
  // answers with an empty list for a listing that has screenshots, and taking
  // that at its word would blank a page that was fine.
  const screenshotCount = stored.filter((asset) => asset.kind === 'storeScreenshot').length;
  if (screenshotCount > 0) {
    await db
      .delete(productAssets)
      .where(and(eq(productAssets.productId, product.id), eq(productAssets.kind, 'storeScreenshot'), gte(productAssets.sortOrder, screenshotCount)));
  }

  const appStoreId = String(listing.trackId ?? parsed.id);
  const appStoreUrl = listing.trackViewUrl ? stripTracking(listing.trackViewUrl) : product.appStoreUrl;
  await db.update(products).set({ appStoreId, appStoreUrl, storeSyncedAt: new Date(), updatedAt: new Date() }).where(eq(products.id, product.id));

  // Only files no row points at any more: a slot this import could not refill
  // (a failed icon download) keeps its previous file, and so keeps its blob.
  const current = await db
    .select({ pathname: productAssets.pathname })
    .from(productAssets)
    .where(and(eq(productAssets.productId, product.id), inArray(productAssets.kind, [...storeListingAssetKinds])));
  const referenced = new Set(current.map((row) => row.pathname));
  await deleteBlobs(previous.map((row) => row.pathname).filter((pathname) => !referenced.has(pathname)));

  const warnings: string[] = [];
  if (icon.status === 'rejected') warnings.push('the icon could not be downloaded');
  if (screenshotUrls.length === 0) {
    warnings.push('the App Store returned no iPhone screenshots (it sometimes omits them; any previously imported ones were kept — try Re-import later)');
  } else if (screenshotCount < screenshotUrls.length) {
    warnings.push(`${screenshotUrls.length - screenshotCount} of ${screenshotUrls.length} screenshots could not be downloaded${screenshotCount === 0 ? ' (any previously imported ones were kept)' : ''}`);
  }

  return {
    ok: true,
    appStoreId,
    appStoreUrl,
    iconImported: icon.status === 'fulfilled',
    screenshotCount,
    ...(warnings.length > 0 ? { warning: `Imported, but ${warnings.join('; ')}.` } : {})
  };
}

/** Removes every imported store asset, for when the App Store link is cleared. */
export async function clearAppStoreListing(productId: string) {
  const removed = await db
    .delete(productAssets)
    .where(and(eq(productAssets.productId, productId), inArray(productAssets.kind, [...storeListingAssetKinds])))
    .returning({ pathname: productAssets.pathname });
  await db.update(products).set({ appStoreId: null, storeSyncedAt: null, updatedAt: new Date() }).where(eq(products.id, productId));
  await deleteBlobs(removed.map((row) => row.pathname));
}

// trackViewUrl carries `?uo=4`, an affiliate/tracking parameter. The canonical
// listing URL is everything before it.
function stripTracking(url: string) {
  const parsed = new URL(url);
  parsed.search = '';
  return parsed.toString();
}
