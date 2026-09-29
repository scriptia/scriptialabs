import 'server-only';

import { createHash } from 'node:crypto';
import { put } from '@vercel/blob';

// The one way a product image reaches Vercel Blob. Two callers: the runner's
// upload route (api/runs/[id]/assets) and the App Store listing import
// (server/products/app-store-import.ts). They share this so a stored file has
// one path scheme and one checksum format whichever side wrote it.

export type UploadedProductAsset = {
  url: string;
  pathname: string;
  /** `sha256:<hex>`, the same format publish_product.py records from disk. */
  checksum: string;
  bytes: number;
};

export class BlobUploadError extends Error {}

export async function uploadProductAsset({
  slug,
  name,
  bytes,
  contentType
}: Readonly<{
  slug: string;
  /** File name under `products/{slug}/`, extension included, e.g. `icon-0.png`. */
  name: string;
  bytes: Buffer;
  contentType: string;
}>): Promise<UploadedProductAsset> {
  const checksum = createHash('sha256').update(bytes).digest('hex');

  // `addRandomSuffix` so a re-published asset gets a new immutable URL rather
  // than fighting the CDN cache on the old one — the row is what points at the
  // current file, and the URL itself never has to be invalidated.
  //
  // Bounded on purpose. @vercel/blob retries internally with backoff, so a token the blob API
  // rejects turns into a long series of retries rather than a fast throw — and if that outlasts the
  // function's own limit the platform kills the invocation and answers 502 with an EMPTY body,
  // which is indistinguishable from the app being broken. A 20s ceiling means the caller always
  // gets to say what happened.
  try {
    const blob = await put(`products/${slug}/${name}`, bytes, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      abortSignal: AbortSignal.timeout(20_000)
    });
    return { url: blob.url, pathname: blob.pathname, checksum: `sha256:${checksum}`, bytes: bytes.length };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new BlobUploadError(`Blob storage rejected ${name} (${bytes.length} bytes, ${contentType}): ${detail}`, { cause: error });
  }
}
