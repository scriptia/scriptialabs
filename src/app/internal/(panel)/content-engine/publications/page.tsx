import { Card } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Badge } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading, Label } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { getApps, getPublications } from '@/server/content-engine';

import { AppSelector } from '../_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from '../_components/active-app';

export default async function PublicationsPage({ searchParams }: Readonly<{ searchParams: Promise<ContentEngineSearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const apps = await getApps();
  const activeApp = resolveActiveApp(apps, params);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Publications</Heading>
          <Body size="small" className="mt-1">
            What actually went out, and its most recent metric snapshot.
          </Body>
        </div>
        {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
      </div>

      {!activeApp ? <Callout title="No apps yet">Nothing to show without an app.</Callout> : <PublicationList appId={activeApp.id} />}
    </Stack>
  );
}

type PublicationRow = Awaited<ReturnType<typeof getPublications>>[number];

const METRICS: Array<{ key: keyof PublicationRow; label: string }> = [
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'reach', label: 'Reach' }
];

async function PublicationList({ appId }: Readonly<{ appId: string }>) {
  const publications = await getPublications({ appId });

  if (publications.length === 0) {
    return <Callout title="No publications yet">Nothing has been published for this app yet.</Callout>;
  }

  return (
    <Stack gap="md">
      {publications.map((publication) => {
        const hasMetrics = publication.views !== null;

        return (
          <Card key={publication.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{publication.platform}</Badge>
              {publication.hookType ? <span className="text-caption text-text-tertiary">{publication.hookType}</span> : null}
              <span className="ml-auto text-caption text-text-tertiary">{publication.postedAt ? publication.postedAt.toLocaleDateString() : 'not posted yet'}</span>
            </div>
            <Heading level={3} className="mt-1">
              {publication.angle ?? '(no angle)'}
            </Heading>
            {publication.permalink ? (
              <a href={publication.permalink} target="_blank" rel="noreferrer" className="mt-1 block break-all text-body-small text-brand hover:text-brand-strong">
                {publication.permalink}
              </a>
            ) : null}

            <div className="mt-3">
              <Label>Latest metrics</Label>
              {hasMetrics ? (
                <div className="mt-1 flex flex-wrap gap-4">
                  {METRICS.map((metric) => (
                    <div key={metric.key}>
                      <div className="text-body font-medium text-text-primary">{String(publication[metric.key] ?? 0)}</div>
                      <div className="text-caption text-text-tertiary">{metric.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <Body size="small" className="mt-1">
                  No metrics yet.
                </Body>
              )}
            </div>
          </Card>
        );
      })}
    </Stack>
  );
}
