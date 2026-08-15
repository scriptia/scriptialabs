import { Card } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Badge, Button } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { contentPieceStatusLabels, contentPieceStatusTones, type ContentPieceStatus } from '@/content/content-engine';
import { markDiscarded } from '@/server/actions/content-engine';
import { requireUser } from '@/server/auth/guard';
import { getApps, getReviewQueue } from '@/server/content-engine';

import { AppSelector } from '../_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from '../_components/active-app';
import { AssetWithPrompt } from './asset-with-prompt';
import { PublishForm } from './publish-form';
import { ScriptView, type Script } from './script-view';

const REVIEW_STATUSES: ContentPieceStatus[] = ['scripted', 'ready_for_review'];

// approve/reject as separate write endpoints (POST /content/:id/approve,
// /reject) still don't exist in this backend (see docs/content-engine.md's
// endpoint inventory) — markPublished/markDiscarded below are dashboard-only
// actions covering the two outcomes that actually end a piece's time here.
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
            Scripted pieces waiting on feedback before anything gets produced, plus produced pieces (<code>ready_for_review</code>) waiting on a
            publish/discard call.
          </Body>
        </div>
        {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
      </div>

      {!activeApp ? <Callout title="No apps yet">Nothing to review without an app.</Callout> : <ReviewQueue appId={activeApp.id} />}
    </Stack>
  );
}

async function ReviewQueue({ appId }: Readonly<{ appId: string }>) {
  const pieces = await getReviewQueue({ appId, statuses: REVIEW_STATUSES });

  if (pieces.length === 0) {
    return <Callout title="Nothing to review">No pieces are scripted or ready_for_review for this app.</Callout>;
  }

  return (
    <Stack gap="md">
      {pieces.map((piece) => {
        const script = (piece.script ?? {}) as Script;
        const hasAssets = piece.assets.length > 0;

        return (
          <Card key={piece.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{piece.contentType}</Badge>
                  <Badge tone={contentPieceStatusTones[piece.status]}>{contentPieceStatusLabels[piece.status]}</Badge>
                  {piece.hookType ? <Badge>{piece.hookType}</Badge> : null}
                </div>
                <Heading level={3} className="mt-1">
                  {piece.angle ?? '(no angle)'}
                </Heading>
              </div>
            </div>

            <div className="mt-4">
              {hasAssets ? (
                <Grid cols={3} gap="md">
                  {piece.assets
                    .slice()
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((asset) => (
                      <AssetWithPrompt key={asset.id} asset={asset} script={script} />
                    ))}
                </Grid>
              ) : (
                <ScriptView script={piece.script} />
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-3">
              <PublishForm contentPieceId={piece.id} />
              <form action={markDiscarded}>
                <input type="hidden" name="contentPieceId" value={piece.id} />
                <Button type="submit" variant="danger" size="sm">
                  Discard
                </Button>
              </form>
            </div>
          </Card>
        );
      })}
    </Stack>
  );
}
