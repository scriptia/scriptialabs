import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { deleteFunnelEntry } from '@/server/actions/app-metrics';
import { getAppBySlug, listFunnelEntries } from '@/server/queries/app-metrics';

import { buildFunnelSteps } from '../_components/funnel';
import { FunnelChart } from '../_components/funnel-chart';
import { FunnelEntryForm } from './funnel-entry-form';

export default async function AppMetricsPage({ params, searchParams }: Readonly<{ params: Promise<{ slug: string }>; searchParams: Promise<{ week?: string }> }>) {
  await requireUser();

  const { slug } = await params;
  const { week } = await searchParams;

  const app = await getAppBySlug(slug);

  if (!app) {
    notFound();
  }

  const entries = await listFunnelEntries(app.id);
  const selected = week ? (entries.find((entry) => entry.periodStart === week) ?? entries[0] ?? null) : (entries[0] ?? null);
  const steps = buildFunnelSteps(selected);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Stack gap="xs">
          <Link href="/internal/metrics" className="text-sm text-text-secondary hover:text-text-primary hover:underline">
            ← Metrics
          </Link>
          <Heading level={1}>{app.name}</Heading>
          <Body className="text-text-secondary">{app.niche}</Body>
        </Stack>
      </div>

      <Grid cols={2} gap="lg">
        <Surface className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <Heading level={3}>Funnel</Heading>
            {selected ? <Body className="text-xs text-text-tertiary">week of {selected.periodStart}</Body> : null}
          </div>

          {selected ? (
            <FunnelChart steps={steps} />
          ) : (
            <Body className="text-sm text-text-secondary">No weeks logged yet. Add one on the right to see the funnel.</Body>
          )}
        </Surface>

        <Surface className="flex flex-col gap-4 p-5">
          <Heading level={3}>{selected && selected.periodStart === week ? 'Edit week' : 'Log a week'}</Heading>
          <FunnelEntryForm appId={app.id} existing={week ? (entries.find((entry) => entry.periodStart === week) ?? undefined) : undefined} />
        </Surface>
      </Grid>

      <Surface className="flex flex-col gap-3 p-5">
        <Heading level={3}>History</Heading>

        {entries.length === 0 ? (
          <Body className="text-sm text-text-secondary">No weeks logged yet.</Body>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-tertiary">
                  <th className="py-2 pr-4 font-medium">Week</th>
                  <th className="py-2 pr-4 font-medium">TikTok views</th>
                  <th className="py-2 pr-4 font-medium">Profile visits</th>
                  <th className="py-2 pr-4 font-medium">Link clicks</th>
                  <th className="py-2 pr-4 font-medium">Page views</th>
                  <th className="py-2 pr-4 font-medium">Downloads</th>
                  <th className="py-2 pr-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/internal/metrics/${slug}?week=${entry.periodStart}`} className="text-brand hover:underline">
                        {entry.periodStart}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{entry.tiktokViews.toLocaleString()}</td>
                    <td className="py-2 pr-4 tabular-nums">{entry.tiktokProfileVisits.toLocaleString()}</td>
                    <td className="py-2 pr-4 tabular-nums">{entry.tiktokLinkClicks.toLocaleString()}</td>
                    <td className="py-2 pr-4 tabular-nums">{entry.appStoreProductPageViews.toLocaleString()}</td>
                    <td className="py-2 pr-4 tabular-nums">{entry.appStoreDownloads.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">
                      <form action={deleteFunnelEntry}>
                        <input type="hidden" name="id" value={entry.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </Stack>
  );
}
