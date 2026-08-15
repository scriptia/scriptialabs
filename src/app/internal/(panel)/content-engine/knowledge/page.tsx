import Link from 'next/link';

import { Card } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Badge, Button } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { knowledgeSourceLabels, knowledgeSourceTones, type KnowledgeSource } from '@/content/content-engine';
import { requireUser } from '@/server/auth/guard';
import { getApps, getKnowledgeEntries } from '@/server/content-engine';
import type { KnowledgeEntryRow } from '@/server/db/schema';

import { AppSelector } from '../_components/app-selector';
import { resolveActiveApp, type ContentEngineSearchParams } from '../_components/active-app';

export default async function KnowledgePage({ searchParams }: Readonly<{ searchParams: Promise<ContentEngineSearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const apps = await getApps();
  const activeApp = resolveActiveApp(apps, params);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Knowledge</Heading>
          <Body size="small" className="mt-1">
            Active principles — global plus specific to this app.
          </Body>
        </div>
        <div className="flex items-center gap-2">
          {apps.length > 0 ? <AppSelector apps={apps} activeAppId={activeApp?.id ?? null} /> : null}
          <Button asChild size="sm">
            <Link href="/internal/content-engine/knowledge/new">New entry</Link>
          </Button>
        </div>
      </div>

      {!activeApp ? <Callout title="No apps yet">Nothing to show without an app.</Callout> : <KnowledgeList appId={activeApp.id} />}
    </Stack>
  );
}

// Reconstructs each active entry's version history by walking supersededById
// backwards through the full (active + inactive) set — fetched once, here, in
// the Server Component. No client fetch, no /search endpoint: everything the
// <details> disclosure below reveals is already in the initial HTML.
function historyChainFor(entry: KnowledgeEntryRow, all: KnowledgeEntryRow[]): KnowledgeEntryRow[] {
  // Indexed by the id of the row it supersedes points AT — i.e. keyed by
  // supersededById — so "who came before this id" is a single map lookup
  // instead of a re-scan of `all` per step of the chain.
  const predecessorOf = new Map(all.filter((row) => row.supersededById).map((row) => [row.supersededById as string, row]));

  const chain: KnowledgeEntryRow[] = [];
  let currentId: string = entry.id;

  for (;;) {
    const previous = predecessorOf.get(currentId);

    if (!previous) break;

    chain.push(previous);
    currentId = previous.id;
  }

  return chain;
}

async function KnowledgeList({ appId }: Readonly<{ appId: string }>) {
  const [activeEntries, allEntries] = await Promise.all([getKnowledgeEntries({ appId }), getKnowledgeEntries({ appId, includeInactive: true })]);

  if (activeEntries.length === 0) {
    return <Callout title="No active knowledge">No KnowledgeEntry is active yet for this app (or globally).</Callout>;
  }

  return (
    <Stack gap="md">
      {activeEntries.map((entry) => {
        const history = historyChainFor(entry, allEntries);

        return (
          <Card key={entry.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={knowledgeSourceTones[entry.source as KnowledgeSource]}>{knowledgeSourceLabels[entry.source as KnowledgeSource]}</Badge>
                <Badge tone={entry.scopeAppId ? 'brand' : 'neutral'}>{entry.scopeAppId ? 'Specific to this app' : 'Global'}</Badge>
                <span className="text-caption text-text-tertiary">confidence {Number(entry.confidence).toFixed(2)}</span>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/internal/content-engine/knowledge/new?supersede=${entry.id}`}>Supersede</Link>
              </Button>
            </div>
            <Body className="mt-2 text-text-primary">{entry.principle}</Body>
            {entry.relatedAngle || entry.relatedHookType ? (
              <Body size="small" className="mt-1">
                {entry.relatedAngle ? `angle: ${entry.relatedAngle}` : null}
                {entry.relatedAngle && entry.relatedHookType ? ' · ' : null}
                {entry.relatedHookType ? `hook_type: ${entry.relatedHookType}` : null}
              </Body>
            ) : null}
            <Body size="small" className="mt-2 text-text-tertiary">
              &ldquo;Supersede&rdquo; does not edit this entry — it creates a new one and marks this one inactive, keeping it in the history below.
            </Body>

            {history.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-body-small text-brand hover:text-brand-strong">History ({history.length} superseded)</summary>
                <Stack gap="sm" className="mt-2 border-l-2 border-border pl-4">
                  {history.map((previous) => (
                    <div key={previous.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={knowledgeSourceTones[previous.source as KnowledgeSource]}>{knowledgeSourceLabels[previous.source as KnowledgeSource]}</Badge>
                        <span className="text-caption text-text-tertiary">
                          confidence {Number(previous.confidence).toFixed(2)} · superseded {previous.createdAt.toLocaleDateString()}
                        </span>
                      </div>
                      <Body size="small" className="mt-1">
                        {previous.principle}
                      </Body>
                    </div>
                  ))}
                </Stack>
              </details>
            ) : null}
          </Card>
        );
      })}
    </Stack>
  );
}
