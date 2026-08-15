'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Select } from '@/components/primitives';
import { galleryAssetTypeLabels, galleryAssetTypes } from '@/content/content-engine';

// Same URL-as-state pattern as library's StatusFilter.
export function AssetTypeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={searchParams.get('asset_type') ?? ''}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());

        if (event.target.value) {
          params.set('asset_type', event.target.value);
        } else {
          params.delete('asset_type');
        }

        router.push(`${pathname}?${params}`);
      }}
      className="h-9 w-auto"
      aria-label="Filter by asset type"
    >
      <option value="">All asset types</option>
      {galleryAssetTypes.map((assetType) => (
        <option key={assetType} value={assetType}>
          {galleryAssetTypeLabels[assetType]}
        </option>
      ))}
    </Select>
  );
}
