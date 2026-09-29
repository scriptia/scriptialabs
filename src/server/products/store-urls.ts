// Pure helpers for store listing URLs. No I/O, so the validation schema, the
// importer and the tests can all share them.

const APP_STORE_HOSTS = new Set(['apps.apple.com', 'itunes.apple.com']);
const PLAY_STORE_HOST = 'play.google.com';

export type ParsedAppStoreUrl = { id: string; country: string };

/**
 * `https://apps.apple.com/es/app/some-name/id6478123456?l=en` → `{ id: '6478123456', country: 'es' }`.
 *
 * The country matters: the Lookup API answers per storefront, and an app only
 * sold in Spain does not exist in the US store. A link without one (the short
 * `apps.apple.com/app/id…` form) defaults to `us`.
 */
export function parseAppStoreUrl(value: string): ParsedAppStoreUrl | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !APP_STORE_HOSTS.has(url.hostname)) return null;

  const id = url.pathname.match(/\/id(\d{5,})(?:\/|$)/)?.[1];
  if (!id) return null;

  const country = url.pathname.match(/^\/([a-z]{2})\//i)?.[1]?.toLowerCase() ?? 'us';
  return { id, country };
}

/** A Play listing: `https://play.google.com/store/apps/details?id=com.example.app`. */
export function isPlayStoreUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname === PLAY_STORE_HOST && url.pathname.startsWith('/store/apps/details') && Boolean(url.searchParams.get('id'));
  } catch {
    return false;
  }
}

// mzstatic serves any rendition of an image by rewriting the last path segment:
// `…/AppIcon.png/512x512bb.jpg` → `…/AppIcon.png/1024x1024bb.png`. It never
// upscales past the source, so asking for more than exists is harmless.
const SIZE_SEGMENT = /\/\d+x\d+[a-z]*\.(?:jpg|jpeg|png|webp)$/i;

/** The 1024px PNG rendition of an app icon — the size the App Store itself was given. */
export function upscaleArtworkUrl(url: string): string {
  return SIZE_SEGMENT.test(url) ? url.replace(SIZE_SEGMENT, '/1024x1024bb.png') : url;
}

/**
 * A 1290px-wide rendition of a screenshot, height following the source's aspect.
 * The Lookup API hands back ~400px-wide thumbnails, which look soft on a retina
 * product page.
 */
export function upscaleScreenshotUrl(url: string): string {
  return SIZE_SEGMENT.test(url) ? url.replace(SIZE_SEGMENT, '/1290x0w.jpg') : url;
}
