// `text` in Postgres, not a PG enum (same reasoning as ADR-010 throughout
// this domain). Only two asset types exist today — a carousel background
// image, or an assembled video clip — matching ProducerAgent's original
// two production paths (image_gen vs. Kling).
export const galleryAssetTypes = ['clip', 'carousel_image'] as const;
export type GalleryAssetType = (typeof galleryAssetTypes)[number];

export function isGalleryAssetType(value: string): value is GalleryAssetType {
  return (galleryAssetTypes as readonly string[]).includes(value);
}

export const galleryAssetTypeLabels: Record<GalleryAssetType, string> = {
  clip: 'Clip',
  carousel_image: 'Image'
};

// Only carousel_image has a renderable preview — a clip is a video url, and
// there's no embedded player in the gallery view yet (see the page itself).
export function isPreviewableAssetType(value: string): value is 'carousel_image' {
  return value === 'carousel_image';
}
