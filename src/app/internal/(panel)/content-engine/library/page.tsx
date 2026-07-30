import Link from 'next/link';

import { Card } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Button } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { isContentPieceStatus, type ContentPieceStatus } from '@/content/content-engine';
import { requireUser } from '@/server/auth/guard';
import { getApps, getContentPieces } from '@/server/content-engine';

import { AppSelector } from '../_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from '../_components/active-app';
import { ContentPieceStatusBadge } from '../_components/content-piece-status-badge';
import { ScriptView } from '../review/script-view';
import { StatusFilter } from './status-filter';

type LibrarySearchParams = ContentEngineSearchParams & {
  status?: string;
  page?: string;
};

const PAGE_SIZE = 10;
// getContentPieces() defaults to a 14-day window (right for strategist's
// "recently used angle" check); the library is meant to browse everything, so
// it passes a window wide enough to be "all time" in practice rather than
// changing that function's default for its other, external caller.
const ALL_TIME_DAYS = 365 * 100;

export default async function LibraryPage({ searchParams }: Readonly<{ searchParams: Promise<LibrarySearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const apps = await getApps();
  const activeApp = resolveActiveApp(apps, params);
  const status = params.status && isContentPieceStatus(params.status) ? params.status : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Library</Heading>
          <Body size="small" className="mt-1">
            Every ContentPiece for this app, any status.
          </Body>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusFilter />
          {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
        </div>
      </div>

      {!activeApp ? <Callout title="No apps yet">Nothing to list without an app.</Callout> : <LibraryList appId={activeApp.id} status={status} page={page} />}
    </Stack>
  );
}

async function LibraryList({ appId, status, page }: Readonly<{ appId: string; status: ContentPieceStatus | undefined; page: number }>) {
  const offset = (page - 1) * PAGE_SIZE;
  // Fetch one extra row to know whether a next page exists, without a
  // separate COUNT query.
  const rows = await getContentPieces({ appId, status, days: ALL_TIME_DAYS, limit: PAGE_SIZE + 1, offset });
  const hasMore = rows.length > PAGE_SIZE;
  const pieces = rows.slice(0, PAGE_SIZE);

  if (pieces.length === 0) {
    return <Callout title="No pieces">{page > 1 ? 'No more pieces on this page.' : 'No ContentPiece matches this filter yet.'}</Callout>;
  }

  const query = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set('app_id', appId);
    if (status) params.set('status', status);
    params.set('page', String(targetPage));
    return `?${params}`;
  };

  return (
    <Stack gap="md">
      {pieces.map((piece) => (
        <Card key={piece.id}>
          <div className="flex flex-wrap items-center gap-2">
            <ContentPieceStatusBadge status={piece.status} />
            <span className="text-caption text-text-tertiary">{piece.contentType}</span>
            {piece.hookType ? <span className="text-caption text-text-tertiary">· {piece.hookType}</span> : null}
            <span className="ml-auto text-caption text-text-tertiary">{piece.createdAt.toLocaleDateString()}</span>
          </div>
          <Heading level={3} className="mt-1">
            {piece.angle ?? '(no angle)'}
          </Heading>
          <div className="mt-3">
            <ScriptView script={piece.script} />
          </div>
        </Card>
      ))}

      <div className="flex items-center justify-between">
        {page > 1 ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={query(page - 1)}>Previous</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Previous
          </Button>
        )}
        <span className="text-caption text-text-tertiary">Page {page}</span>
        {hasMore ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={query(page + 1)}>Next</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </Stack>
  );
}
