import { Card } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Badge } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { galleryAssetTypeLabels, isGalleryAssetType, isPreviewableAssetType } from '@/content/content-engine';
import { requireUser } from '@/server/auth/guard';
import { getApps, getGalleryItems } from '@/server/content-engine';
import type { GalleryItemRow } from '@/server/db/schema';

import { AppSelector } from '../_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from '../_components/active-app';
import { AssetTypeFilter } from './asset-type-filter';

type GallerySearchParams = ContentEngineSearchParams & { asset_type?: string };

export default async function GalleryPage({ searchParams }: Readonly<{ searchParams: Promise<GallerySearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const apps = await getApps();
  const activeApp = resolveActiveApp(apps, params);
  const assetType = params.asset_type && isGalleryAssetType(params.asset_type) ? params.asset_type : undefined;

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Gallery</Heading>
          <Body size="small" className="mt-1">
            Reusable assets — what video-production/carousel-production find via <code>GET /gallery/search</code> before generating anything new.
          </Body>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssetTypeFilter />
          {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
        </div>
      </div>

      {!activeApp ? <Callout title="No apps yet">Nothing to show without an app.</Callout> : <GalleryGrid appId={activeApp.id} assetType={assetType} />}
    </Stack>
  );
}

async function GalleryGrid({ appId, assetType }: Readonly<{ appId: string; assetType: 'clip' | 'carousel_image' | undefined }>) {
  const items = await getGalleryItems({ appId, assetType });

  if (items.length === 0) {
    return <Callout title="Gallery is empty">Nothing has been produced yet for this filter.</Callout>;
  }

  return (
    <Grid cols={3} gap="md">
      {items.map((item) => (
        <GalleryCard key={item.id} item={item} />
      ))}
    </Grid>
  );
}

function GalleryCard({ item }: Readonly<{ item: GalleryItemRow }>) {
  const tags = (item.tags as string[] | null) ?? [];

  return (
    <Card className="flex flex-col gap-3">
      {isPreviewableAssetType(item.assetType) ? (
        // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized asset urls (MinIO/S3 in dev/prod), not a local/static image
        <img src={item.url} alt={item.description} className="aspect-[9/16] w-full rounded-md object-cover" />
      ) : (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-[9/16] w-full items-center justify-center rounded-md border border-dashed border-border bg-surface-subtle text-caption text-text-tertiary hover:bg-surface-elevated"
        >
          ▶ Video clip — open
        </a>
      )}

      <div>
        <div className="flex items-center gap-2">
          <Badge tone="brand">{galleryAssetTypeLabels[item.assetType as 'clip' | 'carousel_image'] ?? item.assetType}</Badge>
          <span className="text-caption text-text-tertiary">{item.productionMethod}</span>
        </div>
        <Body size="small" className="mt-1 text-text-primary">
          {item.description}
        </Body>
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        ) : null}
        {item.sourceContentPieceId ? <p className="mt-2 text-caption text-text-tertiary">From piece {item.sourceContentPieceId}</p> : null}
      </div>
    </Card>
  );
}
