'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Button, Input, Select } from '@/components/primitives';
import { betAudienceLabels, betAudiences, betStatusLabels, betStatuses } from '@/content/internal';

export type FilterUser = { id: string; name: string };

// Filters live in the URL rather than component state so a filtered view is a
// shareable link — "here's every stalled B2C bet" is a message you can paste.
export function BetFilters({ owners }: Readonly<{ owners: FilterUser[] }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get('q') ?? '');

  const apply = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      router.push(params.size > 0 ? `${pathname}?${params}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const hasFilters = ['status', 'audience', 'owner', 'q', 'archived'].some((key) => searchParams.get(key));

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        apply('q', query.trim());
      }}
    >
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, slug or description" className="h-9 w-full sm:w-64" aria-label="Search bets" />

      <Select value={searchParams.get('status') ?? ''} onChange={(event) => apply('status', event.target.value)} className="h-9 w-auto" aria-label="Filter by status">
        <option value="">All statuses</option>
        {betStatuses.map((status) => (
          <option key={status} value={status}>
            {betStatusLabels[status]}
          </option>
        ))}
      </Select>

      <Select value={searchParams.get('audience') ?? ''} onChange={(event) => apply('audience', event.target.value)} className="h-9 w-auto" aria-label="Filter by audience">
        <option value="">All audiences</option>
        {betAudiences.map((audience) => (
          <option key={audience} value={audience}>
            {betAudienceLabels[audience]}
          </option>
        ))}
      </Select>

      <Select value={searchParams.get('owner') ?? ''} onChange={(event) => apply('owner', event.target.value)} className="h-9 w-auto" aria-label="Filter by owner">
        <option value="">Anyone</option>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name}
          </option>
        ))}
      </Select>

      <Select value={searchParams.get('archived') ?? ''} onChange={(event) => apply('archived', event.target.value)} className="h-9 w-auto" aria-label="Include archived">
        <option value="">Active only</option>
        <option value="1">Include archived</option>
      </Select>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery('');
            router.push(pathname);
          }}
        >
          Clear
        </Button>
      ) : null}
    </form>
  );
}
