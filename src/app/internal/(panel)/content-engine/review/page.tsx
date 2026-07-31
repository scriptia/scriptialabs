import { Card } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Badge } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading, Label } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { getApps, getReviewQueue } from '@/server/content-engine';

import { AppSelector } from '../_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from '../_components/active-app';
import { ScriptView } from './script-view';

// No approve/reject actions here on purpose — those write endpoints
// (POST /content/:id/approve, /reject) don't exist in this backend yet (see
// docs/content-engine.md's endpoint inventory: only produce/publish/
// knowledge/onboard/social-metrics/from-link/formula are ✅). This page is
// read-only until they're built.
export default async function ReviewPage({ searchParams }: Readonly<{ searchParams: Promise<ContentEngineSearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const apps = await getApps();
  const activeApp = resolveActiveApp(apps, params);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Review queue</Heading>
          <Body size="small" className="mt-1">
            Pieces in <code>ready_for_review</code>, produced by a Skill and waiting for a human to look at them.
          </Body>
        </div>
        {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
      </div>

      {!activeApp ? <Callout title="No apps yet">Nothing to review without an app.</Callout> : <ReviewQueue appId={activeApp.id} />}
    </Stack>
  );
}

async function ReviewQueue({ appId }: Readonly<{ appId: string }>) {
  const pieces = await getReviewQueue({ appId });

  if (pieces.length === 0) {
    return <Callout title="Nothing to review">No pieces are ready_for_review for this app.</Callout>;
  }

  return (
    <Stack gap="md">
      {pieces.map((piece) => (
        <Card key={piece.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{piece.contentType}</Badge>
                {piece.hookType ? <Badge>{piece.hookType}</Badge> : null}
              </div>
              <Heading level={3} className="mt-1">
                {piece.angle ?? '(no angle)'}
              </Heading>
            </div>
          </div>

          <div className="mt-4">
            <ScriptView script={piece.script} />
          </div>

          {piece.assets.length > 0 ? (
            <div className="mt-4">
              <Label>Assets</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {piece.assets
                  .slice()
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((asset) => (
                    <a
                      key={asset.id}
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border px-2 py-1 text-caption text-brand hover:bg-surface-subtle"
                    >
                      {asset.assetType}
                      {asset.generationProvider ? ` · ${asset.generationProvider}` : ''}
                      {asset.productionMethod === 'dry_run' ? ' (dry-run)' : ''}
                    </a>
                  ))}
              </div>
            </div>
          ) : null}
        </Card>
      ))}
    </Stack>
  );
}
