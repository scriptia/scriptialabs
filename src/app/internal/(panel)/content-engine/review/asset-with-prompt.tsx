import { Badge } from '@/components/primitives';
import { Body, Label } from '@/components/typography';
import type { ContentAssetRow } from '@/server/db/schema';

import type { Script } from './script-view';

// Only carousel_slide is an image — final_video is a video url, same
// previewable/not-previewable split gallery/page.tsx already draws for
// GalleryItem (clip vs carousel_image).
function isImageAsset(assetType: string): boolean {
  return assetType === 'carousel_slide';
}

// A carousel_slide's prompt is its own slide's visual_direction (matched by
// orderIndex); final_video is one asset for the whole piece, so its prompt is
// every scene's visual_direction joined — same summary shape
// production.ts already builds for that asset's GalleryItem description.
function promptFor(script: Script, asset: ContentAssetRow): string {
  if (asset.assetType === 'carousel_slide') {
    const slide = script.slides?.find((candidate, index) => (candidate.order ?? index) === asset.orderIndex);

    return slide?.visual_direction ?? '';
  }

  return (script.scenes ?? [])
    .map((scene) => scene.visual_direction)
    .filter((direction): direction is string => Boolean(direction))
    .join('; ');
}

export function AssetWithPrompt({ asset, script }: Readonly<{ asset: ContentAssetRow; script: Script }>) {
  const prompt = promptFor(script, asset);

  return (
    <div className="rounded-md border border-border p-3">
      {isImageAsset(asset.assetType) ? (
        // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized asset urls (MinIO/S3 in dev/prod), not a local/static image
        <img src={asset.url} alt={prompt || asset.assetType} className="aspect-[9/16] w-full rounded-md object-cover" />
      ) : (
        <a
          href={asset.url}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-[9/16] w-full items-center justify-center rounded-md border border-dashed border-border bg-surface-subtle text-caption text-text-tertiary hover:bg-surface-elevated"
        >
          ▶ Video — open
        </a>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Badge>{asset.assetType}</Badge>
        {asset.generationProvider ? <span className="text-caption text-text-tertiary">{asset.generationProvider}</span> : null}
      </div>

      {prompt ? (
        <div className="mt-2">
          <Label>Prompt</Label>
          <Body size="small" className="mt-0.5 italic">
            {prompt}
          </Body>
        </div>
      ) : null}
    </div>
  );
}
