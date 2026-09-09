import Link from 'next/link';

import { Badge } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { listAppsWithLatestFunnel } from '@/server/queries/app-metrics';

import { FunnelChart } from './_components/funnel-chart';
import { buildFunnelSteps } from './_components/funnel';

export default async function MetricsPage() {
  await requireUser();

  const rows = await listAppsWithLatestFunnel();

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Heading level={1}>Metrics</Heading>
        <Body className="text-text-secondary">
          TikTok organic to App Store Connect: one funnel per app, from views to downloads. Log a week&apos;s numbers to see where it&apos;s leaking.
        </Body>
      </Stack>

      {rows.length === 0 ? (
        <Surface className="p-6">
          <Body className="text-text-secondary">No apps yet. Add one from Content Engine → Apps first.</Body>
        </Surface>
      ) : (
        <Grid cols={3} gap="lg">
          {rows.map(({ app, latest }) => {
            const steps = buildFunnelSteps(latest);

            return (
              <Link key={app.id} href={`/internal/metrics/${app.slug}`} className="block">
                <Surface className="flex h-full flex-col gap-4 p-5 transition-colors hover:border-brand">
                  <div className="flex items-start justify-between gap-2">
                    <Stack gap="xs">
                      <Heading level={3}>{app.name}</Heading>
                      <Body className="text-xs text-text-tertiary">{app.niche}</Body>
                    </Stack>
                    {latest ? (
                      <Badge tone="neutral">week of {latest.periodStart}</Badge>
                    ) : (
                      <Badge tone="warning">no data</Badge>
                    )}
                  </div>

                  {latest ? (
                    <FunnelChart steps={steps} compact />
                  ) : (
                    <Body className="text-sm text-text-secondary">Log this app&apos;s first week to start the funnel.</Body>
                  )}
                </Surface>
              </Link>
            );
          })}
        </Grid>
      )}
    </Stack>
  );
}
