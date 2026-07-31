'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Select } from '@/components/primitives';

export type AppOption = { id: string; name: string; niche: string };

// Active app lives in the URL (?app_id=...), not client state or localStorage
// — same reasoning as BetFilters: a filtered/scoped view should be a
// shareable link, and every page under content-engine/ is a Server Component
// that reads this same param directly from `searchParams`.
export function AppSelector({ apps, activeAppId }: Readonly<{ apps: AppOption[]; activeAppId: string | null }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={activeAppId ?? ''}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('app_id', event.target.value);
        router.push(`${pathname}?${params}`);
      }}
      className="h-9 w-auto"
      aria-label="Active app"
    >
      {apps.map((app) => (
        <option key={app.id} value={app.id}>
          {app.name} ({app.niche})
        </option>
      ))}
    </Select>
  );
}
