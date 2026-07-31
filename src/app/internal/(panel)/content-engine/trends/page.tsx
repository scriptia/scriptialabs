import { Card } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Badge } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading, Label } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { getApps, getTrendSources } from '@/server/content-engine';
import type { TrendSourceRow } from '@/server/db/schema';

import { AppSelector } from '../_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from '../_components/active-app';
import { FromLinkForm } from './from-link-form';

export default async function TrendsPage({ searchParams }: Readonly<{ searchParams: Promise<ContentEngineSearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const apps = await getApps();
  const activeApp = resolveActiveApp(apps, params);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Trends</Heading>
          <Body size="small" className="mt-1">
            Viral videos registered for analysis — trend-analysis reads the transcript/scene breakdown itself (no Twelve Labs call from this panel, see docs/content-engine.md).
          </Body>
        </div>
        {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
      </div>

      {!activeApp ? <Callout title="No apps yet">Register an app before adding a trend link.</Callout> : <TrendsSection app={activeApp} />}
    </Stack>
  );
}

async function TrendsSection({ app }: Readonly<{ app: { id: string; niche: string } }>) {
  const trendSources = await getTrendSources({ niche: app.niche });

  return (
    <Stack gap="lg">
      <Card>
        <Heading level={3}>Register a new link</Heading>
        <Body size="small" className="mt-1">
          Creates the TrendSource with an empty <code>extracted_formula</code> — trend-analysis fills that in separately.
        </Body>
        <div className="mt-4">
          <FromLinkForm appId={app.id} />
        </div>
      </Card>

      {trendSources.length === 0 ? (
        <Callout title="No trend sources yet">Nothing registered for niche &ldquo;{app.niche}&rdquo; yet.</Callout>
      ) : (
        <Stack gap="md">
          {trendSources.map((trendSource) => (
            <TrendSourceCard key={trendSource.id} trendSource={trendSource} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function TrendSourceCard({ trendSource }: Readonly<{ trendSource: TrendSourceRow }>) {
  const formula = trendSource.extractedFormula as Record<string, unknown>;
  const hasFormula = formula && Object.keys(formula).length > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{trendSource.platform}</Badge>
        <span className="text-caption text-text-tertiary">{trendSource.analyzedAt.toLocaleDateString()}</span>
      </div>
      <a href={trendSource.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-body-small text-brand hover:text-brand-strong">
        {trendSource.sourceUrl}
      </a>

      <div className="mt-3">
        <Label>Extracted formula</Label>
        {hasFormula ? (
          <ul className="mt-1 space-y-0.5">
            {Object.entries(formula).map(([key, value]) => (
              <li key={key} className="text-body-small text-text-primary">
                <span className="text-text-tertiary">{key}:</span> {String(value)}
              </li>
            ))}
          </ul>
        ) : (
          <Body size="small" className="mt-1">
            Pending analysis — trend-analysis hasn&rsquo;t run on this link yet.
          </Body>
        )}
      </div>
    </Card>
  );
}
