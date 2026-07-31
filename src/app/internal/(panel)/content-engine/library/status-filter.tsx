'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Select } from '@/components/primitives';
import { contentPieceStatusLabels, contentPieceStatuses } from '@/content/content-engine';

// Same URL-as-state pattern as AppSelector/BetFilters. Changing the status
// filter resets `page` to 1 — staying on page 3 of a filter that now matches
// fewer rows would silently show "no results" instead of the first page.
export function StatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={searchParams.get('status') ?? ''}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());

        if (event.target.value) {
          params.set('status', event.target.value);
        } else {
          params.delete('status');
        }

        params.delete('page');
        router.push(`${pathname}?${params}`);
      }}
      className="h-9 w-auto"
      aria-label="Filter by status"
    >
      <option value="">All statuses</option>
      {contentPieceStatuses.map((status) => (
        <option key={status} value={status}>
          {contentPieceStatusLabels[status]}
        </option>
      ))}
    </Select>
  );
}
