import Link from 'next/link';
import { desc, eq, inArray } from 'drizzle-orm';

import { Alert } from '@/components/feedback';
import { Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { db } from '@/server/db/client';
import { pipelineRuns } from '@/server/db/schema';

import { DiscoveryForm } from './discovery-form';

/**
 * Queue a discovery run from anywhere, including a phone.
 *
 * Discovery is the one job with no bet to hang a trigger off, so it gets its own
 * page rather than living on a bet's Pipeline tab.
 */
export default async function NewRunPage() {
  await requireUser();

  // Runs worth resuming: discovery runs that ended without succeeding. The
  // laptop's filesystem is the real authority on what is resumable, but this is
  // what the panel knows, and it saves typing a run id from memory on a phone.
  const previous = await db
    .select({ externalRunId: pipelineRuns.externalRunId, status: pipelineRuns.status })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.kind, 'discovery'))
    .orderBy(desc(pipelineRuns.createdAt))
    .limit(40);

  const resumable = [
    ...new Set(
      previous
        .filter((run) => run.externalRunId && run.status !== 'succeeded' && run.status !== 'cancelled')
        .map((run) => run.externalRunId as string)
    )
  ];

  const [inFlight] = await db
    .select({ id: pipelineRuns.id, status: pipelineRuns.status, externalRunId: pipelineRuns.externalRunId, retryAfter: pipelineRuns.retryAfter })
    .from(pipelineRuns)
    .where(inArray(pipelineRuns.status, ['queued', 'claimed', 'running', 'blocked']))
    .orderBy(desc(pipelineRuns.createdAt))
    .limit(1);

  return (
    <Stack gap="lg">
      <div>
        <Heading level={1}>Queue a run</Heading>
        <Body size="small" className="mt-1">
          Hunt markets for new bets. Product-agent and build runs are queued from a bet&apos;s Pipeline tab.
        </Body>
      </div>

      {inFlight ? (
        <Alert tone={inFlight.status === 'blocked' ? 'warning' : 'info'} title={`A run is already ${inFlight.status}`}>
          <Link href={`/internal/runs/${inFlight.id}`} className="text-brand hover:underline">
            {inFlight.externalRunId ?? 'View it'}
          </Link>
          {inFlight.retryAfter ? ` — waiting on quota until ${new Date(inFlight.retryAfter).toLocaleString()}.` : '.'}
        </Alert>
      ) : null}

      <Surface className="p-5">
        <DiscoveryForm resumable={resumable} />
      </Surface>

      <Body size="small" className="text-text-tertiary">
        <Link href="/internal/runs" className="hover:underline">
          ← All runs
        </Link>
      </Body>
    </Stack>
  );
}
