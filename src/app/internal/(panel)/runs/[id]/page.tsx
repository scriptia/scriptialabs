import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { isTerminalPipelineRunStatus, pipelineRunKindLabels } from '@/content/internal';
import { requireUser } from '@/server/auth/guard';
import { buildJobDescriptor } from '@/server/pipeline/descriptor';
import { getRun, getRunEvents } from '@/server/queries/pipeline-runs';

import { formatRelative } from '../../_components/format';
import { RunStatusBadge } from '../../_components/run-status-badge';
import { RetryRunButton } from './retry-run-button';
import { RunLive } from './run-live';

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <p className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
      <p className="mt-0.5 text-body-small text-text-primary">{children}</p>
    </div>
  );
}

export default async function RunDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  await requireUser();

  const { id } = await params;
  const run = await getRun(id);

  if (!run) {
    notFound();
  }

  const [events, descriptor] = await Promise.all([getRunEvents(id), buildJobDescriptor(id)]);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={1}>{pipelineRunKindLabels[run.kind]}</Heading>
            <RunStatusBadge status={run.status} />
          </div>
          <Body size="small" className="mt-1">
            <Link href={`/internal/bets/${run.betSlug}`} className="text-brand hover:underline">
              {run.betSlug}
            </Link>
            {run.externalRunId ? ` · ${run.externalRunId}` : ''} · queued {formatRelative(run.queuedAt)}
          </Body>
        </div>
        {isTerminalPipelineRunStatus(run.status) ? <RetryRunButton runId={run.id} /> : null}
      </div>

      <Surface className="p-5">
        <Grid cols={4} gap="md">
          <Field label="Requested by">{run.requestedByName ?? 'Machine'}</Field>
          <Field label="Runner">{run.runnerId ?? '—'}</Field>
          <Field label="Attempt">
            {run.attempt} of {run.maxAttempts}
          </Field>
          <Field label="Bet status">{run.betStatus}</Field>
          <Field label="Started">{run.startedAt ? formatRelative(run.startedAt) : '—'}</Field>
          <Field label="Finished">{run.finishedAt ? formatRelative(run.finishedAt) : '—'}</Field>
          <Field label="Lease expires">{run.leaseExpiresAt ? formatRelative(run.leaseExpiresAt) : '—'}</Field>
          <Field label="Log">
            {run.logUrl ? (
              <a href={run.logUrl} className="text-brand hover:underline" target="_blank" rel="noreferrer">
                Open
              </a>
            ) : (
              '—'
            )}
          </Field>
        </Grid>
      </Surface>

      <RunLive
        runId={run.id}
        initial={{
          status: run.status,
          progress: run.progress,
          error: run.error,
          attempt: run.attempt,
          startedAt: run.startedAt?.toISOString() ?? null,
          finishedAt: run.finishedAt?.toISOString() ?? null,
          heartbeatAt: run.heartbeatAt?.toISOString() ?? null,
          cancelRequested: Boolean(run.cancelRequestedAt),
          events: events.map((event) => ({
            id: event.id,
            at: event.at.toISOString(),
            level: event.level,
            stage: event.stage,
            message: event.message
          }))
        }}
      />

      {run.result ? (
        <Stack gap="sm">
          <Heading level={3}>Result</Heading>
          <Surface className="p-4">
            <pre className="overflow-x-auto text-caption text-text-secondary">{JSON.stringify(run.result, null, 2)}</pre>
          </Surface>
        </Stack>
      ) : null}

      {/* The exact JSON the runner received. Nothing in it is secret — the
          callbacks are paths, not tokens — and having it one click away turns
          "why did the run do that" into a question you can answer by reading,
          and lets you reproduce a run by hand with curl. */}
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-4 py-3 text-body-small font-medium text-text-primary">Job descriptor</summary>
        <div className="border-t border-border p-4">
          <pre className="overflow-x-auto text-caption text-text-secondary">{JSON.stringify(descriptor, null, 2)}</pre>
        </div>
      </details>

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/internal/runs">← All runs</Link>
        </Button>
      </div>
    </Stack>
  );
}
