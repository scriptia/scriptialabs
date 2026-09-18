// The rendered files a product carries. Written by product-agent's `identity`
// stage (which runs its own scripts/gen-icons.mjs to produce the PNGs), uploaded
// to Vercel Blob, and indexed by the `product_assets` table — the row holds the
// CDN URL, never the bytes.
//
// Kinds mirror ASSET_SIZES in product-agent/orchestrator/publish_product.py,
// plus the two the site needs that the store package does not (`logoSvg` for the
// product page, `ogImage` for social cards). Keep the two lists in step: that
// script reads each PNG's IHDR chunk and fails the run when a dimension is
// wrong, so a kind it does not know about is a kind nothing verifies.

export const productAssetKinds = [
  'logoSvg',
  'icon',
  'androidForeground',
  'androidBackground',
  'androidMonochrome',
  'splashIcon',
  'favicon',
  'screenshot',
  'ogImage'
] as const;

export type ProductAssetKind = (typeof productAssetKinds)[number];

export const productAssetKindLabels: Record<ProductAssetKind, string> = {
  logoSvg: 'Logo (SVG)',
  icon: 'App icon',
  androidForeground: 'Android icon — foreground',
  androidBackground: 'Android icon — background',
  androidMonochrome: 'Android icon — monochrome',
  splashIcon: 'Splash icon',
  favicon: 'Favicon',
  screenshot: 'Store screenshot',
  ogImage: 'Social card'
};

// Expected square dimension in pixels, or null where there isn't one. The
// numbers are publish_product.py's ASSET_SIZES; `logoSvg` has no raster size,
// and screenshots/OG images vary by device and platform.
export const productAssetExpectedSize: Record<ProductAssetKind, number | null> = {
  logoSvg: null,
  icon: 1024,
  androidForeground: 512,
  androidBackground: 512,
  androidMonochrome: 432,
  splashIcon: 240,
  favicon: 48,
  screenshot: null,
  ogImage: null
};

// Kinds that occupy exactly one slot. Everything else may repeat under
// (productId, kind, sortOrder) — today only `screenshot`, which ships six.
export const singletonProductAssetKinds: readonly ProductAssetKind[] = [
  'logoSvg',
  'icon',
  'androidForeground',
  'androidBackground',
  'androidMonochrome',
  'splashIcon',
  'favicon',
  'ogImage'
];

export function isProductAssetKind(value: string): value is ProductAssetKind {
  return (productAssetKinds as readonly string[]).includes(value);
}
